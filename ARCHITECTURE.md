# Technical Architecture & Pipeline

Legacy Gateway is a high-performance web compatibility proxy designed to bridge modern web standards (TLS 1.3, ES6+ JavaScript, WebP/AVIF images, modern CSS) with legacy browser engines (such as WebKit on iOS 9.3.6).

---

## 1. System Overview

```
+--------------------------+
|  Legacy Client           |
|  (iPad mini / iOS 9.3)   |
+------------+-------------+
             |
             | HTTP / Plain WebKit
             v
+------------+-------------+
|  Legacy Gateway          |
|  (Next.js App Router)    |
+------------+-------------+
    |        |        |
    |        |        +-------------------------+
    |        |                                  |
    v        v                                  v
+-------+  +--------------------------+   +-------------------+
| Postgres| | Upstream Web (TLS 1.3)   |   | Browserless CDP   |
| DB    |  | (Babel/Sharp processing) |   | (Snapshot Mode)   |
+-------+  +--------------------------+   +-------------------+
```

The gateway handles all upstream SSL/TLS termination, polyfilling, asset conversion, cookie isolation, and markup transformation server-side.

---

## 2. Core Request Lifecycle

### Request Flow for Proxying

1. **Routing**: Any request matching `/p/<scheme>/<host>/<path>` is intercepted by the dynamic App Router proxy handler in `src/app/p/[...slug]/route.ts`.
2. **SSRF Guard**: Before making any outbound request, `src/lib/ssrf.ts` resolves the destination domain's IP addresses and verifies that they do not belong to private, loopback, or cloud metadata ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16).
3. **Session & Cookie Jar Lookup**: `src/lib/session.ts` extracts the client session identifier. `src/lib/cookies.ts` decrypts and attaches any saved cookies for the destination domain using AES-256-GCM.
4. **Upstream Request**: `src/lib/upstream.ts` executes an HTTP/HTTPS fetch with modern TLS 1.3 support and Chrome user-agent headers.
5. **Content-Type Processing**:
   - **HTML**: Transformed via Cheerio in `src/lib/rewrite/html.ts`. Rewrites links (`href`), media (`src`), and form targets (`action`) to stay within the `/p/` proxy scheme. Transpiles inline scripts via Babel.
   - **Images**: Intercepted in `src/lib/img.ts`. Converts WebP/AVIF images to baseline JPEG/PNG formats using `sharp`, downscaling oversized images to prevent out-of-memory crashes on 512MB RAM devices.
   - **CSS**: Processed in `src/lib/rewrite/css.ts`. Strips modern CSS properties unsupported by legacy WebKit and rewrites embedded `url()` declarations.
   - **JavaScript**: Transpiled in `src/lib/rewrite/js.ts`. Uses Babel (`preset-env` targeting Safari 9) with `core-js` and `whatwg-fetch` polyfills to downgrade modern syntax to ES5. Transpilation outputs are cached in PostgreSQL.
6. **Response Delivery**: Rewritten headers and converted payloads are returned to the client browser with legacy-safe encoding (UTF-8).

---

## 3. Rendering Modes

### Full Mode
Preserves original site layouts and stylesheets. Rewrites external references so that relative assets, forms, and fetch calls route back through the proxy seamlessly.

### Lite Mode
Strips all client-side JavaScript, external stylesheets, and inline styles. Re-typesets content into clean, semantic HTML optimized for high readability and fast page loads on low-powered hardware.

### Snapshot Mode
Used for complex Single Page Applications (SPAs) or web applications heavy in modern JavaScript.
- Connects to a cloud Chromium browser instance via Chrome DevTools Protocol (`wss://chrome.browserless.io`).
- Renders the full web application in remote Chrome.
- Generates high-resolution viewport screenshots with calculated overlay coordinates for links, buttons, and form inputs.
- Delivers still images to the client browser. Taps on screenshot regions trigger remote input, form typing, or navigation commands.

---

## 4. Database Architecture

Legacy Gateway utilizes PostgreSQL (managed via Drizzle ORM) for persistence:

- **`sessions`**: Tracks active client session identifiers and creation timestamps.
- **`cookies`**: Stores encrypted cookie jars per session and per domain (encrypted at rest with AES-256-GCM using `LG_SECRET`).
- **`cache`**: Stores cached transpiled JavaScript files and temporary snapshot screenshot frames to minimize upstream compute and latency.

Schema definitions reside in `src/db/schema.ts`.
