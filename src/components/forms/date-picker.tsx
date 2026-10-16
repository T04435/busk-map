"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/honeycomb/icon";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatIsoDate, isoToLocalDate, localDateToIso } from "@/lib/date-input";
import { cn } from "cn";

type Props = {
  /** The id of the field button. Pair it with a `label`, or with a <Label htmlFor>. */
  id: string;
  /** YYYY-MM-DD. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest pickable day (YYYY-MM-DD), inclusive. */
  min?: string | null;
  /** Latest pickable day (YYYY-MM-DD), inclusive. */
  max?: string | null;
  /** The DS label above the field (15/20 bold). It and the picked date name the button together. */
  label?: string;
  invalid?: boolean;
  placeholder?: string;
  "aria-describedby"?: string;
};

/**
 * DS DatePicker: a label, a field-shaped button with the calendar Icon and the picked date, and a calendar popover.
 * The field follows the Input rules: 2px --input border, --foreground on hover, --ring border plus the ring on focus.
 * The calendar is shadcn's Calendar in a Popover (the DS draws its own grid).
 */
export function DatePicker({ id, value, onChange, min, max, label, invalid, placeholder = "Pick a date", ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const selected = isoToLocalDate(value) ?? undefined;
  const before = min ? isoToLocalDate(min) : null;
  const after = max ? isoToLocalDate(max) : null;
  const disabled = [...(before ? [{ before }] : []), ...(after ? [{ after }] : [])];
  const labelId = `${uid}-l`;
  const valueId = `${uid}-v`;

  return (
    <div className="relative flex min-w-0 flex-col gap-1.5" data-slot="date-picker">
      {label ? (
        <span id={labelId} className="text-[15px] leading-5 font-bold text-foreground">
          {label}
        </span>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            data-date={value}
            aria-haspopup="dialog"
            data-invalid={invalid || undefined}
            aria-labelledby={label ? `${labelId} ${valueId}` : undefined}
            aria-describedby={rest["aria-describedby"]}
            className={cn(
              "inline-flex h-control w-full min-w-0 cursor-pointer items-center gap-2 rounded-none border-2 border-input bg-card px-3 text-left text-base text-foreground outline-none transition-colors hover:border-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring data-invalid:border-destructive data-invalid:focus-visible:border-destructive data-invalid:focus-visible:ring-destructive motion-reduce:transition-none",
              !value && "text-muted-foreground"
            )}
          >
            <Icon name="calendar" size={18} />
            <span id={valueId}>{value ? formatIsoDate(value) : placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? before ?? undefined}
            disabled={disabled}
            onSelect={(date) => {
              if (!date) return;
              onChange(localDateToIso(date));
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
