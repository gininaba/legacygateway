import { NextRequest, NextResponse } from "next/server";
import { originFromReq } from "@/lib/origin";
import { makeProxyPath } from "@/lib/urlrew";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The URL bar. Accepts a bare domain, full URL, or search words and 302s to
 * the right proxied destination. Plain HTML form + redirect = works on any
 * browser ever shipped, including 2009-era WebKit.
 */
export function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get("q") || "").trim();
  const engine = (req.nextUrl.searchParams.get("e") || "ddg").toLowerCase();
  const origin = originFromReq(req);

  if (!raw) {
    return NextResponse.redirect(new URL("/", origin), 302);
  }

  let target: string | null = null;
  if (/^https?:\/\//i.test(raw)) {
    target = raw;
  } else if (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(raw) && !raw.includes(" ")) {
    target = "https://" + raw;
  }

  if (!target) {
    const q = encodeURIComponent(raw);
    if (engine === "google") target = `https://www.google.com/search?q=${q}`;
    else if (engine === "wikipedia") target = `https://en.wikipedia.org/wiki/Special:Search?search=${q}`;
    else if (engine === "bing") target = `https://www.bing.com/search?q=${q}`;
    else target = `https://html.duckduckgo.com/html/?q=${q}`;
  }

  try {
    const u = new URL(target);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad scheme");
    return NextResponse.redirect(new URL(makeProxyPath(u), origin), 302);
  } catch {
    return NextResponse.redirect(new URL("/?bad=1", origin), 302);
  }
}
