import "server-only";
import { isPlanId, newPlanId, planPath } from "@/lib/plan-id";
import type { Plan, PlanStreamEvent } from "@/lib/plan-schema";
import { buildIcs, type IcsEvent } from "@/lib/ics";
import { zonedHourToUtc } from "@/lib/slot";
import { weekRequestSchema, weekResultSchema, type WeekRequest, type WeekResult, type WeekStepEvent } from "@/lib/week-schema";
import { planKey } from "@/server/agent/plan-store";
import { dayFromPlan, weekShell, type DayOutcome } from "@/server/agent/week";
import { rulesFor } from "@/server/cities";
import { log } from "@/server/log";
import { createPlanId, findPlanId, linksDurable, shortPlanStore } from "@/server/plans/store";
import { weekStore, type WeekFinish, type WeekRecordDay } from "./store";

/**
 * A week is its day plans: each planned day becomes a normal busk plan behind its own short id (/p/<id>), with that day's
 * steps as its replay. The week record (/w/<id>, store.ts) lists the seven days and keeps the whole run's steps.
 */

/** A run still "running" this long after it started was cut off (a restart, a crash): shown as failed. */
export const WEEK_RUN_STALE_MS = 6 * 60_000;

/** The run's events that belong to one day: its own tool calls (by id) and the notes just before them. */
export function dayEvents(events: readonly PlanStreamEvent[], toolCallIds: Set<string>): PlanStreamEvent[] {
  const out: PlanStreamEvent[] = [];
  let notes: PlanStreamEvent[] = [];
  for (const e of events) {
    if (e.type === "note") notes.push(e);
    else if ((e.type === "tool-start" || e.type === "tool-end") && toolCallIds.has(e.id)) {
      out.push(...notes, e);
      notes = [];
    } else if (e.type === "tool-start") notes = [];
  }
  return out;
}

/**
 * Store each planned day as a plan with its own short id, and its run as the plan's snapshot, so /p/<id> opens at once as a
 * replay. A day already planned today with the same request keeps its id; the week's run replaces its snapshot. Returns the id
 * per date; a day that couldn't be stored has none.
 */
export async function saveDayPlans(outcomes: DayOutcome[], events: readonly PlanStreamEvent[], run: { startedAt: number; finishedAt: number; today: string; offline: boolean }): Promise<Map<string, string>> {
  const store = shortPlanStore(run.offline);
  const ids = new Map<string, string>();
  if (!linksDurable(store)) return ids;
  for (const day of outcomes) {
    try {
      const id = (await findPlanId(store, day.request, null, run.today)) ?? (await createPlanId(store, day.request, null, run.today));
      const own = dayEvents(events, day.toolCallIds);
      const saved = await store.saveSnapshot(
        id,
        {
          plan: day.plan,
          events: [{ type: "status", message: "Planned as part of your week" }, ...own, ...(day.plan.researchTotals ? [{ type: "totals" as const, totals: day.plan.researchTotals }] : [])],
          explanations: day.plan.explanations,
          runKey: planKey(day.request, run.offline, run.today),
          runDay: run.today,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
        },
        true,
      );
      if (saved) ids.set(day.date, id);
    } catch (error) {
      log.warn("week day plan not stored", { date: day.date, error: error instanceof Error ? error.message : "unknown" });
    }
  }
  return ids;
}

/** The record's days from a week result. */
export const recordDays = (week: Pick<WeekResult, "days">): WeekRecordDay[] => week.days.map((d) => ({ date: d.date, status: d.status, planId: d.planId, reason: d.reason }));

/**
 * Start a week: its record, running, with a new /w/<id>. The id is null when the record can't be kept (no durable store, or
 * a store error): the run still goes, the page just can't reopen it.
 */
export async function startWeek(request: WeekRequest, shell: WeekResult, offline: boolean): Promise<string | null> {
  const store = weekStore(offline);
  if (store.kind === "memory" && process.env.VERCEL) return null;
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const id = newPlanId();
      if (await store.insert({ id, request, days: recordDays(shell) })) return id;
    }
  } catch (error) {
    log.warn("week record not made", { error: error instanceof Error ? error.message : "unknown" });
  }
  return null;
}

/** Record how a week ended (once: a later end is ignored). Never throws. */
export async function finishWeek(id: string | null, offline: boolean, result: WeekFinish): Promise<boolean> {
  if (!id) return false;
  try {
    return await weekStore(offline).finish(id, result);
  } catch (error) {
    log.warn("week record not finished", { id, error: error instanceof Error ? error.message : "unknown" });
    return false;
  }
}

/** A finished (or failed) week as its record keeps it. */
export function finishOf(week: WeekResult, events: readonly WeekStepEvent[]): WeekFinish {
  return { status: week.status, days: recordDays(week), summary: week.summary, notes: week.notes, events: [...events], usage: week.usage, totals: week.researchTotals, error: week.error };
}

export type LoadedWeek = { week: WeekResult; events: WeekStepEvent[]; request: WeekRequest; plans: Map<string, Plan> };

/**
 * The week behind /w/<id>: the record, with each ready day read from its stored plan, and the run's steps. A run left
 * "running" past WEEK_RUN_STALE_MS shows as failed. Null for an unknown id. A store error throws.
 */
export async function loadWeek(id: string, offline: boolean, now = Date.now()): Promise<LoadedWeek | null> {
  if (!isPlanId(id)) return null;
  const record = await weekStore(offline).get(id);
  if (!record) return null;
  const request = weekRequestSchema.safeParse(record.request);
  if (!request.success) return null;
  const stale = record.status === "running" && now - record.createdAt > WEEK_RUN_STALE_MS;
  const shell = weekShell(id, request.data, record.days, { offline });
  const store = shortPlanStore(offline);
  const plans = new Map<string, Plan>();
  const days = await Promise.all(
    shell.days.map(async (day) => {
      if (day.status === "ready" && day.planId) {
        const plan = (await store.get(day.planId).catch(() => null))?.snapshot?.plan ?? null;
        if (!plan) return { ...day, status: "failed" as const, reason: "This day's plan is no longer stored." };
        plans.set(day.date, plan);
        return dayFromPlan(day, day.planId, plan);
      }
      if (stale && day.status === "pending") return { ...day, status: "failed" as const, reason: "The run was cut off before this day was planned." };
      return day;
    }),
  );
  const firstPlan = [...plans.values()][0] ?? null;
  const week = weekResultSchema.parse({
    ...shell,
    status: stale ? "failed" : record.status,
    summary: record.summary,
    days,
    notes: record.notes,
    qlooMode: firstPlan?.qlooMode ?? shell.qlooMode,
    explanationsModel: firstPlan?.explanationsModel ?? null,
    researchTotals: record.totals,
    usage: record.usage,
    dataStatus: firstPlan?.dataStatus ?? [],
    error: stale ? { code: "interrupted", message: "The week's run was cut off before it finished. Please plan it again." } : record.error,
  });
  return { week, events: record.events, request: request.data, plans };
}

/**
 * The week's ready days as a calendar (RFC 5545), built from the stored day plans only: no Qloo or model call. Each event links
 * to its day's busk plan.
 */
export function weekIcs(loaded: LoadedWeek, origin: string, now: Date): string {
  const { week, plans } = loaded;
  const rules = rulesFor({ id: week.city });
  const events: IcsEvent[] = week.days.flatMap((d) => {
    const plan = plans.get(d.date);
    const top = plan?.pitches[0];
    if (d.status !== "ready" || !d.planId || !plan || !top) return [];
    const link = `${origin}${planPath(d.planId)}`;
    return [
      {
        uid: `${week.id ?? "week"}-${d.date}@buskmap.app`,
        start: zonedHourToUtc(d.date, plan.slot.startHour, week.timeZone),
        end: zonedHourToUtc(d.date, plan.slot.endHour, week.timeZone),
        summary: `Busk: ${top.name}`,
        location: `${top.name}, ${week.cityName}`,
        description: [top.why, ...top.cautions, week.rulesChecked ? "Busk Map never confirms a pitch is legal: check your permit." : rules.general, link].join("\n"),
        geo: { lat: top.lat, lon: top.lon },
        url: link,
      },
    ];
  });
  return buildIcs(events, now, `Busk Map: ${week.performerName}`);
}
