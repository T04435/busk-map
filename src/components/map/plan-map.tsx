"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Icon } from "@/components/honeycomb/icon";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import { Button } from "@/components/ui/button";
import { geohashBounds } from "@/lib/geo";
import { MAP_FRAME, MAP_GESTURES, orangeCells } from "@/components/map/taste-cells";
import { OSM_ATTRIBUTION, STYLE_URL, baseStyle, fillExpression, hexagon, rampColors, themeColor, whenStyle } from "@/components/map/map-shared";
import type { Plan, PlanPitch } from "@/lib/plan-schema";

/**
 * THE map: the landing's preview and the plan page draw the same one (F02, F03, F05, F16 as far as the data goes). MapLibre with OpenFreeMap tiles. The taste grid is a layer of pointy-top honeycomb cells in the orange steps (3 to 5) of the taste ramp
 * (read from the theme's CSS variables, repainted when the theme changes). The top pitches are DS PitchPin buttons (hex puck, ring, rank badge); every
 * other scored pitch is a quiet hex dot (also a button, so it is keyboard reachable) that opens a summary: name, score and, when it
 * was left out by the 250 m spacing rule, the pick it is too close to. The pitch list beside the map is the keyboard-first
 * alternative for the top three. Taste draws as bare orange cells only (see taste-cells.ts). No-busking zones draw as hatched honeycomb cells. Events are not drawn: the plan carries no coordinates for them.
 */
const HEX_FULL = "50,0 100,25 100,75 50,100 0,75 0,25";

/** The no-busking hatch (F16): the DS hatch, 3px pink diagonal stripes on a 12px tile, in the zone colour. */
function hatchImage(): ImageData | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 12;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.strokeStyle = themeColor("--zone-pink", "#e0337a");
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const k of [-12, 0, 12]) {
    ctx.moveTo(k, 12);
    ctx.lineTo(k + 12, 0);
  }
  ctx.stroke();
  return ctx.getImageData(0, 0, 12, 12);
}

type Props = {
  /** Only what the map draws, so the landing can feed it a labelled example without a full plan. */
  plan: Pick<Plan, "tasteCells" | "others"> & { zones?: Plan["zones"] } & { pitches: Pick<PlanPitch, "id" | "name" | "lat" | "lon" | "score" | "discovery">[] };
  center: { lat: number; lon: number };
  selectedId: string | null;
  onSelect: (pitchId: string) => void;
  /** Zoom the framing out: the highest zoom the fit may use and the room around the pins. The landing shows more of the map. */
  frame?: { maxZoom: number; padding: number };
};

/** The DS Hex: a pointy-top cell filling its box, the stroke drawn inside the edge (clipped, so doubled). `cls` sets fill, stroke and stroke-width. */
let hexSeq = 0;
const hexSvg = (cls: string, svgCls = "absolute inset-0 size-full overflow-visible") => {
  const id = `pmhx${(hexSeq += 1)}`;
  return `<svg class="${svgCls}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><defs><clipPath id="${id}"><polygon points="${HEX_FULL}"/></clipPath></defs><polygon points="${HEX_FULL}" clip-path="url(#${id})" vector-effect="non-scaling-stroke" class="${cls}"/></svg>`;
};

/** The DS pitch ring: a 306-degree arc (the crowd) around one cell (the performer). The core is the DS paper colour. */
const RING = `<svg class="relative text-primary" width="28" height="28" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M38.554 20.371A15 15 0 1 1 27.629 9.446" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/><polygon points="24.00,17.40 29.72,20.70 29.72,27.30 24.00,30.60 18.28,27.30 18.28,20.70" fill="#fbf9f5"/></svg>`;

/** DS PitchPin kind="top": a bluestone hex puck edged in card (primary when selected), the ring, and the hex rank badge. Ranks 2 and 3 are quieter (is-minor). */
function topPin(rank: number): string {
  const puck = hexSvg(
    "fill-bluestone stroke-card [stroke-width:4px] dark:stroke-foreground group-aria-pressed:stroke-primary group-aria-pressed:[stroke-width:7px] dark:group-aria-pressed:stroke-primary",
  );
  const badge = `<span class="absolute -top-2 -right-2.5 grid h-6 w-[21px] place-items-center font-display text-sm leading-none font-extrabold text-primary-foreground" aria-hidden="true">${hexSvg("fill-primary stroke-bluestone [stroke-width:3px]")}<span class="relative top-px">${rank}</span></span>`;
  return `${puck}<span class="relative grid size-full place-items-center">${RING}</span>${badge}`;
}

/** DS PitchPin kind="other": the quiet usual-spot hex dot (foreground when open). */
const otherDot = () => hexSvg("fill-usual-spot stroke-card [stroke-width:3px] group-data-[open=true]:fill-foreground");

export function PlanMap({ plan, center, selectedId, onSelect, frame: framing }: Props) {
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

  const fit = useCallback(
    (instance: MapLibreMap, bounds: LngLatBounds) => {
      const pad = framing?.padding ?? MAP_FRAME.padding;
      return instance.fitBounds(bounds, { padding: pad, maxZoom: framing?.maxZoom ?? MAP_FRAME.maxZoom, duration: 0 });
    },
    [framing?.padding, framing?.maxZoom],
  );

  // Create the map once.
  useEffect(() => {
    if (!container.current) return;
    const instance = new MapLibreMap({
      container: container.current,
      style: STYLE_URL,
      center: [center.lon, center.lat],
      zoom: 13.4,
      attributionControl: { compact: true, customAttribution: OSM_ATTRIBUTION },
      ...MAP_GESTURES,
    });
    instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.current = instance;
    // The tiles' style never arrived: swap in the plain base once, so the layers below can be added.
    let fellBack = false;
    instance.on("error", () => {
      if (fellBack || instance.isStyleLoaded()) return;
      fellBack = true;
      instance.setStyle(baseStyle());
    });
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
      features: orangeCells(plan.tasteCells).map((c) => {
        const half = c.geohash ? (geohashBounds(c.geohash).east - geohashBounds(c.geohash).west) / 2 : 0.0015;
        return { type: "Feature" as const, properties: { affinity: c.affinity }, geometry: { type: "Polygon" as const, coordinates: hexagon(c.lat, c.lon, half) } };
      }),
    };
    const apply = () => {
      // For tests and QA: how many orange cells the map was given (0 when no taste is drawn).
      container.current?.setAttribute("data-taste-cells", String(data.features.length));
      const colors = rampColors();
      const source = instance.getSource("taste") as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        instance.setPaintProperty("taste", "fill-color", fillExpression(colors));
        instance.setPaintProperty("taste-outline", "line-color", themeColor("--card", "#fbf9f5"));
        return;
      }
      instance.addSource("taste", { type: "geojson", data });
      instance.addLayer({ id: "taste", type: "fill", source: "taste", paint: { "fill-color": fillExpression(colors), "fill-opacity": 0.85 } });
      instance.addLayer({ id: "taste-outline", type: "line", source: "taste", paint: { "line-color": themeColor("--card", "#fbf9f5"), "line-width": 1.5 } });
    };
    whenStyle(instance, apply);
  }, [plan.tasteCells, themeTick]);

  // No-busking cells (F16): the council's no-busking streets as hatched honeycomb cells, never a line or a polygon.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const data = {
      type: "FeatureCollection" as const,
      features: (plan.zones ?? []).map((c) => ({ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: hexagon(c.lat, c.lon, 360 / 2 ** 19) } })),
    };
    const apply = () => {
      const source = instance.getSource("zones") as GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
        instance.setPaintProperty("zones-outline", "line-color", themeColor("--zone-pink", "#e0337a"));
        const next = hatchImage();
        if (next && instance.hasImage("hatch")) instance.updateImage("hatch", next);
        return;
      }
      const hatch = hatchImage();
      if (hatch && !instance.hasImage("hatch")) instance.addImage("hatch", hatch);
      instance.addSource("zones", { type: "geojson", data });
      instance.addLayer({ id: "zones", type: "fill", source: "zones", paint: hatch ? { "fill-pattern": "hatch" } : { "fill-color": themeColor("--zone-pink", "#e0337a"), "fill-opacity": 0.4 } });
      instance.addLayer({ id: "zones-outline", type: "line", source: "zones", paint: { "line-color": themeColor("--zone-pink", "#e0337a"), "line-width": 1.5 } });
    };
    whenStyle(instance, apply);
  }, [plan.zones, themeTick]);

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
      el.innerHTML = `<span class="absolute top-1/2 left-1/2 block h-4 w-3.5 -translate-x-1/2 -translate-y-1/2 transition-transform group-hover:scale-125 group-data-[open=true]:scale-150">${otherDot()}</span>`;
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
      const tag = p.discovery === "hidden-gem" ? ", hidden gem" : p.discovery === "usual" ? ", usual pitch" : "";
      el.setAttribute("aria-label", `Pitch ${rank}: ${p.name}, score ${p.score}${tag}`);
      el.className = "group relative z-10 block size-12 cursor-pointer";
      // DS PitchPin: 40px wide hex (ratio 1.1547), pitch 1 the largest, 2 and 3 quieter (is-minor); selected grows and shows its caption.
      const minor = rank > 1 ? "scale-[.82] opacity-90 group-aria-pressed:opacity-100" : "";
      const label = p.name.replace(/&/g, "&amp;").replace(/</g, "&lt;");
      el.innerHTML = `<span data-shape class="absolute top-1/2 left-1/2 block h-[46.2px] w-10 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_0_color-mix(in_oklab,var(--bluestone)_35%,transparent)] transition-transform duration-200 group-aria-pressed:scale-[1.18] ${minor}">${topPin(rank)}</span><span data-caption aria-hidden="true" class="pointer-events-none absolute top-[calc(50%+33px)] left-1/2 hidden -translate-x-1/2 bg-card px-1.5 py-0.5 font-mono text-[11px] leading-4 tracking-[0.04em] whitespace-nowrap text-foreground uppercase shadow-[0_0_0_1.5px_var(--rule)] group-aria-pressed:block">${label}</span>`;
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
    <div className="relative h-full min-h-80 w-full overflow-hidden bg-muted" onKeyDown={(e) => e.key === "Escape" && dotRef.current && closeSummary()}>
      <div ref={container} className="size-full" role="region" aria-label="Map of pitches and Qloo taste affinity" data-center={`${center.lat},${center.lon}`} />
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
          className="absolute top-3 left-3 z-20 grid w-[min(19rem,calc(100%-4rem))] gap-1.5 border-2 border-rule bg-popover p-3 text-sm leading-5 shadow-md"
        >
          <div className="flex items-center gap-2">
            <b className="min-w-0 flex-1 font-display text-lg leading-5 font-extrabold uppercase">{dot.name}</b>
            <ScoreCell value={dot.score} size="sm" label="Score" />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Close summary" onClick={closeSummary}>
              <Icon name="x" size={16} />
            </Button>
          </div>
          {dot.tooCloseTo ? (
            <p className="m-0 flex items-start gap-2 text-muted-foreground" data-testid="too-close">
              <Icon name="pin" size={16} className="mt-0.5" />
              <span>
                <b>Too close to {dot.tooCloseTo.name}</b>: scored higher, but it&apos;s within 250 m, so the plan kept its picks apart.
              </span>
            </p>
          ) : (
            <p className="m-0 text-muted-foreground">Scored, but not in the top three.</p>
          )}
          <DiscoveryBadge discovery={dot.discovery} />
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <span className="font-mono text-xs text-muted-foreground">
              {others.findIndex((o) => o.id === dot.id) + 1} of {others.length}
            </span>
            <span className="flex gap-1">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous pitch" onClick={() => step(-1)}>
                <Icon name="arrow-left" size={16} />
              </Button>
              <Button ref={nextRef} type="button" variant="outline" size="icon-sm" aria-label="Next pitch" onClick={() => step(1)}>
                <Icon name="arrow-right" size={16} />
              </Button>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
