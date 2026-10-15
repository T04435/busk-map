"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { baselineViewSchema, type BaselineView, type PlanPitch, type PlanRequest } from "@/lib/plan-schema";

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

const pct = (n: number | null) => (n === null ? "n/a" : `${Math.round(n * 100)}/100`);

const STATUS_LABEL: Record<BaselineView["plain"][number]["status"], string> = {
  ours: "Both agree",
  scored: "Scored by Busk Map",
  "not-legal": "Not a legal pitch",
  "no-data": "No data for this spot",
};

type Pitch = Pick<PlanPitch, "id" | "name" | "score" | "discovery" | "factors" | "footfallSource" | "cellRank" | "evidence" | "amplification">;

/** What Busk Map knows about a pitch that a plain AI can't. */
function evidenceLines(pitch: Pitch): string[] {
  const lines: string[] = [];
  if (pitch.factors.taste !== null) lines.push(`Qloo taste ${pct(pitch.factors.taste)}${pitch.cellRank ? ` (your no. ${pitch.cellRank} area on Qloo's heatmap)` : ""}`);
  if (pitch.evidence.sensor) {
    lines.push(`${pitch.footfallSource === "sensor" ? "About" : "Roughly"} ${pitch.evidence.sensor.avgHourly.toLocaleString("en-AU")} people an hour (city sensors, estimate)`);
  } else if (pitch.footfallSource === "qloo-popularity") lines.push("Busyness from Qloo's area popularity (estimate)");
  for (const event of pitch.evidence.events.slice(0, 1)) lines.push(`${event.name}: crowd ${event.moment === "leaving" ? "leaves" : "arrives"} around ${event.localTime}`);
  lines.push(`The council's busking layers don't rule it out${pitch.amplification === "unamplified-zone" ? " (unamplified only)" : ""}`);
  return lines;
}

/**
 * The plain-AI baseline beside Busk Map's picks, in three buckets: both
 * agree, only Busk Map (with the evidence a plain AI can't know), and only
 * plain AI (with Busk Map's own score for the spot where it can score it).
 * Agreement is a badge only: the baseline never changes a score.
 */
export function ComparePanel({ state, pitches }: { state: BaselineState; pitches: Pitch[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Busk Map vs a plain AI</h2>
        </CardTitle>
        <CardDescription>
          The same question (your act, songs, city, day and slot) sent to Claude Haiku with no tools and no data: no Qloo, no sensors, no rules.
          It runs alongside every plan as a control and never changes a score.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5 text-sm" aria-live="polite">
        {state.status === "loading" && <p className="text-muted-foreground">Asking a plain AI the same question…</p>}
        {state.status === "unavailable" && <p className="text-muted-foreground">{state.message}</p>}
        {state.status === "done" && <Buckets baseline={state.baseline} pitches={pitches} />}
      </CardContent>
    </Card>
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
  const better = onlyPlain.filter((p) => p.beatsOurs);
  const usual = baseline.plain.filter((p) => p.usualSpot).length;
  return (
    <>
      <p className="font-medium" data-testid="compare-verdict">
        {onlyOurs.length} of Busk Map&apos;s {pitches.length} picks {onlyOurs.length === 1 ? "is" : "are"} one the plain AI didn&apos;t name
        {agreed.length > 0 ? `; ${agreed.length} ${agreed.length === 1 ? "is" : "are"} in both answers` : ""}.
        {usual > 0 ? ` The plain AI named ${usual} of Melbourne's usual busking spots, where other buskers already are.` : ""}
        {better.length > 0 ? ` Busk Map itself scores ${better.map((p) => p.name).join(" and ")} higher than one of its own picks: worth a look.` : ""}
      </p>

      {agreed.length > 0 && (
        <section aria-label="Both agree" className="space-y-2">
          <h3 className="font-medium">Both agree</h3>
          <ul className="space-y-1">
            {agreed.map((a) => (
              <li key={a.pitchId} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Both agree</Badge>
                <span>
                  {a.pitch.name} ({a.pitch.score}/100): the plain AI named &ldquo;{a.plainName}&rdquo;
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Only Busk Map" className="space-y-2">
        <h3 className="font-medium">Only Busk Map</h3>
        {onlyOurs.length === 0 ? (
          <p className="text-muted-foreground">The plain AI named every one of Busk Map&apos;s picks.</p>
        ) : (
          <ul className="space-y-3">
            {onlyOurs.map((pitch) => (
              <li key={pitch.id}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{pitch.name}</span>
                  <span className="text-muted-foreground">{pitch.score}/100</span>
                  {pitch.discovery === "hidden-gem" && <Badge>Hidden gem</Badge>}
                </span>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {evidenceLines(pitch).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Only plain AI" className="space-y-2">
        <h3 className="font-medium">Only plain AI (unverified, no data)</h3>
        {onlyPlain.length === 0 ? (
          <p className="text-muted-foreground">Every place the plain AI named is one of Busk Map&apos;s picks.</p>
        ) : (
          <ul className="space-y-2">
            {onlyPlain.map((spot, i) => (
              <li key={`${spot.name}-${i}`}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{spot.name}</span>
                  <Badge variant={spot.status === "scored" ? "secondary" : "outline"}>{STATUS_LABEL[spot.status]}</Badge>
                  {spot.usualSpot && <Badge variant="outline">Usual spot</Badge>}
                </span>
                <span className="block text-muted-foreground">{spot.why}</span>
                <span className="block text-muted-foreground">
                  {spot.status === "scored"
                    ? `Busk Map's score here: ${spot.score}/100${spot.pitchName && spot.pitchName !== spot.name ? ` (as ${spot.pitchName})` : ""}${spot.beatsOurs ? ", higher than one of Busk Map's picks" : ""}.`
                    : spot.status === "not-legal"
                      ? "The council's busking layers rule this spot out."
                      : "Busk Map couldn't place this spot, so it has no data to check it."}
                </span>
              </li>
            ))}
          </ul>
        )}
        {baseline.setlist.length > 0 && <p className="text-muted-foreground">Plain AI setlist: {baseline.setlist.join(", ")}</p>}
      </section>
    </>
  );
}
