"use client";

import React from "react";
import PageHeader from "@/components/layout/PageHeader";
import { LEADS } from "@/data/mock-data";
import { formatCurrency } from "@/lib/utils";

const stageColors: Record<string, string> = {
  Qualification: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Discovery: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  Proposal: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  Negotiation: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

export default function LeadsPage() {
  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Leads"
        description="Track and manage your sales pipeline."
        action={
          <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            + Add Lead
          </button>
        }
      />
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Deal</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Company</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Stage</th>
                <th className="text-right px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Value</th>
                <th className="text-center px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Probability</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Assigned To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {LEADS.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">{lead.name}</td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{lead.company}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${stageColors[lead.stage] || ""}`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-gray-900 dark:text-white">{formatCurrency(lead.value)}</td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full"
                          style={{ width: `${lead.probability}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{lead.probability}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{lead.assignedTo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
