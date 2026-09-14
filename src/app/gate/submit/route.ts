import { NextRequest, NextResponse } from "next/server";
import { originFromReq } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const key = typeof fd.get("key") === "string" ? (fd.get("key") as string) : "";
  const expected = process.env.LG_GATE_KEY || "";
  const origin = originFromReq(req);
  if (expected && key === expected) {
    const res = NextResponse.redirect(new URL("/", origin), 303);
    res.cookies.set("lgg", expected, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }
  return NextResponse.redirect(new URL("/gate?err=1", origin), 303);
}
