"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import { Skeleton } from "@/components/ui/skeleton";
import { MapLegend } from "@/components/map/map-legend";
import { orangeCells } from "@/components/map/taste-cells";
import { Section } from "./repertoire-sections";

const TasteHeatMap = dynamic(() => import("@/components/map/taste-heat-map").then((m) => m.TasteHeatMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
});

export type FansMapCell = { lat: number; lng: number; affinity: number };

/** A top city: named on the map at every zoom. `affinity` 0 to 1. */
export type FansMapCity = { name: string; lat: number; lng: number; affinity: number };

/** The map box: a fixed-height frame (280px on a phone, 360px from md, 480px from lg: it has the full row now) that loads MapLibre when it comes near the screen. */
function MapBox({ cells, cities, label }: { cells: FansMapCell[] | null; cities?: FansMapCity[]; label: string }) {
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
    <div ref={frame} data-slot="fans-map-frame" className="relative h-70 w-full overflow-hidden border-2 border-rule bg-muted md:h-90 lg:h-120">
      {cells && near ? <TasteHeatMap cells={cells} cities={cities} label={label} /> : <Skeleton className="size-full" />}
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
  cities,
  className,
}: {
  /** Taste cells worldwide, affinity 0 to 1. `null` = loading; `[]` = Qloo has nothing for this act. */
  cells: FansMapCell[] | null;
  /** The top cities (strongest first, the same ones the step names): each is a labelled hex marker at every zoom, and the map frames them (U40). Cells draw at their true, city size. */
  cities?: FansMapCity[];
  className?: string;
}) {
  const empty = cells !== null && orangeCells(cells).length === 0;
  const loading = cells === null;
  return (
    <Section title="Where your fans are" aside={<SourceLogo source="qloo" height={18} className="self-center" />} className={className}>
      <div data-slot="fans-map" aria-busy={loading ? true : undefined} className="flex flex-col gap-4">
        <div className="flex flex-col">
          <MapBox cells={cells} cities={cities} label="World map: where your fans' taste concentrates, from Qloo" />
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
        ) : null}
      </div>
    </Section>
  );
}
