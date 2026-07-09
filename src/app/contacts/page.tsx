"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { classNames } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

type Contact = {
  id: string;
  companyId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  role: string | null;
  status: string;
};

type ContactForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  companyId: string;
};

type ContactsResponse = {
  contacts?: Contact[];
  contact?: Contact;
  error?: string;
  errors?: string[];
};

const emptyForm: ContactForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  title: "",
  companyId: "",
};

async function readApiError(response: Response) {
  try {
    const body = (await response.json()) as ContactsResponse;
    return body.error ?? body.errors?.join(", ") ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

function getContactName(contact: Contact) {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

export default function ContactsPage() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [form, setForm] = useState<ContactForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    if (!organizationId.trim()) {
      setContacts([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/contacts", {
        headers: { "x-organization-id": organizationId.trim() },
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const body = (await response.json()) as ContactsResponse;
      setContacts(body.contacts ?? []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void fetchContacts(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchContacts]);

  async function createContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!organizationId.trim()) {
      setError("organizationId is required");
      return;
    }

    if (!form.firstName.trim()) {
      setError("First name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId.trim(),
        },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
          title: form.title.trim() || undefined,
          companyId: form.companyId.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      const body = (await response.json()) as ContactsResponse;
      if (body.contact) {
        setContacts((current) => [body.contact as Contact, ...current]);
      } else {
        await fetchContacts();
      }
      setForm(emptyForm);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create contact");
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(contactId: string) {
    if (!organizationId.trim()) {
      setError("organizationId is required");
      return;
    }

    setDeletingId(contactId);
    setError(null);

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: "DELETE",
        headers: { "x-organization-id": organizationId.trim() },
      });

      if (!response.ok) {
        throw new Error(await readApiError(response));
      }

      setContacts((current) => current.filter((contact) => contact.id !== contactId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete contact");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Contacts"
        description="View and manage your contact directory."
        action={
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <label className="sr-only" htmlFor="contact-organization-id">
              Organization ID
            </label>
            <input
              id="contact-organization-id"
              className="w-72 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="Organization ID"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
            />
            <button
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60"
              disabled={!organizationId.trim() || loading}
              onClick={() => void fetchContacts()}
              type="button"
            >
              Refresh
            </button>
          </div>
        }
      />

      <form
        className="mb-6 grid gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 md:grid-cols-6"
        onSubmit={createContact}
      >
        <input
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          placeholder="First name"
          value={form.firstName}
          onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
        />
        <input
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          placeholder="Last name"
          value={form.lastName}
          onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
        />
        <input
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
        />
        <input
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          placeholder="Phone"
          value={form.phone}
          onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
        />
        <input
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          placeholder="Title"
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
        <input
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-950 text-gray-900 dark:text-white"
          placeholder="Company ID"
          value={form.companyId}
          onChange={(event) => setForm((current) => ({ ...current, companyId: event.target.value }))}
        />
        <button
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 md:col-span-6"
          disabled={saving || !organizationId.trim()}
          type="submit"
        >
          {saving ? "Adding..." : "+ Add Contact"}
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
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Email</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Phone</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Company ID</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Title</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!organizationId.trim() ? (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    Enter an organization ID to load contacts.
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    Loading contacts...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td className="px-5 py-8 text-center text-gray-500 dark:text-gray-400" colSpan={7}>
                    No contacts found.
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">{getContactName(contact)}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{contact.email || "—"}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{contact.phone || "—"}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{contact.companyId || "—"}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{contact.title || contact.role || "—"}</td>
                    <td className="px-5 py-4">
                      <span
                        className={classNames(
                          "text-xs font-medium px-2.5 py-1 rounded-full",
                          statusStyles[contact.status] ?? statusStyles.active,
                        )}
                      >
                        {contact.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
                        disabled={deletingId === contact.id}
                        onClick={() => void deleteContact(contact.id)}
                        type="button"
                      >
                        {deletingId === contact.id ? "Deleting..." : "Delete"}
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
