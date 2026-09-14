import { lookup } from "dns/promises";
import { CONFIG } from "./config";

/**
 * SSRF defense-in-depth for the proxy:
 *  1. Only http/https, only common web ports.
 *  2. Hostname blocklist (localhost, .local, .internal ...).
 *  3. DNS resolution of every hostname; every resulting IP must be a
 *     public unicast address (blocks 10/8, 127/8, 169.254/16, ::1, fc00::/7,
 *     link-local, CGNAT, documentation ranges, multicast ...).
 *  4. Optional operator allowlist via LG_ALLOWLIST.
 * DNS answers are cached briefly to bound lookup latency.
 */

const dnsCache = new Map<string, { ips: string[]; exp: number }>();
const DNS_TTL_MS = 5 * 60 * 1000;
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443", "8000", "3000"]);

export class SsrfError extends Error {}

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split(".").map((n) => parseInt(n, 10));
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0 && (p[2] === 0 || p[2] === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a === 198 && b === 51 && p[2] === 100) return true;
  if (a === 203 && b === 0 && p[2] === 113) return true;
  if (a >= 224) return true; // multicast/reserved/broadcast
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::1" || s === "::") return true;
  if (s.startsWith("::ffff:")) {
    const v4 = s.slice(7);
    if (v4.includes(".")) return isPrivateIpv4(v4) ? true : false;
    return true; // odd mapped form; reject
  }
  const first = s.split(":")[0];
  const hextet = parseInt(first || "0", 16);
  if (Number.isNaN(hextet)) return true;
  if ((hextet & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((hextet & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if (s.startsWith("2001:db8")) return true; // documentation
  return false;
}

function isIpLiteral(host: string): boolean {
  return /^[0-9.]+$/.test(host) || host.includes(":");
}

async function resolvePublic(host: string): Promise<void> {
  const cached = dnsCache.get(host);
  let ips: string[];
  if (cached && cached.exp > Date.now()) {
    ips = cached.ips;
  } else {
    let answers: { address: string }[];
    try {
      answers = await lookup(host, { all: true, verbatim: true });
    } catch {
      throw new SsrfError(`DNS resolution failed for ${host}`);
    }
    ips = answers.map((a) => a.address);
    dnsCache.set(host, { ips, exp: Date.now() + DNS_TTL_MS });
  }
  if (!ips.length) throw new SsrfError(`No DNS records for ${host}`);
  for (const ip of ips) {
    if (ip.includes(":")) {
      if (isBlockedIpv6(ip)) throw new SsrfError(`Blocked address family for ${host}`);
    } else if (isPrivateIpv4(ip)) {
      throw new SsrfError(`Blocked private/reserved address for ${host}`);
    }
  }
}

/** Throws SsrfError when the URL must not be fetched. Returns the URL. */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("Malformed URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new SsrfError("Only http/https URLs are allowed");
  if (url.username || url.password) throw new SsrfError("Credentials in URL are not allowed");
  const port = url.port; // "" means default
  if (!ALLOWED_PORTS.has(port)) throw new SsrfError(`Port ${port || "default"} not allowed`);

  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.endsWith(".home") ||
    host === "0.0.0.0"
  ) {
    throw new SsrfError("Blocked hostname");
  }

  if (CONFIG.allowlist.length > 0) {
    const ok = CONFIG.allowlist.some((d) => host === d || host.endsWith("." + d));
    if (!ok) throw new SsrfError("Host is not on the gateway allowlist");
  }

  if (isIpLiteral(host)) {
    if (host.includes(":")) {
      if (isBlockedIpv6(host)) throw new SsrfError("Blocked address");
    } else if (isPrivateIpv4(host)) {
      throw new SsrfError("Blocked private/reserved address");
    }
  } else {
    await resolvePublic(host);
  }
  return url;
}
