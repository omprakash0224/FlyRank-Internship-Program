# Embeddable Widget & Lead-Capture Platform — Implementation Plan

**Capstone Project — Backend AI Engineering Track**  
**Timeline:** 9 weeks (32 hours total)  
**Status:** Planning Phase

---

## 1. Project Overview

### 1.1 Problem Statement
Build a platform that allows customers to define embeddable widgets (popovers, signup forms, CTAs), generate a one-line `<script>` snippet, deploy it on any external website, and capture/process submissions with enrichment, spam filtering, and dashboarding.

### 1.2 Core Value Proposition
- **Zero-trust public endpoints** — Hardened against abuse (CORS, validation, rate limiting, spam controls)
- **CDN-grade config delivery** — Fast, cached, cross-origin asset serving with versioned bundles
- **Graceful degradation** — Side effects (email/webhook) never block submissions
- **Resilient enrichment** — Provider fallback chain for IP→geo that survives upstream failures

### 1.3 Target Users
- **Widget Owners** (authenticated): Create/manage widgets, view dashboard with submissions + stats
- **End Visitors** (unauthenticated): Interact with widgets on customer sites, submit forms
- **Customer Sites** (external origins): Host the embed script — no control assumed

### 1.4 Success Criteria (Definition of Done)
- ✅ Admin API: CRUD widgets, generate embed snippets (tenant-isolated)
- ✅ Config Delivery: Public endpoint with cache headers, CORS, minimal payload
- ✅ Submission Endpoint: CORS-correct, boundary validation, honest status codes
- ✅ Enrichment: IP→geo with 3-provider fallback chain
- ✅ Abuse Resistance: Rate limiting per IP/widget + ≥1 spam control
- ✅ Safe Side Effects: Email/webhook failures don't fail submissions
- ✅ Tests: CORS preflight, validation, rate limiting, enrichment fallback
- ✅ README + Architecture Diagram

---

## 2. Tech Stack

> **Note on Cost:** The entire tech stack relies on open-source tools and frameworks. Since external services (like Geo and Email providers) are explicitly mocked for this capstone project, **the stack is completely free to develop and run locally.**

### 2.1 Core Framework
| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Runtime** | Node.js 20+ (JavaScript) | Wide ecosystem, mature runtime |
| **API Framework** | Express | Mature, reliable, industry standard for Node.js |
| **Database** | PostgreSQL (via Prisma ORM) | Relational data, tenant isolation, migrations |
| **Cache** | Redis (ioredis) | Rate limiting, config caching, session store |
| **Auth** | JWT (HS256) + bcrypt | Stateless, simple, tenant-scoped tokens |

### 2.2 Infrastructure
| Component | Choice | Notes |
|-----------|--------|-------|
| **Containerization** | Docker + Docker Compose | Local dev parity, easy deployment |
| **Reverse Proxy** | Nginx (dev) / Cloudflare (prod) | TLS termination, CORS headers |
| **Observability** | Pino (logs) + Prometheus metrics | Structured logging, /metrics endpoint |
| **Testing** | Vitest + Supertest | Fast, JavaScript-native, good mocking |

### 2.3 External Dependencies (Mocked for Capstone)
| Service | Purpose | Fallback Strategy |
|---------|---------|-------------------|
| **Geo Provider 1** | Primary IP→geo (e.g., ipapi.co) | Mock: returns data |
| **Geo Provider 2** | Secondary IP→geo (e.g., ipinfo.io) | Mock: toggle "down" |
| **Geo Provider 3** | Tertiary IP→geo (e.g., abstractapi) | Mock: always works |
| **Email** | Confirmation emails (Resend/SendGrid) | Mock: fire-and-forget |
| **Webhook** | Owner notifications | Mock: fire-and-forget with retry queue |

---

## 3. Architecture

### 3.1 High-Level Data Flow
```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Owner     │────▶│  Admin API   │────▶│  Widget Config  │
│ (authed)    │     │  (tenant)    │     │  (PostgreSQL)   │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                    ┌──────────────────────────────┘
                    ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Customer   │────▶│  Embed Script │────▶│ GET /widgets/   │
│   Site      │     │  (CDN/Static) │     │ :id/config      │
│ (external)  │     │  widget.js    │     │ (cached, CORS)  │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                    ┌──────────────────────────────┘
                    ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Visitor    │────▶│  Widget UI   │────▶│ POST /submissions│
│  Submits    │     │  (form)      │     │ (validate,      │
└─────────────┘     └──────────────┘     │  enrich, store) │
                                          └────────┬────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────┐
                    ▼                              ▼              ▼
           ┌─────────────────┐           ┌─────────────────┐ ┌────────────┐
           │  Enrichment     │           │  Rate Limit /   │ │ Safe Side  │
           │  (IP→geo,       │           │  Spam Filter    │ │ Effects    │
           │   fallback)     │           │  (Redis)        │ │ (email/    │
           └─────────────────┘           └─────────────────┘ │  webhook)  │
                                                                └────────────┘
```

### 3.2 Database Schema (Prisma)
```prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  apiKey    String   @unique
  widgets   Widget[]
  submissions Submission[]
  createdAt DateTime @default(now())
}

model Widget {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  name        String
  type        WidgetType // POPOVER, SIGNUP_FORM, CTA
  config      Json     // fields, copy, targeting, styling
  version     Int      @default(1) // for cache busting
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Submission {
  id          String   @id @default(cuid())
  widgetId    String
  widget      Widget   @relation(fields: [widgetId], references: [id])
  tenantId    String
  data        Json     // submitted form data
  enriched    Json?    // geo, ua, etc.
  ipHash      String   // hashed IP for rate limiting
  userAgent   String?
  referrer    String?
  status      SubmissionStatus @default(PENDING)
  createdAt   DateTime @default(now())
}

enum WidgetType { POPOVER, SIGNUP_FORM, CTA }
enum SubmissionStatus { PENDING, ENRICHED, STORED, FAILED }
```

### 3.3 API Surface

#### Admin API (Authenticated, Tenant-Scoped)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/widgets` | Create widget |
| GET | `/api/widgets` | List widgets (paginated) |
| GET | `/api/widgets/:id` | Get widget details |
| PATCH | `/api/widgets/:id` | Update widget (bumps version) |
| DELETE | `/api/widgets/:id` | Soft delete widget |
| POST | `/api/widgets/:id/snippet` | Generate embed snippet |

#### Public API (Unauthenticated, CORS-Enabled)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/widgets/:id/config` | Widget config (cached, versioned) |
| POST | `/submissions` | Submit form data |
| OPTIONS | `/submissions` | CORS preflight |

#### Dashboard API (Authenticated)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/stats` | Aggregate stats |
| GET | `/api/dashboard/submissions` | Paginated submissions |
| GET | `/api/dashboard/submissions/:id` | Submission detail |

### 3.4 Directory Structure
```text
.
├── src/
│   ├── index.js           # Entry point
│   ├── routes/            # API route definitions
│   │   ├── admin/         # Admin API routes
│   │   └── public/        # Public-facing API routes
│   ├── services/          # Business logic and external integrations
│   ├── repositories/      # Database access (Prisma)
│   ├── middleware/        # Auth, CORS, tenant isolation, etc.
│   ├── validation/        # Zod schemas for input validation
│   ├── lib/               # Utilities (rate-limiter, side-effects, spam)
│   └── utils/             # Helpers (logger, error handling)
├── prisma/
│   └── schema.prisma      # Database Schema
├── public/
│   ├── widget.js          # Embed script (compiled)
│   └── dashboard.html     # Owner dashboard UI
├── tests/                 # Unit, Integration, and E2E tests
├── demo/
│   └── customer-site.html # Demo integration site
├── scripts/
│   └── build.js           # Build scripts for the widget snippet
├── docker-compose.yml     # Local infrastructure (Postgres, Redis)
├── package.json           # Project dependencies and scripts
└── README.md              # Project documentation
```

---

## 4. Implementation Roadmap

### Milestone 1: Foundation (Week 3) — Design & Setup
**Target: 8 hours**

| Task | Description | Deliverable |
|------|-------------|-------------|
| M1.1 | Initialize repo: JavaScript, ESLint, Prettier, Vitest | `package.json`, config files |
| M1.2 | Docker Compose: Postgres, Redis, App | `docker-compose.yml` |
| M1.3 | Prisma schema + migrations | `prisma/schema.prisma` |
| M1.4 | Auth middleware: JWT issuance/validation | `src/middleware/auth.js` |
| M1.5 | Tenant isolation middleware | `src/middleware/tenant.js` |
| M1.6 | Base error handling & logging | `src/utils/errors.js`, `logger.js` |
| M1.7 | Health check endpoint | `GET /health` |

**Exit Criteria:** `docker compose up` runs all services; health check passes; auth middleware rejects invalid tokens.

---

### Milestone 2: Admin API & Widget CRUD (Week 5) — Core Backend
**Target: 8 hours**

| Task | Description | Deliverable |
|------|-------------|-------------|
| M2.1 | Widget repository (Prisma) | `src/repositories/widget.js` |
| M2.2 | Widget service (business logic) | `src/services/widget.js` |
| M2.3 | Admin routes: CRUD + snippet generation | `src/routes/admin/widgets.js` |
| M2.4 | Input validation (Zod schemas) | `src/validation/widget.js` |
| M2.5 | Version bumping on update (cache busting) | Integrated in service |
| M2.6 | Unit tests: widget CRUD, auth, validation | `tests/admin/` |

**Exit Criteria:** Owner can create widget → get snippet → update → delete; all tenant-isolated.

---

### Milestone 3: Public Submission Endpoint (Week 6) — Hardened Public API
**Target: 8 hours**

| Task | Description | Deliverable |
|------|-------------|-------------|
| M3.1 | CORS middleware (configurable origins) | `src/middleware/cors.js` |
| M3.2 | Submission validation (Zod, strict) | `src/validation/submission.js` |
| M3.3 | Rate limiter: per IP + per widget (Redis) | `src/lib/rate-limiter.js` |
| M3.4 | Spam control: honeypot field + heuristic | `src/lib/spam-filter.js` |
| M3.5 | Enrichment service: 3-provider fallback chain | `src/services/enrichment.js` |
| M3.6 | Submission repository + service | `src/services/submission.js` |
| M3.7 | Public routes: config + submissions | `src/routes/public/` |
| M3.8 | Safe side effects: email/webhook queue (fire-and-forget) | `src/lib/side-effects.js` |
| M3.9 | Integration tests: CORS, validation, rate limit, fallback | `tests/public/` |

**Exit Criteria:** 
- CORS preflight works from any origin
- Malformed/oversized payloads rejected (400)
- Rate limiter triggers at threshold (429)
- Enrichment falls back when provider 1 is "down"
- Email/webhook failure doesn't fail submission (202)

---

### Milestone 4: Config Delivery & Embed Script (Week 8) — Frontend Integration
**Target: 5 hours**

| Task | Description | Deliverable |
|------|-------------|-------------|
| M4.1 | Config endpoint: ETag, Cache-Control, versioned | `GET /widgets/:id/config` |
| M4.2 | Embed script: `widget.js` (vanilla JS, no deps) | `public/widget.js` |
| M4.3 | Script renders widget from config (minimal UI) | Form in shadow DOM |
| M4.4 | Customer site demo page (different origin/port) | `demo/customer-site.html` |
| M4.5 | Build script: minify, version, hash | `scripts/build.js` |
| M4.6 | E2E test: script loads, renders, submits, appears in dashboard | `tests/e2e/` |

**Exit Criteria:** Open `customer-site.html` → widget appears → submit → lands in dashboard with geo.

---

### Milestone 5: Dashboard & Polish (Week 8-9) — Owner Experience
**Target: 3 hours**

| Task | Description | Deliverable |
|------|-------------|-------------|
| M5.1 | Dashboard routes: stats + submissions list | `src/routes/admin/dashboard.js` |
| M5.2 | Dashboard UI (simple HTML/HTMX or React) | `public/dashboard.html` |
| M5.3 | Real-time updates (SSE stretch) | Optional |
| M5.4 | README + architecture diagram | `README.md`, `ARCHITECTURE.md` |
| M5.5 | Final test run + demo script | `demo.sh` |

---

## 5. Detailed Technical Design

### 5.1 Embed Script (`widget.js`)
```javascript
// ~2KB gzipped, vanilla JavaScript compiled to ES2020
// Flow:
// 1. Read data-widget-id from script tag
// 2. Fetch /widgets/:id/config (with cache busting via version)
// 3. Render widget in Shadow DOM (style isolation)
// 4. Handle form submit → POST /submissions
// 5. Show success/error toast
```

**Config Response:**
```json
{
  "id": "wgt_abc123",
  "version": 3,
  "type": "SIGNUP_FORM",
  "fields": [
    { "name": "email", "type": "email", "required": true, "label": "Email" },
    { "name": "name", "type": "text", "required": false, "label": "Name" }
  ],
  "copy": {
    "title": "Stay Updated",
    "button": "Subscribe",
    "success": "Thanks for subscribing!"
  },
  "styling": { "theme": "light", "primaryColor": "#3b82f6" }
}
```

### 5.2 Enrichment Fallback Chain
```javascript
// providers in priority order
const PROVIDERS = [
  { name: 'primary', fn: enrichWithProvider1, timeout: 2000 },
  { name: 'secondary', fn: enrichWithProvider2, timeout: 2000 },
  { name: 'tertiary', fn: enrichWithProvider3, timeout: 3000 },
];

async function enrich(ip: string): Promise<GeoData> {
  for (const provider of PROVIDERS) {
    try {
      const result = await Promise.race([
        provider.fn(ip),
        timeout(provider.timeout)
      ]);
      if (result) return { ...result, provider: provider.name };
    } catch (e) {
      log.warn({ provider: provider.name, error: e }, 'Enrichment failed, trying next');
    }
  }
  return { country: 'unknown', provider: 'none' }; // graceful degradation
}
```

### 5.3 Rate Limiting (Redis)
```javascript
// Key: `ratelimit:{widgetId}:{ipHash}` 
// Sliding window: 10 requests/minute per IP per widget
// Burst allowance: 20 requests (token bucket)
```

### 5.4 Spam Control
1. **Honeypot:** Hidden field `website` — if filled, reject silently (200 OK, no store)
2. **Heuristic:** Check for suspicious patterns (all caps, excessive links, known spam words)
3. **Optional Stretch:** Proof-of-work challenge for repeat offenders

### 5.5 Safe Side Effects
```javascript
// Fire-and-forget with retry queue (Redis list + background worker)
async function triggerSideEffects(submission: Submission) {
  const payload = { submissionId: submission.id, ... };
  
  // Email confirmation
  emailQueue.push(payload).catch(log.error);
  
  // Webhook to owner
  webhookQueue.push(payload).catch(log.error);
  
  // Never await — response already sent
}
```

---

## 6. Testing Strategy

### 6.1 Test Pyramid
| Level | Tools | Coverage Target |
|-------|-------|-----------------|
| **Unit** | Vitest | 80%+ (services, utils, validation) |
| **Integration** | Vitest + Supertest + Testcontainers | All API routes |
| **E2E** | Playwright (headless) | Critical path: embed → submit → dashboard |

### 6.2 Required Test Cases (per Definition of Done)
| Test | Description |
|------|-------------|
| `CORS preflight` | OPTIONS /submissions returns correct headers |
| `Validation rejects` | Missing fields, wrong types, oversized body (>100KB) |
| `Rate limiter` | 11th request in minute returns 429 |
| `Spam honeypot` | Filled honeypot returns 200 but doesn't store |
| `Enrichment fallback` | Provider 1 down → provider 2 returns data |
| `Side effect failure` | Email throws → submission still returns 202 |
| `Cache headers` | Config response has ETag, Cache-Control: public, max-age=300 |
| `Tenant isolation` | Tenant A cannot read Tenant B's widgets |

### 6.3 Mock Strategy
- **Geo providers:** Controlled via env var `MOCK_GEO_PROVIDER_STATUS=primary:up,secondary:down,tertiary:up`
- **Email/Webhook:** In-memory queue; tests assert enqueue calls, not delivery

---

## 7. Security Considerations

| Threat | Mitigation |
|--------|------------|
| **XSS in widget** | Shadow DOM, CSP on config endpoint, sanitize all user input |
| **CSRF** | SameSite=Lax cookies not used; stateless JWT in Authorization header |
| **CORS misconfiguration** | Explicit allowlist per widget; no wildcard with credentials |
| **Injection** | Prisma parameterized queries; Zod validation at boundary |
| **DDoS/Abuse** | Rate limiting (IP + widget), request size limits (100KB), Redis-backed |
| **Data leakage** | Tenant isolation at DB + middleware level; API keys scoped |
| **Secrets** | Env vars only; no secrets in code; Docker secrets in prod |

---

## 8. Deliverables Checklist

### Code Artifacts
- [ ] `src/` — Full backend implementation
- [ ] `public/widget.js` — Embed script (built)
- [ ] `public/dashboard.html` — Owner dashboard
- [ ] `demo/customer-site.html` — Demo customer site
- [ ] `prisma/schema.prisma` — Database schema
- [ ] `docker-compose.yml` — Local dev stack
- [ ] `scripts/build.js` — Build pipeline
- [ ] `tests/` — Unit, integration, E2E tests

### Documentation
- [ ] `README.md` — Setup, run, demo, architecture overview
- [ ] `ARCHITECTURE.md` — Detailed diagram + data flows
- [ ] `API.md` — OpenAPI spec or route documentation
- [ ] `SECURITY.md` — Threat model + mitigations

### Demo Script
```bash
# 1. Start stack
docker compose up -d

# 2. Create tenant + widget (via API)
curl -X POST localhost:3000/api/widgets ...

# 3. Open demo/customer-site.html in browser (different port)
# 4. Submit form
# 5. Check dashboard for enriched submission
# 6. Run attack script: rate limit, spam, bad payloads
```

---

## 9. Risk Register & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Enrichment providers unreliable | High | Medium | Mock providers for deterministic tests; short timeouts |
| CORS complexity across origins | Medium | High | Test with `file://` origin + separate port early |
| Rate limiter false positives | Low | Medium | Per-widget + per-IP keys; configurable thresholds |
| Shadow DOM styling conflicts | Medium | Low | CSS custom properties; minimal reset |
| Time overrun on polish | High | Medium | Strict milestone gates; stretch goals clearly separated |

---

## 10. Stretch Goals (Post-Capstone)

| Goal | Effort | Value |
|------|--------|-------|
| Real CDN build (minified, versioned, hashed) | 4h | Production-grade asset delivery |
| Real-time dashboard (SSE/WebSocket) | 3h | Live submission updates |
| A/B targeting rules (URL, delay, frequency) | 5h | Advanced widget control |
| Double opt-in + GDPR (consent, export/delete) | 4h | Compliance readiness |
| Bot defense (PoW/CAPTCHA) | 6h | Spam reduction measurement |

---

## 11. Week-by-Week Summary

| Week | Focus | Hours | Key Deliverable |
|------|-------|-------|-----------------|
| 3 | Design, Setup, Auth | 8 | Running stack, auth, schema |
| 5 | Admin API, Widget CRUD | 8 | Full widget lifecycle |
| 6 | Public API, Hardening | 8 | Hardened submission endpoint |
| 8 | Config Delivery, Embed, Dashboard | 8 | Working demo end-to-end |
| 9 | Polish, Tests, Docs | 4 | README, diagram, demo script |

**Total: 36 hours (4 buffer for integration issues)**

---

## 12. Next Steps

1. **Initialize repository** with JavaScript, Docker, Prisma
2. **Implement Milestone 1** — Foundation
3. **Review plan** with stakeholder before Week 3 checkpoint
4. **Begin Milestone 2** — Admin API

---

*Generated: 2026-07-18*  
*Project: Embeddable Widget & Lead-Capture Platform*  
*Track: Backend AI Engineering Capstone*