# Blue Arc OS — AI Agents Strategy

> Version: 1.0.0
> Last updated: 2026-07-07
> Status: Design phase
> Implementation note: This is a design-phase document. The five agents described here (Lead Research, Outreach Assistant, Note Summarization, Meeting Notes, Smart Suggestions) differ from the agents actually implemented via the ported crm-agent prompts — Agent 1 (website research), Agent 2 (draft), Agent 3 (verifier), plus email classifier, partnership fit, and workspace strategy. See [MILESTONE_REPORT.md](../MILESTONE_REPORT.md) and `src/lib/ai/crm-agent-prompts.ts`.
> Companion documents: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) · [DATABASE.md](./DATABASE.md) · [API_CONTRACTS.md](./API_CONTRACTS.md)

---

## Table of Contents

1. [AI Strategy Overview](#1-ai-strategy-overview)
2. [AI Agent: Lead Research](#2-ai-agent-lead-research)
3. [AI Agent: Outreach Assistant](#3-ai-agent-outreach-assistant)
4. [AI Agent: Note Summarization](#4-ai-agent-note-summarization)
5. [AI Agent: Meeting Notes (Future)](#5-ai-agent-meeting-notes-future)
6. [AI Agent: Smart Suggestions (Future)](#6-ai-agent-smart-suggestions-future)
7. [AI Infrastructure](#7-ai-infrastructure)
8. [AI Data Flow](#8-ai-data-flow)
9. [AI Cost Management](#9-ai-cost-management)
10. [AI Quality and Safety](#10-ai-quality-and-safety)
11. [Implementation Phases](#11-implementation-phases)
12. [Technical Considerations](#12-technical-considerations)

---

## 1. AI Strategy Overview

### 1.1 Vision

Blue Arc OS is an AI-powered CRM that transforms how small and mid-size businesses manage customer relationships. AI is not a feature bolted onto the CRM — it is woven into every workflow, reducing manual research, accelerating outreach, and surfacing insights that would otherwise require hours of human effort.

The end state: a CRM where the user focuses on relationships and decisions, while AI handles the data gathering, drafting, summarizing, and pattern recognition.

### 1.2 AI-First Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **AI augments, never replaces** | AI generates drafts, suggestions, and summaries — the human always has final authority. Every AI output is editable before it becomes a permanent record. |
| 2 | **Transparent AI** | Users always know when they are interacting with AI-generated content. `authorType: ai` and `createdBy: ai` fields make this explicit in the data model. |
| 3 | **Context-aware** | AI agents do not operate in isolation. They pull relevant CRM context (company data, contact history, previous outreach, notes) to produce personalized, accurate outputs. |
| 4 | **Progressive disclosure** | AI features are discoverable but not intrusive. Buttons and badges invite the user to engage; the CRM remains fully functional without AI. |
| 5 | **Cost-conscious** | Every AI call has a measurable cost. The system tracks, budgets, and caches to keep expenses predictable per organization. |
| 6 | **Graceful degradation** | If AI providers are unavailable, the CRM continues to function. AI features return clear errors with retry options; core CRM operations are never blocked. |
| 7 | **Privacy by design** | Users control what data is sent to AI providers. Opt-in per feature. Sensitive fields can be excluded. All AI interactions are logged for audit. |
| 8 | **Provider-agnostic** | The AI Gateway abstracts provider specifics. Switching models or providers does not require changes to agent logic or UI. |

### 1.3 User Experience Goals

| Goal | Implementation |
|------|----------------|
| **Zero-friction discovery** | AI buttons appear contextually — "Research" on lead cards, "AI Assist" in compose forms, "Summarize" on long notes. No separate AI page to navigate to. |
| **Fast feedback** | Synchronous AI calls (outreach drafts, note summaries) return in < 5 seconds. Async jobs (research) show progress indicators and notify on completion. |
| **Edit before commit** | AI-generated content always lands in a draft state. Outreach drafts are editable before sending. AI summaries are reviewable before being saved as notes. |
| **Consistent patterns** | All AI features follow the same interaction model: trigger → loading state → result → edit/accept → persist. |
| **Clear cost visibility** | Users see token usage and remaining quota in settings. No surprise bills. |

### 1.4 Privacy and Data Handling

| Concern | Policy |
|---------|--------|
| **What is sent to AI providers** | Only the data required for the specific AI task. The Context Assembler (`src/services/ai/context-assembler.ts`) curates a minimal context payload. |
| **What is never sent** | Passwords, OAuth tokens, API keys, other users' PII outside the organization, raw database IDs from other tenants. |
| **Data residency** | AI providers are selected with data residency in mind. For enterprise customers, self-hosted model options are available. |
| **Opt-in model** | AI features are enabled per-organization via `Organization.settings.ai`. Individual features can be toggled (e.g., disable research but keep outreach assist). |
| **Retention** | AI providers' data retention policies are documented. Cached responses are stored locally and expire after 24 hours. |
| **Audit trail** | Every AI call is logged in `AiUsageLog` with organization, user, feature, provider, model, and token counts. |

---

## 2. AI Agent: Lead Research

### 2.1 Purpose

Automatically research and enrich lead and company data by gathering information from external sources and synthesizing it into a structured, actionable briefing. This eliminates the manual research step that salespeople perform before every outreach.

### 2.2 Input

| Field | Source | Required | Description |
|-------|--------|----------|-------------|
| `entityType` | User selection | yes | `company` or `contact` |
| `entityId` | User selection | yes | UUID of the Company or Contact record |
| `options.depth` | User selection | no | `brief`, `standard` (default), `deep` — controls research scope |
| `options.includeCompetitors` | User selection | no | Whether to research competitor landscape |
| `options.includeNews` | User selection | no | Whether to include recent news |

**Internal context gathered by Context Assembler:**

| Data Point | Source Entity | Purpose |
|------------|---------------|---------|
| Company name, domain, industry, size | Company | Primary research target |
| Contact name, title, email | Contact | Person-specific research |
| Existing notes and outreach history | Note, Outreach | Avoid re-researching known facts |
| Lead stage, value, source | Lead | Prioritize research depth |

### 2.3 Output

The research agent produces a structured briefing stored as a `Note` with `type: ai_summary` and `authorType: ai`.

**Structured output schema:**

```
{
  companyOverview: {
    description: string          // 2-3 sentence company summary
    industry: string             // Confirmed/refined industry
    size: string                 // Employee count range
    headquarters: string         // Location
    founded: string              // Year founded
    website: string              // Confirmed website
  }
  keyPeople: [
    {
      name: string
      title: string
      linkedinUrl?: string
      relevance: string          // Why this person matters to the user
    }
  ]
  recentNews: [                  // If includeNews = true
    {
      headline: string
      date: string
      source: string
      url: string
      relevance: string
    }
  ]
  funding: {                     // If available
    lastRound: string
    totalFunding: string
    investors: string[]
  }
  techStack: [string]            // Detected technologies
  competitors: [                 // If includeCompetitors = true
    {
      name: string
      differentiation: string
    }
  ]
  talkingPoints: [string]        // Suggested conversation starters
  suggestedApproach: string      // Recommended outreach strategy
  confidenceScore: number        // 0-100, how confident the AI is in the data
  sources: [string]              // URLs referenced during research
}
```

### 2.4 Data Sources

| Source | Method | Priority | Notes |
|--------|--------|----------|-------|
| Company website | Web scrape / fetch | 1 | Primary source for official information |
| Web search (general) | Search API (e.g., Tavily, Serper, Bing) | 2 | Broad coverage for news, funding, tech stack |
| LinkedIn | Public profile data | 3 | Key people, titles, recent activity |
| Crunchbase | API (if available) | 4 | Funding rounds, investors, acquisitions |
| Industry databases | Search API | 5 | Competitor identification, market positioning |

> **Note:** Data sources are accessed via web search APIs and structured extraction. Direct LinkedIn/Crunchbase API access requires partnership agreements; the initial implementation uses web search as a fallback.

### 2.5 Workflow

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Trigger  │────►│   Research   │────►│  Synthesize   │────►│    Store     │
│           │     │   (gather)   │     │  (LLM call)   │     │  (Note)      │
└──────────┘     └──────────────┘     └───────────────┘     └──────────────┘
     │                   │                    │                      │
     │                   │                    │                      │
  User clicks        Web search +         Structured            Note created
  "Research" on      scrape calls         briefing as           with type:
  lead card          to data sources      markdown              ai_summary
  (or auto on                                    │               │
   new lead)                                     │               │
                                                 ▼               ▼
                                          ┌──────────────────────────┐
                                          │        Notify            │
                                          │  (toast / badge update)  │
                                          └──────────────────────────┘
```

**Step-by-step:**

1. **Trigger**: User clicks "Research" button on a Company or Contact detail page. Alternatively, auto-triggered when a new Lead is created (configurable per org).
2. **Context Assembly**: `context-assembler.ts` gathers existing CRM data for the entity (name, domain, industry, prior notes, outreach history).
3. **Research**: The `lead-research.service.ts` orchestrates parallel web searches and scrapes based on the entity data. Results are collected as raw text snippets.
4. **Synthesize**: Raw research data + CRM context are passed to the LLM with the `research/company-brief` prompt template. The LLM produces a structured JSON briefing.
5. **Store**: The briefing is formatted as markdown and saved as a `Note` with `entityType`/`entityId` pointing to the researched entity, `type: ai_summary`, `authorType: ai`.
6. **Notify**: A toast notification appears ("Research complete for Acme Corp"). The notes list refreshes to show the new AI summary at the top.

**API endpoint:** `POST /api/ai/research` → returns `202 Accepted` with a `jobId` (async processing).

**Status polling:** `GET /api/ai/status/:jobId` → returns current status and result when complete.

### 2.6 UI

| Element | Location | Behavior |
|---------|----------|----------|
| **Research button** | Company detail header, Contact detail header, Lead card actions | Triggers research. Shows loading spinner while processing. |
| **Research panel** | Side panel or modal on entity detail page | Displays the structured briefing with sections: Overview, Key People, News, Funding, Tech Stack, Talking Points. |
| **AI Summary badge** | Note list, note card | Badge indicating "AI Research" with a sparkle icon. Distinguishes from human-written notes. |
| **Refresh button** | Research panel header | Re-runs research (creates a new Note, does not overwrite the previous one). |
| **Confidence indicator** | Research panel footer | Visual indicator (green/yellow/red) based on `confidenceScore`. |
| **Source links** | Research panel footer | Expandable list of URLs used during research. |

### 2.7 Cost Control

| Mechanism | Details |
|-----------|---------|
| **Depth levels** | `brief` uses fewer search queries and a smaller model. `deep` uses more queries and a larger model. Default is `standard`. |
| **Token limits** | Max input tokens per research call: `brief` = 4,000, `standard` = 8,000, `deep` = 16,000. Enforced by the Token Budget Manager. |
| **Caching** | Research results are cached by `(entityType, entityId, depth)` for 24 hours. Re-running research within the cache window returns the cached result without a new AI call. Cache key includes a hash of the company name + domain to detect stale data. |
| **Batch processing** | When auto-research is enabled for new leads, research jobs are queued and processed in batches of 5 to avoid burst costs. |
| **Rate limiting** | Per-org rate limit on research calls (see [AI Cost Management](#9-ai-cost-management)). |

---

## 3. AI Agent: Outreach Assistant

### 3.1 Purpose

Generate personalized outreach message drafts based on CRM context. The agent helps users write better emails, LinkedIn messages, and follow-ups by incorporating company research, contact details, and outreach history into every draft.

### 3.2 Input

| Field | Source | Required | Description |
|-------|--------|----------|-------------|
| `contactId` | User selection | yes | UUID of the Contact to write to |
| `leadId` | User selection | no | UUID of the related Lead (provides deal context) |
| `type` | User selection | no | `email` (default), `message`, `linkedin` — controls format and length |
| `purpose` | User selection | no | `initial_outreach`, `follow_up`, `proposal`, `check_in` |
| `tone` | User selection | no | `professional` (default), `casual`, `urgent`, `friendly` |
| `context` | User input | no | Free-text additional context (max 2,000 chars) |
| `maxLength` | User selection | no | Max characters for the output (default 500) |

**Internal context gathered by Context Assembler:**

| Data Point | Source Entity | Purpose |
|------------|---------------|---------|
| Contact name, title, email, role | Contact | Personalize greeting and content |
| Company name, industry, size | Company | Reference company-specific details |
| Lead stage, value, title | Lead | Align message with deal context |
| Previous outreach (last 5 records) | Outreach | Avoid repetition, reference past conversations |
| Research briefing (if available) | Note (type: ai_summary) | Inject researched talking points |
| User's name | User (current) | Sign-off personalization |

### 3.3 Output

| Field | Type | Description |
|-------|------|-------------|
| `subject` | string | Email subject line (null for `message` and `linkedin` types) |
| `body` | string | The message body, formatted as plain text with natural paragraph breaks |
| `tokensUsed` | object | `{ input, output, total }` — transparency on cost |

### 3.4 Tone Profiles

| Tone | Characteristics | Use Case |
|------|-----------------|----------|
| **Professional** | Formal language, structured paragraphs, polite closings. "Dear [Name]", "Best regards". | First contact with enterprise clients, proposal delivery. |
| **Casual** | Conversational, shorter sentences, friendly closings. "Hi [Name]", "Cheers". | Follow-ups with established contacts, startup outreach. |
| **Urgent** | Direct, concise, action-oriented. Clear deadline or ask. "Hi [Name], quick ask — ...". | Time-sensitive proposals, deadline-driven follow-ups. |
| **Friendly** | Warm, personable, references shared experiences. "Great catching up at [event]". | Re-engagement, post-event follow-ups, relationship building. |

Tone is implemented as a system prompt modifier in the outreach prompt templates (`src/services/ai/prompts/outreach/`).

### 3.5 Workflow

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐     ┌──────────────┐
│   Select     │────►│   Assemble    │────►│   Generate   │────►│    Edit      │
│   Contact    │     │   Context     │     │   Draft      │     │   & Send     │
└──────────────┘     └───────────────┘     └──────────────┘     └──────────────┘
      │                     │                     │                     │
  Open compose         Gather contact,       LLM call with         User reviews
  form, select         company, lead,        outreach prompt       draft, edits
  contact, choose      outreach history,     template + tone       in the compose
  tone and purpose     research notes        modifier              editor, then
                                                                     sends
```

**Step-by-step:**

1. **Select**: User opens the Outreach compose form (`/outreach/compose`), selects a Contact, and optionally a Lead. They choose the message type, purpose, and tone.
2. **Assemble Context**: On clicking "AI Assist", the `outreach-assistant.service.ts` calls the Context Assembler to gather relevant CRM data.
3. **Generate Draft**: The assembled context is passed to the LLM with the appropriate prompt template (`draft-email.ts` or `follow-up.ts`). The response is streamed to the UI for fast perceived performance.
4. **Edit & Send**: The draft populates the compose form's subject and body fields. The user can edit freely. When satisfied, they click "Send" (or "Save as Draft"). The Outreach record is created with `createdBy: ai` if the body was AI-generated without significant edits, or `createdBy: human` if heavily modified.

**API endpoint:** `POST /api/ai/outreach/draft` → returns `200 OK` synchronously (target: < 5 seconds).

### 3.6 UI

| Element | Location | Behavior |
|---------|----------|----------|
| **AI Assist button** | Outreach compose form, next to the subject/body fields | Triggers draft generation. Shows loading state with streaming text. |
| **Tone selector** | Compose form toolbar | Dropdown with 4 tone options. Changing tone re-generates the draft. |
| **Purpose selector** | Compose form toolbar | Dropdown: Initial Outreach, Follow-Up, Proposal, Check-In. |
| **Draft editor** | Compose form body field | Rich text area pre-populated with AI draft. User edits freely. |
| **Regenerate button** | Compose form toolbar | Re-generates the draft with the same parameters (useful if first draft is off). |
| **Token indicator** | Compose form footer (subtle) | Shows tokens used for the current generation. |
| **Send confirmation** | Modal on "Send" click | Confirms send. Shows "AI-assisted" badge if `createdBy: ai`. |

### 3.7 Integration: Gmail API (Future)

When the Gmail integration is active:

- The "Send" button dispatches the email via the Gmail Adapter (`src/services/integrations/gmail/gmail.service.ts`).
- The sent email is tracked via `channelMetadata.gmailMessageId` and `channelMetadata.threadId`.
- Incoming replies are matched to the Outreach record via thread ID and trigger the response analysis capability (future).

---

## 4. AI Agent: Note Summarization

### 4.1 Purpose

Condense long notes, meeting transcripts, or email thread summaries into structured, actionable outputs. Extracts key decisions, action items, and suggested tags — turning verbose notes into scannable summaries.

### 4.2 Input

| Field | Source | Required | Description |
|-------|--------|----------|-------------|
| `noteIds` | User selection | yes | 1–10 Note UUIDs to summarize |
| `format` | User selection | no | `brief`, `structured` (default), `action_items` |

**Internal context gathered by Context Assembler:**

| Data Point | Source Entity | Purpose |
|------------|---------------|---------|
| Note content (markdown) | Note | Primary input for summarization |
| Note title, type | Note | Context for the summary framing |
| Entity type and name (parent) | Company/Contact/Lead/etc. | Ground the summary in CRM context |
| Related notes (optional) | Note | Cross-reference for multi-note summaries |

### 4.3 Output

| Field | Type | Description |
|-------|------|-------------|
| `summary` | string | Concise summary paragraph (150-300 words) |
| `actionItems` | string[] | Extracted action items, each a concise sentence |
| `keyDecisions` | string[] | Key decisions identified in the notes |
| `tags` | string[] | Suggested tags for categorization |
| `tokensUsed` | object | `{ input, output, total }` |

**Format variations:**

| Format | Output | Use Case |
|--------|--------|----------|
| `brief` | Summary only (no action items or decisions) | Quick overview of a single note |
| `structured` | Summary + action items + key decisions + tags | Default. Full extraction for meeting notes. |
| `action_items` | Action items only, with suggested assignees and due dates if inferable | Task-focused review. Action items can be bulk-created as Tasks. |

### 4.4 Workflow

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐     ┌──────────────┐
│   Select     │────►│   Assemble    │────►│  Summarize   │────►│   Display    │
│   Note(s)    │     │   Content     │     │  (LLM call)  │     │   Results    │
└──────────────┘     └───────────────┘     └──────────────┘     └──────────────┘
      │                     │                     │                     │
  User selects         Fetch note            LLM call with         Summary card
  1-10 notes and       content(s),           summarize prompt      appears below
  chooses format       chunk if needed       template              the note(s)
  (inline or bulk)     (> 100K chars)                                │
                                                                      │
                                                           ┌──────────┴──────────┐
                                                           │                     │
                                                     Action items         "Create Tasks"
                                                     as checklist         button to bulk-
                                                     with [ ] syntax      create Task records
```

**Step-by-step:**

1. **Select**: User clicks "Summarize" on a note, or selects multiple notes from the note list and clicks "Summarize Selected".
2. **Assemble Content**: The `note-summarization.service.ts` fetches note content. If a single note exceeds the model's context window, it is chunked using a sliding-window strategy (overlap of 500 tokens between chunks).
3. **Summarize**: The content is passed to the LLM with the `summarize/meeting-notes.ts` prompt template. The model returns structured JSON.
4. **Display**: Results are shown in a summary card below the original note. Action items are rendered as an interactive checklist. A "Create Tasks" button allows bulk-creation of Task records from action items.

**API endpoint:** `POST /api/ai/notes/summarize` → returns `200 OK` synchronously (target: < 5 seconds for up to 10 notes).

### 4.5 UI

| Element | Location | Behavior |
|---------|----------|----------|
| **Summarize button** | Note card actions menu, note detail view toolbar | Triggers summarization for a single note. |
| **Bulk summarize** | Note list view toolbar (checkbox selection) | Opens a modal to summarize selected notes. |
| **Summary card** | Below the note in note detail view | Displays summary, action items, key decisions, and tags. Collapsible. |
| **Action items checklist** | Inside summary card | Interactive checkboxes. Each item has a "Create Task" link. |
| **Create Tasks button** | Summary card footer | Opens a modal to bulk-create Task records from action items, pre-filled with entity linkage. |
| **Tags** | Summary card footer | Clickable tags that can be applied to the parent entity's metadata. |
| **AI Summary badge** | Note list | Badge on notes with `type: ai_summary` and `authorType: ai`. |

### 4.6 Batch Mode

For organizations with many notes to process:

- **Bulk endpoint**: The same `POST /api/ai/notes/summarize` accepts up to 10 note IDs.
- **Background processing**: If more than 5 notes are submitted, the job is processed asynchronously (returns `202 Accepted` with a `jobId`).
- **Quota awareness**: Batch operations check remaining quota before starting. If quota is insufficient, the user is prompted to select fewer notes or wait for quota reset.

---

## 5. AI Agent: Meeting Notes (Future)

### 5.1 Purpose

Automatically transcribe and summarize meetings from audio/video recordings or existing transcripts. Produces structured meeting notes with attendees, discussion topics, decisions, and action items — linked directly to the relevant CRM entities.

### 5.2 Input

| Field | Source | Required | Description |
|-------|--------|----------|-------------|
| Audio/video file | User upload or integration | yes | Recording from Google Meet, Zoom, Teams, or manual upload |
| Transcript text | User paste or integration | alt | Pre-existing transcript (skips transcription step) |
| `entityType` | User selection | no | Polymorphic entity to attach notes to |
| `entityId` | User selection | no | ID of the parent entity |
| `attendees` | User selection | no | List of attendee names/emails for matching to Contacts |

### 5.3 Output

| Field | Type | Description |
|-------|------|-------------|
| `transcript` | string | Full transcript (if audio input was provided) |
| `summary` | string | Executive summary of the meeting |
| `attendees` | object[] | Detected attendees with Contact matches (if identifiable) |
| `topics` | object[] | Discussion topics with timestamps |
| `decisions` | string[] | Key decisions made |
| `actionItems` | object[] | Action items with suggested assignee and due date |
| `sentiment` | string | Overall meeting sentiment: positive, neutral, negative |
| `followUpDate` | string? | Suggested follow-up date based on discussed timelines |

### 5.4 Integration

| Platform | Method | Status |
|----------|--------|--------|
| **Google Meet** | Google Calendar integration detects meetings; recording fetched via Google Drive API | Future |
| **Zoom** | Zoom webhook notifies on recording available; fetched via Zoom API | Future |
| **Microsoft Teams** | Microsoft Graph API for recording access | Future |
| **Manual upload** | User uploads audio/video file (MP3, MP4, WAV) via the UI | Future |

### 5.5 Workflow

```
┌──────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Record   │────►│  Transcribe  │────►│  Summarize    │────►│   Attach     │
│  /Upload  │     │  (STT API)   │     │  (LLM call)   │     │  to Entity   │
└──────────┘     └──────────────┘     └───────────────┘     └──────────────┘
      │                  │                    │                     │
  Meeting ends       Speech-to-text       Structured            Note created
  or user uploads    API call            extraction of          with type:
  recording          (e.g., Whisper)     summary, actions,      meeting
                                           decisions
```

**Pipeline:**

1. **Record/Upload**: Recording is triggered automatically (via calendar integration) or manually uploaded.
2. **Transcribe**: Audio is sent to a speech-to-text API (OpenAI Whisper, Deepgram, or AssemblyAI). Output is a timestamped transcript.
3. **Summarize**: The transcript is passed to the LLM with a meeting-specific prompt template. The model extracts structured data.
4. **Attach**: A `Note` is created with `type: meeting`, `authorType: ai`, linked to the relevant entity. Action items can be bulk-created as Tasks. Attendees are matched to existing Contacts by email.

### 5.6 Data Model Extensions (Future)

The existing `Note` model supports this feature with `type: meeting`. Additional metadata is stored in the `metadata` JSON field:

```json
{
  "recordingUrl": "https://...",
  "transcriptNoteId": "nte_...",
  "duration": "45min",
  "platform": "google_meet",
  "attendeeEmails": ["john@acme.com", "jane@bluearc.com"],
  "matchedContactIds": ["con_01JABC..."]
}
```

If transcript storage becomes a first-class concern, a dedicated `MeetingTranscript` table may be introduced in the future. For the initial implementation, the transcript is stored as a separate Note with `type: call_log`.

---

## 6. AI Agent: Smart Suggestions (Future)

### 6.1 Purpose

Proactively analyze CRM data and surface actionable suggestions to users. Instead of waiting for the user to trigger an AI action, this agent runs continuously in the background and pushes recommendations to the dashboard.

### 6.2 Suggestion Types

| Suggestion | Trigger | Action |
|------------|---------|--------|
| **Follow-up reminder** | No outreach to a lead in 7+ days, lead is in `qualified` or `proposal` stage | "Follow up with John Doe — last contact was 8 days ago" |
| **Stale lead alert** | Lead in `new` stage for 14+ days with no activity | "Lead 'Enterprise Deal' has been idle for 14 days. Qualify or archive?" |
| **Lead score update** | Positive signals detected (new funding, job posting, website change) | "Acme Corp raised Series B. Consider upgrading lead priority." |
| **Deal stage recommendation** | Outreach patterns suggest readiness to advance | "3 positive replies from Acme Corp. Consider moving to 'proposal' stage." |
| **Overdue task alert** | Task past due date with no completion | "Task 'Send proposal' is 2 days overdue." |
| **Contact enrichment** | Contact missing key fields (title, phone) | "John Doe is missing a job title. Run research to enrich?" |
| **Meeting prep brief** | Calendar event with an external contact in next 24 hours | "Meeting with Acme Corp tomorrow. Here's a prep brief." |

### 6.3 Workflow

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐     ┌──────────────┐
│   Scheduled  │────►│    Analyze    │────►│   Generate   │────►│   Display    │
│   Scan       │     │   CRM Data    │     │ Suggestions  │     │  in Dashboard│
└──────────────┘     └───────────────┘     └──────────────┘     └──────────────┘
      │                     │                     │                     │
  Cron job runs        Query leads,         LLM call with          Suggestion
  (e.g., every         contacts,            suggestion prompt       cards appear
  6 hours)             outreach, tasks      template               in dashboard
                                               │                     │
                                          ┌────┴────┐          ┌────┴────┐
                                          │ Accept  │          │ Dismiss │
                                          │ → Action│          │ → Hide  │
                                          └─────────┘          └─────────┘
```

**Step-by-step:**

1. **Scheduled Scan**: A background job runs every 6 hours (configurable). It queries the CRM for patterns that match suggestion triggers.
2. **Analyze**: The job identifies entities matching trigger conditions (e.g., leads with no recent outreach, overdue tasks).
3. **Generate**: For each trigger, the LLM generates a human-readable suggestion with a recommended action.
4. **Display**: Suggestions appear as cards on the dashboard. Each card has "Accept" and "Dismiss" buttons.
5. **Act**: Accepting a suggestion triggers the corresponding action (create a task, update a lead stage, trigger research, etc.). Dismissing a suggestion records the dismissal to avoid re-surfacing the same suggestion.

### 6.4 UI

| Element | Location | Behavior |
|---------|----------|----------|
| **Suggestion cards** | Dashboard home, below KPI cards | Cards with icon, suggestion text, and Accept/Dismiss buttons. Max 5 visible; "View all" for more. |
| **Suggestion badge** | Sidebar navigation | Badge count of unread suggestions. |
| **Suggestion detail** | Modal on card click | Expanded view with context (why this suggestion was made, supporting data). |
| **Settings** | Settings → AI → Smart Suggestions | Toggle feature on/off, configure scan frequency, disable specific suggestion types. |

### 6.5 Data Model (Future)

A new `Suggestion` entity may be introduced:

```
Suggestion {
  id              UUID
  organizationId  UUID
  entityType      PolymorphicEntityType
  entityId        UUID
  type            String (follow_up, stale_lead, score_update, etc.)
  title           String
  description     String
  action          Json (the action to take if accepted)
  status          Enum (pending, accepted, dismissed)
  metadata        Json
  createdAt       DateTime
  resolvedAt      DateTime?
}
```

Alternatively, suggestions can be stored as ephemeral data (in-memory or Redis) and regenerated on each scan, avoiding database growth. The final approach will be decided during implementation based on performance and cost trade-offs.

---

## 7. AI Infrastructure

### 7.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI SERVICE LAYER                                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                       AI Gateway / Router                              │  │
│  │  • Unified interface for all AI calls                                  │  │
│  │  • Provider selection (round-robin, cost-based, fallback)              │  │
│  │  • Request/response normalization                                      │  │
│  │  • Retry logic with exponential backoff                                │  │
│  └────────────────────────────────┬──────────────────────────────────────┘  │
│                                   │                                         │
│  ┌────────────┐  ┌────────────┐  │  ┌────────────┐  ┌────────────────┐    │
│  │  Prompt    │  │  Context   │  │  │  Token     │  │  Response      │    │
│  │  Registry  │  │  Assembler │  │  │  Budget    │  │  Cache         │    │
│  │            │  │            │  │  │  Manager   │  │                │    │
│  │  Versioned │  │  Gathers   │  │  │            │  │  Semantic +    │    │
│  │  prompts   │  │  CRM data  │  │  │  Per-org   │  │  exact-match   │    │
│  │  as code   │  │  for input │  │  │  limits    │  │  caching       │    │
│  └────────────┘  └────────────┘  │  └────────────┘  └────────────────┘    │
│                                   │                                         │
│  ┌────────────────────────────────┴─────────────────────────────────────┐  │
│  │                       Usage Tracker                                   │  │
│  │  • Logs every AI call to AiUsageLog                                   │  │
│  │  • Tracks tokens, cost, latency per org/user/feature                  │  │
│  │  • Feeds into billing and quota enforcement                           │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │   OpenAI     │ │  Anthropic   │ │  Self-hosted │
           │   (GPT-4o,   │ │  (Claude     │ │  (Ollama,    │
           │    o3-mini)  │ │   Sonnet)    │ │   vLLM)      │
           └──────────────┘ └──────────────┘ └──────────────┘
```

### 7.2 AI Gateway

**Location:** `src/services/ai/ai-gateway.ts`

The AI Gateway is the single entry point for all AI operations. It provides a unified interface regardless of the underlying provider.

**Interface:**

```
AiGateway {
  complete(request: AiRequest): Promise<AiResponse>
  stream(request: AiRequest): AsyncIterable<AiChunk>
}

AiRequest {
  provider?: string          // Optional: force a specific provider
  model?: string             // Optional: force a specific model
  messages: Message[]        // Chat messages (system, user, assistant)
  temperature?: number       // Default 0.7
  maxTokens?: number         // Max output tokens
  responseFormat?: string    // "json" | "text"
  tools?: ToolDefinition[]   // For function calling (future)
}

AiResponse {
  content: string            // The generated text
  provider: string           // Which provider handled the request
  model: string              // Which model was used
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  latencyMs: number          // How long the call took
}
```

**Provider selection strategy:**

| Strategy | Description | Use Case |
|----------|-------------|----------|
| **Default** | Uses the organization's configured default provider | General use |
| **Cost-optimized** | Routes to the cheapest provider that meets quality requirements | Summarization, simple tasks |
| **Quality-optimized** | Routes to the highest-quality model | Research synthesis, complex outreach |
| **Fallback** | If primary provider fails, automatically retries with secondary | Resilience |

**Provider adapters:**

| File | Provider | Models |
|------|----------|--------|
| `src/services/ai/providers/openai.ts` | OpenAI | GPT-4o, o3-mini, GPT-4o-mini |
| `src/services/ai/providers/anthropic.ts` | Anthropic | Claude Sonnet 4, Claude Haiku |
| `src/services/ai/providers/self-hosted.ts` | Self-hosted | Ollama, vLLM (future) |

### 7.3 Prompt Management

**Location:** `src/services/ai/prompts/`

Prompts are versioned, typed, and stored as code — not in the database or an external service.

**Structure:**

```
src/services/ai/prompts/
├── outreach/
│   ├── draft-email.ts         // Initial outreach email generation
│   ├── follow-up.ts           // Follow-up message generation
│   ├── proposal.ts            // Proposal message generation
│   └── tone-modifiers.ts      // Tone profile system prompts
├── research/
│   └── company-brief.ts       // Company research synthesis
├── summarize/
│   ├── meeting-notes.ts       // Meeting note summarization
│   ├── general-note.ts        // General note summarization
│   └── action-items.ts        // Action item extraction
└── _shared/
    ├── system-prompt.ts       // Base system prompt for Blue Arc OS
    └── output-schemas.ts      // Zod schemas for structured outputs
```

**Prompt template pattern:**

Each prompt file exports a function that accepts context data and returns a `Message[]` array:

```
// Conceptual pattern — not code, just architecture
buildCompanyBriefPrompt(context: {
  companyName: string
  domain: string
  industry: string
  rawResearch: string
  existingCrmData: object
}) → Message[]
```

**Versioning:** Prompts are versioned via git. Each prompt file includes a `version` constant. The `AiUsageLog` can optionally record the prompt version for reproducibility.

**A/B testing:** Future capability. Two prompt versions can be deployed simultaneously, with traffic split by organization ID hash. Results are compared via the Usage Tracker.

### 7.4 Context Assembly

**Location:** `src/services/ai/context-assembler.ts`

The Context Assembler is responsible for gathering the minimum viable context for each AI call. It prevents over-fetching (which wastes tokens) and under-fetching (which produces generic outputs).

**Strategy per agent:**

| Agent | Context Sources | Max Context Size |
|-------|----------------|------------------|
| Lead Research | Company, Contact, existing Notes, existing Outreach | 8,000 tokens |
| Outreach Assistant | Contact, Company, Lead, last 5 Outreach records, research Note (if exists) | 6,000 tokens |
| Note Summarization | Note content (chunked if needed), parent entity name | 16,000 tokens |
| Meeting Notes | Transcript, attendee list, entity context | 32,000 tokens |
| Smart Suggestions | Entity data, outreach history, task list | 4,000 tokens |

**Context assembly rules:**

1. **Always include**: Entity core fields (name, title, industry), user's name for personalization.
2. **Include if available**: Research briefings, recent outreach, related notes.
3. **Never include**: Passwords, tokens, other org's data, sensitive metadata fields.
4. **Truncate**: Long text fields (note content, outreach body) are truncated to fit within the token budget.
5. **Prioritize**: Recent data is prioritized over old data. The most recent 5 outreach records are included, not all 50.

### 7.5 Token Budgeting

**Location:** `src/services/ai/token-budget.ts`

Token budgeting tracks and enforces usage limits per organization.

**Quota tiers (aligned with API rate limits in API_CONTRACTS.md):**

| Plan | AI calls/day | Estimated monthly token budget |
|------|-------------|-------------------------------|
| Free | 10 | ~500,000 tokens |
| Pro | 500 | ~50,000,000 tokens |
| Enterprise | 5,000 | ~500,000,000 tokens |

**Enforcement:**

- Before each AI call, the Token Budget Manager checks remaining quota.
- If quota is exceeded, the request is rejected with `429 RATE_LIMITED` and a clear message.
- Quota resets daily at midnight UTC.
- Organizations can view remaining quota in Settings → AI → Usage.

**Per-feature limits (within daily quota):**

| Feature | Max tokens/call (Free) | Max tokens/call (Pro) | Max tokens/call (Enterprise) |
|---------|----------------------|---------------------|------------------------------|
| Research (brief) | 4,000 | 8,000 | 16,000 |
| Research (standard) | 8,000 | 16,000 | 32,000 |
| Research (deep) | N/A | 32,000 | 64,000 |
| Outreach draft | 2,000 | 4,000 | 8,000 |
| Note summarize | 4,000 | 16,000 | 32,000 |

### 7.6 Response Caching

**Strategy:**

| Cache Layer | Scope | TTL | Key |
|-------------|-------|-----|-----|
| **Exact-match cache** | In-memory (per Vercel edge function instance) | 1 hour | SHA-256 hash of (feature, prompt_messages, model) |
| **Semantic cache** | Database (future) | 24 hours | Embedding similarity > 0.95 threshold |
| **Research cache** | Database (`Note` records) | 24 hours | (entityType, entityId, depth) |

**Cache invalidation:**

- Research cache is invalidated when the Company's name, domain, or industry changes.
- Exact-match cache is invalidated on deployment (new prompt version = new cache key).
- Semantic cache is invalidated when the source entity is updated.

### 7.7 Rate Limiting

AI-specific rate limits are layered on top of the general API rate limits:

| Scope | Limit | Window |
|-------|-------|--------|
| Per-user, per-feature | 5 calls | 1 minute |
| Per-org, per-feature | 20 calls | 1 minute |
| Per-org, all features | See daily quota | 1 day |

Exceeding rate limits returns `429 RATE_LIMITED` with a `retryAfter` value in seconds.

### 7.8 Fallback and Graceful Degradation

| Scenario | Behavior |
|----------|----------|
| **Primary provider down** | Automatically retry with secondary provider. If all providers fail, return an error with retry option. |
| **All providers down** | AI features are temporarily unavailable. The UI shows a clear message: "AI is temporarily unavailable. You can continue using the CRM normally." Core CRM operations are unaffected. |
| **Slow response (> 30s)** | The request is cancelled and retried with a smaller/faster model. |
| **Quota exceeded** | Clear error message with quota reset time. Option to upgrade plan. |
| **Invalid AI output** | Structured output validation (Zod schema) catches malformed responses. The call is retried once with a stricter prompt. If it fails again, an error is returned. |

---

## 8. AI Data Flow

### 8.1 CRM → AI → CRM Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                                                                   │
│   ┌─────────┐      ┌──────────────┐      ┌─────────────┐      ┌─────────────┐  │
│   │  CRM    │─────►│   Context    │─────►│  AI Gateway │─────►│   Provider  │  │
│   │  Data   │      │   Assembler  │      │  + Prompts  │      │   (LLM)     │  │
│   │         │      │              │      │             │      │             │  │
│   │ Company │      │ Selects      │      │ Builds      │      │ Generates   │  │
│   │ Contact │      │ relevant     │      │ prompt from │      │ response    │  │
│   │ Lead    │      │ fields,      │      │ template +  │      │             │  │
│   │ Note    │      │ truncates,   │      │ context     │      │             │  │
│   │ Outreach│      │ formats      │      │             │      │             │  │
│   └─────────┘      └──────────────┘      └─────────────┘      └──────┬──────┘  │
│                                                                       │          │
│   ┌─────────┐      ┌──────────────┐      ┌─────────────┐             │          │
│   │  CRM    │◄─────│   Validate   │◄─────│  Parse &    │◄────────────┘          │
│   │  Write  │      │   & Log      │      │  Format     │                         │
│   │         │      │              │      │             │                         │
│   │ Note    │      │ Zod schema   │      │ JSON →      │                         │
│   │ Outreach│      │ check,       │      │ markdown,   │                         │
│   │ Task    │      │ AiUsageLog   │      │ structured  │                         │
│   │         │      │ entry        │      │ data        │                         │
│   └─────────┘      └──────────────┘      └─────────────┘                         │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Data flow steps:**

1. **CRM Data** → The Context Assembler queries Prisma for relevant entities (scoped to `organizationId`).
2. **Context Assembly** → Fields are selected, truncated, and formatted into prompt messages.
3. **AI Gateway** → The prompt is sent to the selected provider via the AI Gateway.
4. **Provider (LLM)** → The external AI provider generates a response.
5. **Parse & Format** → The response is parsed (JSON extraction, markdown formatting).
6. **Validate & Log** → Output is validated against a Zod schema. An `AiUsageLog` entry is created.
7. **CRM Write** → The result is persisted: a Note is created, an Outreach draft is populated, Tasks are created.

### 8.2 Privacy: What Data Is Sent to AI Providers

| Data Category | Sent? | Conditions |
|---------------|-------|------------|
| Company name, domain, industry | Yes | Required for research and outreach context |
| Contact name, title, email | Yes | Required for personalization |
| Lead stage, value, title | Yes | Required for deal context |
| Note content | Yes | Required for summarization |
| Outreach body (previous messages) | Yes | Required for conversation context |
| User name | Yes | For sign-off personalization |
| Organization name | No | Not needed by the LLM |
| Organization slug | No | Internal identifier |
| Other users' data | No | Only the current user's name is included |
| Passwords, tokens, API keys | Never | Stripped by Context Assembler |
| Other organizations' data | Never | Scoping by `organizationId` prevents cross-tenant leakage |
| Raw entity IDs (UUIDs) | No | IDs are used for database lookups but not included in prompts |

### 8.3 Opt-In / Opt-Out

| Level | Control | Location |
|-------|---------|----------|
| **Organization-wide** | Toggle all AI features on/off | Settings → AI → Enable AI Features |
| **Per-feature** | Toggle individual agents | Settings → AI → Lead Research / Outreach / Summarization |
| **Per-user** | User can disable AI suggestions for themselves | Profile → Preferences → AI Suggestions |
| **Per-entity** | User can exclude specific entities from AI processing | Entity detail → ⋮ menu → Exclude from AI (stored in `metadata.aiExcluded: true`) |

### 8.4 Audit Trail

Every AI interaction is recorded in the `AiUsageLog` table:

| Field | Description |
|-------|-------------|
| `organizationId` | Which organization made the call |
| `userId` | Which user triggered the call |
| `feature` | Which AI feature was used (`research`, `outreach`, `summary`) |
| `provider` | Which AI provider handled the call (`openai`, `anthropic`) |
| `model` | Which model was used (`gpt-4o`, `claude-sonnet-4-20250514`) |
| `inputTokens` | Number of input tokens |
| `outputTokens` | Number of output tokens |
| `totalTokens` | Total tokens consumed |
| `cost` | Estimated cost in USD (based on provider pricing) |
| `createdAt` | When the call was made |

**Additional audit data** (stored in the entity's `metadata` field):

| Entity | Metadata Fields |
|--------|----------------|
| Note (AI-generated) | `metadata.aiModel`, `metadata.aiProvider`, `metadata.aiPromptVersion`, `metadata.aiTokensUsed` |
| Outreach (AI-generated) | `metadata.aiModel`, `metadata.aiProvider`, `metadata.aiPromptVersion`, `metadata.aiTokensUsed` |

This creates a complete audit trail: who triggered AI, what it cost, what model was used, and what was produced.

---

## 9. AI Cost Management

### 9.1 Token Tracking Per Organization

Token usage is tracked in real-time via the `AiUsageLog` table. The Usage Tracker updates a running counter after every AI call.

**Tracking granularity:**

| Dimension | Purpose |
|-----------|---------|
| Per organization | Billing, quota enforcement |
| Per user | Accountability, usage analytics |
| Per feature | Cost attribution, optimization |
| Per provider/model | Cost optimization, provider selection |
| Per day | Daily quota enforcement |

### 9.2 Usage Quotas and Limits

| Plan | Daily AI Calls | Monthly Token Budget | Max Concurrent AI Jobs | Overage Policy |
|------|---------------|---------------------|----------------------|----------------|
| Free | 10 | ~500K tokens | 1 | Hard stop. No overage. |
| Pro | 500 | ~50M tokens | 5 | Hard stop at 2x daily limit. |
| Enterprise | 5,000 | ~500M tokens | 20 | Custom. Soft limit with notification. |

**Quota reset:** Daily quotas reset at midnight UTC. Monthly budgets reset on the billing cycle start date.

**Approaching quota:** When an organization reaches 80% of its daily quota, a warning is displayed in the UI and a notification is sent to the organization owner.

### 9.3 Cost Allocation

**Cost estimation model:**

| Provider | Model | Input Cost (per 1M tokens) | Output Cost (per 1M tokens) |
|----------|-------|---------------------------|----------------------------|
| OpenAI | GPT-4o | $2.50 | $10.00 |
| OpenAI | o3-mini | $1.10 | $4.40 |
| OpenAI | GPT-4o-mini | $0.15 | $0.60 |
| Anthropic | Claude Sonnet 4 | $3.00 | $15.00 |
| Anthropic | Claude Haiku | $0.80 | $4.00 |

**Cost per feature (estimated averages):**

| Feature | Avg Input Tokens | Avg Output Tokens | Avg Cost/Call |
|---------|-----------------|-------------------|---------------|
| Research (standard) | 6,000 | 2,000 | ~$0.035 |
| Outreach draft | 4,000 | 500 | ~$0.015 |
| Note summarize | 8,000 | 500 | ~$0.025 |

**Monthly cost estimates per plan:**

| Plan | Avg Calls/Day | Avg Cost/Call | Est. Monthly Cost |
|------|--------------|---------------|-------------------|
| Free | 5 | $0.025 | ~$3.75 |
| Pro | 200 | $0.025 | ~$150 |
| Enterprise | 2,000 | $0.025 | ~$1,500 |

### 9.4 Billing Integration

**Phase 1 (Free + Pro):** AI costs are included in the plan price. The Free plan includes 10 AI calls/day; the Pro plan includes 500 AI calls/day. No separate AI billing.

**Phase 2 (Enterprise):** Custom AI quotas are negotiated as part of the enterprise contract. Overage is billed at a per-token rate agreed in the contract.

**Future (Usage-based):** If usage-based billing is introduced, the `AiUsageLog` data feeds directly into the billing system. Each organization's invoice includes a line item for AI usage with breakdown by feature.

---

## 10. AI Quality and Safety

### 10.1 Hallucination Prevention

| Strategy | Implementation |
|----------|----------------|
| **Grounding in CRM data** | The Context Assembler provides factual CRM data. The prompt instructs the model to base its output on provided data and flag uncertainty. |
| **Confidence scoring** | Research outputs include a `confidenceScore` (0-100). Low-confidence items are visually flagged in the UI. |
| **Source attribution** | Research outputs include a `sources` array. Users can verify claims by following source links. |
| **Structured output validation** | Zod schemas validate that AI outputs match expected shapes. Missing required fields trigger a retry. |
| **"I don't know" instruction** | System prompts explicitly instruct the model to say "I don't know" or "Data not available" rather than fabricate information. |
| **Human review gate** | AI outputs are always drafts. The user must review and accept before the output becomes a permanent CRM record. |

### 10.2 Content Filtering

| Layer | Purpose |
|-------|---------|
| **Input filtering** | Detect and block prompt injection attempts in user-provided context fields (e.g., the `context` field in outreach drafts). |
| **Output filtering** | Scan AI outputs for inappropriate content (profanity, bias, PII leakage). Flagged outputs are blocked and an error is returned. |
| **PII detection** | Before sending data to AI providers, the Context Assembler strips fields that should not be shared (phone numbers in some contexts, addresses, etc.). Configuration per organization. |

### 10.3 Bias Detection

| Concern | Mitigation |
|---------|------------|
| **Gender bias in outreach** | Prompt templates use gender-neutral language by default. The model is instructed to use the contact's name, not gendered pronouns. |
| **Cultural bias** | Tone profiles are reviewed for cultural assumptions. "Professional" tone defaults to internationally accepted business English. |
| **Naming bias** | The model is instructed to use names exactly as stored in the CRM, without modification or assumption of pronunciation. |
| **Monitoring** | Periodic audit of AI outputs for bias patterns. User feedback flags are reviewed monthly. |

### 10.4 User Feedback Loop

| Mechanism | Description |
|-----------|-------------|
| **Thumbs up/down** | Every AI output has a subtle feedback indicator. Users can rate the quality. |
| **Regenerate** | Users can regenerate any AI output. Regeneration is logged and tracked (high regeneration rates signal prompt issues). |
| **Edit tracking** | The system tracks how much users edit AI-generated content. Heavy edits signal quality issues. |
| **Feedback metadata** | Feedback is stored in the entity's `metadata` field: `metadata.aiFeedback: { rating: "up", userId: "...", timestamp: "..." }`. |

**Feedback loop:**

```
AI Output → User edits/rates → Feedback logged → Monthly analysis → Prompt improvements
```

### 10.5 Continuous Improvement

| Activity | Frequency | Owner |
|----------|-----------|-------|
| **Prompt review** | Monthly | Engineering |
| **Output quality audit** | Monthly | Engineering + Product |
| **Model evaluation** | Quarterly | Engineering |
| **Cost optimization** | Monthly | Engineering |
| **User feedback analysis** | Monthly | Product |
| **A/B test new prompts** | As needed | Engineering |

**Model evaluation criteria:**

| Criterion | Weight | Measurement |
|-----------|--------|-------------|
| Output quality | 40% | User feedback scores, edit distance |
| Latency | 20% | p50 and p95 response times |
| Cost | 20% | Cost per call, cost per satisfied user |
| Reliability | 10% | Error rate, timeout rate |
| Safety | 10% | Content filter triggers, hallucination reports |

---

## 11. Implementation Phases

### Phase 1: Lead Research (MVP)

**Scope:** Company and contact research agent.

| Deliverable | Details |
|-------------|---------|
| AI Gateway | Core gateway with OpenAI provider adapter |
| Context Assembler | Company + Contact context gathering |
| Prompt template | `research/company-brief.ts` |
| API endpoint | `POST /api/ai/research` (async, returns jobId) |
| Status endpoint | `GET /api/ai/status/:jobId` |
| UI: Research button | Company and Contact detail pages |
| UI: Research panel | Side panel displaying structured briefing |
| Storage | Results saved as Notes (`type: ai_summary`, `authorType: ai`) |
| Token budgeting | Basic per-org daily limit enforcement |
| Usage logging | `AiUsageLog` entries for every research call |

**Success criteria:**

- Research completes in < 60 seconds for standard depth.
- Users rate research quality ≥ 3.5/5 on average.
- Research reduces time-to-first-outreach by measurable margin.

**Dependencies:**

- OpenAI API key configured.
- Web search API (Tavily or Serper) configured.
- Core CRM entities (Company, Contact, Lead, Note) functional.

---

### Phase 2: Outreach Assistant

**Scope:** AI-powered outreach draft generation.

| Deliverable | Details |
|-------------|---------|
| Provider adapter | Anthropic adapter added (for tone quality) |
| Context Assembler | Extended with Outreach history, research Notes |
| Prompt templates | `outreach/draft-email.ts`, `outreach/follow-up.ts`, `outreach/tone-modifiers.ts` |
| API endpoint | `POST /api/ai/outreach/draft` (synchronous, streaming) |
| UI: AI Assist button | Outreach compose form |
| UI: Tone selector | Compose form toolbar |
| UI: Purpose selector | Compose form toolbar |
| Caching | Exact-match cache for identical context + prompt |
| Cost tracking | Per-feature cost breakdown in usage dashboard |

**Success criteria:**

- Draft generation completes in < 5 seconds.
- Users accept AI drafts with < 30% edit distance (light editing).
- Outreach volume increases by measurable margin.

**Dependencies:**

- Phase 1 complete (AI Gateway, basic infrastructure).
- Outreach entity functional.
- Anthropic API key configured.

---

### Phase 3: Note Summarization

**Scope:** Single and batch note summarization with action item extraction.

| Deliverable | Details |
|-------------|---------|
| Context Assembler | Extended with Note content chunking |
| Prompt templates | `summarize/meeting-notes.ts`, `summarize/general-note.ts`, `summarize/action-items.ts` |
| API endpoint | `POST /api/ai/notes/summarize` (synchronous for ≤ 5 notes, async for > 5) |
| UI: Summarize button | Note card, note detail view |
| UI: Bulk summarize | Note list with checkbox selection |
| UI: Summary card | Collapsible card below notes |
| UI: Create Tasks | Bulk task creation from action items |
| Response cache | Semantic cache for similar note content |

**Success criteria:**

- Summarization completes in < 5 seconds for single notes.
- Extracted action items are accurate ≥ 85% of the time (manual audit).
- Users create tasks from AI-extracted action items regularly.

**Dependencies:**

- Phase 1 complete.
- Note entity functional.
- Task entity functional (for action item → task creation).

---

### Phase 4: Meeting Notes

**Scope:** Audio transcription and meeting summarization.

| Deliverable | Details |
|-------------|---------|
| Speech-to-text integration | Whisper API or Deepgram adapter |
| File upload | Audio/video upload in the UI |
| Prompt template | Meeting-specific summarization prompt |
| UI: Upload interface | Modal or page for uploading recordings |
| UI: Transcript view | Scrollable transcript with timestamps |
| UI: Meeting summary | Structured summary with attendees, topics, actions |
| Calendar integration | Google Calendar meeting detection (optional) |
| Contact matching | Match attendee emails to existing Contacts |

**Success criteria:**

- Transcription accuracy ≥ 90% (word error rate < 10%).
- Meeting summaries capture ≥ 80% of action items (manual audit).
- Users attach meeting notes to CRM entities regularly.

**Dependencies:**

- Phase 3 complete (note summarization infrastructure).
- Speech-to-text API configured.
- Google Calendar integration (optional, can work with manual upload first).

---

### Phase 5: Smart Suggestions

**Scope:** Proactive CRM suggestions powered by pattern analysis.

| Deliverable | Details |
|-------------|---------|
| Scheduled scan job | Background job analyzing CRM data patterns |
| Suggestion engine | Rule-based triggers + LLM-generated suggestions |
| UI: Suggestion cards | Dashboard component with Accept/Dismiss |
| UI: Suggestion settings | Toggle types, frequency |
| Data model | `Suggestion` entity or ephemeral storage |
| Feedback loop | Track acceptance rate, refine triggers |

**Success criteria:**

- ≥ 30% of suggestions are accepted by users.
- Suggestions lead to measurable CRM improvements (faster follow-ups, better pipeline hygiene).
- Users report suggestions are helpful, not noisy.

**Dependencies:**

- Phases 1-3 complete (research, outreach, summarization provide data signals).
- Sufficient CRM data accumulated for pattern detection (minimum 30 days of usage).
- Background job infrastructure (Vercel Cron or external scheduler).

---

## 12. Technical Considerations

### 12.1 Model Selection Criteria

| Criterion | Weight | Notes |
|-----------|--------|-------|
| **Output quality** | High | Must produce accurate, well-structured, personalized outputs. Evaluated via user feedback and manual audits. |
| **Latency** | High | User-facing calls (outreach, summarize) must complete in < 5s. Research can tolerate up to 60s. |
| **Cost** | Medium | Balance quality vs. cost. Use smaller models for simple tasks (summarization), larger models for complex tasks (research synthesis). |
| **Context window** | Medium | Must handle the context sizes required by each agent (4K-32K tokens). |
| **Structured output** | Medium | Must reliably produce JSON output matching Zod schemas. OpenAI and Anthropic both support structured output modes. |
| **Data residency** | Low (initially) | For enterprise customers, may require providers with specific data residency guarantees. |

**Recommended model assignments:**

| Agent | Primary Model | Fallback Model | Rationale |
|-------|--------------|----------------|-----------|
| Lead Research | GPT-4o | Claude Sonnet 4 | Best synthesis quality, handles large context |
| Outreach Draft | Claude Sonnet 4 | GPT-4o | Best natural language quality for writing |
| Note Summarization | GPT-4o-mini | Claude Haiku | Cost-effective for structured extraction |
| Meeting Notes | GPT-4o | Claude Sonnet 4 | Handles long transcripts, good at structured output |
| Smart Suggestions | GPT-4o-mini | Claude Haiku | High volume, cost-sensitive, simple outputs |

### 12.2 Latency Requirements

| Agent | Target p50 | Target p95 | Timeout | Strategy |
|-------|-----------|-----------|---------|----------|
| Lead Research | 20s | 45s | 120s | Async. Progress indicator. Polling or WebSocket for updates. |
| Outreach Draft | 2s | 4s | 10s | Sync with streaming. User sees text appear in real-time. |
| Note Summarize | 2s | 4s | 10s | Sync. Loading spinner for single notes. |
| Meeting Notes | 30s | 90s | 180s | Async. Transcription is the bottleneck. |
| Smart Suggestions | N/A | N/A | N/A | Background job. No user-facing latency. |

**Latency optimization strategies:**

- **Streaming**: Outreach drafts use server-sent events (SSE) to stream text to the UI as it is generated.
- **Parallel context fetching**: The Context Assembler fetches all required entities in parallel using `Promise.all`.
- **Model selection**: Smaller models for latency-sensitive tasks.
- **Caching**: Cached responses return in < 100ms.
- **Edge deployment**: Vercel Edge Functions reduce network latency for AI Gateway calls.

### 12.3 Offline Mode

AI features require internet connectivity (they call external APIs). When offline:

| Behavior | Implementation |
|----------|----------------|
| **AI buttons disabled** | Buttons show a tooltip: "AI features require an internet connection." |
| **Queued requests** | If the user triggers an AI action while offline, the request is queued in IndexedDB and submitted when connectivity resumes. |
| **Cached results** | Previously generated AI results remain available in the CRM (they are stored as Notes and Outreach records). |
| **Core CRM unaffected** | All non-AI CRM operations work offline via standard Next.js offline patterns. |

### 12.4 Multi-Language Support

| Aspect | Approach |
|--------|----------|
| **AI input** | The Context Assembler passes CRM data as-is (whatever language the user entered). |
| **AI output** | The model is instructed to respond in the same language as the input data. If the CRM data is in Spanish, the AI output is in Spanish. |
| **System prompts** | System prompts are in English but include a directive: "Respond in the same language as the user's data." |
| **UI labels** | AI feature UI labels (buttons, tooltips) follow the app's i18n framework (future). |
| **Model capability** | GPT-4o and Claude Sonnet 4 both support multilingual input/output. No additional configuration needed. |
| **Limitation** | Research web searches may return results primarily in English. Non-English company research may have lower coverage. This is a known limitation documented to users. |

### 12.5 Environment Variables

AI-specific environment variables (aligned with the env validation in `src/env.ts`):

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Conditional | Required if OpenAI is configured as a provider |
| `ANTHROPIC_API_KEY` | Conditional | Required if Anthropic is configured as a provider |
| `AI_DEFAULT_PROVIDER` | No | Default provider: `openai` (default), `anthropic` |
| `AI_DEFAULT_MODEL` | No | Default model override |
| `AI_RESEARCH_SEARCH_API_KEY` | Conditional | Required for lead research (Tavily, Serper, or Bing) |
| `AI_RESEARCH_SEARCH_PROVIDER` | No | Search provider: `tavily` (default), `serper`, `bing` |
| `AI_CACHE_TTL_SECONDS` | No | Cache TTL for AI responses. Default: `3600` (1 hour). |
| `AI_ENABLE_SELF_HOSTED` | No | Enable self-hosted model provider. Default: `false`. |
| `FEATURE_AI_ENABLED` | No | Global AI feature flag. Default: `true`. |

### 12.6 Monitoring and Observability

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| AI call latency (p95) | `AiUsageLog.createdAt` vs response time | > 10s for sync calls |
| AI error rate | Failed AI calls / total AI calls | > 5% |
| AI cost per day | Sum of `AiUsageLog.cost` per day per org | > 80% of estimated monthly budget / 30 |
| AI quota utilization | Daily calls / daily limit | > 80% |
| Cache hit rate | Cache hits / total AI calls | < 10% (indicates caching issue) |
| User satisfaction | Average feedback score | < 3.0/5 |

---

## Appendix A: AI Agent Summary

| Agent | Status | API Endpoint | Sync/Async | Primary Model | Est. Cost/Call |
|-------|--------|-------------|------------|---------------|----------------|
| Lead Research | Phase 1 | `POST /api/ai/research` | Async | GPT-4o | ~$0.035 |
| Outreach Assistant | Phase 2 | `POST /api/ai/outreach/draft` | Sync (streaming) | Claude Sonnet 4 | ~$0.015 |
| Note Summarization | Phase 3 | `POST /api/ai/notes/summarize` | Sync | GPT-4o-mini | ~$0.005 |
| Meeting Notes | Phase 4 | Future | Async | GPT-4o + Whisper | ~$0.05 |
| Smart Suggestions | Phase 5 | Future | Background | GPT-4o-mini | ~$0.002 |

## Appendix B: File Structure (AI Services)

```
src/services/ai/
├── ai-gateway.ts                    # Unified AI interface
├── context-assembler.ts             # CRM data gathering for prompts
├── token-budget.ts                  # Quota tracking and enforcement
├── lead-research.service.ts         # Lead research agent logic
├── outreach-assistant.service.ts    # Outreach draft agent logic
├── note-summarization.service.ts    # Note summarization agent logic
│
├── providers/
│   ├── types.ts                     # Provider interface definitions
│   ├── openai.ts                    # OpenAI adapter
│   ├── anthropic.ts                 # Anthropic adapter
│   └── self-hosted.ts              # Self-hosted model adapter (future)
│
├── prompts/
│   ├── outreach/
│   │   ├── draft-email.ts           # Initial outreach prompt
│   │   ├── follow-up.ts             # Follow-up prompt
│   │   ├── proposal.ts              # Proposal prompt
│   │   └── tone-modifiers.ts        # Tone profile modifiers
│   ├── research/
│   │   └── company-brief.ts         # Company research synthesis prompt
│   ├── summarize/
│   │   ├── meeting-notes.ts         # Meeting summarization prompt
│   │   ├── general-note.ts          # General note summarization prompt
│   │   └── action-items.ts          # Action item extraction prompt
│   └── _shared/
│       ├── system-prompt.ts         # Base system prompt
│       └── output-schemas.ts        # Zod schemas for structured outputs
│
└── cache/
    ├── exact-match-cache.ts         # SHA-256 based response cache
    └── research-cache.ts            # Entity-specific research cache

src/components/ai/
├── ai-assist-button.tsx             # Reusable AI trigger button
├── ai-research-panel.tsx            # Research results display panel
├── ai-outreach-suggestions.tsx      # Outreach draft UI integration
├── ai-summary-badge.tsx             # Badge for AI-generated content
├── ai-summary-card.tsx              # Summary display card (notes)
├── ai-tone-selector.tsx             # Tone picker dropdown
├── ai-usage-indicator.tsx           # Token usage display
└── ai-feedback-buttons.tsx          # Thumbs up/down feedback
```

## Appendix C: Glossary

| Term | Definition |
|------|------------|
| **AI Gateway** | Unified interface that abstracts AI provider specifics behind a single API |
| **Context Assembler** | Service that gathers relevant CRM data before making an AI call |
| **Prompt Template** | Versioned, typed prompt stored as code that defines how to instruct the LLM |
| **Token** | Unit of text processing for LLMs. Roughly ¾ of a word in English. |
| **Token Budget** | The maximum number of tokens an organization can consume in a given period |
| **Structured Output** | AI response formatted as JSON matching a predefined schema |
| **Streaming** | Server-sent events that deliver AI output token-by-token as it is generated |
| **Hallucination** | When an AI model generates plausible-sounding but incorrect information |
| **Semantic Cache** | A cache that matches requests by meaning (embedding similarity) rather than exact string match |
| **Fallback** | Automatic switching to a backup provider when the primary provider fails |
