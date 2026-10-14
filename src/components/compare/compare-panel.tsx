"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PlanPitch, PlanRequest } from "@/lib/plan-schema";

type PlainSpot = { name: string; why: string; usualSpot: string | null };
type Answer = { text: string; spots: PlainSpot[]; setlist: string[] };
type State = { status: "idle" | "loading" } | ({ status: "done" } & Answer) | { status: "error"; message: string };

type Props = {
  request: Pick<PlanRequest, "city" | "slot" | "performer">;
  pitches: Pick<PlanPitch, "id" | "name" | "score" | "discovery" | "usualSpot" | "factors" | "footfallSource">[];
};

const pct = (n: number | null) => (n === null ? "n/a" : String(Math.round(n * 100)));

/**
 * "What a plain LLM would suggest": one model call, no tools, no data, set
 * beside Busk Map's data-led pitches. Clearly labelled.
 */
export function ComparePanel({ request, pitches }: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });

  async function load() {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const body = await response.json();
      if (!response.ok || !body.text) {
        setState({ status: "error", message: body?.error?.message ?? "The plain-LLM comparison is unavailable right now." });
        return;
      }
      setState({ status: "done", text: body.text, spots: body.spots ?? [], setlist: body.setlist ?? [] });
    } catch {
      setState({ status: "error", message: "The plain-LLM comparison is unavailable right now." });
    }
  }

  const usual = state.status === "done" ? state.spots.filter((s) => s.usualSpot).length : 0;
  const gems = pitches.filter((p) => p.discovery === "hidden-gem").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Switch
            id="compare"
            checked={open}
            onCheckedChange={(checked) => {
              setOpen(checked);
              if (checked && state.status === "idle") void load();
            }}
          />
          <Label htmlFor="compare">What a plain LLM would suggest</Label>
        </div>
        <CardDescription>
          The same question sent to Claude Haiku with no tools and no data: no Qloo, no sensors, no rules. Shown next to Busk Map&apos;s
          pitches for comparison only.
        </CardDescription>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 text-sm" aria-live="polite">
          {state.status === "loading" && <p className="text-muted-foreground">Asking a plain LLM…</p>}
          {state.status === "error" && <p className="text-muted-foreground">{state.message}</p>}
          {state.status === "done" && (
            <>
              <p className="font-medium" data-testid="compare-verdict">
                {usual > 0
                  ? `The plain LLM sends you to ${usual === state.spots.length ? "all" : `${usual} of ${state.spots.length}`} of Melbourne's usual busking spots, where every other busker already is. `
                  : "The plain LLM's spots come with no data behind them. "}
                {gems > 0 ? `Busk Map found ${gems} hidden gem${gems > 1 ? "s" : ""} where your crowd is, with the numbers to check.` : "Busk Map's picks come with the numbers to check."}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <section aria-label="Plain LLM answer" className="space-y-2">
                  <h3 className="font-medium">Plain LLM answer (unverified, no data)</h3>
                  <ol className="space-y-2">
                    {state.spots.map((spot, i) => (
                      <li key={`${spot.name}-${i}`}>
                        <span className="flex flex-wrap items-center gap-2">
                          <span>
                            {i + 1}. {spot.name}
                          </span>
                          {spot.usualSpot && <Badge variant="outline">Usual spot</Badge>}
                        </span>
                        <span className="block text-muted-foreground">{spot.why}</span>
                      </li>
                    ))}
                  </ol>
                  {state.setlist.length > 0 && <p className="text-muted-foreground">Setlist: {state.setlist.join(", ")}</p>}
                  <p className="text-xs text-muted-foreground">No sources, no foot traffic, no busking rules checked.</p>
                </section>
                <section aria-label="Busk Map answer" className="space-y-2">
                  <h3 className="font-medium">Busk Map (from the data)</h3>
                  <ol className="space-y-2">
                    {pitches.map((pitch, i) => (
                      <li key={pitch.id}>
                        <span className="flex flex-wrap items-center gap-2">
                          <span>
                            {i + 1}. {pitch.name}
                          </span>
                          {pitch.discovery === "hidden-gem" && <Badge>Hidden gem</Badge>}
                          {pitch.discovery === "usual" && <Badge variant="outline">Usual spot</Badge>}
                        </span>
                        <span className="block text-muted-foreground">
                          Score {pitch.score}/100 · Qloo taste {pct(pitch.factors.taste)} · foot traffic {pct(pitch.factors.footfall)}
                          {pitch.footfallSource && pitch.footfallSource !== "sensor" ? " (estimate)" : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <p className="text-xs text-muted-foreground">Setlists are ordered per pitch from your own songs; see the setlist panel.</p>
                </section>
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
