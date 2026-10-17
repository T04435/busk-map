/**
 * Every data source the app shows, with the credit its licence or terms ask
 * for. Client-safe: no secrets here. The UI renders these in the attribution
 * panel and next to the data they produced.
 */
import { AGENT_NAME, AGENT_NAME_INLINE, AGENT_NAME_START } from "./agent-persona";

export type SourceId =
  | "qloo"
  | "melbourne-pedestrian"
  | "melbourne-busking"
  | "ticketmaster"
  | "lastfm"
  | "spotify"
  | "open-meteo"
  | "openfreemap"
  | "osm"
  | "ai";

/** How every Qloo-derived number is labelled when the local mock answers (no key, QLOO_MOCK=1, or tests). */
export const QLOO_TEST_LABEL = "Qloo test data (local mock)";

/** Which model wrote a plan's explanations: Claude, or the offline mock model (tests, BUSKMAP_OFFLINE). */
export type ExplanationsModel = "claude" | "mock";

/** The header chip for a plan's or week's explanations. Plans stored before explanationsModel existed count as Claude. */
export function explanationsLabel(plan: { explanations: "ai" | "template"; explanationsModel?: ExplanationsModel | null }): string {
  if (plan.explanations !== "ai") return "Explanations: from the data";
  return plan.explanationsModel === "mock" ? "Explanations: test model (offline)" : `Written by ${AGENT_NAME} (runs on Claude)`;
}

/**
 * The agent's name in running text (B-010): "the Hive" (the persona, lib/agent-persona.ts; it runs on Claude), or "the test model"
 * when the offline mock model wrote it. `start` capitalises it for the start of a sentence; `label` is the short form before a
 * note ("Hive: …", "Test model: …"). Null or missing (template text, older plans) counts as the Hive, like explanationsLabel.
 */
export function modelName(model: ExplanationsModel | null | undefined, form: "inline" | "start" | "label" = "inline"): string {
  if (model !== "mock") return form === "inline" ? AGENT_NAME_INLINE : form === "start" ? AGENT_NAME_START : AGENT_NAME;
  return form === "inline" ? "the test model" : form === "start" ? "The test model" : "Test model";
}

/** The pitch card badge for AI-written explanations. */
export function explainedByLabel(model: ExplanationsModel | null | undefined): string {
  return model === "mock" ? `Explained by ${modelName(model)} (offline)` : `Explained by ${modelName(model)}`;
}

/** Whether to credit Claude in Data sources: only when Claude wrote the explanations. */
export function creditsClaude(plan: { explanations: "ai" | "template"; explanationsModel?: ExplanationsModel | null }): boolean {
  return plan.explanations === "ai" && plan.explanationsModel !== "mock";
}

export type SourceInfo = {
  id: SourceId;
  name: string;
  credit: string;
  url: string;
  licence: string;
};

export const SOURCES: Record<SourceId, SourceInfo> = {
  qloo: {
    id: "qloo",
    name: "Qloo",
    credit: "Taste data by Qloo",
    url: "https://www.qloo.com",
    licence: "Qloo hackathon API terms",
  },
  "melbourne-pedestrian": {
    id: "melbourne-pedestrian",
    name: "City of Melbourne Pedestrian Counting System",
    credit: "Pedestrian counts: City of Melbourne Open Data",
    url: "https://data.melbourne.vic.gov.au/explore/dataset/pedestrian-counting-system-monthly-counts-per-hour/",
    licence: "CC BY",
  },
  "melbourne-busking": {
    id: "melbourne-busking",
    name: "City of Melbourne busking locations",
    credit: "Busking locations and zones: City of Melbourne",
    url: "https://www.arcgis.com/home/item.html?id=3991e11134634405bb8786d2b26425b8",
    licence: "Published by the City of Melbourne; licence not stated",
  },
  ticketmaster: {
    id: "ticketmaster",
    name: "Ticketmaster",
    credit: "Event data from Ticketmaster",
    url: "https://www.ticketmaster.com.au",
    licence: "Ticketmaster Discovery API terms",
  },
  lastfm: {
    id: "lastfm",
    name: "Last.fm",
    credit: "Song popularity powered by AudioScrobbler (Last.fm)",
    url: "https://www.last.fm",
    licence: "Last.fm API terms (non-commercial)",
  },
  spotify: {
    id: "spotify",
    name: "Spotify",
    credit: "Catalogue data from Spotify",
    url: "https://open.spotify.com",
    licence: "Spotify Developer Terms",
  },
  "open-meteo": {
    id: "open-meteo",
    name: "Open-Meteo",
    credit: "Weather data by Open-Meteo.com",
    url: "https://open-meteo.com",
    licence: "CC BY 4.0",
  },
  openfreemap: {
    id: "openfreemap",
    name: "OpenFreeMap",
    credit: "Map tiles: OpenFreeMap, © OpenMapTiles, data © OpenStreetMap contributors",
    url: "https://openfreemap.org",
    licence: "OpenStreetMap ODbL",
  },
  osm: {
    id: "osm",
    name: "OpenStreetMap",
    credit: "Public spaces and venue names: © OpenStreetMap contributors",
    url: "https://www.openstreetmap.org/copyright",
    licence: "ODbL 1.0",
  },
  ai: {
    id: "ai",
    name: "Claude via Vercel AI Gateway",
    credit: "Plan explanations written by Claude (Anthropic) via Vercel AI Gateway",
    url: "https://vercel.com/ai-gateway",
    licence: "Generated text; checked against the data above",
  },
};
