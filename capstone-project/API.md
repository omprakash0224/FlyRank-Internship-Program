# API Reference

This document outlines the API endpoints available in the **Embeddable Widget & Lead-Capture Platform**. The API is divided into three main sections:
1. **Public API**: Unauthenticated endpoints for serving configurations and capturing submissions.
2. **Admin API (Widgets)**: Authenticated endpoints for widget management.
3. **Admin API (Dashboard & Auth)**: Authenticated endpoints for viewing stats and managing authentication.

All authenticated endpoints require a Bearer token: `Authorization: Bearer <JWT>`.

---

## 1. Public API
These endpoints are CORS-enabled and designed to be called directly from external websites hosting the widget.

### `GET /widgets/:id/config`
Fetches the public configuration payload for a widget.

- **Auth Required**: No
- **Headers**:
  - `Cache-Control`: `public, max-age=300`
  - `ETag`: `"v{version}"` (supports conditional GET — returns `304 Not Modified` if `If-None-Match` matches)
  - `Vary`: `Origin` (required for correct CDN behaviour when CORS is active)
- **Response (200 OK)**:
  ```json
  {
    "id": "wgt_12345",
    "version": 2,
    "type": "SIGNUP_FORM",
    "fields": [
      {
        "name": "email",
        "type": "email",
        "label": "Email",
        "required": true
      }
    ],
    "copy": {
      "button": "Submit",
      "success": "Thank you!"
    },
    "styling": {
      "theme": "light",
      "primaryColor": "#3b82f6"
    }
  }
  ```
- **Response (304 Not Modified)**: Returned when the client sends a matching `If-None-Match` header (body is empty).
- **Response (404 Not Found)**: Widget does not exist or is inactive.

### `POST /submissions`
Submit form data from the embedded widget. Processing and enrichment occur asynchronously.

- **Auth Required**: No
- **Body Schema (JSON)**:
  - `widgetId` (string, required): The ID of the widget.
  - `data` (object, required): Key-value pairs of form fields (max 50 fields, string values up to 1000 chars).
  - `website` (string, optional): Honeypot field for spam detection. If filled, the submission is silently ignored.
  - `referrer` (string, optional): The URL the form was submitted from.
- **Response (202 Accepted)**:
  ```json
  {
    "message": "Submission received and is being processed",
    "submissionId": "sub_98765"
  }
  ```
- **Response (200 OK — spam)**: Honeypot or heuristic spam detected. The body is intentionally similar to prevent bots from adapting:
  ```json
  { "message": "Submission received" }
  ```
- **Response (429 Too Many Requests)**: Rate limit exceeded for this IP + widget combination.
- **Response (404 Not Found)**: Widget does not exist or is inactive.
- **Note on Geo Enrichment**: The API asynchronously resolves the visitor's IP using a chain of real external providers (`ipwho.is`, `ipapi.co`, `freeipapi.com`). If a private or loopback IP is detected (e.g., from `localhost`), the lookup is short-circuited and returns `{ "country": "private", "provider": "local" }`.

---

## 2. Admin API (Auth)

### `POST /api/auth/login`
Exchange credentials for a signed JWT token.

- **Body Schema**:
  Requires **either**:
  - `{ "email": "user@example.com", "password": "password123" }`
  - OR `{ "apiKey": "tenant-api-key" }`
- **Response (200 OK)**:
  ```json
  {
    "data": {
      "token": "eyJhbGci...",
      "tenant": {
        "id": "tnt_abc",
        "name": "Acme Corp",
        "email": "user@example.com"
      }
    }
  }
  ```

### `POST /api/auth/register`
Register a new tenant account.

- **Body Schema**:
  - `name` (string, required)
  - `email` (string, required)
  - `password` (string, required, min 8 chars)
- **Response (201 Created)**: Returns the same payload as `/login`.

---

## 3. Admin API (Widgets)

Base Path: `/api/widgets`
*All endpoints require authentication.*

### `POST /api/widgets`
Create a new widget.

- **Body Schema**:
  - `name` (string, required): Max 100 chars.
  - `type` (string, required): `POPOVER`, `SIGNUP_FORM`, or `CTA`.
  - `config` (object, required):
    - `fields` (array): List of field objects (name, type, label, etc).
    - `copy` (object, optional): Title, subtitle, button text, success text.
    - `styling` (object, optional): Theme and colors.
    - `targeting` (object, optional): Display rules (delay, scroll percent).
- **Response (201 Created)**: Returns the complete created widget object.

### `GET /api/widgets`
List widgets with pagination.

- **Query Params**:
  - `page` (number, default: 1)
  - `limit` (number, default: 20, max: 100)
- **Response (200 OK)**:
  ```json
  {
    "data": [ ...widgets... ],
    "meta": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
  ```

### `GET /api/widgets/:id`
Get a single widget by ID.

### `PATCH /api/widgets/:id`
Partially update a widget. Any update automatically increments the widget's `version` for cache busting.
- **Body Schema**: Same fields as `POST`, but all are optional.

### `DELETE /api/widgets/:id`
Soft-delete a widget (sets `isActive = false`).
- **Response (204 No Content)**

### `POST /api/widgets/:id/snippet`
Generate the one-line HTML embed snippet for this widget.
- **Response (200 OK)**:
  ```json
  {
    "data": {
      "snippet": "<script src=\"https://cdn.example.com/widget.js\" data-widget-id=\"wgt_123\"></script>",
      "widgetId": "wgt_123",
      "version": 2
    }
  }
  ```

---

## 4. Admin API (Dashboard)

Base Path: `/api/dashboard`
*All endpoints require authentication.*

### `GET /api/dashboard/stats`
Get aggregate statistics.
- **Response (200 OK)**: Returns total submissions, today's submissions, widget counts, and status breakdowns.

### `GET /api/dashboard/submissions`
Paginated list of form submissions.
- **Query Params**: `page`, `limit`, `widgetId` (optional filter).

### `GET /api/dashboard/submissions/:id`
Get detailed data for a single submission, including enriched Geo data.

### `GET /api/dashboard/submissions/stream`
Server-Sent Events (SSE) endpoint for real-time submission updates.

> [!NOTE]
> Because `EventSource` cannot send custom headers, this endpoint also accepts the JWT via a `?token=` query parameter as a fallback for browser clients.

- **Protocol**:
  - `event: connected` — Sent immediately on connection with `{ connectedAt }` timestamp.
  - `event: ping` — Keep-alive sent every 15s with `{ ts }` (Unix ms).
  - `event: new-submission` — Emitted with `{ submissions: [...] }` whenever new submissions are detected (polled every 3s internally).

---

## 5. System Health

### `GET /health`
Publicly accessible status check used for load balancers and monitoring.
- **Response (200 OK)**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-08-02T10:00:00.000Z",
    "version": "0.1.0",
    "uptime": 3600,
    "latencyMs": 15,
    "dependencies": {
      "database": "ok",
      "redis": "ok"
    }
  }
  ```
  *(Returns 503 if any dependency is down)*
