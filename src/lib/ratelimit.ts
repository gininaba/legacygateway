import { CONFIG } from "./config";

/**
 * Best-effort fixed-window rate limiter. On serverless platforms each
 * instance has its own map, so this throttles per warm instance — good
 * enough to stop a single runaway client, not a distributed abuser.
 * For hard guarantees put Redis/Upstash behind this same interface.
 */
interface Bucket {
  count: number;
  reset: number;
}

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
}

/** Per-minute window. Returns allowed=true unless the client is over quota. */
export function checkMinute(key: string): boolean {
  const now = Date.now();
  sweep(now);
  let b = buckets.get("m:" + key);
  if (!b || b.reset <= now) {
    b = { count: 0, reset: now + 60_000 };
    buckets.set("m:" + key, b);
  }
  b.count += 1;
  return b.count <= CONFIG.ratePerMinute;
}

/** Per-day window for page fetches (abuse guard). */
export function checkDay(key: string): boolean {
  const now = Date.now();
  sweep(now);
  let b = buckets.get("d:" + key);
  if (!b || b.reset <= now) {
    b = { count: 0, reset: now + 24 * 60 * 60 * 1000 };
    buckets.set("d:" + key, b);
  }
  b.count += 1;
  return b.count <= CONFIG.pagesPerSessionPerDay;
}
