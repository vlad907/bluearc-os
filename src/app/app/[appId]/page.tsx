"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useAppRegistry } from "@/context/AppRegistryContext";

export default function AppPage() {
  const params = useParams();
  const appId = params.appId as string;
  const { getApp } = useAppRegistry();
  const app = getApp(appId);

  if (!app) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <h1 className="text-4xl mb-4">❓</h1>
          <h2 className="text-xl text-gray-300 font-medium mb-2">
            App not found
          </h2>
          <p className="text-gray-500">
            No app with ID &quot;{appId}&quot; exists.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      <header className="flex items-center gap-3 border-b border-white/10 bg-gray-900/80 backdrop-blur px-4 py-3">
        <span className="text-2xl">{app.icon}</span>
        <h1 className="text-lg font-semibold text-gray-100">{app.name}</h1>
      </header>
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <span className="text-6xl mb-4 block">{app.icon}</span>
          <p className="text-gray-400">{app.description}</p>
          <p className="mt-2 text-sm text-gray-600">
            Full-screen app view for &quot;{app.name}&quot;
          </p>
        </div>
      </main>
    </div>
  );
}
