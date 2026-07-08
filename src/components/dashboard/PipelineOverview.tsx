"use client";

import React from "react";
import { PipelineStage } from "@/types";
import { formatCurrency } from "@/lib/utils";

export default function PipelineOverview({ stages }: { stages: PipelineStage[] }) {
  const total = stages.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white">Pipeline Overview</h3>
      </div>
      <div className="px-5 py-4 space-y-4">
        {stages.map((stage) => (
          <div key={stage.id}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                <span className="text-sm text-gray-700 dark:text-gray-300">{stage.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(stage.value)}</span>
                <span className="text-xs text-gray-500 dark:text-gray-500">{stage.count} deals</span>
              </div>
            </div>
            <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
              <div
                className={`${stage.color} h-2 rounded-full transition-all`}
                style={{ width: `${(stage.value / total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
