import { NextRequest, NextResponse } from "next/server";
import { originFromReq } from "@/lib/origin";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { SID_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const id = parseInt(typeof fd.get("id") === "string" ? (fd.get("id") as string) : "", 10);
  const sid = req.cookies.get(SID_COOKIE)?.value || "";
  if (sid && !Number.isNaN(id)) {
    try {
      // Scoped to the session — one user cannot delete another's rows.
      await db.delete(bookmarks).where(and(eq(bookmarks.id, id), eq(bookmarks.sessionId, sid)));
    } catch {
      /* ignore */
    }
  }
  return NextResponse.redirect(new URL("/history", originFromReq(req)), 303);
}
