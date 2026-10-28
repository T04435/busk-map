import { describe, expect, it } from "vitest";
import { OFFLINE_TEST_ACTS } from "@/lib/repertoire-research";
import { CATALOG } from "@/server/qloo-mock/catalog";
import { handleQlooMock } from "@/server/qloo-mock/handler";
import { NOTONQ_FILLED_ID } from "@/server/qloo-mock/notonq";

/** The Qloo mock playing the NotOnQ proxy for one offline test act (qloo-mock/notonq.ts). */
const get = async (path: string, params: Record<string, string>) => {
  const res = await handleQlooMock(new Request(`https://qloo-mock.invalid${path}?${new URLSearchParams(params)}`, { headers: { "x-api-key": "k" } }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- loose JSON from the mock, read field by field
  return { status: res.status, body: (await res.json()) as Record<string, any> };
};
const idOf = (name: string) => CATALOG.find((a) => a.name === name)!.id;
const STAND_INS = OFFLINE_TEST_ACTS.notonq.standIns;

describe("the mock NotOnQ", () => {
  it("G1: /search and /entities answer the filled-in artist, labelled 'Not in Qloo', served by fallback", async () => {
    const search = await get("/search", { query: "nqo filled", types: "urn:entity:artist" });
    expect(search.body.notonq).toMatchObject({ served_by: "fallback", gap: { kind: "G1" } });
    expect(search.body.results[0]).toMatchObject({ entity_id: NOTONQ_FILLED_ID, name: OFFLINE_TEST_ACTS.notonq.name });
    expect(search.body.results[0].properties.short_description).toMatch(/^Not in Qloo: filled by NotOnQ/);
    const byId = await get("/entities", { entity_ids: NOTONQ_FILLED_ID });
    expect(byId.body.results[0].entity_id).toBe(NOTONQ_FILLED_ID);
    // Any other name is the mock's plain Qloo answer.
    expect((await get("/search", { query: "Julia Jacklin" })).body.notonq).toBeUndefined();
  });

  it("G2: the filled artist as a signal is swapped for its stand-ins, in insights and in either compare group", async () => {
    const heat = await get("/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": NOTONQ_FILLED_ID });
    expect(heat.status).toBe(200);
    expect(heat.body.notonq).toMatchObject({ served_by: "mixed", gap: { kind: "G2" }, proxy: { replaced: [NOTONQ_FILLED_ID] } });
    expect(heat.body.notonq.proxy.stand_ins.map((s: { name: string }) => s.name)).toEqual([...STAND_INS]);
    expect(heat.body.results.demographics.map((r: { entity_id: string }) => r.entity_id)).toEqual(STAND_INS.map(idOf));
    const compare = await get("/v2/analysis/compare", { "a.signal.interests.entities": NOTONQ_FILLED_ID, "b.signal.interests.entities": idOf("Julia Jacklin") });
    expect(compare.body.notonq).toMatchObject({ served_by: "mixed" });
    expect(compare.body.results.a.length).toBeGreaterThan(0);
  });

  it("leaves the filled artist out of a list being ranked (unranked), and answers empty when it was the only one", async () => {
    const only = await get("/v2/insights", { "filter.type": "urn:entity:artist", "filter.results.entities": NOTONQ_FILLED_ID, "signal.interests.entities": idOf("Julia Jacklin") });
    expect(only.body).toMatchObject({ results: { entities: [] }, notonq: { unranked: [NOTONQ_FILLED_ID] } });
    const mixed = await get("/v2/insights", { "filter.type": "urn:entity:artist", "filter.results.entities": `${NOTONQ_FILLED_ID},${idOf("Paul Kelly")}`, "signal.interests.entities": idOf("Julia Jacklin") });
    expect(mixed.body.results.entities.map((e: { name: string }) => e.name)).toEqual(["Paul Kelly"]);
    expect(mixed.body.notonq).toMatchObject({ served_by: "mixed", unranked: [NOTONQ_FILLED_ID] });
    expect(mixed.body.notonq.proxy).toBeUndefined();
  });

  it("keeps the mock's errors as they are under a swapped signal", async () => {
    const bad = await get("/v2/insights", { "signal.interests.entities": NOTONQ_FILLED_ID });
    expect(bad.status).toBe(400);
    expect(bad.body.notonq).toBeUndefined();
  });
});
