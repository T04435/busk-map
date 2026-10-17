"use client";

import { AgentTag } from "@/components/honeycomb/agent-tag";
import { Fragment, useId, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Fold } from "@/components/honeycomb/fold";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { Loader } from "@/components/honeycomb/loader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { scalar, type AgentStep, type RunUsage } from "@/lib/agent-steps";
import { modelName, type ExplanationsModel } from "@/lib/sources";
import { TOOL_ICON, TOOL_UI, type MiniPin } from "./tool-results";

/**
 * The research feed: the agent's steps as the busker sees them, newest first, no step numbers, each tool drawn as a plain-words
 * result card from its output fields. Tool names, inputs and the returned data appear only behind the card's own "Raw data"
 * switch (`showRaw`). Ported from the DS AgentStepStream.
 */
export { applyStreamEvent, formatInput, type AgentStep, type RunUsage, type StepNote } from "@/lib/agent-steps";

export type FeedPhase = "starting" | "working" | "thinking" | "done" | "fallback" | "error" | "stopped";
export type FeedMode = "live" | "replay" | "joined";

const isRowList = (v: unknown): v is Record<string, unknown>[] =>
  Array.isArray(v) && v.length > 0 && v.every((x) => x !== null && typeof x === "object" && !Array.isArray(x));

/** The DS .bm-json: the raw value, pretty-printed, in a scrolling mono block. */
const Json = ({ value }: { value: unknown }) => (
  <pre tabIndex={0} aria-label="Returned data as JSON" className="m-0 max-h-70 overflow-auto bg-muted px-2.5 py-2 font-mono text-xs leading-4 font-medium break-words whitespace-pre-wrap">
    {JSON.stringify(value, null, 2)}
  </pre>
);

/** A list of rows as a table: sticky mono headers, striped rows, numbers on the right, long values cut with the full value on hover. */
function RowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  // The frame scrolls on its own, so it takes focus: a keyboard user can scroll it.
  return (
    <div tabIndex={0} role="region" aria-label="Returned data, scrolls sideways" className="max-h-80 max-w-full overflow-auto border border-border">
      <table className="w-full border-collapse font-mono text-xs leading-4 font-medium tabular-nums">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="sticky top-0 bg-muted px-2 py-1.5 text-left text-[11px] font-bold tracking-[0.04em] whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="[&:nth-child(even)>td]:bg-[color-mix(in_oklab,var(--muted)_45%,transparent)]">
              {columns.map((c) => (
                <td
                  key={c}
                  title={scalar(row[c])}
                  className={cn("max-w-[260px] truncate border-t border-border px-2 py-[5px] align-top whitespace-nowrap", typeof row[c] === "number" ? "min-w-0 text-right" : "min-w-[72px]")}
                >
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

const Head = ({ children, note }: { children: ReactNode; note?: string }) => (
  <div className="mb-1 flex items-baseline gap-2 font-mono text-[11px] leading-4 font-bold tracking-[0.06em] uppercase">
    {children}
    {note ? <span className="font-medium text-muted-foreground">{note}</span> : null}
  </div>
);

/** The data a tool returned, as it is: scalars in a key/value table, lists of rows as tables, anything else as JSON. */
export function StepData({ value, view = "table" }: { value: unknown; view?: "table" | "json" }) {
  if (view === "json") return <Json value={value} />;
  if (isRowList(value)) return <RowsTable rows={value} />;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return <Json value={value} />;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => k !== "summary");
  const isFlat = (v: unknown) => v === null || typeof v !== "object" || (Array.isArray(v) && v.every((x) => x === null || typeof x !== "object"));
  const flat = keys.filter((k) => isFlat(obj[k]));
  const rows = keys.filter((k) => isRowList(obj[k]));
  const nested = keys.filter((k) => !flat.includes(k) && !rows.includes(k));
  return (
    <div className="grid min-w-0 gap-3">
      {flat.length > 0 && (
        <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] border border-border font-mono text-xs leading-4 font-medium">
          {flat.map((k) => (
            <Fragment key={k}>
              <dt className="border-t border-card bg-muted px-2 py-[5px] font-bold first:border-t-0">{k}</dt>
              <dd className="m-0 border-t border-border px-2 py-[5px] break-words first:border-t-0 [&:nth-child(2)]:border-t-0">{scalar(obj[k])}</dd>
            </Fragment>
          ))}
        </dl>
      )}
      {rows.map((k) => (
        <div key={k} className="min-w-0">
          <Head note={`${(obj[k] as unknown[]).length} rows`}>{k}</Head>
          <RowsTable rows={obj[k] as Record<string, unknown>[]} />
        </div>
      ))}
      {nested.map((k) => (
        <div key={k} className="min-w-0">
          <Head>{k}</Head>
          <Json value={obj[k]} />
        </div>
      ))}
    </div>
  );
}

/** The agent's tag before its words: the Hive's mark and "Hive" (or "Test model" offline, never the Hive's name for the mock). */
const Say = ({ model, children, testId }: { model: ExplanationsModel | null; children: ReactNode; testId?: string }) => (
  <p className="m-0 text-sm leading-5 text-muted-foreground" data-testid={testId}>
    <AgentTag name={modelName(model, "label")} />
    {children}
  </p>
);

/** The raw block under a card: tool, summary, the notes, the inputs Claude chose and exactly what came back. */
function RawBlock({ step, model, view }: { step: AgentStep; model: ExplanationsModel | null; view: "table" | "json" }) {
  const inputs =
    step.input !== null && typeof step.input === "object"
      ? Object.entries(step.input as Record<string, unknown>).map(([k, v]): [string, string] => [
          k,
          v !== null && typeof v === "object" && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>).map(([kk, vv]) => `${kk} ${scalar(vv)}`).join(", ") : scalar(v),
        ])
      : step.input !== undefined && step.input !== null
        ? [["", scalar(step.input)] as [string, string]]
        : [];
  return (
    <div className="grid min-w-0 gap-2 border-t border-dashed border-input bg-muted p-3 [overflow-wrap:anywhere]" data-testid="agent-step-raw">
      <div className="flex flex-wrap items-baseline gap-2 [&_code]:font-mono [&_code]:text-xs [&_code]:font-bold">
        <span className="bg-foreground px-[5px] font-mono text-[10px] leading-4 font-bold tracking-[0.08em] text-background uppercase">Raw</span>
        <code>{step.tool}</code>
        {step.summary ? <span className="font-mono text-xs leading-4 font-medium text-muted-foreground">{step.summary}</span> : null}
      </div>
      {step.source ? <p className="m-0 font-mono text-xs leading-4 text-muted-foreground">{step.source}</p> : null}
      {step.notes.length ? (
        <div className="grid gap-1">
          {step.notes.map((n, i) => (
            <p key={i} className="m-0 font-mono text-xs leading-[18px] font-medium whitespace-pre-line" data-testid={`agent-note-${n.kind}`}>
              <b>{n.kind === "reasoning" ? "Thinking (summary): " : `${modelName(model, "label")}: `}</b>
              {n.text}
            </p>
          ))}
        </div>
      ) : null}
      {inputs.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-1 p-0">
          {inputs.map(([k, v]) => (
            <li key={k} className="inline-flex max-w-full gap-1.5 border border-border bg-card px-1.5 py-0.5 font-mono text-xs leading-[18px] font-medium [overflow-wrap:anywhere]">
              {k ? <span className="text-muted-foreground">{k}</span> : null}
              {v}
            </li>
          ))}
        </ul>
      ) : null}
      {step.output !== undefined ? (
        <div className="min-w-0" data-testid="agent-step-data">
          <StepData value={step.output} view={view} />
        </div>
      ) : null}
    </div>
  );
}

function ToolCard({ step, model, raw, rawView, when, pins, fresh }: { step: AgentStep; model: ExplanationsModel | null; raw: boolean; rawView: "table" | "json"; when?: string; pins?: MiniPin[]; fresh: boolean }) {
  const ui = step.tool ? TOOL_UI[step.tool] : undefined;
  const icon = (step.tool && TOOL_ICON[step.tool]) || "dots";
  const running = step.status === "running";
  const failed = step.status === "failed";
  const rejected = failed && step.tool === "finish_plan";
  const bad = failed && !rejected;
  const cut = step.status === "cut";
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
  else if (step.output !== undefined && ui) body = ui.render(out, step, { when, pins, model });
  else if (step.summary) body = foot(step.summary);
  return (
    <li
      data-testid="agent-step"
      data-tool={step.tool ?? ""}
      data-status={rejected ? "rejected" : step.status}
      className={cn(
        "grid min-w-0 gap-3 border p-4",
        running ? "border-2 border-dashed border-input bg-background" : "border-border bg-card",
        fresh && !running && "border-2 border-rule shadow-sm",
        failed && "border-destructive",
      )}
    >
      <div className="grid grid-cols-[30px_minmax(0,1fr)] items-start gap-3">
        <HexCell size={30} tone={running ? "primary" : bad ? "error" : cut ? "dashed" : "default"}>
          {running ? <Loader size={18} label="Working" /> : bad ? <Icon name="x" size={15} strokeWidth={3} /> : <Icon name={icon} size={15} />}
        </HexCell>
        <div className="grid min-w-0 gap-1">
          <b className={cn(running ? "font-sans text-base leading-[22px] font-bold" : "font-display text-xl leading-6 font-extrabold uppercase")}>{title}</b>
          {say.length ? (
            <Say model={model} testId="agent-note-text">
              {say.join(" ")}
            </Say>
          ) : null}
        </div>
        <span className="sr-only">{rejected ? "rejected" : step.status}</span>
      </div>
      {body ? <div className="grid min-w-0 gap-3 pl-[42px]">{body}</div> : null}
      {raw ? <RawBlock step={step} model={model} view={rawView} /> : null}
    </li>
  );
}

const fmtTime = (sec: number) => {
  const s = Math.max(0, Math.round(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

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
  collapsed = false,
  showRaw,
  onShowRawChange,
  footer,
  title,
  subtitle,
  usage,
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
  collapsed?: boolean;
  showRaw: boolean;
  onShowRawChange: (on: boolean) => void;
  /** "Data used", at the foot. */
  footer?: ReactNode;
  title?: string;
  subtitle?: string;
  /** The run's totals, shown under "Raw data" (B50). */
  usage?: RunUsage | null;
}) {
  const rawId = useId();
  const [rawView, setRawView] = useState<"table" | "json">("table");
  // Each time Raw data is turned on the folded feed remounts open; turning it off again leaves the feed open (not folded shut
  // under the reader).
  const [rawOpens, setRawOpens] = useState(0);
  const onRawChange = (on: boolean) => {
    if (on) setRawOpens((n) => n + 1);
    onShowRawChange(on);
  };
  const live = phase === "starting" || phase === "working" || phase === "thinking";
  const raw = showRaw && !live;
  // Once the run is over, a step still marked running was cut short.
  const calls = steps.filter((s) => s.tool).map((s) => (!live && s.status === "running" ? { ...s, status: "cut" as const } : s));
  const pending = steps.length > 0 && steps[steps.length - 1].tool === null ? steps[steps.length - 1] : null;
  const feed = calls.slice().reverse();
  const thinking = live && (pending || phase === "thinking" || steps.length === 0);
  const count = `${calls.length} ${calls.length === 1 ? "check" : "checks"}${seconds != null ? ` · ${Math.round(seconds)} s` : ""}`;
  const tag = mode === "replay" ? "Replay" : mode === "joined" ? "Joined" : phase === "done" || phase === "fallback" ? "Finished" : phase === "error" || phase === "stopped" ? "Stopped" : "Live";
  const heading = title ?? (live ? "Finding your best pitches" : "How we found your pitches");
  const list = (
    <ol aria-live={mode === "replay" ? "off" : "polite"} aria-label="Research, newest first" className="m-0 grid list-none gap-3 p-0" data-testid="agent-feed">
      {thinking ? (
        <li className="grid min-w-0 gap-3 border-2 border-dashed border-input bg-background p-4" data-testid="agent-thinking">
          <div className="grid grid-cols-[30px_minmax(0,1fr)] items-start gap-3">
            <HexCell size={30} tone="dashed">
              <Loader size={20} label="Thinking" className="bm-loader-think text-primary" />
            </HexCell>
            <div className="grid min-w-0 gap-1">
              <b className="font-sans text-base leading-[22px] font-bold">
                {steps.length === 0 ? "Reading your act, day and permit" : "Thinking about what to check next"}
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
      {feed.map((s, i) => (
        <ToolCard key={s.id} step={s} model={model} raw={raw} rawView={rawView} when={when} pins={pins} fresh={live && i === 0 && !thinking} />
      ))}
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
  else if (live) foot = <p className="m-0 mt-3 text-[13px] text-muted-foreground">You can leave this page: the research keeps going and your busk will be here when you&apos;re back.</p>;
  const totals: [string, string | number][] | null = raw && usage
    ? [
        ["Steps", usage.steps],
        ["Time", fmtTime(usage.ms / 1000)],
        ["Tokens in", usage.inputTokens.toLocaleString("en-AU")],
        ["Out", usage.outputTokens.toLocaleString("en-AU")],
        ["Thinking", usage.reasoningTokens.toLocaleString("en-AU")],
        ["Stopped by", usage.stoppedBy],
      ]
    : null;
  const modeLine = mode !== "live" ? (mode === "replay" ? modeText || "Showing the research from earlier. Nothing new was asked." : modeText) : null;
  return (
    <section
      aria-label={heading}
      data-testid="agent-stream"
      data-mode={mode}
      className={cn("block min-w-0 border-2 border-rule bg-card p-4 md:p-6", mode === "replay" && "[&_*]:animate-none! [&_*]:transition-none!")}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 font-display text-2xl leading-[26px] font-extrabold tracking-[0.01em] uppercase">{heading}</h2>
          {subtitle ? <p className="m-0 mt-0.5 text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
        </div>
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-mono text-[13px] whitespace-nowrap text-muted-foreground tabular-nums">{count}</span>
          <span
            data-testid="agent-tag"
            className={cn("px-1.5 py-[3px] font-mono text-[11px] leading-[normal] font-bold tracking-[0.06em] uppercase shadow-[inset_0_0_0_1.5px_var(--rule)]", tag === "Live" && "bg-primary text-primary-foreground")}
          >
            {tag}
          </span>
          {live ? null : (
            <span className="inline-flex items-center gap-1.5 border-l border-border pl-2 font-mono text-[11px] leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase">
              <span id={rawId}>Raw data</span>
              <Switch aria-labelledby={rawId} checked={showRaw} onCheckedChange={onRawChange} data-testid="raw-switch" className="scale-[.85]" />
            </span>
          )}
          {raw ? (
            <span role="group" aria-label="Show raw data as" className="inline-flex border-[1.5px] border-rule">
              {(["table", "json"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={rawView === k}
                  onClick={() => setRawView(k)}
                  className="cursor-pointer border-0 bg-transparent px-2 py-[3px] font-mono text-[10px] leading-4 font-bold tracking-[0.06em] text-foreground uppercase aria-pressed:bg-foreground aria-pressed:text-background"
                >
                  {k === "table" ? "Table" : "JSON"}
                </button>
              ))}
            </span>
          ) : null}
        </span>
      </header>
      {modeLine ? (
        <div className="mb-3 flex items-center gap-2 bg-muted px-2.5 py-2 text-sm leading-5" data-testid="agent-mode">
          <Icon name={mode === "replay" ? "refresh" : "users"} size={16} />
          {modeLine}
        </div>
      ) : null}
      {totals ? (
        <dl aria-label="Run totals" className="m-0 mb-3 grid grid-cols-3 gap-px border border-border bg-border">
          {totals.map(([k, v]) => (
            <div key={k} className="bg-card px-2.5 py-2">
              <dt className="font-mono text-[10px] leading-[14px] font-bold tracking-[0.08em] text-muted-foreground uppercase">{k}</dt>
              <dd className="m-0 mt-0.5 font-mono text-[15px] leading-5 font-bold tabular-nums [overflow-wrap:break-word]">{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {collapsed || mode === "replay" ? (
        // A replay opens already folded; a run that just finished folds with a short animation (the phone and tablet layout). Raw data opens it.
        <Fold key={`list-${rawOpens}`} label={mode === "replay" ? "Every check, from earlier" : "Every check"} count={calls.length} arriving={mode !== "replay" && rawOpens === 0} defaultOpen={raw || rawOpens > 0} data-testid="agent-disclosure">
          {list}
        </Fold>
      ) : (
        list
      )}
      {foot}
      {footer ? <div className="mt-4 border-t-2 border-rule pt-4">{footer}</div> : null}
    </section>
  );
}
