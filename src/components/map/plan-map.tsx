"use client";

import { useEffect, useRef } from "react";
import { getVersion, LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { geohashBounds } from "@/lib/geo";
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
  const frame = useRef<LngLatBounds | null>(null);
  const interacted = useRef(false);

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
    // Start with the attribution collapsed to its (i) button, so it doesn't cover the pins on phones.
    instance.once("load", () => {
      const attrib = container.current?.querySelector(".maplibregl-ctrl-attrib");
      attrib?.classList.remove("maplibregl-compact-show");
      attrib?.removeAttribute("open");
    });
    // The container can change size after the map is created (layout, fonts,
    // the viewport): keep the canvas filling it.
    const observer = new ResizeObserver(() => {
      instance.resize();
      // Keep the top pitches framed until the visitor moves the map themselves.
      if (frame.current && !interacted.current) instance.fitBounds(frame.current, { padding: 70, maxZoom: 15, duration: 0 });
    });
    for (const event of ["dragstart", "wheel", "touchstart"] as const) instance.on(event, () => (interacted.current = true));
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, [center.lat, center.lon]);

  // Taste grid layer: Qloo heatmap cells drawn as their geohash rectangles,
  // shaded by affinity relative to the performer's best cell.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const data = {
      type: "FeatureCollection" as const,
      features: plan.tasteCells.map((c) => {
        if (c.geohash) {
          const b = geohashBounds(c.geohash);
          return {
            type: "Feature" as const,
            properties: { affinity: c.affinity },
            geometry: { type: "Polygon" as const, coordinates: [[[b.west, b.south], [b.east, b.south], [b.east, b.north], [b.west, b.north], [b.west, b.south]]] },
          };
        }
        const d = 0.0015;
        return {
          type: "Feature" as const,
          properties: { affinity: c.affinity },
          geometry: { type: "Polygon" as const, coordinates: [[[c.lon - d, c.lat - d], [c.lon + d, c.lat - d], [c.lon + d, c.lat + d], [c.lon - d, c.lat + d], [c.lon - d, c.lat - d]]] },
        };
      }),
    };
    const apply = () => {
      const source = instance.getSource("taste") as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        return;
      }
      const color = themeColor("--foreground", "#111111");
      instance.addSource("taste", { type: "geojson", data });
      instance.addLayer({
        id: "taste",
        type: "fill",
        source: "taste",
        paint: {
          "fill-color": color,
          // Weak cells fade out so the strong areas read at a glance.
          "fill-opacity": ["interpolate", ["linear"], ["get", "affinity"], 0, 0, 0.5, 0.04, 1, 0.42],
        },
      });
      instance.addLayer({
        id: "taste-outline",
        type: "line",
        source: "taste",
        paint: { "line-color": color, "line-opacity": 0.12, "line-width": 1 },
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
      ...plan.pitches.map((p, i) => ({ id: p.id, name: p.name, score: p.score, lat: p.lat, lon: p.lon, rank: i + 1, discovery: p.discovery })),
      ...plan.others.slice(0, 15).map((p) => ({ ...p, rank: null as number | null })),
    ];
    for (const pin of pins) {
      const el = document.createElement("button");
      el.type = "button";
      el.dataset.pitchId = pin.id;
      const gem = pin.discovery === "hidden-gem" ? ", hidden gem" : pin.discovery === "usual" ? ", usual spot" : "";
      el.setAttribute("aria-label", `${pin.rank ? `Pitch ${pin.rank}: ` : "Other pitch: "}${pin.name}, score ${pin.score}${gem}`);
      const diamond = pin.rank !== null && pin.discovery === "hidden-gem";
      if (diamond) {
        // Rotate a child, never the marker itself: MapLibre positions the marker with its transform.
        const shape = document.createElement("span");
        shape.setAttribute("aria-hidden", "true");
        shape.className = "absolute inset-0.5 rotate-45 rounded-sm border-2 border-background bg-primary shadow";
        el.appendChild(shape);
      }
      if (pin.rank) {
        const label = document.createElement("span");
        label.className = "relative";
        label.textContent = String(pin.rank);
        el.appendChild(label);
      }
      el.className = pin.rank
        ? `flex size-7 items-center justify-center text-xs font-semibold text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring ${diamond ? "" : "rounded-full border-2 border-background bg-primary shadow"}`
        : "size-3 rounded-full border border-background bg-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring";
      el.addEventListener("click", () => onSelectRef.current(pin.id));
      markers.current.push(new Marker({ element: el }).setLngLat([pin.lon, pin.lat]).addTo(instance));
    }
    // Frame the top pitches, with room around them.
    if (plan.pitches.length > 0) {
      const bounds = new LngLatBounds();
      for (const p of plan.pitches) bounds.extend([p.lon, p.lat]);
      frame.current = bounds;
      interacted.current = false;
      instance.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 0 });
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
    // Only pan when the selected pin is out of view: the first view is framed on the top pitches.
    const target = [...plan.pitches, ...plan.others].find((p) => p.id === selectedId);
    if (instance && target && !instance.getBounds().contains([target.lon, target.lat])) {
      instance.easeTo({ center: [target.lon, target.lat], duration: 600 });
    }
  }, [selectedId, plan.pitches, plan.others]);

  return <div ref={container} className="h-full min-h-80 w-full overflow-hidden rounded-lg border" role="region" aria-label="Map of pitches and Qloo taste affinity" />;
}

