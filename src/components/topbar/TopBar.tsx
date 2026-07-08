"use client";

import React from "react";
import { Clock } from "./Clock";
import { SystemTray } from "./SystemTray";

interface TopBarProps {
  onStartClick: () => void;
}

export function TopBar({ onStartClick }: TopBarProps) {
  return (
    <header className="flex h-10 items-center justify-between bg-gray-900/80 backdrop-blur border-b border-white/10 px-3">
      <button
        onClick={onStartClick}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-300 hover:bg-white/10 transition-colors"
      >
        <span className="text-base">🪟</span>
        <span className="font-medium">Start</span>
      </button>
      <div className="flex items-center gap-3">
        <SystemTray />
        <Clock />
      </div>
    </header>
  );
}
