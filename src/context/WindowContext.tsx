"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { WindowInstance, WindowContextType } from "@/types";
import { generateId } from "@/lib/utils";
import { MOCK_APPS } from "@/data/apps";

const WindowContext = createContext<WindowContextType | undefined>(undefined);

let globalZIndexCounter = 10;

export function WindowProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);

  const openWindow = useCallback((appId: string) => {
    const app = MOCK_APPS.find((a) => a.id === appId);
    if (!app) return;

    const newWindow: WindowInstance = {
      id: generateId(),
      appId: app.id,
      title: app.name,
      position: {
        x: 80 + (windows.length % 5) * 40,
        y: 40 + (windows.length % 5) * 30,
      },
      size: { width: 600, height: 400 },
      zIndex: ++globalZIndexCounter,
      isMinimized: false,
    };

    setWindows((prev) => [...prev, newWindow]);
    setFocusedWindowId(newWindow.id);
  }, [windows.length]);

  const closeWindow = useCallback((windowId: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== windowId));
    setFocusedWindowId((prev) => (prev === windowId ? null : prev));
  }, []);

  const focusWindow = useCallback((windowId: string) => {
    globalZIndexCounter++;
    setWindows((prev) =>
      prev.map((w) =>
        w.id === windowId ? { ...w, zIndex: globalZIndexCounter } : w
      )
    );
    setFocusedWindowId(windowId);
  }, []);

  const moveWindow = useCallback(
    (windowId: string, pos: { x: number; y: number }) => {
      setWindows((prev) =>
        prev.map((w) => (w.id === windowId ? { ...w, position: pos } : w))
      );
    },
    []
  );

  return (
    <WindowContext.Provider
      value={{
        windows,
        focusedWindowId,
        openWindow,
        closeWindow,
        focusWindow,
        moveWindow,
      }}
    >
      {children}
    </WindowContext.Provider>
  );
}

export function useWindowManager() {
  const context = useContext(WindowContext);
  if (!context) {
    throw new Error("useWindowManager must be used within a WindowProvider");
  }
  return context;
}
