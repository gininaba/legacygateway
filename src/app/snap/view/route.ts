import { NextRequest, NextResponse } from "next/server";
import puppeteer, { type Browser } from "puppeteer-core";
import { CONFIG } from "@/lib/config";
import { assertPublicHttpUrl, SsrfError } from "@/lib/ssrf";
import { loadSnap, saveSnap, cacheSet, type SnapCookie } from "@/lib/snapstate";
import { sidFromReq } from "@/lib/session";
import { checkMinute } from "@/lib/ratelimit";
import { makeProxyPath } from "@/lib/urlrew";
import { sha256 } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VW = 1024;
const VH = 660;

interface SnapEl {
  t: "a" | "f";
  tag: string;
  x: number;
  y: number;
  w: number;
  h: number;
  href: string;
  sel: string;
  label: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageShell(title: string, body: string, status = 200): NextResponse {
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${esc(title)}</title>` +
    `<style>` +
    `body{margin:0;background:#111827;color:#e5e7eb;font-family:-apple-system,Helvetica,Arial,sans-serif;}` +
    `.bar{background:#0b1020;border-bottom:2px solid #f5b730;padding:8px 10px;font-size:13px;line-height:1.5;}` +
    `.bar a{color:#f5b730;text-decoration:none;padding:0 7px;white-space:nowrap;}` +
    `.bar .u{color:#9ca3af;word-break:break-all;}` +
    `.bar input{font-size:15px;padding:6px 8px;border:1px solid #39415f;border-radius:6px;width:60%;-webkit-appearance:none;}` +
    `.bar button{font-size:14px;padding:6px 12px;border:0;border-radius:6px;background:#f5b730;font-weight:bold;-webkit-appearance:none;}` +
    `.frame{position:relative;width:${VW}px;max-width:100%;margin:0 auto;background:#fff;overflow:hidden;}` +
    `.frame img{display:block;width:100%;}` +
    `.ov{position:absolute;display:block;text-decoration:none;}` +
    `.ov.link.boxed{background:rgba(11,91,211,0.14);border:1px dotted rgba(11,91,211,0.7);}` +
    `.ov.form{background:rgba(4,120,87,0.12);border:1px dashed rgba(4,120,87,0.85);}` +
    `.hint{color:#9ca3af;font-size:12px;padding:6px 10px;}` +
    `</style></head><body>${body}</body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (!CONFIG.browserlessToken) {
    return pageShell(
      "Snapshot not configured",
      `<div class="hint"><p><a href="/snap">&larr; Snapshot Mode</a></p>` +
        `<h2>Remote browser not configured</h2><p>Set <code>BROWSERLESS_TOKEN</code> on the server to enable Snapshot Mode.</p></div>`,
      503,
    );
  }

  const sid = sidFromReq(req) || "anon";
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (!checkMinute("snap:" + ip)) {
    return pageShell("Slow down", `<div class="hint"><h2>Rate limit</h2><p>Wait a moment before the next snapshot.</p></div>`, 429);
  }

  let state = await loadSnap(sid);

  // ---- Figure out the target URL (navigation / back / refresh) -------------
  let target = (sp.get("u") || "").trim();
  if (target && !/^https?:\/\//i.test(target)) {
    target = "https://" + target;
  }
  if (sp.get("back") === "1") {
    if (state.stack.length > 1) {
      state.stack.pop();
      target = state.stack[state.stack.length - 1] || "";
    } else {
      target = state.stack[0] || target;
    }
  }
  if (!target.startsWith("http")) {
    const urlForm =
      `<div class="bar"><a href="/">&#8962; Gateway</a><a href="/snap">Snapshot</a>` +
      `<form method="get" action="/snap/view" style="display:inline">` +
      `<input name="u" placeholder="https://…" autocorrect="off" autocapitalize="off"><button>Render</button></form></div>` +
      `<div class="hint"><h2>Enter an address</h2><p>Type a full URL above to render it in the remote browser.</p></div>`;
    return pageShell("Snapshot", urlForm);
  }
  let upstreamUrl: URL;
  try {
    upstreamUrl = await assertPublicHttpUrl(target);
  } catch (e) {
    const msg = e instanceof SsrfError ? e.message : "Invalid address";
    return pageShell("Blocked", `<div class="hint"><h2>Address blocked</h2><p>${esc(msg)}</p><p><a href="/snap">&larr; back</a></p></div>`, 403);
  }

  // Record navigation (except back-navigation, handled above).
  if (sp.get("back") !== "1" && state.stack[state.stack.length - 1] !== upstreamUrl.toString()) {
    state.stack.push(upstreamUrl.toString());
    state.stack = state.stack.slice(-40);
    state.y = 0;
  }
  let y = state.y;
  const yParam = sp.get("y");
  if (yParam !== null) {
    const ny = parseInt(yParam, 10);
    if (!Number.isNaN(ny) && ny >= 0) y = ny;
  }

  const tsel = sp.get("tsel") || "";
  const tval = sp.get("tval") || "";
  const act = sp.get("act") || "type";

  // ---- Drive the remote browser -------------------------------------------
  let browser: Browser | null = null;
  let note = "";
  let title = "";
  let elements: SnapEl[] = [];
  let docH = VH;
  let shotId = "";
  try {
    const sep = CONFIG.browserlessEndpoint.includes("?") ? "&" : "?";
    browser = await puppeteer.connect({
      browserWSEndpoint: `${CONFIG.browserlessEndpoint}${sep}token=${encodeURIComponent(CONFIG.browserlessToken)}`,
      defaultViewport: { width: VW, height: VH },
    });
    const page = await browser.newPage();
    if (state.cookies.length) {
      try {
        await (page.setCookie as (...args: unknown[]) => Promise<void>)(
          ...(state.cookies as unknown as unknown[]),
        );
      } catch {
        /* stale cookie shapes are fine to drop */
      }
    }
    try {
      await page.goto(upstreamUrl.toString(), { waitUntil: "networkidle2", timeout: 18000 });
    } catch {
      try {
        await page.goto(upstreamUrl.toString(), { waitUntil: "domcontentloaded", timeout: 12000 });
        note = "page did not fully settle — showing a partial frame";
      } catch (e2) {
        return pageShell(
          "Navigation failed",
          `<div class="hint"><h2>Could not load the page</h2><p>${esc((e2 as Error).message.slice(0, 240))}</p>` +
            `<p><a href="/snap/view?back=1">&larr; back</a> &nbsp; <a href="/snap">exit snapshot mode</a></p></div>`,
          502,
        );
      }
    }

    if (tsel) {
      try {
        await page.waitForSelector(tsel, { timeout: 4000 });
        if (act === "click") {
          await page.click(tsel);
        } else {
          await page.click(tsel, { count: 3 });
          await page.type(tsel, tval, { delay: 8 });
          if (sp.get("tenter") === "1") {
            await page.keyboard.press("Enter");
          }
        }
        await sleep(1600); // let the SPA react/navigation begin
      } catch {
        note = "could not apply your input — the page may have changed";
      }
    }

    await page.evaluate((yy: number) => window.scrollTo(0, yy), y);
    await sleep(300);

    elements = await page.evaluate(
      (vw: number, vh: number): SnapEl[] => {
        const out: SnapEl[] = [];
        const els = document.querySelectorAll("a[href],input,textarea,select,button");
        for (let i = 0; i < els.length && out.length < 140; i++) {
          const el = els[i] as HTMLElement;
          const r = el.getBoundingClientRect();
          if (r.width < 6 || r.height < 6) continue;
          if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
          const tag = el.tagName.toLowerCase();
          const rec: SnapEl = {
            t: tag === "a" ? "a" : "f",
            tag,
            x: Math.round(r.left),
            y: Math.round(r.top),
            w: Math.round(r.width),
            h: Math.round(r.height),
            href: "",
            sel: "",
            label: "",
          };
          if (tag === "a") {
            rec.href = (el as HTMLAnchorElement).href || "";
            if (!rec.href) continue;
            rec.label = (el.textContent || rec.href).slice(0, 120);
          } else {
            let sel = "";
            if (el.id) sel = "#" + el.id;
            else {
              const nm = el.getAttribute("name");
              if (nm) sel = tag + "[name='" + nm.replace(/'/g, "") + "']";
              else {
                let n = 1;
                let sib = el.previousElementSibling;
                while (sib) {
                  if (sib.tagName === el.tagName) n++;
                  sib = sib.previousElementSibling;
                }
                sel = tag + ":nth-of-type(" + n + ")";
              }
            }
            rec.sel = sel;
            rec.label =
              el.getAttribute("aria-label") ||
              el.getAttribute("placeholder") ||
              el.getAttribute("name") ||
              (el.textContent || tag).trim().slice(0, 60);
          }
          out.push(rec);
        }
        return out;
      },
      VW,
      VH,
    );

    docH = await page.evaluate(() =>
      Math.max(
        document.body ? document.body.scrollHeight : 0,
        document.documentElement ? document.documentElement.scrollHeight : 0,
      ),
    );
    title = await page.title();

    const shot = await page.screenshot({ type: "jpeg", quality: 66 });
    shotId = sha256(sid + ":" + Date.now() + ":" + Math.random()).slice(0, 32);
    await cacheSet("snapimg:" + shotId, "image/jpeg", Buffer.from(shot));

    // Persist fresh cookies + stack for the next interaction.
    try {
      const raw = (await page.cookies()) as unknown as SnapCookie[];
      state.cookies = raw
        .filter((c) => c && c.name)
        .map((c) => ({
          name: c.name,
          value: c.value,
          domain: c.domain || "",
          path: c.path || "/",
          expires: c.expires,
          secure: !!c.secure,
          httpOnly: !!c.httpOnly,
        }))
        .filter((c) => c.domain)
        .slice(-300);
    } catch {
      /* keep old cookies */
    }
    state.y = y;
    await saveSnap(sid, state);
  } catch (e) {
    return pageShell(
      "Remote browser error",
      `<div class="hint"><h2>Snapshot failed</h2><p>${esc((e as Error).message.slice(0, 240))}</p>` +
        `<p>The remote browser provider may be rate-limiting or unreachable.</p><p><a href="/snap">&larr; Snapshot Mode</a></p></div>`,
      502,
    );
  } finally {
    if (browser) {
      try {
        browser.disconnect();
      } catch {
        /* already gone */
      }
    }
  }

  // ---- Compose the tap-target page ------------------------------------------
  const cur = upstreamUrl.toString();
  const boxes = sp.get("boxes") === "1";
  const down = y + (VH - 60) < docH ? y + (VH - 60) : null;
  const up = y > 0 ? Math.max(0, y - (VH - 60)) : null;
  const cq = encodeURIComponent(cur);

  let overlays = "";
  for (const el of elements) {
    const style = `left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;`;
    if (el.t === "a") {
      overlays += `<a class="ov link${boxes ? " boxed" : ""}" style="${style}" href="/snap/view?u=${encodeURIComponent(el.href)}" title="${esc(el.label)}"></a>`;
    } else {
      const action = el.tag === "button" || el.tag === "select" ? "click" : "type";
      overlays += `<a class="ov form" style="${style}" href="/snap/type?u=${cq}&sel=${encodeURIComponent(el.sel)}&act=${action}&label=${encodeURIComponent(el.label)}" title="${esc(el.label)}"></a>`;
    }
  }

  const bar =
    `<div class="bar">` +
    `<a href="/">&#8962;</a>` +
    `<a href="/snap">Exit</a>` +
    (state.stack.length > 1 ? `<a href="/snap/view?back=1">&larr; Back</a>` : "") +
    `<a href="/snap/view?u=${cq}">&#8635; Reload</a>` +
    (up !== null ? `<a href="/snap/view?u=${cq}&y=${up}">&uarr; Up</a>` : "") +
    (down !== null ? `<a href="/snap/view?u=${cq}&y=${down}">&darr; Scroll</a>` : "") +
    `<a href="${makeProxyPath(upstreamUrl)}">Proxy it</a>` +
    `<a href="/snap/view?u=${cq}&y=${y}&boxes=${boxes ? "0" : "1"}">${boxes ? "Hide boxes" : "Show tap targets"}</a>` +
    `<form method="get" action="/snap/view" style="display:inline">` +
    `<input name="u" value="${esc(cur)}" autocorrect="off" autocapitalize="off"><button>Go</button></form>` +
    `<div class="u">${esc(title || cur)}${note ? " — " + esc(note) : ""}</div>` +
    `</div>`;

  const frame =
    `<div class="frame"><img src="/snap/img?id=${shotId}" alt="snapshot" width="${VW}" height="${VH}">` +
    overlays +
    `</div>`;

  return pageShell(title || "Snapshot", bar + frame);
}
