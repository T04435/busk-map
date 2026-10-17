"use client";

import { useId } from "react";
import { cn } from "cn";
import { HexCell, initialsOf, type HexTone } from "@/components/honeycomb/hex-cell";
import { AgentLockup } from "@/components/honeycomb/agent-lockup";
import { HIVE_CELLS, hiveProgress } from "@/lib/agent-persona";
import { Icon, type IconName } from "@/components/honeycomb/icon";
import { Loader } from "@/components/honeycomb/loader";
import { RepertoireFunnel } from "./repertoire-funnel";
import type { RepertoireStep, RepertoireStepKey, RepertoireTotals, StepStatus } from "./types";

export type RepertoireStepInfo = { key: RepertoireStepKey; title: string; source: string; icon: IconName };

/** The nine steps in order (spec: repertoire-research-spec.md). */
export const REPERTOIRE_STEPS: RepertoireStepInfo[] = [
  { key: "profile", title: "Reading your Spotify profile", source: "Spotify", icon: "spotify" },
  { key: "songs", title: "Loading your songs", source: "Spotify · Last.fm", icon: "music" },
  { key: "qloo", title: "Finding you on Qloo", source: "Qloo", icon: "search" },
  { key: "soundsLike", title: "Who you sound like", source: "Qloo", icon: "users" },
  { key: "fans", title: "Who your fans are", source: "Qloo", icon: "footfall" },
  { key: "fansLove", title: "What your fans also love", source: "Qloo", icon: "trending" },
  { key: "learn", title: "Songs your fans would stop for", source: "Qloo · Spotify", icon: "learn" },
  { key: "genres", title: "Your sound in genres", source: "Qloo", icon: "list" },
  { key: "summary", title: "Summing up your act", source: "Claude", icon: "info" },
];

const TAG = "px-1.5 py-[3px] font-mono text-[11px] leading-[normal] font-bold tracking-[0.06em] uppercase";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none";

const STATUS_TAG: Partial<Record<StepStatus, string>> = { running: "Working", failed: "Didn't work", skipped: "Skipped" };
const CELL_TONE: Record<StepStatus, HexTone> = { pending: "dashed", running: "primary", done: "default", failed: "error", skipped: "muted" };

function StepCard({ info, step, n }: { info: RepertoireStepInfo; step: RepertoireStep | undefined; n: number }) {
  const status: StepStatus = step?.status ?? "pending";
  const running = status === "running";
  const quiet = status === "pending";
  const cells = (step?.cells ?? []).slice(0, 6);
  const tag = STATUS_TAG[status];
  const qloo = info.source.startsWith("Qloo");
  return (
    <li
      aria-current={running ? "step" : undefined}
      data-status={status}
      className={cn("flex gap-3 p-3", running ? "my-1 mr-1 border-2 border-rule bg-popover shadow-[4px_4px_0_var(--primary)]" : "border-t border-border first:border-t-0")}
    >
      <HexCell size={40} tone={CELL_TONE[status]} label={`Step ${n}, ${status === "done" ? "done" : status === "pending" ? "waiting" : (tag ?? status).toLowerCase()}`} className={cn(status === "running" && "text-primary-foreground")}>
        {running ? <Loader size={18} label="Working" /> : status === "failed" ? <Icon name="x" size={18} /> : <span className={cn("font-mono font-bold", quiet && "text-muted-foreground")}>{n}</span>}
      </HexCell>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className={cn("m-0 text-base leading-5 font-bold [overflow-wrap:anywhere]", quiet && "font-medium text-muted-foreground")}>{info.title}</h3>
          {tag ? (
            <span
              className={cn(
                TAG,
                running ? "bg-primary text-primary-foreground" : status === "failed" ? "text-destructive shadow-[inset_0_0_0_1.5px_var(--destructive)]" : "text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--border)]",
              )}
            >
              {tag}
            </span>
          ) : null}
        </div>
        <p className={cn("m-0 mt-0.5 font-mono text-[11px] leading-4 font-medium tracking-[0.06em] uppercase", qloo && !quiet ? "text-qloo" : "text-muted-foreground")}>
          <Icon name={info.icon} size={12} className="mr-1 inline-block align-[-1px]" />
          {info.source}
        </p>
        {status === "done" && step?.found ? <p className="m-0 mt-1.5 text-sm leading-5 text-foreground [overflow-wrap:anywhere]">{step.found}</p> : null}
        {(status === "failed" || status === "skipped") && step?.note ? <p className="m-0 mt-1.5 text-sm leading-5 text-muted-foreground [overflow-wrap:anywhere]">{step.note}</p> : null}
        {status === "done" && cells.length > 0 ? (
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0">
            {cells.map((c, i) => (
              <li key={`${c.name}-${i}`}>
                <HexCell size={28} tone="media" image={c.image} fontSize={10} className="font-mono font-bold">
                  {initialsOf(c.name)}
                </HexCell>
                <span className="sr-only">{c.name}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The Repertoire research run, drawn like a busk's research: a header with the Hive's lockup (its mark fills as steps finish)
 * and the Live/Finished tag, the honeycomb funnel, and the nine step cards in order (plain titles; each done step's note is the
 * agent's). When done it can fold under "How we built your Repertoire".
 */
export function RepertoireResearch({
  steps,
  totals,
  phase,
  seconds,
  folded,
  onToggleFold,
  className,
}: {
  steps: RepertoireStep[];
  totals: Partial<RepertoireTotals> | null;
  phase: "running" | "done" | "failed";
  seconds?: number | null;
  folded?: boolean;
  onToggleFold?: () => void;
  className?: string;
}) {
  const bodyId = useId();
  const running = phase === "running";
  const done = phase === "done";
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const finished = REPERTOIRE_STEPS.filter((i) => ["done", "failed", "skipped"].includes(byKey.get(i.key)?.status ?? "pending")).length;
  const secs = seconds != null ? ` · ${Math.round(seconds)} s` : "";
  const calls = totals?.qlooCalls ?? 0;
  const summary = `${REPERTOIRE_STEPS.length} steps · ${calls} Qloo ${calls === 1 ? "call" : "calls"}${secs}`;
  const canFold = done && !!onToggleFold;
  const isFolded = canFold && !!folded;
  const tag = running ? "Live" : done ? "Finished" : "Stopped";

  const tagEl = <span className={cn(TAG, running ? "bg-primary text-primary-foreground" : "shadow-[inset_0_0_0_1.5px_var(--rule)]")}>{tag}</span>;
  // While it runs, the lockup is the heading ("The Hive is researching your act"), so the Live tag rides on the meta line.
  const title = running ? null : (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {tagEl}
      <span className="font-display text-[28px] leading-8 font-extrabold uppercase [overflow-wrap:anywhere]">
        {done ? "How we built your Repertoire" : "Research stopped"}
      </span>
    </span>
  );
  const lockup = (
    <AgentLockup
      live={running}
      progress={done ? HIVE_CELLS : hiveProgress(finished, REPERTOIRE_STEPS.length)}
      status={running ? "is researching your act" : done ? "researched your act" : "couldn't finish researching your act"}
    />
  );
  const meta = (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {running ? tagEl : null}
      <span className="font-mono text-xs font-medium text-muted-foreground">{running ? `${finished} of ${REPERTOIRE_STEPS.length} steps${secs}` : summary}</span>
    </span>
  );
  const header = (
    <>
      {title}
      {lockup}
      {meta}
    </>
  );

  return (
    <section aria-label="Repertoire research" className={cn("border-2 border-rule bg-card", className)}>
      {canFold ? (
        <button
          type="button"
          onClick={onToggleFold}
          aria-expanded={!isFolded}
          aria-controls={bodyId}
          className={cn("flex w-full items-center gap-3 bg-transparent p-3 text-left text-foreground", FOCUS)}
        >
          <span className="flex min-w-0 flex-1 flex-col items-start gap-3">{header}</span>
          <Icon name={isFolded ? "chevron-down" : "chevron-up"} size={20} className="flex-none" />
        </button>
      ) : (
        <div className="flex flex-col items-start gap-3 p-3">{header}</div>
      )}
      <div id={bodyId} hidden={isFolded}>
        <div className="border-t border-border p-3">
          <RepertoireFunnel totals={totals} live={running} />
        </div>
        <ol aria-live={running ? "polite" : "off"} className="m-0 grid list-none border-t border-border p-3 lg:grid-cols-2 lg:gap-x-6">
          {REPERTOIRE_STEPS.map((info, i) => (
            <StepCard key={info.key} info={info} step={byKey.get(info.key)} n={i + 1} />
          ))}
        </ol>
      </div>
    </section>
  );
}
