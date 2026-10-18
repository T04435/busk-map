"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MapLegend } from "@/components/map/map-legend";
import { orangeCells } from "@/components/map/taste-cells";
import { Section } from "./repertoire-sections";

const TasteHeatMap = dynamic(() => import("@/components/map/taste-heat-map").then((m) => m.TasteHeatMap), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
});

export type FansMapCity = { id: string; name: string; center: [number, number]; zoom?: number };
export type FansMapCell = { lat: number; lng: number; affinity: number };

/** "Fitzroy", "Fitzroy and Brunswick", "Fitzroy, Brunswick and the CBD". */
function nameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The map box: a fixed-height frame (280px on a phone, 360px from md) that loads MapLibre when it comes near the screen. */
function MapBox({ city, cells, label }: { city: FansMapCity; cells: FansMapCell[] | null; label: string }) {
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
      {cells && near ? <TasteHeatMap center={city.center} zoom={city.zoom} cells={cells} label={label} /> : <Skeleton className="size-full" />}
    </div>
  );
}

/**
 * "Where your fans are" (U24): the act's Qloo taste heatmap on a real city map, drawn by the same MapLibre style, orange taste cells and
 * legend as the plan map. Presentational: DEV passes the city, the heat cells (`null` while loading, `[]` when Qloo has none), the top areas
 * and the busks link. The city switch is the DS select (44px). It shows where the act's taste concentrates, not head counts.
 */
export function FansMap({
  city,
  cities,
  onCityChange,
  cells,
  topAreas,
  planHref,
  busy,
  className,
}: {
  city: FansMapCity;
  cities: { id: string; name: string }[];
  onCityChange: (id: string) => void;
  /** Taste cells, affinity 0 to 1. `null` = loading; `[]` = Qloo has nothing for this city. */
  cells: FansMapCell[] | null;
  /** Up to three area names, strongest first. */
  topAreas: string[];
  /** Where "Plan a busk here" goes (/busks with the city prefilled). Omit to hide the button. */
  planHref?: string;
  /** A city switch is loading. */
  busy?: boolean;
  className?: string;
}) {
  const areas = topAreas.slice(0, 3);
  const empty = cells !== null && orangeCells(cells).length === 0;
  const loading = cells === null || busy;
  return (
    <Section title="Where your fans are" aside={<SourceLogo source="qloo" height={18} className="self-center" />} className={className}>
      <div data-slot="fans-map" aria-busy={loading ? true : undefined} className="flex flex-col gap-4">
        {cities.length > 1 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span id="fans-map-city" className="font-mono text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">
              City
            </span>
            <Select value={city.id} onValueChange={onCityChange} disabled={busy}>
              <SelectTrigger aria-labelledby="fans-map-city" className="min-w-48 flex-1 sm:flex-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {cities.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="flex flex-col">
          <div className={busy ? "opacity-60" : undefined}>
            <MapBox city={city} cells={cells} label={`Map of ${city.name}: where your fans' taste concentrates, from Qloo`} />
          </div>
          {cells && !empty ? <MapLegend top={false} others={false} className="border-x-2 border-b-2" /> : null}
        </div>
        {cells === null ? (
          <p role="status" className="m-0 text-sm leading-5 text-muted-foreground">
            Finding where your fans are in {city.name}.
          </p>
        ) : empty ? (
          <p className="m-0 text-base leading-6 font-medium">
            <span className="text-qloo">Qloo</span> has no taste data for {city.name} yet.
          </p>
        ) : areas.length > 0 ? (
          <p className="m-0 text-base leading-6 font-medium">Your crowd is strongest around {nameList(areas)}.</p>
        ) : null}
        <p className="m-0 font-mono text-xs text-muted-foreground">
          Where your taste concentrates, from <span className="text-qloo">Qloo</span>, not head counts.
        </p>
        {planHref && !empty && cells ? (
          <Button asChild variant="outline" className="min-h-11 self-start">
            <Link href={planHref}>Plan a busk here</Link>
          </Button>
        ) : null}
      </div>
    </Section>
  );
}
