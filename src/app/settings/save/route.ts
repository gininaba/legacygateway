import { NextRequest, NextResponse } from "next/server";
import { originFromReq } from "@/lib/origin";
import { SID_COOKIE, saveSettings } from "@/lib/session";
import type { GatewaySettings } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(v: FormDataEntryValue | null, dflt: number): number {
  const n = parseInt(typeof v === "string" ? v : "", 10);
  return Number.isNaN(n) ? dflt : n;
}

export async function POST(req: NextRequest) {
  const fd = await req.formData();
  const sid = req.cookies.get(SID_COOKIE)?.value || "";
  const settings: GatewaySettings = {
    mode: fd.get("mode") === "lite" ? "lite" : "full",
    images: fd.get("images") === "1",
    js: fd.get("js") === "1",
    toolbar: fd.get("toolbar") === "1",
    imw: Math.min(2048, Math.max(480, num(fd.get("imw"), 1100))),
    quality: Math.min(90, Math.max(30, num(fd.get("quality"), 65))),
  };
  if (sid) {
    try {
      await saveSettings(sid, settings);
    } catch {
      /* best-effort */
    }
  }
  return NextResponse.redirect(new URL("/settings?ok=1", originFromReq(req)), 303);
}
