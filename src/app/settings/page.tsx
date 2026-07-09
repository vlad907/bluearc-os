"use client";

import React from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useOrganization } from "@/context/OrganizationContext";
import { useTheme } from "@/context/ThemeContext";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { organizationId, setOrganizationId } = useOrganization();

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Settings"
        description="Manage your account and application preferences."
      />
      <div className="space-y-6 max-w-3xl">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Development Organization</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">
            Temporary tenant selector used by CRUD pages until auth-backed organization resolution is implemented.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Organization ID
              </label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                placeholder="Paste seeded organization UUID"
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
            This value is saved in browser storage and sent as `x-organization-id` by the current API-backed pages.
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
            Use PostgreSQL/Supabase only. The seed script refuses SQLite URLs.
          </p>
          <div className="space-y-2">
            {[
              { command: "cp .env.example .env", desc: "Create local environment config" },
              { command: "npm run db:migrate", desc: "Apply Prisma migration to PostgreSQL" },
              { command: "npm run db:seed", desc: "Seed organization and CRM demo data" },
              { command: "npm run dev", desc: "Run the app and use the seeded organization ID" },
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
