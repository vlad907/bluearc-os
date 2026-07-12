"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { classNames } from "@/lib/utils";
import { highlightedRecordClass, useHighlightedRecordId } from "@/lib/navigation/highlight";

const statusStyles: Record<string, string> = {
  prospect: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  churned: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type Company = {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  status: string;
};

type CompanyForm = {
  name: string;
  industry: string;
  website: string;
  phone: string;
};

type CompaniesResponse = {
  companies?: Company[];
  company?: Company;
  error?: string;
  errors?: string[];
};

const emptyForm: CompanyForm = {
  name: "",
  industry: "",
  website: "",
  phone: "",
};

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as CompaniesResponse;
    return body.error ?? body.errors?.join(", ") ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

export default function CompaniesPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const highlightedId = useHighlightedRecordId();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    if (!organizationId.trim()) {
      setCompanies([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/companies", {
        headers: { "x-organization-id": organizationId.trim() },
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const body = (await response.json()) as CompaniesResponse;
      setCompanies(body.companies ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchCompanies(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchCompanies]);

  async function createCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId.trim()) {
      setError("organizationId is required");
      return;
    }

    if (!form.name.trim()) {
      setError("Company name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId.trim(),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          industry: form.industry.trim() || undefined,
          website: form.website.trim() || undefined,
          phone: form.phone.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const body = (await response.json()) as CompaniesResponse;
      if (body.company) {
        setCompanies((current) => [body.company as Company, ...current]);
      } else {
        await fetchCompanies();
      }

      setForm(emptyForm);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create company");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCompany(companyId: string) {
    if (!organizationId.trim()) {
      setError("organizationId is required");
      return;
    }

    setDeletingId(companyId);
    setError(null);

    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: "DELETE",
        headers: { "x-organization-id": organizationId.trim() },
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setCompanies((current) => current.filter((company) => company.id !== companyId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete company");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Companies"
        description="Manage your customer and prospect companies."
        action={
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <label className="sr-only" htmlFor="company-organization-id">
              Organization ID
            </label>
            <input
              id="company-organization-id"
              className="w-72 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="Organization ID"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
            />
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
              disabled={!organizationId.trim() || loading}
              onClick={() => void fetchCompanies()}
              type="button"
            >
              Refresh
            </button>
          </div>
        }
      />

      <form
        className="mb-6 grid gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 md:grid-cols-5"
        onSubmit={createCompany}
      >
        <input
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          placeholder="Company name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
        />
        <input
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          placeholder="Industry"
          value={form.industry}
          onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value }))}
        />
        <input
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          placeholder="Website"
          value={form.website}
          onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
        />
        <input
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          placeholder="Phone"
          value={form.phone}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
        />
        <button
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
          disabled={saving || !organizationId.trim()}
          type="submit"
        >
          {saving ? "Adding..." : "+ Add Company"}
        </button>
      </form>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Name</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Industry</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Website</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Phone</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!organizationId.trim() ? (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    Enter an organization ID to load companies.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    Loading companies...
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={6}>
                    No companies found.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr
                    key={company.id}
                    className={classNames(
                      "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                      highlightedRecordClass(company.id, highlightedId),
                    )}
                  >
                    <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">{company.name}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{company.industry || "—"}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{company.website || "—"}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{company.phone || "—"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={classNames(
                          "text-xs font-medium px-2.5 py-1 rounded-full",
                          statusStyles[company.status] ?? statusStyles.prospect,
                        )}
                      >
                        {company.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
                        disabled={deletingId === company.id}
                        onClick={() => void deleteCompany(company.id)}
                        type="button"
                      >
                        {deletingId === company.id ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
