import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, DEFAULT_SETTINGS, type GatewaySettings } from "@/db/schema";
import { open, seal } from "./crypto";
import type { CookieRecord } from "./cookies";

export const SID_COOKIE = "lgs";

/** Read the gateway session id from a route-handler request. */
export function sidFromReq(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const m = new RegExp(`(?:^|;\\s*)${SID_COOKIE}=([a-f0-9]{32,64})`).exec(cookieHeader);
  return m ? m[1] : null;
}

/** Fetch the session row, creating it on first use. */
export async function ensureSession(sid: string) {
  try {
    if (!db) return null;
    const rows = await db.select().from(sessions).where(eq(sessions.id, sid)).limit(1);
    if (rows.length) return rows[0];
    await db
      .insert(sessions)
      .values({ id: sid, settings: DEFAULT_SETTINGS })
      .onConflictDoNothing();
    const retry = await db.select().from(sessions).where(eq(sessions.id, sid)).limit(1);
    return retry[0] || null;
  } catch {
    return null; // DB unavailable -> degrade to stateless browsing
  }
}

export function mergeSettings(raw: unknown): GatewaySettings {
  const r = (raw || {}) as Partial<GatewaySettings>;
  return {
    mode: r.mode === "lite" ? "lite" : "full",
    images: typeof r.images === "boolean" ? r.images : DEFAULT_SETTINGS.images,
    js: typeof r.js === "boolean" ? r.js : DEFAULT_SETTINGS.js,
    toolbar: typeof r.toolbar === "boolean" ? r.toolbar : DEFAULT_SETTINGS.toolbar,
    imw: typeof r.imw === "number" && r.imw >= 480 && r.imw <= 2048 ? r.imw : DEFAULT_SETTINGS.imw,
    quality:
      typeof r.quality === "number" && r.quality >= 30 && r.quality <= 90
        ? r.quality
        : DEFAULT_SETTINGS.quality,
  };
}

export async function loadJar(encrypted: string): Promise<CookieRecord[]> {
  if (!encrypted) return [];
  try {
    const plain = open(encrypted);
    if (!plain) return [];
    const parsed = JSON.parse(plain) as CookieRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveJar(sid: string, jar: CookieRecord[]): Promise<void> {
  try {
    await db
      .update(sessions)
      .set({ jar: seal(JSON.stringify(jar)), lastSeen: new Date() })
      .where(eq(sessions.id, sid));
  } catch {
    /* stateless degrade */
  }
}

export async function touchSession(sid: string): Promise<void> {
  try {
    await db.update(sessions).set({ lastSeen: new Date() }).where(eq(sessions.id, sid));
  } catch {
    /* ignore */
  }
}

export async function saveSettings(sid: string, settings: GatewaySettings): Promise<void> {
  await ensureSession(sid);
  if (!db) return;
  await db.update(sessions).set({ settings, lastSeen: new Date() }).where(eq(sessions.id, sid));
}
