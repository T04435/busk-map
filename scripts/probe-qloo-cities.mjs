// One-off live Qloo coverage probe across cities. Qloo only, no model calls.
// Run: node --env-file=.env.local scripts/probe-qloo-cities.mjs > summary.json
// Calls the Qloo HTTP API the way src/server/adapters/qloo/client.ts does (same base URL, header,
// 3 requests/second pacing, 429 retries). Prints only aggregates and a short name sample, never
// raw responses and never the key. Qloo terms forbid keeping response data in the repo.
const BASE = process.env.QLOO_API_BASE_URL || "https://hackathon.api.qloo.com";
const KEY = process.env.QLOO_API_KEY;
if (!KEY) throw new Error("QLOO_API_KEY missing (use --env-file=.env.local)");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const starts = [];
let calls = 0;
async function get(path, params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    for (;;) {
      const now = Date.now();
      while (starts.length && now - starts[0] >= 1000) starts.shift();
      if (starts.length < 3) { starts.push(now); break; }
      await sleep(1005 - (now - starts[0]));
    }
    calls++;
    const res = await fetch(`${BASE}${path}?${q}`, { headers: { "X-Api-Key": KEY, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    if (res.status === 429 && attempt < 3) { await sleep(1100); continue; }
    if (res.status === 404) return { results: [] };
    if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
    return res.json();
  }
}
const km = (a, b) => { const R = 6371, t = Math.PI / 180, dl = (b.lat - a.lat) * t, dn = (b.lon - a.lon) * t;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const CITIES = [
  ["Melbourne", -37.8136, 144.9631], ["Sydney", -33.8688, 151.2093], ["Brisbane", -27.4698, 153.0251],
  ["London", 51.5074, -0.1278], ["New York", 40.7580, -73.9855], ["Los Angeles", 34.0522, -118.2437],
  ["Toronto", 43.6532, -79.3832], ["Paris", 48.8566, 2.3522], ["Berlin", 52.5200, 13.4050],
  ["Tokyo", 35.6812, 139.7671], ["Mexico City", 19.4326, -99.1332], ["Austin", 30.2672, -97.7431],
];
const SIGNAL_NAMES = ["Coldplay", "Ed Sheeran", "Beyonce"];
const HALF_KM = 1; // 2 km box
const poly = (lat, lon) => { const dy = HALF_KM / 111.32, dx = HALF_KM / (111.32 * Math.cos(lat * Math.PI / 180));
  const w = lon - dx, e = lon + dx, s = lat - dy, n = lat + dy; return `POLYGON((${w} ${s}, ${e} ${s}, ${e} ${n}, ${w} ${n}, ${w} ${s}))`; };
const out = { signals: [], cities: [] };
const ids = [];
for (const n of SIGNAL_NAMES) {
  const r = await get("/search", { query: n, types: "urn:entity:artist", take: 3 });
  const e = r.results[0]; if (e) { ids.push(e.entity_id); out.signals.push(e.name); }
}
for (const [name, lat, lon] of CITIES) {
  const row = { city: name };
  try {
    const r = await get("/search", { query: name, types: "urn:entity:locality", take: 5 });
    const hits = r.results.map((e) => ({ id: e.entity_id, name: e.name, d: e.location ? km({ lat, lon }, { lat: e.location.lat, lon: e.location.lon }) : null }));
    const top = hits[0], near = hits.find((h) => h.d !== null && h.d <= 25);
    row.locality = { top: top && { id: top.id, name: top.name, km: top.d && Math.round(top.d) }, topRight: !!top && top.d !== null && top.d <= 25, anyWithin25km: !!near };
  } catch (e) { row.locality = { error: String(e.message) }; }
  const wkt = poly(lat, lon);
  try {
    const r = await get("/v2/insights", { "filter.type": "urn:heatmap", "signal.interests.entities": ids.join(","), "filter.location": wkt });
    const cells = r.results?.heatmap ?? [];
    row.heatmap = { total: cells.length, affGe05: cells.filter((c) => (c.query?.affinity ?? 0) >= 0.5).length, withPopularity: cells.filter((c) => (c.query?.popularity ?? 0) > 0).length };
  } catch (e) { row.heatmap = { error: String(e.message) }; }
  try {
    const r = await get("/v2/insights", { "filter.type": "urn:entity:place", "filter.location": `POINT(${lon} ${lat})`, "filter.location.radius": 2000, "signal.interests.entities": ids.join(","), take: 50 });
    const pl = r.results?.entities ?? r.results ?? [];
    const hasHours = (p) => { const h = p.properties?.hours; return h && typeof h === "object" && Object.values(h).some((d) => Array.isArray(d) && d.some((x) => x && !x.closed && x.opens)); };
    row.places = { total: pl.length, withHours: pl.filter(hasHours).length };
  } catch (e) { row.places = { error: String(e.message) }; }
  try {
    const r = await get("/v2/insights", { "filter.type": "urn:entity:artist", "signal.location": wkt, "signal.interests.entities": ids.join(","), "feature.explainability": true, take: 20 });
    const ar = r.results?.entities ?? [];
    row.artists = { count: ar.length, top5: ar.slice(0, 5).map((a) => a.name) };
  } catch (e) { row.artists = { error: String(e.message) }; }
  out.cities.push(row);
  console.error("done", name);
}
out.qlooCalls = calls;
console.log(JSON.stringify(out, null, 1));
