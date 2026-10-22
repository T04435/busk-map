"use client";

import { useRef, useSyncExternalStore } from "react";
import { Disclosure } from "@/components/honeycomb/disclosure";
import { ScoreBreakdown } from "@/components/pitch-card/pitch-card";
import { SetlistPanel } from "@/components/setlist/setlist-panel";
import { OsmCredit } from "@/components/honeycomb/osm-credit";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Plan, PlanPitch } from "@/lib/plan-schema";
import { shortDay, shortHours } from "@/lib/slot";
import type { ExplanationsModel } from "@/lib/sources";
import { CrowdPanel } from "./crowd-panel";
import { PitchDetails } from "./pitch-details";
import { WeightsPanel } from "./weights-panel";

/** Below 720px the sheet rises from the bottom with a grab handle; from 720px it comes in from the right, 720px wide (board B54). */
const PHONE = "(max-width: 719px)";
function usePhone(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(PHONE);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/**
 * "Full details" for one pitch, in a sheet: the pitch (head, why this crowd, estimated activity by hour, the facts), the setlist with
 * Copy, the crowd, and how the score adds up. Radix traps focus inside, closes on Escape and returns focus to what opened it.
 * The page keeps `?pitch=<id>` in the URL while it is open (the deep link) and clears it on close.
 */
export function PitchSheet({
  plan,
  pitch,
  model,
  onClose,
  returnFocus,
  canAddToRepertoire = false,
  repertoireTotal,
}: {
  plan: Plan;
  pitch: PlanPitch | null;
  model: ExplanationsModel | null;
  /** Kept for callers; the sheet reads the hours from the plan's slot. */
  when?: string;
  onClose: () => void;
  /** What had focus when the sheet opened (the Full details button): it gets focus back on close. */
  returnFocus?: () => void;
  /** Own acts (not the examples) can add a suggested song to their Repertoire. */
  canAddToRepertoire?: boolean;
  /** How many songs the request sent ("N of M songs you can sing"). */
  repertoireTotal?: number;
}) {
  const rank = pitch ? plan.pitches.indexOf(pitch) + 1 : 0;
  const phone = usePhone();
  const content = useRef<HTMLDivElement>(null);
  return (
    <Sheet open={pitch !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={phone ? "bottom" : "right"}
        className="max-h-dvh w-full gap-0 p-0 data-[side=bottom]:h-[92dvh] data-[side=right]:sm:max-w-[720px]"
        data-testid="pitch-sheet"
        ref={content}
        // Focus starts on the sheet itself, so no tooltip opens and the first Tab reaches the first control.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          content.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          if (!returnFocus) return;
          e.preventDefault();
          returnFocus();
        }}
      >
        {pitch ? (
          <>
            {phone ? <span aria-hidden="true" data-testid="sheet-handle" className="mx-auto mt-2 mb-0 block h-1.5 w-12 shrink-0 bg-input" /> : null}
            <SheetHeader className="gap-0.5 border-b-2 border-rule p-4 pr-16 md:p-6 md:pr-16">
              <SheetTitle className="font-display text-2xl leading-[26px] font-extrabold tracking-[0.01em] uppercase">{pitch.name}</SheetTitle>
              <SheetDescription className="text-sm leading-5">
                Pitch {rank} · {pitch.window ? `Best ${shortHours(pitch.window.startHour, pitch.window.endHour)}` : shortHours(plan.slot.startHour, plan.slot.endHour)}
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-5 p-4 md:p-6">
              {pitch.window && (
                <p className="m-0 text-sm leading-5 text-muted-foreground" data-testid="pitch-window">
                  {pitch.window.why}
                  {pitch.window.runnersUp.length > 0 && ` (next best: ${pitch.window.runnersUp.map((w) => shortHours(w.startHour, w.endHour)).join(", ")})`}.
                </p>
              )}
              <PitchDetails plan={plan} pitch={pitch} rank={rank} model={model} />
              <SetlistPanel
                pitch={pitch}
                when={`${shortDay(plan.slot.date)} ${pitch.window ? shortHours(pitch.window.startHour, pitch.window.endHour) : shortHours(plan.slot.startHour, plan.slot.endHour)}`}
                learnThese={plan.learnThese}
                canAddToRepertoire={canAddToRepertoire}
                repertoireTotal={repertoireTotal}
              />
              <CrowdPanel crowd={plan.crowd} resolved={plan.resolvedArtists} topPitch={plan.pitches[0]?.name ?? null} qlooMode={plan.qlooMode} ownArtist={plan.ownArtist} />
              <Disclosure label="How this score adds up" data-testid="score-details" className="[&_summary]:min-h-tap">
                <div className="space-y-5">
                  <ScoreBreakdown pitch={pitch} weights={plan.weights} />
                  <WeightsPanel weights={plan.weights} />
                </div>
              </Disclosure>
              {pitch.kind !== "designated" && <OsmCredit className="self-start" />}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
