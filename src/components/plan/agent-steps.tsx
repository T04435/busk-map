"use client";

import { useId, useState, type ReactNode } from "react";
import { Clock, Dot, Users, X } from "lucide-react";
import { cn } from "cn";
import { Fold } from "@/components/honeycomb/fold";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Loader } from "@/components/honeycomb/loader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { formatInput, scalar, type AgentStep } from "@/lib/agent-steps";
import { modelName, type ExplanationsModel } from "@/lib/sources";
import { TOOL_ICON, TOOL_UI } from "./tool-results";

/**
 * The research feed: the agent's steps as the busker sees them, newest first, no step numbers, each tool drawn as a plain-words
 * result card from its output fields. Tool names, inputs and the returned data appear only behind the page-level "Show raw
 * data" switch (`showRaw`).
 */
export { applyStreamEvent, formatInput, type AgentStep, type RunUsage, type StepNote } from "@/lib/agent-steps";

export type FeedPhase = "starting" | "working" | "thinking" | "done" | "fallback" | "error" | "stopped";
export type FeedMode = "live" | "replay" | "joined";

const isRowList = (v: unknown): v is Record<string, unknown>[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => x !== null && typeof x === "object" && !Array.isArray(x));

function RowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  // The frame scrolls sideways on its own, so it takes focus: a keyboard user can scroll it.
  return (
    <div tabIndex={0} role="region" aria-label="Returned data, scrolls sideways" className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-xs tabular-nums">
        <thead>
          <tr className="border-b-2 border-rule">
            {columns.map((c) => (
              <th key={c} scope="col" className="h-8 px-2 text-left font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border even:bg-muted/50">
              {columns.map((c) => (
                <td key={c} className={cn("max-w-64 px-2 py-1 align-top break-words whitespace-normal", typeof row[c] === "number" && "text-right")}>
                  {scalar(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const Json = ({ value }: { value: unknown }) => <pre tabIndex={0} aria-label="Returned data as JSON" className="m-0 overflow-x-auto bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{JSON.stringify(value, null, 2)}</pre>;

/** The data a tool returned, as it is: scalars in a key/value table, lists of rows as tables, anything else as JSON. */
export function StepData({ value, view = "table" }: { value: unknown; view?: "table" | "json" }) {
  if (view === "json") return <Json value={value} />;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return isRowList(value) ? <RowsTable rows={value} /> : <Json value={value} />;
  const entries = Object.entries(value as Record<string, unknown>).filter(([k]) => k !== "summary");
  const isFlat = (v: unknown) => v === null || typeof v !== "object" || (Array.isArray(v) && v.every((x) => x === null || typeof x !== "object"));
  const flat = entries.filter(([, v]) => isFlat(v));
  const tables = entries.filter(([, v]) => isRowList(v));
  const nested = entries.filter(([, v]) => !isFlat(v) && !isRowList(v));
  return (
    <div className="space-y-3">
      {flat.length > 0 && <RowsTable rows={[Object.fromEntries(flat)]} />}
      {tables.map(([k, rows]) => (
        <div key={k} className="space-y-1">
          <p className="m-0 text-xs font-bold">{k}</p>
          <RowsTable rows={rows as Record<string, unknown>[]} />
        </div>
      ))}
      {nested.map(([k, v]) => (
        <div key={k} className="space-y-1">
          <p className="m-0 text-xs font-bold">{k}</p>
          <Json value={v} />
        </div>
      ))}
    </div>
  );
}

function ToolCard({ step, model, raw, rawView, when, fresh }: { step: AgentStep; model: ExplanationsModel | null; raw: boolean; rawView: "table" | "json"; when?: string; fresh: boolean }) {
  const ui = step.tool ? TOOL_UI[step.tool] : undefined;
  const Icon = (step.tool && (TOOL_ICON as Record<string, typeof Users>)[step.tool]) || Dot;
  const running = step.status === "running";
  const failed = step.status === "failed";
  const rejected = failed && step.tool === "finish_plan";
  const cut = step.status === "cut";
  const say = step.notes.filter((n) => n.kind === "text");
  const title = running ? `${ui?.doing(step) ?? step.label}…` : (ui?.title(step) ?? step.label);
  const out = step.output !== null && typeof step.output === "object" ? (step.output as Record<string, unknown>) : {};
  let body: ReactNode = null;
  if (running)
    body = (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-3 w-[70%]" />
        <Skeleton className="h-3 w-[45%]" />
      </div>
    );
  else if (rejected) body = ui?.render(out, step, { when });
  else if (failed) body = <p className="m-0 text-sm text-muted-foreground">This check didn&apos;t come back, so the plan goes on without it.</p>;
  else if (cut) body = <p className="m-0 text-sm text-muted-foreground">Stopped before it finished.</p>;
  else if (step.output !== undefined && ui) body = ui.render(out, step, { when });
  else if (step.summary) body = <p className="m-0 text-sm text-muted-foreground">{step.summary}</p>;
  return (
    <li
      data-testid="agent-step"
      data-tool={step.tool ?? ""}
      data-status={rejected ? "rejected" : step.status}
      className={cn("flex flex-col gap-3 border-2 bg-card p-4", running ? "border-dashed border-input" : "border-rule", fresh && "motion-safe:animate-in motion-safe:fade-in-0")}
    >
      <div className="flex items-start gap-3">
        <HexCell size={32} tone={running ? "primary" : failed ? "error" : cut ? "dashed" : "default"}>
          {running ? <Loader size={18} label="Working" /> : failed ? <X aria-hidden="true" className="size-4" strokeWidth={3} /> : <Icon aria-hidden="true" className="size-4" />}
        </HexCell>
        <div className="min-w-0 flex-1">
          <b className="block text-[17px] leading-6">{title}</b>
          {say.map((n, i) => (
            <p key={i} className="m-0 mt-1 text-sm text-muted-foreground" data-testid="agent-note-text">
              <span className="mr-2 border border-input px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-[0.06em] uppercase">{modelName(model, "label")}</span>
              {n.text}
            </p>
          ))}
        </div>
        <span className="sr-only">{rejected ? "rejected" : step.status}</span>
      </div>
      {body ? <div className="space-y-3">{body}</div> : null}
      {raw ? (
        <div className="space-y-2 border-t border-border pt-3" data-testid="agent-step-raw">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="font-bold uppercase">Raw</span>
            <code>{step.tool}</code>
            {step.summary ? <span className="text-muted-foreground">{step.summary}</span> : null}
          </div>
          {step.source ? <p className="m-0 text-xs text-muted-foreground">{step.source}</p> : null}
          {step.notes.map((n, i) => (
            <p key={i} className="m-0 text-sm whitespace-pre-line text-muted-foreground" data-testid={`agent-note-${n.kind}`}>
              <span className="font-bold">{n.kind === "reasoning" ? "Thinking (summary): " : `${modelName(model, "label")}: `}</span>
              {n.text}
            </p>
          ))}
          {step.input !== undefined ? <p className="m-0 font-mono text-xs break-words">{formatInput(step.input)}</p> : null}
          {step.output !== undefined ? (
            <div data-testid="agent-step-data">
              <StepData value={step.output} view={rawView} />
            </div>
          ) : null}
        </div>
      ) : null}
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
  when,
  collapsed = false,
  showRaw,
  onShowRawChange,
  footer,
  title,
  subtitle,
}: {
  steps: AgentStep[];
  model?: ExplanationsModel | null;
  phase: FeedPhase;
  mode?: FeedMode;
  modeText?: string | null;
  seconds?: number | null;
  endNote?: string | null;
  endCode?: "qloo" | null;
  when?: string;
  collapsed?: boolean;
  showRaw: boolean;
  onShowRawChange: (on: boolean) => void;
  /** "Data used", at the foot. */
  footer?: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const rawId = useId();
  const [rawView, setRawView] = useState<"table" | "json">("table");
  const live = phase === "starting" || phase === "working" || phase === "thinking";
  const raw = showRaw && !live;
  // Once the run is over, a step still marked running was cut short.
  const calls = steps.filter((s) => s.tool).map((s) => (!live && s.status === "running" ? { ...s, status: "cut" as const } : s));
  const pending = steps.length > 0 && steps[steps.length - 1].tool === null ? steps[steps.length - 1] : null;
  const feed = calls.slice().reverse();
  const thinking = live && (pending || phase === "thinking" || steps.length === 0);
  const count = `${calls.length} ${calls.length === 1 ? "check" : "checks"}${seconds != null ? ` · ${Math.round(seconds)} s` : ""}`;
  const tag = mode === "replay" ? "Replay" : mode === "joined" ? "Joined" : phase === "done" || phase === "fallback" ? "Finished" : phase === "error" || phase === "stopped" ? "Stopped" : "Live";
  const list = (
    <ol aria-live={mode === "replay" ? "off" : "polite"} aria-label="Research, newest first" className="m-0 flex list-none flex-col gap-3 p-0" data-testid="agent-feed">
      {thinking ? (
        <li className="flex flex-col gap-2 border-2 border-dashed border-input bg-card p-4" data-testid="agent-thinking">
          <div className="flex items-start gap-3">
            <HexCell size={32} tone="dashed">
              <Loader size={20} label="Thinking" />
            </HexCell>
            <div className="min-w-0 flex-1">
              <b className="block text-[17px] leading-6">{steps.length === 0 ? "Reading your act, day and permit" : "Thinking about what to check next"}</b>
              {pending ? (
                <p className="m-0 mt-1 text-sm text-muted-foreground">
                  <span className="mr-2 border border-input px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-[0.06em] uppercase">{modelName(model, "label")}</span>
                  {pending.notes.map((n) => n.text).join(" ")}
                </p>
              ) : null}
            </div>
          </div>
        </li>
      ) : null}
      {feed.map((s, i) => (
        <ToolCard key={s.id} step={s} model={model} raw={raw} rawView={rawView} when={when} fresh={live && i === 0 && !thinking} />
      ))}
    </ol>
  );
  let foot: ReactNode = null;
  if (phase === "fallback")
    foot = (
      <Alert variant="estimate">
        <AlertTitle>Planned from the data alone</AlertTitle>
        <AlertDescription>{endNote || `${modelName(model, "start")} didn't finish in time, so your pitches come straight from Busk Map's scores, with standard reasons.`}</AlertDescription>
      </Alert>
    );
  else if (phase === "error")
    foot = (
      <Alert variant="error">
        <AlertTitle>{endCode === "qloo" ? "Qloo isn't answering" : "Something went wrong"}</AlertTitle>
        <AlertDescription>{endCode === "qloo" ? "Without taste data there's nothing to plan from. Open the link again in a minute." : "Your act and slot are kept. Open the link again to try."}</AlertDescription>
      </Alert>
    );
  else if (phase === "stopped")
    foot = (
      <Alert variant="warning">
        <AlertTitle>The research stopped before finishing</AlertTitle>
        <AlertDescription>The connection dropped. The checks above already ran.</AlertDescription>
      </Alert>
    );
  else if (live) foot = <p className="m-0 text-sm text-muted-foreground">You can leave this page: the research keeps going and your busk will be here when you&apos;re back.</p>;
  return (
    <section aria-label={title ?? (live ? "Finding your best pitches" : "How we found your pitches")} data-testid="agent-stream" data-mode={mode} className="flex min-w-0 flex-col gap-4 border-2 border-rule bg-card p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 font-display text-[28px] leading-none font-extrabold uppercase">{title ?? (live ? "Finding your best pitches" : "How we found your pitches")}</h2>
          {subtitle ? <p className="m-0 mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-bold tracking-[0.04em] uppercase">
          <span>{count}</span>
          <span data-testid="agent-tag" className={cn("border-[1.5px] px-2 py-0.5", live ? "border-(--fill-rule) bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>{tag}</span>
          {live ? null : (
            <span className="flex items-center gap-2">
              <label htmlFor={rawId} className="inline-flex min-h-tap cursor-pointer items-center">Show raw data</label>
              <Switch id={rawId} checked={showRaw} onCheckedChange={onShowRawChange} data-testid="raw-switch" />
            </span>
          )}
          {raw ? (
            <span role="group" aria-label="Show raw data as" className="flex">
              {(["table", "json"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={rawView === k}
                  onClick={() => setRawView(k)}
                  className="min-h-9 border-[1.5px] border-rule px-3 aria-pressed:bg-foreground aria-pressed:text-background"
                >
                  {k === "table" ? "Table" : "JSON"}
                </button>
              ))}
            </span>
          ) : null}
        </div>
      </header>
      {modeText ? (
        <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground" data-testid="agent-mode">
          {mode === "replay" ? <Clock aria-hidden="true" className="size-4" /> : <Users aria-hidden="true" className="size-4" />}
          {modeText}
        </p>
      ) : null}
      {collapsed || mode === "replay" ? (
        // A replay opens already folded; a run that just finished folds with a short animation (the phone and tablet layout).
        <Fold label={mode === "replay" ? "Every check, from earlier" : "Every check"} count={calls.length} arriving={mode !== "replay"} data-testid="agent-disclosure">
          {list}
        </Fold>
      ) : (
        list
      )}
      {foot}
      {footer}
    </section>
  );
}

