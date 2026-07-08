"use client";

import React from "react";
import KPICard from "@/components/dashboard/KPICard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import FollowupsDue from "@/components/dashboard/FollowupsDue";
import PipelineOverview from "@/components/dashboard/PipelineOverview";
import UpcomingTasks from "@/components/dashboard/UpcomingTasks";
import {
  KPI_DATA,
  RECENT_ACTIVITIES,
  FOLLOW_UPS,
  PIPELINE_STAGES,
  UPCOMING_TASKS,
} from "@/data/mock-data";

export default function Dashboard() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Welcome back. Here&apos;s what&apos;s happening with your business.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Export
          </button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            + Add Lead
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {KPI_DATA.map((kpi) => (
          <KPICard key={kpi.id} data={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentActivity activities={RECENT_ACTIVITIES} />
        <FollowupsDue followUps={FOLLOW_UPS} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PipelineOverview stages={PIPELINE_STAGES} />
        <UpcomingTasks tasks={UPCOMING_TASKS} />
      </div>
    </div>
  );
}
