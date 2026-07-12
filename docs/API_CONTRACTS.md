# Blue Arc OS — API Contracts

> Version: 1.0.0
> Last updated: 2026-07-07
> Status: Design phase
> Implementation note: This is a design-phase document and may lead or lag the code. See [MILESTONE_REPORT.md](../MILESTONE_REPORT.md) and `src/app/api/` for the routes actually implemented.
> Companion documents: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) · [DATABASE.md](./DATABASE.md)

---

## Table of Contents

1. [API Overview](#1-api-overview)
2. [Authentication Endpoints](#2-authentication-endpoints)
3. [Core Domain Endpoints](#3-core-domain-endpoints)
4. [Request/Response Examples](#4-requestresponse-examples)
5. [Filtering and Sorting](#5-filtering-and-sorting)
6. [Webhook Endpoints](#6-webhook-endpoints)
7. [AI Endpoints](#7-ai-endpoints)
8. [Error Handling](#8-error-handling)

---

## 1. API Overview

### 1.1 Base URL

| Environment | Base URL                                      |
|-------------|-----------------------------------------------|
| Development | `http://localhost:3000/api`                   |
| Preview     | `https://<branch>.bluearc-os.vercel.app/api` |
| Staging     | `https://staging.bluearc-os.com/api`         |
| Production  | `https://app.bluearc-os.com/api`             |

All API routes are implemented as Next.js Route Handlers under `src/app/api/`.

### 1.2 Authentication

All API endpoints (except auth endpoints) require authentication via **Bearer tokens** (JWT).

**Header format:**

```
Authorization: Bearer <access_token>
```

**Token details:**

| Property          | Value                |
|-------------------|----------------------|
| Token type        | JWT (HS256)          |
| Access token TTL  | 15 minutes           |
| Refresh token TTL | 7 days (rotating)    |
| Token payload     | `{ sub, orgId, role, iat, exp }` |

**API key authentication** (for programmatic access):

```
Authorization: Bearer bao_rw_<key>
```

API keys are scoped to an organization and carry a type (`read_only`, `read_write`, `admin`).

### 1.3 Request / Response Format

- All requests and responses use **JSON** (`Content-Type: application/json`).
- All mutations require a request body (JSON).
- All timestamps are **ISO 8601** in UTC (`2026-07-07T12:00:00.000Z`).
- All IDs are **UUIDs** (string).
- Decimal values (`value`, `cost`) are returned as **strings** to avoid floating-point issues.

### 1.4 Standard Response Envelope

**Success (single resource):**

```json
{
  "data": {
    "id": "uuid",
    "name": "Example",
    "createdAt": "2026-07-07T12:00:00.000Z"
  }
}
```

**Success (list):**

```json
{
  "data": [
    { "id": "uuid-1", "name": "First" },
    { "id": "uuid-2", "name": "Second" }
  ],
  "meta": {
    "pagination": {
      "cursor": "eyJpZCI6InV1aWQtMiJ9",
      "hasMore": true,
      "limit": 20
    }
  }
}
```

**Error:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "name", "message": "Name is required" }
    ]
  }
}
```

### 1.5 Pagination Strategy

All list endpoints use **cursor-based pagination**.

| Query param | Type   | Default | Description                                      |
|-------------|--------|---------|--------------------------------------------------|
| `limit`     | number | 20      | Items per page (max 100)                         |
| `cursor`    | string | —       | Opaque cursor from previous response `meta.pagination.cursor` |

The cursor is a **base64-encoded JSON object** containing the sort-field value(s) of the last item on the current page. Clients must treat cursors as opaque strings.

**Pagination meta shape:**

```json
{
  "meta": {
    "pagination": {
      "cursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA3LTA3VDEyOjAwOjAwLjAwMFoiLCJpZCI6InV1aWQifQ==",
      "hasMore": true,
      "limit": 20
    }
  }
}
```

When `hasMore` is `false`, `cursor` is `null`.

### 1.6 Error Codes and HTTP Status Codes

| HTTP Status | Error Code             | Description                                    |
|-------------|------------------------|------------------------------------------------|
| 400         | `VALIDATION_ERROR`     | Request body or query params failed Zod validation |
| 400         | `INVALID_FILTER`       | Invalid filter operator or field name          |
| 401         | `UNAUTHORIZED`         | Missing or invalid auth token                  |
| 401         | `TOKEN_EXPIRED`        | Access token has expired                       |
| 403         | `FORBIDDEN`            | Authenticated but insufficient permissions     |
| 404         | `NOT_FOUND`            | Resource does not exist or is soft-deleted     |
| 409         | `CONFLICT`             | Unique constraint violation (e.g., duplicate email) |
| 422         | `UNPROCESSABLE`        | Semantically invalid request (e.g., invalid state transition) |
| 429         | `RATE_LIMITED`         | Rate limit exceeded                            |
| 500         | `INTERNAL_ERROR`       | Unexpected server error                        |

### 1.7 Common Response Headers

| Header              | Description                                |
|---------------------|--------------------------------------------|
| `X-Request-Id`      | Unique request identifier (UUID)           |
| `X-RateLimit-Limit` | Max requests per window                    |
| `X-RateLimit-Remaining` | Remaining requests in current window   |
| `X-RateLimit-Reset` | Unix timestamp when the window resets      |

---

## 2. Authentication Endpoints

### 2.1 POST /api/auth/register

Register a new user and create their organization.

**Request:**

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "name": "Jane Smith",
  "email": "jane@acme.com",
  "password": "secureP@ss123",
  "organizationName": "Acme Corp",
  "organizationSlug": "acme-corp"
}
```

| Field              | Type   | Required | Validation                          |
|--------------------|--------|----------|-------------------------------------|
| `name`             | string | yes      | 1–100 characters                    |
| `email`            | string | yes      | Valid email, globally unique        |
| `password`         | string | yes      | Min 8 chars, 1 upper, 1 lower, 1 number, 1 special |
| `organizationName` | string | yes      | 1–100 characters                    |
| `organizationSlug` | string | yes      | 3–50 chars, URL-safe, globally unique |

**Response (201):**

```json
{
  "data": {
    "user": {
      "id": "usr_01JABC...",
      "name": "Jane Smith",
      "email": "jane@acme.com",
      "image": null
    },
    "organization": {
      "id": "org_01JABC...",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "plan": "free"
    },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

**Errors:** 400 `VALIDATION_ERROR`, 409 `CONFLICT` (email or slug taken)

---

### 2.2 POST /api/auth/login

Authenticate with email and password.

**Request:**

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "jane@acme.com",
  "password": "secureP@ss123"
}
```

| Field      | Type   | Required |
|------------|--------|----------|
| `email`    | string | yes      |
| `password` | string | yes      |

**Response (200):**

```json
{
  "data": {
    "user": {
      "id": "usr_01JABC...",
      "name": "Jane Smith",
      "email": "jane@acme.com",
      "image": "https://..."
    },
    "organization": {
      "id": "org_01JABC...",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "plan": "pro"
    },
    "role": "owner",
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

**Errors:** 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED` (bad credentials), 429 `RATE_LIMITED` (account locked after 5 failed attempts)

---

### 2.3 POST /api/auth/logout

Revoke the current session.

**Request:**

```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "data": {
    "message": "Logged out successfully"
  }
}
```

**Errors:** 401 `UNAUTHORIZED`

---

### 2.4 POST /api/auth/refresh

Exchange a refresh token for a new access token.

**Request:**

```http
POST /api/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

| Field          | Type   | Required |
|----------------|--------|----------|
| `refreshToken` | string | yes      |

**Response (200):**

```json
{
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
}
```

The old refresh token is invalidated (rotation).

**Errors:** 401 `UNAUTHORIZED` (invalid or expired refresh token)

---

### 2.5 GET /api/auth/me

Get the current authenticated user's profile and org context.

**Request:**

```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Response (200):**

```json
{
  "data": {
    "user": {
      "id": "usr_01JABC...",
      "name": "Jane Smith",
      "email": "jane@acme.com",
      "image": "https://...",
      "lastLoginAt": "2026-07-07T10:00:00.000Z"
    },
    "organization": {
      "id": "org_01JABC...",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "plan": "pro"
    },
    "role": "owner",
    "permissions": [
      "companies:read", "companies:write", "companies:delete",
      "contacts:read", "contacts:write", "contacts:delete",
      "leads:read", "leads:write", "leads:delete",
      "vendors:read", "vendors:write", "vendors:delete",
      "jobs:read", "jobs:write", "jobs:delete",
      "tasks:read", "tasks:write", "tasks:delete",
      "outreach:read", "outreach:write", "outreach:delete",
      "notes:read", "notes:write", "notes:delete",
      "settings:manage", "members:manage", "api_keys:manage"
    ]
  }
}
```

**Errors:** 401 `UNAUTHORIZED`, 401 `TOKEN_EXPIRED`

---

## 3. Core Domain Endpoints

All core domain endpoints follow a consistent CRUD pattern. Each domain is scoped to the authenticated user's `organizationId` (injected server-side from the JWT, never accepted from the client).

### 3.1 Companies

#### GET /api/companies

List companies with pagination, filtering, and sorting.

**Query parameters:**

| Parameter  | Type   | Default     | Description                                      |
|------------|--------|-------------|--------------------------------------------------|
| `limit`    | number | 20          | Items per page (max 100)                         |
| `cursor`   | string | —           | Pagination cursor                                |
| `search`   | string | —           | Full-text search on `name`, `domain`             |
| `status`   | string | —           | Filter: `prospect`, `active`, `churned`          |
| `industry` | string | —           | Filter by industry (exact match)                 |
| `size`     | string | —           | Filter: `startup`, `smb`, `mid`, `enterprise`    |
| `sortBy`   | string | `createdAt` | Sort field: `name`, `createdAt`, `updatedAt`     |
| `sortDir`  | string | `desc`      | Sort direction: `asc`, `desc`                    |

**Response (200):**

```json
{
  "data": [
    {
      "id": "cmp_01JABC...",
      "organizationId": "org_01JABC...",
      "name": "Acme Corp",
      "domain": "acme.com",
      "industry": "Technology",
      "size": "mid",
      "status": "active",
      "website": "https://acme.com",
      "phone": "+1-555-0100",
      "address": {
        "street": "100 Main St",
        "city": "San Francisco",
        "state": "CA",
        "zip": "94105",
        "country": "US"
      },
      "metadata": null,
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-07-01T12:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": {
      "cursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTAxLTE1VDA4OjAwOjAwLjAwMFoiLCJpZCI6ImNtcF8wMUpBQkMifQ==",
      "hasMore": true,
      "limit": 20
    }
  }
}
```

---

#### GET /api/companies/:id

Get a single company by ID.

**Response (200):** Same shape as a single item in the list above.

**Errors:** 404 `NOT_FOUND`

---

#### POST /api/companies

Create a new company.

**Request:**

```json
{
  "name": "Acme Corp",
  "domain": "acme.com",
  "industry": "Technology",
  "size": "mid",
  "status": "prospect",
  "website": "https://acme.com",
  "phone": "+1-555-0100",
  "address": {
    "street": "100 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94105",
    "country": "US"
  },
  "metadata": { "source": "conference" }
}
```

| Field      | Type   | Required | Validation                                |
|------------|--------|----------|-------------------------------------------|
| `name`     | string | yes      | 1–200 characters                          |
| `domain`   | string | no       | Valid domain format                       |
| `industry` | string | no       | 1–100 characters                          |
| `size`     | enum   | no       | `startup`, `smb`, `mid`, `enterprise`     |
| `status`   | enum   | no       | `prospect` (default), `active`, `churned` |
| `website`  | string | no       | Valid URL                                 |
| `phone`    | string | no       | 1–30 characters                           |
| `address`  | object | no       | Free-form JSON object                     |
| `metadata` | object | no       | Free-form JSON object                     |

**Response (201):** Full company object.

**Errors:** 400 `VALIDATION_ERROR`, 403 `FORBIDDEN`

---

#### PATCH /api/companies/:id

Partial update of a company. Only provided fields are updated.

**Request:**

```json
{
  "status": "active",
  "metadata": { "source": "conference", "tier": "gold" }
}
```

**Response (200):** Full updated company object.

**Errors:** 400 `VALIDATION_ERROR`, 404 `NOT_FOUND`, 403 `FORBIDDEN`

---

#### DELETE /api/companies/:id

Soft-delete a company (sets `deletedAt`).

**Response (200):**

```json
{
  "data": {
    "id": "cmp_01JABC...",
    "deletedAt": "2026-07-07T12:00:00.000Z"
  }
}
```

**Errors:** 404 `NOT_FOUND`, 403 `FORBIDDEN`

---

### 3.2 Contacts

#### GET /api/contacts

**Query parameters:**

| Parameter   | Type   | Default     | Description                                      |
|-------------|--------|-------------|--------------------------------------------------|
| `limit`     | number | 20          | Items per page (max 100)                         |
| `cursor`    | string | —           | Pagination cursor                                |
| `search`    | string | —           | Full-text search on `firstName`, `lastName`, `email` |
| `companyId` | string | —           | Filter by company ID                             |
| `status`    | string | —           | Filter: `active`, `inactive`                     |
| `role`      | string | —           | Filter: `decision_maker`, `influencer`, `user`, `admin` |
| `source`    | string | —           | Filter by source (exact match)                   |
| `sortBy`    | string | `createdAt` | Sort: `lastName`, `firstName`, `email`, `createdAt` |
| `sortDir`   | string | `desc`      | `asc`, `desc`                                    |

**Response (200):**

```json
{
  "data": [
    {
      "id": "con_01JABC...",
      "organizationId": "org_01JABC...",
      "companyId": "cmp_01JABC...",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@acme.com",
      "phone": "+1-555-0101",
      "title": "VP Engineering",
      "role": "decision_maker",
      "source": "LinkedIn",
      "status": "active",
      "metadata": null,
      "createdAt": "2026-02-01T10:00:00.000Z",
      "updatedAt": "2026-07-01T12:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "cursor": "...", "hasMore": false, "limit": 20 } }
}
```

---

#### GET /api/contacts/:id

Get a single contact. **Response (200):** Contact object. **Errors:** 404 `NOT_FOUND`

---

#### POST /api/contacts

**Request:**

```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@acme.com",
  "companyId": "cmp_01JABC...",
  "phone": "+1-555-0101",
  "title": "VP Engineering",
  "role": "decision_maker",
  "source": "LinkedIn",
  "metadata": { "linkedin": "https://linkedin.com/in/johndoe" }
}
```

| Field       | Type   | Required | Validation                                |
|-------------|--------|----------|-------------------------------------------|
| `firstName` | string | yes      | 1–100 characters                          |
| `lastName`  | string | no       | 1–100 characters                          |
| `email`     | string | no       | Valid email, unique per org (among active) |
| `companyId` | UUID   | no       | Must exist in org                         |
| `phone`     | string | no       | 1–30 characters                           |
| `title`     | string | no       | 1–200 characters                          |
| `role`      | enum   | no       | `decision_maker`, `influencer`, `user`, `admin` |
| `source`    | string | no       | 1–100 characters                          |
| `status`    | enum   | no       | `active` (default), `inactive`            |
| `metadata`  | object | no       | Free-form JSON                            |

**Response (201):** Full contact object.

**Errors:** 400 `VALIDATION_ERROR`, 409 `CONFLICT` (duplicate email in org), 403 `FORBIDDEN`

---

#### PATCH /api/contacts/:id

Partial update. **Response (200):** Updated contact. **Errors:** 400, 404, 403, 409

---

#### DELETE /api/contacts/:id

Soft-delete. **Response (200):** `{ "data": { "id": "...", "deletedAt": "..." } }`

---

### 3.3 Leads

#### GET /api/leads

**Query parameters:**

| Parameter      | Type   | Default     | Description                                      |
|----------------|--------|-------------|--------------------------------------------------|
| `limit`        | number | 20          | Items per page (max 100)                         |
| `cursor`       | string | —           | Pagination cursor                                |
| `search`       | string | —           | Full-text search on `title`                      |
| `stage`        | string | —           | Filter: `new`, `qualified`, `proposal`, `negotiation`, `won`, `lost` |
| `companyId`    | string | —           | Filter by company ID                             |
| `contactId`    | string | —           | Filter by contact ID                             |
| `assignedToId` | string | —           | Filter by assigned user ID                       |
| `source`       | string | —           | Filter by source (exact match)                   |
| `minValue`     | number | —           | Filter: value >= this amount                     |
| `maxValue`     | number | —           | Filter: value <= this amount                     |
| `sortBy`       | string | `createdAt` | Sort: `title`, `value`, `stage`, `expectedClose`, `createdAt` |
| `sortDir`      | string | `desc`      | `asc`, `desc`                                    |

**Response (200):**

```json
{
  "data": [
    {
      "id": "led_01JABC...",
      "organizationId": "org_01JABC...",
      "contactId": "con_01JABC...",
      "companyId": "cmp_01JABC...",
      "title": "Enterprise License Deal",
      "stage": "proposal",
      "value": "50000.00",
      "currency": "USD",
      "probability": 60,
      "source": "Referral",
      "assignedToId": "usr_01JABC...",
      "expectedClose": "2026-09-30T00:00:00.000Z",
      "metadata": null,
      "createdAt": "2026-05-01T08:00:00.000Z",
      "updatedAt": "2026-07-01T12:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "cursor": "...", "hasMore": true, "limit": 20 } }
}
```

---

#### GET /api/leads/:id

Get a single lead. **Response (200):** Lead object. **Errors:** 404 `NOT_FOUND`

---

#### POST /api/leads

**Request:**

```json
{
  "title": "Enterprise License Deal",
  "contactId": "con_01JABC...",
  "companyId": "cmp_01JABC...",
  "stage": "new",
  "value": 50000,
  "currency": "USD",
  "probability": 20,
  "source": "Referral",
  "assignedToId": "usr_01JABC...",
  "expectedClose": "2026-09-30",
  "metadata": { "priority": "high" }
}
```

| Field           | Type    | Required | Validation                                |
|-----------------|---------|----------|-------------------------------------------|
| `title`         | string  | yes      | 1–300 characters                          |
| `contactId`     | UUID    | no       | Must exist in org                         |
| `companyId`     | UUID    | no       | Must exist in org                         |
| `stage`         | enum    | no       | `new` (default), `qualified`, `proposal`, `negotiation`, `won`, `lost` |
| `value`         | number  | no       | >= 0, max 2 decimal places                |
| `currency`      | string  | no       | ISO 4217 (default `USD`)                  |
| `probability`   | integer | no       | 0–100                                     |
| `source`        | string  | no       | 1–100 characters                          |
| `assignedToId`  | UUID    | no       | Must be a user in the org                 |
| `expectedClose` | string  | no       | ISO 8601 date                             |
| `metadata`      | object  | no       | Free-form JSON                            |

**Response (201):** Full lead object.

**Errors:** 400 `VALIDATION_ERROR`, 403 `FORBIDDEN`

---

#### PATCH /api/leads/:id

Partial update. **Response (200):** Updated lead. **Errors:** 400, 404, 403

---

#### PATCH /api/leads/:id/stage

Dedicated endpoint for stage transitions. Validates transition rules and triggers side effects (webhook events, task creation).

**Request:**

```json
{
  "stage": "qualified",
  "note": "Initial discovery call completed. Good fit."
}
```

| Field   | Type   | Required | Validation                                |
|---------|--------|----------|-------------------------------------------|
| `stage` | enum   | yes      | Target `LeadStage` value                  |
| `note`  | string | no       | Optional note to attach to the transition |

**Response (200):**

```json
{
  "data": {
    "id": "led_01JABC...",
    "stage": "qualified",
    "previousStage": "new",
    "updatedAt": "2026-07-07T12:00:00.000Z"
  }
}
```

**Errors:** 400 `VALIDATION_ERROR`, 404 `NOT_FOUND`, 422 `UNPROCESSABLE` (invalid transition)

---

#### DELETE /api/leads/:id

Soft-delete. **Response (200):** `{ "data": { "id": "...", "deletedAt": "..." } }`

---

### 3.4 Vendors

#### GET /api/vendors

**Query parameters:**

| Parameter  | Type   | Default     | Description                                      |
|------------|--------|-------------|--------------------------------------------------|
| `limit`    | number | 20          | Items per page (max 100)                         |
| `cursor`   | string | —           | Pagination cursor                                |
| `search`   | string | —           | Full-text search on `name`, `category`           |
| `status`   | string | —           | Filter: `active`, `inactive`, `blacklisted`      |
| `category` | string | —           | Filter by category (exact match)                 |
| `rating`   | number | —           | Filter: minimum rating (1–5)                     |
| `sortBy`   | string | `createdAt` | Sort: `name`, `rating`, `createdAt`              |
| `sortDir`  | string | `desc`      | `asc`, `desc`                                    |

**Response (200):**

```json
{
  "data": [
    {
      "id": "vnd_01JABC...",
      "organizationId": "org_01JABC...",
      "name": "CloudHost Pro",
      "category": "Hosting",
      "contactName": "Alice Johnson",
      "email": "alice@cloudhost.pro",
      "phone": "+1-555-0200",
      "website": "https://cloudhost.pro",
      "status": "active",
      "rating": 4,
      "notes": "Reliable uptime, good support.",
      "metadata": null,
      "createdAt": "2026-03-01T08:00:00.000Z",
      "updatedAt": "2026-06-15T10:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "cursor": "...", "hasMore": false, "limit": 20 } }
}
```

---

#### GET /api/vendors/:id

Get a single vendor. **Response (200):** Vendor object. **Errors:** 404 `NOT_FOUND`

---

#### POST /api/vendors

**Request:**

```json
{
  "name": "CloudHost Pro",
  "category": "Hosting",
  "contactName": "Alice Johnson",
  "email": "alice@cloudhost.pro",
  "phone": "+1-555-0200",
  "website": "https://cloudhost.pro",
  "rating": 4,
  "notes": "Reliable uptime, good support.",
  "metadata": { "contractEnd": "2027-03-01" }
}
```

| Field         | Type    | Required | Validation                                |
|---------------|---------|----------|-------------------------------------------|
| `name`        | string  | yes      | 1–200 characters                          |
| `category`    | string  | no       | 1–100 characters                          |
| `contactName` | string  | no       | 1–200 characters                          |
| `email`       | string  | no       | Valid email                               |
| `phone`       | string  | no       | 1–30 characters                           |
| `website`     | string  | no       | Valid URL                                 |
| `status`      | enum    | no       | `active` (default), `inactive`, `blacklisted` |
| `rating`      | integer | no       | 1–5                                       |
| `notes`       | string  | no       | Max 2000 characters                       |
| `metadata`    | object  | no       | Free-form JSON                            |

**Response (201):** Full vendor object.

**Errors:** 400 `VALIDATION_ERROR`, 403 `FORBIDDEN`

---

#### PATCH /api/vendors/:id

Partial update. **Response (200):** Updated vendor. **Errors:** 400, 404, 403

---

#### DELETE /api/vendors/:id

Soft-delete. **Response (200):** `{ "data": { "id": "...", "deletedAt": "..." } }`

---

### 3.5 Jobs

#### GET /api/jobs

**Query parameters:**

| Parameter      | Type   | Default     | Description                                      |
|----------------|--------|-------------|--------------------------------------------------|
| `limit`        | number | 20          | Items per page (max 100)                         |
| `cursor`       | string | —           | Pagination cursor                                |
| `search`       | string | —           | Full-text search on `title`, `description`       |
| `status`       | string | —           | Filter: `draft`, `active`, `on_hold`, `completed`, `cancelled` |
| `priority`     | string | —           | Filter: `low`, `medium`, `high`, `urgent`        |
| `companyId`    | string | —           | Filter by company ID                             |
| `assignedToId` | string | —           | Filter by assigned user ID                       |
| `type`         | string | —           | Filter by job type (exact match)                 |
| `sortBy`       | string | `createdAt` | Sort: `title`, `dueDate`, `priority`, `status`, `createdAt` |
| `sortDir`      | string | `desc`      | `asc`, `desc`                                    |

**Response (200):**

```json
{
  "data": [
    {
      "id": "job_01JABC...",
      "organizationId": "org_01JABC...",
      "companyId": "cmp_01JABC...",
      "title": "Website Redesign",
      "description": "Complete redesign of the client's marketing site.",
      "status": "active",
      "priority": "high",
      "type": "development",
      "startDate": "2026-06-01T00:00:00.000Z",
      "dueDate": "2026-08-31T00:00:00.000Z",
      "completedAt": null,
      "assignedToId": "usr_01JABC...",
      "value": "25000.00",
      "metadata": null,
      "createdAt": "2026-05-15T08:00:00.000Z",
      "updatedAt": "2026-07-01T12:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "cursor": "...", "hasMore": true, "limit": 20 } }
}
```

---

#### GET /api/jobs/:id

Get a single job. **Response (200):** Job object. **Errors:** 404 `NOT_FOUND`

---

#### POST /api/jobs

**Request:**

```json
{
  "title": "Website Redesign",
  "description": "Complete redesign of the client's marketing site.",
  "companyId": "cmp_01JABC...",
  "status": "draft",
  "priority": "high",
  "type": "development",
  "startDate": "2026-06-01",
  "dueDate": "2026-08-31",
  "assignedToId": "usr_01JABC...",
  "value": 25000,
  "metadata": { "sprint": "Q3-1" }
}
```

| Field          | Type    | Required | Validation                                |
|----------------|---------|----------|-------------------------------------------|
| `title`        | string  | yes      | 1–300 characters                          |
| `description`  | string  | no       | Max 5000 characters                       |
| `companyId`    | UUID    | no       | Must exist in org                         |
| `status`       | enum    | no       | `draft` (default), `active`, `on_hold`, `completed`, `cancelled` |
| `priority`     | enum    | no       | `low`, `medium` (default), `high`, `urgent` |
| `type`         | string  | no       | 1–100 characters                          |
| `startDate`    | string  | no       | ISO 8601 date                             |
| `dueDate`      | string  | no       | ISO 8601 date, must be >= `startDate`     |
| `assignedToId` | UUID    | no       | Must be a user in the org                 |
| `value`        | number  | no       | >= 0, max 2 decimal places                |
| `metadata`     | object  | no       | Free-form JSON                            |

**Response (201):** Full job object.

**Errors:** 400 `VALIDATION_ERROR`, 403 `FORBIDDEN`

---

#### PATCH /api/jobs/:id

Partial update. **Response (200):** Updated job. **Errors:** 400, 404, 403

---

#### DELETE /api/jobs/:id

Soft-delete. **Response (200):** `{ "data": { "id": "...", "deletedAt": "..." } }`

---

### 3.6 Tasks

#### GET /api/tasks

**Query parameters:**

| Parameter      | Type   | Default     | Description                                      |
|----------------|--------|-------------|--------------------------------------------------|
| `limit`        | number | 20          | Items per page (max 100)                         |
| `cursor`       | string | —           | Pagination cursor                                |
| `search`       | string | —           | Full-text search on `title`, `description`       |
| `status`       | string | —           | Filter: `todo`, `in_progress`, `done`, `cancelled` |
| `priority`     | string | —           | Filter: `low`, `medium`, `high`, `urgent`        |
| `assignedToId` | string | —           | Filter by assigned user ID                       |
| `entityType`   | string | —           | Filter: `company`, `contact`, `lead`, `job`, `vendor`, `outreach` |
| `entityId`     | string | —           | Filter by linked entity ID (requires `entityType`) |
| `dueDateFrom`  | string | —           | Filter: due on or after this date (ISO 8601)     |
| `dueDateTo`    | string | —           | Filter: due on or before this date (ISO 8601)    |
| `sortBy`       | string | `createdAt` | Sort: `title`, `dueDate`, `priority`, `status`, `createdAt` |
| `sortDir`      | string | `desc`      | `asc`, `desc`                                    |

**Response (200):**

```json
{
  "data": [
    {
      "id": "tsk_01JABC...",
      "organizationId": "org_01JABC...",
      "title": "Follow up on proposal",
      "description": "Send revised pricing to John.",
      "status": "todo",
      "priority": "high",
      "dueDate": "2026-07-10T00:00:00.000Z",
      "completedAt": null,
      "assignedToId": "usr_01JABC...",
      "entityType": "lead",
      "entityId": "led_01JABC...",
      "metadata": null,
      "createdAt": "2026-07-01T08:00:00.000Z",
      "updatedAt": "2026-07-01T08:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "cursor": "...", "hasMore": true, "limit": 20 } }
}
```

---

#### GET /api/tasks/:id

Get a single task. **Response (200):** Task object. **Errors:** 404 `NOT_FOUND`

---

#### POST /api/tasks

**Request:**

```json
{
  "title": "Follow up on proposal",
  "description": "Send revised pricing to John.",
  "status": "todo",
  "priority": "high",
  "dueDate": "2026-07-10",
  "assignedToId": "usr_01JABC...",
  "entityType": "lead",
  "entityId": "led_01JABC...",
  "metadata": { "reminder": true }
}
```

| Field          | Type   | Required | Validation                                |
|----------------|--------|----------|-------------------------------------------|
| `title`        | string | yes      | 1–300 characters                          |
| `description`  | string | no       | Max 5000 characters                       |
| `status`       | enum   | no       | `todo` (default), `in_progress`, `done`, `cancelled` |
| `priority`     | enum   | no       | `low`, `medium` (default), `high`, `urgent` |
| `dueDate`      | string | no       | ISO 8601 date                             |
| `assignedToId` | UUID   | no       | Must be a user in the org                 |
| `entityType`   | enum   | no       | `company`, `contact`, `lead`, `job`, `vendor`, `outreach` |
| `entityId`     | UUID   | no       | Required if `entityType` is set           |
| `metadata`     | object | no       | Free-form JSON                            |

**Response (201):** Full task object.

**Errors:** 400 `VALIDATION_ERROR`, 403 `FORBIDDEN`

---

#### PATCH /api/tasks/:id

Partial update. **Response (200):** Updated task. **Errors:** 400, 404, 403

---

#### DELETE /api/tasks/:id

Soft-delete. **Response (200):** `{ "data": { "id": "...", "deletedAt": "..." } }`

---

### 3.7 Outreach

#### GET /api/outreach

**Query parameters:**

| Parameter   | Type   | Default     | Description                                      |
|-------------|--------|-------------|--------------------------------------------------|
| `limit`     | number | 20          | Items per page (max 100)                         |
| `cursor`    | string | —           | Pagination cursor                                |
| `search`    | string | —           | Full-text search on `subject`, `body`            |
| `type`      | string | —           | Filter: `email`, `call`, `message`, `linkedin`, `other` |
| `direction` | string | —           | Filter: `inbound`, `outbound`                    |
| `status`    | string | —           | Filter: `draft`, `sent`, `received`, `replied`, `bounced` |
| `contactId` | string | —           | Filter by contact ID                             |
| `leadId`    | string | —           | Filter by lead ID                                |
| `createdBy` | string | —           | Filter: `human`, `ai`                            |
| `sortBy`    | string | `createdAt` | Sort: `sentAt`, `createdAt`, `type`              |
| `sortDir`   | string | `desc`      | `asc`, `desc`                                    |

**Response (200):**

```json
{
  "data": [
    {
      "id": "out_01JABC...",
      "organizationId": "org_01JABC...",
      "contactId": "con_01JABC...",
      "leadId": "led_01JABC...",
      "type": "email",
      "direction": "outbound",
      "subject": "Proposal Follow-Up",
      "body": "Hi John, just checking in on the proposal...",
      "status": "sent",
      "sentAt": "2026-07-05T14:00:00.000Z",
      "respondedAt": null,
      "channelMetadata": { "gmailMessageId": "msg_123", "threadId": "thread_456" },
      "createdBy": "human",
      "metadata": null,
      "createdAt": "2026-07-05T13:55:00.000Z",
      "updatedAt": "2026-07-05T14:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "cursor": "...", "hasMore": true, "limit": 20 } }
}
```

---

#### GET /api/outreach/:id

Get a single outreach record. **Response (200):** Outreach object. **Errors:** 404 `NOT_FOUND`

---

#### POST /api/outreach

**Request:**

```json
{
  "contactId": "con_01JABC...",
  "leadId": "led_01JABC...",
  "type": "email",
  "direction": "outbound",
  "subject": "Proposal Follow-Up",
  "body": "Hi John, just checking in on the proposal...",
  "status": "draft",
  "channelMetadata": { "templateId": "follow-up-v2" },
  "createdBy": "human"
}
```

| Field             | Type   | Required | Validation                                |
|-------------------|--------|----------|-------------------------------------------|
| `contactId`       | UUID   | no       | Must exist in org                         |
| `leadId`          | UUID   | no       | Must exist in org                         |
| `type`            | enum   | yes      | `email`, `call`, `message`, `linkedin`, `other` |
| `direction`       | enum   | yes      | `inbound`, `outbound`                     |
| `subject`         | string | no       | Max 500 characters                        |
| `body`            | string | no       | Max 50,000 characters                     |
| `status`          | enum   | no       | `draft` (default), `sent`, `received`, `replied`, `bounced` |
| `sentAt`          | string | no       | ISO 8601 datetime                         |
| `respondedAt`     | string | no       | ISO 8601 datetime                         |
| `channelMetadata` | object | no       | Free-form JSON                            |
| `createdBy`       | enum   | no       | `human` (default), `ai`                   |
| `metadata`        | object | no       | Free-form JSON                            |

**Response (201):** Full outreach object.

**Errors:** 400 `VALIDATION_ERROR`, 403 `FORBIDDEN`

---

#### PATCH /api/outreach/:id

Partial update. **Response (200):** Updated outreach. **Errors:** 400, 404, 403

---

#### DELETE /api/outreach/:id

Soft-delete. **Response (200):** `{ "data": { "id": "...", "deletedAt": "..." } }`

---

### 3.8 Notes

#### GET /api/notes

**Query parameters:**

| Parameter    | Type    | Default     | Description                                      |
|--------------|---------|-------------|--------------------------------------------------|
| `limit`      | number  | 20          | Items per page (max 100)                         |
| `cursor`     | string  | —           | Pagination cursor                                |
| `search`     | string  | —           | Full-text search on `title`, `content`           |
| `entityType` | string  | —           | Filter: `company`, `contact`, `lead`, `job`, `vendor`, `outreach` |
| `entityId`   | string  | —           | Filter by linked entity ID (requires `entityType`) |
| `type`       | string  | —           | Filter: `general`, `meeting`, `ai_summary`, `call_log` |
| `isPinned`   | boolean | —           | Filter by pinned status                          |
| `authorType` | string  | —           | Filter: `human`, `ai`                            |
| `sortBy`     | string  | `createdAt` | Sort: `createdAt`, `updatedAt`, `isPinned`       |
| `sortDir`    | string  | `desc`      | `asc`, `desc`                                    |

**Response (200):**

```json
{
  "data": [
    {
      "id": "nte_01JABC...",
      "organizationId": "org_01JABC...",
      "entityType": "lead",
      "entityId": "led_01JABC...",
      "title": "Discovery Call Notes",
      "content": "## Key Points\n- Budget: $50K\n- Timeline: Q3\n- Decision maker: John Doe",
      "type": "meeting",
      "isPinned": true,
      "authorType": "human",
      "metadata": { "duration": "30min", "attendees": ["Jane", "John"] },
      "createdAt": "2026-07-01T15:00:00.000Z",
      "updatedAt": "2026-07-01T15:30:00.000Z"
    }
  ],
  "meta": { "pagination": { "cursor": "...", "hasMore": false, "limit": 20 } }
}
```

---

#### GET /api/notes/:id

Get a single note. **Response (200):** Note object. **Errors:** 404 `NOT_FOUND`

---

#### POST /api/notes

**Request:**

```json
{
  "entityType": "lead",
  "entityId": "led_01JABC...",
  "title": "Discovery Call Notes",
  "content": "## Key Points\n- Budget: $50K\n- Timeline: Q3\n- Decision maker: John Doe",
  "type": "meeting",
  "isPinned": true,
  "authorType": "human",
  "metadata": { "duration": "30min" }
}
```

| Field        | Type    | Required | Validation                                |
|--------------|---------|----------|-------------------------------------------|
| `entityType` | enum    | yes      | `company`, `contact`, `lead`, `job`, `vendor`, `outreach` |
| `entityId`   | UUID    | yes      | Must exist in org                         |
| `title`      | string  | no       | Max 300 characters                        |
| `content`    | string  | yes      | Markdown, max 50,000 characters           |
| `type`       | enum    | no       | `general` (default), `meeting`, `ai_summary`, `call_log` |
| `isPinned`   | boolean | no       | `false` (default)                         |
| `authorType` | enum    | no       | `human` (default), `ai`                   |
| `metadata`   | object  | no       | Free-form JSON                            |

**Response (201):** Full note object.

**Errors:** 400 `VALIDATION_ERROR`, 403 `FORBIDDEN`

---

#### PATCH /api/notes/:id

Partial update. **Response (200):** Updated note. **Errors:** 400, 404, 403

---

#### DELETE /api/notes/:id

Soft-delete. **Response (200):** `{ "data": { "id": "...", "deletedAt": "..." } }`

---

## 4. Request/Response Examples

### 4.1 Complete CRUD Flow — Company

**1. Create a company:**

```http
POST /api/companies
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{
  "name": "NovaTech Solutions",
  "domain": "novatech.io",
  "industry": "SaaS",
  "size": "startup",
  "status": "prospect"
}
```

```http
HTTP/1.1 201 Created

{
  "data": {
    "id": "cmp_01JDEF...",
    "organizationId": "org_01JABC...",
    "name": "NovaTech Solutions",
    "domain": "novatech.io",
    "industry": "SaaS",
    "size": "startup",
    "status": "prospect",
    "website": null,
    "phone": null,
    "address": null,
    "metadata": null,
    "createdAt": "2026-07-07T12:00:00.000Z",
    "updatedAt": "2026-07-07T12:00:00.000Z"
  }
}
```

**2. List companies filtered by status:**

```http
GET /api/companies?status=prospect&sortBy=name&sortDir=asc&limit=10
Authorization: Bearer eyJhbGciOi...
```

```http
HTTP/1.1 200 OK

{
  "data": [
    {
      "id": "cmp_01JDEF...",
      "name": "NovaTech Solutions",
      "domain": "novatech.io",
      "industry": "SaaS",
      "size": "startup",
      "status": "prospect",
      "website": null,
      "phone": null,
      "address": null,
      "metadata": null,
      "createdAt": "2026-07-07T12:00:00.000Z",
      "updatedAt": "2026-07-07T12:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": { "cursor": null, "hasMore": false, "limit": 10 }
  }
}
```

**3. Update the company:**

```http
PATCH /api/companies/cmp_01JDEF...
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{
  "status": "active",
  "website": "https://novatech.io",
  "metadata": { "tier": "gold" }
}
```

```http
HTTP/1.1 200 OK

{
  "data": {
    "id": "cmp_01JDEF...",
    "organizationId": "org_01JABC...",
    "name": "NovaTech Solutions",
    "domain": "novatech.io",
    "industry": "SaaS",
    "size": "startup",
    "status": "active",
    "website": "https://novatech.io",
    "phone": null,
    "address": null,
    "metadata": { "tier": "gold" },
    "createdAt": "2026-07-07T12:00:00.000Z",
    "updatedAt": "2026-07-07T12:05:00.000Z"
  }
}
```

**4. Soft-delete the company:**

```http
DELETE /api/companies/cmp_01JDEF...
Authorization: Bearer eyJhbGciOi...
```

```http
HTTP/1.1 200 OK

{
  "data": {
    "id": "cmp_01JDEF...",
    "deletedAt": "2026-07-07T12:10:00.000Z"
  }
}
```

---

### 4.2 Lead Stage Transition

```http
PATCH /api/leads/led_01JABC.../stage
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{
  "stage": "proposal",
  "note": "Sent pricing proposal v2."
}
```

```http
HTTP/1.1 200 OK

{
  "data": {
    "id": "led_01JABC...",
    "stage": "proposal",
    "previousStage": "qualified",
    "updatedAt": "2026-07-07T14:00:00.000Z"
  }
}
```

---

### 4.3 Error Responses

**Validation error (400):**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "name", "message": "Name is required" },
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

**Not found (404):**

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Company with ID 'cmp_invalid' not found"
  }
}
```

**Conflict (409):**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "A contact with email 'john@acme.com' already exists in this organization"
  }
}
```

**Forbidden (403):**

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Your role 'viewer' does not have permission to perform this action"
  }
}
```

**Rate limited (429):**

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please retry after 30 seconds.",
    "details": {
      "retryAfter": 30
    }
  }
}
```

---

## 5. Filtering and Sorting

### 5.1 Query Parameter Format

All list endpoints accept filtering, sorting, and pagination via query parameters. Parameters are passed as standard URL query strings.

```
GET /api/companies?status=active&industry=Technology&sortBy=name&sortDir=asc&limit=20
```

### 5.2 Supported Filter Operators

| Operator    | Syntax                  | Example                          | Description              |
|-------------|-------------------------|----------------------------------|--------------------------|
| `eq`        | `field=value`           | `status=active`                  | Exact match (default)    |
| `ne`        | `field__ne=value`       | `status__ne=churned`             | Not equal                |
| `gt`        | `field__gt=value`       | `value__gt=10000`                | Greater than             |
| `gte`       | `field__gte=value`      | `value__gte=10000`               | Greater than or equal    |
| `lt`        | `field__lt=value`       | `value__lt=50000`                | Less than                |
| `lte`       | `field__lte=value`      | `value__lte=50000`               | Less than or equal       |
| `contains`  | `field__contains=value` | `name__contains=tech`            | Case-insensitive contains |
| `in`        | `field__in=a,b,c`       | `status__in=active,prospect`     | Value is one of          |

**Examples:**

```
# Active companies in Technology or SaaS
GET /api/companies?status=active&industry__in=Technology,SaaS

# Leads worth more than $10K
GET /api/leads?value__gt=10000

# Tasks due before a date, not yet done
GET /api/tasks?dueDate__lt=2026-08-01&status__ne=done

# Contacts whose name contains "john"
GET /api/contacts?firstName__contains=john
```

### 5.3 Full-Text Search

The `search` parameter performs PostgreSQL full-text search on the indexed columns for each entity:

| Entity   | Searched columns               |
|----------|--------------------------------|
| Company  | `name`, `domain`               |
| Contact  | `firstName`, `lastName`, `email` |
| Lead     | `title`                        |
| Vendor   | `name`, `category`             |
| Job      | `title`, `description`         |
| Task     | `title`, `description`         |
| Outreach | `subject`, `body`              |
| Note     | `title`, `content`             |

```
GET /api/companies?search=acme
GET /api/contacts?search=john+doe
```

### 5.4 Sort Field and Direction

| Parameter | Type   | Default     | Description                    |
|-----------|--------|-------------|--------------------------------|
| `sortBy`  | string | `createdAt` | Field to sort by               |
| `sortDir` | string | `desc`      | `asc` or `desc`                |

Each endpoint documents its supported `sortBy` values in the query parameters table.

### 5.5 Pagination

| Parameter | Type   | Default | Description                      |
|-----------|--------|---------|----------------------------------|
| `limit`   | number | 20      | Items per page (1–100)           |
| `cursor`  | string | —       | Opaque cursor from previous page |

**How cursor pagination works:**

1. First request: `GET /api/companies?limit=20`
2. Response includes `meta.pagination.cursor` and `meta.pagination.hasMore`
3. Next page: `GET /api/companies?limit=20&cursor=<cursor_value>`
4. Repeat until `hasMore` is `false`

---

## 6. Webhook Endpoints

### 6.1 Inbound Webhooks

#### POST /api/webhooks/inbound

Generic inbound webhook receiver for external events.

**Request:**

```http
POST /api/webhooks/inbound
Content-Type: application/json
X-Webhook-Signature: sha256=<hmac_signature>
X-Webhook-Id: wh_unique_id
```

```json
{
  "event": "external.contact.created",
  "timestamp": "2026-07-07T12:00:00.000Z",
  "provider": "n8n",
  "data": {
    "email": "new@example.com",
    "firstName": "New",
    "lastName": "Contact",
    "source": "n8n-workflow"
  }
}
```

| Header               | Required | Description                                |
|----------------------|----------|--------------------------------------------|
| `X-Webhook-Signature`| yes      | HMAC-SHA256 signature of the raw body      |
| `X-Webhook-Id`       | no       | Idempotency key to prevent duplicate processing |

**Signature verification:**

```
expected = HMAC-SHA256(secret, raw_request_body)
actual   = X-Webhook-Signature header value
```

The `secret` is configured per webhook source in the system settings.

**Response (200):**

```json
{
  "data": {
    "received": true,
    "processed": true,
    "webhookId": "wh_unique_id"
  }
}
```

**Response (202):** (if async processing)

```json
{
  "data": {
    "received": true,
    "processed": false,
    "message": "Webhook accepted and queued for processing",
    "webhookId": "wh_unique_id"
  }
}
```

**Errors:** 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED` (bad signature), 409 `CONFLICT` (duplicate `X-Webhook-Id`)

---

#### Provider-Specific Inbound Webhooks

| Endpoint                    | Provider          | Purpose                           |
|-----------------------------|-------------------|-----------------------------------|
| `POST /api/webhooks/gmail`  | Google (Gmail)    | Push notifications for new emails |
| `POST /api/webhooks/calendar` | Google (Calendar) | Push notifications for events  |
| `POST /api/webhooks/n8n`    | n8n               | Workflow callbacks                |

These endpoints follow the same signature verification pattern but accept provider-specific payload formats.

---

### 6.2 Outbound Webhooks

#### GET /api/webhooks/outbound

List configured outbound webhook subscriptions for the organization.

**Request:**

```http
GET /api/webhooks/outbound
Authorization: Bearer eyJhbGciOi...
```

**Response (200):**

```json
{
  "data": [
    {
      "id": "whs_01JABC...",
      "organizationId": "org_01JABC...",
      "url": "https://hooks.example.com/bluearc",
      "events": ["lead.stage_changed", "lead.won", "task.completed"],
      "active": true,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-07-01T08:00:00.000Z"
    }
  ],
  "meta": {
    "pagination": { "cursor": null, "hasMore": false, "limit": 20 }
  }
}
```

---

#### POST /api/webhooks/outbound

Create a new outbound webhook subscription.

**Request:**

```json
{
  "url": "https://hooks.example.com/bluearc",
  "events": ["lead.stage_changed", "lead.won", "task.completed"],
  "secret": "whsec_custom_secret_value"
}
```

| Field    | Type     | Required | Validation                          |
|----------|----------|----------|-------------------------------------|
| `url`    | string   | yes      | Valid HTTPS URL                     |
| `events` | string[] | yes      | At least one event type             |
| `secret` | string   | no       | If omitted, server generates one    |

**Available event types:**

| Event                | Description                      |
|----------------------|----------------------------------|
| `company.created`    | New company created              |
| `company.updated`    | Company updated                  |
| `company.deleted`    | Company soft-deleted             |
| `contact.created`    | New contact created              |
| `contact.updated`    | Contact updated                  |
| `contact.deleted`    | Contact soft-deleted             |
| `lead.created`       | New lead created                 |
| `lead.updated`       | Lead updated                     |
| `lead.stage_changed` | Lead stage transitioned          |
| `lead.won`           | Lead marked as won               |
| `lead.lost`          | Lead marked as lost              |
| `lead.deleted`       | Lead soft-deleted                |
| `vendor.created`     | New vendor created               |
| `vendor.updated`     | Vendor updated                   |
| `vendor.deleted`     | Vendor soft-deleted              |
| `job.created`        | New job created                  |
| `job.updated`        | Job updated                      |
| `job.completed`      | Job marked as completed          |
| `job.deleted`        | Job soft-deleted                 |
| `task.created`       | New task created                 |
| `task.updated`       | Task updated                     |
| `task.completed`     | Task marked as done              |
| `task.deleted`       | Task soft-deleted                |
| `outreach.created`   | New outreach record              |
| `outreach.sent`      | Outreach sent                    |
| `outreach.replied`   | Reply received                   |
| `note.created`       | New note created                 |
| `note.updated`       | Note updated                     |
| `*`                  | All events (wildcard)            |

**Response (201):**

```json
{
  "data": {
    "id": "whs_01JXYZ...",
    "organizationId": "org_01JABC...",
    "url": "https://hooks.example.com/bluearc",
    "events": ["lead.stage_changed", "lead.won", "task.completed"],
    "active": true,
    "createdAt": "2026-07-07T12:00:00.000Z",
    "updatedAt": "2026-07-07T12:00:00.000Z"
  }
}
```

> **Note:** The `secret` is only returned in the creation response. Store it securely.

**Errors:** 400 `VALIDATION_ERROR`, 403 `FORBIDDEN`

---

#### PATCH /api/webhooks/outbound/:id

Update a webhook subscription.

**Request:**

```json
{
  "events": ["lead.stage_changed", "lead.won", "task.completed", "outreach.sent"],
  "active": false
}
```

**Response (200):** Updated subscription object.

---

#### DELETE /api/webhooks/outbound/:id

Delete a webhook subscription.

**Response (200):**

```json
{
  "data": {
    "id": "whs_01JXYZ...",
    "deleted": true
  }
}
```

---

### 6.3 Outbound Webhook Payload Format

When an event fires, Blue Arc OS sends a POST request to each matching subscription URL.

**Delivery format:**

```http
POST https://hooks.example.com/bluearc
Content-Type: application/json
X-BlueArc-Signature: sha256=<hmac>
X-BlueArc-Event: lead.stage_changed
X-BlueArc-Delivery: whd_01JABC...
```

```json
{
  "id": "evt_01JABC...",
  "type": "lead.stage_changed",
  "timestamp": "2026-07-07T14:00:00.000Z",
  "organizationId": "org_01JABC...",
  "data": {
    "leadId": "led_01JABC...",
    "previousStage": "qualified",
    "newStage": "proposal",
    "lead": {
      "id": "led_01JABC...",
      "title": "Enterprise License Deal",
      "stage": "proposal",
      "value": "50000.00",
      "currency": "USD"
    }
  }
}
```

**Signature verification (receiver side):**

```
expected = HMAC-SHA256(secret, raw_body)
actual   = X-BlueArc-Signature header
```

**Retry policy:**

| Attempt | Delay     |
|---------|-----------|
| 1       | Immediate |
| 2       | 1 minute  |
| 3       | 5 minutes |
| 4       | 30 minutes|
| 5       | 2 hours   |

After 5 failed attempts, the delivery is marked as `failed` and no further retries are attempted.

---

## 7. AI Endpoints

> **Status: Future** — These endpoints are designed but not yet implemented.

### 7.1 POST /api/ai/research

Trigger AI-powered research on a company or contact.

**Request:**

```json
{
  "entityType": "company",
  "entityId": "cmp_01JABC...",
  "options": {
    "depth": "standard",
    "includeCompetitors": true,
    "includeNews": true
  }
}
```

| Field        | Type   | Required | Validation                          |
|--------------|--------|----------|-------------------------------------|
| `entityType` | enum   | yes      | `company` or `contact`              |
| `entityId`   | UUID   | yes      | Must exist in org                   |
| `options.depth` | enum | no      | `brief`, `standard` (default), `deep` |
| `options.includeCompetitors` | boolean | no | `false` (default)       |
| `options.includeNews`        | boolean | no | `false` (default)       |

**Response (202 Accepted):**

```json
{
  "data": {
    "jobId": "aijob_01JABC...",
    "status": "queued",
    "estimatedSeconds": 30
  }
}
```

**Errors:** 400 `VALIDATION_ERROR`, 404 `NOT_FOUND`, 429 `RATE_LIMITED` (AI quota exceeded)

---

### 7.2 POST /api/ai/outreach/draft

Generate an AI-powered outreach draft.

**Request:**

```json
{
  "contactId": "con_01JABC...",
  "leadId": "led_01JABC...",
  "type": "email",
  "purpose": "initial_outreach",
  "tone": "professional",
  "context": "We met at SaaStr Annual 2026. They need a CRM integration.",
  "maxLength": 500
}
```

| Field       | Type    | Required | Validation                          |
|-------------|---------|----------|-------------------------------------|
| `contactId` | UUID    | yes      | Must exist in org                   |
| `leadId`    | UUID    | no       | Must exist in org                   |
| `type`      | enum    | no       | `email` (default), `message`, `linkedin` |
| `purpose`   | enum    | no       | `initial_outreach`, `follow_up`, `proposal`, `check_in` |
| `tone`      | enum    | no       | `professional` (default), `casual`, `urgent`, `friendly` |
| `context`   | string  | no       | Additional context (max 2000 chars) |
| `maxLength` | integer | no       | Max characters for output (default 500) |

**Response (200):**

```json
{
  "data": {
    "subject": "Following up from SaaStr — CRM Integration",
    "body": "Hi John,\n\nGreat meeting you at SaaStr last week. I've been thinking about the CRM integration challenges you mentioned...\n\nWould love to set up a 20-minute call to explore how we might help.\n\nBest,\nJane",
    "tokensUsed": {
      "input": 850,
      "output": 180,
      "total": 1030
    }
  }
}
```

**Errors:** 400 `VALIDATION_ERROR`, 404 `NOT_FOUND`, 429 `RATE_LIMITED`

---

### 7.3 POST /api/ai/notes/summarize

Summarize one or more notes using AI.

**Request:**

```json
{
  "noteIds": ["nte_01JABC...", "nte_01JDEF..."],
  "format": "structured"
}
```

| Field     | Type     | Required | Validation                          |
|-----------|----------|----------|-------------------------------------|
| `noteIds` | UUID[]   | yes      | 1–10 note IDs, must exist in org    |
| `format`  | enum     | no       | `brief`, `structured` (default), `action_items` |

**Response (200):**

```json
{
  "data": {
    "summary": "The lead is in proposal stage with a $50K budget. Key decision maker is John Doe (VP Eng). Timeline is Q3 2026. Main concerns are integration complexity and support SLA.",
    "actionItems": [
      "Send revised pricing by July 10",
      "Schedule technical deep-dive with John's team",
      "Prepare case study from similar integration"
    ],
    "keyDecisions": [
      "Budget approved at $50K",
      "Timeline: Q3 2026"
    ],
    "tags": ["enterprise", "integration", "q3-timeline"],
    "tokensUsed": {
      "input": 2400,
      "output": 350,
      "total": 2750
    }
  }
}
```

**Errors:** 400 `VALIDATION_ERROR`, 404 `NOT_FOUND`, 429 `RATE_LIMITED`

---

### 7.4 GET /api/ai/status/:jobId

Check the status of an async AI job.

**Request:**

```http
GET /api/ai/status/aijob_01JABC...
Authorization: Bearer eyJhbGciOi...
```

**Response (200) — Processing:**

```json
{
  "data": {
    "jobId": "aijob_01JABC...",
    "status": "processing",
    "feature": "research",
    "createdAt": "2026-07-07T12:00:00.000Z",
    "completedAt": null,
    "result": null
  }
}
```

**Response (200) — Completed:**

```json
{
  "data": {
    "jobId": "aijob_01JABC...",
    "status": "completed",
    "feature": "research",
    "createdAt": "2026-07-07T12:00:00.000Z",
    "completedAt": "2026-07-07T12:00:28.000Z",
    "result": {
      "noteId": "nte_01JNEW...",
      "type": "ai_summary"
    }
  }
}
```

**Response (200) — Failed:**

```json
{
  "data": {
    "jobId": "aijob_01JABC...",
    "status": "failed",
    "feature": "research",
    "createdAt": "2026-07-07T12:00:00.000Z",
    "completedAt": "2026-07-07T12:01:05.000Z",
    "result": null,
    "error": {
      "code": "AI_PROVIDER_ERROR",
      "message": "AI provider returned an error. Please retry."
    }
  }
}
```

**Job statuses:** `queued`, `processing`, `completed`, `failed`

**Errors:** 404 `NOT_FOUND`

---

## 8. Error Handling

### 8.1 Standard Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description of the error.",
    "details": {}
  }
}
```

| Field     | Type             | Required | Description                          |
|-----------|------------------|----------|--------------------------------------|
| `code`    | string           | yes      | Machine-readable error code          |
| `message` | string           | yes      | Human-readable description           |
| `details` | object or array  | no       | Additional context (field errors, retry info, etc.) |

### 8.2 HTTP Status Codes

| Code | Meaning              | When to Use                                    |
|------|----------------------|------------------------------------------------|
| 200  | OK                   | Successful GET, PATCH, DELETE                  |
| 201  | Created              | Successful POST (resource created)             |
| 202  | Accepted             | Async operation started (AI jobs)              |
| 400  | Bad Request          | Validation failure, malformed input            |
| 401  | Unauthorized         | Missing or invalid auth token                  |
| 403  | Forbidden            | Authenticated but insufficient permissions     |
| 404  | Not Found            | Resource doesn't exist or is soft-deleted      |
| 409  | Conflict             | Unique constraint violation                    |
| 422  | Unprocessable Entity | Semantically invalid (e.g., bad state transition) |
| 429  | Too Many Requests    | Rate limit exceeded                            |
| 500  | Internal Server Error| Unexpected server error                        |

### 8.3 Common Error Scenarios

| Scenario                              | Status | Code               |
|---------------------------------------|--------|--------------------|
| Missing required field                | 400    | `VALIDATION_ERROR` |
| Invalid email format                  | 400    | `VALIDATION_ERROR` |
| Invalid filter operator               | 400    | `INVALID_FILTER`   |
| Invalid sort field                    | 400    | `INVALID_FILTER`   |
| Missing auth header                   | 401    | `UNAUTHORIZED`     |
| Expired access token                  | 401    | `TOKEN_EXPIRED`    |
| Invalid API key                       | 401    | `UNAUTHORIZED`     |
| Viewer trying to create               | 403    | `FORBIDDEN`        |
| Member editing someone else's entity  | 403    | `FORBIDDEN`        |
| Resource not found                    | 404    | `NOT_FOUND`        |
| Soft-deleted resource accessed        | 404    | `NOT_FOUND`        |
| Duplicate email in org                | 409    | `CONFLICT`         |
| Duplicate org slug                    | 409    | `CONFLICT`         |
| Invalid lead stage transition         | 422    | `UNPROCESSABLE`    |
| dueDate before startDate on Job       | 422    | `UNPROCESSABLE`    |
| Rate limit exceeded                   | 429    | `RATE_LIMITED`     |
| AI quota exceeded                     | 429    | `RATE_LIMITED`     |
| Unexpected server error               | 500    | `INTERNAL_ERROR`   |

### 8.4 Validation Error Details

For `VALIDATION_ERROR` responses, `details` is an array of field-level errors:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "field": "name", "message": "Name is required" },
      { "field": "email", "message": "Invalid email format" },
      { "field": "probability", "message": "Must be between 0 and 100" }
    ]
  }
}
```

### 8.5 Error Handling Best Practices

1. **Always check the `code` field** — it is the stable, machine-readable identifier. The `message` field may change for localization.
2. **Handle 401 by refreshing the token** — if the code is `TOKEN_EXPIRED`, call `POST /api/auth/refresh` and retry.
3. **Handle 429 with backoff** — respect the `retryAfter` value in `details` or the `X-RateLimit-Reset` header.
4. **Log the `X-Request-Id`** — include it in bug reports for server-side tracing.
5. **Never trust client-side organizationId** — the server always injects it from the JWT.

---

## Appendix A: Endpoint Summary

| Method   | Endpoint                          | Auth | Description                  |
|----------|-----------------------------------|------|------------------------------|
| POST     | `/api/auth/register`              | No   | Register user + org          |
| POST     | `/api/auth/login`                 | No   | Email/password login         |
| POST     | `/api/auth/logout`                | Yes  | End session                  |
| POST     | `/api/auth/refresh`               | No   | Refresh access token         |
| GET      | `/api/auth/me`                    | Yes  | Current user profile         |
| GET      | `/api/companies`                  | Yes  | List companies               |
| GET      | `/api/companies/:id`              | Yes  | Get company                  |
| POST     | `/api/companies`                  | Yes  | Create company               |
| PATCH    | `/api/companies/:id`              | Yes  | Update company               |
| DELETE   | `/api/companies/:id`              | Yes  | Soft-delete company          |
| GET      | `/api/contacts`                   | Yes  | List contacts                |
| GET      | `/api/contacts/:id`               | Yes  | Get contact                  |
| POST     | `/api/contacts`                   | Yes  | Create contact               |
| PATCH    | `/api/contacts/:id`               | Yes  | Update contact               |
| DELETE   | `/api/contacts/:id`               | Yes  | Soft-delete contact          |
| GET      | `/api/leads`                      | Yes  | List leads                   |
| GET      | `/api/leads/:id`                  | Yes  | Get lead                     |
| POST     | `/api/leads`                      | Yes  | Create lead                  |
| PATCH    | `/api/leads/:id`                  | Yes  | Update lead                  |
| PATCH    | `/api/leads/:id/stage`            | Yes  | Transition lead stage        |
| DELETE   | `/api/leads/:id`                  | Yes  | Soft-delete lead             |
| GET      | `/api/vendors`                    | Yes  | List vendors                 |
| GET      | `/api/vendors/:id`                | Yes  | Get vendor                   |
| POST     | `/api/vendors`                    | Yes  | Create vendor                |
| PATCH    | `/api/vendors/:id`                | Yes  | Update vendor                |
| DELETE   | `/api/vendors/:id`                | Yes  | Soft-delete vendor           |
| GET      | `/api/jobs`                       | Yes  | List jobs                    |
| GET      | `/api/jobs/:id`                   | Yes  | Get job                      |
| POST     | `/api/jobs`                       | Yes  | Create job                   |
| PATCH    | `/api/jobs/:id`                   | Yes  | Update job                   |
| DELETE   | `/api/jobs/:id`                   | Yes  | Soft-delete job              |
| GET      | `/api/tasks`                      | Yes  | List tasks                   |
| GET      | `/api/tasks/:id`                  | Yes  | Get task                     |
| POST     | `/api/tasks`                      | Yes  | Create task                  |
| PATCH    | `/api/tasks/:id`                  | Yes  | Update task                  |
| DELETE   | `/api/tasks/:id`                  | Yes  | Soft-delete task             |
| GET      | `/api/outreach`                   | Yes  | List outreach                |
| GET      | `/api/outreach/:id`               | Yes  | Get outreach                 |
| POST     | `/api/outreach`                   | Yes  | Create outreach              |
| PATCH    | `/api/outreach/:id`               | Yes  | Update outreach              |
| DELETE   | `/api/outreach/:id`               | Yes  | Soft-delete outreach         |
| GET      | `/api/notes`                      | Yes  | List notes                   |
| GET      | `/api/notes/:id`                  | Yes  | Get note                     |
| POST     | `/api/notes`                      | Yes  | Create note                  |
| PATCH    | `/api/notes/:id`                  | Yes  | Update note                  |
| DELETE   | `/api/notes/:id`                  | Yes  | Soft-delete note             |
| POST     | `/api/webhooks/inbound`           | Sig  | Receive external webhook     |
| GET      | `/api/webhooks/outbound`          | Yes  | List outbound subscriptions  |
| POST     | `/api/webhooks/outbound`          | Yes  | Create outbound subscription |
| PATCH    | `/api/webhooks/outbound/:id`      | Yes  | Update outbound subscription |
| DELETE   | `/api/webhooks/outbound/:id`      | Yes  | Delete outbound subscription |
| POST     | `/api/ai/research`                | Yes  | Trigger AI research (future) |
| POST     | `/api/ai/outreach/draft`          | Yes  | Generate outreach draft (future) |
| POST     | `/api/ai/notes/summarize`         | Yes  | Summarize notes (future)     |
| GET      | `/api/ai/status/:jobId`           | Yes  | Check AI job status (future) |

## Appendix B: Permission Matrix

| Permission          | Owner | Admin | Manager | Member | Viewer |
|---------------------|-------|-------|---------|--------|--------|
| `*:read`            | ✓     | ✓     | ✓       | ✓      | ✓      |
| `*:write`           | ✓     | ✓     | ✓       | ✓*     | ✗      |
| `*:delete`          | ✓     | ✓     | ✓       | ✗      | ✗      |
| `settings:manage`   | ✓     | ✓     | ✗       | ✗      | ✗      |
| `members:manage`    | ✓     | ✓     | ✗       | ✗      | ✗      |
| `api_keys:manage`   | ✓     | ✓     | ✗       | ✗      | ✗      |

> \* Members can only write to entities they are assigned to (`assignedToId` matches their user ID).

## Appendix C: Rate Limits

| Plan        | Requests/min | Requests/day | AI calls/day |
|-------------|-------------|--------------|--------------|
| Free        | 60          | 1,000        | 10           |
| Pro         | 200         | 10,000       | 500          |
| Enterprise  | 1,000       | 100,000      | 5,000        |
