"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";

type MailboxMessage = {
  id: string;
  direction: "inbound" | "outbound";
  fromEmail: string | null;
  toEmail: string | null;
  subject: string | null;
  body: string;
  classification: string | null;
  suggestedSubject: string | null;
  suggestedBody: string | null;
  suggestionStatus: string | null;
  receivedAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

type MailboxThread = {
  id: string;
  subject: string;
  status: string;
  classification: string | null;
  provider: string;
  lastMessageAt: string | null;
  company: { id: string; name: string } | null;
  lead: { id: string; title: string } | null;
  messages: MailboxMessage[];
};

type ApiPayload = {
  threads?: MailboxThread[];
  thread?: MailboxThread;
  counts?: { scanned: number; importedThreads: number; importedMessages: number; skippedMessages: number };
  error?: string;
};

const STATUS_OPTIONS = ["open", "needs_reply", "drafted", "done", "archived"] as const;
const CLASSIFICATIONS = [
  "pricing_request",
  "meeting_request",
  "interested",
  "question",
  "not_interested",
  "unsubscribe",
  "unknown",
] as const;

const statusStyles: Record<string, string> = {
  open: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  needs_reply: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  drafted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  archived: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const suggestionStyles: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  drafted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  sent: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

function labelize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function requestJson(path: string, organizationId: string, method: "GET" | "POST" | "PATCH", body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-organization-id": organizationId,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json()) as ApiPayload;

  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed for ${path}`);
  }

  return payload;
}

export default function MailboxPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [threads, setThreads] = useState<MailboxThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [classificationFilter, setClassificationFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intake, setIntake] = useState({ subject: "", fromEmail: "", body: "" });

  const selected = useMemo(() => threads.find((thread) => thread.id === selectedId) ?? null, [threads, selectedId]);
  const latestInbound = useMemo(
    () => (selected ? [...selected.messages].reverse().find((message) => message.direction === "inbound") ?? null : null),
    [selected],
  );

  const loadThreads = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (classificationFilter) params.set("classification", classificationFilter);
      if (search.trim()) params.set("q", search.trim());
      const query = params.toString();
      const payload = await requestJson(`/api/mailbox${query ? `?${query}` : ""}`, organizationId, "GET");
      const nextThreads = payload.threads ?? [];
      setThreads(nextThreads);
      setSelectedId((current) => (current && nextThreads.some((thread) => thread.id === current) ? current : nextThreads[0]?.id ?? null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load mailbox");
    } finally {
      setLoading(false);
    }
  }, [organizationId, statusFilter, classificationFilter, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadThreads();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadThreads]);

  async function runAction(key: string, path: string, body?: unknown, successMessage?: string) {
    if (!organizationId) {
      return;
    }

    setBusy(key);
    setError(null);
    setMessage(null);

    try {
      await requestJson(path, organizationId, "POST", body);
      if (successMessage) {
        setMessage(successMessage);
      }
      await loadThreads();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function changeStatus(threadId: string, status: string) {
    if (!organizationId) {
      return;
    }

    setBusy("status");
    setError(null);
    setMessage(null);

    try {
      await requestJson(`/api/mailbox/${threadId}`, organizationId, "PATCH", { status });
      setMessage(`Thread marked ${labelize(status)}.`);
      await loadThreads();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Failed to update status");
    } finally {
      setBusy(null);
    }
  }

  async function syncGmail() {
    if (!organizationId) {
      return;
    }

    setBusy("sync");
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson("/api/mailbox/sync-gmail", organizationId, "POST", {});
      const counts = payload.counts;
      setMessage(
        counts
          ? `Synced Gmail: ${counts.importedMessages} new message(s) across ${counts.importedThreads} thread(s).`
          : "Gmail sync complete.",
      );
      await loadThreads();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Gmail sync failed");
    } finally {
      setBusy(null);
    }
  }

  async function addManualEmail() {
    if (!organizationId || !intake.subject.trim() || !intake.body.trim()) {
      return;
    }

    await runAction(
      "intake",
      "/api/mailbox",
      { subject: intake.subject.trim(), fromEmail: intake.fromEmail.trim() || null, body: intake.body.trim() },
      "Added inbound email.",
    );
    setIntake({ subject: "", fromEmail: "", body: "" });
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Mailbox"
        description="Triage inbound replies: classify, draft suggested responses, and approve or reject them before sending."
        action={
          <input
            className="w-72 max-w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
            placeholder="Workspace ID"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value.trim())}
          />
        }
      />

      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!organizationId || busy === "sync"}
              onClick={() => void syncGmail()}
              type="button"
            >
              {busy === "sync" ? "Syncing..." : "Sync Gmail"}
            </button>
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{labelize(option)}</option>
              ))}
            </select>
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              value={classificationFilter}
              onChange={(event) => setClassificationFilter(event.target.value)}
            >
              <option value="">All classifications</option>
              {CLASSIFICATIONS.map((option) => (
                <option key={option} value={option}>{labelize(option)}</option>
              ))}
            </select>
            <input
              className="min-w-48 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              placeholder="Search subject or body"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              disabled={!organizationId || loading}
              onClick={() => void loadThreads()}
              type="button"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {message && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_1fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
                <h3 className="font-semibold text-gray-900 dark:text-white">Threads ({threads.length})</h3>
              </div>
              <div className="max-h-[520px] divide-y divide-gray-200 overflow-y-auto dark:divide-gray-800">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => setSelectedId(thread.id)}
                    type="button"
                    className={`w-full px-5 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      thread.id === selectedId ? "bg-indigo-50/60 dark:bg-indigo-950/30" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-clamp-1 font-medium text-gray-900 dark:text-white">{thread.subject}</span>
                      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{formatDate(thread.lastMessageAt)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[thread.status] ?? statusStyles.open}`}>
                        {labelize(thread.status)}
                      </span>
                      {thread.classification && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {labelize(thread.classification)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {threads.length === 0 && (
                  <div className="px-5 py-8 text-sm text-gray-500 dark:text-gray-500">
                    No threads. Sync Gmail or add an inbound email below.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">Add Inbound Email</h3>
              <div className="space-y-2">
                <input
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  placeholder="Subject"
                  value={intake.subject}
                  onChange={(event) => setIntake((current) => ({ ...current, subject: event.target.value }))}
                />
                <input
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  placeholder="From email (optional)"
                  value={intake.fromEmail}
                  onChange={(event) => setIntake((current) => ({ ...current, fromEmail: event.target.value }))}
                />
                <textarea
                  className="min-h-20 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  placeholder="Message body"
                  value={intake.body}
                  onChange={(event) => setIntake((current) => ({ ...current, body: event.target.value }))}
                />
                <button
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!organizationId || busy === "intake" || !intake.subject.trim() || !intake.body.trim()}
                  onClick={() => void addManualEmail()}
                  type="button"
                >
                  {busy === "intake" ? "Adding..." : "Add Email"}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            {selected ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-gray-900 dark:text-white">{selected.subject}</h2>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[selected.status] ?? statusStyles.open}`}>
                        {labelize(selected.status)}
                      </span>
                      <select
                        aria-label="Thread status"
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        disabled={!!busy}
                        value={selected.status}
                        onChange={(event) => void changeStatus(selected.id, event.target.value)}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option} value={option}>{labelize(option)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                    {selected.company?.name ?? "No linked company"}
                    {selected.lead ? ` · ${selected.lead.title}` : ""}
                    {selected.classification ? ` · ${labelize(selected.classification)}` : ""}
                  </p>
                </div>

                <div className="max-h-[360px] space-y-3 overflow-y-auto px-6 py-4">
                  {selected.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg border p-3 text-sm ${
                        msg.direction === "inbound"
                          ? "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
                          : "border-indigo-100 bg-indigo-50/50 dark:border-indigo-950 dark:bg-indigo-950/20"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-500">
                        <span>{msg.direction === "inbound" ? msg.fromEmail ?? "Inbound" : "You"}</span>
                        <span>{formatDate(msg.receivedAt ?? msg.sentAt ?? msg.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{msg.body}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-auto border-t border-gray-200 px-6 py-4 dark:border-gray-800">
                  {latestInbound?.suggestedBody ? (
                    <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Suggested reply</span>
                        {latestInbound.suggestionStatus && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${suggestionStyles[latestInbound.suggestionStatus] ?? statusStyles.open}`}>
                            {labelize(latestInbound.suggestionStatus)}
                          </span>
                        )}
                      </div>
                      <p className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{latestInbound.suggestedSubject}</p>
                      <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{latestInbound.suggestedBody}</p>
                    </div>
                  ) : (
                    <p className="mb-4 text-sm text-gray-500 dark:text-gray-500">No suggested reply yet.</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                      disabled={!!busy}
                      onClick={() => void runAction("suggest", `/api/mailbox/${selected.id}/suggest-reply`, {}, "Generated a suggested reply.")}
                      type="button"
                    >
                      {busy === "suggest" ? "Generating..." : "Suggest Reply"}
                    </button>
                    <button
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                      disabled={!!busy || !latestInbound?.suggestedBody || latestInbound?.suggestionStatus === "approved"}
                      onClick={() => void runAction("approve", `/api/mailbox/${selected.id}/suggestion`, { action: "approve" }, "Suggestion approved.")}
                      type="button"
                    >
                      {busy === "approve" ? "Approving..." : "Approve"}
                    </button>
                    <button
                      className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950/30"
                      disabled={!!busy || !latestInbound?.suggestedBody}
                      onClick={() => void runAction("reject", `/api/mailbox/${selected.id}/suggestion`, { action: "reject" }, "Suggestion rejected.")}
                      type="button"
                    >
                      {busy === "reject" ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                      disabled={!!busy || !latestInbound?.suggestedBody}
                      onClick={() => void runAction("draft", `/api/mailbox/${selected.id}/gmail-draft`, {}, "Created a Gmail draft.")}
                      type="button"
                    >
                      {busy === "draft" ? "Drafting..." : "Create Gmail Draft"}
                    </button>
                    <button
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                      disabled={!!busy}
                      onClick={() => void runAction("send", `/api/mailbox/${selected.id}/gmail-send`, {}, "Sent the Gmail draft.")}
                      type="button"
                    >
                      {busy === "send" ? "Sending..." : "Send Gmail"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-500">
                Select a thread to view messages and draft a reply.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
