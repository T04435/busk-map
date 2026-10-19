/**
 * The busk form's one time control (plan-inputs-architecture.md S5; BRAND inventory busks B30): "Any time" (Busk Map picks each
 * pitch's hours) or one named slot with fixed hours. Hours are the local 24-hour clock; `endHour` is exclusive.
 */
import { formatHour } from "./slot";

export type NamedSlot = { id: "morning" | "lunch" | "afternoon" | "evening"; label: string; startHour: number; endHour: number };

/** Morning 9 am-12 pm, Lunch 12-3 pm, Afternoon 3-6 pm, Evening 6-9 pm (the DS TimeSlotPicker's names; "Lunch", not "Midday"). */
export const NAMED_SLOTS: readonly NamedSlot[] = [
  { id: "morning", label: "Morning", startHour: 9, endHour: 12 },
  { id: "lunch", label: "Lunch", startHour: 12, endHour: 15 },
  { id: "afternoon", label: "Afternoon", startHour: 15, endHour: 18 },
  { id: "evening", label: "Evening", startHour: 18, endHour: 21 },
];

/** The form's choice: "any", a named slot's id, or "custom" (hours from an old link that match no named slot). */
export type TimeChoice = { kind: "any" } | { kind: "named"; id: NamedSlot["id"] } | { kind: "custom"; startHour: number; endHour: number };

/** "9 am–12 pm", the way the picker and plan headers write a range. */
export const hoursLabel = (startHour: number, endHour: number) => `${formatHour(startHour)}–${formatHour(endHour)}`;

/** An old from/to pair: the named slot with exactly those hours, otherwise a custom choice that keeps them. */
export function choiceForHours(startHour: number, endHour: number): TimeChoice {
  const named = NAMED_SLOTS.find((s) => s.startHour === startHour && s.endHour === endHour);
  return named ? { kind: "named", id: named.id } : { kind: "custom", startHour, endHour };
}

/** The hours a choice sends, or null for any time. */
export function hoursOf(choice: TimeChoice): { startHour: number; endHour: number } | null {
  if (choice.kind === "any") return null;
  if (choice.kind === "custom") return { startHour: choice.startHour, endHour: choice.endHour };
  const slot = NAMED_SLOTS.find((s) => s.id === choice.id)!;
  return { startHour: slot.startHour, endHour: slot.endHour };
}
