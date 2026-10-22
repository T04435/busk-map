import { getVersion, setWorkerUrl, Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";
import { TASTE_STEP_FROM } from "@/components/map/taste-cells";

/** The map pieces PlanMap and the Repertoire's FansMap share: the OSM style, the theme colour reader, the orange ramp, the plain-land fallback and the hexagon cell. */
/** The map credit that stays when only the plain base loads (the tiles' style carries its own). */
export const OSM_ATTRIBUTION = '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>';
export const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Copied into public/ by scripts/copy-maplibre-worker.mjs (predev, prebuild).
setWorkerUrl(`/vendor/maplibre-gl-worker-${getVersion()}.mjs`);

/** Resolve a CSS variable to an rgb() colour MapLibre understands (it parses neither oklch nor lab), by painting one pixel. */
export function themeColor(variable: string, fallback: string): string {
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

const RAMP_FALLBACK = ["#f28644", "#dd6322", "#7f2d0c"];
/** The orange steps only: --taste-3, --taste-4, --taste-5. */
export const rampColors = () => [3, 4, 5].map((n, i) => themeColor(`--taste-${n}`, RAMP_FALLBACK[i]));
/** Affinity (0–1) to the orange step, as in the DS TasteMap (3 from the orange threshold, 4 from 0.68, 5 from 0.88). */
export const fillExpression = (colors: string[]) => ["step", ["get", "affinity"], colors[0], TASTE_STEP_FROM[4], colors[1], TASTE_STEP_FROM[5], colors[2]] as never;

/** No tiles (offline, blocked, or the style host is down): a plain land base (--map-land when the theme has it, else --muted), so the taste cells and pins still draw. */
export const baseStyle = (): StyleSpecification => ({
  version: 8,
  sources: {},
  // The glyphs the plan style uses, so the city labels still draw when only the plain land loads.
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  layers: [{ id: "base", type: "background", paint: { "background-color": themeColor("--map-land", themeColor("--muted", "#ebe6dc")) } }],
});

/** Run `fn` once the current style is usable (the tiles' style, or the plain base after it failed to load). */
export function whenStyle(instance: MapLibreMap, fn: () => void) {
  if (instance.isStyleLoaded()) fn();
  else instance.once("style.load", fn);
}

/** A pointy-top hexagon around a cell centre, as wide as the geohash cell it replaces. */
export function hexagon(lat: number, lon: number, halfWidthDeg: number) {
  const r = halfWidthDeg / (Math.sqrt(3) / 2);
  const k = Math.cos((lat * Math.PI) / 180);
  const ring = Array.from({ length: 7 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * (i % 6) - 90);
    return [lon + r * Math.cos(a), lat + r * Math.sin(a) * k];
  });
  return [ring];
}

