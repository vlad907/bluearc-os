"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { classNames } from "@/lib/utils";

type SearchResult = {
  id: string;
  type: "company" | "contact" | "lead" | "job" | "vendor" | "task";
  title: string;
  subtitle: string | null;
  href: string;
  status: string | null;
  updatedAt: string;
};

type SearchPayload = {
  query?: string;
  type?: SearchType;
  results?: SearchResult[];
  counts?: Record<string, number>;
  error?: string;
};

type SearchType = "all" | SearchResult["type"];

const searchTypes: Array<{ value: SearchType; label: string }> = [
  { value: "all", label: "All" },
  { value: "company", label: "Companies" },
  { value: "contact", label: "Contacts" },
  { value: "lead", label: "Leads" },
  { value: "job", label: "Jobs" },
  { value: "vendor", label: "Vendors" },
  { value: "task", label: "Tasks" },
];

const typeStyles: Record<SearchResult["type"], string> = {
  company: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  contact: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  lead: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  job: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  vendor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  task: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function SearchPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SearchType>("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = query.trim();
  const totalResults = useMemo(
    () => Object.values(counts).reduce((sum, count) => sum + count, 0),
    [counts],
  );

  const runSearch = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId.trim() || trimmedQuery.length < 2) {
      setResults([]);
      setCounts({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: trimmedQuery });
      if (type !== "all") {
        params.set("type", type);
      }
      const response = await fetch(`/api/search?${params.toString()}`, {
        headers: { "x-organization-id": organizationId.trim() },
        signal,
      });
      const payload = await response.json() as SearchPayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed");
      }

      setResults(payload.results ?? []);
      setCounts(payload.counts ?? {});
    } catch (searchError) {
      if (searchError instanceof DOMException && searchError.name === "AbortError") {
        return;
      }

      setError(searchError instanceof Error ? searchError.message : "Search failed");
      setResults([]);
      setCounts({});
    } finally {
      setLoading(false);
    }
  }, [organizationId, trimmedQuery, type]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const queryParam = params.get("q") ?? "";
      const typeParam = params.get("type") as SearchType | null;
      setQuery(queryParam);
      if (typeParam && searchTypes.some((item) => item.value === typeParam)) {
        setType(typeParam);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void runSearch(controller.signal);
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [runSearch]);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Global Search"
        description="Search companies, contacts, leads, jobs, vendors, and tasks in the selected workspace."
        action={
          <input
            className="w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            placeholder="Organization ID"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
          />
        }
      />

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor="global-search">
          Search CRM
        </label>
        <input
          id="global-search"
          autoFocus
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          placeholder="Try a company, contact email, job title, vendor, or task..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-500">
          {searchTypes.map((item) => (
            <button
              key={item.value}
              className={classNames(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                type === item.value
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
              )}
              onClick={() => setType(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
          {Object.entries(counts).map(([key, count]) => (
            <span key={key} className="rounded-full bg-gray-100 px-2 py-1 dark:bg-gray-800">
              {key}: {count}
            </span>
          ))}
          {trimmedQuery.length >= 2 && !loading && (
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              {totalResults} total
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {loading ? "Searching..." : trimmedQuery.length < 2 ? "Enter at least 2 characters" : "Results"}
          </p>
        </div>
        {results.length === 0 ? (
          <div className="p-8 text-sm text-gray-500 dark:text-gray-500">
            {trimmedQuery.length < 2
              ? "Search across the workspace without opening each CRM section."
              : loading
                ? "Loading matches..."
                : "No matching records found."}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {results.map((result) => (
              <Link
                key={`${result.type}-${result.id}`}
                className="block p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                href={result.href}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={classNames("rounded-full px-2 py-1 text-xs font-medium", typeStyles[result.type])}>
                        {result.type}
                      </span>
                      {result.status && (
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {result.status}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-medium text-gray-900 dark:text-white">{result.title}</p>
                    {result.subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">{result.subtitle}</p>}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-600">Updated {formatDate(result.updatedAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
