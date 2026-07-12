"use client";

import { useState } from "react";

export function currentHighlightedRecordId() {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get("highlight");
}

export function useHighlightedRecordId() {
  const [highlightedId] = useState(currentHighlightedRecordId);
  return highlightedId;
}

export function highlightedRecordClass(recordId: string, highlightedId: string | null) {
  return recordId === highlightedId
    ? "bg-indigo-50 ring-2 ring-inset ring-indigo-300 dark:bg-indigo-950/30 dark:ring-indigo-700"
    : "";
}
