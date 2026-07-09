"use client";

import React from "react";
import { FollowUp } from "@/types";
import { getPriorityBadge } from "@/lib/utils";

export default function FollowupsDue({ followUps }: { followUps: FollowUp[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white">Follow-ups Due</h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {followUps.length === 0 && (
          <div className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">No dated follow-ups yet.</div>
        )}
        {followUps.map((fu) => (
          <div key={fu.id} className="flex items-center justify-between px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{fu.contact}</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{fu.company}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 dark:text-gray-500">{fu.dueDate}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getPriorityBadge(fu.priority)}`}>
                {fu.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
