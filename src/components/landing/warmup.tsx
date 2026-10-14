"use client";

import { useEffect } from "react";

/** Ask the server to prepare the example plans while the visitor reads the landing page. */
export function Warmup() {
  useEffect(() => {
    const id = window.setTimeout(() => {
      void fetch("/api/warm", { method: "POST", keepalive: true }).catch(() => {});
    }, 300);
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
