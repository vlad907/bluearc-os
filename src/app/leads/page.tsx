"use client";

import React, { FormEvent, useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { formatCurrency } from "@/lib/utils";

const ORGANIZATION_STORAGE_KEY = "bluearc.organizationId";

const leadStages = ["new", "evaluating", "bidding", "submitted", "won", "lost"] as const;

type LeadStage = (typeof leadStages)[number];

type Lead = {
  id: string;
  title: string;
  companyId: string | null;
  stage: LeadStage;
  value: string | number | null;
  probability: number | null;
  source: string | null;
  expectedClose: string | null;
};

type LeadsResponse = {
  leads?: Lead[];
  lead?: Lead;
  error?: string;
  errors?: string[];
};

const stageColors: Record<LeadStage, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  evaluating: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  bidding: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  lost: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function getApiError(data: LeadsResponse, fallback: string) {
  if (data.errors?.length) {
    return data.errors.join(", ");
  }

  return data.error ?? fallback;
}

function formatLeadValue(value: Lead["value"]) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? formatCurrency(numericValue) : String(value);
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

export default function LeadsPage() {
  const [organizationId, setOrganizationId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(ORGANIZATION_STORAGE_KEY) ?? "";
  });
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<LeadStage>("new");
  const [value, setValue] = useState("");
  const [probability, setProbability] = useState("");
  const [expectedClose, setExpectedClose] = useState("");

  useEffect(() => {
    if (organizationId) {
      window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
    } else {
      window.localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    let cancelled = false;

    async function fetchLeads() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/leads", {
          headers: { "x-organization-id": organizationId },
        });
        const data = (await response.json()) as LeadsResponse;

        if (!response.ok) {
          throw new Error(getApiError(data, "Failed to load leads"));
        }

        if (!cancelled) {
          setLeads(data.leads ?? []);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load leads");
          setLeads([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchLeads();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  function handleOrganizationIdChange(value: string) {
    const nextOrganizationId = value.trim();
    setOrganizationId(nextOrganizationId);

    if (!nextOrganizationId) {
      setLeads([]);
      setError(null);
    }
  }

  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId || !title.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const payload: Record<string, string | number> = {
      title: title.trim(),
      stage,
    };

    if (value.trim()) {
      payload.value = value.trim();
    }

    if (probability.trim()) {
      payload.probability = Number(probability);
    }

    if (expectedClose) {
      payload.expectedClose = new Date(`${expectedClose}T00:00:00`).toISOString();
    }

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as LeadsResponse;

      if (!response.ok || !data.lead) {
        throw new Error(getApiError(data, "Failed to create lead"));
      }

      setLeads((currentLeads) => [data.lead as Lead, ...currentLeads]);
      setTitle("");
      setStage("new");
      setValue("");
      setProbability("");
      setExpectedClose("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create lead");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteLead(leadId: string) {
    if (!organizationId) {
      return;
    }

    setDeletingId(leadId);
    setError(null);

    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: "DELETE",
        headers: { "x-organization-id": organizationId },
      });
      const data = (await response.json()) as LeadsResponse;

      if (!response.ok) {
        throw new Error(getApiError(data, "Failed to delete lead"));
      }

      setLeads((currentLeads) => currentLeads.filter((lead) => lead.id !== leadId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete lead");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Leads"
        description="Track and manage your sales pipeline."
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
        onSubmit={handleCreateLead}
        className="mb-6 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-6"
      >
        <input
          className="md:col-span-2 px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Lead title"
          required
        />
        <select
          className="px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
          value={stage}
          onChange={(event) => setStage(event.target.value as LeadStage)}
        >
          {leadStages.map((leadStage) => (
            <option key={leadStage} value={leadStage}>
              {leadStage}
            </option>
          ))}
        </select>
        <input
          className="px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          inputMode="decimal"
          placeholder="Value"
        />
        <input
          className="px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
          value={probability}
          onChange={(event) => setProbability(event.target.value)}
          type="number"
          min="0"
          max="100"
          placeholder="Probability"
        />
        <div className="flex gap-3 md:col-span-6">
          <input
            className="min-w-0 flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={expectedClose}
            onChange={(event) => setExpectedClose(event.target.value)}
            type="date"
          />
          <button
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
            disabled={!organizationId || !title.trim() || submitting}
            type="submit"
          >
            {submitting ? "Adding..." : "+ Add Lead"}
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
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Deal</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Stage</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Value</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Probability</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Expected Close</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!organizationId && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    Enter an organization ID to load leads.
                  </td>
                </tr>
              )}
              {organizationId && loading && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    Loading leads...
                  </td>
                </tr>
              )}
              {organizationId && !loading && leads.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    No leads yet.
                  </td>
                </tr>
              )}
              {organizationId && !loading && leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">{lead.title}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stageColors[lead.stage]}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-gray-900 dark:text-white">{formatLeadValue(lead.value)}</td>
                  <td className="px-5 py-4 text-center">
                    {lead.probability === null ? (
                      <span className="text-gray-500 dark:text-gray-400">—</span>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${lead.probability}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{lead.probability}%</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{formatDate(lead.expectedClose)}</td>
                  <td className="px-5 py-4 text-right">
                    <button
                      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      disabled={deletingId === lead.id}
                      onClick={() => handleDeleteLead(lead.id)}
                      type="button"
                    >
                      {deletingId === lead.id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
