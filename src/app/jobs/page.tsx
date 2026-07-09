"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { classNames } from "@/lib/utils";

type JobStatus = "open" | "bidding" | "awarded" | "in_progress" | "completed" | "cancelled";
type JobPriority = "low" | "medium" | "high" | "urgent";

type Job = {
  id: string;
  title: string;
  status: JobStatus;
  priority: JobPriority;
  type: string | null;
  siteAddress: string | null;
  estimatedValue: string | number | null;
};

type JobForm = {
  title: string;
  status: JobStatus;
  priority: JobPriority;
  type: string;
  siteAddress: string;
  estimatedValue: string;
};

const organizationStorageKey = "bluearc.organizationId";

const statusStyles: Record<JobStatus, string> = {
  open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  bidding: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  awarded: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  in_progress: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  completed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const priorityStyles: Record<JobPriority, string> = {
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const initialForm: JobForm = {
  title: "",
  status: "open",
  priority: "medium",
  type: "",
  siteAddress: "",
  estimatedValue: "",
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

function formatValue(value: Job["estimatedValue"]) {
  if (value === null || value === undefined) {
    return "No estimate";
  }

  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(amount)) {
    return "No estimate";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function JobsPage() {
  const [organizationId, setOrganizationId] = useState(() =>
    typeof window === "undefined" ? "" : localStorage.getItem(organizationStorageKey) ?? "",
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [form, setForm] = useState<JobForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (organizationId) {
      localStorage.setItem(organizationStorageKey, organizationId);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const controller = new AbortController();

    async function loadJobs() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/jobs", {
          headers: { "x-organization-id": organizationId },
          signal: controller.signal,
        });
        const payload = (await response.json()) as unknown;

        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "Failed to load jobs"));
        }

        setJobs(
          payload && typeof payload === "object" && "jobs" in payload && Array.isArray(payload.jobs)
            ? payload.jobs
            : [],
        );
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
      } finally {
        setLoading(false);
      }
    }

    void loadJobs();

    return () => controller.abort();
  }, [organizationId]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId || !form.title.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    const estimatedValue = form.estimatedValue.trim() ? Number(form.estimatedValue) : null;

    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({
          title: form.title.trim(),
          status: form.status,
          priority: form.priority,
          type: form.type.trim() || null,
          siteAddress: form.siteAddress.trim() || null,
          estimatedValue,
        }),
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to create job"));
      }

      if (payload && typeof payload === "object" && "job" in payload) {
        setJobs((current) => [payload.job as Job, ...current]);
      }

      setForm(initialForm);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create job");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(jobId: string) {
    if (!organizationId) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "DELETE",
        headers: { "x-organization-id": organizationId },
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to delete job"));
      }

      setJobs((current) => current.filter((job) => job.id !== jobId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete job");
    }
  }

  function handleOrganizationChange(value: string) {
    setOrganizationId(value.trim());

    if (!value.trim()) {
      setJobs([]);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Jobs"
        description="Manage job listings and track applicants."
        action={
          <input
            className="w-72 max-w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400"
            placeholder="Organization ID"
            value={organizationId}
            onChange={(event) => handleOrganizationChange(event.target.value)}
          />
        }
      />

      <form
        onSubmit={handleCreate}
        className="mb-6 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <input
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            placeholder="Job title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
          <select
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={form.status}
            onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as JobStatus }))}
          >
            <option value="open">open</option>
            <option value="bidding">bidding</option>
            <option value="awarded">awarded</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
          <select
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={form.priority}
            onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as JobPriority }))}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>
          <input
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            placeholder="Type"
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
          />
          <input
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            placeholder="Site address"
            value={form.siteAddress}
            onChange={(event) => setForm((current) => ({ ...current, siteAddress: event.target.value }))}
          />
          <div className="flex gap-3">
            <input
              className="min-w-0 flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              min="0"
              placeholder="Estimate"
              type="number"
              value={form.estimatedValue}
              onChange={(event) => setForm((current) => ({ ...current, estimatedValue: event.target.value }))}
            />
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={!organizationId || !form.title.trim() || saving}
              type="submit"
            >
              {saving ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </form>

      {!organizationId && (
        <div className="text-sm text-gray-500 dark:text-gray-400">Enter an organization ID to load jobs.</div>
      )}

      {error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {loading && <div className="text-sm text-gray-500 dark:text-gray-400">Loading jobs...</div>}

      {!loading && organizationId && jobs.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">No jobs found.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {jobs.map((job) => (
          <div key={job.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">{job.title}</h3>
              <span className={classNames("text-xs font-medium px-2.5 py-1 rounded-full", statusStyles[job.status])}>
                {job.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-3">{formatValue(job.estimatedValue)}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500 mb-4">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                {job.siteAddress || "No site"}
              </span>
              <span className={classNames("text-xs font-medium px-2 py-0.5 rounded-full", priorityStyles[job.priority])}>
                {job.priority}
              </span>
              {job.type && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400">
                  {job.type}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
                onClick={() => void handleDelete(job.id)}
                type="button"
              >
                Delete
              </button>
              <button className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
