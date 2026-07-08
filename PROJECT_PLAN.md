# Blue Arc OS — Project Plan

## Overview
A modern SaaS CRM platform built with Next.js, React, TypeScript, and Tailwind CSS. Inspired by tools like Linear, Notion, and modern dashboards.

## Milestones

### Milestone 1: App Shell (Current)
- Next.js project scaffold with TypeScript and Tailwind CSS
- Left sidebar navigation: Dashboard, Companies, Contacts, Leads, Vendors, Jobs, Tasks, Settings
- Main dashboard page with:
  - KPI cards (Revenue, Leads, Conversion Rate, Open Jobs, Response Time, Satisfaction)
  - Recent activity feed
  - Follow-ups due this week
  - Pipeline overview with deal stages
  - Upcoming tasks
- Light/dark mode support with toggle
- Mock data only — no database
- Modern, clean SaaS UI
- Responsive layout

### Milestone 2: Core Pages & Routing (Future)
- Companies list and detail pages
- Contacts management
- Leads pipeline with drag-and-drop kanban
- Vendor directory
- Job tracking
- Tasks board
- Settings page

### Milestone 3: State Management & Data Layer (Future)
- In-memory state management with React context / Zustand
- CRUD operations on mock data
- Search and filtering
- Form validation

### Milestone 4: Backend & Persistence (Future)
- API routes with Next.js
- Database integration (PostgreSQL / SQLite)
- Authentication and authorization
- Real data persistence

### Milestone 5: Polish & Production (Future)
- Animations and transitions
- Advanced filtering and sorting
- Export and reporting
- Performance optimization
- Deployment configuration
