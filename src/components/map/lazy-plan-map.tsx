"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlanMap as PlanMapType } from "./plan-map";

const PlanMap = dynamic(() => import("./plan-map").then((m) => m.PlanMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const LABEL = "Map of pitches and Qloo taste affinity";

/**
 * MapLibre is the heaviest thing on the page (about 2 s of main-thread work on
 * a mid-range phone). Load it only when the map area comes near the screen,
 * and when the browser is idle, so the plan itself is interactive first.
 * The pitch list beside it already offers everything the map does.
 */
export function LazyPlanMap(props: ComponentProps<typeof PlanMapType>) {
  const placeholder = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = placeholder.current;
    if (!el || show) return;
    let idle: number | null = null;
    const start = () => {
      const ric = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 200));
      idle = ric(() => setShow(true), { timeout: 1500 });
    };
    if (!("IntersectionObserver" in window)) {
      start();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          start();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (idle !== null) (window.cancelIdleCallback ?? window.clearTimeout)(idle);
    };
  }, [show]);

  if (show) return <PlanMap {...props} />;
  return (
    <div ref={placeholder} className="flex h-full min-h-80 w-full items-center justify-center rounded-lg border bg-muted/40" role="region" aria-label={LABEL}>
      <button type="button" className="rounded-md border bg-background px-3 py-1.5 text-sm underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" onClick={() => setShow(true)}>
        Show the map
      </button>
    </div>
  );
}
