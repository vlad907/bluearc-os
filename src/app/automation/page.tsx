"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";

type Lead = {
  id: string;
  title: string;
  stage: "new" | "evaluating" | "bidding" | "submitted" | "won" | "lost";
  value: string | number | null;
  probability: number | null;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  entityType: string | null;
  entityId: string | null;
};

type Outreach = {
  id: string;
  channel: string;
  direction: "inbound" | "outbound";
  status: "draft" | "scheduled" | "sent" | "delivered" | "opened" | "replied" | "bounced" | "failed";
  subject: string | null;
  body: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
};

type QueueItem = {
  id: string;
  type: "task" | "outreach" | "lead";
  title: string;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  detail: string;
};

type ApiPayload = {
  leads?: Lead[];
  tasks?: Task[];
  outreach?: Outreach[];
  task?: Task;
  error?: string;
  errors?: string[];
};

function getApiError(payload: ApiPayload, fallback: string) {
  if (payload.errors?.length) {
    return payload.errors.join(", ");
  }

  return payload.error ?? fallback;
}

function formatDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const priorityClassNames: Record<QueueItem["priority"], string> = {
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

async function fetchJson(path: string, organizationId: string) {
  const response = await fetch(path, {
    headers: { "x-organization-id": organizationId },
    cache: "no-store",
  });
  const payload = (await response.json()) as ApiPayload;

  if (!response.ok) {
    throw new Error(getApiError(payload, `Failed to load ${path}`));
  }

  return payload;
}

async function patchJson(path: string, organizationId: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-organization-id": organizationId,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as ApiPayload;

  if (!response.ok) {
    throw new Error(getApiError(payload, `Failed to update ${path}`));
  }

  return payload;
}

export default function AutomationPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAutomationData = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [leadPayload, taskPayload, outreachPayload] = await Promise.all([
        fetchJson("/api/leads", organizationId),
        fetchJson("/api/tasks", organizationId),
        fetchJson("/api/outreach", organizationId),
      ]);

      setLeads(leadPayload.leads ?? []);
      setTasks(taskPayload.tasks ?? []);
      setOutreach(outreachPayload.outreach ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load automation data");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAutomationData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadAutomationData]);

  const queueItems = useMemo<QueueItem[]>(() => {
    const taskItems = tasks
      .filter((task) => task.status === "todo" || task.status === "in_progress")
      .map((task) => ({
        id: task.id,
        type: "task" as const,
        title: task.title,
        status: task.status,
        priority: task.priority,
        detail: task.description ?? formatDate(task.dueDate),
      }));

    const outreachItems = outreach
      .filter((item) => item.status === "draft" || item.status === "scheduled")
      .map((item) => ({
        id: item.id,
        type: "outreach" as const,
        title: item.subject || "Untitled outreach",
        status: item.status,
        priority: item.status === "scheduled" ? "high" as const : "medium" as const,
        detail: item.body || formatDate(item.scheduledAt),
      }));

    const leadItems = leads
      .filter((lead) => lead.stage === "evaluating" || lead.stage === "bidding" || lead.stage === "submitted")
      .map((lead) => ({
        id: lead.id,
        type: "lead" as const,
        title: lead.title,
        status: lead.stage,
        priority: lead.stage === "submitted" ? "urgent" as const : "high" as const,
        detail: `${lead.probability ?? 0}% probability`,
      }));

    return [...outreachItems, ...taskItems, ...leadItems];
  }, [leads, tasks, outreach]);

  const summary = useMemo(() => {
    return {
      queue: queueItems.length,
      draftOutreach: outreach.filter((item) => item.status === "draft").length,
      activeTasks: tasks.filter((task) => task.status === "todo" || task.status === "in_progress").length,
      hotLeads: leads.filter((lead) => lead.stage === "bidding" || lead.stage === "submitted").length,
    };
  }, [queueItems.length, outreach, tasks, leads]);

  async function markTaskDone(taskId: string) {
    if (!organizationId) {
      return;
    }

    setActionId(taskId);
    setError(null);
    setMessage(null);

    try {
      await patchJson(`/api/tasks/${taskId}`, organizationId, {
        status: "done",
        completedAt: new Date().toISOString(),
      });
      setMessage("Task marked complete.");
      await loadAutomationData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update task");
    } finally {
      setActionId(null);
    }
  }

  async function markOutreachSent(outreachId: string) {
    if (!organizationId) {
      return;
    }

    setActionId(outreachId);
    setError(null);
    setMessage(null);

    try {
      await patchJson(`/api/outreach/${outreachId}`, organizationId, {
        status: "sent",
        sentAt: new Date().toISOString(),
      });
      setMessage("Outreach marked sent.");
      await loadAutomationData();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update outreach");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Automation"
        description="Ported from CRM Command: review outreach, tasks, and hot pipeline items from one queue."
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { label: "Queue Items", value: summary.queue },
            { label: "Draft Outreach", value: summary.draftOutreach },
            { label: "Active Tasks", value: summary.activeTasks },
            { label: "Hot Leads", value: summary.hotLeads },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-500">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="w-full lg:max-w-xl">
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Workspace ID
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value.trim())}
                placeholder="Create/select one in Settings"
              />
            </div>
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!organizationId || loading}
              onClick={() => void loadAutomationData()}
              type="button"
            >
              {loading ? "Refreshing..." : "Refresh Queue"}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
            Gmail sending, AI classification, and background workers from the old app are intentionally not copied yet. This page starts with the review queue using current Postgres data.
          </p>
          {message && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Review Queue</h3>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {queueItems.map((item) => (
              <div key={`${item.type}-${item.id}`} className="flex flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {item.type}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${priorityClassNames[item.priority]}`}>
                      {item.priority}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">{item.status}</span>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                  <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-500">{item.detail}</p>
                </div>
                <div className="flex gap-2">
                  {item.type === "task" && (
                    <button
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                      disabled={actionId === item.id}
                      onClick={() => void markTaskDone(item.id)}
                      type="button"
                    >
                      Complete
                    </button>
                  )}
                  {item.type === "outreach" && (
                    <button
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                      disabled={actionId === item.id}
                      onClick={() => void markOutreachSent(item.id)}
                      type="button"
                    >
                      Mark Sent
                    </button>
                  )}
                </div>
              </div>
            ))}
            {queueItems.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-500">
                No review items yet. Seed demo data or import prospects from Discovery to populate this queue.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
