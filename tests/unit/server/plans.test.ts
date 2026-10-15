import { describe, expect, it, vi } from "vitest";
import { planRequestSchema, type Plan, type PlanRequest, type PlanStreamEvent } from "@/lib/plan-schema";
import { parsePlanParams } from "@/lib/plan-url";
import { encodeTipCookie, type TipHistory } from "@/lib/tips";

async function load() {
  vi.resetModules();
  const store = await import("@/server/plans/store");
  const plans = await import("@/server/plans");
  const { planKey } = await import("@/server/agent/plan-store");
  // Stores live on globalThis (one per process): start each test clean.
  store.resetShortPlanStoresForTests();
  return { ...store, ...plans, planKey };
}

const NOW = new Date("2026-10-16T02:00:00Z"); // 1 pm in Melbourne, 16 Oct
const DAY = "2026-10-16";

const habana = (extra: Partial<PlanRequest> = {}): PlanRequest =>
  planRequestSchema.parse({
    city: "melbourne",
    slot: { date: "2026-10-17", startHour: 18, endHour: 21 },
    permit: "general",
    performer: {
      name: "Habana Street Trio",
      artists: ["Compay Segundo", "Celia Cruz"],
      spotifyArtists: [{ name: "Compay Segundo", id: "2wPsNCwhEGb0KvChZ5DD52" }],
      songs: [{ title: "Quimbara", artist: "Celia Cruz", durationMs: 326_000 }],
    },
    ...extra,
  });

const history: TipHistory = { source: "yours", sessions: 3, perHour: 40, pitches: [{ id: "p1", sessions: 2, perHour: 55 }] };

const planEvent = (explanations: "ai" | "template" = "ai"): PlanStreamEvent => ({ type: "plan", plan: { explanations, pitches: [] } as unknown as Plan });
const step: PlanStreamEvent = { type: "tool-start", id: "1", tool: "taste_map", label: "Mapping" };
const finishedRun = (explanations: "ai" | "template" = "ai") => ({ events: [step, planEvent(explanations)], startedAt: 1, finishedAt: 2, ok: true });

describe("plan request hashing", () => {
  it("is canonical: key order doesn't matter, the tip history is never part of it", async () => {
    const { canonicalJson, requestHash, storedRequestOf } = await load();
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 2 } })).toBe('{"a":{"c":2,"d":[3,{"y":2,"z":1}]},"b":1}');
    const a = habana();
    const reordered = JSON.parse(JSON.stringify({ slot: a.slot, performer: a.performer, permit: a.permit, city: a.city }));
    expect(requestHash(storedRequestOf(a), null)).toBe(requestHash(reordered, null));
    expect(storedRequestOf({ ...a, history })).not.toHaveProperty("history");
    expect(requestHash(storedRequestOf({ ...a, history }), null)).toBe(requestHash(storedRequestOf(a), null));
    expect(requestHash(storedRequestOf(a), "acoustic")).not.toBe(requestHash(storedRequestOf(a), null));
  });
});

describe("short plan store (memory)", () => {
  it("dedupes: the same request on the same day gets the same id; another day or request gets a new one", async () => {
    const { MemoryShortPlanStore, createPlanId, findPlanId } = await load();
    const store = new MemoryShortPlanStore();
    expect(await findPlanId(store, habana(), null, DAY)).toBeNull();
    const id = await createPlanId(store, habana(), null, DAY);
    expect(await findPlanId(store, habana(), null, DAY)).toBe(id);
    // The tip history isn't part of the request: same id.
    expect(await findPlanId(store, habana({ history }), null, DAY)).toBe(id);
    expect(await findPlanId(store, habana(), null, "2026-10-17")).toBeNull();
    expect(await findPlanId(store, habana({ permit: "premium" }), null, DAY)).toBeNull();
    expect(await createPlanId(store, habana({ permit: "premium" }), null, DAY)).not.toBe(id);
    expect(store.rows.size).toBe(2);
  });

  it("stores the request without the tip history, and reads it back", async () => {
    const { MemoryShortPlanStore, createPlanId } = await load();
    const store = new MemoryShortPlanStore();
    const id = await createPlanId(store, habana({ history }), "acoustic", DAY);
    const row = await store.get(id);
    expect(row).toMatchObject({ id, exampleId: "acoustic", day: DAY, snapshot: null });
    expect(row!.request).not.toHaveProperty("history");
    expect(row!.request.performer.name).toBe("Habana Street Trio");
    expect(row).not.toHaveProperty("requestHash");
    expect(await store.get("Zzzzzzzzz")).toBeNull();
  });

  it("retries an id collision with a new id", async () => {
    const { MemoryShortPlanStore, createPlanId } = await load();
    const store = new MemoryShortPlanStore();
    const ids = ["AAAAAAAAA", "AAAAAAAAA", "BBBBBBBBB"];
    const makeId = () => ids.shift()!;
    expect(await createPlanId(store, habana(), null, DAY, makeId)).toBe("AAAAAAAAA");
    expect(await createPlanId(store, habana({ permit: "premium" }), null, DAY, makeId)).toBe("BBBBBBBBB");
  });

  it("gives up after five collisions", async () => {
    const { MemoryShortPlanStore, createPlanId } = await load();
    const store = new MemoryShortPlanStore();
    await createPlanId(store, habana(), null, DAY, () => "AAAAAAAAA");
    await expect(createPlanId(store, habana({ permit: "premium" }), null, DAY, () => "AAAAAAAAA")).rejects.toThrow("could not allocate");
  });

  it("returns the other request's id when two requests race to create it", async () => {
    const { createPlanId } = await load();
    let finds = 0;
    const store = {
      kind: "memory" as const,
      findByRequest: vi.fn(async () => (finds++ === 0 ? "RaceWin01" : null)),
      insert: vi.fn(async () => "duplicate-request" as const),
      get: vi.fn(),
      saveSnapshot: vi.fn(),
      pruneRawSteps: vi.fn(),
    };
    expect(await createPlanId(store, habana(), null, DAY)).toBe("RaceWin01");
    expect(store.insert).toHaveBeenCalledTimes(1);
  });

  it("keeps the first snapshot unless asked to overwrite", async () => {
    const { MemoryShortPlanStore, createPlanId } = await load();
    const store = new MemoryShortPlanStore();
    const id = await createPlanId(store, habana(), null, DAY);
    const snap = (runKey: string) => ({ plan: {} as Plan, events: [step], explanations: "ai" as const, runKey, runDay: DAY, startedAt: 1, finishedAt: 2 });
    expect(await store.saveSnapshot(id, snap("first"), false)).toBe(true);
    expect(await store.saveSnapshot(id, snap("second"), false)).toBe(false);
    expect((await store.get(id))!.snapshot!.runKey).toBe("first");
    expect(await store.saveSnapshot(id, snap("fresh"), true)).toBe(true);
    expect((await store.get(id))!.snapshot!.runKey).toBe("fresh");
    expect(await store.saveSnapshot("NoSuchId0", snap("x"), true)).toBe(false);
  });
});

describe("store selection", () => {
  it("without DATABASE_URL: memory, with one log line", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { shortPlanStore, linksDurable } = await load();
    const { log } = await import("@/server/log");
    const info = vi.spyOn(log, "info").mockImplementation(() => {});
    const store = shortPlanStore(false);
    expect(store.kind).toBe("memory");
    expect(shortPlanStore(false)).toBe(store);
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toMatch(/DATABASE_URL is not set/);
    // One long-lived local server: memory links work. On Vercel they wouldn't survive: keep the long URL.
    vi.stubEnv("VERCEL", "");
    expect(linksDurable(store)).toBe(true);
    vi.stubEnv("VERCEL", "1");
    expect(linksDurable(store)).toBe(false);
  });

  it("with DATABASE_URL: Postgres; offline (tests): memory", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@example.invalid/db");
    const { shortPlanStore, linksDurable } = await load();
    expect(shortPlanStore(false).kind).toBe("postgres");
    vi.stubEnv("VERCEL", "1");
    expect(linksDurable(shortPlanStore(false))).toBe(true);
    expect(shortPlanStore(true).kind).toBe("memory");
  });
});

describe("resolving links", () => {
  it("reuses today's id, and rate-limits only new ids", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "");
    const { resolvePlanLink } = await load();
    const first = await resolvePlanLink(habana(), null, "10.0.0.1", NOW);
    expect(first.id).toMatch(/^[0-9A-Za-z]{9}$/);
    // 30 new links per 10 minutes per IP; the first one used one.
    for (let h = 0; h < 29; h++) {
      expect((await resolvePlanLink(habana({ slot: { date: "2026-10-18", startHour: h % 18, endHour: (h % 18) + 1 + Math.floor(h / 18) } }), null, "10.0.0.1", NOW)).id).not.toBeNull();
    }
    expect(await resolvePlanLink(habana({ permit: "premium" }), null, "10.0.0.1", NOW)).toEqual({ id: null, reason: "rate_limited" });
    // Reusing an existing id is free, and other IPs are unaffected.
    expect(await resolvePlanLink(habana(), null, "10.0.0.1", NOW)).toEqual(first);
    expect((await resolvePlanLink(habana({ permit: "premium" }), null, "10.0.0.2", NOW)).id).not.toBeNull();
  });

  it("keeps the long URL when links wouldn't last, or the store fails", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "1");
    const mod = await load();
    expect(await mod.resolvePlanLink(habana(), null, "ip", NOW)).toEqual({ id: null, reason: "not_durable" });
    vi.stubEnv("VERCEL", "");
    const { log } = await import("@/server/log");
    vi.spyOn(log, "warn").mockImplementation(() => {});
    vi.spyOn(mod.MemoryShortPlanStore.prototype, "findByRequest").mockRejectedValueOnce(new Error("down"));
    expect(await mod.resolvePlanLink(habana(), null, "ip", NOW)).toEqual({ id: null, reason: "error" });
  });

  it("redirects long URLs to their short link, keeping the view parameters", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "");
    const { longUrlTarget, loadStoredPlan } = await load();
    const params = {
      name: "Habana Street Trio",
      artists: "Compay Segundo~2wPsNCwhEGb0KvChZ5DD52|Celia Cruz",
      songs: "Quimbara~Celia Cruz~326s",
      date: "2026-10-17",
      from: "18",
      to: "21",
      permit: "general",
      run: "1",
    };
    const parsed = parsePlanParams(params, DAY);
    const target = await longUrlTarget(parsed, params, [], "ip", NOW);
    expect(target).toMatch(/^\/p\/[0-9A-Za-z]{9}$/);
    // The same long URL (a reload, or a share) maps to the same id.
    expect(await longUrlTarget(parsePlanParams(params, DAY), params, [], "ip", NOW)).toBe(target);
    const stored = await loadStoredPlan(target!.slice(3));
    expect(stored!.request.performer.songs[0]).toMatchObject({ title: "Quimbara", artist: "Celia Cruz", durationMs: 326_000 });
    // pitch and run=0 are view state: kept. run=1 is the default: dropped.
    const withView = { ...params, pitch: "fed-square", run: "0" };
    expect(await longUrlTarget(parsePlanParams(withView, DAY), withView, [], "ip", NOW)).toBe(`${target}?pitch=fed-square&run=0`);
    // Examples get their own id (with the example id).
    const example = parsePlanParams({ example: "sax" }, DAY);
    const exampleTarget = await longUrlTarget(example, { example: "sax" }, [], "ip", NOW);
    expect(exampleTarget).toMatch(/^\/p\/[0-9A-Za-z]{9}$/);
    expect((await loadStoredPlan(exampleTarget!.slice(3)))!.exampleId).toBe("sax");
    // Simulated outages (tests) and unreadable URLs stay on the long URL.
    expect(await longUrlTarget(parsed, params, ["qloo"], "ip", NOW)).toBeNull();
    expect(await longUrlTarget(parsePlanParams({ name: "Nobody" }, DAY), { name: "Nobody" }, [], "ip", NOW)).toBeNull();
  });

  it("loads only well-formed ids", async () => {
    const { loadStoredPlan } = await load();
    expect(await loadStoredPlan("short")).toBeNull();
    expect(await loadStoredPlan("../../../x")).toBeNull();
    expect(await loadStoredPlan("Zz9Zz9Zz9")).toBeNull();
  });
});

describe("opening a stored plan", () => {
  it("adds the viewer's own tip history, and shows the stored run only when it was made with the same history", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "");
    const { resolvePlanLink, loadStoredPlan, viewerRequest, saveRunSnapshot, snapshotFor, snapshotEvents, planKey } = await load();
    const { id } = (await resolvePlanLink(habana(), null, "ip", NOW)) as { id: string };
    const stored = (await loadStoredPlan(id))!;
    const request = viewerRequest(stored, null)!;
    expect(request.history).toBeUndefined();
    const cookie = encodeTipCookie({ "act:habana street trio": history });
    expect(viewerRequest(stored, cookie)!.history).toMatchObject({ sessions: 3 });

    const runKey = planKey(request, false, DAY);
    expect(await saveRunSnapshot(id, request, finishedRun(), runKey, DAY, false)).toBe(true);
    const withRun = (await loadStoredPlan(id))!;
    const snapshot = snapshotFor(withRun, request, false)!;
    expect(snapshot.events).toEqual([step]);
    expect(snapshotEvents(snapshot).map((e) => e.type)).toEqual(["tool-start", "plan"]);
    // A viewer with their own tip log gets a new run (the bonus changes the plan), not the stored one.
    expect(snapshotFor(withRun, viewerRequest(withRun, cookie)!, false)).toBeNull();
  });

  it("keeps only Claude's finished runs, on the plan they were made for", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "");
    const { resolvePlanLink, saveRunSnapshot, loadStoredPlan } = await load();
    const { id } = (await resolvePlanLink(habana(), null, "ip", NOW)) as { id: string };
    expect(await saveRunSnapshot(id, habana({ permit: "premium" }), finishedRun(), "k", DAY, false)).toBe(false);
    expect(await saveRunSnapshot(id, habana(), finishedRun("template"), "k", DAY, false)).toBe(false);
    expect(await saveRunSnapshot(id, habana(), { ...finishedRun(), ok: false }, "k", DAY, false)).toBe(false);
    expect(await saveRunSnapshot(id, habana(), { ...finishedRun(), finishedAt: null }, "k", DAY, false)).toBe(false);
    expect(await saveRunSnapshot("bad id", habana(), finishedRun(), "k", DAY, false)).toBe(false);
    expect(await saveRunSnapshot("NoSuchId0", habana(), finishedRun(), "k", DAY, false)).toBe(false);
    expect((await loadStoredPlan(id))!.snapshot).toBeNull();
    // The history doesn't matter for which plan it is (the run key records it).
    expect(await saveRunSnapshot(id, habana({ history }), finishedRun(), "k1", DAY, false)).toBe(true);
    expect(await saveRunSnapshot(id, habana(), finishedRun(), "k2", DAY, false)).toBe(false);
    expect(await saveRunSnapshot(id, habana(), finishedRun(), "k3", DAY, true)).toBe(true);
    expect((await loadStoredPlan(id))!.snapshot!.runKey).toBe("k3");
  });

  it("knows when the slot has passed (city time)", async () => {
    const { slotPassed } = await load();
    const slot = { date: "2026-10-16", startHour: 18, endHour: 21 };
    // 21:00 in Melbourne (AEDT, UTC+11) is 10:00 UTC.
    expect(slotPassed(slot, "Australia/Melbourne", Date.parse("2026-10-16T09:59:00Z"))).toBe(false);
    expect(slotPassed(slot, "Australia/Melbourne", Date.parse("2026-10-16T10:00:00Z"))).toBe(true);
    expect(slotPassed({ ...slot, date: "2026-10-15" }, "Australia/Melbourne", NOW.getTime())).toBe(true);
  });

  it("allows fresh runs outside production builds only", async () => {
    const { freshRunsAllowed } = await load();
    vi.stubEnv("NODE_ENV", "production");
    expect(freshRunsAllowed()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    expect(freshRunsAllowed()).toBe(true);
  });
});

describe("short plan store (Postgres)", () => {
  it("inserts with dedupe on (request_hash, day), maps a collision and a race, reads and snapshots; no DDL", async () => {
    const { PostgresShortPlanStore } = await load();
    const queries: { text: string; params?: unknown[] }[] = [];
    let insertResult: () => Promise<unknown[]> = async () => [{ id: "AAAAAAAAA" }];
    const sql = {
      query: vi.fn(async (text: string, params?: unknown[]): Promise<unknown[]> => {
        queries.push({ text, params });
        if (text.startsWith("INSERT")) return insertResult();
        if (text.startsWith("SELECT id FROM")) return [{ id: "AAAAAAAAA" }];
        if (text.trim().startsWith("SELECT"))
          return [
            {
              id: "AAAAAAAAA",
              request: { performer: { name: "Habana Street Trio" } },
              example_id: null,
              day: DAY,
              created_at: "2026-10-16T02:00:00Z",
              plan: { explanations: "ai" },
              steps: [step],
              explanations: "ai",
              run_key: "k",
              run_day: DAY,
              run_started_at: "2026-10-16T02:00:01Z",
              finished_at: "2026-10-16T02:00:31Z",
            },
          ];
        if (text.trim().startsWith("UPDATE")) return [{ id: "AAAAAAAAA" }];
        return [];
      }),
    };
    const store = new PostgresShortPlanStore(sql as never);
    const row = { id: "AAAAAAAAA", request: { city: "melbourne" } as never, requestHash: "h", exampleId: null, day: DAY };
    expect(await store.insert(row)).toBe("ok");
    expect(queries[0].text).toContain("ON CONFLICT (request_hash, day) DO NOTHING");
    expect(queries[0].params).toEqual(["AAAAAAAAA", '{"city":"melbourne"}', "h", null, DAY]);
    insertResult = async () => [];
    expect(await store.insert(row)).toBe("duplicate-request");
    insertResult = () => Promise.reject(Object.assign(new Error("duplicate key value violates unique constraint \"plans_pkey\""), { code: "23505" }));
    expect(await store.insert(row)).toBe("id-taken");
    insertResult = () => Promise.reject(new Error("down"));
    await expect(store.insert(row)).rejects.toThrow("down");
    expect(await store.findByRequest("h", DAY)).toBe("AAAAAAAAA");

    const got = (await store.get("AAAAAAAAA"))!;
    expect(got).toMatchObject({ id: "AAAAAAAAA", exampleId: null, day: DAY, createdAt: Date.parse("2026-10-16T02:00:00Z") });
    expect(got.snapshot).toMatchObject({ runKey: "k", runDay: DAY, explanations: "ai", events: [step], startedAt: Date.parse("2026-10-16T02:00:01Z"), finishedAt: Date.parse("2026-10-16T02:00:31Z") });

    expect(await store.saveSnapshot("AAAAAAAAA", { ...got.snapshot! }, false)).toBe(true);
    const update = queries.find((q) => q.text.trim().startsWith("UPDATE"))!;
    expect(update.text).toContain("($9::boolean OR plan IS NULL)");
    expect(update.params!.at(-1)).toBe(false);
    // Migrations run ahead of time (scripts/migrate.mjs), never from the app.
    expect(queries.filter((q) => /CREATE|ALTER|DROP/.test(q.text))).toHaveLength(0);
  });

  it("reads a plan without a finished run as no snapshot", async () => {
    const { PostgresShortPlanStore } = await load();
    const sql = {
      query: vi.fn(async (): Promise<unknown[]> => [
        { id: "AAAAAAAAA", request: {}, example_id: "sax", day: DAY, created_at: new Date(0), plan: null, steps: null, explanations: null, run_key: null, run_day: null, run_started_at: null, finished_at: null },
      ]),
    };
    const store = new PostgresShortPlanStore(sql as never);
    expect((await store.get("AAAAAAAAA"))!.snapshot).toBeNull();
    sql.query.mockResolvedValueOnce([]);
    expect(await store.get("AAAAAAAAA")).toBeNull();
  });
});
