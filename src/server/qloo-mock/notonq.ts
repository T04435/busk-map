// SYNTHETIC FIXTURE (NotOnQ behaviour in the Qloo mock, not NotOnQ or Qloo data).
import { OFFLINE_TEST_ACTS } from "@/lib/repertoire-research";
import { CATALOG, genreTagId, normalizeName } from "./catalog";

/**
 * The NotOnQ proxy (lib/notonq.ts) as the offline mock plays it, for one test act only (OFFLINE_TEST_ACTS.notonq), so the labels
 * can be exercised end to end with no network. It follows NotOnQ's documented contract (https://notonq.vercel.app/llms-full.txt):
 * - G1: `/search` for the act's exact name, which Qloo lacks, answers a Qloo-shaped artist whose short description starts "Not in
 *   Qloo: filled by NotOnQ…", with `notonq.served_by: "fallback"`; `/entities` by its id answers the same artist.
 * - G2: the filled artist as a signal (`signal.interests.entities`, or either compare group) is swapped for its stand-ins, two
 *   artists the mock's Qloo knows; the answer is the mock's own for them, with `notonq.served_by: "mixed"` and the stand-ins named.
 *   In a list being ranked (`filter.results.entities`) it is left out, unranked.
 * Every other request is the mock's plain Qloo answer. The entity and its description are invented.
 */
const ACT = OFFLINE_TEST_ACTS.notonq;
/**
 * A lower-case UUID like NotOnQ's (a MusicBrainz id), never a mock Qloo id (4D4F434B-…). Invented, and built from its parts so the
 * fixture check (scripts/check-fixtures.mjs: no `entity_id` beside a literal UUID) keeps meaning "no real response in the repo".
 */
export const NOTONQ_FILLED_ID = ["6e0f6a52", "7d3b", "4c1e", "9a55", "00000000c0de"].join("-");

const standIns = () => ACT.standIns.flatMap((name) => CATALOG.filter((a) => a.name === name)).map((a) => ({ entity_id: a.id, name: a.name, weight: 1, source: "qloo-mock" }));

function filledArtist() {
  return {
    name: ACT.name,
    entity_id: NOTONQ_FILLED_ID,
    types: ["urn:entity:artist"],
    properties: {
      short_description: `Not in Qloo: filled by NotOnQ from open sources. Stand-ins: ${ACT.standIns.join(", ")}. (Busk Map offline test entity.)`,
      "notonq:home": { name: "Melbourne", country: "Australia", country_code: "AU", source: "musicbrainz" },
    },
    popularity: 0.05,
    tags: [
      { name: "Indie Folk", tag_id: genreTagId("indie_folk"), type: "urn:tag:genre:music", value: genreTagId("indie_folk") },
      { name: "Busking", tag_id: "notonq:urn:tag:genre:busking", type: "urn:tag:genre", value: "notonq:urn:tag:genre:busking" },
    ],
  };
}

const filledBlock = { served_by: "fallback", gap: { kind: "G1", qloo_status: 404, qloo_message: "No results" }, research: { status: "none" } };

function body(results: unknown, notonq: object): Response {
  return new Response(JSON.stringify({ success: true, results, notonq, duration: 42 }), { status: 200, headers: { "content-type": "application/json" } });
}

export type NotOnQMock = { response: Response } | { search: URLSearchParams; notonq: object } | null;

/** What the mock NotOnQ does with a request: answer it itself (G1), swap its signal for stand-ins (G2), or nothing (null). */
export function notOnQMock(path: string, search: URLSearchParams): NotOnQMock {
  if (path === "/search" && normalizeName(search.get("query") ?? "") === normalizeName(ACT.name)) return { response: body([filledArtist()], filledBlock) };
  if (path === "/entities" && (search.get("entity_ids") ?? "").split(",").map((s) => s.trim()).includes(NOTONQ_FILLED_ID)) return { response: body([filledArtist()], filledBlock) };
  if (path !== "/v2/insights" && path !== "/v2/analysis/compare") return null;
  const next = new URLSearchParams(search);
  let swapped = false;
  for (const key of ["signal.interests.entities", "a.signal.interests.entities", "b.signal.interests.entities"]) {
    const ids = (search.get(key) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.includes(NOTONQ_FILLED_ID)) continue;
    swapped = true;
    next.set(key, [...new Set(ids.flatMap((id) => (id === NOTONQ_FILLED_ID ? standIns().map((s) => s.entity_id) : [id])))].join(","));
  }
  const ranked = (search.get("filter.results.entities") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const unranked = ranked.includes(NOTONQ_FILLED_ID);
  if (unranked) {
    const rest = ranked.filter((id) => id !== NOTONQ_FILLED_ID);
    if (rest.length === 0) return { response: body({ entities: [] }, { served_by: "mixed", gap: { kind: "G2" }, unranked: [NOTONQ_FILLED_ID] }) };
    next.set("filter.results.entities", rest.join(","));
  }
  if (!swapped && !unranked) return null;
  return {
    search: next,
    notonq: { served_by: "mixed", gap: { kind: "G2" }, ...(swapped ? { proxy: { replaced: [NOTONQ_FILLED_ID], stand_ins: standIns() } } : {}), ...(unranked ? { unranked: [NOTONQ_FILLED_ID] } : {}) },
  };
}
