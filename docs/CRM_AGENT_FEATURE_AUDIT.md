# CRM Command Merge Audit

Source app: `/Users/vladimiravdeev/Documents/crm-agent`
Target app: Blue Arc OS Next.js/PostgreSQL app.

## Prompting Ported

The old CRM agent prompts are preserved in `src/lib/ai/crm-agent-prompts.ts` with source-file references:

- Agent 1 website research: factual website summary, signals, evidenced pain points, conservative recommended angle.
- Agent 2 local outreach: signal/fallback/soft mode, exact CTA matching, no placeholder signatures.
- Agent 2 partnership outreach: vendor/subcontractor network framing, not selling to the target.
- Claude local outreach: short, specific, non-template cold email rules.
- Claude partnership outreach: peer-to-peer vendor network ask.
- Agent 3 verifier: evidence checking, mode-aware review, send/hold output.
- Email classifier: inbound reply classification and meeting-intent detection.
- Response draft agent: contextual reply/cold-outreach drafting rules.
- Partner search agent: real-company research constraints.
- Partnership fit agent: subcontractor/vendor-network scoring and outreach angle rules.
- Workspace strategy agent: business-type-specific target/pain/CTA generation.

## UI/Workflow Ported So Far

- Discovery page: prospect intake from pasted rows, creates Company, Lead, and research Task records.
- Automation page: review queue for draft outreach, active tasks, and hot leads.
- Sidebar grouping: CRM Command items are now under a dedicated submenu to avoid mixing core CRM CRUD with agent workflows.
- Outreach mailbox: thread/message models, manual inbound email import, classification filters, linked outreach records, and deterministic suggested replies using the preserved response-draft prompt metadata.
- Workspace profile and AI strategy context: business profile, sender signature fields, tone/CTA preferences, target categories, priority pain points, and guardrail notes.
- Website ingestion and Agent 1 research: lead-level website snapshots/pages, extracted emails/phones, persisted Agent 1 structured output, and a Leads table action that runs ingestion plus research.

## Key Original Features Not Yet Fully Ported

- Local business discovery via Google Places, geocoding, radius/category search.
- Partnership search via web search and candidate ranking.
- Multi-page website crawling beyond the manually submitted URL.
- Provider-backed Agent 1 AI execution. A deterministic app-native Agent 1 pass now persists the old structured output shape and prompt provenance.
- Agent 2 draft generation via Anthropic/OpenAI with workspace strategy context.
- Agent 3 draft verification and send/hold review queue.
- Email draft model with review status, Gmail draft IDs, sent metadata, and agent outputs.
- Gmail OAuth, draft creation, send-as aliases, inbox sync, and reply sending.
- Full inbox sync, AI classification, and approve/reject reply actions. Basic mailbox thread/message storage and suggested reply generation are now present.
- API key credential storage/onboarding flow.
- Workspace AI strategy generation from profile. Profile storage, selected target categories, pain points, CTA style, and guardrails are now present.
- Background pipeline worker for imported → research → draft → verify → draft/send progression.
- Partner candidate model, fit score, contact emails, contact form URL, status transitions, and conversion to leads.
- Lead pipeline status compatibility: discovered/imported/researching/researched/drafting/draft_ready/needs_review/approved/sent/replied/converted/archived.

## Integration Direction

Do not copy the old FastAPI/SQLite backend directly. Port the product behavior into the current architecture:

- Next.js route handlers for app APIs.
- Prisma/PostgreSQL models and migrations.
- Prompt catalog from `src/lib/ai/crm-agent-prompts.ts` as the source of agent instructions.
- Provider adapters for OpenAI/Anthropic behind app-native server routes.
- Gmail integration as app-native OAuth and background jobs after auth/workspace identity is stabilized.

## Recommended Next Merge Passes

1. Add Prisma models for email drafts, partner candidates, and integration credentials.
2. Add credential settings for AI keys and Google API/OAuth credentials.
3. Upgrade deterministic Agent 1 research to provider-backed execution using the preserved prompt catalog.
4. Implement Agent 2/Agent 3 draft generation and verification with review queue integration.
5. Add Gmail OAuth/draft/send/inbox sync after credential encryption and auth are in place.
