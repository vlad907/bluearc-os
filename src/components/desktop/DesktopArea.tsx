"use client";

import React from "react";
import { DesktopIcon } from "./DesktopIcon";
import { WindowManager } from "@/components/window/WindowManager";
import { MOCK_DESKTOP_ICONS } from "@/data/desktop-icons";

export function DesktopArea() {
  return (
    <div className="relative flex-1 bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden">
      <div className="absolute inset-0 p-4">
        <div className="grid grid-cols-[repeat(auto-fill,100px)] gap-2">
          {MOCK_DESKTOP_ICONS.map((icon) => (
            <DesktopIcon key={icon.id} data={icon} />
          ))}
        </div>
      </div>
      <WindowManager />
    </div>
  );
}
