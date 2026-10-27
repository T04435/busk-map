import { issuePaths } from "@/lib/form-errors";
import type { PlanStreamEvent } from "@/lib/plan-schema";
import { weekRequestSchema, type WeekResult, type WeekStepEvent, type WeekStreamEvent } from "@/lib/week-schema";
import { QLOO_BUDGET_MESSAGE, qlooBudgetSpent } from "@/server/adapters/qloo/budget";
import { QlooUnavailableError } from "@/server/agent/agent";
import { daysPassed, runWeekAgent, WEEK_LIMITS, weekCity, WeekNoDaysLeftError, WeekNoMatchError, WeekPlannerUnavailableError, weekShell } from "@/server/agent/week";
import { rejectBots } from "@/server/bot";
import { cityStore, recordCityUse } from "@/server/cities-store";
import { serverNow, serverToday } from "@/server/clock";
import { testSwitches } from "@/server/env";
import { log } from "@/server/log";
import { refundWeekRun, weekRunGate } from "@/server/rate-limit";
import { adapterContextFor, clientIp, FAULTS_HEADER, freshLimitFaultRequested, qlooBudgetFaultRequested } from "@/server/request";
import { finishOf, finishWeek, saveDayPlans, startWeek } from "@/server/week";

/** One run of the Hive over the week: the agent stops at 4 minutes, the watchdog ends the stream at 4.5, before this. */
export const maxDuration = 300;

/** The run watchdog: a week still going this long after it started is ended as failed, so the stream and the record always end. */
export const WEEK_RUN_WATCHDOG_MS = 270_000;

function jsonError(status: number, code: string, message: string, headers: HeadersInit = {}, extra: Record<string, unknown> = {}) {
  return Response.json({ error: { code, message, ...extra } }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

const PLANNER_MESSAGES: Record<WeekPlannerUnavailableError["reason"], string> = {
  "not-configured": "The Hive isn't configured here, so the week can't be planned.",
  failed: "The Hive was unavailable, so the week couldn't be planned. Please try again shortly.",
  timeout: "The Hive ran out of time before finishing the week. Please try again.",
  "no-answer": "The Hive didn't give an answer for the week. Please try again.",
};

/**
 * POST /api/week: plan the week with ONE run of the Hive and stream its steps as NDJSON (one WeekStreamEvent per line):
 * `week-started` first (the week's id, for /w/<id>, and its days pending or can't play), then the research, ending with a
 * `week` or an `error` event. There is no engine fallback. Each ready day is stored as a busk plan (/p/<id>); the record keeps
 * the seven days and the steps, so /w/<id> replays the run.
 *
 * Caps (agent/week.ts WEEK_LIMITS): US$1.20 of model tokens and 150 Qloo requests per run, 30 steps, 4 minutes. A week run
 * counts as WEEK_RUN_WEIGHT fresh plans against the busks' hourly limit, and is refused up front once today's Qloo budget is
 * spent; Qloo down gives the hits back.
 */
export async function POST(request: Request) {
  const blocked = await rejectBots("/api/week");
  if (blocked) return blocked;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json", "The request body must be JSON.");
  }
  const parsed = weekRequestSchema.safeParse(body);
  if (!parsed.success) {
    const fields = [...new Set(issuePaths(parsed.error.issues))];
    return jsonError(400, "invalid_request", `Check these fields: ${fields.join(", ")}`);
  }
  const week = parsed.data;
  const passed = daysPassed(week, serverNow().getTime());
  if (week.days.every((d) => "off" in d || passed.has(d.date))) {
    return jsonError(400, "no_days_left", "The hours of every day you can play have passed. Start the week tomorrow.");
  }
  const faults = request.headers.get(FAULTS_HEADER);
  // A week makes many Qloo calls: once today's budget is spent, none starts (and nothing is counted).
  if (qlooBudgetSpent() || qlooBudgetFaultRequested(faults)) return jsonError(503, "qloo_budget_spent", QLOO_BUDGET_MESSAGE);
  const ip = clientIp(request.headers);
  const offline = testSwitches().offline;
  const gate = weekRunGate({ offline, ip, forced: freshLimitFaultRequested(faults) });
  if (!gate.ok) return jsonError(429, "rate_limited", gate.message, { "Retry-After": String(gate.retryAfterS) }, { retryAt: gate.retryAt, retryAfterS: gate.retryAfterS });

  const adapters = adapterContextFor(faults);
  const city = weekCity(week);
  const today = serverToday(city.timeZone);
  const requestId = crypto.randomUUID();
  const shell = weekShell(null, week, null, adapters, passed);
  const weekId = await startWeek(week, shell, adapters.offline);
  void recordCityUse(cityStore(adapters.offline), city);
  const encoder = new TextEncoder();
  const signal = AbortSignal.timeout(WEEK_LIMITS.timeoutMs + 20_000);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const steps: WeekStepEvent[] = [];
      let open = true;
      let ended = false;
      const send = (event: WeekStreamEvent) => {
        if (event.type !== "week" && event.type !== "week-started" && event.type !== "error") steps.push(event);
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The viewer left; the run still finishes so its day plans and record are stored.
          open = false;
        }
      };
      const close = () => {
        if (!open) return;
        open = false;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      const startedAt = Date.now();
      send({ type: "week-started", week: { ...shell, id: weekId } });
      send({ type: "status", message: "Week planning started" });
      /** The one end of the run: an error event and a failed record (the run, an error or the watchdog may race to it). */
      const fail = async (code: string, message: string) => {
        if (ended) return;
        ended = true;
        send({ type: "error", code, message });
        const failed: WeekResult = {
          ...shell,
          id: weekId,
          status: "failed",
          days: shell.days.map((d) => (d.status === "pending" ? { ...d, status: "failed", reason: message } : d)),
          error: { code, message },
        };
        await finishWeek(weekId, adapters.offline, finishOf(failed, steps));
        close();
      };
      const watchdog = setTimeout(() => {
        log.warn("week run ran out of time", { requestId });
        void fail("timeout", PLANNER_MESSAGES.timeout);
      }, WEEK_RUN_WATCHDOG_MS);
      try {
        const run = await runWeekAgent(
          week,
          adapters,
          today,
          {
            onStatus: (message) => send({ type: "status", message }),
            onNote: (e) => send({ type: "note", ...e }),
            onToolStart: (e) => send({ type: "tool-start", ...e }),
            onToolEnd: (e) => send({ type: "tool-end", ...e }),
            onTotals: (totals) => send({ type: "totals", totals }),
          },
          signal,
          { now: serverNow() },
        );
        if (ended) return;
        send({ type: "usage", ...run.usage });
        const ids = await saveDayPlans(run.plans, steps as PlanStreamEvent[], { startedAt, finishedAt: Date.now(), today, offline: adapters.offline });
        const done: WeekResult = {
          ...run.week,
          id: weekId,
          // A ready day whose plan couldn't be stored has no link: it shows as failed rather than a dead end.
          days: run.week.days.map((d) => (d.status !== "ready" ? d : ids.has(d.date) ? { ...d, planId: ids.get(d.date)! } : { ...d, status: "failed", reason: "This day's plan couldn't be saved." })),
        };
        if (done.researchTotals) send({ type: "totals", totals: done.researchTotals });
        if (ended) return;
        ended = true;
        await finishWeek(weekId, adapters.offline, finishOf(done, steps));
        log.info("week served", { requestId, usage: run.usage, costUsd: Math.round(run.costUsd * 1000) / 1000, qlooCalls: run.qlooCalls, planned: ids.size });
        send({ type: "week", week: done });
        close();
      } catch (error) {
        if (error instanceof QlooUnavailableError && qlooBudgetSpent()) {
          await fail("qloo_budget_spent", QLOO_BUDGET_MESSAGE);
          if (!offline) refundWeekRun(ip);
        } else if (error instanceof QlooUnavailableError) {
          await fail("qloo_unavailable", "Qloo, our taste data source, is not responding, so the week wasn't planned. Please try again shortly.");
          if (!offline) refundWeekRun(ip);
        } else if (error instanceof WeekNoMatchError) {
          await fail("no_match", "Qloo couldn't match any of your artists, so there's no taste to plan the week from. Try other artists you sound like.");
        } else if (error instanceof WeekNoDaysLeftError) {
          await fail("no_days_left", "The hours of every day you can play have passed. Start the week tomorrow.");
        } else if (error instanceof WeekPlannerUnavailableError) {
          await fail(`planner_${error.reason.replace("-", "_")}`, PLANNER_MESSAGES[error.reason]);
        } else {
          log.error("week failed", { requestId, error: error instanceof Error ? error.message : "unknown" });
          await fail("internal", "Something went wrong while planning the week. Please try again.");
        }
      } finally {
        clearTimeout(watchdog);
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": requestId,
      ...(weekId ? { "X-Week-Id": weekId } : {}),
    },
  });
}
