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
  - **Full Mode**: Rewritten modern website preserving native layouts.
  - **Lite Mode**: Strips all CSS and JavaScript, rendering clean, re-typeset markup.
  - **Snapshot Mode**: Executes complex Single Page Applications (SPAs) inside a cloud Chromium instance and returns tap-targeted, interactive screenshot streams.
- **Experimental JS Rescue**: Babel `preset-env` targeting Safari 9 plus `core-js` and `whatwg-fetch` polyfills transpile modern JavaScript down to ES5. Results are cached in PostgreSQL.
- **Server-Side Cookie Jars**: Sessions and logins are maintained server-side and encrypted at rest using AES-256-GCM (`LG_SECRET`) in PostgreSQL.
- **Security Guards**: SSRF defense with DNS-pinned private IP rejection, optional access gate key (`LG_GATE_KEY`), rate limiting, and domain allowlists.
- **ES0-Safe UI**: The gateway interface is server-rendered HTML with plain forms and zero client JavaScript required.

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

