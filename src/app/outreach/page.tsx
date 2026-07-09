"use client";

import React, { useEffect, useState } from "react";
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

export default function OutreachPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [form, setForm] = useState<OutreachForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const controller = new AbortController();

    async function loadOutreach() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/outreach", {
          headers: { "x-organization-id": organizationId },
          signal: controller.signal,
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
    }

    void loadOutreach();

    return () => controller.abort();
  }, [organizationId]);

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
        description="Track emails, calls, meetings, and follow-up touchpoints."
        action={
          <input
            className="w-72 max-w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400"
            placeholder="Organization ID"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
          />
        }
      />

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

      {!organizationId && (
        <div className="text-sm text-gray-500 dark:text-gray-400">Enter an organization ID to load outreach.</div>
      )}

      {error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {loading && <div className="text-sm text-gray-500 dark:text-gray-400">Loading outreach...</div>}

      {!loading && organizationId && outreach.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">No outreach found.</div>
      )}

      {!loading && organizationId && outreach.length > 0 && (
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
