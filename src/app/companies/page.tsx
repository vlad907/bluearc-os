"use client";

import React from "react";
import PageHeader from "@/components/layout/PageHeader";
import { COMPANIES } from "@/data/mock-data";
import { classNames } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  inactive: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  lead: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function CompaniesPage() {
  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Companies"
        description="Manage your customer and prospect companies."
        action={
          <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            + Add Company
          </button>
        }
      />
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Name</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Industry</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Location</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Contacts</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {COMPANIES.map((company) => (
                <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">{company.name}</td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{company.industry}</td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{company.location}</td>
                  <td className="px-5 py-4">
                    <span className={classNames("text-xs font-medium px-2.5 py-1 rounded-full", statusStyles[company.status])}>
                      {company.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-gray-600 dark:text-gray-400">{company.contacts}</td>
                  <td className="px-5 py-4 text-right font-medium text-gray-900 dark:text-white">{company.revenue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
