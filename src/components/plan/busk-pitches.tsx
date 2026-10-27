"use client";

import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { PitchRow } from "@/components/honeycomb/pitch-row";
import type { Plan, PlanPitch } from "@/lib/plan-schema";
import { RULES_NOT_CHECKED } from "@/lib/signal-level";

/**
 * A busk's top pitches: each pitch's row (rank, name, best hours, score, badges), the others-scored note and the rules line.
 * The busk plan shows it beside its map; a week shows each day's.
 */
export function BuskPitches({
  plan,
  selectedId,
  onSelect,
  onDetails,
  badges,
  rulesChecked,
  className,
}: {
  plan: Pick<Plan, "pitches" | "others">;
  selectedId: string | null;
  onSelect: (pitchId: string) => void;
  /** The pitch's "Full details" (the busk plan's sheet); none where the details are already on the page. */
  onDetails?: (pitchId: string) => void;
  badges: (pitch: PlanPitch) => ReactNode;
  rulesChecked: boolean;
  className?: string;
}) {
  return (
    <section aria-label="Pitches" className={className}>
      <h3 className="sr-only">Top pitches</h3>
      <ol className="m-0 flex list-none flex-col gap-3 p-0">
        {plan.pitches.map((pitch, i) => (
          <PitchRow
            key={pitch.id}
            pitchId={pitch.id}
            rank={i + 1}
            name={pitch.name}
            window={pitch.window ? `Best ${pitch.window.label}` : undefined}
            score={pitch.score}
            selected={pitch.id === selectedId}
            onSelect={() => onSelect(pitch.id)}
            onDetails={onDetails ? () => onDetails(pitch.id) : undefined}
            badges={badges(pitch)}
          />
        ))}
      </ol>
      {plan.others.length > 0 && (
        <p className="m-0 flex items-start gap-2 text-sm text-muted-foreground" data-testid="others-note">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {plan.others.length} more pitches scored. The top 3 are kept 250 m apart.
          </span>
        </p>
      )}
      <p className="m-0 text-sm font-bold" data-testid="rules-line">
        {rulesChecked ? "Busk Map never confirms a pitch is legal. Check your permit conditions on the day." : RULES_NOT_CHECKED}
      </p>
    </section>
  );
}
