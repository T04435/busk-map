"use client";

import { useId, useRef, type KeyboardEvent } from "react";
import { cn } from "cn";
import { formatHour } from "@/lib/slot";
import { NAMED_SLOTS, type NamedSlot, type TimeChoice } from "@/lib/time-slots";

/** The four slots, as the DS draws them (from lib/time-slots.ts): Morning 9 am–12 pm, Lunch 12–3 pm, Afternoon 3–6 pm, Evening 6–9 pm. */
export const QUICK_SLOTS = NAMED_SLOTS.map((s) => ({ id: s.id, label: s.label, from: s.startHour, to: s.endHour }));

export type QuickSlotId = NamedSlot["id"];
/** "any" is Any time · Busk Map picks; "custom" is the hours of an old link; otherwise a quick slot's id. */
export type TimeSlotId = "any" | "custom" | QuickSlotId;

export const ANY_TIME_HINT =
  "Busk Map finds the best hours that day: when your crowd is out, estimated activity peaks and events let out. Each pitch gets its own time.";

/** "9 am–12 pm", "12–3 pm" as the DS prints a slot's range (the first suffix goes when both ends share it). */
export const slotRange = (from: number, to: number) => {
  const a = formatHour(from),
    b = formatHour(to);
  const sa = a.split(" ")[1],
    sb = b.split(" ")[1];
  return sa && sa === sb ? `${a.split(" ")[0]}–${b}` : `${a}–${b}`;
};

/** The picker's id for a form choice. */
export const slotIdOf = (choice: TimeChoice): TimeSlotId => (choice.kind === "any" ? "any" : choice.kind === "named" ? choice.id : "custom");

/** The form choice for a picker id (`custom` needs the link's hours). */
export function choiceOf(id: TimeSlotId, custom?: { startHour: number; endHour: number } | null): TimeChoice | null {
  if (id === "any") return { kind: "any" };
  if (id === "custom") return custom ? { kind: "custom", ...custom } : null;
  return { kind: "named", id };
}

const SLOT =
  "min-h-14 cursor-pointer rounded-none border-2 border-border bg-card px-3 py-2 text-left text-foreground transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:shadow-none aria-checked:border-rule aria-checked:bg-primary aria-checked:text-primary-foreground motion-reduce:transition-none";

/**
 * DS TimeSlotPicker: one choice at a time, with radio semantics (a radiogroup, arrow keys move and pick, one tab stop).
 * With `anyTime`: the label "Time (optional)", Any time first (dashed, "Busk Map picks") and its hint when it is checked.
 * Without it: the label "Time" and the four slots only. `custom` is the hours of an old link that match no named slot:
 * shown as a "From your link" choice so they are not lost. An empty value checks nothing.
 * The date is NOT in here: the form asks it once, above, as the DS DatePicker.
 */
export function TimeSlotPicker({
  value,
  onChange,
  anyTime = false,
  custom = null,
  label = anyTime ? "Time (optional)" : "Time",
  anyHint = ANY_TIME_HINT,
  describedBy,
}: {
  value: TimeSlotId | "";
  onChange: (id: TimeSlotId) => void;
  /** Offer "Any time · Busk Map picks" first. */
  anyTime?: boolean;
  custom?: { startHour: number; endHour: number } | null;
  label?: string;
  anyHint?: string;
  describedBy?: string;
}) {
  const labelId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const quick = QUICK_SLOTS.map((s) => ({ id: s.id as TimeSlotId, label: s.label, range: slotRange(s.from, s.to) }));
  const options = [
    ...(anyTime ? [{ id: "any" as TimeSlotId, label: "Any time", range: "Busk Map picks" }] : []),
    ...quick,
    ...(custom ? [{ id: "custom" as TimeSlotId, label: slotRange(custom.startHour, custom.endHour), range: "From your link" }] : []),
  ];
  const checkedIndex = options.findIndex((o) => o.id === value);
  const tabIndexOf = (i: number) => (i === (checkedIndex >= 0 ? checkedIndex : 0) ? 0 : -1);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (i + step + options.length) % options.length;
    refs.current[next]?.focus();
    onChange(options[next].id);
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-slot="time-slot-picker" data-testid="time-slot-picker">
      <span id={labelId} className="text-[15px] leading-5 font-bold text-foreground">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} aria-describedby={describedBy} className="grid grid-cols-[repeat(auto-fit,minmax(96px,1fr))] gap-1.5">
        {options.map((o, i) => (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            tabIndex={tabIndexOf(i)}
            data-testid={o.id === "any" ? "time-any" : o.id === "custom" ? "time-custom" : undefined}
            onClick={() => onChange(o.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(SLOT, (o.id === "any" || o.id === "custom") && "border-dashed")}
          >
            <b className="block font-display text-lg leading-5 font-extrabold tracking-[0.02em] uppercase">{o.label}</b>
            <span className={cn("block font-mono text-[13px] leading-[18px]", value === o.id ? "text-primary-foreground" : "text-muted-foreground")}>{o.range}</span>
          </button>
        ))}
      </div>
      {anyTime && value === "any" ? (
        <p className="m-0 text-sm leading-5 text-muted-foreground" data-testid="any-time-note">
          {anyHint}
        </p>
      ) : null}
    </div>
  );
}
