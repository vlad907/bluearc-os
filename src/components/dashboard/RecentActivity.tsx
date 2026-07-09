"use client";

import React from "react";
import { Activity } from "@/types";

export default function RecentActivity({ activities }: { activities: Activity[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {activities.length === 0 && (
          <div className="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">No recent activity yet.</div>
        )}
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3 px-5 py-3.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-xs font-medium text-indigo-600 dark:text-indigo-400 shrink-0">
              {activity.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 dark:text-gray-200">
                <span className="font-medium">{activity.description}</span>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                {activity.user} &middot; {activity.timestamp}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
