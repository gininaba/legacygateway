import { rewriteUrl } from "../urlrew";

/**
 * Rewrite url(...) and @import inside a stylesheet so every referenced
 * resource (fonts, background images, more CSS) routes back through the
 * gateway where it gets re-encoded for old WebKit.
 *
 * Note: relative URLs intentionally pass through untouched — the CSS file
 * is itself served from /p/<scheme>/<host>/dir/, so the browser resolves
 * them inside the proxy automatically.
 */
export function rewriteCss(css: string, base: URL): string {
  let out = css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
    (whole, q: string, raw: string) => {
      const v = raw.trim();
      if (!v || /^(data:|blob:|about:|#)/i.test(v)) return whole;
      const rewritten = rewriteUrl(base, v);
      return `url("${rewritten.replace(/"/g, '\\"')}")`;
    },
  );
  out = out.replace(
    /@import\s+(['"])([^'"]+)\1/g,
    (whole, q: string, raw: string) => {
      const v = raw.trim();
      if (!v || /^data:/i.test(v)) return whole;
      return `@import "${rewriteUrl(base, v).replace(/"/g, '\\"')}"`;
    },
  );
  return out;
}

/** Rewrite url() inside an inline style attribute. */
export function rewriteInlineStyle(style: string, base: URL): string {
  if (style.indexOf("url") === -1) return style;
  return style.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
    (whole, _q: string, raw: string) => {
      const v = raw.trim();
      if (!v || /^(data:|blob:|#)/i.test(v)) return whole;
      return `url("${rewriteUrl(base, v).replace(/"/g, '\\"')}")`;
    },
  );
}
