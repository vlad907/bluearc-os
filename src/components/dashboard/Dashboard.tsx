"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import KPICard from "@/components/dashboard/KPICard";
import RecentActivity from "@/components/dashboard/RecentActivity";
import FollowupsDue from "@/components/dashboard/FollowupsDue";
import PipelineOverview from "@/components/dashboard/PipelineOverview";
import UpcomingTasks from "@/components/dashboard/UpcomingTasks";
import { useOrganization } from "@/context/OrganizationContext";
import { Activity, DashboardInsight, FollowUp, KPIData, PipelineStage, Task } from "@/types";
import { formatCurrency } from "@/lib/utils";

type DashboardPayload = {
  kpis?: KPIData[];
  recentActivity?: Activity[];
  followUps?: FollowUp[];
  pipelineStages?: PipelineStage[];
  upcomingTasks?: Task[];
  insights?: DashboardInsight[];
  error?: string;
};

const emptyPayload = {
  kpis: [] as KPIData[],
  recentActivity: [] as Activity[],
  followUps: [] as FollowUp[],
  pipelineStages: [] as PipelineStage[],
  upcomingTasks: [] as Task[],
  insights: [] as DashboardInsight[],
};

const insightStyles: Record<DashboardInsight["severity"], string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300",
  critical: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300",
  neutral: "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300",
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
          insights: payload.insights ?? [],
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
      <div className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-900 p-6 lg:p-8 shadow-xl">
        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-indigo-100">
              Blue Arc OS Command Center
            </div>
            <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-white lg:text-4xl">
              Live CRM operating view
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-indigo-100/80">
              Watch pipeline, field work, outreach, and follow-ups from one tenant-scoped dashboard.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              className="w-full sm:w-80 px-3 py-2 text-sm bg-white/10 border border-white/15 rounded-lg text-white placeholder:text-indigo-100/50 outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Workspace ID"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
            />
            <Link
              className="px-4 py-2 text-sm font-medium text-center text-white bg-white/10 border border-white/15 rounded-lg hover:bg-white/15 transition-colors"
              href="/settings"
            >
              Setup
            </Link>
            <Link
              className="px-4 py-2 text-sm font-medium text-center text-white bg-indigo-500 rounded-lg hover:bg-indigo-400 transition-colors"
              href="/leads"
            >
              + Add Lead
            </Link>
          </div>
        </div>
      </div>

      {!organizationId && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white">Create or select a workspace</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            A fresh user should start in Settings, create a workspace, and the app will select it automatically.
          </p>
          <Link
            className="mt-4 inline-flex px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
            href="/settings"
          >
            Open Workspace Setup
          </Link>
        </div>
      )}

      {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
      {loading && <div className="text-sm text-gray-500 dark:text-gray-400">Loading dashboard...</div>}

      {organizationId && (
        <>
          {data.insights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {data.insights.map((insight) => (
                <Link
                  className={`rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md ${insightStyles[insight.severity]}`}
                  href={insight.href}
                  key={insight.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{insight.label}</p>
                      <p className="mt-2 text-3xl font-bold">{insight.value}</p>
                    </div>
                    <span className="rounded-full bg-white/50 px-2 py-1 text-xs font-semibold dark:bg-black/20">
                      Open
                    </span>
                  </div>
                  <p className="mt-3 text-sm opacity-80">{insight.description}</p>
                </Link>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
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
