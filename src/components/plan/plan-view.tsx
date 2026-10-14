"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ComparePanel } from "@/components/compare/compare-panel";
import { MapLegend } from "@/components/map/map-legend";
import { DiscoveryBadge, PitchCard } from "@/components/pitch-card/pitch-card";
import { SetlistPanel } from "@/components/setlist/setlist-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { QLOO_TEST_LABEL } from "@/lib/sources";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { planStreamEventSchema, type Plan, type PlanRequest } from "@/lib/plan-schema";
import { weekSearchParams } from "@/lib/week-url";
import { AgentSteps, applyStreamEvent, type AgentStep } from "./agent-steps";
import { CrowdPanel } from "./crowd-panel";
import { DataSources } from "./data-sources";
import { WeatherStrip } from "./weather-strip";
import { WeightsPanel } from "./weights-panel";

const PlanMap = dynamic(() => import("@/components/map/plan-map").then((m) => m.PlanMap), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full" />,
});

type RunState = { status: "idle" | "running" | "done" } | { status: "error"; message: string };

type Props = {
  initialPlan: Plan;
  request: PlanRequest;
  center: { lat: number; lon: number };
  autoRun: boolean;
  /** Simulated outages to pass on to the agent (e2e only; the server ignores it in production). */
  faults: string | null;
};

export function PlanView({ initialPlan, request, center, autoRun, faults }: Props) {
  const [plan, setPlan] = useState(initialPlan);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [run, setRun] = useState<RunState>({ status: "idle" });
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("pitch") ?? plan.pitches[0]?.id ?? null;
  const selected = plan.pitches.find((p) => p.id === selectedId) ?? plan.pitches[0] ?? null;
  const started = useRef(false);

  const select = useCallback(
    (pitchId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pitch", pitchId);
      params.delete("run");
      router.replace(`${pathname}?${params}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const runAgent = useCallback(async () => {
    setRun({ status: "running" });
    setSteps([]);
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(faults ? { "x-buskmap-faults": faults } : {}) },
        body: JSON.stringify(request),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        setRun({ status: "error", message: body?.error?.message ?? "The planner is unavailable right now." });
        return;
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = planStreamEventSchema.safeParse(JSON.parse(line));
          if (!parsed.success) continue;
          const event = parsed.data;
          setSteps((current) => applyStreamEvent(current, event));
          if (event.type === "plan") {
            setPlan(event.plan);
            setRun({ status: "done" });
            finished = true;
          } else if (event.type === "error") {
            setRun({ status: "error", message: event.message });
            finished = true;
          }
        }
      }
      if (!finished) setRun({ status: "error", message: "The planner stopped before finishing. Please try again." });
    } catch {
      setRun({ status: "error", message: "The planner is unavailable right now." });
    }
  }, [faults, request]);

  useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true;
      void runAgent();
    }
  }, [autoRun, runAgent]);

  const qlooDown = plan.qlooFailed || (run.status === "error" && run.message.startsWith("Qloo"));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {plan.cityName} · {plan.slotLabel} · {plan.permit} permit
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{plan.performerName}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant={plan.qlooMode === "live" ? "outline" : "secondary"}>
            {plan.qlooMode === "live" ? "Live Qloo data" : QLOO_TEST_LABEL}
          </Badge>
          <Badge variant="outline">{plan.footfallLevel === "city-sensors" ? "Foot traffic: city sensors" : "Foot traffic: unavailable"}</Badge>
          <Badge variant="outline">{plan.explanations === "ai" ? "Explanations: Claude" : "Explanations: from the data"}</Badge>
        </div>
        <Link
          className="text-sm underline"
          href={`/week?${weekSearchParams(
            { city: request.city, permit: request.permit, performer: request.performer, startDate: request.slot.date, limits: { maxSessions: 5, maxPerDay: 1, unavailable: [] }, weights: request.weights },
            null,
          )}`}
        >
          Plan my week instead
        </Link>
      </header>

      {plan.qlooMode === "synthetic" && (
        <Alert>
          <AlertTitle>{QLOO_TEST_LABEL}</AlertTitle>
          <AlertDescription>
            The taste map, crowd and trends on this page come from Busk Map&apos;s local mock of the Qloo API, built from Qloo&apos;s documentation
            while the hackathon key is pending. It is test data, not Qloo data. Venue and street names are real (OpenStreetMap); foot traffic,
            busking rules, events and weather are real wherever the sources below say Live.
          </AlertDescription>
        </Alert>
      )}

      {qlooDown && (
        <Alert variant="destructive">
          <AlertTitle>Qloo is unavailable</AlertTitle>
          <AlertDescription>Busk Map needs Qloo&apos;s taste data to plan. Please try again in a few minutes.</AlertDescription>
        </Alert>
      )}

      <section aria-label="Agent" className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => void runAgent()} disabled={run.status === "running"}>
            {run.status === "running" ? "Planning…" : run.status === "done" ? "Re-run the agent" : "Plan with the agent (live)"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {run.status === "idle"
              ? "Shown: the engine's plan from the data. The agent adds Claude's explanations."
              : run.status === "running"
                ? "The agent is calling tools…"
                : run.status === "done"
                  ? "Updated with the agent's plan."
                  : null}
          </p>
        </div>
        {run.status === "error" && !qlooDown && (
          <Alert variant="destructive">
            <AlertTitle>The agent could not finish</AlertTitle>
            <AlertDescription>{run.message} The plan below is still based on the data.</AlertDescription>
          </Alert>
        )}
        <AgentSteps steps={steps} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Plan</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{plan.summary}</p>
          {plan.funnel && plan.funnel.topCells > 0 && (
            <p className="text-muted-foreground" data-testid="plan-funnel">
              How this plan was found: Qloo mapped your taste over {plan.funnel.cells} areas of the city. Your top {plan.funnel.topCells} areas gave{" "}
              {plan.funnel.considered} public spaces, footpaths and council sites; the council&apos;s busking rules ruled out {plan.funnel.excluded},
              and {plan.funnel.candidates} were scored on foot traffic, nearby places, events and weather for your slot.
            </p>
          )}
          {plan.notes.length > 0 && (
            <ul className="list-disc pl-5 text-muted-foreground">
              {plan.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
          <WeatherStrip weather={plan.weather} />
        </CardContent>
      </Card>

      {qlooDown ? null : plan.pitches.length === 0 ? (
        <Alert>
          <AlertTitle>No pitch to recommend</AlertTitle>
          <AlertDescription>
            The busking rules or the data for this slot left no candidate pitches.{" "}
            <a className="underline" href={plan.rulesUrl} target="_blank" rel="noreferrer">
              Read the council&apos;s busking rules
            </a>
            .
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-2">
            <div className="h-[22rem] sm:h-[28rem]">
              <PlanMap plan={plan} center={center} selectedId={selected?.id ?? null} onSelect={select} />
            </div>
            <MapLegend testData={plan.qlooMode === "synthetic"} />
          </div>
          <section aria-label="Pitches" className="space-y-2">
            <h2 className="text-lg font-semibold">Top pitches</h2>
            <ol className="space-y-2">
              {plan.pitches.map((pitch, i) => (
                <li key={pitch.id}>
                  <Button
                    variant={pitch.id === selected?.id ? "default" : "outline"}
                    className="h-auto w-full justify-between whitespace-normal text-left"
                    aria-pressed={pitch.id === selected?.id}
                    data-pitch-name={pitch.name}
                    onClick={() => select(pitch.id)}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span>
                        {i + 1}. {pitch.name}
                      </span>
                      <DiscoveryBadge discovery={pitch.discovery} className="border-current bg-transparent text-current" />
                    </span>
                    <span className="shrink-0">{pitch.score}/100</span>
                  </Button>
                </li>
              ))}
            </ol>
            {plan.others.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">Other scored pitches ({plan.others.length})</summary>
                <ul className="mt-2 space-y-1">
                  {plan.others.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span>
                        {p.name}
                        {p.discovery === "hidden-gem" ? " · hidden gem" : p.discovery === "usual" ? " · usual spot" : ""}
                      </span>
                      <span className="text-muted-foreground">{p.score}/100</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        </div>
      )}

      {selected && !qlooDown && (
        <div className="grid gap-6 lg:grid-cols-2">
          <PitchCard pitch={selected} rank={plan.pitches.indexOf(selected) + 1} />
          <SetlistPanel pitch={selected} learnThese={plan.learnThese} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <CrowdPanel crowd={plan.crowd} resolved={plan.resolvedArtists} topPitch={plan.pitches[0]?.name ?? null} />
        <WeightsPanel weights={plan.weights} />
      </div>

      <ComparePanel request={request} pitches={plan.pitches} />

      <DataSources status={plan.dataStatus} showAi={plan.explanations === "ai"} />
    </div>
  );
}
