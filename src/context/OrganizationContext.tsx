"use client";

import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

const ORGANIZATION_STORAGE_KEY = "bluearc.organizationId";

type OrganizationContextType = {
  organizationId: string;
  setOrganizationId: (organizationId: string) => void;
  sessionLoaded: boolean;
  user: SessionUser | null;
  workspaces: SessionWorkspace[];
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

type SessionUser = {
  id: string;
  email: string;
  name: string;
};

type SessionWorkspace = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  role: string;
};

type SessionPayload = {
  user: SessionUser | null;
  workspaces: SessionWorkspace[];
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
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [workspaces, setWorkspaces] = useState<SessionWorkspace[]>([]);

  async function refreshSession() {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      const payload = await response.json() as SessionPayload;
      const nextWorkspaces = payload.workspaces ?? [];

      setUser(payload.user ?? null);
      setWorkspaces(nextWorkspaces);

      setOrganizationIdState((current) => {
        const currentId = current.trim();

        if (currentId && nextWorkspaces.some((workspace) => workspace.id === currentId)) {
          return currentId;
        }

        return nextWorkspaces[0]?.id ?? currentId;
      });
    } catch {
      setUser(null);
      setWorkspaces([]);
    } finally {
      setSessionLoaded(true);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setWorkspaces([]);
    setOrganizationIdState("");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshSession();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

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
    <OrganizationContext.Provider value={{ organizationId, setOrganizationId, sessionLoaded, user, workspaces, refreshSession, logout }}>
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
