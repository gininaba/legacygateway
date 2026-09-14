import { NextRequest, NextResponse } from "next/server";

const GATE_KEY = process.env.LG_GATE_KEY || "";

/**
 * Two jobs:
 *  1. Guarantee an anonymous, unguessable session id cookie (lgs) exists so
 *     the server-side cookie jar/history have something to key on.
 *  2. If LG_GATE_KEY is configured, the whole gateway sits behind a shared
 *     access key — the single most important open-proxy abuse defense.
 */
export function middleware(req: NextRequest) {
  let res: NextResponse;

  if (
    GATE_KEY &&
    req.cookies.get("lgg")?.value !== GATE_KEY &&
    !req.nextUrl.pathname.startsWith("/gate")
  ) {
    res = NextResponse.redirect(new URL("/gate", req.url));
  } else {
    res = NextResponse.next();
  }

  const sid = req.cookies.get("lgs")?.value;
  if (!sid || !/^[a-f0-9]{32,64}$/.test(sid)) {
    res.cookies.set("lgs", crypto.randomUUID().replace(/-/g, ""), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return res;
}

export const config = {
  matcher: [
    "/",
    "/navigate",
    "/mode",
    "/settings/:path*",
    "/history/:path*",
    "/bookmark/:path*",
    "/session/:path*",
    "/about",
    "/snap/:path*",
    "/gate/:path*",
    "/p/:path*",
  ],
};
