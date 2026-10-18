"use client";

import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MapLibreMap, NavigationControl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { STYLE_URL, baseStyle, fillExpression, hexagon, rampColors, whenStyle } from "@/components/map/map-shared";
import { MAP_FRAME, MAP_GESTURES, orangeCells } from "@/components/map/taste-cells";

export type HeatCell = { lat: number; lng: number; affinity: number };

const FALLBACK_HALF = 0.0015;

/**
 * Half the width of one cell. Qloo's heatmap points are not an exact lattice, so the closest pair is often far closer than the
 * real spacing (that drew dots, not a heatmap, on the live check). The median of each point's nearest-neighbour distance is the
 * typical spacing: one hex width.
 */
function halfWidth(cells: readonly HeatCell[]): number {
  const pts = cells.slice(0, 400);
  const nearest: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const k = Math.cos((pts[i].lat * Math.PI) / 180) || 1;
    let best = Infinity;
    for (let j = 0; j < pts.length; j++) {
      if (i === j) continue;
      const d = Math.hypot(pts[i].lng - pts[j].lng, (pts[i].lat - pts[j].lat) / k);
      if (d > 1e-6 && d < best) best = d;
    }
    if (Number.isFinite(best)) nearest.push(best);
  }
  if (nearest.length === 0) return FALLBACK_HALF;
  nearest.sort((x, y) => x - y);
  return Math.min(nearest[Math.floor(nearest.length / 2)] / 2, 0.02);
}

/**
 * The bare taste map: MapLibre on the plan's OpenFreeMap style (the plain land base when the tiles cannot load) with only the orange
 * honeycomb cells of the taste ramp drawn over it, as on the plan map. No pins. Cooperative gestures, so one finger scrolls the page.
 * Frames the cells, or the city centre when there are none. Share: map-shared.ts and taste-cells.ts hold what PlanMap also uses.
 */
export function TasteHeatMap({ center, zoom = 12, cells, label }: { center: [number, number]; zoom?: number; cells: readonly HeatCell[]; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const bounds = useRef<LngLatBounds | null>(null);
  const [themeTick, setThemeTick] = useState(0);
  const lng = center[0];
  const lat = center[1];

  useEffect(() => {
    if (!container.current) return;
    const instance = new MapLibreMap({ container: container.current, style: STYLE_URL, center: [lng, lat], zoom, attributionControl: { compact: true }, ...MAP_GESTURES });
    instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.current = instance;
    let fellBack = false;
    instance.on("error", () => {
      if (fellBack || instance.isStyleLoaded()) return;
      fellBack = true;
      instance.setStyle(baseStyle());
    });
    instance.once("load", () => {
      const attrib = container.current?.querySelector(".maplibregl-ctrl-attrib");
      attrib?.classList.remove("maplibregl-compact-show");
      attrib?.removeAttribute("open");
    });
    const observer = new ResizeObserver(() => {
      instance.resize();
      if (bounds.current) instance.fitBounds(bounds.current, { padding: MAP_FRAME.padding / 2, maxZoom: MAP_FRAME.maxZoom, duration: 0 });
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, [lng, lat, zoom]);

  useEffect(() => {
    const bump = () => setThemeTick((n) => n + 1);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", bump);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-theme"], subtree: true });
    return () => {
      mq.removeEventListener("change", bump);
      mo.disconnect();
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const drawn = orangeCells(cells);
    const half = halfWidth(drawn);
    const data = {
      type: "FeatureCollection" as const,
      features: drawn.map((c) => ({ type: "Feature" as const, properties: { affinity: c.affinity }, geometry: { type: "Polygon" as const, coordinates: hexagon(c.lat, c.lng, half * 0.9) } })),
    };
    if (drawn.length > 0) {
      const b = new LngLatBounds();
      for (const c of drawn) b.extend([c.lng, c.lat]);
      bounds.current = b;
      instance.fitBounds(b, { padding: MAP_FRAME.padding / 2, maxZoom: MAP_FRAME.maxZoom, duration: 0 });
    } else {
      bounds.current = null;
      instance.jumpTo({ center: [lng, lat], zoom });
    }
    const apply = () => {
      container.current?.setAttribute("data-taste-cells", String(data.features.length));
      const colors = rampColors();
      const source = instance.getSource("taste") as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        instance.setPaintProperty("taste", "fill-color", fillExpression(colors));
        return;
      }
      instance.addSource("taste", { type: "geojson", data });
      instance.addLayer({ id: "taste", type: "fill", source: "taste", paint: { "fill-color": fillExpression(colors), "fill-opacity": 0.85 } });
    };
    whenStyle(instance, apply);
  }, [cells, themeTick, lng, lat, zoom]);

  return <div ref={container} className="size-full" role="region" aria-label={label} />;
}
