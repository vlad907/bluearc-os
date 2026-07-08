"use client";

import React from "react";

interface WindowTitleBarProps {
  title: string;
  onClose: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function WindowTitleBar({ title, onClose, onMouseDown }: WindowTitleBarProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="flex items-center justify-between bg-white/5 px-3 py-2 cursor-grab active:cursor-grabbing select-none"
    >
      <span className="text-sm font-medium text-gray-200 truncate">
        {title}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="flex h-5 w-5 items-center justify-center rounded text-xs text-gray-400 hover:bg-red-500 hover:text-white transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
