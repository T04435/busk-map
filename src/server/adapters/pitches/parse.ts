import type { LatLon } from "@/lib/geo";
import type { BuskingSite, PermitCategory } from "./schema";

const WEB_MERCATOR_RADIUS = 6_378_137;

/** EPSG:3857 metres to WGS84 degrees. */
export function webMercatorToLatLon(x: number, y: number): LatLon {
  const lon = (x / WEB_MERCATOR_RADIUS) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / WEB_MERCATOR_RADIUS)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lon };
}

export function parseFlag(value: string | null | undefined): boolean | null {
  const v = value?.trim().toUpperCase();
  if (v === "Y") return true;
  if (v === "N") return false;
  return null;
}

export function parsePermit(raw: string | null): PermitCategory {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") return "general";
  if (value.includes("no busking")) return "no-busking";
  if (value.includes("premium")) return "premium";
  if (value.includes("circle")) return "circle-act";
  if (value.includes("chess")) return "chess-board";
  if (value.includes("pavement")) return "pavement-art";
  if (value.includes("private")) return "private";
  return "unknown";
}

/** Strip the description's HTML and pull out its first link. */
export function parseRules(description: string | null): Pick<BuskingSite, "rules" | "rulesUrl"> {
  const text = description ?? "";
  const href = /href=['"]([^'"]+)['"]/i.exec(text)?.[1] ?? null;
  const rules = text
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { rules, rulesUrl: href && /^https?:\/\//.test(href) ? href : null };
}
