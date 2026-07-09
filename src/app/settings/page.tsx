"use client";

import React, { useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { useTheme } from "@/context/ThemeContext";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { organizationId, setOrganizationId } = useOrganization();
  const [workspaceName, setWorkspaceName] = useState("Blue Arc Workspace");
  const [workspaceSlug, setWorkspaceSlug] = useState("blue-arc-workspace");
  const [setupStatus, setSetupStatus] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  async function handleCreateWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!workspaceName.trim()) {
      return;
    }

    setCreatingWorkspace(true);
    setSetupError(null);
    setSetupStatus(null);

    try {
      const response = await fetch("/api/setup/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: workspaceName.trim(),
          slug: workspaceSlug.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as {
        organization?: { id: string; name: string; slug: string };
        error?: string;
      };

      if (!response.ok || !payload.organization) {
        throw new Error(payload.error ?? "Failed to create workspace");
      }

      setOrganizationId(payload.organization.id);
      setSetupStatus(`Created ${payload.organization.name} and selected it for this browser.`);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Failed to create workspace");
    } finally {
      setCreatingWorkspace(false);
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Settings"
        description="Manage your account and application preferences."
      />
      <div className="space-y-6 max-w-3xl">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Workspace Setup</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Create or select the workspace used by the app. This replaces manually hunting for an organization ID during development.
          </p>
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            Before creating a workspace, start PostgreSQL and run migrations: <code>npm run db:dev:up</code> then <code>npm run db:migrate</code>.
          </div>
          <form onSubmit={handleCreateWorkspace} className="mb-5 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Workspace Name
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Workspace Slug
                </label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  value={workspaceSlug}
                  onChange={(event) => setWorkspaceSlug(event.target.value)}
                />
              </div>
              <button
                className="self-end px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!workspaceName.trim() || creatingWorkspace}
                type="submit"
              >
                {creatingWorkspace ? "Creating..." : "Create Workspace"}
              </button>
            </div>
            {setupStatus && <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{setupStatus}</p>}
            {setupError && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{setupError}</p>}
          </form>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Current Workspace ID
              </label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="Created workspace UUID"
                value={organizationId}
                onChange={(event) => setOrganizationId(event.target.value)}
              />
            </div>
            <button
              className="self-end px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              disabled={!organizationId}
              onClick={() => setOrganizationId("")}
            >
              Clear
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
            This is still a temporary development flow. Production signup will create the workspace after authentication and resolve it server-side.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Appearance</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">Customize the look and feel of Blue Arc.</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</p>
              <p className="text-xs text-gray-500 dark:text-gray-500">Switch between light and dark themes.</p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-11 h-6 rounded-full transition-colors ${theme === "dark" ? "bg-indigo-600" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span className={`block w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${theme === "dark" ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Database Setup</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Use PostgreSQL/Supabase only. `file:./dev.db` and SQLite URLs are not supported by the current Prisma adapter.
          </p>
          <div className="space-y-2">
            {[
              { command: "cp .env.example .env", desc: "Create local environment config" },
              { command: "npm run db:dev:up", desc: "Start local PostgreSQL with Docker" },
              { command: "npm run db:migrate", desc: "Apply Prisma migration to PostgreSQL" },
              { command: "npm run db:seed", desc: "Optional: seed demo CRM data" },
              { command: "npm run dev", desc: "Run the app, then create a workspace from this Settings page" },
            ].map((item) => (
              <div key={item.command} className="flex items-center justify-between gap-4 py-2">
                <div>
                  <code className="text-sm text-indigo-600 dark:text-indigo-400">{item.command}</code>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
