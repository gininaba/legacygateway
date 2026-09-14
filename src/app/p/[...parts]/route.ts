import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/db";
import { history } from "@/db/schema";
import { CONFIG, PLACEHOLDER_GIF } from "@/lib/config";
import { assertPublicHttpUrl, SsrfError } from "@/lib/ssrf";
import { checkMinute, checkDay } from "@/lib/ratelimit";
import { sidFromReq, ensureSession, mergeSettings, loadJar, saveJar } from "@/lib/session";
import { mapReferer, makeProxyPath } from "@/lib/urlrew";
import { fetchUpstream, sanitizeResponseHeaders } from "@/lib/upstream";
import { decodeBody } from "@/lib/charset";
import { transformHtml } from "@/lib/rewrite/html";
import { rewriteCss } from "@/lib/rewrite/css";
import { transpileJs } from "@/lib/rewrite/js";
import { processImage } from "@/lib/img";
import { originFromReq } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function errorPage(status: number, title: string, detail: string): NextResponse {
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title}</title><style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;` +
    `max-width:36em;margin:60px auto;padding:0 20px;color:#1f2937;line-height:1.5}` +
    `h1{font-size:22px}a{color:#0b5bd3}code{background:#f3f4f6;padding:2px 5px;border-radius:4px;` +
    `word-break:break-all;font-size:13px}</style></head><body>` +
    `<h1>${title}</h1><p>${detail}</p>` +
    `<p><a href="/">&#8962; Back to the Gateway</a></p></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

interface Params {
  parts: string[];
}

async function handle(req: NextRequest, ctx: { params: Promise<Params> }): Promise<Response> {
  const { parts } = await ctx.params;

  // ---- 1. Reconstruct the upstream URL ----------------------------------
  if (parts.length < 2 || (parts[0] !== "http" && parts[0] !== "https")) {
    return errorPage(
      400,
      "Not a proxied address",
      `The gateway expects addresses shaped like <code>/p/https/example.com/page</code>. ` +
        `Start from the <a href="/">gateway home page</a> instead.`,
    );
  }
  const scheme = parts[0];
  const host = parts[1];
  const upstreamRaw = `${scheme}://${host}/${parts.slice(2).join("/")}${req.nextUrl.search}`;

  const ownHost = req.headers.get("host") || "";
  if (host === ownHost) {
    return errorPage(400, "Loop blocked", "The gateway refuses to proxy itself.");
  }

  let upstreamUrl: URL;
  try {
    upstreamUrl = await assertPublicHttpUrl(upstreamRaw);
  } catch (e) {
    if (e instanceof SsrfError) {
      return errorPage(403, "Address blocked by gateway security policy", `${e.message}.`);
    }
    throw e;
  }

  // ---- 2. Session, settings, rate limits ---------------------------------
  const sid = sidFromReq(req);
  const sessionRow = sid ? await ensureSession(sid) : null;
  const settings = mergeSettings(sessionRow?.settings);
  let jar = await loadJar(sessionRow?.jar || "");

  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (!checkMinute(ip) || (sid && !checkMinute("s:" + sid))) {
    return errorPage(429, "Slow down", "Rate limit exceeded. Wait a minute and try again.");
  }

  const clientAccept = req.headers.get("accept");
  const isDocument = !!clientAccept && clientAccept.includes("text/html");
  if (isDocument && sid && !checkDay("p:" + sid)) {
    return errorPage(
      429,
      "Daily page budget reached",
      "This session fetched its daily maximum of pages through the shared gateway. That cap exists to keep the service fast and un-abused for everyone.",
    );
  }

  // ---- 3. Build the request body ------------------------------------------
  const method = req.method.toUpperCase();
  let body: BodyInit | null = null;
  let contentType: string | null = null;
  if (method !== "GET" && method !== "HEAD") {
    const reqType = (req.headers.get("content-type") || "").toLowerCase();
    if (reqType.includes("form")) {
      let fd: FormData;
      try {
        fd = await req.formData();
      } catch {
        return errorPage(400, "Unreadable form body", "The submitted form could not be parsed.");
      }
      const params = new URLSearchParams();
      for (const [k, v] of fd) {
        if (typeof v !== "string") {
          return errorPage(
            415,
            "File uploads are not supported (yet)",
            "The gateway cannot currently forward file uploads through its serverless core. Text-only forms work fine.",
          );
        }
        params.append(k, v);
      }
      body = Buffer.from(params.toString(), "utf8");
      contentType = "application/x-www-form-urlencoded";
    } else {
      const ab = await req.arrayBuffer();
      if (ab.byteLength > CONFIG.maxPostBytes) {
        return errorPage(413, "Request body too large", "This POST body exceeds the gateway limit.");
      }
      body = ab.byteLength ? ab : null;
      contentType = req.headers.get("content-type");
    }
  }

  // ---- 4. Fetch upstream ----------------------------------------------------
  let result;
  try {
    result = await fetchUpstream(upstreamUrl, jar, {
      method,
      body,
      contentType,
      clientAccept,
      range: req.headers.get("range"),
      referer: mapReferer(req),
      isDocument,
    });
  } catch (e) {
    const name = (e as Error).name || "";
    const msg = (e as Error).message || String(e);
    if (name === "TimeoutError" || name === "AbortError") {
      return errorPage(504, "Upstream timed out", `The site did not answer within ${CONFIG.upstreamTimeoutMs / 1000}s: <code>${escapeHtml(upstreamUrl.hostname)}</code>`);
    }
    return errorPage(
      502,
      "Could not reach the site",
      `The gateway failed to fetch <code>${escapeHtml(upstreamUrl.host)}</code> (${escapeHtml(
        msg.slice(0, 200),
      )}). The site may block datacenter traffic or be down.`,
    );
  }
  const { res } = result;
  jar = result.jar;

  // Persist the jar (and any new cookies) after the response is sent.
  if (sid && result.touchedCookies) {
    const jarSnapshot = jar;
    after(async () => {
      await saveJar(sid, jarSnapshot);
    });
  }

  // ---- 5. Redirects: rewrite Location back into the proxy -----------------
  const baseHeaders = sanitizeResponseHeaders(res.headers);
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const loc = res.headers.get("location");
    if (loc) {
      let target: string;
      try {
        const u = new URL(loc, upstreamUrl);
        target = u.protocol.startsWith("http")
          ? new URL(makeProxyPath(u), originFromReq(req)).toString()
          : loc;
      } catch {
        target = loc;
      }
      const h = new Headers();
      h.set("location", target);
      h.set("cache-control", "no-store");
      h.set("x-robots-tag", "noindex");
      return new NextResponse(null, { status: res.status, headers: h });
    }
  }

  if (res.status === 204 || res.status === 304) {
    return new NextResponse(null, { status: res.status, headers: baseHeaders });
  }

  const ct = (res.headers.get("content-type") || "").toLowerCase();

  // ---- 6. HTML documents ---------------------------------------------------
  if (ct.includes("text/html") || ct.includes("application/xhtml")) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > CONFIG.maxHtmlBytes) {
      const h = baseHeaders;
      h.set("x-lg-mode", "passthrough-large");
      return new NextResponse(buf, { status: res.status, headers: h });
    }
    const decoded = decodeBody(buf, res.headers.get("content-type"));
    const { html, title } = await transformHtml(decoded, {
      docUrl: upstreamUrl,
      settings,
    });
    const h = baseHeaders;
    h.set("content-type", "text/html; charset=utf-8");
    h.set("cache-control", "no-store");
    h.set("x-lg-mode", settings.mode);
    if (isDocument && sid) {
      const url = upstreamUrl.toString();
      const mode = settings.mode;
      after(async () => {
        try {
          await db.insert(history).values({ sessionId: sid, url, title, mode });
        } catch {
          /* history is best-effort */
        }
      });
    }
    return new NextResponse(html, { status: res.status, headers: h });
  }

  // ---- 7. Stylesheets --------------------------------------------------------
  if (ct.includes("text/css")) {
    const buf = Buffer.from(await res.arrayBuffer());
    const h = baseHeaders;
    h.set("content-type", "text/css; charset=utf-8");
    h.set("cache-control", "private, max-age=300");
    if (buf.length <= CONFIG.maxCssBytes) {
      const rewritten = rewriteCss(decodeBody(buf, res.headers.get("content-type")), upstreamUrl);
      return new NextResponse(rewritten, { status: 200, headers: h });
    }
    return new NextResponse(buf, { status: res.status, headers: h });
  }

  // ---- 8. JavaScript -----------------------------------------------------------
  if (/javascript|ecmascript/.test(ct)) {
    const buf = Buffer.from(await res.arrayBuffer());
    const h = baseHeaders;
    h.set("content-type", "text/javascript; charset=utf-8");
    h.set("cache-control", "private, max-age=300");
    if (settings.js && buf.length <= CONFIG.maxJsTranspileBytes) {
      const out = await transpileJs(
        decodeBody(buf, res.headers.get("content-type")),
        upstreamUrl.toString(),
      );
      return new NextResponse(out, { status: 200, headers: h });
    }
    return new NextResponse(buf, { status: res.status, headers: h });
  }

  // ---- 9. Images ---------------------------------------------------------------
  if (ct.startsWith("image/")) {
    const buf = Buffer.from(await res.arrayBuffer());
    const h = baseHeaders;
    h.set("cache-control", "public, max-age=600");
    if (!settings.images) {
      h.set("content-type", "image/gif");
      h.set("x-lg-image", "disabled");
      return new NextResponse(PLACEHOLDER_GIF, { status: 200, headers: h });
    }
    const out = await processImage(buf, ct, settings);
    h.set("content-type", out.contentType);
    h.set("x-lg-image", out.note);
    return new NextResponse(new Uint8Array(out.body), { status: 200, headers: h });
  }

  // ---- 10. Everything else (media/range, fonts, JSON, PDF, downloads) ---------
  const h = baseHeaders;
  if (ct.startsWith("video/") || ct.startsWith("audio/") || res.status === 206) {
    const range = res.headers.get("content-range");
    if (range) h.set("content-range", range);
    const acceptRanges = res.headers.get("accept-ranges");
    if (acceptRanges) h.set("accept-ranges", acceptRanges);
  }
  return new NextResponse(res.body, { status: res.status, headers: h });
}

export async function GET(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    return await handle(req, ctx);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return errorPage(500, "Gateway Error", `An internal error occurred: <code>${escapeHtml(msg.slice(0, 300))}</code>`);
  }
}
export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    return await handle(req, ctx);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return errorPage(500, "Gateway Error", `An internal error occurred: <code>${escapeHtml(msg.slice(0, 300))}</code>`);
  }
}
export async function PUT(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    return await handle(req, ctx);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return errorPage(500, "Gateway Error", `An internal error occurred: <code>${escapeHtml(msg.slice(0, 300))}</code>`);
  }
}
export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    return await handle(req, ctx);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return errorPage(500, "Gateway Error", `An internal error occurred: <code>${escapeHtml(msg.slice(0, 300))}</code>`);
  }
}
export async function DELETE(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    return await handle(req, ctx);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return errorPage(500, "Gateway Error", `An internal error occurred: <code>${escapeHtml(msg.slice(0, 300))}</code>`);
  }
}
export async function HEAD(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    return await handle(req, ctx);
  } catch (e) {
    return new NextResponse(null, { status: 500 });
  }
}
export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "access-control-allow-headers": "*",
      "access-control-max-age": "86400",
    },
  });
}
