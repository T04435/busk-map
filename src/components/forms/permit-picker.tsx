"use client";

import { ChoiceCard, ChoiceGroup } from "./choice-cards";

export const PERMIT_CHOICES = [
  { id: "general", title: "General permit", desc: "Pitches open to every permit. Keep the council's clearances from doors, crossings and seating." },
  { id: "premium", title: "Premium permit", desc: "Adds the premium-only pitches as well." },
  { id: "circle-act", title: "Circle act", desc: "For a crowd that forms a circle. You take priority at circle-act pitches." },
] as const;

export type PermitId = (typeof PERMIT_CHOICES)[number]["id"];

/** Which busking permit you hold. It changes which pitches are shown. */
export function PermitPicker({
  value,
  onValueChange,
  label = "Your busking permit",
  counts,
}: {
  value: string;
  onValueChange: (id: string) => void;
  label?: string;
  /** Pitches per permit id. When given, each card ends with "24 pitches" (DS); without it the cards are unchanged. */
  counts?: Record<string, number>;
}) {
  return (
    <ChoiceGroup legend={label} value={value} onValueChange={onValueChange} note="This changes which pitches are shown. Check the council's rules before you play.">
      {PERMIT_CHOICES.map((permit) => (
        <ChoiceCard key={permit.id} value={permit.id} title={permit.title} description={permit.desc}
          end={
            counts && typeof counts[permit.id] === "number" ? (
              <span className="font-mono text-sm leading-5 text-muted-foreground tabular-nums">
                {counts[permit.id]} {counts[permit.id] === 1 ? "pitch" : "pitches"}
              </span>
            ) : undefined
          }
        />
      ))}
    </ChoiceGroup>
  );
}
