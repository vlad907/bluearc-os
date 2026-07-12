"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useOrganization } from "@/context/OrganizationContext";
import { classNames } from "@/lib/utils";

type SearchResult = {
  id: string;
  type: "company" | "contact" | "lead" | "job" | "vendor" | "task";
  title: string;
  subtitle: string | null;
  href: string;
  status: string | null;
};

type SearchPayload = {
  results?: SearchResult[];
  error?: string;
};

const typeStyles: Record<SearchResult["type"], string> = {
  company: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  contact: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  lead: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  job: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  vendor: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  task: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function Topbar() {
  const pathname = usePathname();
  const { organizationId, user, workspaces } = useOrganization();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trimmedQuery = query.trim();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === organizationId);

  const runSearch = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId || trimmedQuery.length < 2) {
      setResults([]);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ q: trimmedQuery });
      const response = await fetch(`/api/search?${params.toString()}`, {
        headers: { "x-organization-id": organizationId },
        signal,
      });
      const payload = await response.json() as SearchPayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Search failed");
      }

      setResults(payload.results?.slice(0, 7) ?? []);
      setOpen(true);
    } catch (searchError) {
      if (searchError instanceof DOMException && searchError.name === "AbortError") {
        return;
      }

      setError(searchError instanceof Error ? searchError.message : "Search failed");
      setResults([]);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, [organizationId, trimmedQuery]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void runSearch(controller.signal);
    }, 200);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [runSearch]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }

      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
      <div className="flex h-16 items-center gap-4 px-4 lg:px-6">
        <div ref={containerRef} className="relative max-w-2xl flex-1">
          <label className="sr-only" htmlFor="topbar-global-search">Global search</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
            </span>
            <input
              id="topbar-global-search"
              ref={inputRef}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 py-2 pl-9 pr-24 text-sm text-gray-900 outline-none transition-colors focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:bg-gray-950"
              disabled={!organizationId}
              placeholder={organizationId ? "Search workspace..." : "Select or create a workspace to search"}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-500 sm:block">
              ⌘K
            </kbd>
          </div>

          {open && (trimmedQuery.length >= 2 || error) && (
            <div className="absolute left-0 right-0 top-12 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900">
              <div className="border-b border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-500">
                {loading ? "Searching..." : error ? "Search unavailable" : `${results.length} quick result${results.length === 1 ? "" : "s"}`}
              </div>
              {error ? (
                <div className="p-4 text-sm text-red-600 dark:text-red-400">{error}</div>
              ) : results.length === 0 && !loading ? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-500">No matches found.</div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  {results.map((result) => (
                    <Link
                      key={`${result.type}-${result.id}`}
                      className="block border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                      href={result.href}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{result.title}</p>
                          <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-500">
                            {result.subtitle ?? result.status ?? "Open record"}
                          </p>
                        </div>
                        <span className={classNames("shrink-0 rounded-full px-2 py-1 text-xs font-medium", typeStyles[result.type])}>
                          {result.type}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
              <Link
                className="block border-t border-gray-200 px-4 py-3 text-sm font-medium text-indigo-600 hover:bg-indigo-50 dark:border-gray-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                href={`/search${trimmedQuery ? `?q=${encodeURIComponent(trimmedQuery)}` : ""}`}
              >
                Open full search
              </Link>
            </div>
          )}
        </div>

        <div className="hidden min-w-0 text-right lg:block">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
            {activeWorkspace?.name ?? "No workspace"}
          </p>
          <p className="truncate text-xs text-gray-500 dark:text-gray-500">
            {user ? `${user.name} · ${activeWorkspace?.role ?? "member"}` : "Not signed in"}
          </p>
        </div>
      </div>
    </header>
  );
}
