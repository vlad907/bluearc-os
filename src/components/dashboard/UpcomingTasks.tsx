"use client";

import React from "react";
import { Task } from "@/types";
import { getPriorityColor } from "@/lib/utils";

export default function UpcomingTasks({ tasks }: { tasks: Task[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white">Upcoming Tasks</h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-start gap-3 px-5 py-3.5">
            <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center ${
              task.completed
                ? "bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500"
                : "border-gray-300 dark:border-gray-600"
            }`}>
              {task.completed && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${task.completed ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}>
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500 dark:text-gray-500">{task.dueDate}</span>
                <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
