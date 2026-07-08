# Blue Arc OS — Project Plan

## Overview
A field-service operating system for Blue Arc Networks. Manages bids, jobs, vendors, rate rules, travel/labor estimates, deliverables, and multi-party relationships (customer, vendor, MSP, property manager, contractor, partner). Built with Next.js, React, TypeScript, Tailwind CSS, Prisma, and PostgreSQL.

## Milestones

### Milestone 1: App Shell — COMPLETE
- Next.js 16 scaffold with TypeScript and Tailwind CSS 4
- Left sidebar navigation: Dashboard, Companies, Contacts, Leads, Vendors, Jobs, Tasks, Settings
- Dashboard with KPI cards, activity feed, follow-ups, pipeline, tasks
- Light/dark mode support
- Mock data only — no database
- Modern SaaS UI

### Milestone 2A: Architecture and Database Design — COMPLETE (Revision Pending)
- System architecture document
- Database schema (Prisma + PostgreSQL)
- API contracts (58 endpoints)
- UI component architecture
- AI agents strategy
- Security review

### Milestone 2B: Core Pages with Field-Service Entities (Future)
- Bid Manager (create, edit, submit bids)
- Job postings and job board
- Vendor platform (vendor directory, billing methods)
- Rate rules engine
- Travel and labor estimates
- Deliverables tracking
- Company relationship types (customer, vendor, MSP, property manager, contractor, partner)
- Lead-to-bid pipeline

### Milestone 3: State Management and API Layer (Future)
- Zustand for client-side state
- Service layer for business logic
- API routes matching contracts
- CRUD operations with Prisma
- Search and filtering

### Milestone 4: Authentication and Multi-Tenancy (Future)
- NextAuth.js (credentials + OAuth)
- Organization-based multi-tenancy
- RBAC (admin, manager, member, viewer)
- Row-level security

### Milestone 5: AI and Integrations (Future)
- AI Bid Manager / Job Opportunity Analyzer (priority 1)
- AI Outreach Assistant
- AI Note Summarization
- Gmail/Calendar/n8n integrations
- Webhook system

### Milestone 6: Polish and Production (Future)
- Animations and transitions
- Advanced reporting and export
- Performance optimization
- Deployment configuration
