"use client";

import React, { FormEvent, useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { formatCurrency } from "@/lib/utils";

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
  metadata: Record<string, unknown> | null;
};

type LeadsResponse = {
  leads?: Lead[];
  lead?: Lead;
  error?: string;
  errors?: string[];
};

type LeadResearchResponse = LeadsResponse & {
  output?: {
    confidence_score?: number;
    website_summary?: {
      one_liner?: string;
    };
  };
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

function getLeadWebsiteUrl(lead: Lead) {
  const websiteUrl = lead.metadata?.websiteUrl;
  return typeof websiteUrl === "string" ? websiteUrl : "";
}

function getLeadResearchSummary(lead: Lead) {
  const output = lead.metadata?.latestAgent1Output;

  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return null;
  }

  const confidence = "confidence_score" in output && typeof output.confidence_score === "number"
    ? output.confidence_score
    : null;
  const websiteSummary = "website_summary" in output && output.website_summary && typeof output.website_summary === "object" && !Array.isArray(output.website_summary)
    ? output.website_summary
    : null;
  const oneLiner = websiteSummary && "one_liner" in websiteSummary && typeof websiteSummary.one_liner === "string"
    ? websiteSummary.one_liner
    : null;

  return { confidence, oneLiner };
}

export default function LeadsPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [researchUrls, setResearchUrls] = useState<Record<string, string>>({});
  const [researchMessage, setResearchMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [stage, setStage] = useState<LeadStage>("new");
  const [value, setValue] = useState("");
  const [probability, setProbability] = useState("");
  const [expectedClose, setExpectedClose] = useState("");

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

  async function handleRunResearch(lead: Lead) {
    if (!organizationId) {
      return;
    }

    const url = (researchUrls[lead.id] ?? getLeadWebsiteUrl(lead)).trim();

    if (!url) {
      setError("Enter a website URL before running research");
      return;
    }

    setResearchingId(lead.id);
    setResearchMessage(null);
    setError(null);

    try {
      const ingestResponse = await fetch(`/api/leads/${lead.id}/ingest-website`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({ url }),
      });
      const ingestData = (await ingestResponse.json()) as LeadsResponse;

      if (!ingestResponse.ok) {
        throw new Error(getApiError(ingestData, "Failed to ingest website"));
      }

      const agentResponse = await fetch(`/api/leads/${lead.id}/run-agent1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({}),
      });
      const agentData = (await agentResponse.json()) as LeadResearchResponse;

      if (!agentResponse.ok || !agentData.lead) {
        throw new Error(getApiError(agentData, "Failed to run Agent 1 research"));
      }

      setLeads((currentLeads) => currentLeads.map((currentLead) => (
        currentLead.id === lead.id ? agentData.lead as Lead : currentLead
      )));
      setResearchUrls((currentUrls) => ({ ...currentUrls, [lead.id]: url }));
      setResearchMessage(`Agent 1 research complete for ${agentData.lead.title}.`);
    } catch (researchError) {
      setError(researchError instanceof Error ? researchError.message : "Failed to run research");
    } finally {
      setResearchingId(null);
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

      {researchMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
          {researchMessage}
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
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Research</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!organizationId && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    Enter an organization ID to load leads.
                  </td>
                </tr>
              )}
              {organizationId && loading && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    Loading leads...
                  </td>
                </tr>
              )}
              {organizationId && !loading && leads.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    No leads yet.
                  </td>
                </tr>
              )}
              {organizationId && !loading && leads.map((lead) => {
                const researchSummary = getLeadResearchSummary(lead);
                const websiteUrl = researchUrls[lead.id] ?? getLeadWebsiteUrl(lead);

                return (
                <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                    <div>{lead.title}</div>
                    {researchSummary?.oneLiner && (
                      <div className="mt-1 max-w-xs truncate text-xs font-normal text-gray-500 dark:text-gray-400">
                        {researchSummary.oneLiner}
                      </div>
                    )}
                  </td>
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
                  <td className="px-5 py-4">
                    <div className="flex min-w-72 gap-2">
                      <input
                        className="min-w-0 flex-1 px-3 py-2 text-xs bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
                        value={websiteUrl}
                        onChange={(event) => setResearchUrls((currentUrls) => ({ ...currentUrls, [lead.id]: event.target.value }))}
                        placeholder="https://company.com"
                        type="url"
                      />
                      <button
                        className="whitespace-nowrap px-3 py-2 text-xs font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                        disabled={researchingId === lead.id}
                        onClick={() => handleRunResearch(lead)}
                        type="button"
                      >
                        {researchingId === lead.id ? "Running..." : "Ingest + Agent 1"}
                      </button>
                    </div>
                    {researchSummary?.confidence !== null && researchSummary?.confidence !== undefined && (
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Confidence {Math.round(researchSummary.confidence * 100)}%
                      </div>
                    )}
                  </td>
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
