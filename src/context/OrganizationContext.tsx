"use client";

import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";

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

export function OrganizationProvider({ children }: { children: ReactNode }) {
  // Start empty so the first client render matches the server (no localStorage
  // on the server). The stored workspace is restored in an effect after mount,
  // which avoids a hydration mismatch.
  const [organizationId, setOrganizationIdState] = useState("");
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [workspaces, setWorkspaces] = useState<SessionWorkspace[]>([]);
  const persistReady = useRef(false);

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
      // Restore the persisted workspace after mount (deferred, not during
      // render), so the initial client render matches the server-rendered
      // empty state and hydration doesn't mismatch.
      const stored = window.localStorage.getItem(ORGANIZATION_STORAGE_KEY);
      if (stored) {
        setOrganizationIdState(stored);
      }

      void refreshSession();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Skip the first run so restoring from storage doesn't immediately clear it.
    if (!persistReady.current) {
      persistReady.current = true;
      return;
    }

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
