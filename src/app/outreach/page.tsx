"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { classNames } from "@/lib/utils";

type OutreachChannel = "email" | "phone" | "sms" | "linkedin" | "meeting" | "note" | "other";
type OutreachDirection = "inbound" | "outbound";
type OutreachStatus =
  | "draft"
  | "scheduled"
  | "sent"
  | "delivered"
  | "opened"
  | "replied"
  | "bounced"
  | "failed"
  | "cancelled";

type Outreach = {
  id: string;
  channel: OutreachChannel;
  direction: OutreachDirection;
  status: OutreachStatus;
  subject: string | null;
  body: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

type EmailMessage = {
  id: string;
  direction: OutreachDirection;
  fromEmail: string | null;
  toEmail: string | null;
  subject: string | null;
  body: string;
  classification: string | null;
  suggestedSubject: string | null;
  suggestedBody: string | null;
  receivedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

type EmailThread = {
  id: string;
  subject: string;
  status: string;
  classification: string | null;
  lastMessageAt: string | null;
  company: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string | null; email: string | null } | null;
  lead: { id: string; title: string } | null;
  outreach: { id: string; subject: string | null; status: string } | null;
  messages: EmailMessage[];
};

type GmailConnection = {
  id: string;
  email: string;
  status: string;
  lastSyncedAt: string | null;
  lastError: string | null;
};

type OutreachForm = {
  channel: OutreachChannel;
  direction: OutreachDirection;
  status: OutreachStatus;
  subject: string;
  body: string;
  scheduledAt: string;
};

const initialForm: OutreachForm = {
  channel: "email",
  direction: "outbound",
  status: "draft",
  subject: "",
  body: "",
  scheduledAt: "",
};

const initialMailboxForm = {
  subject: "",
  fromEmail: "",
  toEmail: "",
  body: "",
  outreachId: "",
};

const channelStyles: Record<OutreachChannel, string> = {
  email: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  phone: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  sms: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  linkedin: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  meeting: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  note: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  other: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const statusStyles: Record<OutreachStatus, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  scheduled: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  delivered: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  opened: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  replied: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  bounced: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    if ("error" in payload && typeof payload.error === "string") {
      return payload.error;
    }

    if ("errors" in payload && Array.isArray(payload.errors)) {
      return payload.errors.join(", ");
    }
  }

  return fallback;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function contactLabel(contact: EmailThread["contact"]) {
  if (!contact) {
    return null;
  }

  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
  return contact.email ? `${name || "Contact"} <${contact.email}>` : name || "Contact";
}

function threadLinkLabel(thread: EmailThread) {
  const company = thread.company?.name ?? null;
  const contact = contactLabel(thread.contact);

  if (company && contact) {
    return `${company} · ${contact}`;
  }

  return company ?? contact ?? "Unlinked mailbox thread";
}

export default function OutreachPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [activeTab, setActiveTab] = useState<"log" | "mailbox">("mailbox");
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [mailboxSearch, setMailboxSearch] = useState("");
  const [mailboxClassification, setMailboxClassification] = useState("");
  const [mailboxForm, setMailboxForm] = useState(initialMailboxForm);
  const [form, setForm] = useState<OutreachForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [loadingMailbox, setLoadingMailbox] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importingInbound, setImportingInbound] = useState(false);
  const [syncingGmail, setSyncingGmail] = useState(false);
  const [suggestingThreadId, setSuggestingThreadId] = useState<string | null>(null);
  const [creatingDraftThreadId, setCreatingDraftThreadId] = useState<string | null>(null);
  const [sendingDraftThreadId, setSendingDraftThreadId] = useState<string | null>(null);
  const [mailboxMessage, setMailboxMessage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mailboxError, setMailboxError] = useState<string | null>(null);
  const [gmailConnections, setGmailConnections] = useState<GmailConnection[]>([]);
  const [loadingGmailStatus, setLoadingGmailStatus] = useState(false);

  const loadOutreach = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/outreach", {
        headers: { "x-organization-id": organizationId },
        signal,
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to load outreach"));
      }

      setOutreach(
        payload && typeof payload === "object" && "outreach" in payload && Array.isArray(payload.outreach)
          ? payload.outreach
          : [],
      );
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Failed to load outreach");
      setOutreach([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const loadMailbox = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId) {
      return;
    }

    setLoadingMailbox(true);
    setMailboxError(null);

    const params = new URLSearchParams();
    if (mailboxSearch.trim()) {
      params.set("q", mailboxSearch.trim());
    }
    if (mailboxClassification) {
      params.set("classification", mailboxClassification);
    }

    try {
      const response = await fetch(`/api/mailbox?${params.toString()}`, {
        headers: { "x-organization-id": organizationId },
        signal,
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to load mailbox"));
      }

      const nextThreads =
        payload && typeof payload === "object" && "threads" in payload && Array.isArray(payload.threads)
          ? (payload.threads as EmailThread[])
          : [];

      setThreads(nextThreads);
      setSelectedThreadId((current) => current ?? nextThreads[0]?.id ?? null);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setMailboxError(loadError instanceof Error ? loadError.message : "Failed to load mailbox");
      setThreads([]);
    } finally {
      setLoadingMailbox(false);
    }
  }, [mailboxClassification, mailboxSearch, organizationId]);

  const loadGmailStatus = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId) {
      return;
    }

    setLoadingGmailStatus(true);

    try {
      const response = await fetch("/api/integrations/google/status", {
        headers: { "x-organization-id": organizationId },
        signal,
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to load Gmail status"));
      }

      const connections =
        payload && typeof payload === "object" && "connections" in payload && Array.isArray(payload.connections)
          ? payload.connections as GmailConnection[]
          : [];
      setGmailConnections(connections);
    } catch (statusError) {
      if (statusError instanceof DOMException && statusError.name === "AbortError") {
        return;
      }

      setGmailConnections([]);
    } finally {
      setLoadingGmailStatus(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadOutreach(controller.signal);
      void loadMailbox(controller.signal);
      void loadGmailStatus(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadGmailStatus, loadMailbox, loadOutreach, organizationId]);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null,
    [selectedThreadId, threads],
  );
  const selectedThreadHasSuggestion = selectedThread?.messages.some((message) => message.suggestedBody) ?? false;
  const selectedThreadHasGmailDraft = selectedThread?.messages.some((message) => (
    typeof message.metadata?.gmailDraftId === "string" && !message.metadata.gmailDraftSentAt
  )) ?? false;
  const activeGmailConnection = gmailConnections.find((connection) => connection.status === "connected") ?? null;

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/outreach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({
          channel: form.channel,
          direction: form.direction,
          status: form.status,
          subject: form.subject.trim() || null,
          body: form.body.trim() || null,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        }),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to create outreach"));
      }

      if (payload && typeof payload === "object" && "outreach" in payload) {
        setOutreach((current) => [payload.outreach as Outreach, ...current]);
      }

      setForm(initialForm);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create outreach");
    } finally {
      setSaving(false);
    }
  }

  async function handleImportInbound(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId) {
      return;
    }

    setImportingInbound(true);
    setMailboxError(null);
    setMailboxMessage(null);

    try {
      const response = await fetch("/api/mailbox", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({
          subject: mailboxForm.subject.trim(),
          fromEmail: mailboxForm.fromEmail.trim() || null,
          toEmail: mailboxForm.toEmail.trim() || null,
          body: mailboxForm.body.trim(),
          outreachId: mailboxForm.outreachId || null,
        }),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to import inbound email"));
      }

      setMailboxForm(initialMailboxForm);
      setMailboxMessage("Inbound email imported and classified.");
      await loadMailbox();
    } catch (importError) {
      setMailboxError(importError instanceof Error ? importError.message : "Failed to import inbound email");
    } finally {
      setImportingInbound(false);
    }
  }

  async function handleSyncGmail() {
    if (!organizationId) {
      return;
    }

    setSyncingGmail(true);
    setMailboxError(null);
    setMailboxMessage(null);

    try {
      const response = await fetch("/api/mailbox/sync-gmail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({
          maxResults: 20,
        }),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to sync Gmail"));
      }

      const counts =
        payload && typeof payload === "object" && "counts" in payload && payload.counts && typeof payload.counts === "object"
          ? payload.counts as { importedMessages?: number; skippedMessages?: number; scanned?: number }
          : {};

      setMailboxMessage(`Gmail sync complete. Scanned ${counts.scanned ?? 0}, imported ${counts.importedMessages ?? 0}, skipped ${counts.skippedMessages ?? 0}.`);
      await loadMailbox();
      await loadGmailStatus();
    } catch (syncError) {
      setMailboxError(syncError instanceof Error ? syncError.message : "Failed to sync Gmail");
    } finally {
      setSyncingGmail(false);
    }
  }

  async function handleSuggestReply(threadId: string) {
    if (!organizationId) {
      return;
    }

    setSuggestingThreadId(threadId);
    setMailboxError(null);
    setMailboxMessage(null);

    try {
      const response = await fetch(`/api/mailbox/${threadId}/suggest-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to suggest reply"));
      }

      setMailboxMessage("Suggested reply generated from the CRM response-draft prompt.");
      await loadMailbox();
    } catch (suggestError) {
      setMailboxError(suggestError instanceof Error ? suggestError.message : "Failed to suggest reply");
    } finally {
      setSuggestingThreadId(null);
    }
  }

  async function handleCreateGmailDraft(threadId: string) {
    if (!organizationId) {
      return;
    }

    setCreatingDraftThreadId(threadId);
    setMailboxError(null);
    setMailboxMessage(null);

    try {
      const response = await fetch(`/api/mailbox/${threadId}/gmail-draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to create Gmail draft"));
      }

      setMailboxMessage("Gmail draft created from the suggested reply.");
      await loadMailbox();
    } catch (draftError) {
      setMailboxError(draftError instanceof Error ? draftError.message : "Failed to create Gmail draft");
    } finally {
      setCreatingDraftThreadId(null);
    }
  }

  async function handleSendGmailDraft(threadId: string) {
    if (!organizationId) {
      return;
    }

    setSendingDraftThreadId(threadId);
    setMailboxError(null);
    setMailboxMessage(null);

    try {
      const response = await fetch(`/api/mailbox/${threadId}/gmail-send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to send Gmail draft"));
      }

      setMailboxMessage("Gmail draft sent and mailbox thread marked done.");
      await loadMailbox();
    } catch (sendError) {
      setMailboxError(sendError instanceof Error ? sendError.message : "Failed to send Gmail draft");
    } finally {
      setSendingDraftThreadId(null);
    }
  }

  async function handleThreadStatus(threadId: string, status: string) {
    if (!organizationId) {
      return;
    }

    setMailboxError(null);
    setMailboxMessage(null);

    try {
      const response = await fetch(`/api/mailbox/${threadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({ status }),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to update mailbox thread"));
      }

      setMailboxMessage(`Thread marked ${status}.`);
      await loadMailbox();
    } catch (statusError) {
      setMailboxError(statusError instanceof Error ? statusError.message : "Failed to update mailbox thread");
    }
  }

  async function handleDelete(outreachId: string) {
    if (!organizationId) {
      return;
    }

    setDeletingId(outreachId);
    setError(null);

    try {
      const response = await fetch(`/api/outreach/${outreachId}`, {
        method: "DELETE",
        headers: { "x-organization-id": organizationId },
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to delete outreach"));
      }

      setOutreach((current) => current.filter((item) => item.id !== outreachId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete outreach");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Outreach"
        description="Track outreach, review inbound mailbox threads, and generate suggested replies."
        action={
          <input
            className="w-72 max-w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400"
            placeholder="Organization ID"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
          />
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { id: "mailbox", label: "Mailbox + Suggested Replies" },
          { id: "log", label: "Outreach Log" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={classNames(
              "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-800 dark:hover:bg-gray-800",
            )}
            onClick={() => setActiveTab(tab.id as "log" | "mailbox")}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "mailbox" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Gmail Status</h3>
                  <span className={classNames(
                    "rounded-full px-2.5 py-1 text-xs font-medium",
                    activeGmailConnection
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                  )}>
                    {activeGmailConnection ? "connected" : loadingGmailStatus ? "checking" : "not connected"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                  {activeGmailConnection
                    ? `${activeGmailConnection.email}${activeGmailConnection.lastSyncedAt ? ` · last sync ${formatDate(activeGmailConnection.lastSyncedAt)}` : " · not synced yet"}`
                    : "Connect Gmail in Settings before syncing or sending Gmail drafts."}
                </p>
                {activeGmailConnection?.lastError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{activeGmailConnection.lastError}</p>
                )}
              </div>
              <button
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                disabled={!organizationId || loadingGmailStatus}
                onClick={() => void loadGmailStatus()}
                type="button"
              >
                {loadingGmailStatus ? "Checking..." : "Refresh Gmail Status"}
              </button>
            </div>
          </div>

          <form
            onSubmit={handleImportInbound}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
          >
            <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Mailbox Intake</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                  Sync Gmail into the mailbox, or manually paste inbound messages when testing without OAuth.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  disabled={!organizationId || !activeGmailConnection || syncingGmail}
                  onClick={() => void handleSyncGmail()}
                  type="button"
                >
                  {syncingGmail ? "Syncing..." : "Sync Gmail"}
                </button>
                <button
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                  disabled={!organizationId || loadingMailbox}
                  onClick={() => void loadMailbox()}
                  type="button"
                >
                  Refresh Mailbox
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <input
                className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
                placeholder="Subject"
                value={mailboxForm.subject}
                onChange={(event) => setMailboxForm((current) => ({ ...current, subject: event.target.value }))}
                required
              />
              <input
                className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
                placeholder="From email"
                value={mailboxForm.fromEmail}
                onChange={(event) => setMailboxForm((current) => ({ ...current, fromEmail: event.target.value }))}
              />
              <select
                className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
                value={mailboxForm.outreachId}
                onChange={(event) => setMailboxForm((current) => ({ ...current, outreachId: event.target.value }))}
              >
                <option value="">Link to outreach item</option>
                {outreach.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.subject || "Untitled outreach"}
                  </option>
                ))}
              </select>
              <button
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                disabled={!organizationId || importingInbound || !mailboxForm.subject.trim() || !mailboxForm.body.trim()}
                type="submit"
              >
                {importingInbound ? "Importing..." : "Import Inbound Email"}
              </button>
            </div>
            <textarea
              className="mt-3 w-full min-h-24 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              placeholder="Paste inbound email body"
              value={mailboxForm.body}
              onChange={(event) => setMailboxForm((current) => ({ ...current, body: event.target.value }))}
              required
            />
          </form>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-800 p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
                    placeholder="Search mailbox"
                    value={mailboxSearch}
                    onChange={(event) => setMailboxSearch(event.target.value)}
                  />
                  <select
                    className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
                    value={mailboxClassification}
                    onChange={(event) => setMailboxClassification(event.target.value)}
                  >
                    <option value="">All classifications</option>
                    <option value="interested">interested</option>
                    <option value="pricing_request">pricing_request</option>
                    <option value="meeting_request">meeting_request</option>
                    <option value="question">question</option>
                    <option value="not_interested">not_interested</option>
                    <option value="unsubscribe">unsubscribe</option>
                    <option value="unknown">unknown</option>
                  </select>
                </div>
              </div>
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  className={classNames(
                    "block w-full border-b border-gray-100 px-4 py-4 text-left transition-colors dark:border-gray-800",
                    selectedThread?.id === thread.id ? "bg-indigo-50 dark:bg-indigo-950/30" : "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                  )}
                  onClick={() => setSelectedThreadId(thread.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{thread.subject}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                        {threadLinkLabel(thread)}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {thread.classification ?? "unknown"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-500">
                    {thread.messages.at(-1)?.body ?? "No messages"}
                  </p>
                </button>
              ))}
              {!loadingMailbox && threads.length === 0 && (
                <div className="p-6 text-sm text-gray-500 dark:text-gray-500">No mailbox threads found.</div>
              )}
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
              {selectedThread ? (
                <div>
                  <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{selectedThread.subject}</h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                        Status: {selectedThread.status} · Classification: {selectedThread.classification ?? "unknown"}
                        {selectedThread.outreach ? ` · Linked outreach: ${selectedThread.outreach.subject ?? "Untitled"}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                        CRM link: {threadLinkLabel(selectedThread)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        disabled={suggestingThreadId === selectedThread.id}
                        onClick={() => void handleSuggestReply(selectedThread.id)}
                        type="button"
                      >
                        {suggestingThreadId === selectedThread.id ? "Suggesting..." : "Suggest Reply"}
                      </button>
                      <button
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        disabled={!activeGmailConnection || !selectedThreadHasSuggestion || creatingDraftThreadId === selectedThread.id}
                        onClick={() => void handleCreateGmailDraft(selectedThread.id)}
                        type="button"
                      >
                        {creatingDraftThreadId === selectedThread.id ? "Creating..." : "Create Gmail Draft"}
                      </button>
                      <button
                        className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        disabled={!activeGmailConnection || !selectedThreadHasGmailDraft || sendingDraftThreadId === selectedThread.id}
                        onClick={() => void handleSendGmailDraft(selectedThread.id)}
                        type="button"
                      >
                        {sendingDraftThreadId === selectedThread.id ? "Sending..." : "Send Gmail Draft"}
                      </button>
                      <button
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        onClick={() => void handleThreadStatus(selectedThread.id, "done")}
                        type="button"
                      >
                        Mark Done
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {selectedThread.messages.map((message) => (
                      <div key={message.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-500">
                          <span>{message.direction} · {message.fromEmail ?? "unknown sender"} · {formatDate(message.receivedAt ?? message.sentAt ?? message.createdAt)}</span>
                          <span>{message.classification ?? "unknown"}</span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{message.body}</p>
                        {message.suggestedBody && (
                          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Suggested Reply</p>
                              {typeof message.metadata?.gmailDraftId === "string" && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                  Gmail draft created
                                </span>
                              )}
                              {typeof message.metadata?.gmailDraftSentAt === "string" && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  Sent {formatDate(message.metadata.gmailDraftSentAt)}
                                </span>
                              )}
                            </div>
                            <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{message.suggestedSubject}</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{message.suggestedBody}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-500">Select a mailbox thread.</div>
              )}
            </div>
          </div>
          {mailboxMessage && <div className="text-sm text-emerald-600 dark:text-emerald-400">{mailboxMessage}</div>}
          {mailboxError && <div className="text-sm text-red-600 dark:text-red-400">{mailboxError}</div>}
        </div>
      )}

      {activeTab === "log" && (
      <form
        onSubmit={handleCreate}
        className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <select
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={form.channel}
            onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value as OutreachChannel }))}
          >
            <option value="email">email</option>
            <option value="phone">phone</option>
            <option value="sms">sms</option>
            <option value="linkedin">linkedin</option>
            <option value="meeting">meeting</option>
            <option value="note">note</option>
            <option value="other">other</option>
          </select>
          <select
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={form.direction}
            onChange={(event) =>
              setForm((current) => ({ ...current, direction: event.target.value as OutreachDirection }))
            }
          >
            <option value="outbound">outbound</option>
            <option value="inbound">inbound</option>
          </select>
          <select
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as OutreachStatus }))}
          >
            <option value="draft">draft</option>
            <option value="scheduled">scheduled</option>
            <option value="sent">sent</option>
            <option value="delivered">delivered</option>
            <option value="opened">opened</option>
            <option value="replied">replied</option>
            <option value="bounced">bounced</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <input
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            placeholder="Subject"
            value={form.subject}
            onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
          />
          <input
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(event) => setForm((current) => ({ ...current, scheduledAt: event.target.value }))}
          />
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={!organizationId || saving}
            type="submit"
          >
            {saving ? "Adding..." : "+ Add Outreach"}
          </button>
        </div>
        <textarea
          className="mt-3 w-full min-h-24 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
          placeholder="Notes or message body"
          value={form.body}
          onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
        />
      </form>
      )}

      {activeTab === "log" && !organizationId && (
        <div className="text-sm text-gray-500 dark:text-gray-400">Enter an organization ID to load outreach.</div>
      )}

      {activeTab === "log" && error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {activeTab === "log" && loading && <div className="text-sm text-gray-500 dark:text-gray-400">Loading outreach...</div>}

      {activeTab === "log" && !loading && organizationId && outreach.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">No outreach found.</div>
      )}

      {activeTab === "log" && !loading && organizationId && outreach.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Subject</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Channel</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Direction</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Scheduled</th>
                  <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Created</th>
                  <th className="text-right px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {outreach.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900 dark:text-white">{item.subject || "Untitled outreach"}</div>
                      {item.body && <div className="mt-1 max-w-md truncate text-xs text-gray-500 dark:text-gray-500">{item.body}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={classNames("text-xs font-medium px-2.5 py-1 rounded-full", channelStyles[item.channel])}>
                        {item.channel}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{item.direction}</td>
                    <td className="px-5 py-4">
                      <span className={classNames("text-xs font-medium px-2.5 py-1 rounded-full", statusStyles[item.status])}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{formatDate(item.scheduledAt)}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{formatDate(item.createdAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                        disabled={deletingId === item.id}
                        onClick={() => void handleDelete(item.id)}
                      >
                        {deletingId === item.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
