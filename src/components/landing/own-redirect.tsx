"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * `/#own` was the form's address before it moved to /busks. A hash never reaches the server, so the landing page
 * forwards it: `/#own` (and the old `/?again=<id>#own`) land on /busks, keeping `again`.
 */
export function OwnRedirect() {
  const router = useRouter();
  useEffect(() => {
    const forward = () => {
      if (window.location.hash !== "#own") return;
      const again = new URLSearchParams(window.location.search).get("again");
      router.replace(again ? `/busks?${new URLSearchParams({ again })}` : "/busks");
    };
    forward();
    window.addEventListener("hashchange", forward);
    return () => window.removeEventListener("hashchange", forward);
  }, [router]);
  return null;
}
