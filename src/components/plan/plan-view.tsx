"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ComparePanel, useBaseline } from "@/components/compare/compare-panel";
import { LazyPlanMap } from "@/components/map/lazy-plan-map";
import { MapLegend } from "@/components/map/map-legend";
import { DiscoveryBadge, PitchCard } from "@/components/pitch-card/pitch-card";
import { SetlistPanel } from "@/components/setlist/setlist-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { QLOO_TEST_LABEL } from "@/lib/sources";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FRESH_HEADER, PLAN_ID_HEADER } from "@/lib/plan-id";
import { planStreamEventSchema, type Plan, type PlanRequest, type PlanStreamEvent } from "@/lib/plan-schema";
import { weekSearchParams } from "@/lib/week-url";
import { agentVsEngineLines } from "@/lib/agent-vs-engine";
import { TipLogForm } from "@/components/tips/tip-log-form";
import { useTipSync } from "@/components/tips/use-tip-sync";
import { AgentSteps, applyStreamEvent, type AgentStep, type RunUsage } from "./agent-steps";
import { CopyLink } from "./copy-link";
import { CrowdPanel } from "./crowd-panel";
import { DataSources } from "./data-sources";
import { WeatherStrip } from "./weather-strip";
import { WeightsPanel } from "./weights-panel";

type RunState = { status: "idle" | "running" | "done" } | { status: "error"; message: string };

/** What the header needs before the plan exists (agent-first: the plan arrives with the agent's answer). */
type Heading = Pick<Plan, "cityName" | "slotLabel" | "permit" | "performerName" | "qlooMode">;

type Props = {
  /** The engine's plan (run=0), or null when the agent brings the plan. */
  initialPlan: Plan | null;
  heading: Heading;
  request: PlanRequest;
  center: { lat: number; lon: number };
  autoRun: boolean;
  /** The example performer this plan is for, if any (tip log key). */
  exampleId: string | null;
  /** Simulated outages to pass on to the agent (e2e only; the server ignores it in production). */
  faults: string | null;
  /** The short link's id (/p/<id>): shows "Copy link", and the server keeps the finished run on it. */
  shareId?: string | null;
  /** A finished run stored on the short link: shown at once, as a replay, with no request to the agent. */
  replay?: { events: PlanStreamEvent[]; note: string } | null;
  /** Developer path (?fresh=1): ask for a new agent run, bypassing the stored one. */
  fresh?: boolean;
};

const replayState = (replay: Props["replay"]) => {
  if (!replay) return null;
  const plan = replay.events.findLast((e) => e.type === "plan");
  const usage = replay.events.findLast((e) => e.type === "usage");
  return {
    plan: plan?.type === "plan" ? plan.plan : null,
    usage: usage?.type === "usage" ? usage : null,
    steps: replay.events.reduce<AgentStep[]>((steps, event) => applyStreamEvent(steps, event), []),
  };
};

/** If a live run hasn't ended by now, show the engine's plan anyway (the agent itself times out at 90 s). */
const AGENT_WAIT_MS = 110_000;
const TEMPLATE_NOTE = "The reasons below are the template ones from the data, not Claude's.";

/** Agent vs engine: whether Claude kept the engine's top 3, or what it picked over what, and why. No design yet. */
function AgentVsEngine({ agent }: { agent: NonNullable<Plan["agent"]> }) {
  const lines = agentVsEngineLines(agent);
  return (
    <div className="space-y-1 text-sm" data-testid="agent-vs-engine">
      <p className="font-medium">Agent vs engine</p>
      {lines.length === 1 && agent.changes.length === 0 ? (
        <p>{lines[0]}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5">
          {lines.map((line) => (
            <li key={line} data-testid="agent-vs-engine-change">
              {line}
            </li>
          ))}
        </ul>
      )}
      {agent.added.length > 0 && <p className="text-muted-foreground">Added by Claude and scored by the engine: {agent.added.join(", ")}.</p>}
    </div>
  );
}

const list = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

export function PlanView({ initialPlan, heading, request, center, autoRun, exampleId, faults, shareId = null, replay = null, fresh = false }: Props) {
  // A stored run starts the view finished: its plan, its steps (collapsed, as a replay) and its totals.
  const [stored] = useState(() => replayState(replay));
  const [plan, setPlan] = useState<Plan | null>(stored?.plan ?? initialPlan);
  // A refresh after logging takings brings a new engine plan for the same request: adopt it.
  const [shownInitial, setShownInitial] = useState(initialPlan);
  if (initialPlan !== shownInitial) {
    setShownInitial(initialPlan);
    // Agent-first pages render no engine plan: keep the agent's.
    if (initialPlan) setPlan(initialPlan);
  }
  const [steps, setSteps] = useState<AgentStep[]>(stored?.steps ?? []);
  const [run, setRun] = useState<RunState>({ status: stored?.plan ? "done" : "idle" });
  /** A note from the server about the run, e.g. that it replays a cached run. */
  const [runNote, setRunNote] = useState<string | null>(stored?.plan ? (replay?.note ?? null) : null);
  // Agent-first: during a live run the plan stays hidden until the agent ends. Qloo down needs no wait: there is no plan to show.
  const [revealed, setRevealed] = useState(Boolean(stored?.plan) || !autoRun || initialPlan?.qlooFailed === true);
  /** Run totals from the server (steps, tokens, time). */
  const [usage, setUsage] = useState<RunUsage | null>(stored?.usage ?? null);
  /** The run was replayed from the cache: its steps are collapsed. */
  const [replayed, setReplayed] = useState(Boolean(stored?.plan));
  /** Why the plan shown isn't Claude's (agent failed, timed out or fell back to templates). */
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pitchList = plan?.pitches ?? [];
  const selectedId = searchParams.get("pitch") ?? pitchList[0]?.id ?? null;
  const selected = pitchList.find((p) => p.id === selectedId) ?? pitchList[0] ?? null;
  // A stored run counts as started: a changed request (a new tip log entry) then plans again.
  const started = useRef(Boolean(stored?.plan));
  useTipSync(request.performer.name, exampleId, request.history);
  // The plain-AI baseline (a control: agreement is a badge, never a score change).
  // Asked once the plan is shown: during the agent's run the server starts it after the agent's data is in.
  const baseline = useBaseline(request, faults, revealed);
  const agreedWith = new Map(baseline.status === "done" ? baseline.baseline.bothAgree.map((a) => [a.pitchId, a.plainName]) : []);

  const select = useCallback(
    (pitchId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("pitch", pitchId);
      router.replace(`${pathname}?${params}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  /** No plan arrived (the agent failed before assembling one): load the engine's plan from the server (run=0). */
  const showEnginePlan = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("run", "0");
    router.replace(`${pathname}?${params}`, { scroll: false });
  }, [pathname, router, searchParams]);
  const hasPlan = useRef(initialPlan !== null);
  hasPlan.current = plan !== null;

  const runAgent = useCallback(async () => {
    setRun({ status: "running" });
    setSteps([]);
    setRunNote(null);
    setReplayed(false);
    setUsage(null);
    // Whatever ends the run, a plan is shown: Claude's, or the engine's with a note.
    const fail = (message: string) => {
      setRun({ status: "error", message });
      setFallbackNote(TEMPLATE_NOTE);
      setRevealed(true);
      if (!hasPlan.current) showEnginePlan();
    };
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(faults ? { "x-buskmap-faults": faults } : {}),
          ...(shareId ? { [PLAN_ID_HEADER]: shareId } : {}),
          ...(fresh ? { [FRESH_HEADER]: "1" } : {}),
        },
        body: JSON.stringify(request),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        fail(body?.error?.message ?? "The planner is unavailable right now.");
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
          if (event.type === "status" && event.message !== "Planning started") setRunNote(event.message);
          if (event.type === "status" && event.replay) setReplayed(true);
          if (event.type === "usage") setUsage(event);
          if (event.type === "plan") {
            setPlan(event.plan);
            setRun({ status: "done" });
            setFallbackNote(event.plan.explanations === "ai" ? null : `The agent couldn't add Claude's explanations. ${TEMPLATE_NOTE}`);
            setRevealed(true);
            finished = true;
          } else if (event.type === "error") {
            fail(event.message);
            finished = true;
          }
        }
      }
      if (!finished) fail("The planner stopped before finishing. Please try again.");
    } catch {
      fail("The planner is unavailable right now.");
    }
  }, [faults, fresh, request, shareId, showEnginePlan]);

  useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true;
      void runAgent();
    }
  }, [autoRun, runAgent]);

  // A refresh with a changed request (a new tip log entry changes its history) re-plans with the agent:
  // agent-first pages get no engine plan from the server. The run key includes the history, so it's a new run.
  const requestKey = JSON.stringify(request);
  const lastRequestKey = useRef(requestKey);
  useEffect(() => {
    if (lastRequestKey.current === requestKey) return;
    lastRequestKey.current = requestKey;
    if (initialPlan === null && started.current) void runAgent();
  }, [requestKey, initialPlan, runAgent]);

  // A live run that hangs past the agent's own timeout: show the engine's plan (Claude's replaces it if the run still ends).
  const waiting = run.status === "running" && !revealed;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => {
      setFallbackNote(`The agent is taking too long, so this is the engine's plan. ${TEMPLATE_NOTE}`);
      setRevealed(true);
      if (!hasPlan.current) showEnginePlan();
    }, AGENT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting, showEnginePlan]);
  // Before the run starts (first render, server and client alike) and while it runs, the plan is pending; so is a fallback plan still loading.
  const pending = !revealed || plan === null;

  const qlooDown = plan?.qlooFailed === true || (run.status === "error" && run.message.startsWith("Qloo"));
  const unmatched = qlooDown || !plan ? [] : plan.resolvedArtists.filter((a) => a.matched === null).map((a) => a.query);
  const matched = (plan?.resolvedArtists ?? []).filter((a) => a.matched !== null).map((a) => a.matched!);
  const tipPitches = pitchList.filter((p) => p.tip && p.tip.points > 0);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {heading.cityName} · {heading.slotLabel} · {heading.permit} permit
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{heading.performerName}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant={heading.qlooMode === "live" ? "outline" : "secondary"}>
            {heading.qlooMode === "live" ? "Live Qloo data" : QLOO_TEST_LABEL}
          </Badge>
          {plan && <Badge variant="outline">{plan.footfallLevel === "city-sensors" ? "Foot traffic: city sensors" : "Foot traffic: unavailable"}</Badge>}
          {!pending && plan && <Badge variant="outline">{plan.explanations === "ai" ? "Explanations: Claude" : "Explanations: from the data"}</Badge>}
        </div>
        <p className="flex flex-wrap gap-x-4 text-sm">
          {/* No prefetch: prefetching /week builds a whole week plan, about 47 Qloo calls, on every plan view. */}
          <Link
            className="underline"
            prefetch={false}
            href={`/week?${weekSearchParams(
              { city: request.city, permit: request.permit, performer: request.performer, startDate: request.slot.date, limits: { maxSessions: 5, maxPerDay: 1, unavailable: [] }, weights: request.weights },
              exampleId,
            )}`}
          >
            Plan my week instead
          </Link>
          <Link className="underline" href="/tips">
            Tip log
          </Link>
        </p>
        {shareId && <CopyLink id={shareId} />}
      </header>

      {heading.qlooMode === "synthetic" && (
        <Alert>
          <AlertTitle>{QLOO_TEST_LABEL}</AlertTitle>
          <AlertDescription>
            The taste map, crowd and trends on this page come from Busk Map&apos;s local mock of the Qloo API, which runs when no Qloo key is
            configured (and in tests). It is test data, not Qloo data. Venue and street names are real (OpenStreetMap); foot traffic,
            busking rules, events and weather are real wherever the sources below say Live.
          </AlertDescription>
        </Alert>
      )}

      {!pending && unmatched.length > 0 && (
        <Alert data-testid="unmatched-artists">
          <AlertTitle>
            Qloo couldn&apos;t match {list(unmatched)}
          </AlertTitle>
          <AlertDescription>
            {matched.length > 0
              ? `This plan uses the artists Qloo did match: ${list(matched)}.`
              : "Without a matched artist Busk Map can't map where your crowd's taste is, so taste is left out: the pitches below are ranked on foot traffic, events and weather only. Try better-known artists you sound like."}
            {plan.qlooMode === "synthetic" ? " (Qloo test data: the local mock knows about 130 artists.)" : ""}
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
        {/* No re-run for buskers: a reload replays the stored run. Developers can add ?fresh=1 (outside production). */}
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground" data-testid="agent-status">
            {pending
              ? "The agent is researching with Qloo and the other sources. The plan appears when it finishes."
              : run.status === "idle"
                ? "Shown: the engine's plan from the data, without the agent."
                : run.status === "running"
                  ? "The agent is running again. The plan below stays until it finishes."
                  : run.status === "done"
                    ? replayed
                      ? "The agent's plan, replayed."
                      : "The agent's plan."
                    : null}
          </p>
        </div>
        {runNote && <p className="text-sm text-muted-foreground">{runNote}</p>}
        {usage && (
          <p className="text-sm text-muted-foreground" data-testid="agent-usage">
            {usage.steps} model steps · {usage.inputTokens.toLocaleString("en-AU")} input and {usage.outputTokens.toLocaleString("en-AU")} output tokens
            {usage.reasoningTokens ? ` (${usage.reasoningTokens.toLocaleString("en-AU")} thinking)` : ""} · {(usage.ms / 1000).toFixed(1)} s
          </p>
        )}
        {!pending && plan?.agent && <AgentVsEngine agent={plan.agent} />}
        {run.status === "error" && !qlooDown ? (
          <Alert variant="destructive">
            <AlertTitle>The agent could not finish</AlertTitle>
            <AlertDescription>
              {run.message} The plan below is the engine&apos;s, from the data. {TEMPLATE_NOTE}
            </AlertDescription>
          </Alert>
        ) : (
          fallbackNote &&
          !qlooDown && (
            <Alert data-testid="agent-fallback">
              <AlertTitle>Shown: the engine&apos;s plan</AlertTitle>
              <AlertDescription>{fallbackNote}</AlertDescription>
            </Alert>
          )
        )}
        {replayed && steps.length > 0 ? (
          <Collapsible className="text-sm">
            <CollapsibleTrigger asChild>
              <Button variant="link" size="sm" className="group h-auto px-0 text-muted-foreground">
                <ChevronRightIcon aria-hidden className="transition-transform group-data-[state=open]:rotate-90" />
                Agent steps (replayed, {steps.filter((s) => s.tool).length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <AgentSteps steps={steps} />
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <AgentSteps steps={steps} />
        )}
      </section>

      {pending || !plan ? (
        <PendingPlan />
      ) : (
        <>

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
            {plan.tipHistory && (
              <p className="flex flex-wrap items-center gap-2 text-muted-foreground" data-testid="tip-history">
                {plan.tipHistory.source !== "yours" && <Badge variant="secondary">Example data</Badge>}
                <span>
                  Your tip log ({plan.tipHistory.sessions} sessions, average ${Math.round(plan.tipHistory.perHour)}/h)
                  {tipPitches.length > 0
                    ? ` adds a small bonus to ${list(tipPitches.map((p) => `${p.name} (+${p.tip!.points})`))}, where you earned more than your average.`
                    : " doesn't change these pitches: none of them earned you more than your average yet."}{" "}
                  <Link className="underline" href="/tips">
                    How it works
                  </Link>
                </span>
              </p>
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
                <LazyPlanMap plan={plan} center={center} selectedId={selected?.id ?? null} onSelect={select} />
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
                        {agreedWith.has(pitch.id) && (
                          <Badge variant="outline" className="border-current bg-transparent text-current" title={`The plain AI also named ${agreedWith.get(pitch.id)}`}>
                            Both agree
                          </Badge>
                        )}
                      </span>
                      <span className="shrink-0">{pitch.score}/100</span>
                    </Button>
                  </li>
                ))}
              </ol>
              {plan.others.length > 0 && (
                <Collapsible className="text-sm">
                  <CollapsibleTrigger asChild>
                    <Button variant="link" size="sm" className="group h-auto px-0 text-muted-foreground">
                      <ChevronRightIcon aria-hidden className="transition-transform group-data-[state=open]:rotate-90" />
                      Other scored pitches ({plan.others.length})
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="mt-2 space-y-1">
                      {plan.others.map((p) => (
                        <li key={p.id} className="flex justify-between gap-2">
                          <span>
                            {p.name}
                            {p.discovery === "hidden-gem" ? " · hidden gem" : p.discovery === "usual" ? " · usual spot" : ""}
                            {p.tipPoints ? ` · tips +${p.tipPoints}` : ""}
                            {p.tooCloseTo ? ` · too close to ${p.tooCloseTo.name}` : ""}
                          </span>
                          <span className="text-muted-foreground">{p.score}/100</span>
                        </li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </section>
          </div>
        )}

        {selected && !qlooDown && (
          <div className="grid gap-6 lg:grid-cols-2">
            <PitchCard pitch={selected} rank={plan.pitches.indexOf(selected) + 1} />
            <SetlistPanel pitch={selected} learnThese={plan.learnThese} ageLean={plan.ageLean} />
          </div>
        )}

        {!qlooDown && plan.pitches.length > 0 && (
          <TipLogForm
            performerName={request.performer.name}
            exampleId={exampleId}
            slot={request.slot}
            pitches={[...plan.pitches, ...plan.others].map((p) => ({ id: p.id, name: p.name }))}
            defaultPitchId={selected?.id ?? null}
          />
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <CrowdPanel crowd={plan.crowd} resolved={plan.resolvedArtists} topPitch={plan.pitches[0]?.name ?? null} />
          <WeightsPanel weights={plan.weights} />
        </div>

        {!qlooDown && <ComparePanel state={baseline} pitches={plan.pitches} />}

        <DataSources status={plan.dataStatus} showAi={plan.explanations === "ai"} />
        </>
      )}
    </div>
  );
}

/** Where the plan, map, pitches, crowd, setlist and comparison will go while the agent works. */
function PendingPlan() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Plan pending" data-testid="plan-pending">
      <p className="text-sm text-muted-foreground">The plan, map, crowd, setlist and comparison appear here when the agent finishes.</p>
      <Skeleton className="h-32 w-full" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Skeleton className="h-[22rem] w-full sm:h-[28rem]" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}
