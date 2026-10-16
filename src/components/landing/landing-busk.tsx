"use client";

import { useState } from "react";
import { BothAgreeBadge } from "@/components/honeycomb/both-agree-badge";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { PitchRow } from "@/components/honeycomb/pitch-row";
import { LazyPlanMap } from "@/components/map/lazy-plan-map";
import { EXAMPLE_CENTER, EXAMPLE_OTHERS, EXAMPLE_PITCHES, EXAMPLE_TASTE_CELLS } from "@/lib/landing-example-busk";

const SUMMARY =
  "Southbank Promenade has the closest crowd to your folk sound on Qloo, about 1,900 people an hour in your slot, and a matinee letting out at 2:45 pm. Hardware Lane is the quieter hidden gem; Degraves Street is busier but shared.";

const PLAN = { tasteCells: EXAMPLE_TASTE_CELLS, pitches: EXAMPLE_PITCHES, others: EXAMPLE_OTHERS };

/**
 * "Your busk" as the deck draws it: the summary and the three ranked pitches beside the real PlanMap, all example data. Picking a
 * pitch (in the list or on the map) selects it in both, exactly as on a plan.
 */
export function LandingBusk() {
  const [selectedId, setSelectedId] = useState(EXAMPLE_PITCHES[0].id);
  return (
    <div className="grid items-stretch border-2 border-rule bg-card lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-4 p-4 md:p-6 lg:border-r-2 lg:border-rule">
        <div>
          <h3 className="m-0 font-display text-[clamp(36px,4vw,56px)] leading-[0.92] font-extrabold uppercase">Your busk</h3>
          <p className="m-0 font-mono text-xs leading-4 font-medium text-muted-foreground">Sunday · 12–3 pm · General permit</p>
        </div>
        <p className="m-0 text-base leading-6">{SUMMARY}</p>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {EXAMPLE_PITCHES.map((pitch, i) => (
            <PitchRow
              key={pitch.id}
              pitchId={pitch.id}
              rank={i + 1}
              name={pitch.name}
              when={pitch.when}
              score={pitch.score}
              selected={pitch.id === selectedId}
              onSelect={() => setSelectedId(pitch.id)}
              badges={
                <>
                  <DiscoveryBadge discovery={pitch.discovery} />
                  {pitch.id === "ex-degraves" ? <BothAgreeBadge /> : null}
                </>
              }
            />
          ))}
        </ol>
      </div>
      <div className="min-w-0 p-3 md:p-4">
        <LazyPlanMap plan={PLAN} center={EXAMPLE_CENTER} selectedId={selectedId} onSelect={setSelectedId} testData />
      </div>
    </div>
  );
}
