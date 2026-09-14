import { Top, UrlBar, Wrap } from "../chrome";

export const dynamic = "force-static";

function P({ ok, children }: { ok: "yes" | "mid" | "no"; children?: React.ReactNode }) {
  const cls = ok === "yes" ? "lg-pill lg-pill-ok" : ok === "mid" ? "lg-pill lg-pill-mid" : "lg-pill lg-pill-bad";
  return (
    <span className={cls}>
      {children ?? (ok === "yes" ? "works" : ok === "mid" ? "partial" : "no")}
    </span>
  );
}

/**
 * The feasibility report, rendered in ES3-safe HTML so it is readable on
 * the very iPad it describes. The full document also lives in REPORT.md.
 */
export default function AboutPage() {
  return (
    <>
      <Top slim />
      <UrlBar compact />
      <Wrap>
        <h2 className="lg-h2">Feasibility report — modern web on iOS 9.3.6, honestly</h2>

        <div className="lg-panel">
          <h3>1. Feasibility assessment</h3>
          <p>
            <b>Short answer: partially feasible, and this is it — not a fake demo.</b> No
            server-side system can make a 2015 WebKit execute 2025-class web applications. But a
            compatibility gateway <i>can</i> restore genuinely useful browsing for a large slice of
            the web: reading, searching, reference sites, forums, documentation, blogs, classic
            apps, and even some logins. Three techniques are layered here:
          </p>
          <ul>
            <li>
              <b>Full proxy mode</b> — fetch with modern TLS, rewrite HTML/CSS/URLs, re-encode
              images. Works for documents, links, forms, XHR.
            </li>
            <li>
              <b>Lite mode</b> — strip all site JS/CSS, re-typeset. Guarantees readability on heavy
              news sites; a &quot;Readability-as-a-proxy&quot; fallback that never fully breaks.
            </li>
            <li>
              <b>Snapshot mode</b> — a cloud Chromium renders impossible sites into screen photos
              with invisible tap targets. Slow (5–10s/click) but near-universal.
            </li>
          </ul>
        </div>

        <div className="lg-panel">
          <h3>2. What iOS 9.3.6 WebKit cannot do (and cannot be given)</h3>
          <ul>
            <li>
              <b>TLS:</b> max TLS 1.2, no modern cipher suites, and — the real killer — a 2016 root
              certificate store missing ISRG Root X1 (Let&apos;s Encrypt). Many HTTPS sites simply
              refuse the handshake. <b>Gateway fixes this</b> by terminating upstream TLS server-side.
            </li>
            <li>
              <b>JavaScript:</b> ES5 + fragments of ES6. No <span className="lg-code">fetch</span>, no{" "}
              <span className="lg-code">async/await</span>, no arrow functions, no{" "}
              <span className="lg-code">class</span>/<span className="lg-code">const</span> in strict
              bundles. A single unparseable character kills the entire script file. Babel transpile
              + core-js (optional here) rescues <i>some</i> bundles.
            </li>
            <li>
              <b>DOM APIs that don&apos;t exist</b> — IntersectionObserver, ResizeObserver, Shadow
              DOM, Custom Elements, History API edge cases... No transpiler can create these.
              Polyfills cover maybe half, awkwardly. <b>This is the hard wall for SPAs.</b>
            </li>
            <li>
              <b>CSS:</b> no Grid, no custom properties, no <span className="lg-code">gap</span>, no{" "}
              <span className="lg-code">clamp()</span>, partial flexbox. Unknown rules are dropped
              silently → broken layouts. Server-side downgrade of arbitrary modern CSS is not
              solvable in general (hence Lite mode).
            </li>
            <li>
              <b>Media:</b> plays H.264/AAC in MP4 and Apple HLS natively — so direct video files
              and HLS can pass through fine. DRM (Widevine/FairPlay-modern), DASH, WebM/VP9/AV1: no.
            </li>
            <li>
              No Service Workers, no Web Push, no WebRTC, no WebGL2, no hardware budget for
              multi-MB pages on 512MB–1GB RAM (the iPad mini 1 has <b>512MB</b>).
            </li>
          </ul>
        </div>

        <div className="lg-panel">
          <h3>3. Architecture comparison</h3>
          <table className="lg-table">
            <tbody>
              <tr>
                <th>Approach</th>
                <th>What it gives</th>
                <th>What breaks</th>
                <th>Verdict</th>
              </tr>
              <tr>
                <td><b>A — Rewriting proxy</b></td>
                <td>Fast, cheap, stateless-friendly; documents, links, forms, search, cookies, many logins, images, HLS/MP4 video, downloads.</td>
                <td>Heavy SPAs, Google-class logins, WebSocket apps, anti-bot walls.</td>
                <td><P ok="yes">Primary layer — built here</P></td>
              </tr>
              <tr>
                <td><b>B — Remote browser</b></td>
                <td>Works for almost anything, including SPAs: rendering happens in real Chromium.</td>
                <td>Latency, cost, streaming needs a persistent server; screenshot-per-click is the Vercel-compatible compromise.</td>
                <td><P ok="mid">Fallback layer — built (needs provider token)</P></td>
              </tr>
              <tr>
                <td><b>C — Hybrid (offload only what the client can&apos;t do)</b></td>
                <td>TLS termination + image re-encode + optional JS transpile/polyfill while the old engine still renders.</td>
                <td>Anything requiring missing DOM APIs.</td>
                <td><P ok="mid">Implemented as settings on layer A</P></td>
              </tr>
              <tr>
                <td>&quot;Transpile everything perfectly&quot;</td>
                <td colSpan={2}>
                  Not a real option: you cannot polyfill syntax parse errors with JS (the file
                  never runs), and you cannot polyfill missing platform APIs at scale. Any product
                  claiming full SPA compat via proxy CSS/JS rewriting is a demo that works on the 5
                  sites it was tuned on.
                </td>
                <td><P ok="no">Rejected</P></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="lg-panel">
          <h3>4. Recommended architecture (what you&apos;re running)</h3>
          <p>
            The gateway is <b>A primary + C as dials + B as fallback</b>. The key design decision:
            path-based proxy URLs —
          </p>
          <pre className="lg-small">
{"/p/https/en.wikipedia.org/wiki/Ipad\n                 ^^^^^^^^^^^^^^^\n  upstream host lives in the PATH"}
          </pre>
          <p className="lg-small">
            Because the document itself is served from that path, every relative URL in the page
            (links, images, forms, CSS url(), relative fetch/XHR) resolves <i>inside the proxy with
            zero rewriting</i>. Only absolute and root-relative (<span className="lg-code">/x</span>) references
            need rewriting — a much smaller, more reliable surface. This is why relative AJAX keeps
            working on a 2015 browser without any client JavaScript at all.
          </p>
        </div>

        <div className="lg-panel">
          <h3>5. Vercel feasibility (actual limits, not brochure limits)</h3>
          <ul>
            <li>
              <b>No persistent processes or servers:</b> you cannot hold a Chromium or a WebSocket
              server between user clicks. Snapshot Mode therefore re-creates the browser per
              interaction (via an outbound CDP socket, which <i>is</i> allowed) and rehydrates
              cookies/stack from Postgres. Works, ~5–10s per step.
            </li>
            <li>
              <b>Execution time:</b> Hobby 10s (too tight for cold Chromium), Pro/Fluid up to 300s —
              proxying is fine; snapshot needs Pro. This app sets <span className="lg-code">maxDuration=60</span>.
            </li>
            <li>
              <b>Memory:</b> 1–3GB per function — plenty for cheerio rewriting and sharp image
              re-encoding; Babel on 1.5MB bundles is CPU-slow (hence the transpile cache in Postgres).
            </li>
            <li>
              <b>Response size:</b> unbuffered streaming responses pass large media through; HTML/CSS
              are buffered and capped (6MB/3MB) to keep transformations safe.
            </li>
            <li>
              <b>TLS to the iPad:</b> Vercel&apos;s default Let&apos;s Encrypt chain is <i>untrusted by
              iOS 9</i> (no ISRG Root X1 in its store) and <span className="lg-code">.app</span>/preloaded domains
              force HTTPS. Use a <b>custom domain over plain HTTP</b>, or a custom-domain cert from a
              CA iOS 9 trusts with TLS 1.2 enabled. Plain HTTP to the device is the pragmatic path —
              the sensitive hop (gateway → modern site) is always full modern TLS with proper certificate
              validation.
            </li>
            <li>
              <b>WebSockets:</b> not supported for inbound on Vercel functions. Old Safari actually
              <i>has</i> WebSocket and can hold direct wss connections to origins when site JS runs —
              but proxied sites&apos; JS rarely survives anyway; real-time apps are Snapshot-mode
              territory.
            </li>
            <li>
              <b>State:</b> Postgres (sessions, encrypted cookie jars, history, transpile cache,
              snapshot frames). Rate limiting here is best-effort per-instance; production should
              move <span className="lg-code">src/lib/ratelimit.ts</span> to Upstash Redis.
            </li>
          </ul>
          <p>
            <b>Verdict: Vercel is appropriate for the proxy gateway (A+C) and for click-by-click
            snapshotting (B-lite). Vercel is NOT appropriate for live interactive remote browsing
            (streaming video of the page, persistent sessions, real-time keystrokes). That requires
            a container platform (Fly.io/Render/Railway) running e.g. browserless + noVNC — the
            documented minimal upgrade, not a requirement for this MVP.</b>
          </p>
        </div>

        <div className="lg-panel">
          <h3>6. Required external services</h3>
          <ul>
            <li><b>Postgres</b> — Vercel Postgres/Neon/Supabase. Required.</li>
            <li>
              <b>Browserless (or any hosted CDP Chromium)</b> — optional, only for Snapshot Mode. Set{" "}
              <span className="lg-code">BROWSERLESS_TOKEN</span>.
            </li>
            <li><b>Upstash Redis</b> — optional, only if public-facing abuse becomes real.</li>
          </ul>
        </div>

        <div className="lg-panel">
          <h3>7–8. System diagram &amp; request flow</h3>
          <pre className="lg-small">
{`iPad mini (iOS 9.3.6, plain-HTTP Safari)
        │  GET /p/https/example.com/article
        ▼
┌─ LegacyGateway (Next.js on Vercel) ───────────────────────┐
│ middleware: session cookie + optional access gate          │
│ route /p/[...parts]:                                       │
│   1. SSRF guard (scheme/port/DNS→IP allowlist, private IP) │
│   2. rate limits (per-IP/minute, per-session/day)          │
│   3. load session row + AES-GCM decrypt cookie jar         │
│   4. fetch upstream as modern Chrome (TLS 1.3, full SNI)   │
│   5. capture Set-Cookie → jar (never reaches the iPad)     │
│   6. dispatch by Content-Type:                             │
│      HTML → charset-decode → cheerio rewrite               │
│             (URLs/srcset/meta-refresh/forms; strip         │
│              module scripts, CSP, integrity, SRI…)         │
│      CSS  → rewrite url()/import                           │
│      JS   → passthrough | Babel→ES5 (cached) + polyfills   │
│      img  → sharp: WebP/AVIF→JPEG/PNG, width cap           │
│      3xx  → rewrite Location back into /p/…                │
│      media→ stream + Range passthrough (HLS/MP4 playable)  │
│   7. history insert; jar save (Next 'after')               │
└────────────────────────────────────────────────────────────┘
        │                                     │
        ▼                                     ▼
  Postgres (sessions, jars,              Modern website
  history, cache, snapshots)             (TLS validated here)

Snapshot Mode (optional):
  /snap/view → outbound CDP → cloud Chromium (browserless)
  → navigate/type/scroll → JPEG frame stored in Postgres
  → HTML page: <img> + absolutely-positioned tap targets`}
          </pre>
        </div>

        <div className="lg-panel">
          <h3>9. Security architecture</h3>
          <ul>
            <li>
              <b>Not an open proxy by default</b>: set <span className="lg-code">LG_GATE_KEY</span> and every
              route requires the key. Without it, rate limits + daily page budgets still cap abuse.
            </li>
            <li>
              <b>SSRF:</b> only http/https, ports 80/443/8080/8443, no userinfo, DNS-resolved IP
              checks against private/loopback/link-local/CGNAT/documentation ranges (IPv4+IPv6),
              optional <span className="lg-code">LG_ALLOWLIST</span> domain allowlist, self-proxy loop
              blocked.
            </li>
            <li>
              <b>Cookies:</b> upstream Set-Cookie never reaches the device. Jars are AES-256-GCM
              encrypted at rest (<span className="lg-code">LG_SECRET</span>), keyed by anonymous session,
              domain/path/secure-scoped per RFC6265 semantics serverside. That also gives
              per-session login isolation.
            </li>
            <li>
              <b>CSP/XFO/HSTS/CORP stripped</b> upstream→client (we re-serve content from our own
              origin; keeping them would break legitimately). <span className="lg-code">nosniff</span> +
              X-Robots-Tag noindex added. SRI <span className="lg-code">integrity</span> hashes removed
              (we modify content; otherwise everything would refuse to run).
            </li>
            <li>
              <b>JS sandboxing posture:</b> server-side we never <i>execute</i> site JS (no
              cheerio-eval, Babel transforms only, remote DOM runs in the provider&apos;s isolated
              Chromium, not our function).
            </li>
            <li>
              <b>Malicious sites:</b> they can attack the iPad&apos;s 2015 WebKit directly anyway
              (it is, sadly, Swiss cheese); the gateway does not add exploit surface to browsing —
              do not use this for banking. It adds surface to <i>YOU</i> (abuse/compute cost) —
              hence the gate, budgets, and noindex.
            </li>
            <li>
              <b>Logins:</b> server-side jars make logins possible where the site&apos;s own client JS
              still works post-rewrite (classic apps, phpBB, wikis…). OAuth/BrowserID flows using
              WebCrypto/popups (Google, Microsoft) will generally fail — use app passwords or
              Snapshot Mode.
            </li>
          </ul>
        </div>

        <div className="lg-panel">
          <h3>10. Technology stack</h3>
          <p className="lg-small">
            Next.js (App Router, Node runtime) · TypeScript · Drizzle ORM + Postgres · cheerio
            (HTML rewriting) · undici/fetch with manual redirects (upstream) · sharp (image
            recode) · Babel preset-env→Safari 9 + core-js + whatwg-fetch (optional JS rescue) ·
            iconv-lite (legacy encodings) · puppeteer-core over CDP (Snapshot Mode) · AES-256-GCM
            (jar encryption) · ES3/ES5-only client code (zero client JS needed to browse).
          </p>
          <h3>11. Folder structure</h3>
          <pre className="lg-small">
{`src/
  middleware.ts                 session cookie + access gate
  app/
    page.tsx settings/ history/ about/ snap/ gate/ … (ES3-safe UI)
    navigate/ mode/            tiny redirect endpoints
    p/[...parts]/route.ts      THE proxy (all verbs, all content types)
    snap/view|img|type/        remote-browser snapshot mode
    api/health/                health check
  lib/
    config.ts ssrf.ts ratelimit.ts crypto.ts session.ts cookies.ts
    urlrew.ts upstream.ts charset.ts img.ts snapstate.ts
    rewrite/html.ts rewrite/css.ts rewrite/js.ts
  db/  schema.ts (sessions, history, bookmarks, cache)
public/legacy/  polyfill.js fetch.js shim.js  (ES5 static assets)`}
          </pre>
        </div>

        <div className="lg-panel">
          <h3>12–13. Roadmap &amp; MVP</h3>
          <p className="lg-small">
            <b>MVP (built, this repo):</b> proxy On/Full+Lite, URL bar + search, bookmarks/history,
            settings, image recode, cookie jars (logins where possible), SSRF+gate+limits, snapshot
            plumbing end-to-end.
            <br />
            <b>Phase 2:</b> Upstash rate limits; Better Auth-protected admin; per-site rules
            (rewrite quirks DB); smarter lazyload rescue; HLS proxy-playlist rewriting for more
            streams; readability scoring to auto-pick Lite.
            <br />
            <b>Phase 3:</b> optional container add-on (Fly.io) with persistent browserless + WebSocket
            for near-live remote browsing; VNC-like partial-frame updates; DNS-based transparent
            mode (browse by typing real URLs because DNS answers point at the gateway — heavy,
            skip unless hooked).
          </p>
          <h3>14. Known limitations</h3>
          <ul className="lg-small">
            <li>Path-absolute client-side fetch/XHR (<span className="lg-code">fetch('/x')</span>) fails unless JS-transpile mode is on (the shim rewrites it).</li>
            <li>Sites behind Cloudflare &quot;I'm under attack&quot;/hCaptcha/DataDome deny datacenter IPs regardless of UA.</li>
            <li>Google/Facebook/Microsoft logins: modern auth JS + WebCrypto → generally dead. Snapshot Mode is the workaround.</li>
            <li>File uploads blocked; downloads fine.</li>
            <li>WebSocket-only apps (chat, trading): proxy mode no, snapshot mode slow-but-yes.</li>
            <li>First-fetch JS transpile can take 10–30s for big bundles (cached afterwards).</li>
            <li>iframe-to-cross-origin logins; window.opener flows — fragile.</li>
          </ul>
          <h3>Compatibility matrix (per the 12 test categories)</h3>
          <table className="lg-table">
            <tbody>
              <tr><th>Site category</th><th>Full</th><th>Lite</th><th>Snap</th><th>Notes</th></tr>
              <tr><td>1. Static HTML</td><td><P ok="yes"/></td><td><P ok="yes"/></td><td>·</td><td>Feels native.</td></tr>
              <tr><td>2. News (BBC/CNN…)</td><td><P ok="mid"/></td><td><P ok="yes"/></td><td>·</td><td>Full-rendering heavy; Lite is the intended mode. Comments often work.</td></tr>
              <tr><td>3. Search engines</td><td><P ok="yes"/></td><td><P ok="yes"/></td><td>·</td><td>DDG HTML endpoint &amp; Bing work; Google works-ish, may captcha datacenter IPs.</td></tr>
              <tr><td>4. Social media</td><td><P ok="no"/></td><td><P ok="no"/></td><td><P ok="mid"/></td><td>Login-required SPA walls. Snapshot for read-only glances.</td></tr>
              <tr><td>5. Modern SPAs</td><td><P ok="no"/></td><td><P ok="no"/></td><td><P ok="yes"/></td><td>Nothing client-side can save them. Snapshot is the honest answer.</td></tr>
              <tr><td>6. React apps w/ SSR</td><td><P ok="mid"/></td><td><P ok="mid"/></td><td><P ok="yes"/></td><td>Server-rendered content reads fine; hydration scripts die quietly.</td></tr>
              <tr><td>7. Video sites</td><td><P ok="mid"/></td><td>·</td><td><P ok="mid"/></td><td>Direct MP4/HLS plays natively. YouTube app: no. Watch snapshot + audio-only hacks.</td></tr>
              <tr><td>8. E-commerce</td><td><P ok="mid"/></td><td><P ok="mid"/></td><td><P ok="yes"/></td><td>Catalog/cart classics fine; Stripe/PayPal checkout JS usually not. Call the shop :)</td></tr>
              <tr><td>9. Login sites (classic)</td><td><P ok="mid"/></td><td><P ok="mid"/></td><td><P ok="yes"/></td><td>Form-based logins persist via server jars. OAuth2-JS flows no.</td></tr>
              <tr><td>10. WebSocket apps</td><td><P ok="no"/></td><td><P ok="no"/></td><td><P ok="yes"/></td><td>iOS9 has WS, but the app JS doesn&apos;t survive rewriting.</td></tr>
              <tr><td>11. Very heavy JS</td><td><P ok="no"/></td><td><P ok="mid"/></td><td><P ok="yes"/></td><td>Lite for text, snapshot for function.</td></tr>
              <tr><td>12. Modern auth (passkeys, WebAuthn)</td><td><P ok="no"/></td><td><P ok="no"/></td><td><P ok="mid"/></td><td>No WebCrypto/CTAP in 2015 WebKit. Snapshot Chrome does have it — cross-device friction though.</td></tr>
            </tbody>
          </table>
          <h3>15. Estimated complexity</h3>
          <p className="lg-small">
            Proxy core: <b>medium</b> (≈1.5k LOC, the fiddly 20% is charset/cookie/redirect edge
            cases). HTML rewriting: <b>medium-high</b> (never &quot;done&quot; — an 80/20 living target).
            JS transpile: <b>low</b> to wire, <b>bounded</b> value. Image pipeline: <b>low</b>. Snapshot
            mode: <b>medium</b> (stateless-remote-session bookkeeping). Live remote browsing on a
            container host: <b>high</b> — and explicitly out of Vercel scope.
          </p>
        </div>

        <p className="lg-small">
          Tip: when a page looks wrecked in Full mode, hit <b>Lite mode</b> in the bottom toolbar.
          When it&apos;s hopeless either way, hit <b>Snap</b>.
        </p>
      </Wrap>
    </>
  );
}
