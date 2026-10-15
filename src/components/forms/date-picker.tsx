"use client";

import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatIsoDate, isoToLocalDate, localDateToIso } from "@/lib/date-input";

type Props = {
  /** Pair with a <Label htmlFor>: the label names the trigger button. */
  id: string;
  /** YYYY-MM-DD. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest pickable day (YYYY-MM-DD), inclusive. */
  min?: string | null;
  /** Latest pickable day (YYYY-MM-DD), inclusive. */
  max?: string | null;
  "aria-describedby"?: string;
};

/** shadcn date picker: a button that opens a Calendar in a Popover. */
export function DatePicker({ id, value, onChange, min, max, ...rest }: Props) {
  const [open, setOpen] = useState(false);
  const selected = isoToLocalDate(value) ?? undefined;
  const before = min ? isoToLocalDate(min) : null;
  const after = max ? isoToLocalDate(max) : null;
  const disabled = [...(before ? [{ before }] : []), ...(after ? [{ after }] : [])];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
          data-date={value}
          aria-describedby={rest["aria-describedby"]}
        >
          <span>{value ? formatIsoDate(value) : "Pick a date"}</span>
          <CalendarIcon aria-hidden className="opacity-60" />
        </Button>
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
  );
}
