# Security Architecture & Policy

Security is a primary design constraint for Legacy Gateway. Serving as a web proxy presents inherent risks, including Server-Side Request Forgery (SSRF), open proxy abuse, and cookie leakage. This document details the security controls implemented across the codebase.

---

## 1. Security Controls Overview

```
+-------------------------------------------------------------------+
|                        Security Layers                            |
+-------------------------------------------------------------------+
| 1. Access Control Gate  | Shared key access (LG_GATE_KEY)         |
| 2. SSRF Protection      | DNS pinning & private IP ranges blocking  |
| 3. Data Encryption      | AES-256-GCM encrypted cookie storage      |
| 4. Rate Limiting        | IP & session request throttling           |
| 5. Header Sanitization  | Stripping hop-by-hop & sensitive headers |
+-------------------------------------------------------------------+
```

---

## 2. Server-Side Request Forgery (SSRF) Prevention

To prevent attackers from using the gateway to scan internal networks, private subnets, or cloud infrastructure metadata endpoints (e.g., AWS Metadata `169.254.169.254`), `src/lib/ssrf.ts` performs strict validation on every outbound destination URL:

- **Protocol Validation**: Only `http:` and `https:` schemes are permitted.
- **DNS Resolution Pinning**: Hostnames are resolved to IP addresses via DNS lookup prior to dispatch.
- **IP Range Rejection**: The resolved IP address is verified against reserved and non-routable IP ranges.

Disallowed address ranges include:
- `127.0.0.0/8` (Loopback)
- `10.0.0.0/8` (Private network)
- `172.16.0.0/12` (Private network)
- `192.168.0.0/16` (Private network)
- `169.254.0.0/16` (Link-local & cloud metadata)
- `0.0.0.0/8` (Current network)
- `::1/128`, `fc00::/7`, `fe80::/10` (IPv6 loopback & private)

---

## 3. Cookie Storage & Encryption at Rest

Upstream session cookies and login credentials are kept isolated per client session and stored in PostgreSQL (`src/lib/cookies.ts`).

- **Encryption Algorithm**: AES-256-GCM (Galois/Counter Mode) authenticated encryption.
- **Key Derivation**: Key material is derived from `LG_SECRET` via SHA-256 (`src/lib/crypto.ts`).
- **Initialization Vectors & Auth Tags**: Every stored payload uses a cryptographically random 12-byte IV and a 16-byte authentication tag.
- **Isolation**: Upstream cookies never reach the client browser, preventing script injection or client-side storage vulnerabilities on legacy devices.

---

## 4. Access Control & Gate Key

Public web proxies are high-value targets for malicious traffic relay and abuse.

- **Gateway Key (`LG_GATE_KEY`)**: When enabled, all requests require session authentication. Unauthenticated users are redirected to `/gate` and prompted for the access key.
- **Session Tokens**: Authenticated sessions are issued HTTP-only, secure session cookies signed by the server.

---

## 5. Rate Limiting & Abuse Prevention

Rate limiting is enforced at the network and application layer (`src/lib/ratelimit.ts`):

- **Per-IP Rate Limits**: Restricts active requests per minute per IP address.
- **Session Budget Caps**: Limits total upstream page fetches per session per 24-hour window (`CONFIG.pagesPerSessionPerDay`).
- **Response Size Limits**: Caps maximum response payload sizes for HTML, CSS, JavaScript, and images to prevent memory resource exhaustion.

---

## 6. Header & Content Sanitization

- **Hop-by-Hop Headers**: Headers such as `Connection`, `Keep-Alive`, `Proxy-Authenticate`, `Proxy-Authorization`, `TE`, `Trailers`, `Transfer-Encoding`, and `Upgrade` are stripped before forwarding requests.
- **Origin & Referer Isolation**: Outbound headers are rewritten to reflect the target site origin, shielding local network topology.

---

## 7. Reporting Vulnerabilities

If you discover a potential security vulnerability in Legacy Gateway, please report it privately to the repository maintainers rather than opening a public issue.
