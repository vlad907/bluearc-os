"use client";

import React, { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { classNames } from "@/lib/utils";
import { highlightedRecordClass, useHighlightedRecordId } from "@/lib/navigation/highlight";

type JobStatus = "open" | "bidding" | "awarded" | "in_progress" | "completed" | "cancelled";
type JobPriority = "low" | "medium" | "high" | "urgent";

type Job = {
  id: string;
  title: string;
  companyId: string | null;
  contactId: string | null;
  vendorId: string | null;
  leadId: string | null;
  company: CompanyOption | null;
  contact: ContactOption | null;
  vendor: VendorOption | null;
  lead: LeadOption | null;
  status: JobStatus;
  priority: JobPriority;
  type: string | null;
  siteAddress: string | null;
  estimatedValue: string | number | null;
};

type CompanyOption = {
  id: string;
  name: string;
};

type ContactOption = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  companyId: string | null;
};

type VendorOption = {
  id: string;
  name: string;
};

type LeadOption = {
  id: string;
  title: string;
  companyId: string | null;
};

type JobForm = {
  title: string;
  companyId: string;
  contactId: string;
  vendorId: string;
  leadId: string;
  status: JobStatus;
  priority: JobPriority;
  type: string;
  siteAddress: string;
  estimatedValue: string;
};

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
  companyId: "",
  contactId: "",
  vendorId: "",
  leadId: "",
  status: "open",
  priority: "medium",
  type: "",
  siteAddress: "",
  estimatedValue: "",
};

type JobsResponse = {
  jobs?: Job[];
  job?: Job;
  error?: string;
  errors?: string[];
};

type CompaniesResponse = {
  companies?: CompanyOption[];
  error?: string;
  errors?: string[];
};

type ContactsResponse = {
  contacts?: ContactOption[];
  error?: string;
  errors?: string[];
};

type VendorsResponse = {
  vendors?: VendorOption[];
  error?: string;
  errors?: string[];
};

type LeadsResponse = {
  leads?: LeadOption[];
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

function getContactName(contact: ContactOption) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

export default function JobsPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const highlightedId = useHighlightedRecordId();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [form, setForm] = useState<JobForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId) {
      setJobs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/jobs", {
        headers: { "x-organization-id": organizationId },
        signal,
      });
      const payload = (await response.json()) as JobsResponse;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to load jobs"));
      }

      setJobs(payload.jobs ?? []);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  const loadRelationshipOptions = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId) {
      setCompanies([]);
      setContacts([]);
      setVendors([]);
      setLeads([]);
      return;
    }

    try {
      const [companiesResponse, contactsResponse, vendorsResponse, leadsResponse] = await Promise.all([
        fetch("/api/companies", { headers: { "x-organization-id": organizationId }, signal }),
        fetch("/api/contacts", { headers: { "x-organization-id": organizationId }, signal }),
        fetch("/api/vendors", { headers: { "x-organization-id": organizationId }, signal }),
        fetch("/api/leads", { headers: { "x-organization-id": organizationId }, signal }),
      ]);

      const companiesPayload = (await companiesResponse.json()) as CompaniesResponse;
      const contactsPayload = (await contactsResponse.json()) as ContactsResponse;
      const vendorsPayload = (await vendorsResponse.json()) as VendorsResponse;
      const leadsPayload = (await leadsResponse.json()) as LeadsResponse;

      if (!companiesResponse.ok) {
        throw new Error(getErrorMessage(companiesPayload, "Failed to load companies"));
      }

      if (!contactsResponse.ok) {
        throw new Error(getErrorMessage(contactsPayload, "Failed to load contacts"));
      }

      if (!vendorsResponse.ok) {
        throw new Error(getErrorMessage(vendorsPayload, "Failed to load vendors"));
      }

      if (!leadsResponse.ok) {
        throw new Error(getErrorMessage(leadsPayload, "Failed to load leads"));
      }

      setCompanies(companiesPayload.companies ?? []);
      setContacts(contactsPayload.contacts ?? []);
      setVendors(vendorsPayload.vendors ?? []);
      setLeads(leadsPayload.leads ?? []);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "Failed to load job options");
    }
  }, [organizationId]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadJobs(controller.signal);
      void loadRelationshipOptions(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [loadJobs, loadRelationshipOptions]);

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
          companyId: form.companyId || null,
          contactId: form.contactId || null,
          vendorId: form.vendorId || null,
          leadId: form.leadId || null,
          status: form.status,
          priority: form.priority,
          type: form.type.trim() || null,
          siteAddress: form.siteAddress.trim() || null,
          estimatedValue,
        }),
      });
      const payload = (await response.json()) as JobsResponse;

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to create job"));
      }

      if (payload.job) {
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
      setCompanies([]);
      setContacts([]);
      setVendors([]);
      setLeads([]);
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
            className="xl:col-span-2 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            placeholder="Job title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            required
          />
          <select
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={form.companyId}
            onChange={(event) => setForm((current) => ({
              ...current,
              companyId: event.target.value,
              contactId: "",
              leadId: "",
            }))}
          >
            <option value="">No company</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>{company.name}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={form.contactId}
            onChange={(event) => setForm((current) => ({ ...current, contactId: event.target.value }))}
          >
            <option value="">No contact</option>
            {contacts
              .filter((contact) => !form.companyId || contact.companyId === form.companyId)
              .map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {getContactName(contact)}{contact.email ? ` · ${contact.email}` : ""}
                </option>
              ))}
          </select>
          <select
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={form.vendorId}
            onChange={(event) => setForm((current) => ({ ...current, vendorId: event.target.value }))}
          >
            <option value="">No vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white"
            value={form.leadId}
            onChange={(event) => setForm((current) => ({ ...current, leadId: event.target.value }))}
          >
            <option value="">No lead</option>
            {leads
              .filter((lead) => !form.companyId || lead.companyId === form.companyId)
              .map((lead) => (
                <option key={lead.id} value={lead.id}>{lead.title}</option>
              ))}
          </select>
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
          <div
            key={job.id}
            className={classNames(
              "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 transition-colors",
              highlightedRecordClass(job.id, highlightedId),
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">{job.title}</h3>
              <span className={classNames("text-xs font-medium px-2.5 py-1 rounded-full", statusStyles[job.status])}>
                {job.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-3">{formatValue(job.estimatedValue)}</p>
            <div className="mb-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span className="font-medium text-gray-900 dark:text-white">Account:</span>{" "}
                {job.company?.name ?? "Unassigned"}
              </div>
              {job.contact ? (
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Contact:</span>{" "}
                  {getContactName(job.contact)}
                  {job.contact.email ? ` · ${job.contact.email}` : ""}
                </div>
              ) : null}
              {job.vendor ? (
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Vendor:</span>{" "}
                  {job.vendor.name}
                </div>
              ) : null}
              {job.lead ? (
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Lead:</span>{" "}
                  {job.lead.title}
                </div>
              ) : null}
            </div>
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
