"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LazyPlanMap } from "@/components/map/lazy-plan-map";
import { AgentTag } from "@/components/honeycomb/agent-tag";
import { ArtistChip } from "@/components/honeycomb/artist-chip";
import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { FormMessage } from "@/components/honeycomb/form-message";
import { Icon } from "@/components/honeycomb/icon";
import { PageHeader } from "@/components/honeycomb/page-header";
import { AgentStepStream, applyStreamEvent, type AgentStep, type FeedPhase, type RunUsage } from "@/components/plan/agent-steps";
import { DataSources } from "@/components/plan/data-sources";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { AgentStep as Step } from "@/lib/agent-steps";
import { cityLevels } from "@/lib/city";
import type { PlanStreamEvent } from "@/lib/plan-schema";
import { modelName, QLOO_TEST_LABEL } from "@/lib/sources";
import { permitName } from "@/lib/slot";
import { weekPath, weekResultSchema, weekStepEventSchema, weekStreamEventSchema, type WeekRequest, type WeekResult, type WeekStepEvent } from "@/lib/week-schema";
import { WeekDays } from "./week-days";

/** How often a week still running elsewhere (a reload, another device) is read again. */
const POLL_MS = 3000;

const stepsOf = (events: readonly WeekStepEvent[]): Step[] => events.reduce<Step[]>((steps, e) => applyStreamEvent(steps, e as PlanStreamEvent), []);
const usageOf = (events: readonly WeekStepEvent[]) => (events.findLast((e) => e.type === "usage") as RunUsage | undefined) ?? null;

/** The pending days of a week that ended without them: failed, with the reason. */
const failPending = (week: WeekResult, message: string): WeekResult => ({ ...week, status: "failed", days: week.days.map((d) => (d.status === "pending" ? { ...d, status: "failed", reason: message } : d)) });

type RunError = { code: string; message: string };

/**
 * A week: its seven days and the Hive's steps. `live` starts the run here (POST /api/week, streamed); without it the week is
 * a stored one (/w/<id>), replayed from its record, and read again while it is still running elsewhere.
 */
export function WeekView({ initial, events = [], live = null, onChangeWeek }: { initial: WeekResult; events?: WeekStepEvent[]; live?: { request: WeekRequest; faults: string | null } | null; onChangeWeek?: () => void }) {
  const [week, setWeek] = useState(initial);
  const [steps, setSteps] = useState<Step[]>(() => stepsOf(events));
  const [usage, setUsage] = useState<RunUsage | null>(() => usageOf(events));
  const [streaming, setStreaming] = useState(Boolean(live));
  const [error, setError] = useState<RunError | null>(initial.error);
  const [attempt, setAttempt] = useState(0);
  const [calendar, setCalendar] = useState<"idle" | "busy" | "failed">("idle");
  const started = useRef(-1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!live || started.current === attempt) return;
    const controller = new AbortController();
    // A tick later: React's dev double mount clears this timer first, so a reload never starts two week runs.
    const timer = setTimeout(() => {
      started.current = attempt;
      void run(live, controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };

    async function run({ request, faults }: { request: WeekRequest; faults: string | null }, signal: AbortSignal) {
      let id: string | null = null;
      let finished = false;
      const fail = (e: RunError) => {
        finished = true;
        setError(e);
        setWeek((w) => failPending(w, e.message));
        setStreaming(false);
      };
      try {
        const response = await fetch("/api/week", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(faults ? { "x-buskmap-faults": faults } : {}) },
          body: JSON.stringify(request),
          signal,
        });
        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => null);
          fail({ code: body?.error?.code ?? "internal", message: body?.error?.message ?? "We couldn't plan this week. Please try again." });
          return;
        }
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        const handle = (line: string) => {
          if (!line.trim()) return;
          let json: unknown;
          try {
            json = JSON.parse(line);
          } catch {
            return;
          }
          const parsed = weekStreamEventSchema.safeParse(json);
          if (!parsed.success) return;
          const event = parsed.data;
          switch (event.type) {
            case "week-started":
              id = event.week.id;
              setWeek(event.week);
              // The week's own link from the start: a reload reopens it (and follows the run) instead of starting another.
              if (id) window.history.replaceState(null, "", weekPath(id));
              break;
            case "week":
              finished = true;
              setWeek(event.week);
              setStreaming(false);
              // The address is the week's own page (set at week-started): a refresh replays the stored week.
              if (event.week.id && window.location.pathname !== weekPath(event.week.id)) window.history.replaceState(null, "", weekPath(event.week.id));
              break;
            case "error":
              fail({ code: event.code, message: event.message });
              break;
            case "usage":
              setUsage(event);
              break;
            case "totals":
              break;
            default:
              setSteps((s) => applyStreamEvent(s, event as PlanStreamEvent));
          }
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += value;
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            lines.forEach(handle);
          }
          if (done) break;
        }
        handle(buffer);
        // The connection dropped mid-run: the run goes on on the server, so follow its record.
        if (!finished) setStreaming(false);
      } catch {
        if (signal.aborted) return;
        if (id) setStreaming(false);
        else fail({ code: "network", message: "We couldn't reach Busk Map. Check your connection and try again." });
      }
    }
  }, [live, attempt]);

  // A week still running that this page isn't streaming: read its record again until it ends.
  const following = !streaming && week.status === "running" && week.id !== null;
  useEffect(() => {
    if (!following || !week.id) return;
    const id = week.id;
    const timer = setInterval(async () => {
      const res = await fetch(`/api/week/${id}`, { cache: "no-store" }).catch(() => null);
      const body = res?.ok ? await res.json().catch(() => null) : null;
      const next = weekResultSchema.safeParse(body?.week);
      if (!next.success) return;
      const evs = Array.isArray(body.events) ? body.events.flatMap((e: unknown) => { const p = weekStepEventSchema.safeParse(e); return p.success ? [p.data] : []; }) : [];
      setWeek(next.data);
      if (evs.length) {
        setSteps(stepsOf(evs));
        setUsage(usageOf(evs));
      }
      if (next.data.error) setError(next.data.error);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [following, week.id]);

  const retry = useCallback(() => {
    setError(null);
    setSteps([]);
    setUsage(null);
    setWeek(initial);
    setStreaming(true);
    setAttempt((n) => n + 1);
  }, [initial]);

  async function downloadCalendar() {
    if (!week.id) return;
    setCalendar("busy");
    try {
      const res = await fetch(`/api/week/ics?id=${week.id}`);
      if (!res.ok) throw new Error("ics");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `busk-map-week-${week.startDate}.ics`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setCalendar("idle");
    } catch {
      setCalendar("failed");
    }
  }

  const running = week.status === "running" && !error;
  const model = week.explanationsModel ?? (week.qlooMode === "synthetic" ? "mock" : "claude");
  const toolSteps = steps.filter((s) => s.tool);
  const phase: FeedPhase = running ? (steps.length === 0 ? "starting" : toolSteps.at(-1)?.status === "running" ? "working" : "thinking") : error ? (error.code === "qloo_unavailable" ? "error" : "stopped") : "done";
  const ready = week.days.filter((d) => d.status === "ready" && d.planId);
  const first = week.days[0];
  const last = week.days.at(-1)!;
  const meta = `${week.cityName} · ${first.label} – ${last.label}${week.rulesChecked ? ` · ${permitName(week.permit)}` : ""}`;
  const levels = week.rulesChecked ? null : cityLevels({ id: week.city });
  const limited = error?.code === "rate_limited" || error?.code === "qloo_budget_spent";
  // The week's map: one pin per picked pitch, badged with its day's number (1 to 7, as in the rows).
  const pins = useMemo(() => {
    const byPitch = new Map<string, { pitch: NonNullable<WeekResult["days"][number]["pitch"]>; days: { n: number; label: string }[] }>();
    week.days.forEach((d, i) => {
      if (d.status !== "ready" || !d.pitch) return;
      const at = byPitch.get(d.pitch.id) ?? { pitch: d.pitch, days: [] };
      at.days.push({ n: i + 1, label: d.label });
      byPitch.set(d.pitch.id, at);
    });
    return [...byPitch.values()].map(({ pitch, days }) => ({
      id: pitch.id,
      name: `${days.map((d) => d.label).join(", ")} · ${pitch.name}`,
      lat: pitch.lat,
      lon: pitch.lon,
      score: pitch.score,
      discovery: pitch.discovery,
      badge: String(days[0].n),
      ariaLabel: `${days.map((d) => `Day ${d.n}, ${d.label}`).join("; ")}: ${pitch.name}`,
    }));
  }, [week.days]);

  return (
    <div className="flex flex-col gap-8" data-testid="week-view" data-status={week.status}>
      <PageHeader
        meta={meta}
        title={week.performerName}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-1.5" data-testid="sounds-like">
            Sounds like
            {week.artists.slice(0, 3).map((a) => (
              <ArtistChip key={a} size="xs" name={a} />
            ))}
          </span>
        }
        below={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <DataStatusBadge status={week.qlooMode === "live" ? "live" : "test"} label={week.qlooMode === "live" ? "Live Qloo data" : QLOO_TEST_LABEL} />
            {running ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold" role="status" data-testid="week-running">
                <Spinner size={14} />
                {modelName(model, "start")} is planning your week
              </span>
            ) : null}
          </div>
        }
      />

      {!running && !error && week.id === null ? (
        <Alert variant="warning" data-testid="week-unsaved">
          <AlertTitle>This week has no link</AlertTitle>
          <AlertDescription>It couldn&apos;t be saved, so it can&apos;t be opened again. Each day&apos;s plan link still works.</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant={limited ? "warning" : "error"} data-testid="week-error">
          <AlertTitle>{limited ? "Not right now" : "We couldn't plan this week"}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
          <div className="mt-2 flex flex-wrap gap-2">
            {live && !limited ? (
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                <Icon name="refresh" size={14} />
                Try again
              </Button>
            ) : null}
            {onChangeWeek ? (
              <Button type="button" variant="outline" size="sm" onClick={onChangeWeek}>
                Change your week
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/week">Plan a new week</Link>
              </Button>
            )}
          </div>
        </Alert>
      ) : null}

      <section aria-labelledby="week-days-h" className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="week-days-h" className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
            Your week
          </h2>
          <div className="flex flex-wrap gap-2">
            {week.status === "done" && ready.length > 0 && week.id ? (
              <Button type="button" variant="outline" size="sm" onClick={downloadCalendar} disabled={calendar === "busy"} data-testid="week-calendar">
                <Icon name="calendar" size={16} />
                Add to calendar
              </Button>
            ) : null}
            {!running && onChangeWeek && !error ? (
              <Button type="button" variant="outline" size="sm" onClick={onChangeWeek}>
                Change your week
              </Button>
            ) : null}
            {!running && !onChangeWeek ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/week">Plan another week</Link>
              </Button>
            ) : null}
          </div>
        </div>
        {calendar === "failed" ? (
          <FormMessage tone="error" alert>
            The calendar file couldn&apos;t be made. Please try again.
          </FormMessage>
        ) : null}
        {week.summary ? (
          <p className="m-0 max-w-[70ch] leading-6" data-testid="week-summary">
            <AgentTag name={modelName(model, "label")} />
            {week.summary}
          </p>
        ) : null}
        <WeekDays days={week.days} />
      </section>

      {pins.length > 0 ? (
        <section aria-labelledby="week-map-h" className="flex flex-col gap-3.5" data-testid="week-map" data-pins={pins.length}>
          <h2 id="week-map-h" className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">
            Where you play
          </h2>
          <div className="border-2 border-rule bg-card">
            <LazyPlanMap plan={{ pitches: pins, tasteCells: week.tasteCells, others: [] }} center={week.center} selectedId={selectedId} onSelect={setSelectedId} />
          </div>
        </section>
      ) : null}

      {steps.length > 0 || running ? (
        <AgentStepStream
          steps={steps as AgentStep[]}
          model={model}
          phase={phase}
          mode={streaming || running ? "live" : "replay"}
          seconds={usage ? usage.ms / 1000 : null}
          title={running ? "Planning your week" : "How the Hive planned your week"}
          wording={{ first: "Reading your act and your seven days", next: "Thinking about what to check next", leave: "You can leave this page: the run keeps going and your week will be at this link." }}
          footer={!running ? <DataSources status={week.dataStatus} showAi={week.explanationsModel === "claude"} levels={levels} /> : null}
        />
      ) : null}
    </div>
  );
}
