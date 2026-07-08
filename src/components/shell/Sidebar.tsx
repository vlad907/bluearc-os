"use client";

import React from "react";
import { useAppRegistry } from "@/context/AppRegistryContext";
import { useWindowManager } from "@/context/WindowContext";

interface SidebarProps {
  onStartClick: () => void;
}

export function Sidebar({ onStartClick }: SidebarProps) {
  const { apps } = useAppRegistry();
  const { openWindow } = useWindowManager();

  return (
    <aside className="flex w-16 flex-col items-center justify-between bg-gray-900/80 backdrop-blur border-r border-white/10 py-3">
      <div className="flex flex-col items-center gap-2">
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => openWindow(app.id)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-xl hover:bg-white/10 transition-colors"
            title={app.name}
          >
            {app.icon}
          </button>
        ))}
      </div>
      <button
        onClick={onStartClick}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-lg hover:bg-white/10 transition-colors"
        title="Start"
      >
        🪟
      </button>
    </aside>
  );
}
