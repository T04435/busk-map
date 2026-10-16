"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ComparePanel, useBaseline } from "@/components/compare/compare-panel";
import { AgentStatusLine, type AgentState } from "@/components/honeycomb/agent-status-line";
import { Banner } from "@/components/honeycomb/banner";
import { FoundByBadge } from "@/components/honeycomb/found-by-badge";
import { BothAgreeBadge } from "@/components/honeycomb/both-agree-badge";
import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { PageHeader } from "@/components/honeycomb/page-header";
import { PitchRow } from "@/components/honeycomb/pitch-row";
import { PlanAlert } from "@/components/honeycomb/plan-alert";
import { ResearchFunnel } from "@/components/honeycomb/research-funnel";
import { UnmatchedAlert } from "@/components/honeycomb/unmatched-alert";
import { WithCells } from "@/components/honeycomb/with-cells";
import { LazyPlanMap } from "@/components/map/lazy-plan-map";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { creditsClaude, explanationsLabel, modelName, QLOO_TEST_LABEL, type ExplanationsModel } from "@/lib/sources";
import { ArrowDown, Clock, MapPin, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FRESH_HEADER, PLAN_ID_HEADER } from "@/lib/plan-id";
import { planStreamEventSchema, type Plan, type PlanRequest, type PlanStreamEvent } from "@/lib/plan-schema";
import type { ResearchTotals } from "@/lib/research-totals";
import { formatHour, isAnyTime, nightWord, slotEyebrow } from "@/lib/slot";
import { AgentStepStream, applyStreamEvent, type AgentStep, type FeedPhase, type RunUsage } from "./agent-steps";
import { AgentVsEngine } from "./agent-vs-engine";
import { CopyLink } from "./copy-link";
import { DataSources, sourcesTouched, statusText } from "./data-sources";
import { NoPitchPanel } from "./no-pitch-panel";
import { QlooDownPanel } from "./qloo-down-panel";
import { PitchSheet } from "./pitch-sheet";
import { SaveAsRepertoire } from "@/components/playlist/save-as-repertoire";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { WeatherStrip } from "./weather-strip";

/** From 1024 px the busk's research sits around the busk (funnel on top, feed at the foot); below it the busk comes first and the research is folded. */
const WIDE_QUERY = "(min-width: 1024px)";
function useWide(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(WIDE_QUERY);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => true,
  );
}

type RunState =
  | { status: "idle" | "running" | "done" }
  | { status: "error"; message: string }
  /** The fresh-run limit refused the run (429): nothing started, no fallback plan is built. */
  | { status: "limited"; message: string };

/** What the header needs before the plan exists (agent-first: the plan arrives with the agent's answer). */
type Heading = Pick<Plan, "cityName" | "slotLabel" | "permit" | "performerName" | "qlooMode"> & {
  /** The model the agent runs on here: "mock" on the offline server. Names it in steps and notes until the plan says (B-010). */
  model: ExplanationsModel;
};

type Props = {
  /** The engine's plan (run=0), or null when the agent brings the plan. */
  initialPlan: Plan | null;
  heading: Heading;
  request: PlanRequest;
  center: { lat: number; lon: number };
  autoRun: boolean;
  /** The example performer this plan is for, if any. */
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
  const totals = replay.events.findLast((e) => e.type === "totals");
  return {
    plan: plan?.type === "plan" ? plan.plan : null,
    usage: usage?.type === "usage" ? usage : null,
    totals: totals?.type === "totals" ? totals.totals : null,
    steps: replay.events.reduce<AgentStep[]>((steps, event) => applyStreamEvent(steps, event), []),
  };
};

/** If a live run hasn't ended by now, show the engine's plan anyway (the agent itself times out at 90 s). */
const AGENT_WAIT_MS = 110_000;
/** Brand words (B-049): Claude, and Busk Map's scores; never "agent" or "engine" in what a busker reads. */
const ranOutNote = (model: ExplanationsModel | null) => `${modelName(model, "start")} ran out of time, so these pitches come straight from Busk Map's scores. The reasons are standard ones.`;
const couldntNote = (model: ExplanationsModel | null) => `${modelName(model, "start")} couldn't finish, so these pitches come straight from Busk Map's scores. The reasons are standard ones.`;

export function PlanView({ initialPlan, heading, request, center, autoRun, exampleId, faults, shareId = null, replay = null, fresh = false }: Props) {
  // A stored run starts the view finished: its plan, its steps (collapsed, as a replay) and its totals.
  const [stored] = useState(() => replayState(replay));
  const [plan, setPlan] = useState<Plan | null>(stored?.plan ?? initialPlan);
  // A refresh brings a new engine plan for the same request: adopt it.
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
  /** The running research totals (the funnel): the latest `totals` event; the plan's own totals replace them once it arrives. */
  const [liveTotals, setLiveTotals] = useState<ResearchTotals | null>(stored?.totals ?? null);
  /** The page-level "Show raw data" switch: tool names, inputs and the returned data show only when it is on. */
  const [showRaw, setShowRaw] = useState(false);
  const wide = useWide();
  /** The run was replayed from the cache: its steps are collapsed. */
  const [replayed, setReplayed] = useState(Boolean(stored?.plan));
  /** Why the plan shown isn't Claude's (agent failed, timed out or fell back to templates). */
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pitchList = plan?.pitches ?? [];
  // `?pitch=<id>` is the deep link to a pitch's details sheet. The list and the map's pins select a pitch on their own (not in the URL).
  const sheetId = searchParams.get("pitch");
  const sheetPitch = pitchList.find((p) => p.id === sheetId) ?? null;
  const [pickedId, setPickedId] = useState<string | null>(() => sheetId);
  const selectedId = sheetPitch?.id ?? pickedId ?? pitchList[0]?.id ?? null;
  // A stored run counts as started.
  const started = useRef(Boolean(stored?.plan));
  // The plain-AI baseline (a control: agreement is a badge, never a score change).
  // Asked once the plan is shown: during the agent's run the server starts it after the agent's data is in.
  const baseline = useBaseline(request, faults, revealed);
  const agreedWith = new Map(baseline.status === "done" ? baseline.baseline.bothAgree.map((a) => [a.pitchId, a.plainName]) : []);

  const opener = useRef<HTMLElement | null>(null);
  const openDetails = useCallback(
    (pitchId: string) => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPickedId(pitchId);
      const params = new URLSearchParams(searchParams.toString());
      params.set("pitch", pitchId);
      router.replace(`${pathname}?${params}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );
  const closeDetails = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("pitch");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

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
    setLiveTotals(null);
    // Whatever ends the run, a plan is shown: Claude's, or the engine's with a note.
    const fail = (message: string) => {
      setRun({ status: "error", message });
      setFallbackNote(couldntNote(heading.model));
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
        if (response.status === 429 && body?.error?.code === "rate_limited") {
          // No run and no engine fallback: the fallback page would start the plain-AI baseline, a model call.
          setRun({ status: "limited", message: body.error.message });
          return;
        }
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
          if (event.type === "totals") setLiveTotals(event.totals);
          if (event.type === "plan") {
            setPlan(event.plan);
            setRun({ status: "done" });
            const by = event.plan.explanationsModel ?? heading.model;
            setFallbackNote(event.plan.explanations === "ai" ? null : couldntNote(by));
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
  }, [faults, fresh, heading.model, request, shareId, showEnginePlan]);

  useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true;
      void runAgent();
    }
  }, [autoRun, runAgent]);

  // A refresh with a changed request re-plans with the agent:
  // agent-first pages get no engine plan from the server, and a changed request is a new run.
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
      setFallbackNote(ranOutNote(heading.model));
      setRevealed(true);
      if (!hasPlan.current) showEnginePlan();
    }, AGENT_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting, showEnginePlan, heading.model]);
  // Before the run starts (first render, server and client alike) and while it runs, the plan is pending; so is a fallback plan still loading.
  const pending = !revealed || plan === null;

  const model = plan?.explanationsModel ?? heading.model;
  const qlooDown = plan?.qlooFailed === true || (run.status === "error" && run.message.startsWith("Qloo"));
  const unmatched = qlooDown || !plan ? [] : plan.resolvedArtists.filter((a) => a.matched === null).map((a) => a.query);
  const matched = (plan?.resolvedArtists ?? []).filter((a) => a.matched !== null).map((a) => a.matched!);
  /** No artist matched: taste is left out, Claude had nothing to research (M01 to M04). */
  const noTaste = !pending && unmatched.length > 0 && matched.length === 0;
  const limited = run.status === "limited";
  /** Whether the model wrote this plan's reasons (false on the fallback and with no taste: the rows then say "From the data"). */
  const written = plan ? plan.explanations === "ai" : true;

  // The research feed: its phase, mode and totals.
  const lastStep = steps.filter((s) => s.tool).at(-1);
  const phase: FeedPhase | null =
    run.status === "running"
      ? steps.length === 0 || (steps.at(-1)?.tool === null && !lastStep)
        ? "starting"
        : lastStep?.status === "running"
          ? "working"
          : "thinking"
      : run.status === "done"
        ? plan?.explanations === "ai" || !plan ? "done" : "fallback"
        : run.status === "error"
          ? qlooDown ? "error" : "fallback"
          : null;
  const live = phase === "starting" || phase === "working" || phase === "thinking";
  const mode = replayed ? "replay" : runNote?.startsWith("Joining") ? "joined" : "live";
  const totals: Partial<ResearchTotals> | null = plan?.researchTotals ?? liveTotals;
  const running = steps.filter((s) => s.status === "running" && s.tool).map((s) => s.tool!);
  const dataPoints = totals ? Object.entries(totals).reduce((sum, [k, v]) => (k === "qlooCalls" || k === "qlooCacheHits" ? sum : sum + (v ?? 0)), 0) : 0;
  const hasFeed = !limited && !noTaste && (steps.length > 0 || live || qlooDown);
  const secs = usage ? usage.ms / 1000 : null;
  const slotShort = plan ? `${formatHour(plan.slot.startHour)}–${formatHour(plan.slot.endHour)}` : "";
  const agentState: AgentState | null = limited
    ? "none"
    : qlooDown || noTaste
      ? null
      : pending
        ? "researching"
        : run.status === "idle"
          ? "engine"
          : run.status === "running"
            ? "rerun"
            : run.status === "done"
              ? replayed
                ? "replayed"
                : "done"
              : null;
  const statusLine = <AgentStatusLine state={agentState} usage={usage} model={model} note={replayed ? replayNote(replay?.note ?? runNote) : null} />;

  const sourcesDown = plan ? plan.dataStatus.filter((s) => s.mode === "fallback" && s.source !== "qloo") : [];
  const DOWN: Record<string, { title: string; effect: string }> = {
    "melbourne-pedestrian": { title: "The city's pedestrian sensors didn't answer", effect: "Foot traffic at each pitch is estimated from busy places and events, and marked \"est.\"." },
    ticketmaster: { title: "Ticketmaster didn't answer", effect: "Event crowds are left out of the scores." },
    "open-meteo": { title: "The weather forecast didn't answer", effect: "The weather is left out of the scores." },
    lastfm: { title: "Last.fm didn't answer", effect: "Song play counts are left out; the suggested set still orders your songs." },
  };

  const funnelSentence =
    plan?.funnel && plan.funnel.topCells > 0 && !live ? (
      <p className="m-0 text-sm text-muted-foreground" data-testid="funnel-sentence">
        How this plan was found: Qloo mapped your taste over {plan.funnel.cells} areas of the city. Your top {plan.funnel.topCells} areas gave {plan.funnel.considered} public
        spaces, footpaths and council sites; the council&apos;s busking rules ruled out {plan.funnel.excluded}, and {plan.funnel.candidates} were scored on foot traffic,
        nearby places, events and weather for your slot.
      </p>
    ) : null;
  const funnel =
    noTaste || (!qlooDown && !totals && !live) ? null : (
      <div data-testid="plan-funnel">
        <ResearchFunnel layout="landing" totals={qlooDown ? null : totals} running={running} live={live} picks={!live && !qlooDown && plan && plan.pitches.length > 0 ? plan.pitches.length : null} />
      </div>
    );

  /** Plan again with the same act (Try again on Qloo down): clears the failed plan and asks again. Whether the failed run counted is the server's call. */
  const retry = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("run");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    hasPlan.current = false;
    setPlan(null);
    setRevealed(false);
    setFallbackNote(null);
    void runAgent();
  };

  const dataSources = plan && !pending && !qlooDown ? <DataSources status={plan.dataStatus} showAi={creditsClaude(plan)} /> : null;
  const stream = hasFeed ? (
    <AgentStepStream
      steps={steps}
      model={model}
      phase={phase ?? "done"}
      mode={mode}
      modeText={replayed ? "Showing the research from earlier. Nothing new was asked." : runNote}
      seconds={secs}
      endNote={null}
      endCode={qlooDown ? "qloo" : null}
      onRetry={qlooDown ? retry : undefined}
      when={slotShort}
      pins={plan ? plan.pitches.map((p, i) => ({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, rank: i + 1 })) : undefined}
      collapsed={!wide && !pending && !qlooDown}
      showRaw={showRaw}
      onShowRawChange={setShowRaw}
      subtitle={!wide && !live && !qlooDown ? `Each check ${modelName(model)} ran for the busk above, and what it found.` : undefined}
      footer={live ? <DataSources status={[]} showAi={false} soFar={sourcesTouched(steps.map((s) => s.tool))} /> : dataSources}
    />
  ) : null;

  const eyebrow = `${replay ? "Shared busk · " : ""}${slotEyebrow(request.slot, request.permit)}`;
  const tags = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1" data-testid="plan-tags">
      <DataStatusBadge status={heading.qlooMode === "live" ? "live" : "test"} label={heading.qlooMode === "live" ? "Live Qloo data" : QLOO_TEST_LABEL} />
      {plan && !qlooDown ? (
        <DataStatusBadge status={plan.footfallLevel === "city-sensors" ? "live" : "unavailable"} label={plan.footfallLevel === "city-sensors" ? "Foot traffic: city sensors" : "Foot traffic: unavailable"} />
      ) : null}
      {!pending && plan && !qlooDown ? <DataStatusBadge status={plan.explanations === "ai" ? "live" : "estimated"} label={explanationsLabel(plan)} /> : null}
      {replayed ? (
        <Badge variant="neutral" data-testid="replay-label">
          <Clock aria-hidden="true" />
          Replay of an earlier run (no new model call)
        </Badge>
      ) : null}
    </div>
  );
  const header = (
    <PageHeader
      meta={eyebrow}
      title={heading.performerName}
      subtitle={qlooDown || limited ? undefined : `Sounds like ${request.performer.artists.slice(0, 3).join(", ")}`}
      below={limited ? undefined : tags}
      end={
        noTaste ? (
          <Button asChild>
            <Link href={shareId ? `/busks?again=${shareId}` : "/busks"}>
              <Search aria-hidden="true" />
              Pick your artists from Spotify
            </Link>
          </Button>
        ) : shareId && !pending && !qlooDown ? (
          <CopyLink id={shareId} />
        ) : undefined
      }
    />
  );

  const alerts = (
    <div className="flex flex-col gap-3 empty:hidden">
      {heading.qlooMode === "synthetic" && (
        <Banner tone="test">
          <b className="font-bold uppercase">Qloo test data</b>
        </Banner>
      )}
      {limited && <PlanAlert kind="limit" message={run.status === "limited" ? run.message : undefined}>{statusLine}</PlanAlert>}
      {/* B-184: with no legal pitch the NoPitchPanel says it all; a note about "these pitches" would point at nothing. */}
      {plan && !pending && plan.pitches.length === 0 ? null : noTaste ? (
        <Banner testId="agent-fallback">Claude didn&apos;t research this busk: with no taste to go on there&apos;s nothing for it to check. Your pitches come straight from the city&apos;s data.</Banner>
      ) : fallbackNote && !qlooDown ? (
        <Banner testId="agent-fallback">{fallbackNote}</Banner>
      ) : null}
      {!pending && unmatched.length > 0 && <UnmatchedAlert unmatched={unmatched} matched={matched} mock={plan?.qlooMode === "synthetic"} />}
      {!pending && plan && plan.pitches.length > 0 && sourcesDown.length > 0 ? (
        <div className="flex flex-col gap-3" data-testid="source-down">
          {sourcesDown.map((s) => (
            <Alert key={s.adapter} variant="warning">
              <AlertTitle>{DOWN[s.source]?.title ?? `${s.source} didn't answer`}</AlertTitle>
              <AlertDescription>
                {DOWN[s.source]?.effect ?? ""} The rest of your busk is unaffected.{" "}
                <DataStatusBadge status="unavailable" label={statusText(s)} />
              </AlertDescription>
            </Alert>
          ))}
        </div>
      ) : null}
    </div>
  );

  const pitchesList = plan ? (
    <section aria-label="Pitches" className="space-y-3 p-4 pt-0 md:p-6 md:pt-0 lg:col-start-1 lg:row-start-2">
      <h3 className="sr-only">Top pitches</h3>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {plan.pitches.map((pitch, i) => (
          <PitchRow
            key={pitch.id}
            pitchId={pitch.id}
            rank={i + 1}
            name={pitch.name}
            when={pitch.window ? undefined : slotShort}
            window={pitch.window ? `Best ${pitch.window.label}` : undefined}
            score={pitch.score}
            selected={pitch.id === selectedId}
            onSelect={() => setPickedId(pitch.id)}
            onDetails={() => openDetails(pitch.id)}
            badges={
              <>
                <DiscoveryBadge discovery={pitch.discovery} />
                <FoundByBadge origin={pitch.origin} written={written} model={model} />
                {agreedWith.has(pitch.id) && <BothAgreeBadge title={`The plain AI also named ${agreedWith.get(pitch.id)}`} />}
              </>
            }
          />
        ))}
      </ol>
      {plan.others.length > 0 && (
        <p className="m-0 flex items-start gap-2 text-sm text-muted-foreground" data-testid="others-note">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {plan.others.length} more pitches scored. They&apos;re the small markers on the map: pick one for its summary. The top 3 are kept 250 m apart.
          </span>
        </p>
      )}
      <p className="m-0 text-sm font-bold">Busk Map never confirms a pitch is legal. Check your permit conditions on the day.</p>
    </section>
  ) : null;

  return (
    <div className="space-y-6">
      {header}
      {pending && !limited ? statusLine : null}
      {alerts}

      {limited ? null : qlooDown ? (
        <>
          {funnel}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
            {stream}
            <QlooDownPanel onRetry={retry} busy={run.status === "running"} />
          </div>
        </>
      ) : pending || !plan ? (
        <>
          {funnel}
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,760px)_minmax(0,1fr)]">
            {stream}
            <PendingPlan />
          </div>
        </>
      ) : (
        <>
          {wide ? (
            funnel
          ) : (
            totals &&
            !noTaste && (
              <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-muted-foreground" data-testid="found-from">
                <span>Found from {dataPoints.toLocaleString("en-AU")} data points</span>
                <a className="inline-flex min-h-tap items-center font-bold text-foreground underline underline-offset-3" href="#research">
                  See the research
                  <ArrowDown aria-hidden="true" className="ml-1.5 size-4" strokeWidth={2} />
                </a>
              </p>
            )
          )}

          {plan.pitches.length === 0 ? (
            <NoPitchPanel permit={request.permit} when={nightWord(request.slot)} againHref={shareId ? `/busks?again=${shareId}` : "/busks"} rulesHref={plan.rulesUrl} />
          ) : (
            <>
              {wide && plan.agent && !noTaste && <AgentVsEngine agent={plan.agent} model={model} level={2} />}
              <section aria-label="Your busk" className="grid border-2 border-rule bg-card lg:grid-cols-[400px_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
                <div className="space-y-2 p-4 md:p-6 lg:col-start-1 lg:row-start-1">
                  <h2 className="m-0 font-display text-[clamp(36px,4vw,40px)] leading-none font-extrabold uppercase">Your busk</h2>
                  <p className="m-0 font-mono text-xs leading-4 font-medium text-muted-foreground">{slotEyebrow(request.slot, request.permit)}</p>
                  {isAnyTime(request.slot) && (
                    <p className="m-0 text-sm leading-5 text-muted-foreground" data-testid="any-time-line">
                      {heading.slotLabel}: each pitch below has its own best hours.
                    </p>
                  )}
                  <p className="m-0 text-base leading-6">
                    <WithCells text={plan.summary} />
                  </p>
                  {plan.notes.filter((note) => !(noTaste && /couldn't match any/i.test(note))).length > 0 && (
                    <ul className="m-0 list-disc pl-5 text-sm text-muted-foreground">
                      {plan.notes
                        .filter((note) => !(noTaste && /couldn't match any/i.test(note)))
                        .map((note) => (
                          <li key={note}>
                            <WithCells text={note} />
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                <div className="flex min-w-0 flex-col p-3 md:p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l-2 lg:border-rule">
                  <LazyPlanMap plan={plan} center={center} selectedId={selectedId} onSelect={setPickedId} />
                </div>
                {pitchesList}
              </section>

              {!exampleId && <SaveAsRepertoire performer={request.performer} />}
              <WeatherStrip weather={plan.weather} slot={plan.slot} />
              <ComparePanel state={baseline} pitches={plan.pitches} model={heading.model} />
            </>
          )}

          {stream || dataSources || funnelSentence ? (
            <section id="research" aria-label="The research" className="scroll-mt-20 space-y-4">
              {!wide && stream && <h2 className="m-0 font-display text-[32px] leading-none font-extrabold uppercase">The research</h2>}
              {!wide && funnel}
              {!wide && plan.agent && !noTaste && <AgentVsEngine agent={plan.agent} model={model} level={3} />}
              {!pending && !noTaste ? statusLine : null}
              {funnelSentence}
              {stream ?? dataSources}
              {stream && heading.qlooMode === "synthetic" && !live ? <PlanAlert kind="test-data" /> : null}
            </section>
          ) : null}
        </>
      )}

      {plan && <PitchSheet plan={plan} pitch={sheetPitch} model={model} when={heading.slotLabel} canAddToRepertoire={!exampleId} repertoireTotal={request.performer.songs.length} onClose={closeDetails} returnFocus={() => opener.current?.focus()} />}
    </div>
  );
}

/** The replay line: when the research was done, and that opening it again asked nothing new. */
const replayNote = (note: string | null | undefined) => (note && /^Researched at/.test(note) ? note : null);

/** Where the plan, map, pitches, crowd, setlist and comparison will go while the agent works. */
function PendingPlan() {
  return (
    <div className="min-w-0 space-y-4" aria-busy="true" aria-label="Plan pending" data-testid="plan-pending">
      <p className="m-0 text-sm text-muted-foreground">The plan, map, crowd, {PLAYLIST_COPY.suggestedSetNoun} and comparison appear here when the agent finishes.</p>
      {[1, 2, 3].map((n) => (
        <div key={n} className="flex items-center gap-3 border-2 border-border bg-card p-3">
          <Skeleton className="h-[46px] w-10 [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" />
          <Skeleton className="h-5 flex-1" />
          <Skeleton className="h-11 w-[38px] [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" />
        </div>
      ))}
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
