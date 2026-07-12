"use client";

import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { classNames, getPriorityColor } from "@/lib/utils";
import { highlightedRecordClass, useHighlightedRecordId } from "@/lib/navigation/highlight";

const taskStatuses = ["todo", "in_progress", "done", "cancelled"] as const;
const taskPriorities = ["low", "medium", "high", "urgent"] as const;
const taskEntityTypes = ["company", "contact", "lead", "job", "vendor"] as const;

type TaskStatus = (typeof taskStatuses)[number];
type TaskPriority = (typeof taskPriorities)[number];
type TaskEntityType = (typeof taskEntityTypes)[number];

type Task = {
  id: string;
  title: string;
  description: string | null;
  entityType: TaskEntityType | null;
  entityId: string | null;
  entity: TaskEntityOption | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignedToId: string | null;
};

type TaskEntityOption = {
  id: string;
  type: TaskEntityType;
  label: string;
  subtitle: string | null;
};

type TasksResponse = {
  tasks?: Task[];
  task?: Task;
  error?: string;
  errors?: string[];
};

type CompaniesResponse = {
  companies?: Array<{ id: string; name: string; industry: string | null }>;
  error?: string;
  errors?: string[];
};

type ContactsResponse = {
  contacts?: Array<{ id: string; firstName: string; lastName: string | null; email: string | null }>;
  error?: string;
  errors?: string[];
};

type LeadsResponse = {
  leads?: Array<{ id: string; title: string; stage: string }>;
  error?: string;
  errors?: string[];
};

type JobsResponse = {
  jobs?: Array<{ id: string; title: string; status: string }>;
  error?: string;
  errors?: string[];
};

type VendorsResponse = {
  vendors?: Array<{ id: string; name: string; category: string | null }>;
  error?: string;
  errors?: string[];
};

function getApiError(data: TasksResponse, fallback: string) {
  if (data.errors?.length) {
    return data.errors.join(", ");
  }

  return data.error ?? fallback;
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusLabel(status: TaskStatus) {
  return status.replace("_", " ");
}

function getEntityTypeLabel(type: TaskEntityType) {
  return type[0].toUpperCase() + type.slice(1);
}

export default function TasksPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const highlightedId = useHighlightedRecordId();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [entityOptions, setEntityOptions] = useState<TaskEntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [entityType, setEntityType] = useState<TaskEntityType>("company");
  const [entityId, setEntityId] = useState("");

  const filteredEntityOptions = useMemo(
    () => entityOptions.filter((option) => option.type === entityType),
    [entityOptions, entityType],
  );

  const fetchTasks = useCallback(async () => {
    if (!organizationId) {
      setTasks([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tasks", {
        headers: { "x-organization-id": organizationId },
      });
      const data = (await response.json()) as TasksResponse;

      if (!response.ok) {
        throw new Error(getApiError(data, "Failed to load tasks"));
      }

      setTasks(data.tasks ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const fetchEntityOptions = useCallback(async () => {
    if (!organizationId) {
      setEntityOptions([]);
      return;
    }

    try {
      const [companiesResponse, contactsResponse, leadsResponse, jobsResponse, vendorsResponse] = await Promise.all([
        fetch("/api/companies", { headers: { "x-organization-id": organizationId } }),
        fetch("/api/contacts", { headers: { "x-organization-id": organizationId } }),
        fetch("/api/leads", { headers: { "x-organization-id": organizationId } }),
        fetch("/api/jobs", { headers: { "x-organization-id": organizationId } }),
        fetch("/api/vendors", { headers: { "x-organization-id": organizationId } }),
      ]);

      const companiesPayload = (await companiesResponse.json()) as CompaniesResponse;
      const contactsPayload = (await contactsResponse.json()) as ContactsResponse;
      const leadsPayload = (await leadsResponse.json()) as LeadsResponse;
      const jobsPayload = (await jobsResponse.json()) as JobsResponse;
      const vendorsPayload = (await vendorsResponse.json()) as VendorsResponse;

      const responses = [
        [companiesResponse, companiesPayload, "Failed to load companies"],
        [contactsResponse, contactsPayload, "Failed to load contacts"],
        [leadsResponse, leadsPayload, "Failed to load leads"],
        [jobsResponse, jobsPayload, "Failed to load jobs"],
        [vendorsResponse, vendorsPayload, "Failed to load vendors"],
      ] as const;

      for (const [response, payload, message] of responses) {
        if (!response.ok) {
          throw new Error(getApiError(payload, message));
        }
      }

      setEntityOptions([
        ...(companiesPayload.companies ?? []).map((company) => ({
          id: company.id,
          type: "company" as const,
          label: company.name,
          subtitle: company.industry,
        })),
        ...(contactsPayload.contacts ?? []).map((contact) => ({
          id: contact.id,
          type: "contact" as const,
          label: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
          subtitle: contact.email,
        })),
        ...(leadsPayload.leads ?? []).map((lead) => ({
          id: lead.id,
          type: "lead" as const,
          label: lead.title,
          subtitle: lead.stage,
        })),
        ...(jobsPayload.jobs ?? []).map((job) => ({
          id: job.id,
          type: "job" as const,
          label: job.title,
          subtitle: job.status,
        })),
        ...(vendorsPayload.vendors ?? []).map((vendor) => ({
          id: vendor.id,
          type: "vendor" as const,
          label: vendor.name,
          subtitle: vendor.category,
        })),
      ]);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load task link options");
    }
  }, [organizationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchTasks();
      void fetchEntityOptions();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchEntityOptions, fetchTasks]);

  function handleOrganizationIdChange(value: string) {
    const nextOrganizationId = value.trim();
    setOrganizationId(nextOrganizationId);

    if (!nextOrganizationId) {
      setTasks([]);
      setEntityOptions([]);
      setError(null);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId || !title.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: Record<string, string> = {
      title: title.trim(),
      status,
      priority,
    };

    if (entityId) {
      payload.entityType = entityType;
      payload.entityId = entityId;
    }

    if (dueDate) {
      payload.dueDate = new Date(`${dueDate}T00:00:00`).toISOString();
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as TasksResponse;

      if (!response.ok || !data.task) {
        throw new Error(getApiError(data, "Failed to create task"));
      }

      setTasks((currentTasks) => [data.task as Task, ...currentTasks]);
      setTitle("");
      setStatus("todo");
      setPriority("medium");
      setDueDate("");
      setEntityType("company");
      setEntityId("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    if (!organizationId) {
      return;
    }

    setDeletingId(taskId);
    setError(null);

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { "x-organization-id": organizationId },
      });
      const data = (await response.json()) as TasksResponse;

      if (!response.ok) {
        throw new Error(getApiError(data, "Failed to delete task"));
      }

      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete task");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Tasks"
        description="Track your tasks and to-dos."
        action={
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            Org ID
            <input
              className="w-56 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              value={organizationId}
              onChange={(event) => handleOrganizationIdChange(event.target.value)}
              placeholder="organizationId"
            />
          </label>
        }
      />

      <form
        onSubmit={handleCreateTask}
        className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-7"
      >
        <input
          className="md:col-span-2 px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Task title"
          required
        />
        <select
          className="px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value as TaskEntityType);
            setEntityId("");
          }}
        >
          {taskEntityTypes.map((type) => (
            <option key={type} value={type}>
              {getEntityTypeLabel(type)}
            </option>
          ))}
        </select>
        <select
          className="px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
          value={entityId}
          onChange={(event) => setEntityId(event.target.value)}
        >
          <option value="">No link</option>
          {filteredEntityOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}{option.subtitle ? ` · ${option.subtitle}` : ""}
            </option>
          ))}
        </select>
        <select
          className="px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
          value={status}
          onChange={(event) => setStatus(event.target.value as TaskStatus)}
        >
          {taskStatuses.map((taskStatus) => (
            <option key={taskStatus} value={taskStatus}>
              {getStatusLabel(taskStatus)}
            </option>
          ))}
        </select>
        <select
          className="px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
          value={priority}
          onChange={(event) => setPriority(event.target.value as TaskPriority)}
        >
          {taskPriorities.map((taskPriority) => (
            <option key={taskPriority} value={taskPriority}>
              {taskPriority}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <input
            className="min-w-0 flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            type="date"
          />
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            disabled={!organizationId || !title.trim() || submitting}
            type="submit"
          >
            {submitting ? "Adding..." : "+ New Task"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <th className="w-12 px-5 py-3.5" />
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Title</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Linked Record</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Due Date</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Priority</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!organizationId && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    Enter an organization ID to load tasks.
                  </td>
                </tr>
              )}
              {organizationId && loading && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    Loading tasks...
                  </td>
                </tr>
              )}
              {organizationId && !loading && tasks.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    No tasks yet.
                  </td>
                </tr>
              )}
              {organizationId && !loading && tasks.map((task) => {
                const completed = task.status === "done";

                return (
                  <tr
                    key={task.id}
                    className={classNames(
                      "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                      highlightedRecordClass(task.id, highlightedId),
                    )}
                  >
                    <td className="px-5 py-4">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        completed
                          ? "bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500"
                          : "border-gray-300 dark:border-gray-600"
                      }`}>
                        {completed && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className={`px-5 py-4 ${completed ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}>
                      {task.title}
                      {task.description ? (
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-500">{task.description}</div>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                      {task.entity ? (
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{task.entity.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-500">
                            {getEntityTypeLabel(task.entity.type)}{task.entity.subtitle ? ` · ${task.entity.subtitle}` : ""}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{formatDate(task.dueDate)}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{getStatusLabel(task.status)}</td>
                    <td className="px-5 py-4">
                      <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                        disabled={deletingId === task.id}
                        onClick={() => handleDeleteTask(task.id)}
                        type="button"
                      >
                        {deletingId === task.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
