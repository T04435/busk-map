"use client";

import { DatePicker } from "@/components/forms/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatHour } from "@/lib/slot";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** The quick picks: a whole slot in one tap. The selects below say the exact hours. */
export const QUICK_SLOTS = [
  { id: "morning", label: "Morning", from: 9, to: 12 },
  { id: "lunch", label: "Lunch", from: 12, to: 15 },
  { id: "afternoon", label: "Afternoon", from: 15, to: 18 },
  { id: "evening", label: "Evening", from: 18, to: 21 },
] as const;

export type TimeSlotValue = { date: string; from: string; to: string };

/**
 * The day and hours of the busk: a quick pick of four common slots, then the date and exact From and To. The quick
 * picks are a toggle group (one at a time) that sets From and To; the selects stay the source of truth, so a custom
 * range simply leaves every quick pick off. Select values are rendered as children so the server HTML shows them (B-006).
 */
export function TimeSlotPicker({
  value,
  onChange,
  today,
  invalid,
  describedBy,
}: {
  value: TimeSlotValue;
  onChange: (value: TimeSlotValue) => void;
  /** The city's local date: a plan is for today or later. */
  today: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const picked = QUICK_SLOTS.find((s) => String(s.from) === value.from && String(s.to) === value.to)?.id ?? "";
  return (
    <div className="flex flex-col gap-4" data-slot="time-slot-picker">
      <div className="flex flex-col gap-1.5">
        <span id="quick-slot-label" className="text-label font-bold">
          Time of day
        </span>
        <ToggleGroup
          type="single"
          value={picked}
          onValueChange={(id) => {
            const slot = QUICK_SLOTS.find((s) => s.id === id);
            if (slot) onChange({ ...value, from: String(slot.from), to: String(slot.to) });
          }}
          aria-labelledby="quick-slot-label"
          className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {QUICK_SLOTS.map((slot) => (
            <ToggleGroupItem key={slot.id} value={slot.id} className="h-auto min-h-14 w-full flex-col items-start gap-0 px-3 py-2 text-left font-display text-lg leading-[1.1] tracking-[0.02em]">
              {slot.label}
              <span className="font-mono text-[13px] leading-[18px] font-medium tracking-normal normal-case">
                {formatHour(slot.from)}–{formatHour(slot.to)}
              </span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-1">
          <Label htmlFor="date">Date</Label>
          <DatePicker id="date" value={value.date} onChange={(date) => onChange({ ...value, date })} min={today} aria-describedby={describedBy} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="from">From</Label>
          <Select value={value.from} onValueChange={(from) => onChange({ ...value, from })}>
            <SelectTrigger id="from" className="w-full" aria-invalid={invalid || undefined} aria-describedby={describedBy}>
              <SelectValue>{formatHour(Number(value.from))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {formatHour(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="to">To</Label>
          <Select value={value.to} onValueChange={(to) => onChange({ ...value, to })}>
            <SelectTrigger id="to" className="w-full" aria-invalid={invalid || undefined} aria-describedby={describedBy}>
              <SelectValue>{formatHour(Number(value.to))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((h) => (
                <SelectItem key={h + 1} value={String(h + 1)}>
                  {formatHour(h + 1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
