# Security & Threat Model

This document outlines the security architecture of the Embeddable Widget & Lead-Capture Platform, specifically detailing the threat model and the mitigations implemented to protect both the platform and its tenants.

## 1. Threat Model Overview

Because the platform provides public-facing endpoints designed to be embedded on any third-party website, it is highly exposed. We operate under a "Zero-Trust" model for the public API, assuming all incoming submissions are potentially malicious, oversized, or automated. 

The primary threats identified are:
- **DDoS and Automated Abuse:** Bots submitting thousands of spam forms to exhaust database connections, storage, or third-party API quotas.
- **Cross-Site Scripting (XSS):** Malicious payloads submitted via forms or injected via the embed script.
- **Data Leakage / Cross-Tenant Access:** One tenant accessing another tenant's widgets or submissions.
- **Large Payload Abuse:** Submitting massive JSON payloads to exhaust memory.
- **CORS Misconfiguration:** Improper cross-origin setups leading to credential theft.

---

## 2. Mitigations & Defenses

### 2.1 Abuse & Spam Protection
Public submission endpoints are the most vulnerable surface. We employ a layered defense strategy.

- **Granular Rate Limiting (Redis):** 
  - Submissions are rate-limited using a sliding window counter in Redis. 
  - The key structure is `ratelimit:{widgetId}:{ipHash}`. This ensures that a spammer on one widget cannot degrade the experience for other visitors on that widget, nor can they affect other widgets on the platform.
  - Defaults to 10 requests per minute per IP.
  - *Fail-Open Design*: If Redis becomes unavailable, the rate limiter fails open to ensure legitimate leads are not lost during infrastructure degradation.

- **Honeypot Fields (Layer 1 Spam Filter):**
  - The submission payload includes a `website` field. On the frontend UI, this is visually hidden using CSS (`display: none`). 
  - Automated bots blindly fill all `<input>` fields. If the backend receives a submission with a populated `website` field, it immediately classifies it as spam.
  - *Silent Drop*: Honeypot submissions are discarded, but the API still returns a `200 OK` (or `202 Accepted`) to avoid giving feedback to the bot.

- **Heuristic Content Checks (Layer 2 Spam Filter):**
  - Submissions are scanned for suspicious patterns:
    - **Excessive URLs:** Any field containing more than 3 `http/https` links is flagged.
    - **All-Caps Text:** Fields where >80% of alphabetical characters are uppercase are flagged.
    - **Keyword Matching:** Regex matching against a pre-compiled list of known spam keywords (e.g., "casino", "viagra", "crypto earn").

### 2.2 Payload Validation & Memory Protection
Every API boundary strictly validates input using Zod schemas.

- **Global Body Size Limit:** Express is configured with a `100KB` JSON body limit (`express.json({ limit: '100kb' })`). Oversized requests are rejected before any business logic runs.
- **Strict Field Boundaries:** Public submission payloads are further capped at the schema level. The `data` object is limited to a maximum of 50 keys, and every individual field value is validated/truncated to a maximum of 1,000 characters.
- This prevents memory exhaustion attacks (e.g., someone submitting a 50MB string in a form field).

### 2.3 Tenant Isolation & Authentication
The Admin API is strictly separated from the Public API.

- **Stateless Authentication (JWT):** 
  - Admin authentication relies on signed JSON Web Tokens (`HS256`) via the `jsonwebtoken` library.
  - Tokens encode the `tenantId`.
- **Password Hashing:** Passwords are hashed with `bcryptjs` (12 salt rounds) before storage. Raw passwords are never persisted.
- **IP Privacy (Hashing):** The visitor's raw IP address is never stored. A SHA-256 hash of the IP is stored (`ipHash`) — sufficient for rate-limiting but non-reversible, preserving visitor privacy.
- **Database-Level Isolation:** 
  - Every Prisma database query in the Admin routes explicitly enforces a `where: { tenantId: req.tenantId }` clause. 
  - Even if an attacker guesses a `widgetId` or `submissionId` belonging to another tenant, the API will return a 404/403, preventing IDOR (Insecure Direct Object Reference) vulnerabilities.

### 2.4 CORS Strategy
Cross-Origin Resource Sharing (CORS) is configured explicitly based on the endpoint type.

- **Public API (`/widgets/:id/config`, `/submissions`):**
  - Allowed Origin: `*` (Wildcard). Because the widget is designed to be embedded on any customer site, a strict allowlist is impractical. 
  - **No Credentials:** `credentials: true` is strictly disabled. No cookies or auth headers are processed on public routes, neutralizing CSRF attacks.
  - Preflight caching (`max-age: 600`) is enforced to reduce `OPTIONS` round-trips.
  - A `Vary: Origin` header is set on the config endpoint to ensure CDNs serve correct CORS headers per origin.

- **Admin API (`/api/*`):**
  - CORS is **not** applied to admin routes. These endpoints are consumed by the operator's dashboard (same origin or via server-side calls), not by embedded widgets on external sites.

### 2.5 Resilient Asynchronous Processing
- **Decoupled Side Effects:** Third-party enrichment (Geo IP) and side effects (Webhooks, Emails) are processed asynchronously using fire-and-forget `Promise` chains. Errors are caught and logged but never propagated to the client.
- **Upstash Redis (HTTP-based):** The rate limiter uses `@upstash/redis`, an HTTP REST client. This means no persistent TCP connection is required, making it compatible with serverless and edge environments.
- **Fail-Open Rate Limiter:** If Redis is unreachable, the rate limiter fails open (allows the request) so legitimate leads are not lost during infrastructure degradation.
- Even if a malicious user submits payloads that cause an external email provider to crash or rate-limit the platform, the primary submission endpoint is unaffected and will still return a `202 Accepted`.

### 2.6 Frontend Security (Embed Script)
- **Shadow DOM:** The embed script renders the widget UI inside a Shadow DOM. This isolates the widget's CSS and JavaScript from the host page, preventing XSS payloads existing on a compromised host site from easily scraping form inputs.

### 2.7 Data Enrichment & Privacy
- **User-Agent Parsing:** Browser and OS information is extracted from the `User-Agent` header using a lightweight, dependency-free regex parser and stored alongside the submission. No fingerprinting beyond what the browser voluntarily sends is performed.
- **IP-to-Geo Enrichment:** The raw visitor IP is resolved to geographic metadata (country, city, region, lat/lon) via a 3-provider fallback chain (primary → secondary → tertiary → `unknown`). In production these would be real calls to `ipapi.co`, `ipinfo.io`, and `abstractapi.com`; for the capstone they are deterministic mocks controllable via the `MOCK_GEO_PROVIDER_STATUS` environment variable.
