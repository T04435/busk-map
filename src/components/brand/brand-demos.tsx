"use client";

import { useState } from "react";
import { Footprints } from "lucide-react";
import { ChoiceCard, ChoiceGroup } from "@/components/forms/choice-cards";
import { PERMIT_CHOICES } from "@/components/forms/permit-picker";
import { QUICK_SLOTS } from "@/components/forms/time-slot-picker";
import { Chip } from "@/components/honeycomb/chip";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatHour } from "@/lib/slot";

/** The pickable parts of the showcase: choice cards, quick slots and chips, with real state so they can be tried. */
export function BrandChoiceDemo() {
  const [permit, setPermit] = useState("general");
  return (
    <ChoiceGroup legend="Your busking permit (choice cards)" value={permit} onValueChange={setPermit} note="Arrow keys move and pick. The picked card gains a ruled frame and an orange offset.">
      {PERMIT_CHOICES.map((p, i) => (
        <ChoiceCard
          key={p.id}
          value={p.id}
          title={p.title}
          description={p.desc}
          end={
            i === 0 ? (
              <Badge variant="gem">
                <Footprints aria-hidden="true" />
                Live data
              </Badge>
            ) : undefined
          }
        />
      ))}
    </ChoiceGroup>
  );
}

export function BrandSlotDemo() {
  const [slot, setSlot] = useState("evening");
  const [chips, setChips] = useState<string[]>(["Folk"]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span id="brand-slot-label" className="text-label font-bold">
          Time of day (toggle group)
        </span>
        <ToggleGroup type="single" value={slot} onValueChange={(v) => v && setSlot(v)} aria-labelledby="brand-slot-label" className="grid w-full grid-cols-2 gap-2">
          {QUICK_SLOTS.map((s) => (
            <ToggleGroupItem key={s.id} value={s.id} className="h-auto min-h-14 w-full flex-col items-start gap-0 px-3 py-2 text-left font-display text-lg leading-[1.1] tracking-[0.02em]">
              {s.label}
              <span className="font-mono text-[13px] leading-[18px] font-medium tracking-normal normal-case">
                {formatHour(s.from)}–{formatHour(s.to)}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex flex-col gap-1.5">
        <span id="brand-chip-label" className="text-label font-bold">
          Chips (toggles)
        </span>
        <div role="group" aria-labelledby="brand-chip-label" className="flex flex-wrap gap-2">
          {["Folk", "Americana", "Soul"].map((c) => (
            <Chip key={c} selected={chips.includes(c)} onClick={() => setChips((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))}>
              {c}
            </Chip>
          ))}
          <Chip>Plain chip</Chip>
        </div>
      </div>
    </div>
  );
}
