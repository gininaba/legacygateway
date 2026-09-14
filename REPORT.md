# Legacy Gateway — Feasibility Report & Technical Design

**Goal:** make an iPad mini stuck on iOS 9.3.6 (2015 WebKit) useful for modern web browsing —
without jailbreaking, without "just install another browser" (there is none: every iOS browser
uses the system WebKit, which is frozen in 2015).

This document is the promised analysis. The working implementation of the recommended
architecture is **in this repository** (see `src/`). The same content is browsable inside the
app at `/about` — readable on the iPad itself.

---

## 1. Feasibility assessment

**Honest answer: the full dream is impossible; a large, useful subset is not.**

There is no server-side transformation — proxy, transpiler, polyfill — that lets a browser
without `Promise`, `fetch`, `class` semantics, IntersectionObserver, Shadow DOM, CSS Grid,
WebCrypto, and a modern TLS stack *execute today's web applications locally*. Anyone claiming
otherwise demoed it on five tuned sites. The wall is not one thing, it is thirty things, and
several are un-polyfillable (you cannot polyfill a *syntax parse error* — the file never even
starts executing).

**What IS feasible, and built here:**

| Layer | Technique | Coverage |
|---|---|---|
| **A · Full proxy** | TLS termination + HTML/CSS/URL rewriting + image re-encode + server-side cookie jars | Documents, links, forms, search, wikis, forums, blogs, docs, many classic logins, HLS/MP4 video, downloads. *A big, genuinely useful slice of the web.* |
| **C · Hybrid dials** | A + optional Babel→ES5 transpile with core-js/fetch polyfills; optional lite/reader re-typesetting | Rescues "moderately modern" sites; Lite mode rescues reading on any site |
| **B · Snapshot mode** | Cloud Chromium renders → JPEG + tap-target overlay per interaction | Almost everything *viewable and clickable*, at 5–10s per step — including SPAs |

## 2. Technical limitations of iOS 9.3.6 WebKit

- **TLS** — Max TLS 1.2; no AEAD-modern cipher preference; and crucially a **2016 root store**:
  no ISRG Root X1 (Let's Encrypt), no current intermediates. Many sites fail at handshake.
  → *Solved by terminating upstream TLS server-side.*
- **JS** — ES5 + partial ES6 (it does have `Promise`, some `class`). No `fetch` (Safari 10.1),
  no `async/await` (Safari 11), no arrow functions in strict-parsed bundles, no generators in
  many forms, no `const/let` outside sloppy mode quirks, no template literals in some parses.
  One bad token = whole file dead.
- **DOM/Web APIs** — No IntersectionObserver/ResizeObserver/MutationObserver (partial),
  Shadow DOM, Custom Elements, WebCrypto, Service Workers, Web Push, WebRTC, WebGL2,
  `position: sticky`, `history.scrollRestoration`… Transpilers cannot invent these.
- **CSS** — No Grid (iOS 10.3), no custom properties (buggy 9.3 partial), no `gap`, `clamp()`,
  logical properties; flexbox needs `-webkit-` prefixes. Unknown rules → silently dropped →
  mangled layouts.
- **Media** — Native HLS (it is Apple's protocol) and H.264/AAC MP4 — **streamable media can
  work**. No WebM/VP9/AV1, no DASH-without-HLS, no modern DRM (Widevine/modern FairPlay).
- **Hardware** — iPad mini 1: 512 MB RAM, A5. Multi-MB pages OOM the tab. → *Aggressively
  downscale images server-side (done here).*
- **Delivering the gateway itself** — Vercel's default Let's Encrypt chain is **untrusted by
  iOS 9**; HSTS-preloaded TLDs (`.app` etc.) force HTTPS. → *Serve the gateway over plain HTTP
  on a custom domain (or a custom-domain cert from a legacy-trusted CA, TLS 1.2 on). The
  upstream hop — the one that touches real sites and credentials — is always full modern TLS
  with real certificate validation.*

## 3. Architecture comparison

### A — Rewriting web proxy *(implemented as the primary layer)*
`iPad → Vercel proxy → modern site`. Fetch upstream as a modern browser; transform the payload.
- **Works:** HTML, links, forms (GET/POST), redirects, cookies/logins (server-side jars),
  images (re-encoded), fonts, CSS (url-rewritten), relative XHR/fetch **with zero client JS**
  (thanks to path-based proxy addresses), HLS/MP4 streaming + Range, MP3/audio, PDFs, downloads,
  legacy charsets (Shift_JIS/GB2312/… → UTF-8), iframes.
- **Fails:** heavy SPAs, WebSocket-centric apps, Google-class auth, anti-bot walls
  (Cloudflare IUAM/hCaptcha vs. datacenter IPs), DRM streaming, file uploads (blocked),
  path-absolute `fetch('/x')` unless the JS shim mode is enabled.

### B — Remote browser *(implemented as snapshot fallback)*
`iPad → Vercel → outbound CDP → hosted Chromium → site`.
- **Live interactive streaming** (screencast + input injection) needs persistent processes and
  long-lived sockets → **not Vercel-compatible** (see §5).
- **Snapshot mode** (this repo): each interaction = fresh Chromium session over outbound CDP
  (allowed from Vercel), rehydrated cookies + nav-stack from Postgres, returns JPEG + tap map.
  Works for virtually any site; slow per click. Needs one external service (Browserless or any
  CDP provider — or a $5 container if you'd rather self-host).

### C — Hybrid offload *(implemented as per-session settings on A)*
Keep old WebKit rendering, offload only what it can't do: TLS, image re-encode, charset, and
optionally JS (Babel preset-env → Safari 9, cached in Postgres) + polyfills + XHR/fetch URL shim.
Honest ceiling: missing DOM APIs still kill real apps; worth it for the middle band of sites.

## 4. Recommended architecture

**A as primary + C as dials + B as fallback.** The linchpin is the path-based proxy URL:

```
/p/https/example.com/dir/page?q=1
      ↑ upstream scheme & host encoded into our PATH
```

Because the document itself is served from `/p/<scheme>/<host>/…`, **every relative reference
in the page resolves back into the proxy automatically** — links, images, form actions, CSS
`url()`, relative `fetch()`/XHR. Only absolute (`https://…`) and root-relative (`/x`) references
must be rewritten. Smaller rewrite surface ⇒ dramatically higher real-world reliability.

## 5. Vercel feasibility (measured against actual limits)

| Vercel reality | Impact |
|---|---|
| No persistent processes / no inbound WebSocket servers | No always-on browser sessions; no live screencast push. Snapshot-per-click works because **outbound** CDP/WSS is fine. |
| Function duration 10s (Hobby) → 300s (Pro/Fluid) | Proxy: fine. Snapshot cold-start ≈ 3–8s → needs Pro, `maxDuration=60`. |
| 1–3 GB RAM | cheerio/sharp fine; Babel on 1.5 MB bundles is slow → results cached in Postgres. |
| Large response streaming | HTML/CSS buffered ≤6/3 MB; media/other proxied as streams with Range passthrough. |
| Stateless instances | All state in Postgres (sessions, encrypted jars, history, transpile cache, snapshot frames). Rate limiting here is per-instance best-effort — production → Upstash. |
| TLS toward the iPad | LE chain untrusted by iOS 9; `.app` domains are HSTS-preloaded → custom domain over **HTTP**, or legacy-trusted CA cert. |

**Verdict:** Vercel is *technically appropriate* for A+C and for click-by-click snapshot B.
Vercel is *not appropriate* for live interactive remote browsing. The minimum extra
infrastructure for that upgrade is a single container (browserless + noVNC/websockify on
Fly.io/Render/Railway), bolted onto this codebase's Snapshot layer — not required for the MVP.

## 6. Required external services

1. **Postgres** (required) — Vercel Postgres / Neon / Supabase.
2. **Browserless token** (optional, Snapshot Mode) — `BROWSERLESS_TOKEN`, or self-host the OSS
   browserless container and point `BROWSERLESS_ENDPOINT` at it.
3. **Upstash Redis** (optional) — if you ever expose the gateway publicly at scale.

## 7–8. Request/response flow

```
iPad Safari ──GET /navigate?q=bbc.com/news──▶ 302 /p/https/bbc.com/news
iPad Safari ──GET /p/https/bbc.com/news─────▶ middleware (session cookie, gate)
   route /p/[...parts]:
     SSRF guard → rate limits → load session+jar (AES-GCM decrypt)
     fetch('https://bbc.com/news') with Chrome UA, modern TLS,
       manual redirects, Accept w/o webp, server Cookie header from jar
     capture Set-Cookie → jar (never leaves server)
     HTML → charset decode → cheerio transform
            (rewrite href/src/srcset/action/poster/style-urls/meta-refresh;
             strip <base>, CSP metas, module scripts, SRI, preconnect;
             rescue data-src lazy images; normalize forms; inject toolbar)
     → 200 text/html; charset=utf-8   (+ history insert, jar save in after())
Image  /p/https/ichef.bbci.co.uk/…x.webp ──▶ fetch → sharp → JPEG ≤1100px ─▶ iPad
CSS    /p/https/static.example.com/x.css ─▶ url() rewrite ─▶ text/css
3xx    upstream Location: /live/news ─────▶ 302 Location: /p/https/bbc.com/live/news
```

## 9. Security architecture

- **Open-proxy defense:** optional `LG_GATE_KEY` shared-secret gate (middleware-enforced on every
  route incl. `/p/*`); per-IP per-minute and per-session per-day budgets; `noindex` everywhere;
  upstream `Referer` is mapped to the *site's* URL, never ours.
- **SSRF:** scheme/port allowlist, no userinfo, hostname blocklist, **DNS resolution with
  private/loopback/link-local/CGNAT/reserved IP rejection** (IPv4+IPv6, mapped forms), optional
  `LG_ALLOWLIST`, proxy-loop block.
- **Cookie/session:** jars encrypted AES-256-GCM at rest (`LG_SECRET`), keyed by anonymous
  unguessable session id; RFC6265 domain/path/secure scoping re-implemented server-side →
  per-session credential isolation; one-click wipe.
- **Header hygiene:** CSP/XFO/HSTS/CORP/NEL/reporting stripped downstream (they'd break
  re-served content); `integrity`/SRI removed (we modify bytes); request header allowlist
  upstream (UA, Accept, Range, mapped Referer, jar cookies only); `nosniff` set.
- **No server-side execution of site JS.** Cheerio never evals; Babel only transforms; Snapshot
  JS runs inside the provider's isolated Chromium, not our function.
- **Reality check:** a 2015 WebKit browsing anything runnable is itself attack surface. Don't
  bank through this; do read the news.

## 10. Technology stack
Next.js 16 (App Router, Node runtime) · TypeScript · Drizzle ORM · Postgres · cheerio · sharp ·
@babel/preset-env (targets safari 9) · core-js-bundle + whatwg-fetch · iconv-lite ·
puppeteer-core (CDP client only — zero local Chromium) · Node crypto (AES-256-GCM) ·
ES3/ES5-only client surface (server-rendered pages, real forms, no required JS).

## 11. Project structure
see `/about` §11 or the `src/` tree.

## 12. Roadmap
**MVP (this repo).** → Phase 2: per-site rewrite rules, Upstash limits, HLS playlist rewriting,
readability auto-mode, Better Auth admin. → Phase 3: container add-on for near-live remote
browsing; partial-frame VNC-ish updates.

## 13. MVP definition (what "done" meant)
Type URL → browse rewritten site with working links/forms/images/search; session persists;
history/bookmarks visible; toggle Full/Lite; optional JS-rescue toggle; snapshot fallback with
one external token; SSRF+gate+rate guards on; deployable to Vercel as-is. **Delivered.**

## 14. Known limitations
Path-absolute XHR without JS-mode shim · anti-bot walls · OAuth-JS logins (Snap instead) ·
uploads blocked · WebSocket apps (Snap only) · first-transpile latency · iframe cross-origin auth
fragility · snapshot CADENCE ~5–10s.

## 15. Estimated complexity
Proxy core M · HTML rewriting M–H (80/20 living target) · JS rescue L-wire/M-value · Images L ·
Snapshot M · Live remote browsing (container) H — deliberately out of Vercel scope.
