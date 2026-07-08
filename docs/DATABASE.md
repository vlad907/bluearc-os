# Blue Arc OS — Database Design

> Version: 1.0.0
> Last updated: 2026-07-07
> Status: Design phase
> Companion document: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)

---

## Table of Contents

1. [Schema Overview](#1-schema-overview)
2. [Core Entities](#2-core-entities)
3. [Relationships](#3-relationships)
4. [Enums](#4-enums)
5. [Indexes](#5-indexes)
6. [Constraints](#6-constraints)
7. [Migration Strategy](#7-migration-strategy)
8. [Prisma Schema](#8-prisma-schema)

---

## 1. Schema Overview

### 1.1 Technology Stack

| Component        | Choice                          | Notes                                              |
|------------------|---------------------------------|----------------------------------------------------|
| **Database**     | PostgreSQL 16 (via Supabase)    | Managed, connection pooling, RLS, real-time        |
| **ORM**          | Prisma 6                        | Type-safe queries, declarative schema, migrations  |
| **Primary Keys** | UUIDs (`uuid_generate_v4()`)    | No enumeration, safe in URLs, distributed-friendly |
| **Connection**   | Supabase connection pooler      | Handles serverless function concurrency            |

### 1.2 Design Principles

| Principle             | Implementation                                        | Rationale                                    |
|-----------------------|-------------------------------------------------------|----------------------------------------------|
| **Multi-tenancy**     | `organizationId` on every tenant-scoped entity        | Simple row-level scoping, RLS-compatible     |
| **Soft deletes**      | `deletedAt DateTime?` on all core entities            | Data recovery, audit trail, referential safety |
| **Audit fields**      | `createdAt`, `updatedAt` on every entity              | Traceability, debugging, compliance          |
| **Extensibility**     | `metadata Json?` on every core entity                 | Custom fields without schema migrations      |
| **UUIDs**             | `String @id @default(uuid())` for all primary keys    | Security, distributed systems, API safety    |
| **Schema-first**      | All structures defined in `schema.prisma` first       | Single source of truth for data model        |

### 1.3 Entity Classification

Entities fall into three categories:

**Tenant-scoped entities** — scoped to an organization via `organizationId`:
- Organization, Company, Contact, Lead, Vendor, Job, Task, Outreach, Note

**Cross-tenant entities** — belong to a user, not an organization:
- User, Account, Session (NextAuth managed)

**System entities** — infrastructure, not directly user-facing:
- OrganizationMember, ApiKey, AuditLog, IntegrationConnection, WebhookSubscription, WebhookDelivery, AiUsageLog

### 1.4 Naming Conventions

| Element          | Convention              | Example                         |
|------------------|-------------------------|---------------------------------|
| Table names      | PascalCase (Prisma)     | `Company`, `OrganizationMember` |
| Column names     | camelCase (Prisma)      | `organizationId`, `createdAt`   |
| DB table names   | snake_case (via `@@map`)| `companies`, `organization_members` |
| DB column names  | snake_case (via `@map`) | `organization_id`, `created_at` |
| Enum names       | PascalCase              | `CompanyStatus`, `LeadStage`    |
| Index names      | `<table>_<col>_idx`     | `company_organization_id_idx`   |
| Unique names     | `<table>_<col>_unique`  | `contact_email_org_unique`      |

---

## 2. Core Entities

### 2.1 Organization

The top-level tenant. Every piece of tenant-scoped data belongs to exactly one organization.

| Field         | Type       | Nullable | Default | Notes                           |
|---------------|------------|----------|---------|---------------------------------|
| `id`          | `UUID`     | NO       | auto    | Primary key                     |
| `name`        | `String`   | NO       | —       | Organization display name       |
| `slug`        | `String`   | NO       | —       | URL-safe unique identifier      |
| `plan`        | `Enum`     | NO       | `free`  | `free`, `pro`, `enterprise`     |
| `settings`    | `Json`     | YES      | —       | Org-level configuration         |
| `createdAt`   | `DateTime` | NO       | `now()` | Audit field                     |
| `updatedAt`   | `DateTime` | NO       | `now()` | Audit field                     |

**Indexes:**
- `@@unique([slug])` — slug must be globally unique
- `@@index([plan])` — filter by plan tier

---

### 2.2 User

A person who can authenticate and belong to one or more organizations.

| Field         | Type       | Nullable | Default | Notes                              |
|---------------|------------|----------|---------|------------------------------------|
| `id`          | `UUID`     | NO       | auto    | Primary key                        |
| `name`        | `String`   | YES      | —       | Display name                       |
| `email`       | `String`   | NO       | —       | Login email, globally unique       |
| `emailVerified`| `DateTime`| YES      | —       | NextAuth convention                |
| `image`       | `String`   | YES      | —       | Avatar URL                         |
| `password`    | `String`   | YES      | —       | Hashed (bcrypt), null for OAuth    |
| `lastLoginAt` | `DateTime` | YES      | —       | Track last authentication          |
| `createdAt`   | `DateTime` | NO       | `now()` | Audit field                        |
| `updatedAt`   | `DateTime` | NO       | `now()` | Audit field                        |

**Indexes:**
- `@@unique([email])` — email must be globally unique

**Relations:**
- Has many `Account` (NextAuth OAuth accounts)
- Has many `Session` (NextAuth sessions)
- Has many `OrganizationMember` (org memberships)

---

### 2.3 OrganizationMember

Join table between User and Organization. Stores the user's role within each organization.

| Field            | Type       | Nullable | Default  | Notes                          |
|------------------|------------|----------|----------|--------------------------------|
| `id`             | `UUID`     | NO       | auto     | Primary key                    |
| `organizationId` | `UUID`     | NO       | —        | FK → Organization              |
| `userId`         | `UUID`     | NO       | —        | FK → User                      |
| `role`           | `Enum`     | NO       | `member` | RBAC role within this org      |
| `joinedAt`       | `DateTime` | NO       | `now()`  | When the user joined           |
| `createdAt`      | `DateTime` | NO       | `now()`  | Audit field                    |
| `updatedAt`      | `DateTime` | NO       | `now()`  | Audit field                    |

**Indexes:**
- `@@unique([organizationId, userId])` — one membership per user per org
- `@@index([userId])` — find all orgs for a user

---

### 2.4 Company

A business entity that Blue Arc Networks interacts with — clients, partners, prospects.

| Field            | Type       | Nullable | Default  | Notes                            |
|------------------|------------|----------|----------|----------------------------------|
| `id`             | `UUID`     | NO       | auto     | Primary key                      |
| `organizationId` | `UUID`     | NO       | —        | FK → Organization                |
| `name`           | `String`   | NO       | —        | Company name                     |
| `domain`         | `String`   | YES      | —        | Website domain (e.g. `acme.com`) |
| `industry`       | `String`   | YES      | —        | Industry category                |
| `size`           | `Enum`     | YES      | —        | `startup`, `smb`, `mid`, `enterprise` |
| `status`         | `Enum`     | NO       | `prospect` | `prospect`, `active`, `churned` |
| `website`        | `String`   | YES      | —        | Full URL                         |
| `phone`          | `String`   | YES      | —        | Primary phone number             |
| `address`        | `Json`     | YES      | —        | Structured address object        |
| `metadata`       | `Json`     | YES      | —        | Custom fields                    |
| `deletedAt`      | `DateTime` | YES      | —        | Soft delete timestamp            |
| `createdAt`      | `DateTime` | NO       | `now()`  | Audit field                      |
| `updatedAt`      | `DateTime` | NO       | `now()`  | Audit field                      |

**Indexes:**
- `@@index([organizationId])` — scope queries to org
- `@@index([status])` — filter by status
- `@@index([organizationId, status])` — composite: org + status
- `@@index([organizationId, name])` — composite: org + name (search/sort)
- Full-text: GIN index on `name` + `domain` for search

---

### 2.5 Contact

An individual person associated with a Company.

| Field            | Type       | Nullable | Default   | Notes                            |
|------------------|------------|----------|-----------|----------------------------------|
| `id`             | `UUID`     | NO       | auto      | Primary key                      |
| `organizationId` | `UUID`     | NO       | —         | FK → Organization                |
| `companyId`      | `UUID`     | YES      | —         | FK → Company                     |
| `firstName`      | `String`   | NO       | —         | First name                       |
| `lastName`       | `String`   | YES      | —         | Last name                        |
| `email`          | `String`   | YES      | —         | Email (unique per org)           |
| `phone`          | `String`   | YES      | —         | Phone number                     |
| `title`          | `String`   | YES      | —         | Job title                        |
| `role`           | `Enum`     | YES      | —         | `decision_maker`, `influencer`, `user`, `admin` |
| `source`         | `String`   | YES      | —         | How the contact was acquired     |
| `status`         | `Enum`     | NO       | `active`  | `active`, `inactive`             |
| `metadata`       | `Json`     | YES      | —         | Custom fields                    |
| `deletedAt`      | `DateTime` | YES      | —         | Soft delete timestamp            |
| `createdAt`      | `DateTime` | NO       | `now()`   | Audit field                      |
| `updatedAt`      | `DateTime` | NO       | `now()`   | Audit field                      |

**Indexes:**
- `@@unique([organizationId, email])` — email unique within org (partial: where email IS NOT NULL and deletedAt IS NULL)
- `@@index([organizationId])` — scope queries to org
- `@@index([companyId])` — find contacts for a company
- `@@index([organizationId, status])` — composite: org + status
- `@@index([organizationId, lastName, firstName])` — composite: name search
- Full-text: GIN index on `firstName` + `lastName` + `email` for search

---

### 2.6 Lead

A sales opportunity tracked through a pipeline. May be associated with a Contact and/or Company.

| Field            | Type       | Nullable | Default    | Notes                            |
|------------------|------------|----------|------------|----------------------------------|
| `id`             | `UUID`     | NO       | auto       | Primary key                      |
| `organizationId` | `UUID`     | NO       | —          | FK → Organization                |
| `contactId`      | `UUID`     | YES      | —          | FK → Contact                     |
| `companyId`      | `UUID`     | YES      | —          | FK → Company                     |
| `title`          | `String`   | NO       | —          | Opportunity name                 |
| `stage`          | `Enum`     | NO       | `new`      | Pipeline stage                   |
| `value`          | `Decimal`  | YES      | —          | Estimated deal value             |
| `currency`       | `String`   | NO       | `"USD"`    | ISO 4217 currency code           |
| `probability`    | `Int`      | YES      | —          | Win probability 0–100            |
| `source`         | `String`   | YES      | —          | Lead source                      |
| `assignedToId`   | `UUID`     | YES      | —          | FK → User                        |
| `expectedClose`  | `DateTime` | YES      | —          | Expected close date              |
| `metadata`       | `Json`     | YES      | —          | Custom fields                    |
| `deletedAt`      | `DateTime` | YES      | —          | Soft delete timestamp            |
| `createdAt`      | `DateTime` | NO       | `now()`    | Audit field                      |
| `updatedAt`      | `DateTime` | NO       | `now()`    | Audit field                      |

**Indexes:**
- `@@index([organizationId])` — scope queries to org
- `@@index([organizationId, stage])` — composite: pipeline view
- `@@index([assignedToId])` — find leads for a user
- `@@index([companyId])` — find leads for a company
- `@@index([contactId])` — find leads for a contact
- `@@index([organizationId, expectedClose])` — composite: close date forecast

---

### 2.7 Vendor

A supplier or service provider that Blue Arc Networks works with.

| Field            | Type       | Nullable | Default     | Notes                            |
|------------------|------------|----------|-------------|----------------------------------|
| `id`             | `UUID`     | NO       | auto        | Primary key                      |
| `organizationId` | `UUID`     | NO       | —           | FK → Organization                |
| `name`           | `String`   | NO       | —           | Vendor name                      |
| `category`       | `String`   | YES      | —           | Vendor category                  |
| `contactName`    | `String`   | YES      | —           | Primary contact person           |
| `email`          | `String`   | YES      | —           | Contact email                    |
| `phone`          | `String`   | YES      | —           | Contact phone                    |
| `website`        | `String`   | YES      | —           | Vendor website                   |
| `status`         | `Enum`     | NO       | `active`    | `active`, `inactive`, `blacklisted` |
| `rating`         | `Int`      | YES      | —           | Rating 1–5                       |
| `notes`          | `String`   | YES      | —           | Quick notes (plain text)         |
| `metadata`       | `Json`     | YES      | —           | Custom fields                    |
| `deletedAt`      | `DateTime` | YES      | —           | Soft delete timestamp            |
| `createdAt`      | `DateTime` | NO       | `now()`     | Audit field                      |
| `updatedAt`      | `DateTime` | NO       | `now()`     | Audit field                      |

**Indexes:**
- `@@index([organizationId])` — scope queries to org
- `@@index([organizationId, status])` — composite: org + status
- `@@index([organizationId, name])` — composite: org + name (search/sort)
- Full-text: GIN index on `name` + `category` for search

---

### 2.8 Job

A project, engagement, or work order being tracked.

| Field            | Type       | Nullable | Default     | Notes                            |
|------------------|------------|----------|-------------|----------------------------------|
| `id`             | `UUID`     | NO       | auto        | Primary key                      |
| `organizationId` | `UUID`     | NO       | —           | FK → Organization                |
| `companyId`      | `UUID`     | YES      | —           | FK → Company                     |
| `title`          | `String`   | NO       | —           | Job title                        |
| `description`    | `String`   | YES      | —           | Job description                  |
| `status`         | `Enum`     | NO       | `draft`     | Job status                       |
| `priority`       | `Enum`     | NO       | `medium`    | Priority level                   |
| `type`           | `String`   | YES      | —           | Job type / category              |
| `startDate`      | `DateTime` | YES      | —           | Start date                       |
| `dueDate`        | `DateTime` | YES      | —           | Due date                         |
| `completedAt`    | `DateTime` | YES      | —           | Completion timestamp             |
| `assignedToId`   | `UUID`     | YES      | —           | FK → User                        |
| `value`          | `Decimal`  | YES      | —           | Job value                        |
| `metadata`       | `Json`     | YES      | —           | Custom fields                    |
| `deletedAt`      | `DateTime` | YES      | —           | Soft delete timestamp            |
| `createdAt`      | `DateTime` | NO       | `now()`     | Audit field                      |
| `updatedAt`      | `DateTime` | NO       | `now()`     | Audit field                      |

**Indexes:**
- `@@index([organizationId])` — scope queries to org
- `@@index([organizationId, status])` — composite: org + status
- `@@index([companyId])` — find jobs for a company
- `@@index([assignedToId])` — find jobs for a user
- `@@index([organizationId, dueDate])` — composite: upcoming deadlines

---

### 2.9 Task

An actionable item assigned to a user. Polymorphic — can be linked to any core entity.

| Field            | Type       | Nullable | Default        | Notes                            |
|------------------|------------|----------|----------------|----------------------------------|
| `id`             | `UUID`     | NO       | auto           | Primary key                      |
| `organizationId` | `UUID`     | NO       | —              | FK → Organization                |
| `title`          | `String`   | NO       | —              | Task title                       |
| `description`    | `String`   | YES      | —              | Task details                     |
| `status`         | `Enum`     | NO       | `todo`         | Task status                      |
| `priority`       | `Enum`     | NO       | `medium`       | Priority level                   |
| `dueDate`        | `DateTime` | YES      | —              | Due date                         |
| `completedAt`    | `DateTime` | YES      | —              | Completion timestamp             |
| `assignedToId`   | `UUID`     | YES      | —              | FK → User                        |
| `entityType`     | `Enum`     | YES      | —              | Polymorphic type discriminator   |
| `entityId`       | `UUID`     | YES      | —              | ID of the linked entity          |
| `metadata`       | `Json`     | YES      | —              | Custom fields                    |
| `deletedAt`      | `DateTime` | YES      | —              | Soft delete timestamp            |
| `createdAt`      | `DateTime` | NO       | `now()`        | Audit field                      |
| `updatedAt`      | `DateTime` | NO       | `now()`        | Audit field                      |

**Polymorphic link:** `entityType` + `entityId` together identify the parent entity. Valid `entityType` values: `company`, `contact`, `lead`, `job`, `vendor`, `outreach`.

**Indexes:**
- `@@index([organizationId])` — scope queries to org
- `@@index([organizationId, status])` — composite: org + status (task board)
- `@@index([assignedToId])` — find tasks for a user
- `@@index([entityType, entityId])` — composite: find tasks for any entity
- `@@index([organizationId, dueDate])` — composite: upcoming deadlines
- `@@index([organizationId, assignedToId, status])` — composite: user's task board

---

### 2.10 Outreach

A record of outreach activity — emails, calls, messages — sent to or received from a Contact or Lead.

| Field             | Type       | Nullable | Default     | Notes                            |
|-------------------|------------|----------|-------------|----------------------------------|
| `id`              | `UUID`     | NO       | auto        | Primary key                      |
| `organizationId`  | `UUID`     | NO       | —           | FK → Organization                |
| `contactId`       | `UUID`     | YES      | —           | FK → Contact                     |
| `leadId`          | `UUID`     | YES      | —           | FK → Lead                        |
| `type`            | `Enum`     | NO       | —           | Channel type                     |
| `direction`       | `Enum`     | NO       | —           | `inbound`, `outbound`            |
| `subject`         | `String`   | YES      | —           | Subject line (for emails)        |
| `body`            | `String`   | YES      | —           | Message body / summary           |
| `status`          | `Enum`     | NO       | `draft`     | Delivery status                  |
| `sentAt`          | `DateTime` | YES      | —           | When outreach was sent           |
| `respondedAt`     | `DateTime` | YES      | —           | When a response was received     |
| `channelMetadata` | `Json`     | YES      | —           | Channel-specific data (message ID, thread ID) |
| `createdBy`       | `Enum`     | NO       | `human`     | `human` or `ai`                  |
| `metadata`        | `Json`     | YES      | —           | Custom fields                    |
| `deletedAt`       | `DateTime` | YES      | —           | Soft delete timestamp            |
| `createdAt`       | `DateTime` | NO       | `now()`     | Audit field                      |
| `updatedAt`       | `DateTime` | NO       | `now()`     | Audit field                      |

**Indexes:**
- `@@index([organizationId])` — scope queries to org
- `@@index([contactId])` — find outreach for a contact
- `@@index([leadId])` — find outreach for a lead
- `@@index([organizationId, type])` — composite: org + channel type
- `@@index([organizationId, status])` — composite: org + status
- `@@index([organizationId, direction])` — composite: org + direction
- `@@index([organizationId, sentAt])` — composite: chronological view
- Full-text: GIN index on `subject` + `body` for search

---

### 2.11 Note

A freeform note attached to any entity. Supports markdown content and AI-generated summaries.

| Field            | Type       | Nullable | Default      | Notes                            |
|------------------|------------|----------|--------------|----------------------------------|
| `id`             | `UUID`     | NO       | auto         | Primary key                      |
| `organizationId` | `UUID`     | NO       | —            | FK → Organization                |
| `entityType`     | `Enum`     | NO       | —            | Polymorphic type discriminator   |
| `entityId`       | `UUID`     | NO       | —            | ID of the linked entity          |
| `title`          | `String`   | YES      | —            | Optional note title              |
| `content`        | `String`   | NO       | —            | Markdown content                 |
| `type`           | `Enum`     | NO       | `general`    | Note type                        |
| `isPinned`       | `Boolean`  | NO       | `false`      | Pin to top of list               |
| `authorType`     | `Enum`     | NO       | `human`      | `human` or `ai`                  |
| `metadata`       | `Json`     | YES      | —            | Custom fields                    |
| `deletedAt`      | `DateTime` | YES      | —            | Soft delete timestamp            |
| `createdAt`      | `DateTime` | NO       | `now()`      | Audit field                      |
| `updatedAt`      | `DateTime` | NO       | `now()`      | Audit field                      |

**Polymorphic link:** `entityType` + `entityId` together identify the parent entity. Valid `entityType` values: `company`, `contact`, `lead`, `job`, `vendor`, `outreach`.

**Indexes:**
- `@@index([organizationId])` — scope queries to org
- `@@index([entityType, entityId])` — composite: find notes for any entity
- `@@index([organizationId, isPinned])` — composite: pinned notes
- `@@index([organizationId, type])` — composite: filter by note type
- Full-text: GIN index on `title` + `content` for search

---

### 2.12 System Entities

These entities support infrastructure and are not directly user-facing CRM objects.

#### 2.12.1 Account (NextAuth)

OAuth provider accounts linked to a User.

| Field              | Type       | Nullable | Notes                           |
|--------------------|------------|----------|---------------------------------|
| `id`               | `UUID`     | NO       | Primary key                     |
| `userId`           | `UUID`     | NO       | FK → User                       |
| `type`             | `String`   | NO       | Provider type (oauth, email)    |
| `provider`         | `String`   | NO       | Provider id (google, github)    |
| `providerAccountId`| `String`   | NO       | Provider's user ID              |
| `refresh_token`    | `String`   | YES      | OAuth refresh token             |
| `access_token`     | `String`   | YES      | OAuth access token              |
| `expires_at`       | `Int`      | YES      | Token expiry (unix timestamp)   |
| `token_type`       | `String`   | YES      | Token type                      |
| `scope`            | `String`   | YES      | OAuth scope                     |
| `id_token`         | `String`   | YES      | OIDC id token                   |
| `session_state`    | `String`   | YES      | OAuth session state             |
| `createdAt`        | `DateTime` | NO       | Audit field                     |
| `updatedAt`        | `DateTime` | NO       | Audit field                     |

**Indexes:**
- `@@unique([provider, providerAccountId])` — one account per provider+id
- `@@index([userId])` — find accounts for a user

#### 2.12.2 Session (NextAuth)

Active user sessions.

| Field         | Type       | Nullable | Notes                           |
|---------------|------------|----------|---------------------------------|
| `id`          | `UUID`     | NO       | Primary key                     |
| `sessionToken`| `String`   | NO       | Unique session token            |
| `userId`      | `UUID`     | NO       | FK → User                       |
| `expires`     | `DateTime` | NO       | Session expiry                  |
| `createdAt`   | `DateTime` | NO       | Audit field                     |
| `updatedAt`   | `DateTime` | NO       | Audit field                     |

**Indexes:**
- `@@unique([sessionToken])`
- `@@index([userId])`

#### 2.12.3 ApiKey

Organization-scoped API keys for programmatic access.

| Field            | Type       | Nullable | Notes                              |
|------------------|------------|----------|------------------------------------|
| `id`             | `UUID`     | NO       | Primary key                        |
| `organizationId` | `UUID`     | NO       | FK → Organization                  |
| `name`           | `String`   | NO       | Human-readable key name            |
| `keyHash`        | `String`   | NO       | SHA-256 hash of the key            |
| `keyPrefix`      | `String`   | NO       | First 10 chars for identification  |
| `type`           | `Enum`     | NO       | `read_only`, `read_write`, `admin` |
| `scopes`         | `String[]` | YES      | Granted permission scopes          |
| `expiresAt`      | `DateTime` | YES      | Optional expiration                |
| `lastUsedAt`     | `DateTime` | YES      | Last usage timestamp               |
| `revokedAt`      | `DateTime` | YES      | Revocation timestamp               |
| `createdAt`      | `DateTime` | NO       | Audit field                        |
| `updatedAt`      | `DateTime` | NO       | Audit field                        |

**Indexes:**
- `@@unique([keyHash])` — hash must be unique
- `@@index([organizationId])` — find keys for an org
- `@@index([keyPrefix])` — lookup by prefix

#### 2.12.4 AuditLog

Immutable log of create/update/delete operations on all entities.

| Field            | Type       | Nullable | Notes                              |
|------------------|------------|----------|------------------------------------|
| `id`             | `UUID`     | NO       | Primary key                        |
| `organizationId` | `UUID`     | NO       | FK → Organization                  |
| `userId`         | `UUID`     | YES      | FK → User (who performed action)   |
| `action`         | `Enum`     | NO       | `create`, `update`, `delete`, `restore` |
| `entityType`     | `String`   | NO       | Entity model name                  |
| `entityId`       | `UUID`     | NO       | ID of the affected entity          |
| `changes`        | `Json`     | YES      | Diff of changed fields             |
| `ipAddress`      | `String`   | YES      | Client IP address                  |
| `userAgent`      | `String`   | YES      | Client user agent                  |
| `createdAt`      | `DateTime` | NO       | When the action occurred           |

**Indexes:**
- `@@index([organizationId])` — scope to org
- `@@index([organizationId, entityType, entityId])` — composite: entity history
- `@@index([userId])` — find actions by user
- `@@index([organizationId, createdAt])` — composite: chronological audit trail

#### 2.12.5 IntegrationConnection

OAuth connections to external services (Gmail, Google Calendar, etc.).

| Field            | Type       | Nullable | Notes                              |
|------------------|------------|----------|------------------------------------|
| `id`             | `UUID`     | NO       | Primary key                        |
| `organizationId` | `UUID`     | NO       | FK → Organization                  |
| `userId`         | `UUID`     | NO       | FK → User (who authorized)         |
| `provider`       | `Enum`     | NO       | `gmail`, `google_calendar`, `n8n`  |
| `status`         | `Enum`     | NO       | `active`, `expired`, `revoked`     |
| `accessToken`    | `String`   | YES      | Encrypted OAuth access token       |
| `refreshToken`   | `String`   | YES      | Encrypted OAuth refresh token      |
| `tokenExpiresAt` | `DateTime` | YES      | Token expiration                   |
| `scopes`         | `String[]` | YES      | Granted OAuth scopes               |
| `providerData`   | `Json`     | YES      | Provider-specific metadata         |
| `createdAt`      | `DateTime` | NO       | Audit field                        |
| `updatedAt`      | `DateTime` | NO       | Audit field                        |

**Indexes:**
- `@@unique([organizationId, userId, provider])` — one connection per user per provider per org
- `@@index([organizationId])` — find connections for an org
- `@@index([provider, status])` — find connections by provider + status

#### 2.12.6 WebhookSubscription

Outbound webhook registrations for an organization.

| Field            | Type       | Nullable | Notes                              |
|------------------|------------|----------|------------------------------------|
| `id`             | `UUID`     | NO       | Primary key                        |
| `organizationId` | `UUID`     | NO       | FK → Organization                  |
| `url`            | `String`   | NO       | Delivery URL                       |
| `secret`         | `String`   | NO       | HMAC signing secret                |
| `events`         | `String[]` | NO       | Subscribed event types             |
| `active`         | `Boolean`  | NO       | Whether subscription is active     |
| `createdAt`      | `DateTime` | NO       | Audit field                        |
| `updatedAt`      | `DateTime` | NO       | Audit field                        |

**Indexes:**
- `@@index([organizationId])` — find subscriptions for an org
- `@@index([organizationId, active])` — composite: active subscriptions

#### 2.12.7 WebhookDelivery

Immutable log of webhook delivery attempts.

| Field                | Type       | Nullable | Notes                            |
|----------------------|------------|----------|----------------------------------|
| `id`                 | `UUID`     | NO       | Primary key                      |
| `organizationId`     | `UUID`     | NO       | FK → Organization                |
| `subscriptionId`     | `UUID`     | NO       | FK → WebhookSubscription         |
| `eventType`          | `String`   | NO       | Event type that triggered this   |
| `payload`            | `Json`     | NO       | Delivery payload                 |
| `responseStatus`     | `Int`      | YES      | HTTP response status code        |
| `responseBody`       | `String`   | YES      | Response body (truncated)        |
| `status`             | `Enum`     | NO       | `pending`, `delivered`, `failed` |
| `attempts`           | `Int`      | NO       | Number of delivery attempts      |
| `lastAttemptAt`      | `DateTime` | YES      | Last attempt timestamp           |
| `createdAt`          | `DateTime` | NO       | Audit field                      |

**Indexes:**
- `@@index([subscriptionId])` — find deliveries for a subscription
- `@@index([organizationId, status])` — composite: find failed deliveries
- `@@index([createdAt])` — cleanup old deliveries

#### 2.12.8 AiUsageLog

Tracks AI token usage per organization for budget and billing.

| Field            | Type       | Nullable | Notes                              |
|------------------|------------|----------|------------------------------------|
| `id`             | `UUID`     | NO       | Primary key                        |
| `organizationId` | `UUID`     | NO       | FK → Organization                  |
| `userId`         | `UUID`     | YES      | FK → User (who triggered)          |
| `feature`        | `Enum`     | NO       | `research`, `outreach`, `summary`  |
| `provider`       | `String`   | NO       | AI provider name (openai, anthropic)|
| `model`          | `String`   | NO       | Model identifier                   |
| `inputTokens`    | `Int`      | NO       | Input token count                  |
| `outputTokens`   | `Int`      | NO       | Output token count                 |
| `totalTokens`    | `Int`      | NO       | Total token count                  |
| `cost`           | `Decimal`  | YES      | Estimated cost in USD              |
| `createdAt`      | `DateTime` | NO       | When the AI call was made          |

**Indexes:**
- `@@index([organizationId])` — usage per org
- `@@index([organizationId, createdAt])` — composite: usage over time
- `@@index([organizationId, feature])` — composite: usage per feature

---

## 3. Relationships

### 3.1 Foreign Key Definitions

| From Entity       | Field            | To Entity      | Field | On Delete     | On Update |
|-------------------|------------------|----------------|-------|---------------|-----------|
| OrganizationMember| `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| OrganizationMember| `userId`         | User           | `id`  | `Cascade`     | `Cascade` |
| Company           | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| Contact           | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| Contact           | `companyId`      | Company        | `id`  | `SetNull`     | `Cascade` |
| Lead              | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| Lead              | `contactId`      | Contact        | `id`  | `SetNull`     | `Cascade` |
| Lead              | `companyId`      | Company        | `id`  | `SetNull`     | `Cascade` |
| Lead              | `assignedToId`   | User           | `id`  | `SetNull`     | `Cascade` |
| Vendor            | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| Job               | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| Job               | `companyId`      | Company        | `id`  | `SetNull`     | `Cascade` |
| Job               | `assignedToId`   | User           | `id`  | `SetNull`     | `Cascade` |
| Task              | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| Task              | `assignedToId`   | User           | `id`  | `SetNull`     | `Cascade` |
| Outreach          | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| Outreach          | `contactId`      | Contact        | `id`  | `SetNull`     | `Cascade` |
| Outreach          | `leadId`         | Lead           | `id`  | `SetNull`     | `Cascade` |
| Note              | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| Account           | `userId`         | User           | `id`  | `Cascade`     | `Cascade` |
| Session           | `userId`         | User           | `id`  | `Cascade`     | `Cascade` |
| ApiKey            | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| AuditLog          | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| AuditLog          | `userId`         | User           | `id`  | `SetNull`     | `Cascade` |
| IntegrationConnection | `organizationId` | Organization | `id` | `Cascade`    | `Cascade` |
| IntegrationConnection | `userId`     | User           | `id`  | `Cascade`     | `Cascade` |
| WebhookSubscription | `organizationId` | Organization | `id`  | `Cascade`     | `Cascade` |
| WebhookDelivery   | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| WebhookDelivery   | `subscriptionId` | WebhookSubscription | `id` | `Cascade` | `Cascade` |
| AiUsageLog        | `organizationId` | Organization   | `id`  | `Cascade`     | `Cascade` |
| AiUsageLog        | `userId`         | User           | `id`  | `SetNull`     | `Cascade` |

**Cascade behavior rationale:**
- **`Cascade`** on `organizationId`: Deleting an organization must remove all its data. This is the multi-tenancy teardown path.
- **`SetNull`** on optional entity references: Deleting a Company should not destroy related Leads, Jobs, or Contacts — they may still have value independently. The `SetNull` preserves the record while removing the dangling reference.
- **`Cascade`** on `userId` in OrganizationMember/IntegrationConnection: Removing a user should remove their memberships and integration connections.
- **`SetNull`** on `assignedToId`/`userId` in AuditLog/AiUsageLog: Preserve audit trail and usage records even if the user is deleted.

### 3.2 Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│                              BLUE ARC OS — ENTITY RELATIONSHIP MAP                        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│                                    ┌──────────────┐                                      │
│                                    │     User     │                                      │
│                                    │──────────────│                                      │
│                                    │ id           │                                      │
│                                    │ email        │                                      │
│                                    │ name         │                                      │
│                                    └──────┬───────┘                                      │
│                                           │                                              │
│                              ┌────────────┼────────────────┐                             │
│                              │ 1:N        │ 1:N            │ 1:N                         │
│                              ▼            ▼                ▼                             │
│                    ┌──────────────┐  ┌────────────┐  ┌──────────────┐                   │
│                    │ Organization │  │  Account   │  │   Session    │                   │
│                    │──────────────│  │ (NextAuth) │  │  (NextAuth)  │                   │
│                    │ id           │  └────────────┘  └──────────────┘                   │
│                    │ name         │                                                      │
│                    │ slug         │  ┌──────────────────────────┐                       │
│                    │ plan         │  │  OrganizationMember      │                       │
│                    └──────┬───────┘  │──────────────────────────│                       │
│                           │         │ organizationId ──► Org   │                       │
│                           │         │ userId ──► User          │                       │
│                           │         │ role (Enum)              │                       │
│                           │         └──────────────────────────┘                       │
│                           │                                                             │
│            ┌──────────────┼────────────────────────────────────────────┐                │
│            │ 1:N          │ 1:N          │ 1:N          │ 1:N          │ 1:N           │
│            ▼              ▼              ▼              ▼              ▼                │
│   ┌──────────────┐ ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐        │
│   │   Company    │ │  Contact   │ │   Lead   │ │   Vendor   │ │     Job      │        │
│   │──────────────│ │────────────│ │──────────│ │────────────│ │──────────────│        │
│   │ organizationId│ │organizationId│ │organizationId│ │organizationId│ │ organizationId│     │
│   │ name         │ │ companyId ──┼─┐│ contactId│ │ name       │ │ companyId    │        │
│   │ domain       │ │ firstName  │ ││ companyId│ │ category   │ │ title        │        │
│   │ industry     │ │ lastName   │ ││ title    │ │ status     │ │ status       │        │
│   │ size         │ │ email      │ ││ stage    │ │ rating     │ │ priority     │        │
│   │ status       │ │ title      │ ││ value    │ └─────┬──────┘ │ assignedToId │        │
│   └──┬───────┬───┘ │ role       │ ││ assignedToId│      │         └──────┬───────┘        │
│      │       │     │ status     │ ││ expectedClose│     │                │                │
│      │       │     └──────┬─────┘ │└─────┬──────┘      │                │                │
│      │       │            │        │      │              │                │                │
│      │ 1:N   │ 1:N        │ 1:N    │ 1:N  │ 1:N          │ 1:N            │ 1:N           │
│      │       │            │        │      │              │                │                │
│      ▼       ▼            ▼        ▼      ▼              ▼                ▼                │
│ ┌────────┐ ┌────────┐ ┌──────────────────────────────────────────────────────────┐       │
│ │Contact │ │  Job   │ │                    POLYMORPHIC ENTITIES                   │       │
│ │(shown  │ │(shown  │ │                                                          │       │
│ │ above) │ │ above) │ │  ┌──────────────────┐    ┌──────────────────┐           │       │
│ └────────┘ └────────┘ │  │      Task        │    │      Note        │           │       │
│                       │  │──────────────────│    │──────────────────│           │       │
│                       │  │ organizationId   │    │ organizationId   │           │       │
│                       │  │ entityType (Enum)│    │ entityType (Enum)│           │       │
│                       │  │ entityId         │    │ entityId         │           │       │
│                       │  │ assignedToId     │    │ content          │           │       │
│                       │  │ status, priority │    │ type             │           │       │
│                       │  └──────────────────┘    │ isPinned         │           │       │
│                       │                          │ authorType       │           │       │
│                       │  ┌──────────────────┐    └──────────────────┘           │       │
│                       │  │    Outreach      │                                    │       │
│                       │  │──────────────────│                                    │       │
│                       │  │ organizationId   │                                    │       │
│                       │  │ contactId        │                                    │       │
│                       │  │ leadId           │                                    │       │
│                       │  │ type, direction  │                                    │       │
│                       │  │ status           │                                    │       │
│                       │  │ createdBy        │                                    │       │
│                       │  └──────────────────┘                                    │       │
│                       │                                                          │       │
│                       └──────────────────────────────────────────────────────────┘       │
│                                                                                          │
│  ┌────────────────────────────────────────────────────────────────────────────────┐      │
│  │                          SYSTEM ENTITIES                                        │      │
│  │                                                                                │      │
│  │  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐    │      │
│  │  │  ApiKey    │  │  AuditLog    │  │ IntegrationConn  │  │ AiUsageLog   │    │      │
│  │  │────────────│  │──────────────│  │──────────────────│  │──────────────│    │      │
│  │  │ organizationId│ │ organizationId│ │ organizationId  │  │ organizationId│   │      │
│  │  │ keyHash    │  │ entityType   │  │ userId           │  │ feature      │    │      │
│  │  │ type       │  │ entityId     │  │ provider         │  │ provider     │    │      │
│  │  │ scopes[]   │  │ action       │  │ accessToken      │  │ model        │    │      │
│  │  └────────────┘  │ changes      │  │ refreshToken     │  │ inputTokens  │    │      │
│  │                  └──────────────┘  └──────────────────┘  │ outputTokens │    │      │
│  │                                                          └──────────────┘    │      │
│  │  ┌──────────────────────┐  ┌──────────────────┐                              │      │
│  │  │ WebhookSubscription  │  │ WebhookDelivery  │                              │      │
│  │  │──────────────────────│  │──────────────────│                              │      │
│  │  │ organizationId       │  │ subscriptionId   │                              │      │
│  │  │ url                  │  │ eventType        │                              │      │
│  │  │ events[]             │  │ payload          │                              │      │
│  │  │ active               │  │ status           │                              │      │
│  │  └──────────────────────┘  │ attempts         │                              │      │
│  │                            └──────────────────┘                              │      │
│  └────────────────────────────────────────────────────────────────────────────────┘      │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Many-to-Many Relationships

There are **no explicit many-to-many join tables** required for the core CRM domain. All relationships are either 1:N or polymorphic. However, the following implicit many-to-many patterns exist:

| Pattern                    | Implementation                          | Notes                                   |
|----------------------------|-----------------------------------------|-----------------------------------------|
| User ↔ Organization        | `OrganizationMember` join table         | Carries `role` — not a pure M2M         |
| User → Tasks (assigned)    | 1:N from User to Task via `assignedToId`| A user has many tasks                   |
| User → Leads (assigned)    | 1:N from User to Lead via `assignedToId`| A user has many leads                   |
| User → Jobs (assigned)     | 1:N from User to Job via `assignedToId` | A user has many jobs                    |
| Entity → Notes             | 1:N polymorphic                         | Any entity has many notes               |
| Entity → Tasks             | 1:N polymorphic                         | Any entity has many tasks               |

### 3.4 Cascade Delete Behavior Summary

```
Organization deleted
  └─► CASCADE → all Companies, Contacts, Leads, Vendors, Jobs, Tasks,
                  Outreach, Notes, ApiKeys, AuditLogs, WebhookSubscriptions,
                  WebhookDeliveries, IntegrationConnections, AiUsageLogs,
                  OrganizationMembers

User deleted
  └─► CASCADE → Accounts, Sessions, OrganizationMembers, IntegrationConnections
  └─► SET NULL → Lead.assignedToId, Job.assignedToId, Task.assignedToId,
                  AuditLog.userId, AiUsageLog.userId

Company deleted (soft — sets deletedAt)
  └─► SET NULL → Contact.companyId, Lead.companyId, Job.companyId
  └─► Notes/Tasks remain (polymorphic, no FK to Company)

Contact deleted (soft — sets deletedAt)
  └─► SET NULL → Lead.contactId, Outreach.contactId
  └─► Notes/Tasks remain (polymorphic, no FK to Contact)
```

> **Note:** Core CRM entities (Company, Contact, Lead, Vendor, Job, Task, Outreach, Note) use **soft deletes** (`deletedAt`). The cascade behaviors above for `Company` and `Contact` apply when the record is hard-deleted (e.g., during org teardown). During normal operation, soft-deleted records remain in the database with `deletedAt` set, and their FK references remain intact.

---

## 4. Enums

### 4.1 Enum Definitions

#### `OrganizationPlan`

Subscription tier for the organization.

| Value        | Meaning                                     |
|--------------|---------------------------------------------|
| `free`       | Free tier, limited features and entities     |
| `pro`        | Paid tier, full CRM features                |
| `enterprise` | Enterprise tier, advanced features, SSO, SLA|

#### `MemberRole`

RBAC role for a user within an organization.

| Value         | Meaning                                                |
|---------------|--------------------------------------------------------|
| `owner`       | Full access, manage org settings, billing, members     |
| `admin`       | Full CRUD on all entities, manage integrations/members |
| `manager`     | Full CRUD on assigned entities, view reports           |
| `member`      | CRUD on assigned entities, view-only on others         |
| `viewer`      | Read-only access to all entities                       |

#### `CompanySize`

Company size classification.

| Value        | Meaning                        |
|--------------|--------------------------------|
| `startup`    | 1–10 employees                 |
| `smb`        | 11–50 employees (small-medium) |
| `mid`        | 51–500 employees (mid-market)  |
| `enterprise` | 500+ employees                 |

#### `CompanyStatus`

Lifecycle status of a Company.

| Value      | Meaning                                   |
|------------|-------------------------------------------|
| `prospect` | Potential client, not yet engaged         |
| `active`   | Active client relationship                |
| `churned`  | Former client, no longer active           |

#### `ContactRole`

The contact's role in the buying decision.

| Value             | Meaning                                    |
|-------------------|--------------------------------------------|
| `decision_maker`  | Has final approval authority               |
| `influencer`      | Influences the decision but doesn't approve|
| `user`            | End user of the product/service            |
| `admin`           | Administrative / technical contact         |

#### `ContactStatus`

| Value      | Meaning                          |
|------------|----------------------------------|
| `active`   | Currently engaged                |
| `inactive` | No longer engaged or responsive  |

#### `LeadStage`

Pipeline stage for a sales opportunity.

| Value          | Meaning                                     |
|----------------|---------------------------------------------|
| `new`          | Newly created, not yet qualified            |
| `qualified`    | Meets criteria, actively being pursued      |
| `proposal`     | Proposal or quote has been sent             |
| `negotiation`  | In negotiation / discussion phase           |
| `won`          | Deal closed successfully                    |
| `lost`         | Deal lost to competition or abandoned       |

#### `VendorStatus`

| Value        | Meaning                                   |
|--------------|-------------------------------------------|
| `active`     | Approved vendor, can be engaged           |
| `inactive`   | Temporarily unavailable or paused         |
| `blacklisted`| Banned from engagement                    |

#### `JobStatus`

| Value        | Meaning                                   |
|--------------|-------------------------------------------|
| `draft`      | Created but not yet started               |
| `active`     | Work in progress                          |
| `on_hold`    | Temporarily paused                        |
| `completed`  | All work finished                         |
| `cancelled`  | Cancelled before completion               |

#### `Priority`

Shared priority enum used by Job and Task.

| Value     | Meaning                          |
|-----------|----------------------------------|
| `low`     | Can wait, no urgency             |
| `medium`  | Normal priority, standard SLA    |
| `high`    | Needs attention soon             |
| `urgent`  | Immediate attention required     |

#### `TaskStatus`

| Value         | Meaning                          |
|---------------|----------------------------------|
| `todo`        | Not yet started                  |
| `in_progress` | Currently being worked on        |
| `done`        | Completed                        |
| `cancelled`   | Cancelled, will not be done      |

#### `OutreachType`

Communication channel for an outreach record.

| Value       | Meaning                          |
|-------------|----------------------------------|
| `email`     | Email communication              |
| `call`      | Phone call                       |
| `message`   | Direct message (Slack, SMS, etc.)|
| `linkedin`  | LinkedIn message/connection      |
| `other`     | Other channel                    |

#### `OutreachDirection`

| Value       | Meaning                          |
|-------------|----------------------------------|
| `inbound`   | Received from contact/lead       |
| `outbound`  | Sent to contact/lead             |

#### `OutreachStatus`

Delivery status of an outreach record.

| Value      | Meaning                                  |
|------------|------------------------------------------|
| `draft`    | Composed but not yet sent                |
| `sent`     | Successfully sent                        |
| `received` | Received from external party             |
| `replied`  | A reply has been received                |
| `bounced`  | Delivery failed (email bounced)          |

#### `AuthorType`

Shared enum for content authorship (used by Outreach and Note).

| Value   | Meaning                             |
|---------|-------------------------------------|
| `human` | Created by a human user             |
| `ai`    | Generated by an AI system           |

#### `NoteType`

| Value         | Meaning                                    |
|---------------|--------------------------------------------|
| `general`     | Freeform note                              |
| `meeting`     | Meeting notes / minutes                    |
| `ai_summary`  | AI-generated summary                       |
| `call_log`    | Log from a phone call                      |

#### `PolymorphicEntityType`

Discriminator for polymorphic relations (Task, Note).

| Value      | Maps to model |
|------------|---------------|
| `company`  | Company       |
| `contact`  | Contact       |
| `lead`     | Lead          |
| `job`      | Job           |
| `vendor`   | Vendor        |
| `outreach` | Outreach      |

#### `ApiKeyType`

| Value        | Meaning                              |
|--------------|--------------------------------------|
| `read_only`  | GET operations only                  |
| `read_write` | Full CRUD on permitted entities      |
| `admin`      | Full access including org settings   |

#### `AuditAction`

| Value     | Meaning                               |
|-----------|---------------------------------------|
| `create`  | Entity was created                    |
| `update`  | Entity was modified                   |
| `delete`  | Entity was (soft) deleted             |
| `restore` | Entity was restored from soft delete  |

#### `IntegrationProvider`

| Value             | Meaning                     |
|-------------------|-----------------------------|
| `gmail`           | Gmail API                   |
| `google_calendar` | Google Calendar API         |
| `n8n`             | n8n workflow automation     |

#### `IntegrationStatus`

| Value      | Meaning                              |
|------------|--------------------------------------|
| `active`   | Connection is valid and operational  |
| `expired`  | OAuth token has expired              |
| `revoked`  | User or provider revoked access      |

#### `WebhookDeliveryStatus`

| Value       | Meaning                             |
|-------------|-------------------------------------|
| `pending`   | Delivery not yet attempted          |
| `delivered` | Successfully delivered              |
| `failed`    | All retry attempts exhausted        |

#### `AiFeature`

| Value      | Meaning                              |
|------------|--------------------------------------|
| `research` | AI lead research agent               |
| `outreach` | AI outreach assistant                |
| `summary`  | AI note summarization                |

---

## 5. Indexes

### 5.1 Index Strategy

Indexes are organized into four tiers:

| Tier              | Purpose                                        | Example                                |
|-------------------|------------------------------------------------|----------------------------------------|
| **Primary keys**  | Enforced by Prisma `@id`                       | `Company.id`                           |
| **Foreign keys**  | Speed up joins and cascade deletes             | `Contact.organizationId`               |
| **Search**        | Full-text search via PostgreSQL `tsvector`     | `Company.name` + `Company.domain`      |
| **Composite**     | Common query patterns (list views, filtering)  | `Lead.organizationId + stage`          |

### 5.2 Primary Key Indexes

All entities use UUID primary keys. Prisma automatically creates a unique B-tree index on each `@id` field.

### 5.3 Foreign Key Indexes

Every `*Id` field that references another table gets an index. Prisma creates these implicitly for relation fields. Explicitly declared in the schema for clarity.

### 5.4 Full-Text Search Indexes

PostgreSQL `GIN` indexes on `tsvector` columns for full-text search. These are created via raw SQL migrations (Prisma does not natively support GIN indexes).

| Entity   | Columns indexed          | Search purpose                         |
|----------|--------------------------|----------------------------------------|
| Company  | `name`, `domain`         | Find companies by name or domain       |
| Contact  | `firstName`, `lastName`, `email` | Find contacts by name or email |
| Vendor   | `name`, `category`       | Find vendors by name or category       |
| Outreach | `subject`, `body`        | Search outreach content                |
| Note     | `title`, `content`       | Search note content                    |

**Implementation pattern (raw SQL migration):**

```sql
-- Example: full-text search index on Company
CREATE INDEX company_search_idx
  ON companies
  USING GIN (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(domain, ''))
  );
```

### 5.5 Composite Indexes

These are the most critical for CRM list views and dashboard queries.

| Entity  | Index columns                              | Query pattern                            |
|---------|--------------------------------------------|------------------------------------------|
| Company | `(organizationId, status)`                 | List companies by status within org      |
| Company | `(organizationId, name)`                   | Sort companies by name within org        |
| Contact | `(organizationId, status)`                 | List contacts by status within org       |
| Contact | `(organizationId, lastName, firstName)`    | Sort contacts by name within org         |
| Lead    | `(organizationId, stage)`                  | Kanban pipeline view                     |
| Lead    | `(organizationId, expectedClose)`          | Forecast view, close-date ordering       |
| Lead    | `(assignedToId)`                           | User's assigned leads                    |
| Vendor  | `(organizationId, status)`                 | List vendors by status                   |
| Vendor  | `(organizationId, name)`                   | Sort vendors by name                     |
| Job     | `(organizationId, status)`                 | List jobs by status                      |
| Job     | `(organizationId, dueDate)`                | Upcoming deadlines                       |
| Task    | `(organizationId, status)`                 | Task board view                          |
| Task    | `(organizationId, assignedToId, status)`   | User's task board                        |
| Task    | `(entityType, entityId)`                   | Tasks for a specific entity              |
| Task    | `(organizationId, dueDate)`                | Upcoming task deadlines                  |
| Outreach| `(organizationId, type)`                   | Filter by channel type                   |
| Outreach| `(organizationId, direction)`              | Filter inbound vs outbound               |
| Outreach| `(organizationId, sentAt)`                 | Chronological outreach view              |
| Note    | `(entityType, entityId)`                   | Notes for a specific entity              |
| Note    | `(organizationId, isPinned)`               | Pinned notes                             |
| AuditLog| `(organizationId, entityType, entityId)`   | Entity audit history                     |
| AuditLog| `(organizationId, createdAt)`              | Chronological audit trail                |
| AiUsageLog | `(organizationId, createdAt)`           | Usage over time                          |
| AiUsageLog | `(organizationId, feature)`             | Usage per feature                        |

### 5.6 Partial Indexes

Partial indexes reduce index size by only indexing rows that match a condition.

| Entity  | Index condition                        | Purpose                              |
|---------|----------------------------------------|--------------------------------------|
| Contact | `WHERE email IS NOT NULL AND deletedAt IS NULL` | Unique email per org (active only) |
| Company | `WHERE deletedAt IS NULL`              | Index only active companies          |
| Lead    | `WHERE deletedAt IS NULL`              | Index only active leads              |
| Task    | `WHERE status != 'done' AND deletedAt IS NULL` | Index only open tasks          |

---

## 6. Constraints

### 6.1 Unique Constraints

| Entity              | Columns                         | Condition                     | Notes                      |
|---------------------|---------------------------------|-------------------------------|----------------------------|
| Organization        | `slug`                          | —                             | Globally unique slug       |
| User                | `email`                         | —                             | Globally unique email      |
| OrganizationMember  | `(organizationId, userId)`      | —                             | One membership per user/org|
| Contact             | `(organizationId, email)`       | `email IS NOT NULL, deletedAt IS NULL` | Unique email per org (active) |
| Account             | `(provider, providerAccountId)` | —                             | One account per provider   |
| Session             | `sessionToken`                  | —                             | Unique session token       |
| ApiKey              | `keyHash`                       | —                             | Unique key hash            |
| IntegrationConnection | `(organizationId, userId, provider)` | —                  | One connection per user/provider/org |

### 6.2 Check Constraints

| Entity  | Constraint                         | Expression                              | Purpose                |
|---------|------------------------------------|-----------------------------------------|------------------------|
| Lead    | `probability_range`                | `probability >= 0 AND probability <= 100`| Valid probability      |
| Lead    | `value_positive`                   | `value >= 0`                            | Non-negative deal value|
| Vendor  | `rating_range`                     | `rating >= 1 AND rating <= 5`           | Valid rating           |
| Job     | `date_order`                       | `dueDate IS NULL OR startDate IS NULL OR dueDate >= startDate` | Due after start |

> **Note:** Check constraints are defined via raw SQL in Prisma migrations, as Prisma does not natively support `CHECK` constraints in the schema file.

### 6.3 Not-Null Constraints

All fields without `?` in the Prisma schema are `NOT NULL`. Key not-null constraints:

| Entity              | Field            | Rationale                                   |
|---------------------|------------------|---------------------------------------------|
| All tenant entities | `organizationId` | Multi-tenancy — every record must have an owner |
| All entities        | `createdAt`      | Audit trail — must always have a creation time |
| All entities        | `updatedAt`      | Audit trail — must always have an update time  |
| Company             | `name`           | Core identifier — cannot be empty           |
| Contact             | `firstName`      | Core identifier — cannot be empty           |
| Lead                | `title`          | Core identifier — cannot be empty           |
| Lead                | `stage`          | Pipeline — must always be in a stage        |
| Lead                | `currency`       | Financial — must have a currency (default USD) |
| Vendor              | `name`           | Core identifier — cannot be empty           |
| Job                 | `title`          | Core identifier — cannot be empty           |
| Task                | `title`          | Core identifier — cannot be empty           |
| Outreach            | `type`           | Channel — must know the type                |
| Outreach            | `direction`      | Direction — must know inbound vs outbound   |
| Note                | `entityType`     | Polymorphic — must know the target type     |
| Note                | `entityId`       | Polymorphic — must know the target ID       |
| Note                | `content`        | Content — a note without content is meaningless |

### 6.4 Default Values

| Entity              | Field         | Default     | Notes                          |
|---------------------|---------------|-------------|--------------------------------|
| Organization        | `plan`        | `free`      | New orgs start on free tier    |
| OrganizationMember  | `role`        | `member`    | Default role is member         |
| OrganizationMember  | `joinedAt`    | `now()`     | Set on creation                |
| Company             | `status`      | `prospect`  | New companies are prospects    |
| Contact             | `status`      | `active`    | New contacts are active        |
| Lead                | `stage`       | `new`       | New leads start in `new`       |
| Lead                | `currency`    | `"USD"`     | Default currency               |
| Vendor              | `status`      | `active`    | New vendors are active         |
| Job                 | `status`      | `draft`     | New jobs start as draft        |
| Job                 | `priority`    | `medium`    | Default priority               |
| Task                | `status`      | `todo`      | New tasks start in `todo`      |
| Task                | `priority`    | `medium`    | Default priority               |
| Outreach            | `status`      | `draft`     | New outreach starts as draft   |
| Outreach            | `createdBy`   | `human`     | Default to human author        |
| Note                | `type`        | `general`   | Default note type              |
| Note                | `isPinned`    | `false`     | Not pinned by default          |
| Note                | `authorType`  | `human`     | Default to human author        |
| WebhookSubscription | `active`      | `true`      | Active by default              |
| WebhookDelivery     | `attempts`    | `0`         | No attempts initially          |

---

## 7. Migration Strategy

### 7.1 Migration Workflow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Developer   │     │   Prisma     │     │  Supabase    │     │   Vercel     │
│   modifies    │────►│  generates   │────►│  applies     │────►│  deploys     │
│  schema.prisma│     │  migration   │     │  migration   │     │  new code    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

**Step-by-step process:**

1. **Modify `schema.prisma`** — Add, remove, or modify models/fields/relations.
2. **Generate migration** — `npx prisma migrate dev --name <descriptive_name>`
   - Creates a timestamped SQL migration file in `prisma/migrations/`.
   - Applies the migration to the development database.
   - Regenerates the Prisma Client.
3. **Review the generated SQL** — Ensure it matches expectations. Edit if necessary.
4. **Add raw SQL** (if needed) — For features Prisma doesn't support natively (GIN indexes, check constraints, triggers), append raw SQL to the migration file.
5. **Test locally** — Verify the migration works against a local database.
6. **Commit** — Commit both `schema.prisma` changes and the new migration file.
7. **Deploy** — CI/CD pipeline runs `npx prisma migrate deploy` against staging/production.

### 7.2 Migration Naming Convention

Use descriptive, snake_case names that explain the change:

```
20260707120000_init/
20260708100000_add_lead_stage_enum/
20260709140000_add_full_text_search_indexes/
20260710110000_add_api_key_table/
20260711150000_add_check_constraints/
```

### 7.3 Backward Compatibility Rules

| Rule | Description |
|------|-------------|
| **Additive-first** | Prefer adding new fields/tables over modifying existing ones. |
| **Nullable new columns** | New columns on existing tables must be nullable or have a default value. |
| **No destructive changes in a single deploy** | Split renames/drops into a multi-step process (see below). |
| **Enum additions are safe** | Adding new enum values is backward-compatible. Removing values is not. |
| **Index changes are safe** | Adding/dropping indexes does not break the application. |
| **API must tolerate both** | During a rename migration, the API must handle both old and new field names. |

### 7.4 Safe Column Rename Procedure

Renaming a column requires a 3-deploy sequence to avoid downtime:

| Step | Deploy | Action |
|------|--------|--------|
| 1    | Deploy A | Add new column. Write to **both** old and new columns. Read from old column. |
| 2    | Deploy B | Backfill new column from old column. Switch reads to new column. Continue writing to both. |
| 3    | Deploy C | Stop writing to old column. Drop old column in a subsequent migration. |

### 7.5 Rollback Procedures

| Scenario | Rollback Strategy |
|----------|-------------------|
| **Migration fails mid-apply** | Prisma migrations are transactional. A failure rolls back automatically. |
| **Bad data migration** | Write a reverse migration (`prisma migrate dev --create-only`), manually edit the SQL to undo changes. |
| **Schema change broke the app** | Revert the code deploy. The database schema may be ahead — ensure the previous code version is compatible with the new schema (backward compatibility rules). |
| **Full database restore** | Supabase provides point-in-time recovery (PITR) for production databases. Restore to a timestamp before the bad migration. |

### 7.6 Environment Strategy

| Environment  | Database                  | Migration method               |
|--------------|---------------------------|--------------------------------|
| Development  | Local PostgreSQL (Docker) | `prisma migrate dev`           |
| Preview      | Supabase preview branch   | `prisma migrate deploy` (CI)   |
| Staging      | Supabase staging project  | `prisma migrate deploy` (CI)   |
| Production   | Supabase production       | `prisma migrate deploy` (CI)   |

### 7.7 Seed Data

A seed script (`prisma/seed.ts`) provides initial data for development:

- A default Organization
- A test User with `owner` role
- Sample Companies, Contacts, Leads, Vendors, Jobs, Tasks
- Sample Outreach records and Notes

Run with: `npx prisma db seed`

---

## 8. Prisma Schema

Complete Prisma schema file (`prisma/schema.prisma`):

```prisma
// ============================================================================
// Blue Arc OS — Prisma Schema
// Database: PostgreSQL (Supabase)
// ============================================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}

// ============================================================================
// ENUMS
// ============================================================================

enum OrganizationPlan {
  free
  pro
  enterprise
}

enum MemberRole {
  owner
  admin
  manager
  member
  viewer
}

enum CompanySize {
  startup
  smb
  mid
  enterprise
}

enum CompanyStatus {
  prospect
  active
  churned
}

enum ContactRole {
  decision_maker
  influencer
  user
  admin
}

enum ContactStatus {
  active
  inactive
}

enum LeadStage {
  new
  qualified
  proposal
  negotiation
  won
  lost
}

enum VendorStatus {
  active
  inactive
  blacklisted
}

enum JobStatus {
  draft
  active
  on_hold
  completed
  cancelled
}

enum Priority {
  low
  medium
  high
  urgent
}

enum TaskStatus {
  todo
  in_progress
  done
  cancelled
}

enum OutreachType {
  email
  call
  message
  linkedin
  other
}

enum OutreachDirection {
  inbound
  outbound
}

enum OutreachStatus {
  draft
  sent
  received
  replied
  bounced
}

enum AuthorType {
  human
  ai
}

enum NoteType {
  general
  meeting
  ai_summary
  call_log
}

enum PolymorphicEntityType {
  company
  contact
  lead
  job
  vendor
  outreach
}

enum ApiKeyType {
  read_only
  read_write
  admin
}

enum AuditAction {
  create
  update
  delete
  restore
}

enum IntegrationProvider {
  gmail
  google_calendar
  n8n
}

enum IntegrationStatus {
  active
  expired
  revoked
}

enum WebhookDeliveryStatus {
  pending
  delivered
  failed
}

enum AiFeature {
  research
  outreach
  summary
}

// ============================================================================
// MODELS — Auth & Multi-Tenancy
// ============================================================================

model Organization {
  id        String           @id @default(uuid())
  name      String
  slug      String           @unique
  plan      OrganizationPlan @default(free)
  settings  Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  members              OrganizationMember[]
  companies            Company[]
  contacts             Contact[]
  leads                Lead[]
  vendors              Vendor[]
  jobs                 Job[]
  tasks                Task[]
  outreach             Outreach[]
  notes                Note[]
  apiKeys              ApiKey[]
  auditLogs            AuditLog[]
  integrationConnections IntegrationConnection[]
  webhookSubscriptions WebhookSubscription[]
  webhookDeliveries    WebhookDelivery[]
  aiUsageLogs          AiUsageLog[]

  @@map("organizations")
}

model User {
  id            String    @id @default(uuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  lastLoginAt   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // NextAuth relations
  accounts Account[]
  sessions Session[]

  // Org membership
  organizations        OrganizationMember[]

  // Assigned entities
  assignedLeads        Lead[]       @relation("AssignedLeads")
  assignedJobs         Job[]        @relation("AssignedJobs")
  assignedTasks        Task[]       @relation("AssignedTasks")

  // Authored audit logs
  auditLogs            AuditLog[]
  integrationConnections IntegrationConnection[]
  aiUsageLogs          AiUsageLog[]

  @@map("users")
}

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("sessions")
}

model OrganizationMember {
  id             String     @id @default(uuid())
  organizationId String
  userId         String
  role           MemberRole @default(member)
  joinedAt       DateTime   @default(now())

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId])
  @@index([userId])
  @@map("organization_members")
}

// ============================================================================
// MODELS — Core CRM Entities
// ============================================================================

model Company {
  id             String       @id @default(uuid())
  organizationId String
  name           String
  domain         String?
  industry       String?
  size           CompanySize?
  status         CompanyStatus @default(prospect)
  website        String?
  phone          String?
  address        Json?
  metadata       Json?
  deletedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  // Relations
  contacts  Contact[]
  leads     Lead[]
  jobs      Job[]

  @@index([organizationId])
  @@index([organizationId, status])
  @@index([organizationId, name])
  @@map("companies")
}

model Contact {
  id             String        @id @default(uuid())
  organizationId String
  companyId      String?
  firstName      String
  lastName       String?
  email          String?
  phone          String?
  title          String?
  role           ContactRole?
  source         String?
  status         ContactStatus @default(active)
  metadata       Json?
  deletedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  company      Company?     @relation(fields: [companyId], references: [id], onDelete: SetNull)

  // Relations
  leads     Lead[]
  outreach  Outreach[]

  @@unique([organizationId, email])
  @@index([organizationId])
  @@index([companyId])
  @@index([organizationId, status])
  @@index([organizationId, lastName, firstName])
  @@map("contacts")
}

model Lead {
  id             String     @id @default(uuid())
  organizationId String
  contactId      String?
  companyId      String?
  title          String
  stage          LeadStage  @default(new)
  value          Decimal?   @db.Decimal(12, 2)
  currency       String     @default("USD")
  probability    Int?
  source         String?
  assignedToId   String?
  expectedClose  DateTime?
  metadata       Json?
  deletedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  contact      Contact?     @relation(fields: [contactId], references: [id], onDelete: SetNull)
  company      Company?     @relation(fields: [companyId], references: [id], onDelete: SetNull)
  assignedTo   User?        @relation("AssignedLeads", fields: [assignedToId], references: [id], onDelete: SetNull)

  // Relations
  outreach Outreach[]

  @@index([organizationId])
  @@index([organizationId, stage])
  @@index([assignedToId])
  @@index([companyId])
  @@index([contactId])
  @@index([organizationId, expectedClose])
  @@map("leads")
}

model Vendor {
  id             String       @id @default(uuid())
  organizationId String
  name           String
  category       String?
  contactName    String?
  email          String?
  phone          String?
  website        String?
  status         VendorStatus @default(active)
  rating         Int?
  notes          String?
  metadata       Json?
  deletedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([organizationId, status])
  @@index([organizationId, name])
  @@map("vendors")
}

model Job {
  id             String     @id @default(uuid())
  organizationId String
  companyId      String?
  title          String
  description    String?
  status         JobStatus  @default(draft)
  priority       Priority   @default(medium)
  type           String?
  startDate      DateTime?
  dueDate        DateTime?
  completedAt    DateTime?
  assignedToId   String?
  value          Decimal?   @db.Decimal(12, 2)
  metadata       Json?
  deletedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  company      Company?     @relation(fields: [companyId], references: [id], onDelete: SetNull)
  assignedTo   User?        @relation("AssignedJobs", fields: [assignedToId], references: [id], onDelete: SetNull)

  @@index([organizationId])
  @@index([organizationId, status])
  @@index([companyId])
  @@index([assignedToId])
  @@index([organizationId, dueDate])
  @@map("jobs")
}

// ============================================================================
// MODELS — Polymorphic / Activity Entities
// ============================================================================

model Task {
  id             String        @id @default(uuid())
  organizationId String
  title          String
  description    String?
  status         TaskStatus    @default(todo)
  priority       Priority      @default(medium)
  dueDate        DateTime?
  completedAt    DateTime?
  assignedToId   String?
  entityType     PolymorphicEntityType?
  entityId       String?
  metadata       Json?
  deletedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  assignedTo   User?        @relation("AssignedTasks", fields: [assignedToId], references: [id], onDelete: SetNull)

  @@index([organizationId])
  @@index([organizationId, status])
  @@index([assignedToId])
  @@index([entityType, entityId])
  @@index([organizationId, dueDate])
  @@index([organizationId, assignedToId, status])
  @@map("tasks")
}

model Outreach {
  id              String           @id @default(uuid())
  organizationId  String
  contactId       String?
  leadId          String?
  type            OutreachType
  direction       OutreachDirection
  subject         String?
  body            String?
  status          OutreachStatus   @default(draft)
  sentAt          DateTime?
  respondedAt     DateTime?
  channelMetadata Json?
  createdBy       AuthorType       @default(human)
  metadata        Json?
  deletedAt       DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  contact      Contact?     @relation(fields: [contactId], references: [id], onDelete: SetNull)
  lead         Lead?        @relation(fields: [leadId], references: [id], onDelete: SetNull)

  @@index([organizationId])
  @@index([contactId])
  @@index([leadId])
  @@index([organizationId, type])
  @@index([organizationId, status])
  @@index([organizationId, direction])
  @@index([organizationId, sentAt])
  @@map("outreach")
}

model Note {
  id             String           @id @default(uuid())
  organizationId String
  entityType     PolymorphicEntityType
  entityId       String
  title          String?
  content        String
  type           NoteType         @default(general)
  isPinned       Boolean          @default(false)
  authorType     AuthorType       @default(human)
  metadata       Json?
  deletedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([entityType, entityId])
  @@index([organizationId, isPinned])
  @@index([organizationId, type])
  @@map("notes")
}

// ============================================================================
// MODELS — System / Infrastructure
// ============================================================================

model ApiKey {
  id             String     @id @default(uuid())
  organizationId String
  name           String
  keyHash        String     @unique
  keyPrefix      String
  type           ApiKeyType
  scopes         String[]
  expiresAt      DateTime?
  lastUsedAt     DateTime?
  revokedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([keyPrefix])
  @@map("api_keys")
}

model AuditLog {
  id             String      @id @default(uuid())
  organizationId String
  userId         String?
  action         AuditAction
  entityType     String
  entityId       String
  changes        Json?
  ipAddress      String?
  userAgent      String?

  createdAt DateTime @default(now()) @db.Timestamptz

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User?        @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([organizationId])
  @@index([organizationId, entityType, entityId])
  @@index([userId])
  @@index([organizationId, createdAt])
  @@map("audit_logs")
}

model IntegrationConnection {
  id             String              @id @default(uuid())
  organizationId String
  userId         String
  provider       IntegrationProvider
  status         IntegrationStatus   @default(active)
  accessToken    String?             @db.Text
  refreshToken   String?             @db.Text
  tokenExpiresAt DateTime?
  scopes         String[]
  providerData   Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([organizationId, userId, provider])
  @@index([organizationId])
  @@index([provider, status])
  @@map("integration_connections")
}

model WebhookSubscription {
  id             String   @id @default(uuid())
  organizationId String
  url            String
  secret         String
  events         String[]
  active         Boolean  @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  deliveries   WebhookDelivery[]

  @@index([organizationId])
  @@index([organizationId, active])
  @@map("webhook_subscriptions")
}

model WebhookDelivery {
  id             String               @id @default(uuid())
  organizationId String
  subscriptionId String
  eventType      String
  payload        Json
  responseStatus Int?
  responseBody   String?
  status         WebhookDeliveryStatus @default(pending)
  attempts       Int                   @default(0)
  lastAttemptAt  DateTime?

  createdAt DateTime @default(now())

  organization Organization       @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  subscription WebhookSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

  @@index([subscriptionId])
  @@index([organizationId, status])
  @@index([createdAt])
  @@map("webhook_deliveries")
}

model AiUsageLog {
  id             String    @id @default(uuid())
  organizationId String
  userId         String?
  feature        AiFeature
  provider       String
  model          String
  inputTokens    Int
  outputTokens   Int
  totalTokens    Int
  cost           Decimal?  @db.Decimal(10, 6)

  createdAt DateTime @default(now()) @db.Timestamptz

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User?        @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([organizationId])
  @@index([organizationId, createdAt])
  @@index([organizationId, feature])
  @@map("ai_usage_logs")
}
```

### 8.1 Raw SQL Migration Additions

The following must be added as raw SQL in migration files, as Prisma does not support them natively:

```sql
-- ============================================================================
-- Full-text search indexes (add in a migration after initial tables exist)
-- ============================================================================

-- Company search
CREATE INDEX company_search_idx
  ON companies
  USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(domain, '')));

-- Contact search
CREATE INDEX contact_search_idx
  ON contacts
  USING GIN (to_tsvector('english', coalesce("firstName", '') || ' ' || coalesce("lastName", '') || ' ' || coalesce(email, '')));

-- Vendor search
CREATE INDEX vendor_search_idx
  ON vendors
  USING GIN (to_tsvector('english', coalesce(name, '') || ' ' || coalesce(category, '')));

-- Outreach search
CREATE INDEX outreach_search_idx
  ON outreach
  USING GIN (to_tsvector('english', coalesce(subject, '') || ' ' || coalesce(body, '')));

-- Note search
CREATE INDEX note_search_idx
  ON notes
  USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || content));

-- ============================================================================
-- Check constraints
-- ============================================================================

ALTER TABLE leads ADD CONSTRAINT probability_range
  CHECK (probability IS NULL OR (probability >= 0 AND probability <= 100));

ALTER TABLE leads ADD CONSTRAINT value_positive
  CHECK (value IS NULL OR value >= 0);

ALTER TABLE vendors ADD CONSTRAINT rating_range
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

ALTER TABLE jobs ADD CONSTRAINT date_order
  CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date);

-- ============================================================================
-- Partial unique index for Contact email (active, non-null emails only)
-- ============================================================================

CREATE UNIQUE INDEX contact_email_org_active_unique
  ON contacts (organization_id, email)
  WHERE email IS NOT NULL AND deleted_at IS NULL;

-- ============================================================================
-- Soft-delete partial indexes (reduce index size for active records)
-- ============================================================================

CREATE INDEX company_active_idx
  ON companies (organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX lead_active_idx
  ON leads (organization_id, stage)
  WHERE deleted_at IS NULL;

CREATE INDEX task_open_idx
  ON tasks (organization_id, assigned_to_id, status)
  WHERE status != 'done' AND deleted_at IS NULL;

-- ============================================================================
-- Row-Level Security policies (defense-in-depth with Supabase)
-- ============================================================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Example RLS policy: organization members can access their org's companies
-- (In practice, policies are generated for each table based on the auth.uid() function)
-- CREATE POLICY org_isolation_companies ON companies
--   USING (organization_id = auth.jwt() ->> 'organizationId');
```

---

## Appendix A: Entity Count Summary

| Category            | Entity Count | Tables                              |
|---------------------|-------------|--------------------------------------|
| **Multi-tenancy**   | 4           | Organization, User, Account, Session |
| **Membership**      | 1           | OrganizationMember                   |
| **Core CRM**        | 5           | Company, Contact, Lead, Vendor, Job  |
| **Activity**        | 3           | Task, Outreach, Note                 |
| **Infrastructure**  | 7           | ApiKey, AuditLog, IntegrationConnection, WebhookSubscription, WebhookDelivery, AiUsageLog |
| **Total**           | **20**      |                                      |

## Appendix B: Table Size Estimates

| Entity              | Estimated row count (1000-org org, 1 year) | Growth driver           |
|---------------------|-------------------------------------------|-------------------------|
| Company             | ~500                                      | New clients             |
| Contact             | ~2,000                                    | Multiple per company    |
| Lead                | ~1,000                                    | Pipeline opportunities  |
| Vendor              | ~100                                      | Supplier list           |
| Job                 | ~500                                      | Projects per company    |
| Task                | ~5,000                                    | Action items            |
| Outreach            | ~10,000                                   | Email/call volume       |
| Note                | ~3,000                                    | Meeting notes, AI       |
| AuditLog            | ~50,000                                   | Every mutation          |
| AiUsageLog          | ~5,000                                    | AI feature usage        |
| WebhookDelivery     | ~2,000                                    | Outbound events         |

## Appendix C: Glossary

| Term                | Definition                                               |
|---------------------|----------------------------------------------------------|
| Soft delete         | Marking a record as deleted via `deletedAt` instead of removing it |
| Polymorphic relation| A relation that can reference multiple entity types via a type discriminator + ID pair |
| Multi-tenancy       | Architecture where each organization's data is isolated via `organizationId` |
| RLS                 | Row-Level Security — database-level access control enforced by PostgreSQL |
| PITR                | Point-In-Time Recovery — Supabase feature for database restoration |
| GIN index           | Generalized Inverted Index — used for full-text search in PostgreSQL |
| Cascade delete      | Automatically deleting child records when a parent is deleted |
| SetNull             | Setting a foreign key to NULL when the referenced record is deleted |
