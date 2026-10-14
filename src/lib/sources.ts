/**
 * Every data source the app shows, with the credit its licence or terms ask
 * for. Client-safe: no secrets here. The UI renders these in the attribution
 * panel and next to the data they produced.
 */
export type SourceId =
  | "qloo"
  | "melbourne-pedestrian"
  | "melbourne-busking"
  | "ticketmaster"
  | "lastfm"
  | "spotify"
  | "open-meteo"
  | "openfreemap"
  | "ai";

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
  ai: {
    id: "ai",
    name: "Claude via Vercel AI Gateway",
    credit: "Plan explanations written by Claude (Anthropic) via Vercel AI Gateway",
    url: "https://vercel.com/ai-gateway",
    licence: "Generated text; checked against the data above",
  },
};
