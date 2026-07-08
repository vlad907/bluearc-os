"use client";

import React from "react";
import PageHeader from "@/components/layout/PageHeader";
import { TASKS_LIST } from "@/data/mock-data";
import { getPriorityColor } from "@/lib/utils";

export default function TasksPage() {
  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        title="Tasks"
        description="Track your tasks and to-dos."
        action={
          <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
            + New Task
          </button>
        }
      />
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                <th className="w-12 px-5 py-3.5" />
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Title</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Due Date</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Priority</th>
                <th className="text-left px-5 py-3.5 font-semibold text-gray-900 dark:text-white">Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {TASKS_LIST.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
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
                  </td>
                  <td className={`px-5 py-4 ${task.completed ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-900 dark:text-white"}`}>
                    {task.title}
                  </td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{task.dueDate}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-600 dark:text-gray-400">{task.assignee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
