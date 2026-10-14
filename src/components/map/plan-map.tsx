"use client";

import { useEffect, useRef } from "react";
import { getVersion, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Plan } from "@/lib/plan-schema";

/**
 * MapLibre map with OpenFreeMap tiles: the taste grid as a GeoJSON layer and
 * the top pitches as focusable pins. Colours come from the theme's CSS
 * variables, so the design pass can restyle it without touching this file.
 * The pitch list next to the map is the keyboard-first alternative.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Copied into public/ by scripts/copy-maplibre-worker.mjs (predev, prebuild).
setWorkerUrl(`/vendor/maplibre-gl-worker-${getVersion()}.mjs`);

/**
 * Resolve a CSS variable to an rgb() colour MapLibre understands (it parses
 * neither oklch nor lab), by painting one pixel and reading it back.
 */
function themeColor(variable: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!value || !ctx) return fallback;
  ctx.fillStyle = fallback;
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

type Props = {
  plan: Pick<Plan, "tasteCells" | "pitches" | "others">;
  center: { lat: number; lon: number };
  selectedId: string | null;
  onSelect: (pitchId: string) => void;
};

export function PlanMap({ plan, center, selectedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const instance = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      center: [center.lon, center.lat],
      zoom: 13.4,
      attributionControl: { compact: true },
    });
    instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
    };
  }, [center.lat, center.lon]);

  // Taste grid layer.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const data = {
      type: "FeatureCollection" as const,
      features: plan.tasteCells.map((c) => ({
        type: "Feature" as const,
        properties: { affinity: c.affinity },
        geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] },
      })),
    };
    const apply = () => {
      const source = instance.getSource("taste") as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }
      instance.addSource("taste", { type: "geojson", data });
      instance.addLayer({
        id: "taste",
        type: "circle",
        source: "taste",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 8, 15, 40],
          "circle-color": themeColor("--chart-3", "#555555"),
          "circle-opacity": ["*", 0.45, ["get", "affinity"]],
          "circle-blur": 0.6,
        },
      });
    };
    if (instance.isStyleLoaded()) apply();
    else instance.once("load", apply);
  }, [plan.tasteCells]);

  // Pitch pins: real buttons, so they are reachable by keyboard and screen readers.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    for (const marker of markers.current) marker.remove();
    markers.current = [];
    const pins = [
      ...plan.pitches.map((p, i) => ({ id: p.id, name: p.name, score: p.score, lat: p.lat, lon: p.lon, rank: i + 1 })),
      ...plan.others.slice(0, 15).map((p) => ({ ...p, rank: null as number | null })),
    ];
    for (const pin of pins) {
      const el = document.createElement("button");
      el.type = "button";
      el.dataset.pitchId = pin.id;
      el.setAttribute("aria-label", `${pin.rank ? `Pitch ${pin.rank}: ` : "Other pitch: "}${pin.name}, score ${pin.score}`);
      el.textContent = pin.rank ? String(pin.rank) : "";
      el.className = pin.rank
        ? "flex size-7 items-center justify-center rounded-full border-2 border-background bg-primary text-xs font-semibold text-primary-foreground shadow focus-visible:ring-2 focus-visible:ring-ring"
        : "size-3 rounded-full border border-background bg-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring";
      el.addEventListener("click", () => onSelectRef.current(pin.id));
      markers.current.push(new Marker({ element: el }).setLngLat([pin.lon, pin.lat]).addTo(instance));
    }
  }, [plan.pitches, plan.others]);

  // Selection: highlight and fly to the pitch.
  useEffect(() => {
    const instance = map.current;
    for (const marker of markers.current) {
      const el = marker.getElement();
      const selected = el.dataset.pitchId === selectedId;
      el.setAttribute("aria-pressed", String(selected));
      el.classList.toggle("ring-2", selected);
      el.classList.toggle("ring-ring", selected);
    }
    const target = [...plan.pitches, ...plan.others].find((p) => p.id === selectedId);
    if (instance && target) instance.easeTo({ center: [target.lon, target.lat], duration: 600 });
  }, [selectedId, plan.pitches, plan.others]);

  return <div ref={container} className="h-full min-h-80 w-full overflow-hidden rounded-lg border" role="region" aria-label="Map of pitches and taste affinity" />;
}
