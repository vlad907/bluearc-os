"use client";

import React from "react";
import { KPIData } from "@/types";

export default function KPICard({ data }: { data: KPIData }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 transition-shadow hover:shadow-md dark:hover:shadow-gray-900/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{data.label}</span>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
          data.trend === "up"
            ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        }`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <polyline points={data.trend === "up" ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
          </svg>
          {Math.abs(data.change)}%
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.value}</p>
    </div>
  );
}
