"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Map as MapIcon } from "lucide-react";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapLegend } from "./map-legend";
import type { PlanMap as PlanMapType } from "./plan-map";

const PlanMap = dynamic(() => import("./plan-map").then((m) => m.PlanMap), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const LABEL = "Map of pitches and Qloo taste affinity";

/**
 * MapLibre is the heaviest thing on the page (about 2 s of main-thread work on a mid-range phone). Load it only when the map
 * area comes near the screen, and when the browser is idle, so the plan itself is interactive first. The pitch list beside it
 * already offers everything the map does. The legend sits under the map on phones and floats over its corner from 768 px; the
 * map pads its framing so the legend never covers a pin.
 */
export function LazyPlanMap({ testData, ...props }: ComponentProps<typeof PlanMapType> & { testData: boolean }) {
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

  return (
    <div data-slot="map-frame" className="relative flex flex-col gap-3 md:block">
      <div className="h-[24rem] md:h-[34rem]">
        {show ? (
          <PlanMap {...props} />
        ) : (
          <div
            ref={placeholder}
            className="bm-hatch-field flex size-full min-h-80 flex-col items-center justify-center gap-4 border-2 border-rule bg-muted p-6 text-center"
            role="region"
            aria-label={LABEL}
          >
            <HexCell size={64} lift>
              <MapIcon aria-hidden="true" className="size-7" />
            </HexCell>
            <div>
              <p className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">Taste map</p>
              <p className="m-0 mt-1 text-sm text-muted-foreground">The map loads when you need it. The pitch list has everything on it.</p>
            </div>
            <Button type="button" variant="outline" onClick={() => setShow(true)}>
              Show the map
            </Button>
          </div>
        )}
      </div>
      <MapLegend testData={testData} className="md:absolute md:bottom-3 md:left-3 md:z-10 md:max-w-[min(26rem,calc(100%-1.5rem))]" />
    </div>
  );
}
