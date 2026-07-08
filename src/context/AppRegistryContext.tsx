"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { App } from "@/types";
import { MOCK_APPS } from "@/data/apps";

interface AppRegistryContextType {
  apps: App[];
  getApp: (id: string) => App | undefined;
}

const AppRegistryContext = createContext<AppRegistryContextType | undefined>(
  undefined
);

export function AppRegistryProvider({ children }: { children: ReactNode }) {
  const getApp = (id: string) => MOCK_APPS.find((app) => app.id === id);

  return (
    <AppRegistryContext.Provider value={{ apps: MOCK_APPS, getApp }}>
      {children}
    </AppRegistryContext.Provider>
  );
}

export function useAppRegistry() {
  const context = useContext(AppRegistryContext);
  if (!context) {
    throw new Error("useAppRegistry must be used within an AppRegistryProvider");
  }
  return context;
}
