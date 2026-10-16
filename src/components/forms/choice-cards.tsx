"use client";

import { useId, type ReactNode } from "react";
import { cn } from "cn";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * A group of choice cards: one pick from a few, each a ruled card with a honeycomb radio, a title, a description and an
 * optional badge. Built on shadcn's RadioGroup, so Tab enters the group, the arrow keys move and pick, and a screen
 * reader hears "General permit, radio button, 1 of 3" with the description. The picked card gains a ruled frame and an
 * orange offset, and its radio fills (state is shape and fill, never colour alone).
 */
export function ChoiceGroup({
  legend,
  value,
  onValueChange,
  invalid,
  describedBy,
  note,
  className,
  children,
}: {
  legend: ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  invalid?: boolean;
  /** The id of an error or note that applies to the whole group. */
  describedBy?: string;
  /** A hint under the cards. */
  note?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const noteId = useId();
  return (
    <fieldset className={cn("m-0 min-w-0 border-0 p-0", className)} data-slot="choice-group">
      <legend className="mb-2 p-0 text-[15px] leading-5 font-bold text-foreground">{legend}</legend>
      <RadioGroup value={value} onValueChange={onValueChange} aria-invalid={invalid || undefined} aria-describedby={[describedBy, note ? noteId : null].filter(Boolean).join(" ") || undefined}>
        {children}
      </RadioGroup>
      {note ? (
        <p id={noteId} className="mt-3 mb-0 text-sm leading-5 text-muted-foreground">
          {note}
        </p>
      ) : null}
    </fieldset>
  );
}

export function ChoiceCard({ value, title, description, end, className }: { value: string; title: ReactNode; description?: ReactNode; end?: ReactNode; className?: string }) {
  const id = useId();
  const titleId = `${id}-t`;
  const descId = `${id}-d`;
  return (
    <label
      htmlFor={id}
      data-slot="choice-card"
      className={cn(
        "relative grid min-h-16 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 border-2 border-border bg-card px-4 py-3 transition-[border-color] duration-(--duration-fast) hover:border-input has-[[data-state=checked]]:border-foreground has-[[data-state=checked]]:shadow-[4px_4px_0_var(--primary)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-75 focus-within:outline-3 focus-within:outline-offset-4 focus-within:outline-solid focus-within:outline-ring motion-reduce:transition-none",
        className
      )}
    >
      <RadioGroupItem id={id} value={value} aria-labelledby={titleId} aria-describedby={description ? descId : undefined} />
      <span className="min-w-0">
        <span id={titleId} className="block text-base leading-[22px] font-bold">
          {title}
        </span>
        {description ? (
          <span id={descId} className="block text-sm leading-5 text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      {end ?? <span />}
    </label>
  );
}
