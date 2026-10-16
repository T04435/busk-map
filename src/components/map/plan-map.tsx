"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion, LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { Button } from "@/components/ui/button";
import { geohashBounds } from "@/lib/geo";
import type { Plan } from "@/lib/plan-schema";

/**
 * MapLibre map with OpenFreeMap tiles. The taste grid is a layer of pointy-top honeycomb cells in the five-step taste ramp
 * (read from the theme's CSS variables, repainted when the theme changes). The top pitches are focusable hexagon pins; every
 * other scored pitch is a quiet dot (also a button, so it is keyboard reachable) that opens a summary: name, score and, when it
 * was left out by the 250 m spacing rule, the pick it is too close to. The pitch list beside the map is the keyboard-first
 * alternative for the top three. No events or no-busking zones are drawn: the plan carries no coordinates for them.
 */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Copied into public/ by scripts/copy-maplibre-worker.mjs (predev, prebuild).
setWorkerUrl(`/vendor/maplibre-gl-worker-${getVersion()}.mjs`);

/** Resolve a CSS variable to an rgb() colour MapLibre understands (it parses neither oklch nor lab), by painting one pixel. */
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

const RAMP_FALLBACK = ["#fbe3d2", "#f9b98e", "#f28644", "#dd6322", "#7f2d0c"];
const rampColors = () => [1, 2, 3, 4, 5].map((n, i) => themeColor(`--taste-${n}`, RAMP_FALLBACK[i]));
/** Affinity (0–1) to the ramp step, as the legend's five cells. */
const fillExpression = (colors: string[]) => ["step", ["get", "affinity"], colors[0], 0.26, colors[1], 0.48, colors[2], 0.68, colors[3], 0.88, colors[4]] as never;

const HEX_PTS = "50,2 97,26 97,74 50,98 3,74 3,26";

/** A pointy-top hexagon around a cell centre, as wide as the geohash cell it replaces. */
function hexagon(lat: number, lon: number, halfWidthDeg: number) {
  const r = halfWidthDeg / (Math.sqrt(3) / 2);
  const k = Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: 7 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * (i % 6) - 90);
    return [lon + r * Math.cos(a), lat + r * Math.sin(a) * k];
  });
  return [ring];
}

type Props = {
  plan: Pick<Plan, "tasteCells" | "pitches" | "others">;
  center: { lat: number; lon: number };
  selectedId: string | null;
  onSelect: (pitchId: string) => void;
};

const SVG = (inner: string) => `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false" style="position:absolute;inset:0;overflow:visible">${inner}</svg>`;

function topPin(rank: number, gem: boolean): string {
  const shape = gem
    ? SVG(`<polygon points="50,4 96,50 50,96 4,50" style="fill:var(--honey);stroke:var(--bluestone);stroke-width:5"/><circle cx="50" cy="50" r="9" style="fill:var(--bluestone)"/>`)
    : SVG(`<polygon points="${HEX_PTS}" style="fill:var(--bluestone);stroke:var(--primary);stroke-width:7"/><polygon points="50,30 70,41 70,63 50,74 30,63 30,41" style="fill:var(--background)"/>`);
  return `${shape}<span style="position:absolute;right:-6px;top:-8px;min-width:20px;height:22px;padding:0 4px;display:grid;place-items:center;background:var(--primary);color:var(--primary-foreground);border:2px solid var(--fill-rule);font:800 14px/1 var(--font-display)" aria-hidden="true">${rank}</span>`;
}

export function PlanMap({ plan, center, selectedId, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const onSelectRef = useRef(onSelect);
  const frame = useRef<LngLatBounds | null>(null);
  const interacted = useRef(false);
  const [dotId, setDotId] = useState<string | null>(null);
  const dotRef = useRef<string | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const browseRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  /** Room at the bottom when the legend floats over the map (from 768 px up), so framed pins never sit under it. */
  const legendPad = useCallback(() => {
    const legend = container.current?.closest('[data-slot="map-frame"]')?.querySelector<HTMLElement>('[data-slot="map-legend"]');
    if (!legend || getComputedStyle(legend).position !== "absolute") return 0;
    return legend.offsetHeight + 24;
  }, []);
  const fit = useCallback(
    (instance: MapLibreMap, bounds: LngLatBounds) => instance.fitBounds(bounds, { padding: { top: 60, left: 60, right: 60, bottom: 60 + legendPad() }, maxZoom: 15, duration: 0 }),
    [legendPad],
  );

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
    const observer = new ResizeObserver(() => {
      instance.resize();
      if (frame.current && !interacted.current) fit(instance, frame.current);
    });
    for (const event of ["dragstart", "wheel", "touchstart"] as const) instance.on(event, () => (interacted.current = true));
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      instance.remove();
      map.current = null;
    };
  }, [center.lat, center.lon, fit]);

  // Repaint the taste ramp when the theme changes (system setting or a theme attribute).
  useEffect(() => {
    const bump = () => setThemeTick((n) => n + 1);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", bump);
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => {
      mq.removeEventListener("change", bump);
      mo.disconnect();
    };
  }, []);

  // Taste grid: Qloo heatmap cells as honeycomb cells, stepped by affinity relative to the performer's best cell.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const data = {
      type: "FeatureCollection" as const,
      features: plan.tasteCells.map((c) => {
        const half = c.geohash ? (geohashBounds(c.geohash).east - geohashBounds(c.geohash).west) / 2 : 0.0015;
        return { type: "Feature" as const, properties: { affinity: c.affinity }, geometry: { type: "Polygon" as const, coordinates: hexagon(c.lat, c.lon, half) } };
      }),
    };
    const apply = () => {
      const colors = rampColors();
      const source = instance.getSource("taste") as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        instance.setPaintProperty("taste", "fill-color", fillExpression(colors));
        return;
      }
      instance.addSource("taste", { type: "geojson", data });
      instance.addLayer({ id: "taste", type: "fill", source: "taste", paint: { "fill-color": fillExpression(colors), "fill-opacity": 0.85 } });
      instance.addLayer({ id: "taste-outline", type: "line", source: "taste", paint: { "line-color": themeColor("--rule", "#141c21"), "line-opacity": 0.25, "line-width": 1 } });
    };
    if (instance.isStyleLoaded()) apply();
    else instance.once("load", apply);
  }, [plan.tasteCells, themeTick]);

  // Pins: real buttons, so they are reachable by keyboard and screen readers. The 48px button is the hit area; the shape inside grows when selected.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    for (const marker of markers.current) marker.remove();
    markers.current = [];
    // Dots first, so the top pins sit above them. They are drawn for the mouse and are hidden from assistive tech: the "Browse other
    // pitches" control is the one keyboard and screen reader way in (dozens of close-together buttons would overlap each other).
    for (const o of plan.others.slice(0, 40)) {
      const el = document.createElement("span");
      el.dataset.otherId = o.id;
      el.setAttribute("data-testid", "other-dot");
      el.setAttribute("aria-hidden", "true");
      el.className = "group relative z-0 block size-6 cursor-pointer";
      el.innerHTML = `<span class="absolute top-1/2 left-1/2 block h-[17px] w-[15px] -translate-x-1/2 -translate-y-1/2 transition-transform group-hover:scale-125 group-data-[open=true]:scale-150" style="background:var(--usual-spot);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)"></span>`;
      el.addEventListener("click", () => {
        setDotId((cur) => (cur === o.id ? null : o.id));
      });
      markers.current.push(new Marker({ element: el }).setLngLat([o.lon, o.lat]).addTo(instance));
    }
    plan.pitches.forEach((p, i) => {
      const rank = i + 1;
      const el = document.createElement("button");
      el.type = "button";
      el.dataset.pitchId = p.id;
      const gem = p.discovery === "hidden-gem";
      const tag = gem ? ", hidden gem" : p.discovery === "usual" ? ", usual pitch" : "";
      el.setAttribute("aria-label", `Pitch ${rank}: ${p.name}, score ${p.score}${tag}`);
      el.className = "group relative z-10 block size-12 cursor-pointer";
      el.innerHTML = `<span data-shape class="absolute top-1/2 left-1/2 block size-8 -translate-x-1/2 -translate-y-1/2 transition-transform group-aria-pressed:scale-125">${topPin(rank, gem)}</span>`;
      el.addEventListener("click", () => {
        setDotId(null);
        onSelectRef.current(p.id);
      });
      markers.current.push(new Marker({ element: el }).setLngLat([p.lon, p.lat]).addTo(instance));
    });
    if (plan.pitches.length > 0) {
      const bounds = new LngLatBounds();
      for (const p of plan.pitches) bounds.extend([p.lon, p.lat]);
      frame.current = bounds;
      interacted.current = false;
      fit(instance, bounds);
    }
  }, [plan.pitches, plan.others, fit]);

  // Selection: mark the pin pressed (it grows) and pan to it when it is out of view.
  useEffect(() => {
    const instance = map.current;
    for (const marker of markers.current) {
      const el = marker.getElement();
      if (!el.dataset.pitchId) continue;
      el.setAttribute("aria-pressed", String(el.dataset.pitchId === selectedId));
    }
    const target = plan.pitches.find((p) => p.id === selectedId);
    if (instance && target && !instance.getBounds().contains([target.lon, target.lat])) instance.easeTo({ center: [target.lon, target.lat], duration: 600 });
  }, [selectedId, plan.pitches]);

  // The open dot grows; a dot chosen from the keyboard control is panned into view.
  useEffect(() => {
    dotRef.current = dotId;
    for (const marker of markers.current) {
      const el = marker.getElement();
      if (el.dataset.otherId) el.dataset.open = String(el.dataset.otherId === dotId);
    }
    const target = plan.others.find((o) => o.id === dotId);
    const instance = map.current;
    if (instance && target && !instance.getBounds().contains([target.lon, target.lat])) instance.easeTo({ center: [target.lon, target.lat], duration: 400 });
    if (dotId) nextRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      browseRef.current?.focus();
    }
  }, [dotId, plan.others]);

  const closeSummary = useCallback(() => {
    restoreFocus.current = true;
    setDotId(null);
  }, []);
  const others = plan.others.slice(0, 40);
  const step = (by: number) => {
    const i = others.findIndex((o) => o.id === dotRef.current);
    setDotId(others[(i + by + others.length) % others.length].id);
  };
  const dot = plan.others.find((o) => o.id === dotId) ?? null;

  return (
    <div className="relative h-full min-h-80 w-full overflow-hidden border-2 border-rule bg-muted" onKeyDown={(e) => e.key === "Escape" && dotRef.current && closeSummary()}>
      <div ref={container} className="size-full" role="region" aria-label="Map of pitches and Qloo taste affinity" />
      {others.length > 0 && !dot ? (
        <Button
          ref={browseRef}
          type="button"
          variant="outline"
          aria-haspopup="dialog"
          aria-expanded="false"
          data-testid="browse-others"
          className="absolute top-3 left-3 z-10 bg-popover shadow-sm"
          onClick={() => setDotId(others[0].id)}
        >
          Browse other pitches ({others.length})
        </Button>
      ) : null}
      {dot ? (
        <div
          role="dialog"
          aria-label={`${dot.name}, summary`}
          data-testid="other-pitch-popover"
          className="absolute top-3 left-3 z-20 w-[min(19rem,calc(100%-4rem))] space-y-2 border-2 border-rule bg-popover p-3 text-sm shadow-md"
        >
          <div className="flex items-start gap-2">
            <b className="min-w-0 flex-1 text-base leading-5">{dot.name}</b>
            <PercentCell value={dot.score} size={40} label="Score" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DiscoveryBadge discovery={dot.discovery} />
            {dot.tipPoints ? <span className="font-mono text-xs">Your tips +{dot.tipPoints}</span> : null}
          </div>
          {dot.tooCloseTo ? (
            <p className="m-0" data-testid="too-close">
              <b>Too close to {dot.tooCloseTo.name}</b>: scored higher, but it&apos;s within 250 m, so the plan kept its picks apart.
            </p>
          ) : (
            <p className="m-0 text-muted-foreground">Scored, but not in the top three.</p>
          )}
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="font-mono text-xs text-muted-foreground">
              {others.findIndex((o) => o.id === dot.id) + 1} of {others.length}
            </span>
            <span className="flex gap-1">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous pitch" onClick={() => step(-1)}>
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button ref={nextRef} type="button" variant="outline" size="icon-sm" aria-label="Next pitch" onClick={() => step(1)}>
                <ChevronRight aria-hidden="true" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Close summary" onClick={closeSummary}>
                <X aria-hidden="true" />
              </Button>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
