"use client";

import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { hoursLabel, NAMED_SLOTS, type TimeChoice } from "@/lib/time-slots";

export const ANY_TIME_HINT =
  "Busk Map finds the best hours that day: when your crowd is out, foot traffic peaks and events let out. Each pitch gets its own time.";

const valueOf = (choice: TimeChoice) => (choice.kind === "any" ? "any" : choice.kind === "named" ? choice.id : "custom");

/**
 * "Time (optional)": Any time (Busk Map picks) is pressed by default, then Morning, Lunch, Afternoon and Evening; one at a time.
 * `custom` is the hours of an old link that match no named slot: shown as a "From–To" choice so they are not lost.
 */
export function TimeSlotPicker({ value, onChange, custom }: { value: TimeChoice; onChange: (choice: TimeChoice) => void; custom?: { startHour: number; endHour: number } | null }) {
  function pick(next: string) {
    if (!next) return; // pressing the pressed choice again keeps it: there is always one
    if (next === "any") onChange({ kind: "any" });
    else if (next === "custom" && custom) onChange({ kind: "custom", ...custom });
    else onChange({ kind: "named", id: next as (typeof NAMED_SLOTS)[number]["id"] });
  }
  return (
    <div className="space-y-2" data-testid="time-slot-picker">
      <Label id="time-label">Time (optional)</Label>
      <ToggleGroup type="single" value={valueOf(value)} onValueChange={pick} aria-labelledby="time-label" className="flex-wrap">
        <ToggleGroupItem value="any" data-testid="time-any">
          <b className="font-medium">Any time</b>
          <span className="text-xs opacity-80">Busk Map picks</span>
        </ToggleGroupItem>
        {NAMED_SLOTS.map((slot) => (
          <ToggleGroupItem key={slot.id} value={slot.id}>
            <b className="font-medium">{slot.label}</b>
            <span className="text-xs opacity-80">{hoursLabel(slot.startHour, slot.endHour)}</span>
          </ToggleGroupItem>
        ))}
        {custom && (
          <ToggleGroupItem value="custom" data-testid="time-custom">
            <b className="font-medium">{hoursLabel(custom.startHour, custom.endHour)}</b>
            <span className="text-xs opacity-80">From your link</span>
          </ToggleGroupItem>
        )}
      </ToggleGroup>
      {value.kind === "any" && (
        <p className="text-sm text-muted-foreground" data-testid="any-time-note">
          {ANY_TIME_HINT}
        </p>
      )}
    </div>
  );
}
