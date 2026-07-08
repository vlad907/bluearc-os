"use client";

import React, { useState } from "react";
import { DesktopIconData } from "@/types";
import { useWindowManager } from "@/context/WindowContext";

interface DesktopIconProps {
  data: DesktopIconData;
}

export function DesktopIcon({ data }: DesktopIconProps) {
  const { openWindow } = useWindowManager();
  const [selected, setSelected] = useState(false);

  const handleDoubleClick = () => {
    openWindow(data.appId);
  };

  const handleClick = () => {
    setSelected(true);
  };

  const handleBlur = () => {
    setSelected(false);
  };

  return (
    <button
      onDoubleClick={handleDoubleClick}
      onClick={handleClick}
      onBlur={handleBlur}
      className={`flex flex-col items-center justify-center w-24 h-24 rounded-lg p-2 transition-colors ${
        selected ? "bg-white/20" : "hover:bg-white/10"
      }`}
    >
      <span className="text-4xl mb-1">{data.icon}</span>
      <span className="text-xs text-gray-200 text-center leading-tight break-words max-w-full">
        {data.label}
      </span>
    </button>
  );
}
