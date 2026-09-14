/**
 * Path-based proxy URLs.
 *
 * Every proxied resource lives under  /p/<scheme>/<host>/<original-path>?…
 * Because the document itself is served from such a path, ALL relative URLs
 * (links, images, fetch('/x') → resolved against document URL, CSS url())
 * keep working with ZERO rewriting: the browser resolves them back into
 * the proxy. Only absolute and path-absolute ("/x") references must be
 * rewritten, which is a much smaller, more reliable surface area.
 */

export function makeProxyPath(u: URL): string {
  const scheme = u.protocol === "https:" ? "https" : "http";
  return `/p/${scheme}/${u.host}${u.pathname}${u.search}${u.hash}`;
}

const SKIP_SCHEMES = /^(#|data:|javascript:|mailto:|tel:|blob:|about:|sms:|facetime:)/i;

/** Rewrite one attribute value against the document's base URL. */
export function rewriteUrl(base: URL, value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const v = value.trim();
  if (!v || SKIP_SCHEMES.test(v)) return value;
  // Idempotency: already-proxied URLs must pass through untouched (forms
  // are transformed twice — once by the attribute loop, once by the form
  // normalizer).
  if (/^\/p\/https?\//.test(v)) return value;
  try {
    if (v.startsWith("//")) {
      return makeProxyPath(new URL(base.protocol + v));
    }
    if (/^https?:\/\//i.test(v)) {
      return makeProxyPath(new URL(v));
    }
    if (v.startsWith("/")) {
      // Path-absolute: resolves to OUR origin, so it must be pinned back
      // into the upstream host's namespace inside the proxy.
      return makeProxyPath(new URL(base.protocol + "//" + base.host + v));
    }
    // Relative (or fragment): leave untouched — it resolves into /p/…
    return value;
  } catch {
    return value;
  }
}

/** Rewrite a srcset attribute ("url 1x, url2 2x"). */
export function rewriteSrcset(base: URL, value: string): string {
  return value
    .split(",")
    .map((candidate) => {
      const parts = candidate.trim().split(/\s+/);
      if (!parts.length || !parts[0]) return candidate;
      parts[0] = rewriteUrl(base, parts[0]);
      return parts.join(" ");
    })
    .join(", ");
}

/** Inverse map: "/p/https/host/x?y" → "https://host/x?y" (for Referer, etc.) */
export function proxyPathToUpstreamUrl(pathname: string, search = ""): string | null {
  const m = /^\/p\/(https?)\/([^/?#]+)([^?#]*)/.exec(pathname);
  if (!m) return null;
  return `${m[1]}://${m[2]}${m[3] || "/"}${search}`;
}

/** Map an incoming Referer on OUR origin back to the upstream URL it came from. */
export function mapReferer(req: Request): string | null {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    const u = new URL(ref);
    return proxyPathToUpstreamUrl(u.pathname, u.search);
  } catch {
    return null;
  }
}
