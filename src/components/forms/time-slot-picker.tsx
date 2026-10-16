"use client";

import { useId } from "react";
import { formatHour } from "@/lib/slot";
import { cn } from "cn";

/** The four slots, as the DS draws them: Morning 9 am–12 pm, Lunch 12–3 pm, Afternoon 3–6 pm, Evening 6–9 pm. */
export const QUICK_SLOTS = [
  { id: "morning", label: "Morning", from: 9, to: 12 },
  { id: "lunch", label: "Lunch", from: 12, to: 15 },
  { id: "afternoon", label: "Afternoon", from: 15, to: 18 },
  { id: "evening", label: "Evening", from: 18, to: 21 },
] as const;

export type QuickSlotId = (typeof QUICK_SLOTS)[number]["id"];
/** "any" is Any time · Busk Map picks; otherwise a quick slot's id. */
export type TimeSlotId = "any" | QuickSlotId;

/** "9 am–12 pm", "12–3 pm" as the DS prints a slot's range. */
const range = (from: number, to: number) => {
  const a = formatHour(from), b = formatHour(to);
  // "12–3 pm", not "12 pm–3 pm": the first suffix goes when both ends share it (as the DS prints a slot).
  const sa = a.split(" ")[1], sb = b.split(" ")[1];
  return sa && sa === sb ? `${a.split(" ")[0]}–${b}` : `${a}–${b}`;
};

const SLOT =
  "min-h-14 cursor-pointer rounded-none border-2 border-border bg-card px-3 py-2 text-left text-foreground transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:shadow-none aria-pressed:border-rule aria-pressed:bg-primary aria-pressed:text-primary-foreground motion-reduce:transition-none";

/**
 * DS TimeSlotPicker. With `anyTime`: the label "Time (optional)", Any time first (dashed, "Busk Map picks") and its hint
 * when pressed. Without it: the label "Time" and the four slots only. The slots are pressed-state buttons (Big Shoulders
 * label, mono range, the pressed one orange). An empty value presses nothing (a custom range from a stored plan).
 * The date is NOT in here: the form asks it once, above, as the DS DatePicker.
 */
export function TimeSlotPicker({
  value,
  onChange,
  anyTime = false,
  label = anyTime ? "Time (optional)" : "Time",
  anyHint = "Busk Map finds the best hours that day: when your crowd is out, foot traffic peaks and events let out. Each pitch gets its own time.",
  describedBy,
}: {
  value: TimeSlotId | "";
  onChange: (id: TimeSlotId) => void;
  /** Offer "Any time · Busk Map picks" first (needs the plan's any-time slot; off until dev/core is merged). */
  anyTime?: boolean;
  label?: string;
  anyHint?: string;
  describedBy?: string;
}) {
  const labelId = useId();
  const quick = QUICK_SLOTS.map((s) => ({ id: s.id as TimeSlotId, label: s.label, range: range(s.from, s.to) }));
  const options = anyTime ? [{ id: "any" as TimeSlotId, label: "Any time", range: "Busk Map picks" }, ...quick] : quick;
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-slot="time-slot-picker">
      <span id={labelId} className="text-[15px] leading-5 font-bold text-foreground">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} aria-describedby={describedBy} className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-1.5">
        {options.map((o) => (
          <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)} className={cn(SLOT, o.id === "any" && "border-dashed")}>
            <b className="block font-display text-lg leading-5 font-extrabold tracking-[0.02em] uppercase">{o.label}</b>
            <span className={cn("block font-mono text-[13px] leading-[18px]", value === o.id ? "text-primary-foreground" : "text-muted-foreground")}>{o.range}</span>
          </button>
        ))}
      </div>
      {anyTime && value === "any" ? <p className="m-0 text-sm leading-5 text-muted-foreground">{anyHint}</p> : null}
    </div>
  );
}
