import { NextRequest, NextResponse } from "next/server";
import { originFromReq } from "@/lib/origin";
import { db } from "@/db";
import { history } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SID_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sid = req.cookies.get(SID_COOKIE)?.value || "";
  if (sid) {
    try {
      await db.delete(history).where(eq(history.sessionId, sid));
    } catch {
      /* best-effort */
    }
  }
  return NextResponse.redirect(new URL("/history", originFromReq(req)), 303);
}
