import { afterEach, describe, expect, it, vi } from "vitest";
import { EXAMPLES } from "@/lib/examples";
import { defaultDays, weekStreamEventSchema, type WeekStreamEvent } from "@/lib/week-schema";
import { createRateLimiter, FRESH_RUNS_PER_HOUR, WEEK_RUN_WEIGHT, weekRunGate } from "@/server/rate-limit";
import { mockFetch } from "../../helpers";

const START = "2026-10-15";
const OFFLINE_ENV = { BUSKMAP_OFFLINE: "1", BUSKMAP_ALLOW_FAULTS: "1", BUSKMAP_FAKE_NOW: "2026-10-15T12:00:00+11:00", VERCEL: "" };

async function load() {
  vi.resetModules();
  for (const [key, value] of Object.entries(OFFLINE_ENV)) vi.stubEnv(key, value);
  mockFetch([]);
  const route = await import("@/app/api/week/route");
  const one = await import("@/app/api/week/[id]/route");
  const ics = await import("@/app/api/week/ics/route");
  const plans = await import("@/server/plans/store");
  return { POST: route.POST, GET: one.GET, ICS: ics.GET, plans };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const body = (extra: Record<string, unknown> = {}) => JSON.stringify({ performer: EXAMPLES[0].performer, startDate: START, days: defaultDays(START), ...extra });
const post = (payload: string, headers: HeadersInit = {}) => new Request("http://localhost:3100/api/week", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: payload });

async function events(res: Response): Promise<WeekStreamEvent[]> {
  const text = await res.text();
  return text.split("\n").filter(Boolean).map((line) => weekStreamEventSchema.parse(JSON.parse(line)));
}

describe("POST /api/week (offline)", () => {
  it("streams the run, stores each ready day as a busk plan and the week as /w/<id>, which replays and exports to a calendar", async () => {
    const { POST, GET, ICS, plans } = await load();
    const res = await POST(post(body()));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/ndjson/);
    const all = await events(res);
    const started = all[0];
    expect(started.type).toBe("week-started");
    const id = started.type === "week-started" ? started.week.id! : "";
    expect(id).toMatch(/^[0-9A-Za-z]{9}$/);
    expect(res.headers.get("x-week-id")).toBe(id);
    expect(all.some((e) => e.type === "tool-start")).toBe(true);
    const last = all.at(-1)!;
    expect(last.type).toBe("week");
    if (last.type !== "week") return;
    expect(last.week).toMatchObject({ id, status: "done" });
    expect(last.week.days).toHaveLength(7);
    const ready = last.week.days.filter((d) => d.status === "ready");
    expect(ready.length).toBeGreaterThan(0);
    // Each ready day is a normal stored busk plan whose replay is that day's own steps.
    for (const day of ready) {
      const stored = await plans.shortPlanStore(true).get(day.planId!);
      expect(stored?.request.slot.date).toBe(day.date);
      expect(stored?.snapshot?.plan.pitches[0].id).toBe(day.pitch!.id);
      expect(stored?.snapshot?.events.some((e) => e.type === "tool-end")).toBe(true);
    }

    // The record replays: the same days, and the run's steps.
    const again = await GET(new Request(`http://localhost:3100/api/week/${id}`), { params: Promise.resolve({ id }) } as never);
    const loaded = await again.json();
    expect(loaded.week.days.map((d: { status: string }) => d.status)).toEqual(last.week.days.map((d) => d.status));
    expect(loaded.week.days.map((d: { planId: string | null }) => d.planId)).toEqual(last.week.days.map((d) => d.planId));
    expect(loaded.events.filter((e: { type: string }) => e.type === "tool-start").length).toBe(all.filter((e) => e.type === "tool-start").length);

    // The calendar: one event per ready day, linking to its plan; no fetch at all (stored plans only).
    const fetches = vi.mocked(fetch).mock.calls.length;
    const cal = await ICS(new Request(`http://localhost:3100/api/week/ics?id=${id}`));
    expect(cal.status).toBe(200);
    expect(cal.headers.get("content-type")).toMatch(/text\/calendar/);
    expect(cal.headers.get("content-disposition")).toMatch(/attachment; filename="busk-map-week-2026-10-15\.ics"/);
    const ics = await cal.text();
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(ready.length);
    expect(ics.replace(/\r\n /g, "")).toContain(`URL:http://localhost:3100/p/${ready[0].planId}`);
    expect(vi.mocked(fetch).mock.calls.length).toBe(fetches);
  });

  it("refuses bad requests, a week with no day left, a spent Qloo budget and the forced limit, before any run", async () => {
    const { POST, GET, ICS } = await load();
    expect((await POST(post("{"))).status).toBe(400);
    const invalid = await POST(post(body({ days: defaultDays("2026-10-20") })));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).error.code).toBe("invalid_request");
    const off = await POST(post(body({ days: defaultDays(START).map((d, i) => (i === 0 ? { date: d.date, startHour: 9, endHour: 12 } : { date: d.date, off: true })) })));
    expect((await off.json()).error.code).toBe("no_days_left");
    const budget = await POST(post(body(), { "x-buskmap-faults": "qloo-budget" }));
    expect(budget.status).toBe(503);
    expect((await budget.json()).error.code).toBe("qloo_budget_spent");
    const limited = await POST(post(body(), { "x-buskmap-faults": "fresh-limit" }));
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.message).toMatch(/A week counts as 4 plans/);
    expect((await GET(new Request("http://localhost/api/week/nope"), { params: Promise.resolve({ id: "nope" }) } as never)).status).toBe(404);
    expect((await ICS(new Request("http://localhost/api/week/ics"))).status).toBe(400);
    expect((await ICS(new Request("http://localhost/api/week/ics?id=AAAAAAAAA"))).status).toBe(404);
  });

  it("Qloo down ends the stream with an error and a failed record", async () => {
    const { POST, GET } = await load();
    const all = await events(await POST(post(body(), { "x-buskmap-faults": "qloo" })));
    const last = all.at(-1)!;
    expect(last).toMatchObject({ type: "error", code: "qloo_unavailable" });
    const id = all[0].type === "week-started" ? all[0].week.id! : "";
    const loaded = await (await GET(new Request(`http://localhost/api/week/${id}`), { params: Promise.resolve({ id }) } as never)).json();
    expect(loaded.week).toMatchObject({ status: "failed", error: { code: "qloo_unavailable" } });
    expect(loaded.week.days.every((d: { status: string }) => d.status === "failed")).toBe(true);
  });
});

describe("week runs count as several fresh plans", () => {
  it("takes WEEK_RUN_WEIGHT hits of the hourly limit and refuses when they don't fit", () => {
    const limiter = createRateLimiter(FRESH_RUNS_PER_HOUR, 60 * 60_000);
    const now = Date.parse("2026-10-16T23:00:00Z");
    const ip = "10.0.0.9";
    const weeks = Math.floor(FRESH_RUNS_PER_HOUR / WEEK_RUN_WEIGHT);
    for (let i = 0; i < weeks; i++) expect(weekRunGate({ offline: false, ip }, limiter, now + i * 1000)).toEqual({ ok: true });
    const refused = weekRunGate({ offline: false, ip }, limiter, now + 10 * 60_000);
    expect(refused).toMatchObject({ ok: false });
    // Two plans are left of the hour: a week (4) doesn't fit, but two busks still do.
    expect(limiter.check(ip, now + 10 * 60_000)).toEqual({ ok: true, retryAfterS: 0 });
    expect(weekRunGate({ offline: true, ip }, limiter, now)).toEqual({ ok: true });
  });
});
