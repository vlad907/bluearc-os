"use client";

import React, { FormEvent, useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { getPriorityColor } from "@/lib/utils";

const taskStatuses = ["todo", "in_progress", "done", "cancelled"] as const;
const taskPriorities = ["low", "medium", "high", "urgent"] as const;

type TaskStatus = (typeof taskStatuses)[number];
type TaskPriority = (typeof taskPriorities)[number];

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  assignedToId: string | null;
};

type TasksResponse = {
  tasks?: Task[];
  task?: Task;
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

export default function TasksPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    let cancelled = false;

    async function fetchTasks() {
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

        if (!cancelled) {
          setTasks(data.tasks ?? []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load tasks");
          setTasks([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTasks();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  function handleOrganizationIdChange(value: string) {
    const nextOrganizationId = value.trim();
    setOrganizationId(nextOrganizationId);

    if (!nextOrganizationId) {
      setTasks([]);
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
        className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-5"
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
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Due Date</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Priority</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!organizationId && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    Enter an organization ID to load tasks.
                  </td>
                </tr>
              )}
              {organizationId && loading && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    Loading tasks...
                  </td>
                </tr>
              )}
              {organizationId && !loading && tasks.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    No tasks yet.
                  </td>
                </tr>
              )}
              {organizationId && !loading && tasks.map((task) => {
                const completed = task.status === "done";

                return (
                  <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
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
