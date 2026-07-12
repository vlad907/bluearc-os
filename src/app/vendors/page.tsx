"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { classNames } from "@/lib/utils";
import { highlightedRecordClass, useHighlightedRecordId } from "@/lib/navigation/highlight";

type VendorStatus = "active" | "inactive" | "blacklisted";

type Vendor = {
  id: string;
  companyId: string | null;
  company: CompanyOption | null;
  name: string;
  category: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: VendorStatus;
  rating: number | null;
};

type CompanyOption = {
  id: string;
  name: string;
};

type VendorForm = {
  name: string;
  companyId: string;
  category: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  status: VendorStatus;
};

const statusStyles: Record<VendorStatus, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  blacklisted: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const initialForm: VendorForm = {
  name: "",
  companyId: "",
  category: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  status: "active",
};

type VendorsResponse = {
  vendors?: Vendor[];
  vendor?: Vendor;
  error?: string;
  errors?: string[];
};

type CompaniesResponse = {
  companies?: CompanyOption[];
  error?: string;
  errors?: string[];
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

export default function VendorsPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const highlightedId = useHighlightedRecordId();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [form, setForm] = useState<VendorForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVendors = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId) {
      setVendors([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/vendors", {
        headers: { "x-organization-id": organizationId },
        signal,
      });
      const payload = (await response.json()) as VendorsResponse;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to load vendors"));
      }

      setVendors(payload.vendors ?? []);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const loadCompanies = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId) {
      setCompanies([]);
      return;
    }

    try {
      const response = await fetch("/api/companies", {
        headers: { "x-organization-id": organizationId },
        signal,
      });
      const payload = (await response.json()) as CompaniesResponse;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to load companies"));
      }

      setCompanies(payload.companies ?? []);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Failed to load companies");
    }
  }, [organizationId]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadVendors(controller.signal);
      void loadCompanies(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadCompanies, loadVendors]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId || !form.name.trim()) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({
          name: form.name.trim(),
          companyId: form.companyId || null,
          category: form.category.trim() || null,
          contactName: form.contactName.trim() || null,
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          website: form.website.trim() || null,
          status: form.status,
        }),
      });
      const payload = (await response.json()) as VendorsResponse;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to create vendor"));
      }

      if (payload.vendor) {
        setVendors((current) => [payload.vendor as Vendor, ...current]);
      }

      setForm(initialForm);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create vendor");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(vendorId: string) {
    if (!organizationId) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/vendors/${vendorId}`, {
        method: "DELETE",
        headers: { "x-organization-id": organizationId },
      });
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to delete vendor"));
      }

      setVendors((current) => current.filter((vendor) => vendor.id !== vendorId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete vendor");
    }
  }

  function handleOrganizationChange(value: string) {
    setOrganizationId(value.trim());

    if (!value.trim()) {
      setVendors([]);
      setCompanies([]);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Vendors"
        description="Manage your vendor and supplier relationships."
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
            placeholder="Vendor name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
          />
          <select
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={form.companyId}
            onChange={(event) => setForm((current) => ({ ...current, companyId: event.target.value }))}
          >
            <option value="">No linked account</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <input
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            placeholder="Category"
            value={form.category}
            onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
          />
          <input
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            placeholder="Contact name"
            value={form.contactName}
            onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
          />
          <input
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <input
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            placeholder="Phone"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
          <input
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            placeholder="Website"
            value={form.website}
            onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
          />
          <div className="flex gap-3">
            <select
              className="min-w-0 flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as VendorStatus }))}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="blacklisted">blacklisted</option>
            </select>
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={!organizationId || !form.name.trim() || saving}
              type="submit"
            >
              {saving ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </form>

      {!organizationId && (
        <div className="text-sm text-gray-500 dark:text-gray-400">Enter an organization ID to load vendors.</div>
      )}

      {error && <div className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>}

      {loading && <div className="text-sm text-gray-500 dark:text-gray-400">Loading vendors...</div>}

      {!loading && organizationId && vendors.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">No vendors found.</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vendors.map((vendor) => (
          <div
            key={vendor.id}
            className={classNames(
              "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 transition-colors",
              highlightedRecordClass(vendor.id, highlightedId),
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{vendor.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{vendor.category || "Uncategorized"}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                  Account: {vendor.company?.name ?? "Unlinked"}
                </p>
              </div>
              <span className={classNames("text-xs font-medium px-2.5 py-1 rounded-full", statusStyles[vendor.status])}>
                {vendor.status}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                <span>{vendor.contactName || "No contact"}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
                </svg>
                {vendor.email ? (
                  <a className="truncate text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300" href={`mailto:${vendor.email}`}>
                    {vendor.email}
                  </a>
                ) : (
                  <span className="truncate">No email</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 0111.19 19 19.5 19.5 0 015 12.81 19.79 19.79 0 012.08 4.18 2 2 0 014.06 2h3a2 2 0 012 1.72c.12.9.32 1.77.59 2.61a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.47-1.11a2 2 0 012.11-.45c.84.27 1.71.47 2.61.59A2 2 0 0122 16.92z" />
                </svg>
                {vendor.phone ? (
                  <a className="truncate text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white" href={`tel:${vendor.phone}`}>
                    {vendor.phone}
                  </a>
                ) : (
                  <span className="truncate">No phone</span>
                )}
              </div>
              {vendor.website ? (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 010 20" /><path d="M12 2a15.3 15.3 0 000 20" />
                  </svg>
                  <a className="truncate text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300" href={vendor.website} rel="noreferrer" target="_blank">
                    {vendor.website}
                  </a>
                </div>
              ) : null}
              {vendor.rating !== null && vendor.rating > 0 && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg key={i} className={`w-4 h-4 ${i < (vendor.rating ?? 0) ? "text-amber-400" : "text-gray-300 dark:text-gray-600"}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              )}
            </div>
            <button
              className="mt-4 text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
              onClick={() => void handleDelete(vendor.id)}
              type="button"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
