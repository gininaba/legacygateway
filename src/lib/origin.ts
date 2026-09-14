import type { NextRequest } from "next/server";

/**
 * The public origin the CLIENT actually used to reach us.
 * req.nextUrl.origin reflects the server's bind address (e.g. 0.0.0.0) in
 * self-hosted/proxied setups — useless in a Location header sent to an
 * iPad. Trust the proxy's forwarded headers first, then Host.
 */
export function originFromReq(req: NextRequest): string {
  const proto = (req.headers.get("x-forwarded-proto") || "http").split(",")[0].trim();
  const rawHost =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
  const host = rawHost.split(",")[0].trim();
  return `${proto}://${host}`;
}
