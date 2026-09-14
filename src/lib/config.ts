/**
 * Central runtime configuration for the Legacy Web Compatibility Gateway.
 * All secrets are server-side only.
 */
export const CONFIG = {
  /** Symmetric key for encrypting cookie jars at rest. */
  secret: process.env.LG_SECRET || "lg-dev-secret-CHANGE-ME-in-production",
  /** Optional shared access key. When set, the gateway demands a login and is
   *  no longer an open proxy. Strongly recommended for any public deploy. */
  gateKey: process.env.LG_GATE_KEY || "",
  /** Optional domain allowlist (comma-separated). Empty = any public host. */
  allowlist: (process.env.LG_ALLOWLIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  /** Upstream identity: a current Chrome so sites serve their real HTML. */
  ua:
    process.env.LG_UPSTREAM_UA ||
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  /** Remote-browser provider (Architecture B). Optional. */
  browserlessToken: process.env.BROWSERLESS_TOKEN || "",
  browserlessEndpoint: process.env.BROWSERLESS_ENDPOINT || "wss://chrome.browserless.io",

  upstreamTimeoutMs: 20000,
  maxHtmlBytes: 6 * 1024 * 1024,
  maxCssBytes: 3 * 1024 * 1024,
  maxJsTranspileBytes: 1500 * 1024,
  maxImageBytes: 16 * 1024 * 1024,
  maxPostBytes: 4 * 1024 * 1024,
  /** Best-effort per-instance rate limit: requests per minute per client. */
  ratePerMinute: 180,
  /** Hard cap for pages fetched per session per day (abuse guard). */
  pagesPerSessionPerDay: 4000,
};

export const PLACEHOLDER_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64",
);

/** Is the upstream error transient enough to retry over plain HTTP? */
export function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s);
}
