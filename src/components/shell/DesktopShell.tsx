"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { StartMenu } from "./StartMenu";
import { TopBar } from "@/components/topbar/TopBar";
import { DesktopArea } from "@/components/desktop/DesktopArea";

export function DesktopShell() {
  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-900">
      <Sidebar onStartClick={() => setIsStartMenuOpen((prev) => !prev)} />
      <div className="flex flex-1 flex-col">
        <TopBar onStartClick={() => setIsStartMenuOpen((prev) => !prev)} />
        <DesktopArea />
      </div>
      {isStartMenuOpen && (
        <StartMenu onClose={() => setIsStartMenuOpen(false)} />
      )}
    </div>
  );
}
