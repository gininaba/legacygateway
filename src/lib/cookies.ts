/**
 * A small server-side per-session cookie jar (RFC6265 subset).
 * Upstream Set-Cookie headers never reach the legacy client: they live in
 * this jar, encrypted at rest, and are replayed to matching origins only.
 * This gives cookie/domain isolation per gateway session and prevents the
 * old browser from ever handling (or leaking) modern cookies.
 */
export interface CookieRecord {
  name: string;
  value: string;
  domain: string; // leading-dot = includes subdomains
  path: string;
  expires: number | null; // epoch ms
  secure: boolean;
  hostOnly: boolean;
}

export function parseSetCookie(sc: string, url: URL): CookieRecord | null {
  const parts = sc.split(";");
  const first = parts.shift();
  if (!first) return null;
  const eq = first.indexOf("=");
  if (eq <= 0) return null;
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  if (!name) return null;

  let domain = url.hostname.toLowerCase();
  let hostOnly = true;
  let path = defaultPath(url.pathname);
  let expires: number | null = null;
  let secure = false;

  for (const rawAttr of parts) {
    const attr = rawAttr.trim();
    const aEq = attr.indexOf("=");
    const aName = (aEq >= 0 ? attr.slice(0, aEq) : attr).trim().toLowerCase();
    const aVal = aEq >= 0 ? attr.slice(aEq + 1).trim() : "";
    if (aName === "domain" && aVal) {
      let d = aVal.replace(/^\./, "").toLowerCase();
      const host = url.hostname.toLowerCase();
      if (host === d || host.endsWith("." + d)) {
        domain = d;
        hostOnly = false;
      }
    } else if (aName === "path" && aVal) {
      path = aVal.startsWith("/") ? aVal : "/" + aVal;
    } else if (aName === "expires" && aVal) {
      const t = Date.parse(aVal);
      if (!Number.isNaN(t)) expires = t;
    } else if (aName === "max-age" && aVal) {
      const sec = parseInt(aVal, 10);
      if (!Number.isNaN(sec)) expires = Date.now() + sec * 1000;
    } else if (aName === "secure") {
      secure = true;
    }
  }
  return { name, value, domain, path, expires, secure, hostOnly };
}

function defaultPath(pathname: string): string {
  if (!pathname || !pathname.startsWith("/")) return "/";
  if (pathname === "/") return "/";
  return pathname.slice(0, pathname.lastIndexOf("/")) || "/";
}

/** Insert/replace a cookie; drop it instead if value empty & expired. */
export function jarStore(jar: CookieRecord[], rec: CookieRecord): CookieRecord[] {
  const out = jar.filter(
    (c) => !(c.name === rec.name && c.domain === rec.domain && c.path === rec.path),
  );
  if (!(rec.expires !== null && rec.expires <= Date.now())) out.push(rec);
  // Keep the jar bounded so a hostile site can't grow it forever.
  return out.slice(-400);
}

export function jarHeader(jar: CookieRecord[], url: URL): string {
  const now = Date.now();
  const host = url.hostname.toLowerCase();
  const isHttps = url.protocol === "https:";
  const pairs: string[] = [];
  for (const c of jar) {
    if (c.expires !== null && c.expires <= now) continue;
    if (c.secure && !isHttps) continue;
    if (c.hostOnly ? host !== c.domain : !(host === c.domain || host.endsWith("." + c.domain)))
      continue;
    if (!(url.pathname === c.path || url.pathname.startsWith(c.path.endsWith("/") ? c.path : c.path + "/")) && c.path !== "/")
      continue;
    pairs.push(`${c.name}=${c.value}`);
  }
  return pairs.join("; ");
}

/** Fallback splitter when Headers.getSetCookie() is unavailable. */
export function splitSetCookieHeader(raw: string): string[] {
  return raw.split(/,(?=\s*[^\s;,=]+=[^;,]*)/).map((s) => s.trim()).filter(Boolean);
}
