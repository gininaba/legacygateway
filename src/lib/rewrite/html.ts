import { load } from "cheerio";
import type { GatewaySettings } from "@/db/schema";
import { rewriteUrl, rewriteSrcset, makeProxyPath } from "../urlrew";
import { rewriteInlineStyle } from "./css";
import { transpileJs } from "./js";

export interface RewriteCtx {
  /** Absolute upstream URL of THIS document (after redirects). */
  docUrl: URL;
  settings: GatewaySettings;
}

export interface RewriteOut {
  html: string;
  title: string;
}

/** Attributes whose value is a URL that must route through the gateway. */
const URL_ATTRS: Array<[string, string]> = [
  ["a", "href"],
  ["area", "href"],
  ["link", "href"],
  ["script", "src"],
  ["img", "src"],
  ["iframe", "src"],
  ["frame", "src"],
  ["embed", "src"],
  ["source", "src"],
  ["track", "src"],
  ["video", "src"],
  ["video", "poster"],
  ["audio", "src"],
  ["input", "src"],
  ["object", "data"],
  ["body", "background"],
  ["table", "background"],
  ["td", "background"],
  ["form", "action"],
  ["button", "formaction"],
  ["input", "formaction"],
];

/** Tags we strip unconditionally: they either fetch outside the proxy,
 *  demand syntax old WebKit cannot parse, or forbid our rewritten content. */
const STRIP_SELECTORS = [
  'script[type="module"]',
  'script[type="importmap"]',
  'link[rel="modulepreload"]',
  'link[rel="preload"]',
  'link[rel="preconnect"]',
  'link[rel="dns-prefetch"]',
  'link[rel="prefetch"]',
  'meta[http-equiv="Content-Security-Policy"]',
  'meta[http-equiv="content-security-policy"]',
].join(",");

const LITE_CSS = [
  "html{background:#f6f4ee !important;}",
  "body{display:block !important;max-width:44em;margin:0 auto !important;padding:16px 18px 64px !important;",
  "background:#f6f4ee !important;color:#1a1a1a !important;",
  "font-family:Georgia,'Times New Roman',serif !important;font-size:19px !important;line-height:1.65 !important;}",
  "a{color:#0758a8 !important;text-decoration:underline !important;}a:visited{color:#6b3fa0 !important;}",
  "img{max-width:100% !important;height:auto !important;}video,audio{max-width:100% !important;}",
  "pre,code{font-family:Menlo,monospace !important;font-size:15px !important;white-space:pre-wrap !important;word-wrap:break-word !important;}",
  "h1,h2,h3,h4,h5,h6{font-family:-apple-system,Helvetica,Arial,sans-serif !important;line-height:1.25 !important;color:#111 !important;}",
  "input,select,textarea,button{font-size:18px !important;font-family:-apple-system,Helvetica,Arial,sans-serif !important;max-width:100% !important;}",
  "input[type=text],input[type=search],input[type=email],input[type=password],input[type=url],input[type=number],textarea{",
  "border:1px solid #999 !important;border-radius:6px !important;padding:8px 10px !important;background:#fff !important;}",
  "button,input[type=submit]{background:#0b5bd3 !important;color:#fff !important;border:0 !important;border-radius:6px !important;padding:8px 14px !important;}",
  "table{border-collapse:collapse !important;max-width:100% !important;}td,th{border:1px solid #ccc !important;padding:4px 8px !important;}",
  "nav,header,footer,section,article,aside,main,figure,div{display:block !important;}",
  "ul,ol{padding-left:1.4em !important;}li{margin:.25em 0 !important;}",
  "[hidden]{display:none !important;}",
].join("\n");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TB_STYLE =
  "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;height:34px;line-height:34px;" +
  "background:rgba(17,24,39,0.96);color:#e5e7eb;font-family:-apple-system,Helvetica,Arial,sans-serif;" +
  "font-size:13px;padding:0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" +
  "-webkit-box-shadow:0 -1px 4px rgba(0,0,0,.35);box-shadow:0 -1px 4px rgba(0,0,0,.35);";

function toolbarHtml(ctx: RewriteCtx, title: string): string {
  const s = ctx.settings;
  const back = encodeURIComponent(makeProxyPath(ctx.docUrl));
  const toggleTo = s.mode === "lite" ? "full" : "lite";
  const styleLink = "color:#fbbf24;text-decoration:none;padding:0 6px;";
  const styleDim = "color:#9ca3af;text-decoration:none;padding:0 6px;";
  return (
    `<div id="__lgtb" style="${TB_STYLE}">` +
    `<a href="/" style="${styleLink}">&#8962; Gateway</a>` +
    `<a href="/mode?to=${toggleTo}&amp;back=${back}" style="${styleLink}">${toggleTo === "lite" ? "Lite" : "Full"} mode</a>` +
    `<a href="/snap/view?u=${encodeURIComponent(ctx.docUrl.href)}" style="${styleDim}">Snap</a>` +
    `<a href="/settings" style="${styleDim}">Settings</a>` +
    `<a href="/history" style="${styleDim}">History</a>` +
    `<span style="color:#6b7280;padding:0 6px;">${escapeHtml(title || ctx.docUrl.href).slice(0, 90)}</span>` +
    `</div>` +
    `<style>html>body #__lgtb{font-size:13px !important;}@media screen{body{padding-bottom:36px !important;}}</style>`
  );
}

/**
 * Transform an upstream HTML document into one old WebKit can chew on.
 * Async because (optionally) inline scripts are Babel-transpiled.
 */
export async function transformHtml(raw: string, ctx: RewriteCtx): Promise<RewriteOut> {
  const s = ctx.settings;
  let base = ctx.docUrl;
  const $ = load(raw);

  // Honor (then drop) <base href> so relative URLs stay correct without it.
  const baseHref = $("base[href]").first().attr("href");
  if (baseHref) {
    try {
      base = new URL(baseHref, ctx.docUrl);
    } catch {
      /* keep document URL */
    }
  }
  $("base").remove();

  // Strip hostile/unsupported constructs.
  $(STRIP_SELECTORS).remove();
  $("[integrity]").removeAttr("integrity");
  $("[crossorigin]").removeAttr("crossorigin");
  $('link[rel="canonical"]').remove();

  // Normalize any charset declaration to match what we actually serve.
  $("meta[charset]").attr("charset", "utf-8");

  // Meta refresh: "5; url=/x" → route through the proxy.
  $('meta[http-equiv="refresh"], meta[http-equiv="Refresh"], meta[http-equiv="REFRESH"]').each(
    (_i, el) => {
      const content = $(el).attr("content") || "";
      const m = /^\s*(\d+)\s*;\s*url\s*=\s*(.+)$/i.exec(content);
      if (m) $(el).attr("content", `${m[1]}; url=${rewriteUrl(base, m[2])}`);
    },
  );

  // Rewrite URL-bearing attributes.
  for (const [tag, attr] of URL_ATTRS) {
    $(`${tag}[${attr}]`).each((_i, el) => {
      const v = $(el).attr(attr);
      if (v) $(el).attr(attr, rewriteUrl(base, v));
    });
  }
  $("[srcset]").each((_i, el) => {
    const v = $(el).attr("srcset");
    if (v) $(el).attr("srcset", rewriteSrcset(base, v));
  });
  $("[style]").each((_i, el) => {
    const v = $(el).attr("style");
    if (v && v.indexOf("url") !== -1) $(el).attr("style", rewriteInlineStyle(v, base));
  });

  // Keep navigation inside the proxy frame.
  $('a[target="_blank"], area[target="_blank"]').removeAttr("target");

  // Rescue JS-lazy-loaded images (data-src → src) which otherwise never load.
  const LAZY = ["data-src", "data-lazy-src", "data-original", "data-url", "data-hi-res-src"];
  $("img").each((_i, el) => {
    const $el = $(el);
    const src = $el.attr("src") || "";
    const srcLooksEmpty = !src || /^data:/.test(src) || /1x1|pixel|blank|spacer/i.test(src);
    if (srcLooksEmpty) {
      for (const a of LAZY) {
        const v = $el.attr(a);
        if (v) {
          $el.attr("src", rewriteUrl(base, v));
          break;
        }
      }
    }
    const ds = $el.attr("data-srcset");
    if (ds && !$el.attr("srcset")) $el.attr("srcset", rewriteSrcset(base, ds));
  });

  // Forms: always route through the gateway; normalize method to get/post.
  $("form").each((_i, el) => {
    const $el = $(el);
    const method = ($el.attr("method") || "get").toLowerCase();
    $el.attr("method", method === "post" ? "post" : "get");
    const action = $el.attr("action");
    $el.attr("action", action ? rewriteUrl(base, action) : makeProxyPath(base));
    const enctype = ($el.attr("enctype") || "").toLowerCase();
    if (enctype.includes("multipart")) {
      // We cannot forward file uploads through serverless request bodies
      // reliably this way; downgrade so servers at least get the fields.
      $el.attr("enctype", "application/x-www-form-urlencoded");
    }
  });

  $('script[defer]').removeAttr("defer"); // defer is fine but old engines
  // already ignore unknown attrs; removing keeps serialization stable.
  $("script[nomodule]").removeAttr("nomodule");

  const title = $("title").first().text().trim();

  if (s.mode === "lite") {
    // Guaranteed-readable path: nuke every script & stylesheet, show
    // noscript fallbacks (real engines hide them), re-typeset the page.
    $("script").remove();
    $('link[rel="stylesheet"]').remove();
    $("style").remove();
    // Inline SVGs (icons/ui chrome) weigh hundreds of KB on big pages and
    // the iPad mini has 512MB–1GB RAM; Lite is the survival path anyway.
    $("svg").remove();
    $("[style]").removeAttr("style");
    $("[onclick],[onload],[onerror],[onmouseover]").each((_i, el) => {
      const attribs = (el as unknown as { attribs?: Record<string, string> }).attribs || {};
      for (const name of Object.keys(attribs)) {
        if (/^on/i.test(name)) $(el).removeAttr(name);
      }
    });
    $("noscript").each((_i, el) => {
      $(el).replaceWith($(el).contents());
    });
    $("head").append(`<style>${LITE_CSS}</style>`);
  } else if (s.js) {
    // EXPERIMENTAL: polyfills first (classic scripts = render-blocking in
    // old engines too, so they are guaranteed to run before site code).
    const inject =
      `<script src="/legacy/polyfill.js"></script>` +
      `<script src="/legacy/fetch.js"></script>` +
      `<script src="/legacy/shim.js"></script>` +
      `<meta name="lg-base" content="${escapeHtml(base.href)}">`;
    if ($("head").length) $("head").prepend(inject);
    else $.root().prepend(inject);

    // Transpile inline classic scripts (skip JSON blobs & tiny snippets).
    const scripts = $("script").not("[src]").toArray();
    for (const el of scripts) {
      const $el = $(el);
      const type = ($el.attr("type") || "").toLowerCase();
      if (type && type !== "text/javascript" && type !== "application/javascript") continue;
      const code = $el.text() || "";
      if (code.length < 40 || code.length > 200 * 1024) continue;
      const out = await transpileJs(code, "inline.js");
      $el.text(out.replace(/<\/script/gi, "<\\/script"));
    }
  }

  if (s.toolbar && $("body").length) {
    $("body").append(toolbarHtml(ctx, title));
  }

  return { html: $.html(), title };
}
