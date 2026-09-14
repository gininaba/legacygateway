import { NextRequest, NextResponse } from "next/server";
import { originFromReq } from "@/lib/origin";
import { db } from "@/db";
import { sessions, history, bookmarks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SID_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Wipe all server-side data for this session. */
export async function POST(req: NextRequest) {
  const sid = req.cookies.get(SID_COOKIE)?.value || "";
  if (sid) {
    try {
      await db.delete(history).where(eq(history.sessionId, sid));
      await db.delete(bookmarks).where(eq(bookmarks.sessionId, sid));
      await db.delete(sessions).where(eq(sessions.id, sid));
    } catch {
      /* best-effort */
    }
  }
  return NextResponse.redirect(new URL("/settings", originFromReq(req)), 303);
}
