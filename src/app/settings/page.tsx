"use client";

import React from "react";
import PageHeader from "@/components/layout/PageHeader";
import { useTheme } from "@/context/ThemeContext";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Settings"
        description="Manage your account and application preferences."
      />
      <div className="space-y-6 max-w-2xl">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Profile</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">Your personal information and avatar.</p>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-medium">VA</div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Vlad A.</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">vlad@bluearc.io</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
              <input type="text" defaultValue="Vlad A." className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
              <input type="email" defaultValue="vlad@bluearc.io" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
            </div>
          </div>
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
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Notifications</h3>
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">Configure your notification preferences.</p>
          <div className="space-y-3">
            {[
              { label: "Email notifications", desc: "Receive email updates about your activity" },
              { label: "Pipeline updates", desc: "Get notified when deals change stage" },
              { label: "Task reminders", desc: "Daily reminders for overdue tasks" },
              { label: "Weekly digest", desc: "Weekly summary of your CRM activity" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-1">
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">{item.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">{item.desc}</p>
                </div>
                <div className="w-9 h-5 bg-indigo-600 rounded-full relative cursor-pointer">
                  <span className="block w-3.5 h-3.5 bg-white rounded-full shadow-sm absolute top-0.5 right-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            Save Changes
          </button>
          <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
