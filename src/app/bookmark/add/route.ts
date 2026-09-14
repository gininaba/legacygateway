import { NextRequest, NextResponse } from "next/server";
import { originFromReq } from "@/lib/origin";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { SID_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const u = typeof fd.get("u") === "string" ? (fd.get("u") as string) : "";
  const t = typeof fd.get("t") === "string" ? (fd.get("t") as string) : "";
  const sid = req.cookies.get(SID_COOKIE)?.value || "";
  try {
    new URL(u); // only bookmark valid absolute URLs
    if (sid) {
      await db.insert(bookmarks).values({ sessionId: sid, url: u, title: t.slice(0, 200) });
    }
  } catch {
    /* ignore */
  }
  return NextResponse.redirect(new URL("/history", originFromReq(req)), 303);
}
