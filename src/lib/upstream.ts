import { CONFIG } from "./config";
import { jarHeader, jarStore, parseSetCookie, splitSetCookieHeader, type CookieRecord } from "./cookies";

/** Headers that must never be forwarded from the legacy client upstream. */
const STRIP_REQ = new Set([
  "host", "connection", "content-length", "accept-encoding", "cookie",
  "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "x-real-ip",
  "forwarded", "via", "dnt", "upgrade-insecure-requests",
  "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user",
  "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform",
]);

/** Headers that must never leak from upstream to the legacy client. */
const STRIP_RES = new Set([
  "content-encoding", "transfer-encoding", "connection", "keep-alive",
  "strict-transport-security", "content-security-policy",
  "content-security-policy-report-only", "x-frame-options",
  "cross-origin-embedder-policy", "cross-origin-opener-policy",
  "cross-origin-resource-policy", "expect-ct", "nel", "report-to",
  "reporting-endpoints", "permissions-policy", "feature-policy",
  "x-xss-protection", "x-permitted-cross-domain-policies", "alt-svc",
  "public-key-pins", "tk", "set-cookie",
]);

export interface UpstreamResult {
  res: Response;
  /** Set-Cookie values captured on THIS response (already stored in jar). */
  touchedCookies: boolean;
  jar: CookieRecord[];
}

function getSetCookies(res: Response): string[] {
  const h = res.headers as Headers & { getSetCookie?: () => string[] };
  if (typeof h.getSetCookie === "function") return h.getSetCookie();
  const single = res.headers.get("set-cookie");
  return single ? splitSetCookieHeader(single) : [];
}

export interface UpstreamOpts {
  method: string;
  body?: BodyInit | null;
  contentType?: string | null;
  clientAccept?: string | null;
  range?: string | null;
  referer?: string | null;
  isDocument: boolean;
}

/**
 * Fetch an upstream resource as a "modern browser" on behalf of the legacy
 * client: modern TLS 1.3/ciphers (terminated here, solving the iOS 9 TLS
 * problem), modern UA, server-side cookie jar, manual redirects so cookies
 * set on 3xx hops are captured too.
 */
export async function fetchUpstream(
  url: URL,
  jar: CookieRecord[],
  opts: UpstreamOpts,
  depth = 0,
): Promise<UpstreamResult> {
  const headers = new Headers();
  headers.set("user-agent", CONFIG.ua);
  headers.set("accept-language", "en-US,en;q=0.9");
  headers.set(
    "accept",
    opts.isDocument
      ? "text/html,application/xhtml+xml,application/xml;q=0.9,image/jpeg,image/png,image/gif,image/svg+xml,*/*;q=0.8"
      : opts.clientAccept || "*/*",
  );
  if (opts.range) headers.set("range", opts.range);
  if (opts.referer) headers.set("referer", opts.referer);
  if (opts.contentType) headers.set("content-type", opts.contentType);

  const cookie = jarHeader(jar, url);
  if (cookie) headers.set("cookie", cookie);

  const res = await fetch(url.toString(), {
    method: opts.method,
    headers,
    body: opts.method === "GET" || opts.method === "HEAD" ? null : (opts.body ?? null),
    redirect: "manual",
    signal: AbortSignal.timeout(CONFIG.upstreamTimeoutMs),
  });

  const setCookies = getSetCookies(res);
  for (const sc of setCookies) {
    const rec = parseSetCookie(sc, url);
    if (rec) jar = jarStore(jar, rec);
  }

  // Follow redirects server-side only for non-document XHR-style calls is
  // tempting, but we deliberately surface ALL redirects to the client as
  // rewritten 3xx responses so the address bar & history stay truthful.
  // We still recurse for 301→HTTPS upgrades on opaque asset fetches to
  // avoid a pointless client round trip.
  if (
    !opts.isDocument &&
    depth < 3 &&
    [301, 302, 303, 307, 308].includes(res.status)
  ) {
    const loc = res.headers.get("location");
    if (loc) {
      try {
        const next = new URL(loc, url);
        if (next.protocol === "http:" || next.protocol === "https:") {
          const inner = await fetchUpstream(
            next,
            jar,
            { ...opts, method: "GET", body: null },
            depth + 1,
          );
          return {
            res: inner.res,
            touchedCookies: inner.touchedCookies || setCookies.length > 0,
            jar: inner.jar,
          };
        }
      } catch {
        /* fall through and surface the redirect */
      }
    }
  }

  return { res, touchedCookies: setCookies.length > 0, jar };
}

/** Sanitize upstream response headers for the legacy client. */
export function sanitizeResponseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  upstream.forEach((value, key) => {
    const k = key.toLowerCase();
    if (STRIP_RES.has(k)) return;
    if (k === "content-length") return; // we always re-buffer or re-stream
    out.set(k, value);
  });
  out.set("x-robots-tag", "noindex, nofollow");
  out.set("x-content-type-options", "nosniff");
  out.set("referrer-policy", "no-referrer");
  return out;
}

function pickDisposition(res: Response): string | null {
  return res.headers.get("content-disposition");
}

export { pickDisposition };
