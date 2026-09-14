import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { cache } from "@/db/schema";

/**
 * Snapshot Mode (remote browser) session state, kept in the cache table so
 * it is session-scoped, server-side, and disposable.
 * Since Vercel functions are stateless, the Chromium session is rebuilt per
 * interaction and rehydrated from these cookies + navigation stack.
 */
export interface SnapCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  secure?: boolean;
  httpOnly?: boolean;
}

export interface SnapState {
  cookies: SnapCookie[];
  stack: string[]; // navigation history within snapshot mode
  y: number; // current scroll offset
}

export const EMPTY_SNAP: SnapState = { cookies: [], stack: [], y: 0 };

export async function loadSnap(sid: string): Promise<SnapState> {
  try {
    const rows = await db.select().from(cache).where(eq(cache.key, "snap:" + sid)).limit(1);
    if (!rows.length) return { ...EMPTY_SNAP };
    const parsed = JSON.parse(Buffer.from(rows[0].body, "base64").toString("utf8")) as SnapState;
    return {
      cookies: Array.isArray(parsed.cookies) ? parsed.cookies : [],
      stack: Array.isArray(parsed.stack) ? parsed.stack.slice(-40) : [],
      y: typeof parsed.y === "number" ? parsed.y : 0,
    };
  } catch {
    return { ...EMPTY_SNAP };
  }
}

export async function saveSnap(sid: string, state: SnapState): Promise<void> {
  await cacheSet("snap:" + sid, "application/json", Buffer.from(JSON.stringify(state), "utf8"));
}

export async function cacheSet(key: string, contentType: string, buf: Buffer): Promise<void> {
  try {
    const body = buf.toString("base64");
    await db
      .insert(cache)
      .values({ key, contentType, body })
      .onConflictDoUpdate({ target: cache.key, set: { body, contentType, createdAt: new Date() } });
    // Opportunistic GC of stale snapshots (±2% of writes triggers a purge).
    if (Math.random() < 0.02) {
      await db.delete(cache).where(lt(cache.createdAt, new Date(Date.now() - 60 * 60 * 1000)));
    }
  } catch {
    /* non-fatal */
  }
}

export async function cacheGet(
  key: string,
): Promise<{ contentType: string; buf: Buffer } | null> {
  try {
    const rows = await db.select().from(cache).where(eq(cache.key, key)).limit(1);
    if (!rows.length) return null;
    return { contentType: rows[0].contentType, buf: Buffer.from(rows[0].body, "base64") };
  } catch {
    return null;
  }
}
