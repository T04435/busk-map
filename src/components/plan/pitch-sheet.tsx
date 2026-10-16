"use client";

import { PitchCard } from "@/components/pitch-card/pitch-card";
import { SetlistPanel } from "@/components/setlist/setlist-panel";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Plan, PlanPitch } from "@/lib/plan-schema";
import type { ExplanationsModel } from "@/lib/sources";
import { CrowdPanel } from "./crowd-panel";
import { WeightsPanel } from "./weights-panel";

/**
 * "Full details" for one pitch, in a right-hand sheet (full screen on phones): the pitch card, the suggested set, the crowd and
 * the weights. Radix traps focus inside, closes on Escape and returns focus to what opened it. The page keeps `?pitch=<id>` in
 * the URL while it is open (the deep link) and clears it on close.
 */
export function PitchSheet({
  plan,
  pitch,
  model,
  when,
  onClose,
  returnFocus,
}: {
  plan: Plan;
  pitch: PlanPitch | null;
  model: ExplanationsModel | null;
  when: string;
  onClose: () => void;
  /** What had focus when the sheet opened (the Full details button): it gets focus back on close. */
  returnFocus?: () => void;
}) {
  const rank = pitch ? plan.pitches.indexOf(pitch) + 1 : 0;
  return (
    <Sheet open={pitch !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 bg-background p-0 sm:max-w-3xl" data-testid="pitch-sheet"
        onCloseAutoFocus={(e) => {
          if (!returnFocus) return;
          e.preventDefault();
          returnFocus();
        }}
      >
        {pitch ? (
          <>
            <SheetHeader className="border-b-2 border-rule bg-popover p-4 pr-16 md:p-6 md:pr-16">
              <SheetTitle className="font-display text-[34px] leading-[0.95] font-extrabold uppercase">{pitch.name}</SheetTitle>
              <SheetDescription className="font-mono text-xs font-bold tracking-[0.06em] uppercase">
                Pitch {rank} · {when}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 p-4 md:p-6">
              <PitchCard pitch={pitch} rank={rank} model={model} weights={plan.weights} />
              <SetlistPanel pitch={pitch} learnThese={plan.learnThese} ageLean={plan.ageLean} />
              <CrowdPanel crowd={plan.crowd} resolved={plan.resolvedArtists} topPitch={plan.pitches[0]?.name ?? null} />
              <WeightsPanel weights={plan.weights} />
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
