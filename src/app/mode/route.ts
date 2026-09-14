import { NextRequest, NextResponse } from "next/server";
import { originFromReq } from "@/lib/origin";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureSession, mergeSettings, sidFromReq } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Toggle full/lite rendering mode for the session, then bounce back. */
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to") === "lite" ? "lite" : "full";
  const back = req.nextUrl.searchParams.get("back") || "/";
  const sid = sidFromReq(req);
  if (sid) {
    try {
      const row = await ensureSession(sid);
      if (row) {
        const settings = mergeSettings(row.settings);
        settings.mode = to;
        await db.update(sessions).set({ settings }).where(eq(sessions.id, sid));
      }
    } catch {
      /* settings persistence is best-effort */
    }
  }
  const safe = back.startsWith("/") ? back : "/";
  return NextResponse.redirect(new URL(safe, originFromReq(req)), 302);
}
