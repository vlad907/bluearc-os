"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import KPICard from "@/components/dashboard/KPICard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import FollowupsDue from "@/components/dashboard/FollowupsDue";
import PipelineOverview from "@/components/dashboard/PipelineOverview";
import UpcomingTasks from "@/components/dashboard/UpcomingTasks";
import { useOrganization } from "@/context/OrganizationContext";
import { Activity, FollowUp, KPIData, PipelineStage, Task } from "@/types";
import { formatCurrency } from "@/lib/utils";

type DashboardPayload = {
  kpis?: KPIData[];
  recentActivity?: Activity[];
  followUps?: FollowUp[];
  pipelineStages?: PipelineStage[];
  upcomingTasks?: Task[];
  error?: string;
};

const emptyPayload = {
  kpis: [] as KPIData[],
  recentActivity: [] as Activity[],
  followUps: [] as FollowUp[],
  pipelineStages: [] as PipelineStage[],
  upcomingTasks: [] as Task[],
};

function getErrorMessage(payload: DashboardPayload, fallback: string) {
  return payload.error ?? fallback;
}

function normalizeKpis(kpis: KPIData[]) {
  return kpis.map((kpi) => ({
    ...kpi,
    value: kpi.id === "pipeline" && typeof kpi.value === "number" ? formatCurrency(kpi.value) : kpi.value,
  }));
}

export default function Dashboard() {
  const { organizationId, setOrganizationId } = useOrganization();
  const [data, setData] = useState(emptyPayload);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const controller = new AbortController();

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/dashboard", {
          headers: { "x-organization-id": organizationId },
          signal: controller.signal,
        });
        const payload = (await response.json()) as DashboardPayload;

        if (!response.ok) {
          throw new Error(getErrorMessage(payload, "Failed to load dashboard"));
        }

        setData({
          kpis: normalizeKpis(payload.kpis ?? []),
          recentActivity: payload.recentActivity ?? [],
          followUps: payload.followUps ?? [],
          pipelineStages: payload.pipelineStages ?? [],
          upcomingTasks: payload.upcomingTasks ?? [],
        });
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, [organizationId]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Live CRM snapshot for the selected organization.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            className="w-full sm:w-80 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg text-gray-900 dark:text-white placeholder:text-gray-400"
            placeholder="Organization ID"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
          />
          <Link
            className="px-4 py-2 text-sm font-medium text-center text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            href="/settings"
          >
            Setup
          </Link>
          <Link
            className="px-4 py-2 text-sm font-medium text-center text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            href="/leads"
          >
            + Add Lead
          </Link>
        </div>
      </div>

      {!organizationId && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white">Select an organization</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Enter the seeded organization ID here or in Settings to load live CRM metrics.
          </p>
        </div>
      )}

      {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
      {loading && <div className="text-sm text-gray-500 dark:text-gray-400">Loading dashboard...</div>}

      {organizationId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
            {data.kpis.map((kpi) => (
              <KPICard key={kpi.id} data={kpi} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentActivity activities={data.recentActivity} />
            <FollowupsDue followUps={data.followUps} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PipelineOverview stages={data.pipelineStages} />
            <UpcomingTasks tasks={data.upcomingTasks} />
          </div>
        </>
      )}
    </div>
  );
}
