"use client";

import React from "react";

export function SystemTray() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-4 w-4 rounded-full bg-gray-600" title="Network" />
      <div className="h-4 w-4 rounded-full bg-gray-600" title="Sound" />
      <div className="h-4 w-4 rounded-full bg-gray-600" title="Battery" />
    </div>
  );
}
