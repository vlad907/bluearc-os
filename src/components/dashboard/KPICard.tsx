"use client";

import React from "react";
import { KPIData } from "@/types";

const toneStyles = {
  indigo: "from-indigo-500 to-blue-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  emerald: "from-emerald-500 to-green-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "from-amber-500 to-orange-600 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rose: "from-rose-500 to-red-600 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  sky: "from-sky-500 to-cyan-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  violet: "from-violet-500 to-purple-600 bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  slate: "from-slate-500 to-gray-600 bg-slate-50 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300",
};

const icons: Record<string, React.ReactNode> = {
  Building2: <path d="M4 22V4a2 2 0 012-2h12a2 2 0 012 2v18M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01" />,
  Users: <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />,
  TrendingUp: <path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" />,
  DollarSign: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7H14a3.5 3.5 0 010 7H6" />,
  Briefcase: <path d="M10 6V5a2 2 0 012-2h0a2 2 0 012 2v1M3 7h18v13H3zM3 13h18" />,
  CheckSquare: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  Mail: <path d="M3 5h18v14H3zM3 7l9 6 9-6" />,
};

export default function KPICard({ data }: { data: KPIData }) {
  const tone = data.tone ?? "slate";
  const toneClassName = toneStyles[tone];

  return (
    <div className="relative overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-gray-950/50">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${toneClassName.split(" ").slice(0, 2).join(" ")}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{data.label}</span>
          <p className="mt-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{data.value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${toneClassName.split(" ").slice(2).join(" ")}`}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {icons[data.icon] ?? icons.TrendingUp}
          </svg>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        Live from CRM database
      </div>
    </div>
  );
}
