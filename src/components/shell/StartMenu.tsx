"use client";

import React, { useEffect, useRef } from "react";
import { useAppRegistry } from "@/context/AppRegistryContext";
import { useWindowManager } from "@/context/WindowContext";

interface StartMenuProps {
  onClose: () => void;
}

export function StartMenu({ onClose }: StartMenuProps) {
  const { apps } = useAppRegistry();
  const { openWindow } = useWindowManager();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleAppClick = (appId: string) => {
    openWindow(appId);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed bottom-16 left-4 z-50 w-64 rounded-lg border border-white/10 bg-gray-900/95 backdrop-blur-lg p-3 shadow-2xl"
    >
      <h2 className="mb-2 px-2 text-sm font-semibold text-gray-400 uppercase tracking-wide">
        Apps
      </h2>
      <div className="flex flex-col gap-1">
        {apps.map((app) => (
          <button
            key={app.id}
            onClick={() => handleAppClick(app.id)}
            className="flex items-center gap-3 rounded-md px-2 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors"
          >
            <span className="text-lg">{app.icon}</span>
            <span>{app.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
