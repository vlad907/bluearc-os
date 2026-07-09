"use client";

import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

const ORGANIZATION_STORAGE_KEY = "bluearc.organizationId";

type OrganizationContextType = {
  organizationId: string;
  setOrganizationId: (organizationId: string) => void;
};

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

function getInitialOrganizationId() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(ORGANIZATION_STORAGE_KEY) ?? "";
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizationId, setOrganizationIdState] = useState(getInitialOrganizationId);

  useEffect(() => {
    if (organizationId) {
      window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
    } else {
      window.localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
    }
  }, [organizationId]);

  function setOrganizationId(nextOrganizationId: string) {
    setOrganizationIdState(nextOrganizationId.trim());
  }

  return (
    <OrganizationContext.Provider value={{ organizationId, setOrganizationId }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }

  return context;
}
