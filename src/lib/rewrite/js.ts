import { transformAsync } from "@babel/core";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cache } from "@/db/schema";
import { sha256 } from "../crypto";

/**
 * EXPERIMENTAL JS compatibility: downlevel modern syntax (ES2019+ → ES5)
 * with Babel's preset-env targeted at Safari 9. Paired with the injected
 * core-js + whatwg-fetch polyfills this rescues a meaningful slice of
 * "modern but not insane" sites. It cannot conjure missing DOM APIs
 * (IntersectionObserver, Shadow DOM, class fields in some host objects...)
 * so failures degrade to "site partially static", never a gateway crash.
 *
 * Results are cached in Postgres keyed by content hash, so the (slow)
 * transpile happens once per unique file, not once per page view.
 */
export async function transpileJs(code: string, keyHint: string): Promise<string> {
  const key = "js:" + sha256(code);
  try {
    const hit = await db.select().from(cache).where(eq(cache.key, key)).limit(1);
    if (hit.length) return Buffer.from(hit[0].body, "base64").toString("utf8");
  } catch {
    /* cache miss path */
  }

  let out = code;
  try {
    // transformAsync is the explicit Promise-based API in Babel 8.
    // (transform() became callback-based in Babel 8; transformSync still
    // exists but blocks the event loop on large files.)
    const result = await transformAsync(code, {
      presets: [
        [
          "@babel/preset-env",
          {
            targets: { safari: "9", ios: "9" },
            modules: false,
            bugfixes: true,
            loose: true,
          },
        ],
      ],
      babelrc: false,
      configFile: false,
      compact: false,
      comments: false,
      sourceType: "unambiguous",
      filename: keyHint.slice(-80) || "bundle.js",
    });
    if (result && result.code) out = result.code;
  } catch {
    return code; // leave untranspiled; the old engine will simply skip it
  }

  try {
    await db
      .insert(cache)
      .values({
        key,
        contentType: "application/javascript; charset=utf-8",
        body: Buffer.from(out, "utf8").toString("base64"),
      })
      .onConflictDoNothing();
  } catch {
    /* cache write failure is not fatal */
  }
  return out;
}

/** Does this content-type look like JavaScript? */
export function isJsContentType(ct: string): boolean {
  return /(?:application|text)\/(?:x-)?(?:java|ecma)script|module|application\/(?:x-)?javascript/.test(
    ct,
  );
}
