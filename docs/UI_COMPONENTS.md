# Blue Arc OS — UI Component Architecture

> Version: 1.0.0
> Last updated: 2026-07-07
> Status: Design phase
> Implementation note: This is a design-phase document and may lead or lag the code. See [MILESTONE_REPORT.md](../MILESTONE_REPORT.md) and `src/components/` for what is actually built.
> Companion documents: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) · [DATABASE.md](./DATABASE.md) · [API_CONTRACTS.md](./API_CONTRACTS.md)

---

## Table of Contents

1. [Component Architecture Overview](#1-component-architecture-overview)
2. [Layout Components](#2-layout-components)
3. [Core UI Components](#3-core-ui-components)
4. [Domain-Specific Components](#4-domain-specific-components)
5. [Form Components](#5-form-components)
6. [Data Display Components](#6-data-display-components)
7. [Navigation Components](#7-navigation-components)
8. [Feedback Components](#8-feedback-components)
9. [Theme and Styling](#9-theme-and-styling)
10. [Accessibility](#10-accessibility)
11. [Responsive Design](#11-responsive-design)
12. [Component File Structure](#12-component-file-structure)

---

## 1. Component Architecture Overview

### 1.1 Component Hierarchy and Organization

Components are organized into four tiers based on their level of abstraction and domain specificity:

```
┌─────────────────────────────────────────────────────────────────────┐
│  TIER 4: PAGE COMPOSITIONS                                          │
│  app/*/page.tsx — Assemble layout + domain components for a route   │
├─────────────────────────────────────────────────────────────────────┤
│  TIER 3: DOMAIN COMPONENTS                                          │
│  components/{domain}/ — CompanyCard, LeadKanban, OutreachCompose    │
├─────────────────────────────────────────────────────────────────────┤
│  TIER 2: SHARED / COMPOSITE COMPONENTS                              │
│  components/shared/ — DataTable, EmptyState, ConfirmDialog          │
├─────────────────────────────────────────────────────────────────────┤
│  TIER 1: PRIMITIVE UI COMPONENTS                                    │
│  components/ui/ — Button, Input, Badge, Modal, Skeleton, Toast      │
├─────────────────────────────────────────────────────────────────────┤
│  TIER 0: LAYOUT COMPONENTS                                          │
│  components/layout/ — Sidebar, Topbar, PageHeader, Breadcrumbs      │
└─────────────────────────────────────────────────────────────────────┘
```

**Dependency rule:** Higher tiers depend on lower tiers. Lower tiers never import from higher tiers. Domain components may use primitives and shared components. Primitives never import domain components.

### 1.2 Design System Principles

| Principle | Implementation | Rationale |
|-----------|---------------|-----------|
| **Server-first** | React Server Components by default; `"use client"` only when interactivity is required | Minimizes JS bundle, leverages Next.js 16 App Router |
| **Composition** | Small, single-purpose components composed together | Flexibility, testability, reuse across domains |
| **Utility-first styling** | Tailwind CSS 4 classes; no custom CSS files beyond `globals.css` | Consistency, dark mode via `dark:` variant, rapid iteration |
| **Type safety** | TypeScript interfaces for all props; domain types from `types/domain.ts` | Compile-time error prevention, IDE autocomplete |
| **Progressive disclosure** | Simple defaults; advanced behavior via optional props | Low barrier to use, extensible when needed |
| **Accessible by default** | Semantic HTML, ARIA attributes, keyboard navigation, focus management baked into primitives | WCAG 2.1 AA compliance without extra effort per page |

### 1.3 Server vs. Client Component Strategy

| Component type | Default | When to use `"use client"` |
|----------------|---------|---------------------------|
| Pages | Server | Only if page needs client state |
| Layout (Sidebar, Topbar) | Client | Needs `usePathname`, theme toggle |
| Domain list views | Server | Fetch data server-side via service layer |
| Domain forms | Client | Needs form state, validation, submission |
| DataTable | Client | Sorting, filtering, pagination are interactive |
| Kanban / drag-drop | Client | Requires DOM interaction |
| Cards (display-only) | Server | Just render data passed as props |
| Modals, dialogs | Client | Needs open/close state |
| Toasts | Client | Needs global state (Zustand or context) |

### 1.4 Reusability Strategy

**Extract-to-primitive threshold:** If a UI pattern appears in 3+ places, extract it into `components/ui/`. Current candidates already visible in the codebase:

- **Card container** — repeated in every dashboard widget and list page (`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl`)
- **Section header** — repeated in dashboard panels (`px-5 py-4 border-b border-gray-200 dark:border-gray-800`)
- **Table shell** — repeated in companies, leads, tasks pages
- **Badge** — repeated for status, priority, stage across all list views
- **Primary button** — repeated as `+ Add X` on every page
- **Secondary button** — repeated for "Export" and similar actions
- **Checkbox** — repeated in tasks page and dashboard

---

## 2. Layout Components

### 2.1 Sidebar

**Location:** `src/components/layout/Sidebar.tsx`
**Status:** Exists (Milestone 1) — needs enhancement

**Current state:** Fixed-width (w-64) sidebar with logo, navigation links, user section, and theme toggle. Uses inline SVG icons.

**Planned enhancements:**
- Collapsible state (expanded ↔ icon-only) via `sidebar-store.ts` (Zustand)
- Mobile: slide-out drawer with overlay, triggered from Topbar hamburger
- Active route highlighting (already implemented via `usePathname`)
- Keyboard navigation: arrow keys between items, Enter to activate
- ARIA: `role="navigation"`, `aria-label="Main navigation"`
- Route groups: respect `(auth)` vs `(dashboard)` layout separation

**Props (target):**
```
SidebarProps:
  collapsed?: boolean
  onToggle?: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
```

### 2.2 Topbar (Header)

**Location:** `src/components/layout/Topbar.tsx`
**Status:** Planned — does not exist yet

**Purpose:** Top bar for search, notifications, and user menu. Currently the page header area is handled inline by each page.

**Props:**
```
TopbarProps:
  onMenuToggle?: () => void        // mobile sidebar trigger
  showSearch?: boolean             // show global search bar
  notificationCount?: number       // unread notification badge
```

**Contents:**
- Hamburger menu button (mobile only)
- Global `SearchBar` component (Cmd+K shortcut)
- Notification bell with count badge
- User avatar dropdown (profile, settings, logout)

### 2.3 PageHeader

**Location:** `src/components/layout/PageHeader.tsx`
**Status:** Exists (Milestone 1) — needs enhancement

**Current state:** Accepts `title`, `description`, and optional `action` node.

**Planned enhancements:**
- Add `breadcrumb` prop for navigation context
- Support multiple actions (action group)
- Add `tabs` prop for page-level tab navigation
- Responsive: stack title and actions vertically on mobile

**Props (target):**
```
PageHeaderProps:
  title: string
  description?: string
  breadcrumb?: BreadcrumbItem[]
  action?: ReactNode           // single action or action group
  tabs?: TabItem[]             // optional page-level tabs
```

### 2.4 Breadcrumbs

**Location:** `src/components/layout/Breadcrumbs.tsx`
**Status:** Planned

**Purpose:** Hierarchical navigation trail.

**Props:**
```
BreadcrumbsProps:
  items: { label: string; href?: string }[]
```

**Behavior:**
- Last item is current page (rendered as text, not link)
- Separated by `/` or chevron icon
- Truncate middle items on mobile with ellipsis dropdown
- ARIA: `aria-label="Breadcrumb"`, `<nav>` with `aria-current="page"` on last item

### 2.5 Page Wrapper

**Status:** Not yet extracted — currently inline `p-6 lg:p-8` on every page

**Purpose:** Standardize page content padding and max-width.

**Props:**
```
PageWrapperProps:
  children: ReactNode
  fullWidth?: boolean          // remove max-width constraint
  padding?: "none" | "sm" | "md" | "lg"
```

**Default classes:** `p-6 lg:p-8 max-w-[1600px] mx-auto`

### 2.6 Grid Systems

**Status:** Used inline — needs standardization

**Predefined grid patterns:**

| Name | Classes | Use case |
|------|---------|----------|
| KPI grid | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4` | Dashboard KPI cards |
| Dashboard grid | `grid-cols-1 lg:grid-cols-2 gap-6` | Dashboard widget pairs |
| Card grid | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4` | Entity card lists |
| Form grid | `grid-cols-1 md:grid-cols-2 gap-4` | Two-column form layouts |
| Settings grid | `grid-cols-1 lg:grid-cols-3 gap-6` | Settings page (sidebar + content) |

---

## 3. Core UI Components

All primitive UI components live in `src/components/ui/`. They are domain-agnostic, accept className overrides, and support dark mode via Tailwind's `dark:` variant.

### 3.1 Button

**Location:** `src/components/ui/button.tsx`
**Status:** Planned — currently inline `<button>` elements throughout

**Purpose:** Clickable action trigger.

**Props:**
```
ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>:
  variant?: "primary" | "secondary" | "ghost" | "danger" | "link"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  icon?: ReactNode
  iconPosition?: "left" | "right"
  asChild?: boolean              // render as child element (for links)
```

**Variants:**

| Variant | Classes | Usage |
|---------|---------|-------|
| `primary` | `bg-indigo-600 text-white hover:bg-indigo-700` | Main actions: Save, Create, Submit |
| `secondary` | `bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800` | Secondary actions: Export, Cancel |
| `ghost` | `text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800` | Subtle actions: menu triggers, inline actions |
| `danger` | `bg-red-600 text-white hover:bg-red-700` | Destructive actions: Delete, Remove |
| `link` | `text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline` | Navigation, "Learn more" |

**Sizes:**

| Size | Classes | Usage |
|------|---------|-------|
| `sm` | `px-3 py-1.5 text-xs` | Table row actions, inline |
| `md` | `px-4 py-2 text-sm` | Default — forms, headers |
| `lg` | `px-6 py-3 text-base` | Hero CTAs, auth pages |

**Loading state:** Shows spinner, disables interaction, preserves width.

**Accessibility:** Focus ring (`focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`), disabled state via `aria-disabled`, loading announced via `aria-busy`.

**Usage examples:**
```
<Button variant="primary">+ Add Company</Button>
<Button variant="secondary" icon={<ExportIcon />}>Export</Button>
<Button variant="ghost" size="sm" icon={<MoreIcon />} />
<Button variant="danger" loading={isDeleting}>Delete</Button>
```

### 3.2 Input

**Location:** `src/components/ui/input.tsx`
**Status:** Planned

**Purpose:** Text input field.

**Props:**
```
InputProps extends InputHTMLAttributes<HTMLInputElement>:
  error?: string
  icon?: ReactNode               // left icon
  rightElement?: ReactNode       // right slot (button, icon)
  fullWidth?: boolean
```

**Types supported:** `text`, `email`, `password`, `number`, `tel`, `url`, `search`

**Error state:** Red border (`border-red-500`), error message rendered below input.

**Accessibility:** Label association via `id`/`htmlFor`, `aria-invalid` when error present, `aria-describedby` pointing to error message.

### 3.3 Select

**Location:** `src/components/ui/select.tsx`
**Status:** Planned

**Purpose:** Dropdown selection.

**Props:**
```
SelectProps:
  options: { value: string; label: string; disabled?: boolean }[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  error?: string
  disabled?: boolean
  searchable?: boolean           // enable type-to-filter for long lists
```

**Variants:**
- Single select (default)
- Multi-select with tag chips (future, for filter bars)

**Accessibility:** ARIA `listbox` pattern, keyboard navigation (arrow keys, Enter, Escape, type-ahead).

### 3.4 Checkbox

**Location:** `src/components/ui/checkbox.tsx`
**Status:** Planned — currently inline in tasks page

**Purpose:** Boolean toggle or multi-select.

**Props:**
```
CheckboxProps:
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
  indeterminate?: boolean        // for "select all" headers
```

**Current pattern to extract:** The task checkbox in `tasks/page.tsx` (w-4 h-4 rounded border-2 with checkmark SVG).

### 3.5 Radio

**Location:** `src/components/ui/radio.tsx`
**Status:** Planned

**Purpose:** Single selection from a group.

**Props:**
```
RadioGroupProps:
  name: string
  value?: string
  onValueChange?: (value: string) => void
  children: ReactNode

RadioProps:
  value: string
  label: string
  disabled?: boolean
```

### 3.6 Toggle / Switch

**Location:** `src/components/ui/toggle.tsx`
**Status:** Planned

**Purpose:** Binary on/off toggle for settings.

**Props:**
```
ToggleProps:
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
  size?: "sm" | "md"
```

**Usage:** Settings page toggles (email notifications, AI features, integration switches).

### 3.7 Textarea

**Location:** `src/components/ui/textarea.tsx`
**Status:** Planned

**Props:**
```
TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>:
  error?: string
  resize?: "none" | "vertical" | "auto"
  maxLength?: number
  showCount?: boolean
```

**Usage:** Note content (markdown), job descriptions, outreach body, metadata.

### 3.8 Badge

**Location:** `src/components/ui/badge.tsx`
**Status:** Planned — badge patterns are repeated across every list view

**Purpose:** Small label for status, priority, stage, type.

**Props:**
```
BadgeProps:
  variant?: "default" | "success" | "warning" | "danger" | "info" | "neutral"
  size?: "sm" | "md"
  dot?: boolean                  // show colored dot before text
  children: ReactNode
```

**Variant mapping from existing codebase:**

| Variant | Classes | Maps to |
|---------|---------|---------|
| `success` | `bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400` | active, won, done, completed |
| `warning` | `bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400` | medium priority, in_progress, on_hold |
| `danger` | `bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400` | high/urgent priority, lost, overdue, blacklisted |
| `info` | `bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400` | prospect, lead, new |
| `neutral` | `bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400` | inactive, churned, draft, cancelled |

**Domain-specific badge mappings (to be used by domain components):**

| Entity | Field | Values → Badge variant |
|--------|-------|----------------------|
| Company | status | prospect → info, active → success, churned → neutral |
| Contact | status | active → success, inactive → neutral |
| Contact | role | decision_maker → danger, influencer → warning, user → info, admin → neutral |
| Lead | stage | new → info, qualified → info, proposal → warning, negotiation → warning, won → success, lost → danger |
| Job | status | draft → neutral, active → success, on_hold → warning, completed → success, cancelled → neutral |
| Job | priority | low → success, medium → warning, high → danger, urgent → danger |
| Task | status | todo → neutral, in_progress → info, done → success, cancelled → neutral |
| Task | priority | low → success, medium → warning, high → danger, urgent → danger |
| Vendor | status | active → success, inactive → neutral, blacklisted → danger |
| Outreach | type | email → info, call → success, message → warning, linkedin → info, other → neutral |
| Outreach | direction | inbound → success, outbound → info |
| Outreach | status | draft → neutral, sent → info, received → success, replied → success, bounced → danger |
| Note | type | general → neutral, meeting → info, ai_summary → warning, call_log → success |

### 3.9 Card

**Location:** `src/components/ui/card.tsx`
**Status:** Planned — card pattern repeated in every dashboard widget and list wrapper

**Purpose:** Container for grouping related content.

**Props:**
```
CardProps:
  variant?: "default" | "interactive" | "elevated" | "flat"
  padding?: "none" | "sm" | "md" | "lg"
  hoverable?: boolean
  onClick?: () => void
  children: ReactNode

CardHeaderProps:
  children: ReactNode
  action?: ReactNode             // right-side action slot

CardContentProps:
  children: ReactNode

CardFooterProps:
  children: ReactNode
```

**Variants:**

| Variant | Classes | Usage |
|---------|---------|-------|
| `default` | `bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl` | Dashboard widgets, list wrappers |
| `interactive` | default + `cursor-pointer hover:shadow-md transition-shadow` | Clickable entity cards |
| `elevated` | `bg-white dark:bg-gray-900 rounded-xl shadow-md` | Modals, popovers, dropdowns |
| `flat` | `bg-gray-50 dark:bg-gray-900/50 rounded-xl` | Nested sections, code blocks |

**Sub-components:** `Card`, `CardHeader`, `CardContent`, `CardFooter` — composed together.

### 3.10 Table

**Location:** `src/components/ui/table.tsx`
**Status:** Planned — table markup repeated in companies, contacts, leads, vendors, jobs, tasks pages

**Purpose:** Base table primitives (not the full DataTable — see §6.1).

**Sub-components:**
- `Table` — wrapper with `overflow-x-auto`
- `TableHeader`, `TableBody`, `TableRow`
- `TableHead` — column header with optional sort indicator
- `TableCell` — data cell with alignment prop

**Props:**
```
TableHeadProps:
  sortable?: boolean
  sortDirection?: "asc" | "desc" | null
  onSort?: () => void
  align?: "left" | "center" | "right"

TableCellProps:
  align?: "left" | "center" | "right"
```

### 3.11 Modal / Dialog

**Location:** `src/components/ui/modal.tsx`
**Status:** Planned

**Purpose:** Overlay for focused interactions (forms, confirmations, detail previews).

**Props:**
```
ModalProps:
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: "sm" | "md" | "lg" | "xl" | "full"
  closeOnOverlayClick?: boolean   // default true
  closeOnEscape?: boolean         // default true
  children: ReactNode
  footer?: ReactNode              // action buttons area
```

**Sizes:**

| Size | Max width | Usage |
|------|-----------|-------|
| `sm` | 400px | Confirmations, alerts |
| `md` | 560px | Simple forms (create entity) |
| `lg` | 720px | Complex forms, detail views |
| `xl` | 960px | Multi-section forms, split views |
| `full` | 100vw | Fullscreen editors |

**Features:**
- Focus trap (Tab cycles within modal)
- Escape key closes
- Scroll lock on body
- Backdrop overlay with fade animation
- Portal rendered (outside DOM hierarchy of parent)
- ARIA: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`

### 3.12 Dropdown Menu

**Location:** `src/components/ui/dropdown-menu.tsx`
**Status:** Planned

**Purpose:** Contextual action menu.

**Props:**
```
DropdownMenuProps:
  trigger: ReactNode
  align?: "start" | "center" | "end"
  children: ReactNode             // DropdownMenuItem children

DropdownMenuItemProps:
  onClick?: () => void
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  children: ReactNode

DropdownMenuSeparatorProps:
  (no props)
```

**Features:**
- Keyboard navigation (arrow keys, Enter, Escape)
- Click outside to close
- Focus management (first item focused on open)
- ARIA: `role="menu"`, `role="menuitem"`

**Usage:** Row-level actions on tables (Edit, Delete, View), user menu in topbar.

### 3.13 Tooltip

**Location:** `src/components/ui/tooltip.tsx`
**Status:** Planned

**Props:**
```
TooltipProps:
  content: ReactNode
  children: ReactNode
  side?: "top" | "right" | "bottom" | "left"
  delay?: number                 // default 300ms
```

**Features:**
- Delay before showing
- Auto-positioning to stay in viewport
- Keyboard accessible (focus triggers tooltip)
- ARIA: `role="tooltip"`, `aria-describedby`

### 3.14 Toast / Notification

**Location:** `src/components/ui/toast.tsx`
**Status:** Planned

**Purpose:** Temporary feedback messages.

**Architecture:**
- `ToastProvider` — renders toast container (portal), manages toast queue
- `useToast()` hook — `toast({ title, description, variant })` to trigger
- Backed by Zustand store (`ui-store.ts`) for global access

**Props (toast item):**
```
ToastProps:
  title: string
  description?: string
  variant?: "default" | "success" | "warning" | "error"
  duration?: number              // default 5000ms, 0 = persistent
  action?: { label: string; onClick: () => void }
```

**Features:**
- Stacked display (bottom-right corner)
- Auto-dismiss with configurable duration
- Dismiss button (X)
- Optional action button (e.g., "Undo")
- ARIA: `aria-live="polite"`, `role="status"`

**Usage:**
```
toast({ title: "Company created", description: "Acme Corp has been added.", variant: "success" })
toast({ title: "Delete failed", description: "Permission denied.", variant: "error" })
```

### 3.15 Loading States

#### Spinner

**Location:** `src/components/ui/spinner.tsx`
**Status:** Planned

```
SpinnerProps:
  size?: "sm" | "md" | "lg"
  className?: string
```

Used inside buttons (when `loading={true}`), page loading states, and inline loading indicators.

#### Skeleton

**Location:** `src/components/ui/skeleton.tsx`
**Status:** Planned

```
SkeletonProps:
  variant?: "text" | "circular" | "rectangular"
  width?: string | number
  height?: string | number
  className?: string
```

Used for content placeholders during data fetching. Aligns with Next.js `loading.tsx` convention.

**Predefined skeletons:**
- `SkeletonTable` — table-shaped skeleton (header + N rows)
- `SkeletonCard` — card-shaped skeleton
- `SkeletonList` — list-shaped skeleton

#### Progress Bar

**Location:** `src/components/ui/progress-bar.tsx`
**Status:** Planned — probability bar already exists in leads page

```
ProgressBarProps:
  value: number                  // 0–100
  variant?: "default" | "success" | "warning" | "danger"
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
```

---

## 4. Domain-Specific Components

Domain components live in `src/components/{domain}/`. They consume primitive and shared components, and are tailored to the Blue Arc OS data model.

### 4.1 CompanyCard

**Location:** `src/components/companies/company-card.tsx`
**Status:** Planned

**Purpose:** Display company summary in card format (for card grid views).

**Data source:** `Company` entity from `types/domain.ts` (aligned with DATABASE.md Company model)

**Display:**
- Company name (title, linked to detail page)
- Domain / website
- Industry
- Size badge (startup, smb, mid, enterprise)
- Status badge (prospect → info, active → success, churned → neutral)
- Contact count
- Action menu (edit, delete)

**Variants:** Card view (for grid), Row view (for table — integrated into DataTable columns)

### 4.2 ContactCard

**Location:** `src/components/contacts/contact-card.tsx`
**Status:** Planned

**Purpose:** Display contact summary.

**Data source:** `Contact` entity (DATABASE.md Contact model)

**Display:**
- Avatar (initials from firstName + lastName, or image)
- Full name (linked to detail page)
- Job title
- Email (clickable `mailto:`)
- Phone (clickable `tel:`)
- Company name (linked to company detail)
- Role badge (decision_maker, influencer, user, admin)
- Status badge (active, inactive)

### 4.3 LeadCard

**Location:** `src/components/leads/lead-card.tsx`
**Status:** Planned

**Purpose:** Display lead/opportunity summary, used in both list and Kanban views.

**Data source:** `Lead` entity (DATABASE.md Lead model)

**Display:**
- Lead title (linked to detail page)
- Company name (linked)
- Contact name (linked)
- Value (formatted currency via `formatCurrency()`)
- Stage badge (new, qualified, proposal, negotiation, won, lost)
- Probability bar (visual + percentage)
- Expected close date (with overdue indicator if past)
- Assigned user avatar
- Action menu (edit, change stage, delete)

**Kanban variant:** Compact card for pipeline board columns, draggable.

### 4.4 VendorCard

**Location:** `src/components/vendors/vendor-card.tsx`
**Status:** Planned

**Purpose:** Display vendor summary.

**Data source:** `Vendor` entity (DATABASE.md Vendor model)

**Display:**
- Vendor name (linked)
- Category
- Contact name
- Email / phone
- Star rating (1–5)
- Status badge (active → success, inactive → neutral, blacklisted → danger)
- Website link

### 4.5 JobCard

**Location:** `src/components/jobs/job-card.tsx`
**Status:** Planned

**Purpose:** Display job/project summary.

**Data source:** `Job` entity (DATABASE.md Job model)

**Display:**
- Job title (linked)
- Company name (linked)
- Status badge (draft, active, on_hold, completed, cancelled)
- Priority badge (low, medium, high, urgent)
- Type
- Due date (with overdue indicator)
- Assigned user avatar
- Value (formatted currency)
- Task progress (completed/total tasks)

### 4.6 TaskItem

**Location:** `src/components/tasks/task-card.tsx` (card) / `task-list.tsx` (row)
**Status:** Planned — task checkbox pattern exists in tasks page

**Purpose:** Display task in list or board format.

**Data source:** `Task` entity (DATABASE.md Task model)

**Display:**
- Checkbox (toggle completion)
- Title (strikethrough when done)
- Status badge (todo, in_progress, done, cancelled)
- Priority badge (low, medium, high, urgent)
- Due date (relative time, overdue indicator)
- Assigned user avatar
- Linked entity reference (polymorphic: "Follow up on Lead: Enterprise Deal")
- Description preview (truncated)

**Variants:**
- `list` — compact row for table views
- `board` — card for Kanban board columns
- `inline` — minimal, for embedding in entity detail pages

### 4.7 OutreachItem

**Location:** `src/components/outreach/outreach-detail.tsx`
**Status:** Planned

**Purpose:** Display outreach activity record.

**Data source:** `Outreach` entity (DATABASE.md Outreach model)

**Display:**
- Type icon (email, call, message, linkedin, other)
- Direction indicator (inbound ↓ / outbound ↑)
- Subject line (for emails)
- Contact name (linked)
- Lead name (linked, if present)
- Status badge (draft, sent, received, replied, bounced)
- Timestamp (relative: "2 hours ago" via `RelativeTime` component)
- AI badge (sparkle icon if `createdBy: "ai"`)
- Body preview (truncated, or full in detail view)

### 4.8 NoteItem

**Location:** `src/components/notes/note-card.tsx`
**Status:** Planned

**Purpose:** Display note with rendered markdown content.

**Data source:** `Note` entity (DATABASE.md Note model)

**Display:**
- Title (if present)
- Rendered markdown content (truncated in list, full in detail)
- Type badge (general, meeting, ai_summary, call_log)
- Pinned indicator (pin icon)
- Author type indicator (human / AI sparkle badge)
- Timestamp (relative)
- Action menu (edit, pin/unpin, delete)

**AI summary variant:** Special styling for `type: "ai_summary"` — subtle gradient border or icon to distinguish AI-generated content.

### 4.9 KPICard

**Location:** `src/components/dashboard/KPICard.tsx`
**Status:** Exists (Milestone 1)

**Current state:** Displays label, value, and trend indicator (up/down with percentage).

**Planned enhancements:**
- Accept `KPICardProps` with typed interface (already uses `KPIData` from types)
- Add optional icon support
- Add optional sparkline trend chart (array of numbers)
- Add click handler for drill-down navigation
- Extract to `components/ui/stat-card.tsx` as a generic primitive, then wrap in `components/dashboard/kpi-card.tsx` for domain-specific usage

### 4.10 PipelineStage

**Location:** `src/components/leads/lead-pipeline.tsx`
**Status:** Planned — `PipelineOverview` exists as a dashboard widget (progress bars)

**Purpose:** Full Kanban pipeline column for leads page.

**Data source:** Lead entities grouped by `stage` enum (new, qualified, proposal, negotiation, won, lost)

**Display:**
- Column header: stage name, lead count, total value
- List of `LeadCard` components within column
- Drop zone for drag-and-drop between stages
- "Add lead" button at bottom of each column

**Features:**
- Drag-and-drop leads between stages (triggers `PATCH /api/leads/:id/stage`)
- Visual feedback on drag over
- Keyboard alternative: context menu to move stage
- Horizontal scroll on mobile

### 4.11 ActivityFeed

**Location:** `src/components/dashboard/RecentActivity.tsx` (dashboard) / `src/components/shared/activity-feed.tsx` (generic)
**Status:** Exists as dashboard widget — needs generic extraction

**Current state:** `RecentActivity.tsx` renders a list of activity items with avatar, description, user, and timestamp.

**Planned enhancements:**
- Extract to generic `ActivityFeed` in `components/shared/`
- Support polymorphic activity types (note, outreach, task, stage_change, created, updated)
- Entity-specific activity feeds on detail pages
- Relative timestamps via `RelativeTime` component
- "View all" link for pagination

### 4.12 FollowUpItem

**Location:** `src/components/dashboard/FollowupsDue.tsx` (dashboard) / `src/components/shared/follow-up-item.tsx` (generic)
**Status:** Exists as dashboard widget — needs generic extraction

**Current state:** Displays contact name, company, due date, and priority badge.

**Planned enhancements:**
- Extract to generic `FollowUpItem` in `components/shared/`
- Link to related entity (task, lead, or contact)
- Quick-complete checkbox
- Reschedule action (inline date picker)
- Overdue visual indicator (red text/icon when past due)

---

## 5. Form Components

### 5.1 Form Wrapper

**Location:** `src/components/shared/form.tsx`
**Status:** Planned

**Purpose:** Form container with validation and submission handling.

**Props:**
```
FormProps<T>:
  onSubmit: (data: T) => void | Promise<void>
  initialValues?: Partial<T>
  validationSchema?: ZodSchema<T>
  children: ReactNode
```

**Integration:**
- Uses Zod schemas from `src/lib/validation/` for validation
- Manages field-level errors from API `VALIDATION_ERROR` responses (maps `details[].field` → form field)
- Loading state during submission
- Reset on success (optional)

### 5.2 FormField

**Location:** `src/components/shared/form-field.tsx`
**Status:** Planned

**Purpose:** Single form field with label, input, help text, and error display.

**Props:**
```
FormFieldProps:
  name: string
  label: string
  type?: "text" | "email" | "password" | "number" | "tel" | "url" | "textarea" | "select" | "date" | "checkbox"
  required?: boolean
  placeholder?: string
  helpText?: string
  error?: string
  options?: { value: string; label: string }[]    // for select
  children?: ReactNode                             // for custom input rendering
```

**Features:**
- Automatic `<label>` association via `htmlFor`/`id`
- Required indicator (asterisk)
- Error message display (red text below field)
- Help text (gray text below field)
- `aria-invalid` and `aria-describedby` when error present

### 5.3 FormSection

**Location:** `src/components/shared/form-section.tsx`
**Status:** Planned

**Purpose:** Group related form fields with optional title and description.

**Props:**
```
FormSectionProps:
  title?: string
  description?: string
  children: ReactNode
```

**Usage pattern:**
```
<FormSection title="Company Information" description="Basic details about the company">
  <FormField name="name" label="Company Name" required />
  <FormField name="domain" label="Domain" />
  <FormField name="industry" label="Industry" />
</FormSection>
```

### 5.4 FormActions

**Location:** `src/components/shared/form-actions.tsx`
**Status:** Planned

**Purpose:** Container for form submit/cancel buttons.

**Props:**
```
FormActionsProps:
  children: ReactNode
  align?: "left" | "right" | "between"
```

**Standard pattern:** Cancel (secondary/ghost) on left, Submit (primary) on right.

### 5.5 Validation Feedback

**Strategy:**

| Timing | Behavior |
|--------|----------|
| On blur | Validate the field that lost focus |
| On submit | Validate all fields |
| On change (after first error) | Clear error when field becomes valid |
| API errors | Map `VALIDATION_ERROR` details to field-level errors |
| Conflict errors | Show as form-level banner (e.g., "Email already exists") |

**Error message format:** Inline text below field, red color, `text-sm`.

**Accessibility:** `aria-invalid="true"` on field, `aria-describedby` pointing to error message element, `role="alert"` on error text for screen reader announcement.

---

## 6. Data Display Components

### 6.1 DataTable

**Location:** `src/components/shared/data-table.tsx`
**Status:** Planned — table markup currently duplicated across 6+ pages

**Purpose:** Full-featured data table with sorting, filtering, pagination, and row selection.

**Props:**
```
DataTableProps<T>:
  columns: ColumnDef<T>[]
  data: T[]
  loading?: boolean
  emptyMessage?: string
  emptyIcon?: ReactNode

  // Server-side pagination (cursor-based, matches API contract)
  pagination?: {
    cursor?: string
    hasMore: boolean
    limit: number
    onLoadMore: (cursor: string) => void
  }

  // Server-side sorting
  sorting?: {
    sortBy: string
    sortDir: "asc" | "desc"
    onSort: (column: string, direction: "asc" | "desc") => void
  }

  // Row selection
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void

  // Row interaction
  onRowClick?: (row: T) => void

  // Toolbar
  toolbar?: ReactNode            // slot for SearchBar, FilterBar, action buttons
```

**Column definition:**
```
ColumnDef<T>:
  key: string                    // field name on T
  header: string                 // column header text
  sortable?: boolean
  align?: "left" | "center" | "right"
  width?: string
  render?: (value: any, row: T) => ReactNode    // custom cell rendering
```

**Features:**
- Sort indicator (arrow icon) on sortable column headers
- Loading state: skeleton rows
- Empty state: centered message with optional icon
- Row hover highlight
- Row click navigation (optional)
- Checkbox column for selection (optional)
- Horizontal scroll on mobile
- Toolbar slot for search + filters above table

**Integration with API contracts:**
- Pagination uses cursor-based strategy matching `meta.pagination` from API responses
- Sorting maps to `sortBy` and `sortDir` query parameters
- Filtering maps to query parameter operators (`eq`, `ne`, `gt`, `contains`, `in`, etc.)

### 6.2 CardGrid

**Location:** `src/components/shared/card-grid.tsx`
**Status:** Planned

**Purpose:** Responsive grid container for entity cards.

**Props:**
```
CardGridProps:
  children: ReactNode
  emptyMessage?: string
  emptyIcon?: ReactNode
  columns?: { sm?: number; md?: number; lg?: number; xl?: number }
```

**Default:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`

### 6.3 List

**Location:** `src/components/shared/list.tsx`
**Status:** Planned

**Purpose:** Vertical list of items with dividers.

**Props:**
```
ListProps<T>:
  items: T[]
  renderItem: (item: T) => ReactNode
  keyExtractor: (item: T) => string
  emptyMessage?: string
  loading?: boolean
  divided?: boolean              // show dividers between items
```

### 6.4 Timeline

**Location:** `src/components/shared/timeline.tsx`
**Status:** Planned

**Purpose:** Chronological display of events (for activity feeds, audit logs, stage transitions).

**Props:**
```
TimelineProps:
  items: TimelineItem[]

TimelineItem:
  id: string
  icon: ReactNode
  iconColor: string
  title: string
  description?: string
  timestamp: string
  metadata?: ReactNode           // additional content slot
```

**Display:** Vertical line with dots/icons, content to the right, timestamps aligned.

### 6.5 StatCard

**Location:** `src/components/ui/stat-card.tsx`
**Status:** Planned — generic version of existing `KPICard`

**Purpose:** Display a single statistic with optional trend.

**Props:**
```
StatCardProps:
  title: string
  value: string | number
  change?: { value: number; direction: "up" | "down" }
  icon?: ReactNode
  trend?: number[]               // sparkline data points
  onClick?: () => void
```

### 6.6 ProgressBar

**Location:** `src/components/ui/progress-bar.tsx`
**Status:** Planned — probability bar pattern exists in leads page

**Purpose:** Visual progress indicator.

**Props:**
```
ProgressBarProps:
  value: number                  // 0–100
  variant?: "default" | "success" | "warning" | "danger"
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
```

---

## 7. Navigation Components

### 7.1 Breadcrumb

**Location:** `src/components/layout/Breadcrumbs.tsx`
**Status:** Planned (see §2.4)

### 7.2 Tabs

**Location:** `src/components/ui/tabs.tsx`
**Status:** Planned

**Purpose:** Switch between related views within a page.

**Props:**
```
TabsProps:
  value: string
  onValueChange: (value: string) => void
  children: ReactNode

TabListProps:
  children: ReactNode             // Tab children

TabProps:
  value: string
  label: string
  icon?: ReactNode
  disabled?: boolean
  count?: number                 // badge count (e.g., "Contacts (12)")

TabPanelProps:
  value: string
  children: ReactNode
```

**Usage:** Entity detail pages (Overview, Contacts, Jobs, Notes tabs), settings pages.

**Accessibility:** ARIA tabs pattern — `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, keyboard navigation (arrow keys).

### 7.3 Pagination

**Location:** `src/components/shared/pagination.tsx`
**Status:** Planned

**Purpose:** Navigate between pages of data (cursor-based, matching API contract).

**Props:**
```
PaginationProps:
  cursor?: string                // opaque cursor from API
  hasMore: boolean               // from API meta.pagination.hasMore
  isLoading?: boolean
  onLoadNext: () => void
  totalLabel?: string            // e.g., "Showing 20 of 243"
```

**Display:** "Load more" button or "Previous / Next" buttons. Since the API uses cursor-based pagination (not offset), traditional page numbers are not applicable.

### 7.4 SearchBar

**Location:** `src/components/shared/search-bar.tsx`
**Status:** Planned

**Purpose:** Search input with debounced querying.

**Props:**
```
SearchBarProps:
  value: string
  onChange: (value: string) => void
  placeholder?: string
  loading?: boolean
  shortcut?: boolean             // show ⌘K hint
```

**Features:**
- Debounced input (300ms delay before triggering search)
- Clear button (X) when value is non-empty
- Loading spinner while searching
- Keyboard shortcut: Cmd+K (Mac) / Ctrl+K (Windows) to focus
- ARIA: `role="searchbox"`, `aria-label`

**Two contexts:**
1. **Global search** (in Topbar) — searches across all entity types
2. **Contextual search** (in DataTable toolbar) — searches within current entity type, maps to API `search` query parameter

### 7.5 FilterBar

**Location:** `src/components/shared/filter-bar.tsx`
**Status:** Planned

**Purpose:** Filter controls for data views.

**Props:**
```
FilterBarProps:
  filters: FilterConfig[]        // available filter definitions
  activeFilters: ActiveFilter[]  // currently applied filters
  onFilterChange: (filters: ActiveFilter[]) => void
  onClear: () => void

FilterConfig:
  field: string
  label: string
  type: "select" | "text" | "date" | "number"
  options?: { value: string; label: string }[]   // for select type
  operators?: FilterOperator[]   // default: ["eq"]

ActiveFilter:
  field: string
  operator: FilterOperator       // "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "in"
  value: string | string[]
```

**Display:**
- Filter chips (active filters shown as removable pills)
- "Add filter" dropdown button
- "Clear all" link
- Active filter count badge

**Entity-specific filter configurations:**

| Entity | Available filters |
|--------|------------------|
| Company | status, industry, size |
| Contact | companyId, status, role, source |
| Lead | stage, companyId, contactId, assignedToId, source, minValue, maxValue |
| Vendor | status, category, rating |
| Job | status, priority, companyId, assignedToId, type |
| Task | status, priority, assignedToId, entityType, entityId, dueDateFrom, dueDateTo |
| Outreach | type, direction, status, contactId, leadId, createdBy |
| Note | entityType, entityId, type, isPinned, authorType |

---

## 8. Feedback Components

### 8.1 Alert

**Location:** `src/components/ui/alert.tsx`
**Status:** Planned

**Purpose:** Important message displayed inline (not temporary like toast).

**Props:**
```
AlertProps:
  variant: "info" | "success" | "warning" | "error"
  title?: string
  children: ReactNode            // body content
  dismissible?: boolean
  onDismiss?: () => void
  action?: { label: string; onClick: () => void }
  icon?: ReactNode
```

**Variants:**

| Variant | Color | Usage |
|---------|-------|-------|
| `info` | Blue | Informational banners, tips |
| `success` | Green | Success confirmations |
| `warning` | Amber | Caution, approaching limits |
| `error` | Red | Error messages, form-level errors |

**Usage:** Form-level error banners, API conflict messages, feature announcements, quota warnings.

### 8.2 EmptyState

**Location:** `src/components/shared/empty-state.tsx`
**Status:** Planned

**Purpose:** Display when no data is available.

**Props:**
```
EmptyStateProps:
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
```

**Display:** Centered layout with large icon, title, description, and CTA button.

**Usage:** Empty tables, empty card grids, no search results, no filters match.

### 8.3 ErrorBoundary

**Location:** `src/app/error.tsx` (global) + `src/components/shared/error-boundary.tsx` (component-level)
**Status:** Planned

**Purpose:** Catch React rendering errors and display fallback UI.

**Global (`error.tsx`):** Full-page error with "Try again" button.

**Component-level:** Wrap risky sections (AI features, integrations) to prevent full-page crashes.

**Props (component-level):**
```
ErrorBoundaryProps:
  fallback?: ReactNode | ((error: Error) => ReactNode)
  onError?: (error: Error, info: ErrorInfo) => void
  children: ReactNode
```

### 8.4 ConfirmationDialog

**Location:** `src/components/shared/confirm-dialog.tsx`
**Status:** Planned

**Purpose:** Confirm destructive or important actions.

**Props:**
```
ConfirmDialogProps:
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string          // default "Confirm"
  cancelLabel?: string           // default "Cancel"
  variant?: "default" | "danger"
  loading?: boolean
```

**Built on:** `Modal` component with `size="sm"`.

**Usage:** Delete confirmations, stage transitions, discard changes warnings.

---

## 9. Theme and Styling

### 9.1 Light/Dark Mode Implementation

**Current state (Milestone 1):**
- `ThemeContext` in `src/context/ThemeContext.tsx` — manages `light`/`dark` state
- Toggles `.dark` class on `<html>` element
- Persists to `localStorage`
- Default: `dark`
- `globals.css` defines CSS custom properties for both modes

**Target state:**
- Migrate from React Context to Zustand `theme-store.ts` (lighter, no provider nesting)
- Keep `.dark` class strategy (Tailwind `@custom-variant dark` already configured in `globals.css`)
- Add `system` preference option (follows `prefers-color-scheme`)
- Prevent flash of wrong theme on load (inline script in `<head>`)

### 9.2 Color Palette

**Primary (Indigo):**

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `indigo-50` | `#eef2ff` | — | Active nav background |
| `indigo-100` | `#e0e7ff` | — | Selected items |
| `indigo-400` | — | `#818cf8` | Dark mode primary text |
| `indigo-500` | `#6366f1` | `#6366f1` | Focus rings |
| `indigo-600` | `#4f46e5` | `#4f46e5` | Primary buttons, links |
| `indigo-700` | `#4338ca` | — | Hover state |
| `indigo-950` | — | `#1e1b4b` | Dark mode active nav bg |

**Neutral (Gray):**

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `gray-50` | `#f9fafb` | — | Page background |
| `gray-100` | `#f3f4f6` | — | Table header bg, hover |
| `gray-200` | `#e5e7eb` | — | Borders (light mode) |
| `gray-300` | `#d1d5db` | — | Input borders |
| `gray-400` | `#9ca3af` | — | Muted text (light) |
| `gray-500` | `#6b7280` | — | Secondary text |
| `gray-600` | `#4b5563` | — | Body text (light) |
| `gray-700` | `#374151` | — | Headings (light) |
| `gray-800` | `#1f2937` | — | Borders (dark) |
| `gray-900` | `#111827` | — | Surface (dark), text (light) |
| `gray-950` | `#030712` | — | Page background (dark) |

**Semantic colors:**

| Semantic | Tailwind | Usage |
|----------|----------|-------|
| Success | `green-*` | Active, won, completed, verified |
| Warning | `amber-*` | Pending, in progress, medium priority |
| Danger | `red-*` | Error, urgent, overdue, lost, blacklisted |
| Info | `blue-*` | Prospects, new, informational |

### 9.3 Typography Scale

**Font family:** System font stack (Tailwind default `sans`)

**Scale:**

| Token | Size | Line height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 0.75rem (12px) | 1rem | Badges, timestamps, metadata |
| `text-sm` | 0.875rem (14px) | 1.25rem | Body text, table cells, form labels |
| `text-base` | 1rem (16px) | 1.5rem | Default body text |
| `text-lg` | 1.125rem (18px) | 1.75rem | Card titles, section headers |
| `text-xl` | 1.25rem (20px) | 1.75rem | Panel headers |
| `text-2xl` | 1.5rem (24px) | 2rem | Page titles |
| `text-3xl` | 1.875rem (30px) | 2.25rem | Dashboard hero, auth pages |

**Font weight:**

| Weight | Usage |
|--------|-------|
| `font-normal` (400) | Body text |
| `font-medium` (500) | Labels, nav items, table headers |
| `font-semibold` (600) | Section headers, card titles |
| `font-bold` (700) | Page titles, KPI values |

### 9.4 Spacing System

**Base unit:** 4px (Tailwind default)

**Common spacing patterns observed in codebase:**

| Pattern | Values | Usage |
|---------|--------|-------|
| Page padding | `p-6 lg:p-8` | All page wrappers |
| Card padding | `p-5` | Dashboard widgets, cards |
| Section header | `px-5 py-4` | Card headers with border-b |
| Table cell | `px-5 py-4` (body), `px-5 py-3.5` (header) | Table content |
| Gap (grid) | `gap-4` (cards), `gap-6` (panels) | Grid layouts |
| Gap (inline) | `gap-2` (badges), `gap-3` (nav items) | Flex layouts |
| Space-y | `space-y-1` (nav), `space-y-4` (sections), `space-y-6` (page) | Vertical stacks |

### 9.5 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded` | 4px | Checkboxes, small elements |
| `rounded-lg` | 8px | Badges, pills, small buttons |
| `rounded-xl` | 12px | Cards, panels, modals |
| `rounded-full` | 9999px | Avatars, progress bars, toggles |

### 9.6 Shadows

| Token | Usage |
|-------|-------|
| No shadow | Default cards (border-based separation) |
| `shadow-sm` | Subtle elevation (inputs on focus) |
| `shadow-md` | Hover state on interactive cards, dropdowns |
| `shadow-lg` | Modals, popovers |
| `shadow-xl` | Full-screen modals |

**Dark mode shadows:** Reduced opacity or replaced with border emphasis (`dark:hover:shadow-gray-900/50`).

---

## 10. Accessibility

### 10.1 ARIA Labels

**Rules:**
- All interactive elements must have accessible names
- Icon-only buttons require `aria-label` (e.g., theme toggle: `aria-label="Toggle theme"`)
- Decorative icons use `aria-hidden="true"`
- Complex widgets use `aria-labelledby` or `aria-describedby`
- Dynamic content uses `aria-live` regions

**Current state:** Theme toggle button already has `aria-label="Toggle theme"` ✓

### 10.2 Keyboard Navigation

**Requirements:**

| Component | Keyboard behavior |
|-----------|------------------|
| Sidebar | Tab to focus, ↑/↓ to navigate, Enter to activate |
| Buttons | Enter or Space to activate |
| Tabs | ←/→ to switch tabs, Enter to select |
| Dropdown menu | ↑/↓ to navigate items, Enter to select, Escape to close |
| Modal | Tab trapped within modal, Escape to close |
| Table | Tab through interactive cells, Enter to activate row actions |
| Search | Cmd/Ctrl+K to focus global search |
| Checkboxes | Space to toggle |

### 10.3 Focus Management

**Rules:**
- Visible focus indicators on all interactive elements (`focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`)
- Focus moves to first input when modal opens
- Focus returns to trigger element when modal closes
- Skip-to-content link for keyboard users
- Focus order follows visual order

**Focus ring styling:**
```
Light mode: ring-indigo-500 offset on white background
Dark mode: ring-indigo-400 offset on dark background
```

### 10.4 Screen Reader Support

**Rules:**
- Use semantic HTML elements (`<nav>`, `<main>`, `<button>`, `<table>`, `<th>`)
- Table headers use `<th scope="col">`
- Form inputs associated with `<label>` elements
- Error messages use `role="alert"` for immediate announcement
- Toast notifications use `aria-live="polite"`
- Loading states use `aria-busy="true"`
- Status changes announced via live regions

---

## 11. Responsive Design

### 11.1 Breakpoints

Using Tailwind's default breakpoints (mobile-first):

| Breakpoint | Width | Target device |
|------------|-------|---------------|
| (default) | < 640px | Mobile portrait |
| `sm` | ≥ 640px | Mobile landscape |
| `md` | ≥ 768px | Tablet |
| `lg` | ≥ 1024px | Laptop |
| `xl` | ≥ 1280px | Desktop |
| `2xl` | ≥ 1536px | Large desktop |

### 11.2 Mobile-First Approach

All components are designed mobile-first. Enhancements are added at larger breakpoints using `sm:`, `md:`, `lg:`, `xl:` prefixes.

### 11.3 Component Behavior at Different Sizes

| Component | Mobile (< 640px) | Tablet (768px) | Desktop (≥ 1024px) |
|-----------|-------------------|----------------|---------------------|
| **Sidebar** | Hidden; slide-out drawer via hamburger | Collapsed (icon-only, w-16) | Expanded (w-64) |
| **Topbar** | Hamburger + search icon | Full search bar | Full search + notifications |
| **DataTable** | Horizontal scroll; hide low-priority columns | Full table | Full table with all columns |
| **CardGrid** | 1 column | 2 columns | 3 columns |
| **KPI Grid** | 2 columns | 3 columns | 6 columns |
| **Dashboard grid** | 1 column (stacked) | 1 column | 2 columns (side by side) |
| **Modal** | Full screen | Centered, max-w-md | Centered, sized by prop |
| **Form** | Single column | Single column | 2 columns (wide forms) |
| **PageHeader** | Title + action stack vertically | Horizontal | Horizontal |
| **Kanban** | Horizontal scroll between columns | Show 3 columns | Show all 6 stages |
| **FilterBar** | Dropdown with filter options | Inline chips | Inline chips |
| **Pipeline** | Vertical stack of stages | 3 columns visible | All 6 stages |

### 11.4 Touch Targets

All interactive elements have a minimum touch target of 44×44px on mobile (achieved via `min-h-[44px]` or adequate padding).

---

## 12. Component File Structure

### 12.1 Proposed Folder Organization

Aligned with the target structure defined in SYSTEM_ARCHITECTURE.md §7.1:

```
src/components/
│
├── ui/                           # Tier 1: Primitive UI components
│   ├── button.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── checkbox.tsx
│   ├── radio.tsx
│   ├── toggle.tsx
│   ├── textarea.tsx
│   ├── badge.tsx
│   ├── card.tsx                   # Card, CardHeader, CardContent, CardFooter
│   ├── table.tsx                  # Table, TableHead, TableBody, TableRow, TableCell
│   ├── modal.tsx
│   ├── dropdown-menu.tsx
│   ├── tooltip.tsx
│   ├── toast.tsx                  # Toast + ToastProvider + useToast
│   ├── spinner.tsx
│   ├── skeleton.tsx               # Skeleton + SkeletonTable, SkeletonCard
│   ├── progress-bar.tsx
│   ├── alert.tsx
│   ├── avatar.tsx
│   ├── stat-card.tsx
│   ├── tabs.tsx
│   └── index.ts                   # Barrel export
│
├── layout/                       # Tier 0: Layout components
│   ├── sidebar.tsx               # (rename from Sidebar.tsx)
│   ├── topbar.tsx                # (new)
│   ├── breadcrumbs.tsx           # (new)
│   ├── page-header.tsx           # (rename from PageHeader.tsx, enhance)
│   ├── page-wrapper.tsx          # (new)
│   └── theme-toggle.tsx          # (extract from Sidebar)
│
├── shared/                       # Tier 2: Composite / cross-cutting
│   ├── data-table.tsx
│   ├── card-grid.tsx
│   ├── list.tsx
│   ├── timeline.tsx
│   ├── pagination.tsx
│   ├── search-bar.tsx
│   ├── filter-bar.tsx
│   ├── empty-state.tsx
│   ├── confirm-dialog.tsx
│   ├── error-boundary.tsx
│   ├── form.tsx
│   ├── form-field.tsx
│   ├── form-section.tsx
│   ├── form-actions.tsx
│   ├── activity-feed.tsx         # (extracted from dashboard/RecentActivity)
│   ├── follow-up-item.tsx        # (extracted from dashboard/FollowupsDue)
│   ├── status-badge.tsx          # Maps domain enums → Badge variants
│   ├── entity-link.tsx           # Polymorphic link to any entity
│   └── relative-time.tsx         # Relative timestamp display
│
├── dashboard/                    # Dashboard-specific (Milestone 1 — exists)
│   ├── dashboard.tsx             # (rename from Dashboard.tsx)
│   ├── kpi-card.tsx              # (rename from KPICard.tsx)
│   ├── pipeline-overview.tsx     # (rename from PipelineOverview.tsx)
│   ├── recent-activity.tsx       # (rename from RecentActivity.tsx)
│   ├── followups-due.tsx         # (rename from FollowupsDue.tsx)
│   └── upcoming-tasks.tsx        # (rename from UpcomingTasks.tsx)
│
├── companies/                    # Tier 3: Domain components
│   ├── company-card.tsx
│   ├── company-form.tsx
│   ├── company-list.tsx
│   └── company-detail-header.tsx
│
├── contacts/
│   ├── contact-card.tsx
│   ├── contact-form.tsx
│   ├── contact-list.tsx
│   └── contact-detail-header.tsx
│
├── leads/
│   ├── lead-card.tsx
│   ├── lead-form.tsx
│   ├── lead-kanban.tsx           # Full Kanban board
│   ├── lead-pipeline.tsx         # Pipeline stage columns
│   └── lead-detail-header.tsx
│
├── vendors/
│   ├── vendor-card.tsx
│   ├── vendor-form.tsx
│   ├── vendor-list.tsx
│   └── vendor-detail-header.tsx
│
├── jobs/
│   ├── job-card.tsx
│   ├── job-form.tsx
│   ├── job-list.tsx
│   └── job-detail-header.tsx
│
├── tasks/
│   ├── task-board.tsx            # Kanban board view
│   ├── task-card.tsx
│   ├── task-form.tsx
│   └── task-list.tsx
│
├── outreach/
│   ├── outreach-list.tsx         # Inbox / list view
│   ├── outreach-detail.tsx
│   ├── outreach-compose.tsx      # Compose form (with AI assist)
│   └── outreach-thread.tsx       # Conversation thread view
│
├── notes/
│   ├── note-list.tsx
│   ├── note-editor.tsx           # Markdown editor
│   ├── note-card.tsx
│   └── note-timeline.tsx
│
└── ai/                           # AI feature components (future)
    ├── ai-assist-button.tsx      # "AI Assist" button in forms
    ├── ai-research-panel.tsx     # Research results panel
    ├── ai-outreach-suggestions.tsx
    └── ai-summary-badge.tsx      # Badge indicating AI-generated content
```

### 12.2 Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Component files | kebab-case | `company-card.tsx`, `data-table.tsx` |
| Component names | PascalCase | `CompanyCard`, `DataTable` |
| Props interfaces | PascalCase + `Props` | `CompanyCardProps`, `ButtonProps` |
| Hook files | kebab-case, prefixed `use-` | `use-auth.ts`, `use-debounce.ts` |
| Utility files | kebab-case | `format-currency.ts` |
| Type files | kebab-case | `domain.ts`, `api.ts` |
| Barrel exports | `index.ts` | Re-exports public API |
| Story/test files | Co-located, suffixed | `button.test.tsx`, `button.stories.tsx` |

**Migration from current state:** Existing files use PascalCase (`Sidebar.tsx`, `KPICard.tsx`, `PageHeader.tsx`). These should be renamed to kebab-case (`sidebar.tsx`, `kpi-card.tsx`, `page-header.tsx`) as part of Milestone 2 to match the target convention.

### 12.3 Export Patterns

**Barrel exports (`index.ts`):**
```
// src/components/ui/index.ts
export { Button } from "./button";
export type { ButtonProps } from "./button";
export { Input } from "./input";
export type { InputProps } from "./input";
// ... etc
```

**Import convention:**
```
// From barrel (preferred for primitives)
import { Button, Badge, Card } from "@/components/ui";

// Direct import (for domain components — no barrel)
import { CompanyCard } from "@/components/companies/company-card";
```

**Domain components do NOT use barrel exports** — each component is imported directly. This prevents circular dependencies and keeps bundles lean.

### 12.4 Component File Template

Each component file follows this structure:

```
1. "use client" directive (if client component)
2. Imports (React, types, sub-components, utilities)
3. Props interface definition
4. Component function (named export, not default)
5. Sub-components (if any, e.g., CardHeader inside card.tsx)
```

**Key conventions:**
- Named exports only (no `export default`) — easier to refactor, grep, and tree-shake
- Props interface defined in same file (not separate types file) for co-location
- Domain types imported from `@/types/domain`
- Utility functions imported from `@/lib/utils`

---

## Appendix A: Migration Plan from Current State

| Phase | Milestone | Component work |
|-------|-----------|----------------|
| **Current** | M1 | Inline Tailwind, no primitives, mock data, PascalCase files |
| **Phase 1** | M2 | Extract primitives (Button, Badge, Card, Table shell) from repeated patterns. Rename files to kebab-case. Add Topbar, PageWrapper. |
| **Phase 2** | M2 | Build domain components (CompanyCard, ContactCard, etc.) using primitives. Add DataTable, SearchBar, FilterBar. |
| **Phase 3** | M3 | Add form system (Form, FormField, FormSection, FormActions). Add Modal, DropdownMenu, ConfirmDialog. |
| **Phase 4** | M3 | Add Toast system, Alert, EmptyState, ErrorBoundary. Add Pagination, Tabs, Breadcrumbs. |
| **Phase 5** | M4 | Replace mock data with API-connected components. Add loading skeletons. Add optimistic updates. |
| **Phase 6** | M5+ | Add AI components (AiAssistButton, AiResearchPanel). Add drag-and-drop Kanban. Add outreach compose with AI. |

## Appendix B: Component-to-API Mapping

| Component | API endpoint(s) | Data flow |
|-----------|----------------|-----------|
| CompanyCard, CompanyList, DataTable (companies) | `GET /api/companies` | Server Component fetches → passes data as props |
| CompanyForm | `POST /api/companies`, `PATCH /api/companies/:id` | Client Component submits → shows API errors |
| LeadKanban, PipelineStage | `GET /api/leads`, `PATCH /api/leads/:id/stage` | Drag-drop triggers stage transition API |
| TaskItem (checkbox toggle) | `PATCH /api/tasks/:id` | Optimistic update → API call → rollback on failure |
| OutreachCompose | `POST /api/outreach`, `POST /api/ai/outreach/draft` | Form submit + AI assist button |
| NoteEditor | `POST /api/notes`, `PATCH /api/notes/:id` | Markdown editor with save |
| SearchBar (global) | Multiple `GET /api/*?search=` | Debounced search across entities |
| FilterBar | `GET /api/*?field=value` | Maps filters to query parameters |
| Pagination | `GET /api/*?cursor=` | Cursor-based load more |
| KPICard | `GET /api/leads`, `GET /api/jobs`, etc. | Aggregated data from multiple endpoints |
| ActivityFeed | `GET /api/notes`, `GET /api/outreach`, etc. | Combined activity from multiple sources |

## Appendix C: Existing Patterns to Preserve

These patterns from the Milestone 1 codebase are working well and should be maintained:

| Pattern | Location | Notes |
|---------|----------|-------|
| Dark mode via `.dark` class | `globals.css`, `ThemeContext` | Already configured with `@custom-variant dark` |
| CSS custom properties for bg/surface/border | `globals.css` | Extend, don't replace |
| `classNames()` utility | `lib/utils.ts` | Consider upgrading to `cn()` with `tailwind-merge` |
| `formatCurrency()` utility | `lib/utils.ts` | Keep as-is |
| `getPriorityColor()` / `getPriorityBadge()` | `lib/utils.ts` | Migrate into `status-badge.tsx` or `Badge` variant mapping |
| Indigo as primary color | Throughout | Maintain consistency |
| `rounded-xl` for cards | Throughout | Standard card border radius |
| `border-gray-200 dark:border-gray-800` | Throughout | Standard border pattern |
| Page padding `p-6 lg:p-8` | All pages | Extract to PageWrapper |
