"use client";

import React, { useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";

type ApiPayload = {
  company?: { id: string; name: string };
  lead?: { id: string; title: string };
  task?: { id: string; title: string };
  error?: string;
  errors?: string[];
};

const sampleInput = `Acme Property Group, https://example.com/acme, Property Management, Los Angeles CA, +1-555-0100
Northstar Property Management, https://example.com/northstar, Commercial Real Estate, Irvine CA, +1-555-0142
Summit Cabling LLC, https://example.com/summit, Low Voltage Contractor, Anaheim CA, +1-555-0180`;

function getApiError(payload: ApiPayload, fallback: string) {
  if (payload.errors?.length) {
    return payload.errors.join(", ");
  }

  return payload.error ?? fallback;
}

function extractDomain(website: string) {
  if (!website.trim()) {
    return null;
  }

  try {
    return new URL(website.trim()).hostname.replace(/^www\./, "");
  } catch {
    return website.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] || null;
  }
}

function parseProspectRows(rawInput: string) {
  return rawInput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [company = "", website = "", industry = "", location = "", phone = ""] = line
        .split(/\t|,/)
        .map((value) => value.trim());

      return {
        id: `${index}-${company}`,
        company,
        website,
        industry,
        location,
        phone,
        source: "manual_discovery",
      };
    })
    .filter((row) => row.company);
}

async function postJson(path: string, organizationId: string, body: Record<string, unknown>) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-organization-id": organizationId,
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as ApiPayload;

  if (!response.ok) {
    throw new Error(getApiError(payload, `Request failed for ${path}`));
  }

  return payload;
}

export default function DiscoveryPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [rawInput, setRawInput] = useState(sampleInput);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => parseProspectRows(rawInput), [rawInput]);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.has(row.id)),
    [rows, selectedIds],
  );

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
    setSelectedIds((current) => {
      if (current.size === rows.length) {
        return new Set();
      }

      return new Set(rows.map((row) => row.id));
    });
  }

  async function importSelectedRows() {
    if (!organizationId || selectedRows.length === 0) {
      return;
    }

    setImporting(true);
    setError(null);
    setMessage(null);

    let importedCount = 0;

    try {
      for (const row of selectedRows) {
        const companyPayload = await postJson("/api/companies", organizationId, {
          name: row.company,
          relationshipType: row.industry.toLowerCase().includes("cabling") ? "vendor" : "customer",
          domain: extractDomain(row.website),
          industry: row.industry || null,
          website: row.website || null,
          phone: row.phone || null,
          status: "prospect",
          address: row.location ? { raw: row.location } : null,
          metadata: {
            source: row.source,
            importedFrom: "discovery",
          },
        });

        const companyId = companyPayload.company?.id;

        const leadPayload = await postJson("/api/leads", organizationId, {
          title: `${row.company} discovery lead`,
          companyId,
          stage: "new",
          source: row.source,
          probability: 15,
          metadata: {
            source: row.source,
            website: row.website || null,
            industry: row.industry || null,
            location: row.location || null,
          },
        });

        await postJson("/api/tasks", organizationId, {
          title: `Research ${row.company}`,
          description: "Imported from Discovery. Verify website, decision maker, and outreach angle.",
          status: "todo",
          priority: "medium",
          entityType: "lead",
          entityId: leadPayload.lead?.id ?? null,
          metadata: { source: row.source },
        });

        importedCount += 1;
      }

      setSelectedIds(new Set());
      setMessage(`Imported ${importedCount} prospect${importedCount === 1 ? "" : "s"} as companies, leads, and research tasks.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Discovery"
        description="Ported from CRM Command: collect prospects, import them into the CRM, and create research tasks."
      />

      <div className="space-y-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Prospect Import</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                Paste CSV or tab-separated rows: company, website, industry, location, phone.
              </p>
            </div>
            <div className="w-full lg:w-96">
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
          </div>

          <textarea
            className="min-h-40 w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
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
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {rows.length} parsed prospect{rows.length === 1 ? "" : "s"}
            </p>
          </div>

          {message && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-800">
            <h3 className="font-semibold text-gray-900 dark:text-white">Preview</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-950 dark:text-gray-500">
                <tr>
                  <th className="w-12 px-6 py-3">Pick</th>
                  <th className="px-6 py-3">Company</th>
                  <th className="px-6 py-3">Industry</th>
                  <th className="px-6 py-3">Location</th>
                  <th className="px-6 py-3">Website</th>
                  <th className="px-6 py-3">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4">
                      <input
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleRow(row.id)}
                        type="checkbox"
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{row.company}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{row.industry || "—"}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{row.location || "—"}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{row.website || "—"}</td>
                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400">{row.phone || "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="px-6 py-8 text-center text-gray-500 dark:text-gray-500" colSpan={6}>
                      Paste at least one company row to preview imports.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
