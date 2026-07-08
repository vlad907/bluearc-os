"use client";

import React from "react";
import { useWindowManager } from "@/context/WindowContext";
import { Window } from "./Window";

export function WindowManager() {
  const { windows } = useWindowManager();

  return (
    <>
      {windows.map((win) => (
        <Window key={win.id} instance={win} />
      ))}
    </>
  );
}
