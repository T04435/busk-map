"use client";

import { AiChip } from "@/components/honeycomb/ai-chip";
import { AgentTag } from "@/components/honeycomb/agent-tag";
import { ChevronRightIcon } from "lucide-react";
import { Fragment } from "react";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Loader } from "@/components/honeycomb/loader";
import { StepData } from "@/components/plan/agent-steps";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInput } from "@/lib/agent-steps";
import type { LearnLive } from "@/lib/learn-live";
import { funnelOf, plainStep } from "@/lib/learn-plain";
import { FINISH_TOOLS, toolLabel } from "@/lib/learn-tools";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import { modelName } from "@/lib/sources";

const COPY = PLAYLIST_COPY.learn;

/**
 * The research funnel in its learn mode (inventory F04; the DS ResearchFunnel's LearnFunnel): Qloo calls, artists matched,
 * crowds read, artists liked, songs checked, left out (a dashed cell; ONE count: suggested before + dismissed + already sung),
 * then new songs, which shows a loader until the picks are accepted. Honeycomb cells joined by the signal half-hex link.
 */
export function ResearchFunnel({ kind, totals, running }: { kind: "learn"; totals: LearnLive["totals"]; running: boolean }) {
  const items = funnelOf(totals);
  return (
    <section data-testid="learn-totals" data-kind={kind} aria-live={running ? "polite" : "off"} className="space-y-2">
      <h4 className="m-0 font-mono text-[11px] leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase">{COPY.totalsHeading}</h4>
      <ol className="m-0 flex list-none flex-wrap items-center gap-x-1 gap-y-1.5 p-0" aria-label={COPY.totalsHeading}>
        {items.map((item, i) => {
          const last = item.key === "newSongs";
          const choosing = last && running && item.value === 0;
          const text = String(item.value);
          return (
            <Fragment key={item.key}>
              <li
                data-total={item.key}
                className={cn(
                  "inline-flex items-center gap-1.5 text-[13px] leading-4 whitespace-nowrap text-muted-foreground",
                  last && "text-sm font-bold text-foreground",
                )}
              >
                <HexCell
                  size={last ? 34 : 30}
                  tone={item.key === "leftOut" || choosing ? "dashed" : last ? "primary" : "default"}
                  fontSize={text.length > 3 ? 10 : 12}
                  className={cn("font-mono font-bold tabular-nums", !(last && !choosing) && "text-foreground")}
                >
                  {choosing ? (
                    <>
                      <Loader size={14} label="Choosing" className="bm-loader-think text-primary" />
                      <span className="sr-only">choosing songs</span>
                    </>
                  ) : (
                    <span data-part="value">{item.value}</span>
                  )}
                </HexCell>
                <span className={last && !choosing ? "text-signal-text" : undefined}>{item.label}</span>
              </li>
              {i < items.length - 1 && (
                <li aria-hidden="true" className="px-1">
                  <span className="block h-[18px] w-3 bg-primary [clip-path:polygon(0_0,50%_0,100%_50%,50%_100%,0_100%)]" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}

/** The full count grid, for the raw view: every field of the `totals` event. */
function RawTotals({ live }: { live: LearnLive }) {
  const t = live.totals;
  const items = Object.entries(t) as [keyof typeof COPY.totals, number][];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5" data-testid="learn-totals-raw">
      {items.map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-1.5">
          <dt className="order-2 text-muted-foreground">{COPY.totals[key]}</dt>
          <dd className="order-1 font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The run's feed: the funnel, then each step as a plain-words card, newest first and with no step numbers. Tool names,
 * Qloo endpoints, ids and JSON appear only with `raw` (the page's "Show raw data" switch). Built for the learn stream; the
 * plan page keeps its own step view.
 */
export function LearnFeed({ live, heading, running, raw }: { live: LearnLive; heading: string; running: boolean; raw: boolean }) {
  const steps = [...live.steps].reverse();
  return (
    <div className="space-y-3 border-2 border-rule bg-card p-4" data-testid="learn-feed">
      <div className="space-y-3" data-testid="learn-run" data-run={live.number ?? ""} data-replay={live.replay ? "true" : "false"}>
        <h3 className="m-0 font-display text-xl leading-6 font-extrabold uppercase">
          {heading}
          {live.replay && <span className="ml-2 text-sm font-normal text-muted-foreground">(replay)</span>}
        </h3>
        {live.model === "claude" && <AiChip />}
        {live.status && <p className="text-sm text-muted-foreground">{live.status}</p>}
        <ResearchFunnel kind="learn" totals={live.totals} running={running} />
        {raw && <RawTotals live={live} />}
        {steps.length > 0 && (
          <ul className="space-y-3 text-sm" aria-live="polite" aria-label="Learn run steps">
            {steps.map((step) => {
              const plain = plainStep(step);
              const rejected = step.tool === FINISH_TOOLS.learn && step.status === "failed";
              return (
                <li key={step.id} className="space-y-2 border border-border bg-card p-3" data-testid="agent-step" data-tool={step.tool ?? ""} data-status={step.status}>
                  {step.tool ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium break-words">{plain.headline}</span>
                      {step.status === "running" && <Badge variant="outline">working</Badge>}
                      {rejected && <Badge variant="outline">rejected</Badge>}
                    </div>
                  ) : (
                    <p className="font-medium">{step.label}</p>
                  )}
                  {step.notes.map((note, i) => (
                    <p key={i} className="whitespace-pre-line text-muted-foreground" data-testid={`agent-note-${note.kind}`}>
                      {note.kind === "reasoning" ? <span className="font-medium">Thinking (summary): </span> : <AgentTag name={modelName(live.model, "label")} />}
                      {note.text}
                    </p>
                  ))}
                  {step.status !== "running" && plain.lines.map((line) => (
                    <p key={line} className="text-muted-foreground break-words">
                      {line}
                    </p>
                  ))}
                  {plain.chips.length > 0 && (
                    <ul aria-label="Because" className="flex flex-wrap gap-1.5">
                      {plain.chips.map((chip) => (
                        <li key={chip}>
                          <Badge variant="outline">{chip}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  {raw && step.tool && (
                    <div className="space-y-1 border-t pt-2" data-testid="agent-step-raw">
                      <p className="break-words">
                        <code className="font-mono text-xs">{step.tool}</code> <span className="text-muted-foreground">({toolLabel("learn", step.tool, step.label)})</span>{" "}
                        <span className="text-muted-foreground">{formatInput(step.input)}</span>
                      </p>
                      {step.source && <p className="text-xs text-muted-foreground break-words">{step.source}</p>}
                      {step.summary && <p className="text-xs break-words">{step.summary}</p>}
                      {step.output !== undefined && (
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <Button variant="link" size="sm" className="group h-auto px-0 text-muted-foreground">
                              <ChevronRightIcon aria-hidden className="transition-transform group-data-[state=open]:rotate-90" />
                              Data returned
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-2 overflow-x-auto" data-testid="agent-step-data">
                            <StepData value={step.output} />
                          </CollapsibleContent>
                        </Collapsible>
                      )}
                    </div>
                  )}
                  <span className="sr-only">{rejected ? "rejected" : step.status}</span>
                </li>
              );
            })}
          </ul>
        )}
        {running && live.steps.length === 0 && <Skeleton className="h-10 w-full" />}
        {raw && live.usage && (
          <p className="text-xs text-muted-foreground" data-testid="learn-usage">
            {live.usage.steps} model steps · {live.usage.inputTokens} in / {live.usage.outputTokens} out tokens · {Math.round(live.usage.ms / 100) / 10}s · stopped by {live.usage.stoppedBy}
          </p>
        )}
      </div>
    </div>
  );
}
