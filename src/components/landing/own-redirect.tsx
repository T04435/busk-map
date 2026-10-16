"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * `/#own` was the form's address before it moved to /busks. A hash never reaches the server, so the landing page
 * forwards it: `/#own`, `/?again=<id>#own` and `/?again=<id>` (dev/core's old "Plan again" links) land on /busks, keeping `again`
 * (and `permit`).
 */
export function OwnRedirect() {
  const router = useRouter();
  useEffect(() => {
    const forward = () => {
      const query = new URLSearchParams(window.location.search);
      const again = query.get("again");
      if (window.location.hash !== "#own" && !again) return;
      const permit = query.get("permit");
      router.replace(again ? `/busks?${new URLSearchParams({ again, ...(permit ? { permit } : {}) })}` : "/busks");
    };
    forward();
    window.addEventListener("hashchange", forward);
    return () => window.removeEventListener("hashchange", forward);
  }, [router]);
  return null;
}
