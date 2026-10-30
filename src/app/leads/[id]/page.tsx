"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";

type JsonObject = Record<string, unknown>;

type EmailDraft = {
  id: string;
  status: string;
  subject: string;
  body: string;
  usedSignal: string | null;
  verifierDecision: string | null;
  verifierReason: string | null;
  agent2Output: JsonObject | null;
  agent3Output: JsonObject | null;
  createdAt: string;
};

type LeadDetail = {
  id: string;
  title: string;
  stage: string;
  source: string | null;
  metadata: JsonObject | null;
  company: { id: string; name: string; website: string | null; domain: string | null; phone: string | null; industry: string | null } | null;
  contact: { id: string; firstName: string; lastName: string | null; email: string | null; phone: string | null } | null;
  agentResearchRuns: Array<{ id: string; output: JsonObject; createdAt: string }>;
  emailDrafts: EmailDraft[];
};

const stageColors: Record<string, string> = {
  new: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  researching: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  researched: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  draft_ready: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  needs_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter((item): item is JsonObject => !!item && typeof item === "object" && !Array.isArray(item)) : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function request(path: string, organizationId: string, method: "GET" | "POST" | "PATCH", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", "x-organization-id": organizationId },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? `Request failed for ${path}`);
  }
  return payload;
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const leadId = params?.id ?? "";
  const { organizationId } = useOrganization();

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !leadId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = (await request(`/api/leads/${leadId}`, organizationId, "GET")) as { lead: LeadDetail };
      setLead(payload.lead);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [organizationId, leadId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function runResearch() {
    setBusy("research");
    setError(null);
    setMessage(null);
    try {
      await request(`/api/leads/${leadId}/ingest-website`, organizationId, "POST", {});
      await request(`/api/leads/${leadId}/run-agent1`, organizationId, "POST", {});
      setMessage("Website ingested and Agent 1 research complete.");
      await load();
    } catch (researchError) {
      setError(researchError instanceof Error ? researchError.message : "Research failed");
    } finally {
      setBusy(null);
    }
  }

  async function generateDraft() {
    setBusy("draft");
    setError(null);
    setMessage(null);
    try {
      await request(`/api/leads/${leadId}/generate-draft`, organizationId, "POST", { mode: "signal" });
      setMessage("Draft generated and verified.");
      await load();
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Draft generation failed");
    } finally {
      setBusy(null);
    }
  }

  async function reviewDraft(action: "approve" | "reject") {
    if (!draft) {
      return;
    }
    setBusy(action);
    setError(null);
    setMessage(null);
    try {
      await request(`/api/email-drafts/${draft.id}`, organizationId, "PATCH", { action });
      setMessage(action === "approve" ? "Draft approved." : "Draft rejected.");
      await load();
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const draft = lead?.emailDrafts?.[0] ?? null;
  const research = lead?.agentResearchRuns?.[0]?.output ?? null;

  const signals = useMemo(() => asArray(research?.signals_found), [research]);
  const pains = useMemo(() => asArray(research?.pain_points_detected), [research]);
  const summaryLine = useMemo(() => {
    const summary = research?.website_summary;
    return summary && typeof summary === "object" ? str((summary as JsonObject).one_liner) : "";
  }, [research]);

  const websiteUrl = lead?.company?.website ?? str(lead?.metadata?.websiteUrl) ?? "";

  return (
    <div className="p-6 lg:p-8">
      <Link href="/leads" className="mb-3 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← Back to leads
      </Link>
      <PageHeader
        title={lead?.title ?? "Lead"}
        description={lead?.company?.name ? `${lead.company.name}${lead.company.industry ? ` · ${lead.company.industry}` : ""}` : "Research, draft, and verify outreach for this lead."}
      />

      {message && <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
      {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading && !lead && <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>}
      {!organizationId && <p className="text-sm text-amber-600">Select a workspace first.</p>}

      {lead && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          {/* Left: summary + pipeline actions */}
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Summary</h3>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stageColors[lead.stage] ?? stageColors.new}`}>
                  {lead.stage.replace(/_/g, " ")}
                </span>
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="Company" value={lead.company?.name ?? "—"} />
                <Row label="Industry" value={lead.company?.industry ?? "—"} />
                <Row
                  label="Website"
                  value={
                    websiteUrl ? (
                      <a href={websiteUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline dark:text-indigo-400">
                        {websiteUrl.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      "—"
                    )
                  }
                />
                <Row label="Contact" value={lead.contact ? [lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(" ") || lead.contact.email || "—" : "—"} />
                <Row label="Phone" value={lead.contact?.phone ?? lead.company?.phone ?? "—"} />
                <Row label="Source" value={lead.source ?? "—"} />
              </dl>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Pipeline</h3>
              <div className="space-y-2">
                <button
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={!!busy}
                  onClick={() => void runResearch()}
                  type="button"
                >
                  {busy === "research" ? "Researching…" : "1 · Ingest website + Research"}
                </button>
                <button
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={!!busy}
                  onClick={() => void generateDraft()}
                  type="button"
                >
                  {busy === "draft" ? "Drafting…" : "2 · Generate + verify draft"}
                </button>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Research grounds the draft in real signals; without it the model may invent company facts.
              </p>
            </div>
          </div>

          {/* Right: research + draft */}
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Agent 1 research</h3>
              {research ? (
                <div className="space-y-4 text-sm">
                  {summaryLine && <p className="text-gray-700 dark:text-gray-300">{summaryLine}</p>}
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Signals found</p>
                    {signals.length ? (
                      <ul className="space-y-1.5">
                        {signals.map((signal, index) => (
                          <li key={index} className="rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                            <p className="font-medium text-gray-800 dark:text-gray-200">{str(signal.signal)}</p>
                            {str(signal.evidence_quote) && <p className="mt-0.5 text-xs italic text-gray-500">“{str(signal.evidence_quote)}”</p>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-400">None detected.</p>
                    )}
                  </div>
                  {pains.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Pain points</p>
                      <ul className="space-y-1.5">
                        {pains.map((pain, index) => (
                          <li key={index} className="rounded-lg border border-gray-200 p-2 dark:border-gray-800">
                            <p className="font-medium text-gray-800 dark:text-gray-200">{str(pain.pain)}</p>
                            {str(pain.evidence_quote) && <p className="mt-0.5 text-xs italic text-gray-500">“{str(pain.evidence_quote)}”</p>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No research yet. Run step 1 to ingest the website and extract signals.</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">Outreach draft</h3>
                {draft && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stageColors[draft.status] ?? stageColors.new}`}>
                    {draft.status.replace(/_/g, " ")}
                  </span>
                )}
              </div>
              {draft ? (
                <div className="space-y-3 text-sm">
                  {draft.verifierDecision && (
                    <div
                      className={`rounded-lg border p-2 text-xs ${
                        draft.verifierDecision === "send"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
                      }`}
                    >
                      <span className="font-semibold">Verifier: {draft.verifierDecision.toUpperCase()}</span>
                      {draft.verifierReason ? ` — ${draft.verifierReason}` : ""}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Subject</p>
                    <p className="font-medium text-gray-900 dark:text-white">{draft.subject}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Body</p>
                    <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{draft.body}</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {str(draft.agent2Output?.generationMode) || "deterministic"} draft
                    {draft.usedSignal ? ` · signal: ${draft.usedSignal}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                      disabled={!!busy || draft.status === "approved" || draft.status === "sent"}
                      onClick={() => void reviewDraft("approve")}
                      type="button"
                    >
                      {busy === "approve" ? "Approving…" : "Approve"}
                    </button>
                    <button
                      className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30"
                      disabled={!!busy || draft.status === "rejected"}
                      onClick={() => void reviewDraft("reject")}
                      type="button"
                    >
                      {busy === "reject" ? "Rejecting…" : "Reject"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No draft yet. Run step 2 to generate and verify an outreach email.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="text-right font-medium text-gray-900 dark:text-white">{value}</dd>
    </div>
  );
}
