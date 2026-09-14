import { NextRequest, NextResponse } from "next/server";
import { cacheGet } from "@/lib/snapstate";
import { PLACEHOLDER_GIF } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = (req.nextUrl.searchParams.get("id") || "").replace(/[^a-f0-9]/gi, "");
  const hit = id ? await cacheGet("snapimg:" + id) : null;
  if (!hit) {
    return new NextResponse(PLACEHOLDER_GIF, {
      status: 200,
      headers: { "content-type": "image/gif", "cache-control": "no-store" },
    });
  }
  return new NextResponse(new Uint8Array(hit.buf), {
    status: 200,
    headers: {
      "content-type": hit.contentType,
      "cache-control": "private, max-age=600",
    },
  });
}
