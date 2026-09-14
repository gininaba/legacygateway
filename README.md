# Legacy Gateway

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Drizzle_ORM-0.45-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black" alt="Drizzle ORM" />
  <img src="https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

**The modern web, translated for a 2015 browser.** A server-side compatibility gateway that lets legacy devices (such as an iPad mini on **iOS 9.3.6** with legacy WebKit) browse the modern internet without jailbreaking and without requiring a 2015 engine to run modern 2026 JavaScript natively.

```
iPad mini (iOS 9.3.6)  ->  Legacy Gateway (Next.js)  ->  the modern internet
```

Read [`REPORT.md`](./REPORT.md) for the full feasibility analysis (what works, what cannot work, and why), or open `/about` inside the app.

---

## What It Does

- **Rewriting Proxy**: Every resource is served under `/p/<scheme>/<host>/<path>`, ensuring relative links, images, forms, and requests resolve through the gateway. Absolute and root-relative URLs are rewritten idempotently.
- **TLS Rescue**: Upstream TLS 1.3 is terminated server-side with certificate validation. The client's obsolete TLS protocols and expired root certificates are bypassed.
- **Charset Upgrade**: Encodings such as Shift_JIS, GB2312, and Windows-125x are converted to UTF-8.
- **Image Rescue**: Formats like WebP and AVIF are converted to JPEG or PNG via `sharp`, with image width capped for 512MB RAM devices. GIF and SVG pass through intact.
- **Rendering Modes**:
  - **Full Mode**: Rewritten modern website preserving native layouts. Best for Wikipedia, GitHub, blogs, and documentation.
  - **Lite Mode**: Strips all site CSS and JavaScript, rendering clean, re-typeset markup. Guaranteed-readable; best for heavy news sites.
  - **Snapshot Mode**: Executes complex Single Page Applications (SPAs) inside a cloud Chromium instance and returns tap-targeted, interactive screenshot streams.
- **Image Rescue & Optimization**: Formats like WebP and AVIF are re-encoded to JPEG or PNG via `sharp`, with image width capped (e.g. 1100 px) to prevent out-of-memory crashes on 512MB RAM devices. Can be toggled off to save processing time and memory.
- **Experimental JS Rescue**: Babel `preset-env` targeting Safari 9 plus `core-js` and `whatwg-fetch` polyfills transpile modern JavaScript down to ES5. Results are cached in PostgreSQL.
- **Gateway Toolbar**: Optional floating toolbar injected at the bottom of proxied pages for easy navigation.
- **Server-Side Cookie Jars & Session Privacy**: Cookies, settings, and browsing history live server-side under an anonymous session ID (`lgs`) and never touch Safari's local storage. Sessions are encrypted at rest using AES-256-GCM (`LG_SECRET`) in PostgreSQL. Includes a one-click session wipe (`Wipe my session data`).
- **Security Guards**: SSRF defense with DNS-pinned private IP rejection, optional access gate key (`LG_GATE_KEY`), rate limiting, and domain allowlists.
- **ES0-Safe UI**: The gateway interface is server-rendered HTML with plain forms and zero client JavaScript required.

---

## Compatibility Settings

<p align="center">
  <img src="./docs/screenshots/compatibility_settings.png" alt="Legacy Gateway Compatibility Settings" width="650" />
</p>

Legacy Gateway provides configurable per-session settings accessible via `/settings`:

| Setting | Options / Values | Description |
|---|---|---|
| **Rendering Mode** | `Full mode` / `Lite mode` | Choose `Full mode` for layout preservation or `Lite mode` for stripped CSS/JS re-typeset text. |
| **Images** | `Enabled` / `Disabled` | Re-encodes WebP/AVIF to JPEG/PNG. Disable to save server processing time and client memory. |
| **Max Image Width** | `480 px` – `2048 px` (Default: `1100 px`) | Caps image dimensions to fit legacy screens and save memory. |
| **JavaScript (Experimental)** | `Enabled` / `Disabled` | Transpiles site JS down to ES5 (Babel $\rightarrow$ Safari 9) and injects polyfills. |
| **Gateway Toolbar** | `Enabled` / `Disabled` | Shows or hides the gateway control bar at the bottom of proxied pages. |
| **Session Wipe** | `Wipe my session data` link | Clears cookies, history, and bookmarks stored in PostgreSQL under the session ID. |

---

## Omnibox & Search Integration

Enter any web URL or search term directly into the gateway address bar on the home page or navigation bar. The gateway supports redirecting queries through configurable search engines:

- **DuckDuckGo** (Default): Search engine with a server-rendered HTML interface.
- **Google**: Standard web search.
- **Wikipedia**: Direct search across encyclopedia entries.
- **Bing**: General web search.

---

## Places That Work Well

<p align="center">
  <img src="./docs/screenshots/home_places_that_work_well.png" alt="Legacy Gateway Home Page & Curated Destinations" width="650" />
</p>

The gateway has been tested and optimized for key destinations across the web:

| Site | Recommended Mode | Experience / Notes |
|---|---|---|
| **Wikipedia** | Full mode | Works beautifully; layout and media render cleanly. |
| **DuckDuckGo** | Full mode | Light HTML search interface works natively. |
| **Hacker News** | Full mode | Tech news & discussion with a nearly native feel. |
| **Project Gutenberg** | Full mode | 70,000+ free ebooks, easily readable on-page. |
| **GitHub** | Full mode | Browse code & repositories (login unlikely to survive complex auth). |
| **Stack Overflow** | Full mode | Q&A reading works great. |
| **Weather** | Full mode | Minimal weather forecast display. |
| **BBC News** | Lite mode | Heavy modern news site — renders best in Lite mode. |
| **MDN Web Docs** | Full mode | Web technology reference documentation. |

---

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Database connection string (PostgreSQL / Supabase)
DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Secret key for encrypting cookie jars at rest (AES-256-GCM)
LG_SECRET="your-random-32-character-secret-key"

# Optional access gate key (prevents open-proxy abuse)
LG_GATE_KEY="your-access-password"

# Optional Browserless API key for Snapshot Mode
BROWSERLESS_TOKEN="your-browserless-api-key"
```

> **Note on Special Characters in Database Passwords**: If your database password contains special characters such as `&` or `@`, ensure they are URL-encoded (e.g., `%26` for `&`, `%40` for `@`).

> **Note on Supabase**: When using Supabase, use the **Connection Pooler** URI (e.g., `aws-0-[region].pooler.supabase.com:5432`) rather than the direct database domain to ensure IPv4 compatibility.

### 3. Push Database Schema

Create the database tables (`sessions`, `cookies`, `cache`) using Drizzle Kit:

```bash
npx drizzle-kit push
```

### 4. Run Development Server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (supports local Postgres, Supabase, Neon, etc.) |
| `LG_SECRET` | Yes | Master secret key used to derive AES-256-GCM encryption keys for cookie jars |
| `LG_GATE_KEY` | Optional | Access password for the gateway; turns the gateway private |
| `LG_ALLOWLIST` | Optional | Comma-separated list of allowed upstream domains |
| `LG_UPSTREAM_UA` | Optional | Custom User-Agent header sent to upstream websites |
| `BROWSERLESS_TOKEN` | Optional | Hosted Chromium CDP API token from Browserless.io (for Snapshot Mode) |
| `BROWSERLESS_ENDPOINT` | Optional | CDP WebSocket endpoint (defaults to `wss://chrome.browserless.io`) |

---

## Deployment (Vercel)

1. Push your repository to GitHub / GitLab and import it into Vercel.
2. Provision a PostgreSQL database (Vercel Postgres, Supabase, or Neon) and set `DATABASE_URL`.
3. Configure `LG_SECRET` and `LG_GATE_KEY` under Environment Variables.
4. Run `npx drizzle-kit push` against the target database.
5. Deploy the application.

> **Serverless Function Configuration**: `sharp` and `pg` are configured under `serverExternalPackages` in [`next.config.ts`](file:///Volumes/1TB%20Graphics%20SSD/AIPOS/legacy_gateway/next.config.ts) to prevent serverless bundling errors with native binaries on Vercel. JS rewriting uses asynchronous Babel transformations (`transformAsync`) to avoid blocking the serverless event loop.

> **iOS 9 Reachability Note**: For physical iOS 9 devices, serve the gateway over plain HTTP or use a custom domain with an SSL certificate chain trusted by legacy iOS 9 trust stores (e.g., avoiding Let's Encrypt certificates if ISRG Root X1 is uninstalled on the device). The upstream connection from the gateway to destination web servers always uses modern TLS 1.3 with full certificate validation.

---

## Technical Limits

- **Complex SPAs & WebSockets**: Proxy mode may struggle with heavy client-side JavaScript; Snapshot Mode should be used instead.
- **DRM Video**: Encrypted streaming video (DASH/DRM) is unsupported. Direct MP4 files and standard HLS streams work natively.
- **Anti-Bot Protections**: Datacenter IP blocking (Cloudflare CAPTCHA, hCaptcha) may deny requests regardless of User-Agent.
- **File Uploads**: Blocked by default; downloads operate normally.

---

## License

Distributed under the MIT License. See [`LICENSE`](./LICENSE) for full licensing details.

