import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "legacy-gateway",
      modes: ["proxy-full", "proxy-lite", "snapshot"],
      remoteBrowser: process.env.BROWSERLESS_TOKEN ? "configured" : "not-configured",
      gated: !!process.env.LG_GATE_KEY,
      time: new Date().toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
