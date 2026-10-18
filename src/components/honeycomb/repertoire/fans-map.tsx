"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapLegend } from "@/components/map/map-legend";
import { orangeCells } from "@/components/map/taste-cells";
import { Section } from "./repertoire-sections";

const TasteHeatMap = dynamic(() => import("@/components/map/taste-heat-map").then((m) => m.TasteHeatMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
});

export type FansMapCell = { lat: number; lng: number; affinity: number };

/** "Melbourne", "Melbourne and Sydney", "Melbourne, Sydney and London". */
function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The map box: a fixed-height frame (280px on a phone, 360px from md) that loads MapLibre when it comes near the screen. */
function MapBox({ cells, label }: { cells: FansMapCell[] | null; label: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = frame.current;
    if (!el || near) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: "300px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, [near]);
  return (
    <div ref={frame} data-slot="fans-map-frame" className="relative h-70 w-full overflow-hidden border-2 border-rule bg-muted md:h-90">
      {cells && near ? <TasteHeatMap cells={cells} label={label} /> : <Skeleton className="size-full" />}
    </div>
  );
}

/**
 * "Where your fans are" (U24): the act's Qloo taste heatmap on a world map (global, not one city: the user's call, 19 Oct), drawn by the
 * same MapLibre style, orange taste cells and legend as the plan map; it frames wherever the cells are. Presentational: DEV passes the
 * cells (`null` while loading, `[]` when Qloo has none), the top places and the busks link. It shows where the act's taste
 * concentrates, not head counts.
 */
export function FansMap({
  cells,
  topAreas,
  planHref,
  className,
}: {
  /** Taste cells worldwide, affinity 0 to 1. `null` = loading; `[]` = Qloo has nothing for this act. */
  cells: FansMapCell[] | null;
  /** Up to three places, strongest first ("Havana", "Miami", "Madrid"). */
  topAreas: string[];
  /** Where "Plan a busk" goes (/busks, prefilled with the top place when Busk Map covers it). Omit to hide the button. */
  planHref?: string;
  className?: string;
}) {
  const areas = topAreas.slice(0, 3);
  const empty = cells !== null && orangeCells(cells).length === 0;
  const loading = cells === null;
  return (
    <Section title="Where your fans are" aside={<SourceLogo source="qloo" height={18} className="self-center" />} className={className}>
      <div data-slot="fans-map" aria-busy={loading ? true : undefined} className="flex flex-col gap-4">
        <div className="flex flex-col">
          <MapBox cells={cells} label="World map: where your fans' taste concentrates, from Qloo" />
          {cells && !empty ? <MapLegend top={false} others={false} className="border-x-2 border-b-2" /> : null}
        </div>
        {cells === null ? (
          <p role="status" className="m-0 text-sm leading-5 text-muted-foreground">
            Finding where your fans are.
          </p>
        ) : empty ? (
          <p className="m-0 text-base leading-6 font-medium">
            <SourceLogo source="qloo" height={14} className="mr-1 align-[-2px]" />
            has no taste data for your act yet.
          </p>
        ) : areas.length > 0 ? (
          <p className="m-0 text-base leading-6 font-medium">Your crowd is strongest in {nameList(areas)}.</p>
        ) : null}
        <p className="m-0 font-mono text-xs text-muted-foreground">
          Where your taste concentrates, from <SourceLogo source="qloo" height={12} className="mx-0.5 align-[-2px]" />, not head counts.
        </p>
        {planHref && !empty && cells ? (
          <Button asChild variant="outline" className="min-h-11 self-start">
            <Link href={planHref}>Plan a busk</Link>
          </Button>
        ) : null}
      </div>
    </Section>
  );
}
