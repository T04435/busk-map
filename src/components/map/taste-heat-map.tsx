"use client";

import { useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MapLibreMap, NavigationControl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { STYLE_URL, baseStyle, fillExpression, hexagon, rampColors, themeColor, whenStyle } from "@/components/map/map-shared";
import { MAP_FRAME, MAP_GESTURES, orangeCells } from "@/components/map/taste-cells";

export type HeatCell = { lat: number; lng: number; affinity: number };

/** A top city, labelled on the map at every zoom. `affinity` 0 to 1; the list is strongest first. */
export type HeatCity = { name: string; lat: number; lng: number; affinity: number };

const FALLBACK_HALF = 0.0015;
/** Cells draw at their true size, never wider than this (degrees): a city, not a country (U40). */
const MAX_HALF = 0.25;
/** At most this many cities are drawn; the first three get the larger marker. */
const MAX_CITIES = 8;
const BIG_CITIES = 3;

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
  // True size: the typical spacing, no floor. A wide spread is read through the city markers, and zooming in reveals the cells.
  return Math.min(nearest[Math.floor(nearest.length / 2)] / 2, MAX_HALF);
}

/**
 * The bare taste map: MapLibre on the plan's OpenFreeMap style (the plain land base when the tiles cannot load) with only the orange
 * honeycomb cells of the taste ramp drawn over it, as on the plan map. No pins. Cooperative gestures, so one finger scrolls the page.
 * `cities` (top cities, strongest first, up to 8) draw as labelled hex markers at every zoom; the map frames them.
 * Frames the cells, or `center` (the whole world by default) when there are none. Share: map-shared.ts and taste-cells.ts hold what PlanMap also uses.
 */
/** The whole world, for a map without a place of its own (the act's global fans map). */
const WORLD: [number, number] = [10, 20];

/** A pointy-top hex marker as an RGBA image for the symbol layer: the brand orange with a ring in the page colour so it reads on any land. */
function hexImage(size: number, fill: string, ring: string): ImageData {
  const px = Math.round(size * 2);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext("2d")!;
  const c = px / 2;
  const r = c - 3;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    ctx.lineTo(c + r * Math.cos(a), c + r * Math.sin(a));
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ring;
  ctx.stroke();
  return ctx.getImageData(0, 0, px, px);
}

export function TasteHeatMap({ center = WORLD, zoom = 1, cells, cities, label }: { center?: [number, number]; zoom?: number; cells: readonly HeatCell[]; cities?: readonly HeatCity[]; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const bounds = useRef<LngLatBounds | null>(null);
  const padding = useRef<number | { top: number; bottom: number; left: number; right: number }>(MAP_FRAME.padding / 2);
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
      if (bounds.current) instance.fitBounds(bounds.current, { padding: padding.current, maxZoom: MAP_FRAME.maxZoom, duration: 0 });
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
    const top = (cities ?? []).slice(0, MAX_CITIES);
    const cityData = {
      type: "FeatureCollection" as const,
      features: top.map((c, rank) => ({ type: "Feature" as const, properties: { name: c.name, rank, big: rank < BIG_CITIES }, geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] } })),
    };
    if (drawn.length > 0 || top.length > 0) {
      const b = new LngLatBounds();
      for (const c of drawn) b.extend([c.lng, c.lat]);
      for (const c of top) b.extend([c.lng, c.lat]);
      bounds.current = b;
      // Labels sit to the right of their marker: leave room there so none is clipped.
      padding.current = top.length > 0 ? { top: 48, bottom: 48, left: 56, right: 132 } : MAP_FRAME.padding / 2;
      instance.fitBounds(b, { padding: padding.current, maxZoom: MAP_FRAME.maxZoom, duration: 0 });
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
    const applyCities = () => {
      container.current?.setAttribute("data-city-markers", String(cityData.features.length));
      const fill = themeColor("--primary", "#ff5a1f");
      const ring = themeColor("--background", "#f2eee6");
      const ink = themeColor("--foreground", "#141c21");
      for (const [id, size] of [["city-hex-lg", 26], ["city-hex-sm", 18]] as const) {
        if (instance.hasImage(id)) instance.removeImage(id);
        instance.addImage(id, hexImage(size, fill, ring), { pixelRatio: 2 });
      }
      const source = instance.getSource("cities") as GeoJSONSource | undefined;
      if (source) {
        source.setData(cityData);
        instance.setPaintProperty("cities", "text-color", ink);
        instance.setPaintProperty("cities", "text-halo-color", ring);
        return;
      }
      instance.addSource("cities", { type: "geojson", data: cityData });
      instance.addLayer({
        id: "cities",
        type: "symbol",
        source: "cities",
        layout: {
          "icon-image": ["case", ["get", "big"], "city-hex-lg", "city-hex-sm"],
          "icon-allow-overlap": true,
          "text-field": ["get", "name"],
          "text-font": ["Noto Sans Bold"],
          "text-size": ["case", ["get", "big"], 13, 12],
          "text-anchor": "left",
          "text-offset": [1.1, 0],
          "text-optional": true,
          "text-max-width": 8,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: { "text-color": ink, "text-halo-color": ring, "text-halo-width": 1.6 },
      });
    };
    whenStyle(instance, () => {
      apply();
      applyCities();
    });
  }, [cells, cities, themeTick, lng, lat, zoom]);

  return <div ref={container} className="size-full" role="region" aria-label={label} />;
}
