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
- Agent 2/Agent 3 draft workflow: lead-level deterministic draft generation, verifier checks, EmailDraft persistence, and Automation review queue approve/reject/mark-sent actions.
- Partnership workflow: PartnerCandidate model, manual partner candidate import, deterministic partnership fit analysis, fit scoring, contact extraction, and conversion to Company/Lead/Task.
- Integration credential setup: IntegrationCredential model and Settings panel for OpenAI, Anthropic, and Gmail OAuth env-var references without storing raw secrets in Postgres.
- Provider-backed agent execution: Agent 1, Agent 2, and Agent 3 now attempt configured local OpenAI-compatible, OpenAI, or Anthropic JSON execution first and fall back to deterministic local output if credentials are missing or provider output fails validation.
- Local model support: `local_openai` provider for LM Studio/Ollama/vLLM/llama.cpp-style OpenAI-compatible endpoints, attempted before paid providers when configured.
- Provider-call observability: AI provider attempts are logged with provider/model, agent, prompt key, status, duration, character counts, token usage when returned, and error metadata; provider calls retry once before deterministic fallback.
- AI usage dashboard: Settings now summarizes provider success/failure/skipped counts, token usage, latency, provider/agent breakdowns, and recent failures from `AiProviderCall`.
- Auth foundation: first-user signup creates a User, secure password hash, first Organization, owner membership, and HTTP-only session cookie; login/logout/me routes restore the selected workspace in the client.
- Workspace access resolver: API routes now use a shared session-aware resolver that verifies signed-in membership before accepting a workspace ID, with manual workspace IDs retained only as a development bridge.
- Role-aware write guard: workspace mutations require owner/admin/manager/member membership; viewer memberships are read-only.
- Member management: Settings can list workspace members, add existing signed-up users by email, update roles, remove members, and prevent deleting or demoting the final owner.
- Workspace invitations: adding a non-user creates a pending invitation, Settings shows/revokes pending invites, and signup by the invited email automatically joins the invited workspace.
- Explicit workspace auth errors: workspace-scoped APIs now return concrete auth responses instead of collapsing unauthorized access to a missing organization ID; viewer mutation attempts return `403`.
- AI budget controls: Settings can enforce monthly provider-call and token budgets; provider execution checks the current-month budget before calling local/OpenAI/Anthropic and logs budget blocks as skipped calls.
- Standalone Mailbox page: CRM Command navigation now includes a mailbox surface with thread filters, linked CRM context, suggested-reply review, Gmail sync, Gmail draft/send actions, and thread status controls.
- Website crawling: lead website research now follows discovered internal pages, stores multiple WebsitePage records, and exposes an extract-contacts action for discovered emails/phones.
- Partner analysis crawling: partner candidate fit analysis now uses multi-page crawl context instead of relying only on one submitted page.
- Workspace AI strategy generation: Settings can generate strategy from the stored workspace profile, persist the generated JSON, fill selected target/pain/CTA/guardrail fields, and fall back deterministically when no AI provider is available.
- Shared workspace selection: main CRM and CRM Command pages now use a membership-aware workspace selector instead of raw UUID entry when a user is signed in; raw ID entry remains only as a development fallback.
- Agent job queue foundation: lead website research, lead draft generation, mailbox suggested replies, Gmail mailbox sync, and partner sourcing can now be queued as AgentJobs, listed in Automation, and processed through reusable processor services shared with the inline Agent 1/2/3, mailbox, Gmail, and partner-search flows. The processor supports signed-in manual runs plus `AGENT_JOB_WORKER_SECRET` cron/worker calls with bounded batch limits.

## Key Original Features Not Yet Fully Ported

- Local business discovery via Google Places, geocoding, radius/category search.
- Provider-backed partnership web search for OpenAI/local providers. Anthropic web-search-backed live partner search, manual partner candidate import, and deterministic candidate ranking now exist.
- Broader queued website crawling beyond the current lead research and partner candidate multi-page crawl coverage.
- Full background worker coverage for provider-backed Agent execution. Durable AgentJob records and worker-authenticated processing now exist for lead website research, draft generation, mailbox reply drafting, Gmail mailbox sync, and provider-backed partner sourcing; remaining work is wiring the external scheduler and adding Gmail send/background pipeline orchestration.
- Send-as aliases for Gmail sending. Gmail OAuth connect/callback/disconnect/status, encrypted token storage, mailbox Gmail sync, and Gmail draft creation and send from mailbox threads are now implemented.
- Deeper mailbox automation. A dedicated mailbox UI surface, queued Gmail sync, and queued reply drafting now exist; remaining gaps are send-as aliases, richer automated classification over synced Gmail messages, and background Gmail send queue handling.
- Raw API key credential storage. The app now stores env-var references and status checks instead of raw secrets.
- Workspace strategy revision history and evals. Profile-backed generation now exists, but generated revisions are still stored as the current strategy JSON rather than versioned eval-ready records.
- Background pipeline worker for imported → research → draft → verify → draft/send progression.
- Automated partner search sourcing via non-Anthropic web search APIs. Anthropic web-search-backed sourcing (`POST /api/partner-candidates/search`), queued partner sourcing, partner candidate storage, fit score, contact emails, contact form URL, status transitions, and conversion to leads now exist.
- Lead pipeline status compatibility: discovered/imported/researching/researched/drafting/draft_ready/needs_review/approved/sent/replied/converted/archived.
- Role-specific permissions beyond read/write. The client now prefers signed-in workspace memberships, but manual `x-organization-id` still exists as a development bridge and request header until the API/client contract is fully session-derived.
- Production verification for outbound invite email delivery and deliverability settings. The Resend send path exists with a manual invite-link fallback when email is not configured.

## Integration Direction

Do not copy the old FastAPI/SQLite backend directly. Port the product behavior into the current architecture:

- Next.js route handlers for app APIs.
- Prisma/PostgreSQL models and migrations.
- Prompt catalog from `src/lib/ai/crm-agent-prompts.ts` as the source of agent instructions.
- Provider adapters for local OpenAI-compatible endpoints, OpenAI, and Anthropic behind app-native server routes.
- Gmail integration as app-native OAuth and background jobs after auth/workspace identity is stabilized.
- Use the User/OrganizationMember session model as the identity source for Gmail OAuth account linking, background jobs, and audit trails.

## Recommended Next Merge Passes

1. Wire deployment cron to `/api/agent-jobs/process` with `AGENT_JOB_WORKER_SECRET`, then expand job types to Gmail send and full pipeline orchestration.
2. Extend live partner web search to OpenAI/local providers. (Anthropic web-search-backed partner search is now implemented at `POST /api/partner-candidates/search`.)
3. Add send-as aliases and automated AI classification over synced Gmail messages. (Gmail OAuth connect/callback, draft creation, send, and inbox sync are now implemented.)
4. Move remaining workspace scoping from explicit `x-organization-id` headers toward signed-in session/default workspace resolution once every route is covered by membership-aware UI.
5. Add versioned strategy revisions/evals so generated workspace strategy changes can be compared and regression-tested.

## Future Model Consistency Work

Do not jump directly to fine-tuning. First build an evaluation and schema-validation layer:

- Define strict JSON schemas for Agent 1 research, Agent 2 drafts, Agent 3 verifier output, partnership fit, and reply drafting.
- Add 20-50 golden examples from real Blue Arc workflows: input context, expected JSON, and acceptable wording constraints.
- Add an evaluation runner that tests deterministic, local model, OpenAI, and Anthropic outputs for valid JSON, no hallucinated claims, no placeholders, correct CTA, and verifier decision accuracy.
- Add one retry pass that feeds schema validation errors back to the model before falling back.
- Revisit fine-tuning or local LoRA only after the evals identify repeatable failure patterns.
