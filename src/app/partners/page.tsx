"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";

type PartnerCandidateStatus = "discovered" | "researching" | "qualified" | "contacted" | "converted" | "rejected" | "archived";

type PartnerCandidate = {
  id: string;
  name: string;
  website: string | null;
  description: string | null;
  industry: string | null;
  relevanceReason: string | null;
  partnershipType: string;
  status: PartnerCandidateStatus;
  fitScore: number | null;
  fitReasons: string[];
  recommendedOutreachAngle: string | null;
  contactEmails: string[];
  contactFormUrl: string | null;
  company: { id: string; name: string } | null;
  lead: { id: string; title: string } | null;
};

type ApiPayload = {
  partnerCandidates?: PartnerCandidate[];
  partnerCandidate?: PartnerCandidate;
  company?: { id: string; name: string };
  lead?: { id: string; title: string };
  task?: { id: string; title: string };
  created?: PartnerCandidate[];
  createdCount?: number;
  skipped?: string[];
  skippedCount?: number;
  provider?: string;
  model?: string;
  error?: string;
  errors?: string[];
};

const sampleInput = `Field Nation, https://www.fieldnation.com, Marketplace for on-site field service technicians, Field Services, National platform for local technician dispatch
WorkMarket, https://www.workmarket.com, Workforce and contractor management platform, Contractor Network, Potential vendor network or referral partner
Tech Service Today, https://www.techservicetoday.com, Nationwide IT field services provider, IT Services, Possible subcontractor or coverage partner`;

const statusStyles: Record<PartnerCandidateStatus, string> = {
  discovered: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  researching: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  qualified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  contacted: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  converted: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function getApiError(payload: ApiPayload, fallback: string) {
  if (payload.errors?.length) {
    return payload.errors.join(", ");
  }

  return payload.error ?? fallback;
}

function parseRows(rawInput: string) {
  return rawInput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [name = "", website = "", description = "", industry = "", relevanceReason = ""] = line
        .split(/\t|,/)
        .map((value) => value.trim());

      return {
        id: `${index}-${name}`,
        name,
        website,
        description,
        industry,
        relevanceReason,
      };
    })
    .filter((row) => row.name);
}

async function requestJson(path: string, organizationId: string, method: "GET" | "POST", body?: Record<string, unknown>) {
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
    throw new Error(getApiError(payload, `Request failed for ${path}`));
  }

  return payload;
}

export default function PartnersPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [rawInput, setRawInput] = useState(sampleInput);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [candidates, setCandidates] = useState<PartnerCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => parseRows(rawInput), [rawInput]);
  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.has(row.id)), [rows, selectedIds]);

  const loadCandidates = useCallback(async () => {
    if (!organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = await requestJson("/api/partner-candidates", organizationId, "GET");
      setCandidates(payload.partnerCandidates ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load partner candidates");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCandidates();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadCandidates]);

  function toggleRow(rowId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }

      return next;
    });
  }

  function toggleAllRows() {
    setSelectedIds((current) => current.size === rows.length ? new Set() : new Set(rows.map((row) => row.id)));
  }

  async function importSelectedRows() {
    if (!organizationId || selectedRows.length === 0) {
      return;
    }

    setImporting(true);
    setError(null);
    setMessage(null);

    try {
      for (const row of selectedRows) {
        await requestJson("/api/partner-candidates", organizationId, "POST", {
          name: row.name,
          website: row.website || null,
          description: row.description || null,
          industry: row.industry || null,
          relevanceReason: row.relevanceReason || null,
        });
      }

      setSelectedIds(new Set());
      setMessage(`Imported ${selectedRows.length} partner candidate${selectedRows.length === 1 ? "" : "s"}.`);
      await loadCandidates();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function searchPartners() {
    if (!organizationId) {
      return;
    }

    setSearching(true);
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson("/api/partner-candidates/search", organizationId, "POST", {
        query: searchQuery.trim() || undefined,
      });
      const createdCount = payload.createdCount ?? 0;
      const skippedCount = payload.skippedCount ?? 0;
      const via = payload.model ? ` via ${payload.model}` : "";
      setMessage(
        `Partner search${via} found ${createdCount} new candidate${createdCount === 1 ? "" : "s"}` +
          (skippedCount ? ` (${skippedCount} already tracked).` : "."),
      );
      await loadCandidates();
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Partner search failed");
    } finally {
      setSearching(false);
    }
  }

  async function analyzeCandidate(candidateId: string) {
    if (!organizationId) {
      return;
    }

    setActionId(candidateId);
    setError(null);
    setMessage(null);

    try {
      const payload = await requestJson(`/api/partner-candidates/${candidateId}/analyze`, organizationId, "POST", {});
      if (payload.partnerCandidate) {
        setCandidates((current) => current.map((candidate) => (
          candidate.id === candidateId ? payload.partnerCandidate as PartnerCandidate : candidate
        )));
      }
      setMessage("Partnership fit analysis complete.");
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed");
    } finally {
      setActionId(null);
    }
  }

  async function convertCandidate(candidateId: string) {
    if (!organizationId) {
      return;
    }

    setActionId(candidateId);
    setError(null);
    setMessage(null);

    try {
      await requestJson(`/api/partner-candidates/${candidateId}/convert`, organizationId, "POST", {});
      setMessage("Partner candidate converted to company, lead, and review task.");
      await loadCandidates();
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : "Conversion failed");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Partnerships"
        description="Build a vendor/subcontractor partnership pipeline from CRM Command candidate research."
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
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Live Partner Search</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
              Uses a configured Anthropic provider with web search to find real vendor/subcontractor partners. Leave the box blank to search from your workspace profile. AI budget and rate limits apply.
            </p>
          </div>
          <input
            className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            placeholder="Optional: describe the partners to find (e.g. national HVAC dispatch networks in the Southeast)"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <div className="mt-4">
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!organizationId || searching}
              onClick={() => void searchPartners()}
              type="button"
            >
              {searching ? "Searching..." : "Search for Partners"}
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Partner Candidate Import</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
              Paste CSV or tab-separated rows: company, website, description, industry, relevance reason.
            </p>
          </div>
          <textarea
            className="min-h-36 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            value={rawInput}
            onChange={(event) => {
              setRawInput(event.target.value);
              setSelectedIds(new Set());
            }}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!organizationId || selectedRows.length === 0 || importing}
              onClick={importSelectedRows}
              type="button"
            >
              {importing ? "Importing..." : `Import ${selectedRows.length || ""} Selected`}
            </button>
            <button
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              onClick={toggleAllRows}
              type="button"
            >
              {selectedIds.size === rows.length ? "Clear Selection" : "Select All"}
            </button>
            <button
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              disabled={!organizationId || loading}
              onClick={() => void loadCandidates()}
              type="button"
            >
              {loading ? "Refreshing..." : "Refresh Candidates"}
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-500">{rows.length} parsed row{rows.length === 1 ? "" : "s"}</p>
          </div>
          {message && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_1fr]">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Parsed Preview</h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {rows.map((row) => (
                <label key={row.id} className="flex cursor-pointer gap-3 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <input checked={selectedIds.has(row.id)} onChange={() => toggleRow(row.id)} type="checkbox" />
                  <span>
                    <span className="block font-medium text-gray-900 dark:text-white">{row.name}</span>
                    <span className="mt-1 block text-sm text-gray-500 dark:text-gray-500">{row.industry || "No industry"} · {row.website || "No website"}</span>
                  </span>
                </label>
              ))}
              {rows.length === 0 && <div className="px-6 py-8 text-sm text-gray-500 dark:text-gray-500">Paste rows to preview.</div>}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Partner Candidates</h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="px-6 py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{candidate.name}</h4>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[candidate.status]}`}>{candidate.status}</span>
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">{candidate.partnershipType}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                        {candidate.industry ?? "Unknown industry"} {candidate.website ? `· ${candidate.website}` : ""}
                      </p>
                      <p className="mt-3 max-w-3xl text-sm text-gray-700 dark:text-gray-300">
                        {candidate.recommendedOutreachAngle ?? candidate.relevanceReason ?? candidate.description ?? "No analysis yet."}
                      </p>
                      {candidate.fitReasons.length > 0 && (
                        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-500 dark:text-gray-500">
                          {candidate.fitReasons.slice(0, 3).map((reason) => <li key={reason}>{reason}</li>)}
                        </ul>
                      )}
                      {candidate.contactEmails.length > 0 && (
                        <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">Emails: {candidate.contactEmails.join(", ")}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                        disabled={actionId === candidate.id || !candidate.website}
                        onClick={() => void analyzeCandidate(candidate.id)}
                        type="button"
                      >
                        {actionId === candidate.id ? "Working..." : "Analyze Fit"}
                      </button>
                      <button
                        className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        disabled={actionId === candidate.id || candidate.status === "converted"}
                        onClick={() => void convertCandidate(candidate.id)}
                        type="button"
                      >
                        Convert
                      </button>
                    </div>
                  </div>
                  {candidate.fitScore !== null && (
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs text-gray-500 dark:text-gray-500">
                        <span>Fit score</span>
                        <span>{Math.round(candidate.fitScore * 100)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.round(candidate.fitScore * 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!loading && candidates.length === 0 && (
                <div className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-500">
                  No partner candidates yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
