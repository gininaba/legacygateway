import { pgTable, text, timestamp, jsonb, serial, index } from "drizzle-orm/pg-core";

/** Per-session gateway preferences. Everything is server-side because the
 *  legacy client cannot be trusted to persist anything reliably. */
export interface GatewaySettings {
  /** "full"  = rewrite & deliver the real site (with degraded fidelity)
   *  "lite"  = strip scripts/styles, re-typeset for guaranteed readability */
  mode: "full" | "lite";
  /** Re-encode images for old WebKit (JPEG/PNG/GIF only, capped width). */
  images: boolean;
  /** EXPERIMENTAL: Babel-transpile site JS to ES5 + core-js polyfills. */
  js: boolean;
  /** Inject the small gateway toolbar into proxied pages. */
  toolbar: boolean;
  /** Max image width in px. */
  imw: number;
  /** JPEG re-encode quality 1-100. */
  quality: number;
}

export const DEFAULT_SETTINGS: GatewaySettings = {
  mode: "full",
  images: true,
  js: false,
  toolbar: true,
  imw: 1100,
  quality: 65,
};

export const sessions = pgTable("lg_sessions", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  settings: jsonb("settings").$type<GatewaySettings>().notNull(),
  /** AES-256-GCM encrypted JSON cookie jar (never leaves the server). */
  jar: text("jar").notNull().default(""),
});

export const history = pgTable(
  "lg_history",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    mode: text("mode").notNull().default("full"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("lg_history_sid_idx").on(t.sessionId, t.createdAt)],
);

export const bookmarks = pgTable(
  "lg_bookmarks",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull().default(""),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("lg_bookmarks_sid_idx").on(t.sessionId, t.createdAt)],
);

/** Server-side content cache: transpiled JS, remote-browser screenshots. */
export const cache = pgTable("lg_cache", {
  key: text("key").primaryKey(),
  contentType: text("content_type").notNull().default("application/octet-stream"),
  /** base64-encoded bytes */
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
