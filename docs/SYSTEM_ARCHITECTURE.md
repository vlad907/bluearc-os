# Blue Arc OS — System Architecture

> Version: 1.0.0
> Last updated: 2026-07-07
> Status: Design phase

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Application Layers](#2-application-layers)
3. [Core Domains](#3-core-domains)
4. [Future AI Capabilities](#4-future-ai-capabilities)
5. [Integration Architecture](#5-integration-architecture)
6. [Security Architecture](#6-security-architecture)
7. [Folder Structure](#7-folder-structure)

---

## 1. System Overview

### 1.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                  │
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Next.js 16 App Router                          │  │
│  │                                                                   │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │  │
│  │  │   Pages     │  │   Layouts    │  │   Server Components     │  │  │
│  │  │  (routes)   │  │  (shell/UI)  │  │   (data fetching)       │  │  │
│  │  └──────┬──────┘  └──────────────┘  └────────────┬────────────┘  │  │
│  │         │                                         │               │  │
│  │  ┌──────┴──────────────────────────────────────────┴───────────┐  │  │
│  │  │              Client Components (interactive UI)             │  │  │
│  │  │   Forms · Tables · Kanban · Charts · Modals · Navigation    │  │  │
│  │  └──────────────────────────┬──────────────────────────────────┘  │  │
│  └─────────────────────────────┼─────────────────────────────────────┘  │
│                                │                                        │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │  fetch() / SWR / React Query
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          API LAYER                                     │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Next.js Route Handlers (/api/*)                     │  │
│  │                                                                  │  │
│  │  /api/companies    /api/contacts    /api/leads                   │  │
│  │  /api/vendors      /api/jobs        /api/tasks                   │  │
│  │  /api/outreach     /api/notes       /api/auth                    │  │
│  │  /api/ai           /api/webhooks    /api/integrations            │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
│                             │                                          │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                                    │
│                                                                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐  │
│  │  Company   │ │  Contact   │ │   Lead     │ │   Vendor           │  │
│  │  Service   │ │  Service   │ │  Service   │ │   Service          │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────────┘  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐  │
│  │   Job      │ │   Task     │ │  Outreach  │ │   Note             │  │
│  │  Service   │ │  Service   │ │  Service   │ │   Service          │  │
│  └────────────┘ └────────────┘ └────────────┘ └────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │              Cross-Cutting Services                            │    │
│  │  Auth Service · AI Service · Notification Service · Search     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                      │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     Prisma ORM                                   │  │
│  │                                                                  │  │
│  │  Schema · Migrations · Type-safe queries · Relations             │  │
│  └──────────────────────────┬───────────────────────────────────────┘  │
│                             │                                          │
│                             ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  PostgreSQL (Supabase)                           │  │
│  │                                                                  │  │
│  │  Tables · Indexes · Full-text search · Row-Level Security       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                   EXTERNAL INTEGRATIONS (Future)                       │
│                                                                        │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Gmail    │  │ Google       │  │  n8n     │  │  AI Services     │  │
│  │ API      │  │ Calendar API │  │ Workflows│  │  (OpenAI, etc.)  │  │
│  └──────────┘  └──────────────┘  └──────────┘  └──────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Tech Stack

| Layer            | Technology                          | Rationale                                        |
|------------------|-------------------------------------|--------------------------------------------------|
| **Framework**    | Next.js 16 (App Router)             | Full-stack React framework, SSR/SSG, API routes  |
| **UI Library**   | React 19                            | Server Components, concurrent features           |
| **Language**     | TypeScript 5                        | Type safety across the entire stack               |
| **Styling**      | Tailwind CSS 4                      | Utility-first, dark mode, responsive by default   |
| **ORM**          | Prisma                              | Type-safe database access, migrations, relations   |
| **Database**     | PostgreSQL (via Supabase)           | Relational data, JSON support, RLS, real-time      |
| **Auth**         | NextAuth.js (Auth.js v5)            | OAuth, credentials, session management            |
| **State**        | Zustand + React Context             | Lightweight client state, server state via fetch   |
| **Deployment**   | Vercel (app) + Supabase (data)      | Edge-optimized, serverless, managed infrastructure |
| **Validation**   | Zod                                 | Runtime type validation for API inputs             |
| **Testing**      | Vitest + React Testing Library      | Unit and integration tests                         |

### 1.3 Deployment Target

```
┌─────────────────────┐         ┌──────────────────────────┐
│      Vercel          │         │        Supabase           │
│                      │         │                           │
│  ┌────────────────┐  │         │  ┌─────────────────────┐ │
│  │  Edge Network   │  │         │  │  PostgreSQL DB      │ │
│  │  (CDN + SSR)    │  │  ────►  │  │  (primary data)     │ │
│  └────────────────┘  │         │  └─────────────────────┘ │
│  ┌────────────────┐  │         │  ┌─────────────────────┐ │
│  │  Serverless     │  │         │  │  Auth (optional)    │ │
│  │  Functions      │  │         │  │  (supplement)       │ │
│  └────────────────┘  │         │  └─────────────────────┘ │
│  ┌────────────────┐  │         │  ┌─────────────────────┐ │
│  │  Static Assets  │  │         │  │  Storage (future)   │ │
│  └────────────────┘  │         │  └─────────────────────┘ │
└─────────────────────┘         └──────────────────────────┘
```

- **Vercel**: Hosts the Next.js application (frontend + API routes). Provides edge caching, serverless functions, and preview deployments.
- **Supabase**: Hosts PostgreSQL database. Provides connection pooling, Row-Level Security, real-time subscriptions, and optional auth/storage supplements.
- **Environment separation**: Preview, staging, and production environments managed through Vercel branches and Supabase projects.

---

## 2. Application Layers

### 2.1 Frontend Layer (Next.js App Router)

The frontend is built on the Next.js 16 App Router with a clear separation between server-rendered and client-interactive components.

**Responsibilities:**
- Render pages and layouts using React Server Components by default
- Handle client-side interactivity (forms, drag-and-drop, modals) via Client Components
- Manage navigation and routing
- Fetch data from the API layer or directly via server-side Prisma calls (for server components)
- Manage client-side state (filters, UI toggles, optimistic updates)

**Key patterns:**
- **Server Components** for data-heavy pages (list views, detail views) — fetch directly from the service layer
- **Client Components** for interactive widgets (kanban boards, forms, charts) — communicate via API routes
- **Layouts** for persistent UI (sidebar, topbar, theme provider)
- **Loading/Error states** via `loading.tsx` and `error.tsx` conventions
- **Parallel routes** for independent data fetching sections (e.g., dashboard panels)

### 2.2 API Layer (Next.js Route Handlers)

All API endpoints are implemented as Next.js Route Handlers under `src/app/api/`.

**Responsibilities:**
- Accept and validate HTTP requests
- Authenticate and authorize the caller
- Delegate business logic to the service layer
- Return standardized JSON responses
- Handle errors with consistent error shapes

**Key patterns:**
- **Input validation** with Zod schemas at the route boundary
- **Standardized response format**: `{ data, meta, error }`
- **HTTP method handlers**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- **Middleware** for auth checks, rate limiting, and request logging
- **No business logic** in route handlers — they are thin controllers

**Response contract:**

```
Success:  { data: T, meta?: PaginationMeta }
Error:    { error: { code: string, message: string, details?: unknown } }
```

### 2.3 Service Layer (Business Logic)

The service layer contains all domain-specific business logic, decoupled from HTTP concerns and database implementation details.

**Responsibilities:**
- Encapsulate business rules and validation
- Orchestrate operations across multiple domains (e.g., creating a lead also creates a contact and a task)
- Enforce access control checks
- Manage transactions for multi-step operations
- Provide a clean interface consumed by both API routes and Server Components

**Key patterns:**
- One service file per domain (e.g., `company.service.ts`, `lead.service.ts`)
- Services accept plain objects / DTOs, not HTTP requests
- Services return domain entities, not database rows
- Cross-cutting concerns (logging, error mapping) handled via wrappers or middleware
- Future: services can be called from background jobs, webhooks, or AI agents without modification

### 2.4 Data Layer (Prisma ORM)

Prisma provides type-safe database access against PostgreSQL.

**Responsibilities:**
- Define the database schema (models, relations, indexes)
- Generate type-safe client for queries and mutations
- Manage schema migrations
- Provide connection pooling (via Prisma Accelerate or Supabase connection pooler)

**Key patterns:**
- **Single PrismaClient instance** shared across the application (singleton pattern)
- **Repository pattern** is intentionally NOT used — Prisma's generated client is already an abstraction; adding repositories creates unnecessary indirection for this project's scale
- **Schema-first design**: all data structures are defined in `schema.prisma` first
- **Soft deletes** via `deletedAt` timestamp field on core entities
- **Audit fields**: `createdAt`, `updatedAt` on every model (managed by Prisma)
- **Ownership fields**: `organizationId` on every tenant-scoped entity (multi-tenancy ready)

### 2.5 External Integrations Layer

External services are accessed through adapter modules that abstract third-party APIs behind internal interfaces.

**Responsibilities:**
- Wrap external API calls (Gmail, Calendar, n8n, AI providers)
- Handle authentication tokens, retries, and rate limiting for external services
- Transform external data formats into internal domain models
- Provide mock/stub implementations for testing

**Key patterns:**
- **Adapter pattern**: each integration implements a common interface (e.g., `EmailProvider`, `CalendarProvider`)
- **Fail-safe**: integration failures do not crash core CRM operations
- **Event-driven**: external events (incoming emails, calendar changes) are converted into internal webhook events
- **Lazy initialization**: integration clients are created on-demand, not at startup

---

## 3. Core Domains

### 3.1 Domain Model Overview

```
                    ┌──────────────┐
                    │ Organization │
                    └──────┬───────┘
                           │ 1
                           │
            ┌──────────────┼──────────────────┐
            │              │                   │
            ▼              ▼                   ▼
     ┌────────────┐ ┌───────────┐      ┌───────────┐
     │  Company   │ │  Vendor   │      │   User    │
     └─────┬──────┘ └───────────┘      └───────────┘
           │
           │ 1:N
           │
     ┌─────┴──────────────────────────┐
     │              │                  │
     ▼              ▼                  ▼
┌──────────┐  ┌──────────┐     ┌──────────┐
│ Contact  │  │   Job    │     │  Note    │
└────┬─────┘  └────┬─────┘     └──────────┘
     │              │
     │              │ 1:N
     ▼              ▼
┌──────────┐  ┌──────────┐
│  Lead    │  │   Task   │
└────┬─────┘  └──────────┘
     │
     │ 1:N
     ▼
┌──────────┐
│ Outreach │
└──────────┘
```

### 3.2 Domain Definitions

#### Organization
The top-level tenant. Every entity belongs to an organization. Enables future multi-tenancy.

| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | UUID     | Primary key                  |
| name            | String   | Organization name            |
| slug            | String   | URL-safe unique identifier   |
| plan            | Enum     | free, pro, enterprise        |
| createdAt       | DateTime |                              |
| updatedAt       | DateTime |                              |

#### Company

A business entity that Blue Arc Networks interacts with — clients, partners, prospects.

| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | UUID     | Primary key                  |
| organizationId  | UUID     | FK → Organization            |
| name            | String   | Company name                 |
| domain          | String?  | Website domain               |
| industry        | String?  | Industry category            |
| size            | Enum?    | startup, smb, mid, enterprise|
| status          | Enum     | prospect, active, churned    |
| website         | String?  |                              |
| phone           | String?  |                              |
| address         | JSON?    | Structured address           |
| metadata        | JSON?    | Custom fields                |
| deletedAt       | DateTime?| Soft delete                  |
| createdAt       | DateTime |                              |
| updatedAt       | DateTime |                              |

**Relations**: has many Contacts, has many Jobs, has many Notes

#### Contact

An individual person associated with a Company.

| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | UUID     | Primary key                  |
| organizationId  | UUID     | FK → Organization            |
| companyId       | UUID?    | FK → Company                 |
| firstName       | String   |                              |
| lastName        | String?  |                              |
| email           | String?  | Unique per org               |
| phone           | String?  |                              |
| title           | String?  | Job title                    |
| role            | Enum?    | decision_maker, influencer, user, admin |
| source          | String?  | How the contact was acquired |
| status          | Enum     | active, inactive             |
| metadata        | JSON?    | Custom fields                |
| deletedAt       | DateTime?| Soft delete                  |
| createdAt       | DateTime |                              |
| updatedAt       | DateTime |                              |

**Relations**: belongs to Company, has many Leads, has many Notes, has many Outreach

#### Lead

A sales opportunity or prospect being tracked through a pipeline.

| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | UUID     | Primary key                  |
| organizationId  | UUID     | FK → Organization            |
| contactId       | UUID?    | FK → Contact                 |
| companyId       | UUID?    | FK → Company                 |
| title           | String   | Lead title / opportunity name|
| stage           | Enum     | new, qualified, proposal, negotiation, won, lost |
| value           | Decimal? | Estimated deal value         |
| currency        | String   | Default USD                  |
| probability     | Int?     | 0-100 win probability        |
| source          | String?  | Lead source                  |
| assignedToId    | UUID?    | FK → User                    |
| expectedClose   | DateTime?| Expected close date          |
| metadata        | JSON?    | Custom fields                |
| deletedAt       | DateTime?| Soft delete                  |
| createdAt       | DateTime |                              |
| updatedAt       | DateTime |                              |

**Relations**: belongs to Contact, belongs to Company, has many Outreach, has many Tasks, has many Notes

#### Vendor

A supplier or service provider that Blue Arc Networks works with.

| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | UUID     | Primary key                  |
| organizationId  | UUID     | FK → Organization            |
| name            | String   | Vendor name                  |
| category        | String?  | Vendor category              |
| contactName     | String?  | Primary contact person       |
| email           | String?  |                              |
| phone           | String?  |                              |
| website         | String?  |                              |
| status          | Enum     | active, inactive, blacklisted|
| rating          | Int?     | 1-5 rating                   |
| notes           | String?  | Quick notes                  |
| metadata        | JSON?    | Custom fields                |
| deletedAt       | DateTime?| Soft delete                  |
| createdAt       | DateTime |                              |
| updatedAt       | DateTime |                              |

**Relations**: has many Notes

#### Job

A project, engagement, or work order being tracked.

| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | UUID     | Primary key                  |
| organizationId  | UUID     | FK → Organization            |
| companyId       | UUID?    | FK → Company                 |
| title           | String   | Job title                    |
| description     | String?  | Job description              |
| status          | Enum     | draft, active, on_hold, completed, cancelled |
| priority        | Enum     | low, medium, high, urgent    |
| type            | String?  | Job type / category          |
| startDate       | DateTime?|                              |
| dueDate         | DateTime?|                              |
| completedAt     | DateTime?|                              |
| assignedToId    | UUID?    | FK → User                    |
| value           | Decimal? | Job value                    |
| metadata        | JSON?    | Custom fields                |
| deletedAt       | DateTime?| Soft delete                  |
| createdAt       | DateTime |                              |
| updatedAt       | DateTime |                              |

**Relations**: belongs to Company, has many Tasks, has many Notes

#### Task

An actionable item assigned to a user, optionally linked to a domain entity.

| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | UUID     | Primary key                  |
| organizationId  | UUID     | FK → Organization            |
| title           | String   | Task title                   |
| description     | String?  | Task details                 |
| status          | Enum     | todo, in_progress, done, cancelled |
| priority        | Enum     | low, medium, high, urgent    |
| dueDate         | DateTime?|                              |
| completedAt     | DateTime?|                              |
| assignedToId    | UUID?    | FK → User                    |
| entityType      | String?  | Polymorphic: company, contact, lead, job, vendor |
| entityId        | UUID?    | ID of the linked entity      |
| metadata        | JSON?    | Custom fields                |
| deletedAt       | DateTime?| Soft delete                  |
| createdAt       | DateTime |                              |
| updatedAt       | DateTime |                              |

**Relations**: polymorphic link to any core entity, assigned to User

#### Outreach (new)

A record of outreach activity — emails, calls, messages — sent to or received from a Contact or Lead.

| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | UUID     | Primary key                  |
| organizationId  | UUID     | FK → Organization            |
| contactId       | UUID?    | FK → Contact                 |
| leadId          | UUID?    | FK → Lead                    |
| type            | Enum     | email, call, message, linkedin, other |
| direction       | Enum     | inbound, outbound            |
| subject         | String?  | Subject line (for emails)    |
| body            | String?  | Message body / summary       |
| status          | Enum     | draft, sent, received, replied, bounced |
| sentAt          | DateTime?| When the outreach was sent   |
| respondedAt     | DateTime?| When a response was received |
| channelMetadata | JSON?    | Channel-specific data (message ID, thread ID) |
| createdBy       | Enum     | human, ai                    |
| metadata        | JSON?    | Custom fields                |
| deletedAt       | DateTime?| Soft delete                  |
| createdAt       | DateTime |                              |
| updatedAt       | DateTime |                              |

**Relations**: belongs to Contact, belongs to Lead, has many Notes

#### Note (new)

A freeform note attached to any entity. Used for meeting notes, observations, AI summaries.

| Field           | Type     | Notes                        |
|-----------------|----------|------------------------------|
| id              | UUID     | Primary key                  |
| organizationId  | UUID     | FK → Organization            |
| entityType      | String   | Polymorphic type             |
| entityId        | UUID     | Polymorphic ID               |
| title           | String?  | Optional note title          |
| content         | String   | Markdown content             |
| type            | Enum     | general, meeting, ai_summary, call_log |
| isPinned        | Boolean  | Pin to top                   |
| authorType      | Enum     | human, ai                    |
| metadata        | JSON?    | Custom fields                |
| deletedAt       | DateTime?| Soft delete                  |
| createdAt       | DateTime |                              |
| updatedAt       | DateTime |                              |

**Relations**: polymorphic link to any core entity

### 3.3 Cross-Domain Relationships Summary

| From        | To           | Relationship | Notes                          |
|-------------|--------------|--------------|--------------------------------|
| Company     | Contact      | 1:N          | Company has many contacts      |
| Company     | Job          | 1:N          | Company has many jobs          |
| Company     | Note         | 1:N          | Via polymorphic notes          |
| Contact     | Lead         | 1:N          | Contact can have many leads    |
| Contact     | Outreach     | 1:N          | Contact has many outreach      |
| Lead        | Outreach     | 1:N          | Lead has many outreach records |
| Job         | Task         | 1:N          | Job has many tasks             |
| Any entity  | Note         | 1:N          | Polymorphic                    |
| Any entity  | Task         | 1:N          | Polymorphic                    |
| User        | Lead         | 1:N          | User assigned to leads         |
| User        | Job          | 1:N          | User assigned to jobs          |
| User        | Task         | 1:N          | User assigned to tasks         |

---

## 4. Future AI Capabilities

### 4.1 AI Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI SERVICE LAYER                                 │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    AI Gateway / Router                            │  │
│  │  (unified interface, provider abstraction, fallback, caching)    │  │
│  └──────────┬──────────────────┬──────────────────┬────────────────┘  │
│             │                  │                  │                    │
│             ▼                  ▼                  ▼                    │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐      │
│  │  Lead        │   │  Outreach    │   │  Note                │      │
│  │  Research    │   │  Assistant   │   │  Summarization       │      │
│  │  Agent       │   │              │   │                      │      │
│  └──────────────┘   └──────────────┘   └──────────────────────┘      │
│                                                                        │
└────────────────────────────────┬───────────────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐
   │  OpenAI /    │    │  Anthropic   │    │  Custom /        │
   │  Azure AI    │    │  Claude      │    │  Self-hosted     │
   └──────────────┘    └──────────────┘    └──────────────────┘
```

### 4.2 AI Lead Research Agent

**Purpose**: Automatically research a company or contact and generate a structured briefing.

**Inputs**:
- Company name, domain, industry
- Contact name, title, email
- Existing CRM data (previous interactions, notes)

**Outputs**:
- Company overview (size, revenue, recent news)
- Contact background (role, responsibilities, social presence)
- Suggested talking points and value propositions
- Recommended outreach strategy

**Integration points**:
- Triggered manually from Company or Contact detail page ("Research" button)
- Triggered automatically when a new Lead is created (configurable)
- Results stored as Notes with `type: ai_summary` and `authorType: ai`
- Uses web search APIs + LLM for synthesis

**Architecture**:
- `src/services/ai/lead-research.service.ts` — orchestrates the research flow
- `src/services/ai/providers/web-search.ts` — web search adapter
- `src/services/ai/providers/llm.ts` — LLM provider adapter
- Results cached and versioned (research can be re-run)

### 4.3 AI Outreach Assistant

**Purpose**: Help users draft, personalize, and optimize outreach messages.

**Capabilities**:
- **Draft generation**: Generate email/message drafts based on lead context, company research, and outreach history
- **Tone adjustment**: Rewrite messages for different tones (formal, casual, urgent)
- **Follow-up suggestions**: Suggest follow-up messages based on previous outreach and response patterns
- **Personalization**: Inject company-specific and contact-specific details into templates
- **Response analysis**: Analyze incoming responses and suggest next actions

**Integration points**:
- Embedded in the Outreach compose form ("AI Assist" button)
- Access to Contact, Company, Lead, and previous Outreach records for context
- Can generate sequences (multi-step outreach campaigns)

**Architecture**:
- `src/services/ai/outreach-assistant.service.ts` — core logic
- Prompts are versioned and stored in `src/services/ai/prompts/outreach/`
- Context assembly pulls relevant CRM data before calling the LLM

### 4.4 AI Note Summarization

**Purpose**: Condense long notes, meeting transcripts, or email threads into structured summaries.

**Capabilities**:
- Summarize meeting notes into action items and key decisions
- Extract key points from email threads
- Generate executive summaries from multiple related notes
- Tag and categorize note content automatically

**Integration points**:
- Available on any Note detail view ("Summarize" action)
- Can process imported meeting transcripts (from Google Calendar / Meet)
- Summaries stored as new Notes linked to the same entity

**Architecture**:
- `src/services/ai/note-summarization.service.ts` — core logic
- Chunking strategy for long content
- Structured output schema (summary, action_items, decisions, tags)

### 4.5 AI Integration Points

All AI capabilities share a common infrastructure:

| Component                | Purpose                                              |
|--------------------------|------------------------------------------------------|
| AI Gateway               | Unified interface, provider routing, fallback logic  |
| Provider Adapters        | OpenAI, Anthropic, Azure, self-hosted — swappable    |
| Prompt Registry          | Versioned, typed prompts stored as code              |
| Context Assembler        | Gathers relevant CRM data before LLM calls           |
| Token Budget Manager     | Tracks and limits token usage per request/org        |
| Response Cache           | Caches identical or similar AI requests              |
| Usage Tracker            | Logs AI usage per org, user, and feature             |
| Feature Flags            | Enable/disable AI features per organization or plan  |

---

## 5. Integration Architecture

### 5.1 Integration Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                    INTEGRATION LAYER                                  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                  Integration Registry                           │  │
│  │  (tracks which integrations are active per organization)       │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
│                               │                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────┐  │
│  │  Gmail     │ │  Google    │ │  n8n       │ │  Webhook         │  │
│  │  Adapter   │ │  Calendar  │ │  Adapter   │ │  Handler         │  │
│  │            │ │  Adapter   │ │            │ │                   │  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └────────┬─────────┘  │
│        │               │               │                 │            │
└────────┼───────────────┼───────────────┼─────────────────┼────────────┘
         │               │               │                 │
         ▼               ▼               ▼                 ▼
   ┌──────────┐   ┌──────────────┐ ┌──────────┐   ┌──────────────┐
   │ Gmail    │   │ Google       │ │  n8n     │   │  External    │
   │ API      │   │ Calendar API │ │  API     │   │  Systems     │
   └──────────┘   └──────────────┘ └──────────┘   └──────────────┘
```

### 5.2 Gmail API Integration (Future)

**Purpose**: Sync emails with Contacts and Leads, send outreach directly from the CRM.

**Capabilities**:
- OAuth 2.0 connection to user's Gmail account
- Watch for incoming emails via push notifications (Pub/Sub)
- Parse emails and match to existing Contacts (by email address)
- Create Outreach records from sent/received emails
- Send emails from within the CRM (drafted or AI-assisted)
- Thread tracking for conversation history

**Data flow**:
```
Gmail ──push──► Webhook ──► Email Parser ──► Contact Matcher ──► Outreach Record
CRM   ──send──► Gmail Adapter ──► Gmail API ──► Recipient
```

**Storage**:
- OAuth tokens encrypted at rest in the database
- Email body snippets cached (not full emails) for AI context
- Thread IDs stored in `Outreach.channelMetadata`

### 5.3 Google Calendar API Integration (Future)

**Purpose**: Sync meetings and events with CRM entities.

**Capabilities**:
- OAuth 2.0 connection to user's Google Calendar
- Detect meetings with external contacts (by email domain matching)
- Auto-create Notes from calendar events (meeting title, attendees, time)
- Suggest tasks follow-ups after meetings
- Display upcoming meetings on Contact and Company detail pages

**Data flow**:
```
Google Calendar ──push──► Webhook ──► Event Parser ──► Contact Matcher ──► Note/Task
```

### 5.4 n8n Workflow Automation (Future)

**Purpose**: Connect Blue Arc OS to external systems via automated workflows.

**Capabilities**:
- Trigger n8n workflows from CRM events (new lead, deal won, task completed)
- Receive webhooks from n8n workflows to update CRM records
- Pre-built workflow templates for common automations:
  - New lead → Slack notification
  - Deal won → Invoice creation
  - Task overdue → Escalation email
  - Contact added → Enrichment workflow

**Architecture**:
- `src/services/integrations/n8n.service.ts` — n8n API client
- Webhook endpoints at `/api/webhooks/n8n/*` for incoming triggers
- Outgoing events dispatched via an internal event bus
- n8n instance can be self-hosted or cloud

**Event bus**:
```
CRM Event ──► Event Bus ──► n8n Trigger
                          ──► Slack Trigger
                          ──► Custom Webhook
```

### 5.5 Webhook System

**Purpose**: Provide a generic mechanism for external systems to push events into Blue Arc OS.

**Inbound webhooks** (external → Blue Arc OS):
- Endpoint: `/api/webhooks/:provider/:action`
- Signature verification (HMAC-SHA256) for authenticity
- Idempotency keys to prevent duplicate processing
- Async processing via a job queue for heavy payloads

**Outbound webhooks** (Blue Arc OS → external):
- Organizations can register webhook URLs for specific events
- Events: `company.created`, `lead.stage_changed`, `task.completed`, etc.
- Retry logic with exponential backoff
- Delivery logs with payload inspection

**Webhook payload format**:
```
{
  "id": "evt_uuid",
  "type": "lead.stage_changed",
  "timestamp": "2026-07-07T12:00:00Z",
  "organizationId": "org_uuid",
  "data": { ... }
}
```

---

## 6. Security Architecture

### 6.1 Authentication Strategy

**Primary**: NextAuth.js (Auth.js v5)

**Supported providers** (phased rollout):

| Phase | Provider             | Method              | Notes                        |
|-------|----------------------|---------------------|------------------------------|
| 1     | Credentials          | Email + password    | Initial launch               |
| 2     | Google               | OAuth 2.0           | Social login                 |
| 3     | Microsoft            | OAuth 2.0 / OIDC    | Enterprise users             |
| 4     | SAML / SSO           | Enterprise SSO      | Organization-level SSO       |

**Session strategy**:
- JWT-based sessions (no database session store for phase 1)
- Short-lived access tokens (15 min) + rotating refresh tokens (7 days)
- Secure, HTTP-only, same-site cookies for session storage
- Token contains: `userId`, `organizationId`, `role`

**Password security**:
- bcrypt hashing (cost factor 12)
- Minimum 8 characters, complexity requirements
- Account lockout after 5 failed attempts (15 min cooldown)
- Password reset via time-limited, single-use tokens

### 6.2 Authorization Model (Role-Based Access Control)

**Roles** (per organization):

| Role       | Permissions                                                        |
|------------|--------------------------------------------------------------------|
| `owner`    | Full access, manage org settings, billing, members                 |
| `admin`    | Full CRUD on all entities, manage integrations, manage members     |
| `manager`  | Full CRUD on assigned entities, view reports, limited settings     |
| `member`   | CRUD on assigned entities, view-only on others                     |
| `viewer`   | Read-only access to all entities                                   |

**Implementation**:
- Role is stored on the `OrganizationMember` join table (user ↔ organization)
- Middleware checks role on every API route and Server Component data fetch
- Service layer enforces authorization before any operation
- Resource-level ownership: `assignedToId` restricts access for `member` role

**Authorization flow**:
```
Request ──► Auth Middleware (who are you?)
       ──► AuthZ Middleware (what can you do?)
       ──► Service Layer (execute with scoped permissions)
       ──► Data Layer (query scoped to organizationId)
```

### 6.3 API Key Management

**Purpose**: Allow programmatic access to the CRM for integrations and automation.

**Design**:
- Organization-scoped API keys (each key belongs to an organization)
- Key types:
  - **Read-only**: GET operations only
  - **Read-write**: Full CRUD on permitted entities
  - **Admin**: Full access including org settings
- Key format: `bao_<type>_<random_string>` (prefix for easy identification)
- Stored as SHA-256 hashes; only shown once at creation time
- Rate limiting per key (configurable per plan)
- Expiration dates (optional)
- Revocation at any time

**Storage**:
- `ApiKey` table: `id`, `organizationId`, `name`, `keyHash`, `type`, `scopes[]`, `expiresAt`, `lastUsedAt`, `createdAt`
- Keys validated via middleware on `/api/*` routes

### 6.4 Environment Variable Strategy

**Principles**:
- No secrets in code or version control
- Different values per environment (development, preview, staging, production)
- Validated at build/startup time (fail fast on missing vars)

**Categories**:

| Category          | Examples                                        | Scope        |
|-------------------|-------------------------------------------------|--------------|
| Database          | `DATABASE_URL`, `DIRECT_DATABASE_URL`           | Runtime      |
| Auth              | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`               | Runtime      |
| Auth Providers    | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`      | Runtime      |
| AI Services       | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`           | Runtime      |
| Integrations      | `GMAIL_CLIENT_ID`, `N8N_API_URL`, `N8N_API_KEY`| Runtime      |
| App Config        | `APP_URL`, `APP_ENV`, `LOG_LEVEL`              | Runtime      |
| Feature Flags     | `FEATURE_AI_ENABLED`, `FEATURE_OUTREACH_SYNC`  | Runtime      |

**Validation**:
- A single `src/env.ts` file defines all required and optional env vars using Zod
- Validated at build time (Next.js build) and at runtime (server start)
- Missing required vars cause a clear error message with the var name

**Access pattern**:
- Server-side only: env vars are never exposed to the client bundle
- Client-side config: explicitly exposed via `NEXT_PUBLIC_*` prefix (limited to non-sensitive values like `NEXT_PUBLIC_APP_URL`)

### 6.5 Additional Security Measures

| Concern                | Mitigation                                              |
|------------------------|---------------------------------------------------------|
| CSRF                   | SameSite cookies, CSRF tokens for mutations             |
| XSS                    | React auto-escaping, CSP headers, sanitize markdown     |
| SQL Injection          | Prisma parameterized queries (no raw SQL by default)    |
| Rate Limiting          | Per-IP and per-user rate limits on API routes           |
| Data Encryption        | TLS in transit, encryption at rest (Supabase default)   |
| Audit Logging          | Track create/update/delete on all entities              |
| Input Validation       | Zod schemas on every API input                          |
| Dependency Scanning    | Dependabot / Snyk for vulnerability alerts              |
| Row-Level Security     | Supabase RLS policies as defense-in-depth               |

---

## 7. Folder Structure

### 7.1 Proposed `src/` Directory Layout

```
src/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Auth route group (no sidebar layout)
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   ├── forgot-password/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   │
│   ├── (dashboard)/                  # Main app route group (sidebar layout)
│   │   ├── page.tsx                  # Dashboard home
│   │   ├── companies/
│   │   │   ├── page.tsx              # Companies list
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx          # Company detail
│   │   │   └── new/
│   │   │       └── page.tsx          # Create company
│   │   ├── contacts/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   ├── leads/
│   │   │   ├── page.tsx              # Kanban pipeline view
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   ├── vendors/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   ├── jobs/
│   │   │   ├── page.tsx
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   ├── tasks/
│   │   │   ├── page.tsx              # Task board
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── new/
│   │   │       └── page.tsx
│   │   ├── outreach/
│   │   │   ├── page.tsx              # Outreach inbox / list
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx
│   │   │   └── compose/
│   │   │       └── page.tsx
│   │   ├── notes/
│   │   │   └── page.tsx              # Global notes view (optional)
│   │   ├── settings/
│   │   │   ├── page.tsx              # General settings
│   │   │   ├── profile/
│   │   │   │   └── page.tsx
│   │   │   ├── organization/
│   │   │   │   └── page.tsx
│   │   │   ├── integrations/
│   │   │   │   └── page.tsx
│   │   │   ├── api-keys/
│   │   │   │   └── page.tsx
│   │   │   └── team/
│   │   │       └── page.tsx
│   │   └── layout.tsx                # Sidebar + topbar layout
│   │
│   ├── api/                          # API Route Handlers
│   │   ├── auth/
│   │   │   └── [...nextauth]/
│   │   │       └── route.ts          # NextAuth handler
│   │   ├── companies/
│   │   │   ├── route.ts              # GET (list), POST (create)
│   │   │   └── [id]/
│   │   │       └── route.ts          # GET, PATCH, DELETE
│   │   ├── contacts/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   ├── leads/
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   │   └── route.ts
│   │   │   └── [id]/
│   │   │       └── stage/
│   │   │           └── route.ts      # PATCH stage transitions
│   │   ├── vendors/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   ├── jobs/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   ├── tasks/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   ├── outreach/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   ├── notes/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       └── route.ts
│   │   ├── ai/
│   │   │   ├── research/
│   │   │   │   └── route.ts          # POST — trigger lead research
│   │   │   ├── outreach/
│   │   │   │   └── route.ts          # POST — generate outreach draft
│   │   │   └── summarize/
│   │   │       └── route.ts          # POST — summarize note
│   │   ├── webhooks/
│   │   │   ├── gmail/
│   │   │   │   └── route.ts
│   │   │   ├── calendar/
│   │   │   │   └── route.ts
│   │   │   ├── n8n/
│   │   │   │   └── route.ts
│   │   │   └── outbound/
│   │   │       └── route.ts          # Manage outbound webhook subscriptions
│   │   └── integrations/
│   │       ├── gmail/
│   │       │   ├── connect/
│   │       │   │   └── route.ts
│   │       │   └── callback/
│   │       │       └── route.ts
│   │       └── calendar/
│   │           ├── connect/
│   │           │   └── route.ts
│   │           └── callback/
│   │               └── route.ts
│   │
│   ├── layout.tsx                    # Root layout (html, body, providers)
│   ├── globals.css                   # Tailwind base styles
│   ├── providers.tsx                 # Client providers (theme, auth, query)
│   ├── loading.tsx                   # Global loading state
│   ├── not-found.tsx                 # 404 page
│   └── error.tsx                     # Global error boundary
│
├── components/                       # React components
│   ├── ui/                           # Primitive UI components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── modal.tsx
│   │   ├── table.tsx
│   │   ├── badge.tsx
│   │   ├── avatar.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── tooltip.tsx
│   │   ├── skeleton.tsx
│   │   ├── toast.tsx
│   │   └── index.ts                  # Barrel export
│   │
│   ├── layout/                       # Layout components
│   │   ├── sidebar.tsx
│   │   ├── topbar.tsx
│   │   ├── breadcrumbs.tsx
│   │   ├── page-header.tsx
│   │   └── theme-toggle.tsx
│   │
│   ├── dashboard/                    # Dashboard-specific components
│   │   ├── kpi-card.tsx
│   │   ├── activity-feed.tsx
│   │   ├── pipeline-overview.tsx
│   │   ├── follow-ups.tsx
│   │   └── upcoming-tasks.tsx
│   │
│   ├── companies/                    # Company domain components
│   │   ├── company-list.tsx
│   │   ├── company-card.tsx
│   │   ├── company-form.tsx
│   │   └── company-detail-header.tsx
│   │
│   ├── contacts/                     # Contact domain components
│   │   ├── contact-list.tsx
│   │   ├── contact-card.tsx
│   │   ├── contact-form.tsx
│   │   └── contact-detail-header.tsx
│   │
│   ├── leads/                        # Lead domain components
│   │   ├── lead-kanban.tsx
│   │   ├── lead-card.tsx
│   │   ├── lead-form.tsx
│   │   ├── lead-pipeline.tsx
│   │   └── lead-detail-header.tsx
│   │
│   ├── vendors/                      # Vendor domain components
│   │   ├── vendor-list.tsx
│   │   ├── vendor-card.tsx
│   │   ├── vendor-form.tsx
│   │   └── vendor-detail-header.tsx
│   │
│   ├── jobs/                         # Job domain components
│   │   ├── job-list.tsx
│   │   ├── job-card.tsx
│   │   ├── job-form.tsx
│   │   └── job-detail-header.tsx
│   │
│   ├── tasks/                        # Task domain components
│   │   ├── task-board.tsx
│   │   ├── task-card.tsx
│   │   ├── task-form.tsx
│   │   └── task-list.tsx
│   │
│   ├── outreach/                     # Outreach domain components
│   │   ├── outreach-list.tsx
│   │   ├── outreach-detail.tsx
│   │   ├── outreach-compose.tsx
│   │   └── outreach-thread.tsx
│   │
│   ├── notes/                        # Note domain components
│   │   ├── note-list.tsx
│   │   ├── note-editor.tsx
│   │   ├── note-card.tsx
│   │   └── note-timeline.tsx
│   │
│   ├── ai/                           # AI feature components
│   │   ├── ai-assist-button.tsx
│   │   ├── ai-research-panel.tsx
│   │   ├── ai-outreach-suggestions.tsx
│   │   └── ai-summary-badge.tsx
│   │
│   └── shared/                       # Shared / cross-cutting components
│       ├── data-table.tsx            # Reusable table with sorting/filtering
│       ├── empty-state.tsx
│       ├── confirm-dialog.tsx
│       ├── status-badge.tsx
│       ├── entity-link.tsx           # Polymorphic link to any entity
│       └── relative-time.tsx
│
├── services/                         # Business logic layer
│   ├── company.service.ts
│   ├── contact.service.ts
│   ├── lead.service.ts
│   ├── vendor.service.ts
│   ├── job.service.ts
│   ├── task.service.ts
│   ├── outreach.service.ts
│   ├── note.service.ts
│   ├── auth.service.ts
│   ├── organization.service.ts
│   │
│   ├── ai/                           # AI service modules
│   │   ├── ai-gateway.ts             # Unified AI interface
│   │   ├── lead-research.service.ts
│   │   ├── outreach-assistant.service.ts
│   │   ├── note-summarization.service.ts
│   │   ├── context-assembler.ts      # Gathers CRM data for AI prompts
│   │   ├── token-budget.ts
│   │   │
│   │   ├── providers/                # AI provider adapters
│   │   │   ├── types.ts              # Provider interface
│   │   │   ├── openai.ts
│   │   │   └── anthropic.ts
│   │   │
│   │   └── prompts/                  # Versioned prompt templates
│   │       ├── outreach/
│   │       │   ├── draft-email.ts
│   │       │   └── follow-up.ts
│   │       ├── research/
│   │       │   └── company-brief.ts
│   │       └── summarize/
│   │           └── meeting-notes.ts
│   │
│   └── integrations/                 # External integration adapters
│       ├── types.ts                  # Integration interfaces
│       ├── gmail/
│       │   ├── gmail.service.ts
│       │   ├── gmail.parser.ts
│       │   └── gmail.sync.ts
│       ├── calendar/
│       │   ├── calendar.service.ts
│       │   └── calendar.sync.ts
│       ├── n8n/
│       │   └── n8n.service.ts
│       └── webhook/
│           ├── webhook.service.ts    # Outbound webhook dispatcher
│           └── webhook.validator.ts  # Inbound webhook signature check
│
├── lib/                              # Shared utilities and infrastructure
│   ├── db.ts                         # Prisma client singleton
│   ├── auth.ts                       # NextAuth configuration
│   ├── auth-options.ts               # Auth providers, callbacks
│   ├── env.ts                        # Environment variable validation (Zod)
│   ├── utils.ts                      # General utilities (cn, formatDate, etc.)
│   ├── constants.ts                  # App-wide constants
│   ├── errors.ts                     # Custom error classes
│   ├── response.ts                   # Standardized API response helpers
│   ├── validation/                   # Zod schemas
│   │   ├── company.schema.ts
│   │   ├── contact.schema.ts
│   │   ├── lead.schema.ts
│   │   ├── vendor.schema.ts
│   │   ├── job.schema.ts
│   │   ├── task.schema.ts
│   │   ├── outreach.schema.ts
│   │   ├── note.schema.ts
│   │   └── common.schema.ts          # Shared schemas (pagination, etc.)
│   │
│   ├── middleware/                    # API middleware
│   │   ├── auth.middleware.ts         # Authentication check
│   │   ├── authz.middleware.ts        # Authorization / role check
│   │   ├── rate-limit.middleware.ts
│   │   ├── validate.middleware.ts     # Input validation wrapper
│   │   └── logging.middleware.ts
│   │
│   └── hooks/                        # Custom React hooks
│       ├── use-auth.ts
│       ├── use-debounce.ts
│       ├── use-local-storage.ts
│       ├── use-media-query.ts
│       └── use-toast.ts
│
├── store/                            # Client-side state (Zustand)
│   ├── theme-store.ts                # Light/dark mode
│   ├── sidebar-store.ts              # Sidebar open/collapsed state
│   ├── filter-store.ts               # Global filter state
│   └── ui-store.ts                   # Transient UI state
│
├── types/                            # TypeScript type definitions
│   ├── index.ts                      # Re-exports
│   ├── domain.ts                     # Domain entity types (Company, Contact, etc.)
│   ├── api.ts                        # API request/response types
│   ├── auth.ts                       # Auth-related types
│   └── integrations.ts              # Integration-specific types
│
├── data/                             # Mock data (transitional — remove after DB)
│   └── mock-data.ts
│
└── context/                          # React Context providers (transitional)
    └── theme-context.tsx
```

### 7.2 API Routes Structure Summary

```
/api
├── /auth/[...nextauth]          # NextAuth session management
│
├── /companies                   # GET (list+filter), POST (create)
├── /companies/[id]              # GET, PATCH, DELETE
│
├── /contacts                    # GET (list+filter), POST (create)
├── /contacts/[id]               # GET, PATCH, DELETE
│
├── /leads                       # GET (list+filter+pipeline), POST (create)
├── /leads/[id]                  # GET, PATCH, DELETE
├── /leads/[id]/stage            # PATCH (stage transition)
│
├── /vendors                     # GET (list+filter), POST (create)
├── /vendors/[id]                # GET, PATCH, DELETE
│
├── /jobs                        # GET (list+filter), POST (create)
├── /jobs/[id]                   # GET, PATCH, DELETE
│
├── /tasks                       # GET (list+filter+board), POST (create)
├── /tasks/[id]                  # GET, PATCH, DELETE
│
├── /outreach                    # GET (list+filter+inbox), POST (create/send)
├── /outreach/[id]               # GET, PATCH, DELETE
│
├── /notes                       # GET (list+filter), POST (create)
├── /notes/[id]                  # GET, PATCH, DELETE
│
├── /ai/research                 # POST — trigger AI lead research
├── /ai/outreach                 # POST — generate AI outreach draft
├── /ai/summarize                # POST — summarize note content
│
├── /webhooks/gmail              # POST — Gmail push notifications
├── /webhooks/calendar           # POST — Calendar push notifications
├── /webhooks/n8n                # POST — n8n workflow callbacks
├── /webhooks/outbound           # GET (list), POST (create), DELETE
│
└── /integrations/gmail/connect      # GET — initiate OAuth flow
    /integrations/gmail/callback     # GET — OAuth callback
    /integrations/calendar/connect   # GET — initiate OAuth flow
    /integrations/calendar/callback  # GET — OAuth callback
```

### 7.3 Service Layer Organization

```
services/
│
├── Core Domain Services          # One per domain entity
│   ├── company.service.ts        # CRUD + business rules for companies
│   ├── contact.service.ts        # CRUD + business rules for contacts
│   ├── lead.service.ts           # CRUD + pipeline transitions
│   ├── vendor.service.ts         # CRUD + business rules for vendors
│   ├── job.service.ts            # CRUD + status management
│   ├── task.service.ts           # CRUD + assignment logic
│   ├── outreach.service.ts       # CRUD + send/receive tracking
│   └── note.service.ts           # CRUD + polymorphic entity linking
│
├── Cross-Cutting Services
│   ├── auth.service.ts           # User management, session helpers
│   └── organization.service.ts   # Org settings, member management
│
├── AI Services                   # AI feature implementations
│   ├── ai-gateway.ts             # Provider-agnostic AI interface
│   ├── lead-research.service.ts
│   ├── outreach-assistant.service.ts
│   ├── note-summarization.service.ts
│   └── context-assembler.ts
│
└── Integration Services          # External system adapters
    ├── gmail/
    ├── calendar/
    ├── n8n/
    └── webhook/
```

### 7.4 Key Architectural Decisions

| #  | Decision                                | Rationale                                                  |
|----|-----------------------------------------|------------------------------------------------------------|
| 1  | No repository layer                     | Prisma client is already a clean abstraction; repositories add indirection without benefit at this scale |
| 2  | Service layer is mandatory              | Keeps route handlers thin and business logic testable/reusable |
| 3  | Polymorphic relations for Notes/Tasks   | Avoids N join tables; acceptable trade-off for a CRM with well-defined entity types |
| 4  | UUIDs for all primary keys              | Better for distributed systems, APIs, and security (no enumeration) |
| 5  | Soft deletes on all core entities       | Data recovery, audit trail, referential integrity            |
| 6  | `organizationId` on every entity        | Multi-tenancy ready; simplifies data scoping and RLS         |
| 7  | `metadata` JSON field on every entity   | Extensibility without schema changes for custom fields       |
| 8  | Route groups for layout separation      | Auth pages and dashboard pages have different layouts         |
| 9  | Domain-organized components             | Easier to find and maintain components as the app grows      |
| 10 | Zustand over Redux                      | Minimal boilerplate, good TypeScript support, small bundle   |

---

## Appendix A: Migration Path from Current State

The current codebase (Milestone 1) uses mock data and client-side state. The migration to the full architecture proceeds incrementally:

| Step | Milestone | Changes                                                        |
|------|-----------|----------------------------------------------------------------|
| 1    | Current   | Mock data, static UI, no API                                   |
| 2    | M2        | Add page routes, build domain components, add Zustand stores   |
| 3    | M3        | Add API routes, service layer, connect to mock via API         |
| 4    | M4        | Add Prisma + PostgreSQL, replace mock with real data           |
| 5    | M4        | Add NextAuth.js authentication and authorization               |
| 6    | M5        | Add integrations (Gmail, Calendar), webhooks                   |
| 7    | M5+       | Add AI services (research, outreach, summarization)            |
| 8    | M5+       | Polish, performance, multi-tenancy hardening                   |

## Appendix B: Glossary

| Term              | Definition                                                  |
|-------------------|-------------------------------------------------------------|
| Entity            | A core domain object (Company, Contact, Lead, etc.)         |
| Outreach          | A record of communication (email, call, message)            |
| Polymorphic       | A relation that can point to multiple entity types          |
| Route Group       | Next.js App Router feature for layout organization          |
| Route Handler     | Next.js API endpoint (replaces API Routes from Pages Router)|
| Server Component  | React component rendered on the server (default in App Router) |
| Client Component  | React component rendered in the browser (marked with `"use client"`) |
| RLS               | Row-Level Security — database-level access control          |
