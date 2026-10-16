"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { explanationsLabel, QLOO_TEST_LABEL } from "@/lib/sources";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { planSearchParams } from "@/lib/plan-url";
import type { WeekPlan, WeekRequest } from "@/lib/week-schema";
import { weekSearchParams } from "@/lib/week-url";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

type Props = { initialPlan: WeekPlan; request: WeekRequest; exampleId: string | null; faults: string | null };

const FLAG_LABEL: Record<"event" | "rain" | "busy", string> = { event: "Event", rain: "Rain", busy: "Busy" };

export function WeekView({ initialPlan, request, exampleId, faults }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [state, setState] = useState<{ status: "idle" | "running" | "done" } | { status: "error"; message: string }>({ status: "idle" });
  const router = useRouter();
  const pathname = usePathname();

  /** Change the request: state lives in the URL, so the server re-plans. */
  function navigate(next: WeekRequest) {
    const params = weekSearchParams(next, exampleId);
    if (faults) params.set("faults", faults);
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  function toggleUnavailable(date: string, startHour: number, endHour: number) {
    const has = request.limits.unavailable.some((u) => u.date === date && u.startHour === startHour);
    navigate({
      ...request,
      limits: {
        ...request.limits,
        unavailable: has
          ? request.limits.unavailable.filter((u) => !(u.date === date && u.startHour === startHour))
          : [...request.limits.unavailable, { date, startHour, endHour }],
      },
    });
  }

  async function explain() {
    setState({ status: "running" });
    try {
      const response = await fetch("/api/week", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(faults ? { "x-buskmap-faults": faults } : {}) },
        body: JSON.stringify(request),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.plan) {
        setState({ status: "error", message: body?.error?.message ?? "The week planner is unavailable right now." });
        return;
      }
      setPlan(body.plan);
      setState({ status: "done" });
    } catch {
      setState({ status: "error", message: "The week planner is unavailable right now." });
    }
  }

  const icsParams = weekSearchParams(request, exampleId);
  if (faults) icsParams.set("faults", faults);
  const cell = (date: string, startHour: number) => plan.grid.find((c) => c.date === date && c.startHour === startHour);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {plan.cityName} · week from {plan.startDate} · {plan.permit} permit
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Plan my week: {plan.performerName}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant={plan.qlooMode === "live" ? "outline" : "secondary"}>
            {plan.qlooMode === "live" ? "Live Qloo data" : QLOO_TEST_LABEL}
          </Badge>
          <Badge variant="outline">{plan.footfallLevel === "city-sensors" ? "Foot traffic: typical by weekday and hour (estimate)" : "Foot traffic: unavailable"}</Badge>
          <Badge variant="outline">{explanationsLabel(plan)}</Badge>
        </div>
      </header>

      <section aria-label="Limits" className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="max-sessions">Sessions this week</Label>
          <Select value={String(request.limits.maxSessions)} onValueChange={(v) => navigate({ ...request, limits: { ...request.limits, maxSessions: Number(v) } })}>
            <SelectTrigger id="max-sessions" className="w-28">
              <SelectValue>{request.limits.maxSessions}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="per-day">Per day</Label>
          <Select value={String(request.limits.maxPerDay)} onValueChange={(v) => navigate({ ...request, limits: { ...request.limits, maxPerDay: Number(v) } })}>
            <SelectTrigger id="per-day" className="w-28">
              <SelectValue>{request.limits.maxPerDay}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => void explain()} disabled={state.status === "running"}>
          {state.status === "running" ? "Explaining…" : "Explain my week (live)"}
        </Button>
        <Button variant="outline" asChild>
          <a href={`/api/week/ics?${icsParams}`} download>
            Download .ics
          </a>
        </Button>
      </section>
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t explain the week</AlertTitle>
          <AlertDescription>{state.message} The sessions below still come from the data.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Top sessions</h2>
          </CardTitle>
          <CardDescription>{plan.summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {plan.notes.length > 0 && (
            <ul className="list-disc pl-5 text-muted-foreground">
              {plan.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {plan.sessions.length === 0 ? (
            <p className="text-muted-foreground">No session fits your limits this week. Free up some times or allow more sessions per day.</p>
          ) : (
            <ol className="space-y-3" aria-label="Top sessions">
              {plan.sessions.map((s, i) => (
                <li key={s.key} className="space-y-1">
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      <span>
                        {i + 1}. {s.label} · {s.pitch.name}
                      </span>
                      {s.pitch.discovery === "hidden-gem" && <Badge>Hidden gem</Badge>}
                      {s.pitch.discovery === "usual" && <Badge variant="outline">Usual spot</Badge>}
                    </span>
                    <span>
                      <span aria-hidden="true">{s.score}/100</span>
                      <span className="sr-only">Score {s.score} out of 100</span>
                    </span>
                  </p>
                  <p className="text-muted-foreground">{s.why}</p>
                  {s.pitch.cautions.length > 0 && <p className="text-muted-foreground">{s.pitch.cautions.join(" ")}</p>}
                  <Link
                    className="underline"
                    href={
                      exampleId
                        ? `/plan?${new URLSearchParams({ example: exampleId, date: s.date, from: String(s.startHour), to: String(s.endHour), permit: request.permit })}`
                        : `/plan?${planSearchParams({ city: request.city, permit: request.permit, performer: request.performer, slot: { date: s.date, startHour: s.startHour, endHour: s.endHour } })}`
                    }
                  >
                    Open this session&apos;s plan and {PLAYLIST_COPY.suggestedSetNoun}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <section aria-label="Week grid" className="space-y-2">
        <h2 className="text-lg font-semibold">Every slot this week</h2>
        <p className="text-sm text-muted-foreground">
          Best pitch score for each 3-hour slot. Select a slot to mark it unavailable (or available again).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Best score for each day and slot</caption>
            <thead>
              <tr>
                <th scope="col" className="p-2 text-left">
                  Slot
                </th>
                {plan.days.map((d) => (
                  <th key={d.date} scope="col" className="p-2 text-left font-medium">
                    {d.label}
                    {!d.hasForecast && <span className="block text-xs font-normal text-muted-foreground">no forecast</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plan.slots.map((slot) => (
                <tr key={slot.startHour}>
                  <th scope="row" className="p-2 text-left font-medium whitespace-nowrap">
                    {slot.label}
                  </th>
                  {plan.days.map((d) => {
                    const c = cell(d.date, slot.startHour);
                    return (
                      <td key={d.date} className="p-1">
                        {c?.past ? (
                          <span className="block p-2 text-muted-foreground">
                            <span aria-hidden="true">Past</span>
                            <span className="sr-only">{`${d.label} ${slot.label}: already started`}</span>
                          </span>
                        ) : (
                        <Button
                          variant={c?.chosen ? "default" : c?.unavailable ? "ghost" : "outline"}
                          size="sm"
                          className="relative h-auto w-full flex-col items-start gap-0 py-1 whitespace-normal"
                          aria-pressed={c?.unavailable ?? false}
                          onClick={() => toggleUnavailable(d.date, slot.startHour, slot.endHour)}
                        >
                          {/* The accessible name includes the visible text (WCAG 2.5.3), with the day and slot added for screen readers. */}
                          <span className="sr-only">
                            {d.label} {slot.label}:{" "}
                          </span>
                          {c?.unavailable ? (
                            <span>Unavailable</span>
                          ) : c?.score !== null && c?.score !== undefined ? (
                            <span>
                              <span className="sr-only">score </span>
                              {c.score}
                            </span>
                          ) : (
                            <span>
                              <span aria-hidden>–</span>
                              <span className="sr-only">no pitch</span>
                            </span>
                          )}
                          {c?.chosen && <span className="text-xs">{" "}Chosen</span>}
                          {!c?.unavailable && c?.flags && c.flags.length > 0 && (
                            <span className="text-[0.65rem] leading-tight opacity-80">{" "}{c.flags.map((f) => FLAG_LABEL[f]).join(" · ")}</span>
                          )}
                          <span className="sr-only">. Toggle availability.</span>
                        </Button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">Event: a ticketed crowd arrives or leaves near the pitch. Rain: weather risk. Busy: among the week&apos;s busiest slots.</p>
      </section>

      <section aria-label="What changes day to day" className="space-y-2">
        <h2 className="text-lg font-semibold">What changes day to day</h2>
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {plan.days.map((d) => (
            <li key={d.date} className="rounded-md border p-3">
              <p className="font-medium">{d.label}</p>
              {d.busyness !== null && (
                <span className="mt-1 block h-1.5 rounded-full bg-muted" aria-hidden>
                  <span className="block h-1.5 rounded-full bg-foreground" style={{ width: `${Math.round(d.busyness * 100)}%` }} />
                </span>
              )}
              {d.drivers.length === 0 ? (
                <p className="text-muted-foreground">No foot traffic, event or weather data for this day.</p>
              ) : (
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {d.drivers.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
