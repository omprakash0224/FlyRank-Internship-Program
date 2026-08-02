# Architecture Documentation

This document provides a detailed overview of the system architecture, components, and data flows for the Embeddable Widget & Lead-Capture Platform.

## 1. System Overview

The system is designed to provide isolated tenant configuration while exposing a highly resilient, public-facing endpoint for capturing data from external web properties. 

```mermaid
flowchart TD
    %% Actors
    owner["Widget Owner"]
    visitor["Web Visitor"]
    
    %% External Systems
    subgraph External["External Services"]
        geoProvider["Geo Providers\n(IP to Location)"]
        emailProvider["Email Service\n(Notifications)"]
    end
    
    customerSite["Customer Website\n(External site hosting widget)"]
    
    %% Core System
    platform(("Lead-Capture Platform\n(Serves config & captures submissions)"))
    
    %% Relationships
    owner -->|"Manages configs & views data"| platform
    visitor -->|"Visits & interacts"| customerSite
    customerSite -->|"Fetches config & sends submissions"| platform
    platform -->|"Enriches data"| geoProvider
    platform -->|"Fires side effects"| emailProvider
    
    classDef actor fill:#f9f,stroke:#333,stroke-width:2px,color:#000;
    classDef system fill:#bbf,stroke:#333,stroke-width:2px,color:#000;
    classDef extSystem fill:#bfb,stroke:#333,stroke-width:2px,color:#000;
    
    class owner,visitor actor;
    class platform system;
    class customerSite,geoProvider,emailProvider extSystem;
```

## 2. Component Architecture

The backend is built with Express (Node.js) and splits into two logical boundaries: the **Admin API** and the **Public API**.

```mermaid
flowchart TD
    subgraph Platform["Lead-Capture Platform"]
        adminApi["Admin API (Express)\nHandles auth, CRUD, stats"]
        publicApi["Public API (Express)\nConfig & submissions (CORS)"]
        embedScript["Embed Script (Vanilla JS)\nInjected into external sites"]
        
        postgres[("PostgreSQL on Neon (Prisma)\nTenants, Widgets, Submissions")]
        redis[("Redis on Upstash (@upstash/redis)\nRate limiting, cache, queues")]
        
        bgWorkers["Background Workers (Node.js)\nFire-and-forget enrichment & side effects"]
    end
    
    adminApi <-->|"Reads/Writes"| postgres
    publicApi -->|"Reads Config\nWrites Submissions"| postgres
    publicApi <-->|"Rate limits & queues jobs"| redis
    bgWorkers <-->|"Pulls jobs"| redis
    embedScript <-->|"Communicates with"| publicApi
    
    classDef api fill:#f96,stroke:#333,stroke-width:2px,color:#000;
    classDef db fill:#69b,stroke:#333,stroke-width:2px,color:#fff;
    classDef worker fill:#9cf,stroke:#333,stroke-width:2px,color:#000;
    classDef script fill:#cf9,stroke:#333,stroke-width:2px,color:#000;
    
    class adminApi,publicApi api;
    class postgres,redis db;
    class bgWorkers worker;
    class embedScript script;
```

## 3. Data Flows

### 3.1 Embed Script Initialization

When a visitor loads a page on the customer's site, the embed script fetches the widget configuration.

```mermaid
sequenceDiagram
    participant Visitor as Visitor Browser
    participant Script as widget.js
    participant API as Public API
    participant Cache as Redis Cache
    participant DB as PostgreSQL
    
    Visitor->>Script: Page Load
    Script->>API: GET /widgets/:id/config
    API->>Cache: Check Config Cache
    alt Cache Hit
        Cache-->>API: Return Cached Config
    else Cache Miss
        API->>DB: Query Widget by ID
        DB-->>API: Return Widget Config
        API->>Cache: Set Cache (TTL)
    end
    API-->>Script: Config Response (with ETag/Cache-Control)
    Script->>Visitor: Render Widget UI (Shadow DOM)
```

### 3.2 Submission Processing

When a form is submitted, the payload undergoes rigorous validation and asynchronous processing.

```mermaid
sequenceDiagram
    participant Script as widget.js
    participant API as Public API
    participant Redis as Rate Limiter (Redis)
    participant Geo as Enrichment Service
    participant DB as PostgreSQL
    participant Queue as Side-Effect Queue
    
    Script->>API: POST /submissions
    
    API->>Redis: Check Rate Limit (IP/Widget)
    alt Rate Limit Exceeded
        Redis-->>API: Blocked
        API-->>Script: 429 Too Many Requests
    else Allowed
        API->>API: Validate Payload & Spam Check
        
        par Async Enrichment
            API->>Geo: Resolve IP (Provider 1)
            alt Provider 1 Fails
                API->>Geo: Resolve IP (Provider 2)
            end
        end
        
        API->>DB: Store Submission (PENDING -> ENRICHED)
        DB-->>API: Saved
        
        API->>Queue: Enqueue Webhook/Email
        
        API-->>Script: 202 Accepted (Success)
    end
```

### 3.3 Data Enrichment Fallback

To ensure resilience, the IP-to-geo enrichment uses a fallback chain. If the primary provider fails, it seamlessly degrades to secondary options without blocking the main thread.

```mermaid
flowchart TD
    Start((Start Enrichment)) --> P1[Primary Geo Provider]
    P1 -- Success --> Done((Return Geo Data))
    P1 -- Timeout/Error --> P2[Secondary Geo Provider]
    P2 -- Success --> Done
    P2 -- Timeout/Error --> P3[Tertiary Geo Provider]
    P3 -- Success --> Done
    P3 -- Timeout/Error --> Default[Return Unknown Geo]
    Default --> Done
```

## 4. Database Schema

The core relational model ensures tenant data isolation.

```mermaid
erDiagram
    TENANT ||--o{ WIDGET : "manages"
    TENANT ||--o{ SUBMISSION : "owns"
    WIDGET ||--o{ SUBMISSION : "receives"
    
    TENANT {
        string id PK
        string name
        string email "Unique"
        string passwordHash
        string apiKey "Unique, auto-generated"
        datetime createdAt
        datetime updatedAt
    }
    
    WIDGET {
        string id PK
        string tenantId FK
        string name
        string type "POPOVER, SIGNUP_FORM, CTA"
        json config
        int version
        boolean isActive
        datetime createdAt
        datetime updatedAt
    }
    
    SUBMISSION {
        string id PK
        string widgetId FK
        string tenantId FK
        json data
        json enriched "nullable"
        string ipHash "SHA-256 of visitor IP"
        string userAgent "nullable"
        string referrer "nullable"
        string status "PENDING, ENRICHED, STORED, FAILED"
        datetime createdAt
    }
```

## 5. Security & Isolation

- **Tenant Isolation:** All Admin API routes and database queries enforce `tenantId` boundaries.
- **DDoS/Abuse Protection:** Redis token-bucket rate limiting based on IP and Widget combination.
- **Spam Control:** Hidden honeypot fields on the frontend; if filled, submissions are silently discarded.
- **XSS Protection:** The embed script renders inside a Shadow DOM to isolate styles and prevent script injection collisions on the host site.
