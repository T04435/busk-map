"use client";

import { SourceLogo } from "@/components/honeycomb/source-logo";
import { StepCell } from "@/components/honeycomb/step-cell";
import { HIVE_SIZES } from "@/components/honeycomb/hive-mark";
import { AgentTag } from "@/components/honeycomb/agent-tag";
import { type CSSProperties, type ReactNode } from "react";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AgentStep } from "@/lib/agent-steps";
import type { IconName } from "@/components/honeycomb/icon";
import { modelName, type ExplanationsModel } from "@/lib/sources";
import { stepSources, TOOL_ICON, TOOL_UI, type MiniPin } from "./tool-results";

/**
 * The research feed: the agent's steps as the busker sees them, in the order they ran (U23), no step numbers, each tool drawn as a plain-words
 * result card from its output fields. Ported from the DS AgentStepStream.
 */
export { applyStreamEvent, formatInput, type AgentStep, type RunUsage, type StepNote } from "@/lib/agent-steps";

/** "waiting": the run paused on a step for the performer's input (Repertoire research). */
export type FeedPhase = "starting" | "working" | "thinking" | "done" | "fallback" | "error" | "stopped" | "waiting";
/** A step the run hasn't started yet (shown while it waits): its title and icon. */
export type UpcomingStep = { key: string; title: string; icon: IconName };
export type FeedMode = "live" | "replay" | "joined";

/** The agent's tag before its words: the Hive's mark and "Hive" (or "Test model" offline, never the Hive's name for the mock). */
const Say = ({ model, children, testId }: { model: ExplanationsModel | null; children: ReactNode; testId?: string }) => (
  <p className="m-0 text-sm leading-5 text-muted-foreground" data-testid={testId}>
    <AgentTag name={modelName(model, "label")} />
    {children}
  </p>
);

/** Each card: its step cell (HIVE_SIZES.stepCell, the running Hive mark inside) and the title column; the body lines up under the title from sm up. */
const STEP_COLS = { gridTemplateColumns: `${HIVE_SIZES.stepCell}px minmax(0,1fr)` } as const;
const STEP_INDENT = { "--step-indent": `${HIVE_SIZES.stepCell + 12}px` } as CSSProperties;

function ToolCard({ step, model, when, pins, fresh, renderWaiting }: { step: AgentStep; model: ExplanationsModel | null; when?: string; pins?: MiniPin[]; fresh: boolean; renderWaiting?: (step: AgentStep) => ReactNode }) {
  const ui = step.tool ? TOOL_UI[step.tool] : undefined;
  const icon = (step.tool && TOOL_ICON[step.tool]) || "dots";
  const running = step.status === "running";
  const failed = step.status === "failed";
  const rejected = failed && step.tool === "finish_plan";
  const bad = failed && !rejected;
  const cut = step.status === "cut";
  const waiting = step.status === "waiting";
  const sources = stepSources(step);
  const say = step.notes.filter((n) => n.kind === "text").map((n) => n.text);
  const title = running ? `${ui?.doing(step) ?? step.label}…` : (ui?.title(step) ?? step.label);
  const out = step.output !== null && typeof step.output === "object" ? (step.output as Record<string, unknown>) : {};
  const foot = (text: string) => <p className="m-0 text-[13px] leading-[18px] text-muted-foreground">{text}</p>;
  let body: ReactNode = null;
  if (running)
    body = (
      <div className="grid gap-2" aria-hidden="true">
        <Skeleton className="h-3 w-[70%]" />
        <Skeleton className="h-3 w-[45%]" />
      </div>
    );
  else if (rejected) body = ui?.render(out, step, { when, pins, model });
  else if (bad) body = foot("This check didn't come back, so the plan goes on without it.");
  else if (cut) body = foot("Stopped before it finished.");
  else if (waiting) body = renderWaiting ? renderWaiting(step) : step.summary ? foot(step.summary) : null;
  else if (step.output !== undefined && ui) body = ui.render(out, step, { when, pins, model });
  else if (step.summary) body = foot(step.summary);
  return (
    <li
      data-testid="agent-step"
      data-tool={step.tool ?? ""}
      data-status={rejected ? "rejected" : step.status}
      // U21/U22: no card inside the stream's panel. The steps sit directly on its surface, set apart by the list's rules; only a failed
      // step is marked, by a rule at its side.
      className={cn("grid min-w-0 gap-3 py-4 first:pt-0 last:pb-0", failed && "border-l-2 border-destructive pl-3")}
      data-fresh={fresh && !running ? "true" : undefined}
    >
      <div className="grid items-start gap-3" style={STEP_COLS}>
        <StepCell icon={icon} status={running ? "running" : bad || rejected ? "failed" : cut ? "skipped" : waiting ? "pending" : "done"} source={sources.length === 1 ? sources[0] : undefined} label={`${title}: ${running ? "working" : bad || rejected ? "didn't work" : cut ? "stopped" : waiting ? "waiting for you" : "done"}`} />
        <div className="grid min-w-0 gap-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className={cn(running ? "font-sans text-base leading-[22px] font-bold" : "font-display text-xl leading-6 font-extrabold uppercase")}>{title}</b>
            {sources.map((s) => (
              <SourceLogo key={s} source={s} height={14} />
            ))}
            {waiting ? <Badge variant="tag-live">Your turn</Badge> : null}
          </div>
          {say.length ? (
            <Say model={model} testId="agent-note-text">
              {say.join(" ")}
            </Say>
          ) : null}
        </div>
        <span className="sr-only">{rejected ? "rejected" : waiting ? "waiting for you" : step.status}</span>
      </div>
      {body ? (
        <div className="grid min-w-0 gap-3 sm:pl-(--step-indent)" style={STEP_INDENT}>
          {body}
        </div>
      ) : null}
    </li>
  );
}

/** A step not started yet (the run waits above it): its icon in a dashed cell, its title quiet, and "Not started". */
function UpcomingCard({ step }: { step: UpcomingStep }) {
  return (
    <li data-testid="agent-step-upcoming" data-key={step.key} className="grid min-w-0 gap-3 py-4 first:pt-0 last:pb-0">
      <div className="grid items-start gap-3" style={STEP_COLS}>
        <StepCell icon={step.icon} status="pending" label={`${step.title}: not started`} />
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <b className="font-display text-xl leading-6 font-extrabold text-muted-foreground uppercase">{step.title}</b>
          <Badge variant="tag-quiet">Not started</Badge>
        </div>
      </div>
    </li>
  );
}

/** `model` names who wrote each note: Claude, or the test model offline (B-010). */
export function AgentStepStream({
  steps,
  model = null,
  phase,
  mode = "live",
  modeText,
  seconds,
  endNote,
  endCode,
  onRetry,
  when,
  pins,
  footer,
  title,
  hideHeading = false,
  subtitle,
  wording,
  upcoming,
  renderWaiting,
}: {
  steps: AgentStep[];
  model?: ExplanationsModel | null;
  phase: FeedPhase;
  mode?: FeedMode;
  modeText?: string | null;
  seconds?: number | null;
  endNote?: string | null;
  endCode?: "qloo" | null;
  /** Try again on a feed that stopped or failed (Q02). */
  onRetry?: () => void;
  when?: string;
  /** The busk's ranked pitches, for the mini map on "Where your crowd gathers". */
  pins?: MiniPin[];
  /** "Data used", at the foot. */
  footer?: ReactNode;
  title?: string;
  /** The fold around it already shows the title (/repertoire, U28): the heading stays for screen readers only. */
  hideHeading?: boolean;
  subtitle?: string;
  /** U35: a feed that isn't a busk plan (the Repertoire research) words its waiting lines itself; the busk plan's are the defaults. */
  wording?: { first: string; next: string; leave: string };
  /** Phase "waiting": the steps not started yet, listed under the one that waits. */
  upcoming?: UpcomingStep[];
  /** What a waiting step shows in its body (the input it asks for). */
  renderWaiting?: (step: AgentStep) => ReactNode;
}) {
  const live = phase === "starting" || phase === "working" || phase === "thinking";
  // Once the run is over, a step still marked running was cut short.
  const calls = steps.filter((s) => s.tool).map((s) => (!live && s.status === "running" ? { ...s, status: "cut" as const } : s));
  const pending = steps.length > 0 && steps[steps.length - 1].tool === null ? steps[steps.length - 1] : null;
  // U23: run order, step 1 at the top; only finished steps and the one running now (no rows for steps not yet started).
  const feed = calls;
  const thinking = live && (pending || phase === "thinking" || steps.length === 0);
  const count = `${calls.length} ${calls.length === 1 ? "check" : "checks"}${seconds != null ? ` · ${Math.round(seconds)} s` : ""}`;
  const tag = phase === "waiting" ? "Waiting" : mode === "replay" ? "Replay" : mode === "joined" ? "Joined" : phase === "done" || phase === "fallback" ? "Finished" : phase === "error" || phase === "stopped" ? "Stopped" : "Live";
  const heading = title ?? (live ? "Finding your best pitches" : "How we found your pitches");
  const list = (
    <ol aria-live={mode === "replay" ? "off" : "polite"} aria-label="Research, in the order it ran" className="m-0 grid list-none divide-y divide-border p-0" data-testid="agent-feed">
      {feed.map((s, i) => (
        <ToolCard key={s.id} step={s} model={model} when={when} pins={pins} fresh={live && i === feed.length - 1 && !thinking} renderWaiting={renderWaiting} />
      ))}
      {phase === "waiting" ? (upcoming ?? []).map((u) => <UpcomingCard key={u.key} step={u} />) : null}
      {thinking ? (
        <li className="grid min-w-0 gap-3 py-4 first:pt-0 last:pb-0" data-testid="agent-thinking">
          <div className="grid items-start gap-3" style={STEP_COLS}>
            <HexCell size={HIVE_SIZES.stepCell} tone="dashed">
              <Spinner size={HIVE_SIZES.stepLoader} label="Thinking" className="bm-loader-think text-primary" />
            </HexCell>
            <div className="grid min-w-0 gap-1">
              <b className="font-sans text-base leading-[22px] font-bold">
                {steps.length === 0 ? (wording?.first ?? "Reading your act, day and permit") : (wording?.next ?? "Thinking about what to check next")}
                <span aria-hidden="true" className="bm-dots ml-0.5">
                  {[0, 1, 2].map((i) => (
                    <i key={i} className="mx-px inline-block size-1 rounded-full bg-current [animation:bm-blink_1.2s_infinite]" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </span>
              </b>
              {pending ? <Say model={model}>{pending.notes.map((n) => n.text).join(" ")}</Say> : null}
            </div>
          </div>
        </li>
      ) : null}
    </ol>
  );
  const retry = onRetry ? (
    <div className="mt-2 flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <Icon name="refresh" size={14} />
        Try again
      </Button>
    </div>
  ) : null;
  let foot: ReactNode = null;
  if (phase === "fallback")
    foot = (
      <Alert variant="estimate" className="mt-4">
        <AlertTitle>Planned from the data alone</AlertTitle>
        <AlertDescription>{endNote || `${modelName(model, "start")} ran out of time, so this is Busk Map's plan from the scores, without our notes.`}</AlertDescription>
      </Alert>
    );
  else if (phase === "error")
    foot = (
      <Alert variant="error" className="mt-4">
        <AlertTitle>{endCode === "qloo" ? "Qloo isn't answering" : "Something went wrong"}</AlertTitle>
        <AlertDescription>{endCode === "qloo" ? "Without taste data there's nothing to plan from. Try again in a minute." : onRetry ? "Your act and slot are kept. Try again." : "Your act and slot are kept. Open the link again to try."}</AlertDescription>
        {retry}
      </Alert>
    );
  else if (phase === "stopped")
    foot = (
      <Alert variant="warning" className="mt-4">
        <AlertTitle>The research stopped before finishing</AlertTitle>
        <AlertDescription>The connection dropped. The checks above already ran.</AlertDescription>
        {retry}
      </Alert>
    );
  else if (live) foot = <p className="m-0 mt-3 text-[13px] text-muted-foreground">{wording?.leave ?? "You can leave this page: the research keeps going and your busk will be here when you're back."}</p>;
  const modeLine = mode === "joined" ? modeText : null;
  return (
    <section
      aria-label={heading}
      data-testid="agent-stream"
      data-mode={mode}
      className={cn("block min-w-0 border-2 border-rule bg-card p-4 md:p-6", mode === "replay" && "[&_*]:animate-none! [&_*]:transition-none!")}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className={cn("m-0 font-display text-2xl leading-[26px] font-extrabold tracking-[0.01em] uppercase", hideHeading && "sr-only")}>{heading}</h2>
          {subtitle ? <p className="m-0 mt-0.5 text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
        </div>
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-mono text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">{count}</span>
          <Badge data-testid="agent-tag" variant={tag === "Live" ? "tag-on" : "tag"}>
            {tag}
          </Badge>
        </span>
      </header>
      {modeLine ? (
        <div className="mb-3 flex items-center gap-2 bg-muted px-2.5 py-2 text-sm leading-5" data-testid="agent-mode">
          <Icon name={mode === "replay" ? "refresh" : "users"} size={16} />
          {modeLine}
        </div>
      ) : null}
      {/* U22: the steps are always shown, never behind an inner fold (busk plan and Repertoire alike). */}
      {list}
      {foot}
      {footer ? <div className="mt-4 border-t-2 border-rule pt-4">{footer}</div> : null}
    </section>
  );
}
