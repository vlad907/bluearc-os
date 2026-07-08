"use client";

import React from "react";
import PageHeader from "@/components/layout/PageHeader";
import { JOBS } from "@/data/mock-data";
import { classNames } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  open: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const typeStyles: Record<string, string> = {
  "full-time": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "part-time": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  contract: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  remote: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
};

export default function JobsPage() {
  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Jobs"
        description="Manage job listings and track applicants."
        action={
          <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            + Post Job
          </button>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {JOBS.map((job) => (
          <div key={job.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">{job.title}</h3>
              <span className={classNames("text-xs font-medium px-2.5 py-1 rounded-full", statusStyles[job.status])}>
                {job.status}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-3">{job.company}</p>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500 mb-4">
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                {job.location}
              </span>
              <span className={classNames("text-xs font-medium px-2 py-0.5 rounded-full", typeStyles[job.type])}>
                {job.type}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">{job.applicants}</span> applicants
              </span>
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
