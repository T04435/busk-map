"use client";

import { SongRow } from "@/components/honeycomb/song-row";
import { useEffect, useState } from "react";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { BothAgreeBadge } from "@/components/honeycomb/both-agree-badge";
import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { baselineViewSchema, type BaselineView, type PlanPitch, type PlanRequest } from "@/lib/plan-schema";
import { modelName, type ExplanationsModel } from "@/lib/sources";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";

export type BaselineState = { status: "loading" } | { status: "done"; baseline: BaselineView } | { status: "unavailable"; message: string };

const UNAVAILABLE = "The plain-AI baseline is unavailable right now. Busk Map's plan doesn't depend on it.";

/**
 * Fetch the plain-AI baseline for this plan, once `enabled` (the plan is
 * shown). The server starts it when the agent's data is in (or after the
 * page, with run=0), so this is usually instant.
 */
export function useBaseline(request: PlanRequest, faults: string | null, enabled = true): BaselineState {
  const [state, setState] = useState<BaselineState>({ status: "loading" });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(faults ? { "x-buskmap-faults": faults } : {}) },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null);
        const parsed = baselineViewSchema.safeParse(body?.baseline);
        if (response.ok && body?.status === "ok" && parsed.success) setState({ status: "done", baseline: parsed.data });
        else
          setState({
            status: "unavailable",
            message: body?.status === "unavailable" ? "The plain-AI baseline isn't configured here." : (body?.error?.message ?? UNAVAILABLE),
          });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "unavailable", message: UNAVAILABLE });
      });
    return () => controller.abort();
  }, [request, faults, enabled]);
  return state;
}

const pct = (n: number | null) => (n === null ? "n/a" : String(Math.round(n * 100)));

const STATUS_LABEL: Record<BaselineView["plain"][number]["status"], string> = {
  ours: "Both agree",
  scored: "Scored by Busk Map",
  "not-legal": "Not a legal pitch",
  "no-data": "No data for this spot",
};
const STATUS_VARIANT = { ours: "neutral", scored: "neutral", "not-legal": "restricted", "no-data": "estimate" } as const;

type Pitch = Pick<PlanPitch, "id" | "name" | "score" | "discovery" | "factors" | "footfallSource" | "cellRank" | "evidence" | "amplification">;

/** What Busk Map knows about a pitch that a plain AI can't. */
function evidenceLines(pitch: Pitch): string[] {
  const lines: string[] = [];
  if (pitch.factors.taste !== null) lines.push(`Qloo taste match ${pct(pitch.factors.taste)} out of 100${pitch.cellRank ? ` (your no. ${pitch.cellRank} area on Qloo's heatmap)` : ""}`);
  if (pitch.evidence.sensor) {
    lines.push(`${pitch.footfallSource === "sensor" ? "About" : "Roughly"} ${pitch.evidence.sensor.avgHourly.toLocaleString("en-AU")} people an hour (city sensors, estimate)`);
  } else if (pitch.footfallSource === "qloo-popularity") lines.push("Busyness from Qloo's area popularity (estimate)");
  for (const event of pitch.evidence.events.slice(0, 1)) lines.push(`${event.name}: crowd ${event.moment === "leaving" ? "leaves" : "arrives"} around ${event.localTime}`);
  lines.push(`The council's busking layers don't rule it out${pitch.amplification === "unamplified-zone" ? " (unamplified only)" : ""}`);
  return lines;
}

const Section = ({ label, title, count, children }: { label: string; title: string; count: number; children: React.ReactNode }) => (
  <section aria-label={label} className="space-y-3">
    <h3 className="m-0 flex items-baseline gap-2 font-display text-[22px] leading-none font-extrabold uppercase">
      {title}
      <span className="font-mono text-sm font-normal text-muted-foreground">({count})</span>
    </h3>
    {children}
  </section>
);

/**
 * The plain-AI baseline beside Busk Map's picks, in three buckets: both agree, only Busk Map (with the evidence a plain AI
 * can't know), and only plain AI (with Busk Map's own score for the pitch where it can score it). Agreement is a badge only:
 * the baseline never changes a score.
 */
/** `model`: the model this server runs; offline the plain AI is the test model, not Claude Haiku (B-010). */
export function ComparePanel({ state, pitches, model = null }: { state: BaselineState; pitches: Pitch[]; model?: ExplanationsModel | null }) {
  const mock = state.status === "done" ? state.baseline.model === "mock" : model === "mock";
  return (
    <section aria-label="Busk Map vs a plain AI" data-testid="compare-panel" className="space-y-4 border-2 border-rule bg-card p-4 md:p-6">
      <header className="space-y-1">
        <h2 className="m-0 font-display text-[32px] leading-none font-extrabold uppercase">Busk Map vs a plain AI</h2>
        <p className="m-0 text-sm text-muted-foreground">
          The same question (your act, songs, city, day and slot) sent to {mock ? `${modelName("mock")} (offline)` : "Claude Haiku"} with no tools and no data: no Qloo, no sensors, no rules.
          It runs alongside every plan as a control and never changes a score.
        </p>
      </header>
      <div className="space-y-5" aria-live="polite">
        {state.status === "loading" && (
          <div className="space-y-2">
            <p className="m-0 text-muted-foreground">Asking a plain AI the same question…</p>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
        {state.status === "unavailable" && (
          <div className="space-y-2" data-testid="compare-unavailable">
            <DataStatusBadge status="unavailable" source="Plain AI" />
            <p className="m-0 text-muted-foreground">{state.message}</p>
          </div>
        )}
        {state.status === "done" && <Buckets baseline={state.baseline} pitches={pitches} />}
      </div>
    </section>
  );
}

function Buckets({ baseline, pitches }: { baseline: BaselineView; pitches: Pitch[] }) {
  const byId = new Map(pitches.map((p) => [p.id, p]));
  const agreed = baseline.bothAgree.flatMap((a) => {
    const pitch = byId.get(a.pitchId);
    return pitch ? [{ ...a, pitch }] : [];
  });
  const onlyOurs = baseline.onlyBuskMap.flatMap((id) => {
    const pitch = byId.get(id);
    return pitch ? [pitch] : [];
  });
  const onlyPlain = baseline.plain.filter((p) => p.status !== "ours");
  // Scored higher than a pick: either left out by the 250 m spacing (tooCloseTo), or a pitch the plan missed.
  const better = onlyPlain.filter((p) => p.beatsOurs && !p.tooCloseTo);
  const spaced = onlyPlain.filter((p) => p.beatsOurs && p.tooCloseTo);
  const usual = baseline.plain.filter((p) => p.usualSpot).length;
  return (
    <>
      <p className="m-0 font-bold" data-testid="compare-verdict">
        {onlyOurs.length} of Busk Map&apos;s {pitches.length} picks {onlyOurs.length === 1 ? "is" : "are"} one the plain AI didn&apos;t name
        {agreed.length > 0 ? `; ${agreed.length} ${agreed.length === 1 ? "is" : "are"} in both answers` : ""}.
        {usual > 0 ? ` The plain AI named ${usual} of Melbourne's usual busking pitches, where other buskers already are.` : ""}
        {better.length > 0 ? ` Busk Map itself scores ${better.map((p) => p.name).join(" and ")} higher than one of its own picks: worth a look.` : ""}
        {spaced.length > 0
          ? ` Busk Map scores ${spaced.map((p) => `${p.name} (within 250 m of ${p.tooCloseTo})`).join(" and ")} higher than one of its picks, but the top 3 are kept 250 m apart, so the plan picked a pitch further away.`
          : ""}
      </p>

      {agreed.length > 0 && (
        <Section label="Both agree" title="Both agree" count={agreed.length}>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {agreed.map((a) => (
              <li key={a.pitchId} className="flex flex-wrap items-center gap-3">
                <ScoreCell value={a.pitch.score} size="sm" label="Score" />
                <b>{a.pitch.name}</b>
                <BothAgreeBadge />
                <span className="text-sm text-muted-foreground">the plain AI named &ldquo;{a.plainName}&rdquo;</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section label="Only Busk Map" title="Only Busk Map" count={onlyOurs.length}>
        {onlyOurs.length === 0 ? (
          <p className="m-0 text-muted-foreground">The plain AI named every one of Busk Map&apos;s picks.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {onlyOurs.map((pitch) => (
              <li key={pitch.id} className="space-y-2">
                <span className="flex flex-wrap items-center gap-3">
                  <ScoreCell value={pitch.score} size="sm" label="Score" />
                  <b>{pitch.name}</b>
                  {pitch.discovery === "hidden-gem" && <DiscoveryBadge discovery="hidden-gem" />}
                </span>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-muted-foreground">
                  {evidenceLines(pitch).map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 bg-primary [clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]" />
                      {line}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label="Only plain AI" title="Only plain AI (unverified, no data)" count={onlyPlain.length}>
        {onlyPlain.length === 0 ? (
          <p className="m-0 text-muted-foreground">Every place the plain AI named is one of Busk Map&apos;s picks.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {onlyPlain.map((spot, i) => (
              <li key={`${spot.name}-${i}`} className="space-y-1">
                <span className="flex flex-wrap items-center gap-3">
                  {spot.status === "scored" && <ScoreCell value={spot.score} size="sm" label="Busk Map's score" />}
                  <b>{spot.name}</b>
                  <Badge variant={STATUS_VARIANT[spot.status]}>{STATUS_LABEL[spot.status]}</Badge>
                  {spot.usualSpot && <DiscoveryBadge discovery="usual" />}
                  {spot.beatsOurs && !spot.tooCloseTo && <Badge variant="solid">Beats one of ours</Badge>}
                  {spot.tooCloseTo && <Badge variant="neutral">Too close to {spot.tooCloseTo}</Badge>}
                </span>
                <span className="block text-sm text-muted-foreground">{spot.why}</span>
                <span className="block text-sm text-muted-foreground">
                  {spot.status === "scored"
                    ? `Busk Map's score here${spot.pitchName && spot.pitchName !== spot.name ? ` (as ${spot.pitchName})` : ""}${
                        spot.tooCloseTo
                          ? `. Scored higher, but within 250 m of ${spot.tooCloseTo}, so the plan picked a pitch further away`
                          : spot.beatsOurs
                            ? ", higher than one of Busk Map's picks"
                            : ""
                      }.`
                    : spot.status === "not-legal"
                      ? "The council's busking layers rule this spot out."
                      : "Busk Map couldn't place this spot, so it has no data to check it."}
                </span>
              </li>
            ))}
          </ul>
        )}
        {baseline.setlist.length > 0 && (
          <div className="grid gap-1" data-testid="baseline-set">
            <p className="m-0 text-sm leading-5 text-muted-foreground">Plain AI {PLAYLIST_COPY.suggestedSetNoun}:</p>
            <ol className="m-0 list-none p-0">
              {baseline.setlist.map((title, i) => (
                <SongRow key={`${title}${i}`} compact interactive={false} index={i + 1} title={title} artist="" className="border-t border-border first:border-t-0" />
              ))}
            </ol>
          </div>
        )}
      </Section>
    </>
  );
}
