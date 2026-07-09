"use client";

import React, { ReactNode } from "react";
import { OrganizationProvider } from "@/context/OrganizationContext";
import { ThemeProvider } from "@/context/ThemeContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <OrganizationProvider>
        {children}
      </OrganizationProvider>
    </ThemeProvider>
  );
}
