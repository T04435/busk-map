"use client";

import { useId, useState } from "react";
import { cn } from "cn";
import { Icon } from "@/components/honeycomb/icon";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useLiveSearch } from "@/components/forms/use-live-search";
import { cityLabel, MELBOURNE_OPTION, type CityOption } from "@/lib/city";
import { MIN_QUERY_CHARS, SearchError, type SearchOutcome } from "@/lib/live-search";

// A status line beside the list (DS bm-results-line), never inside it: a listbox holds only options.
const LINE = "m-0 flex items-center gap-2 p-3 text-sm leading-5 text-muted-foreground";

/** City search (GET /api/cities, Open-Meteo geocoding). Module-level: useLiveSearch reads it once. */
export async function searchCities(q: string, signal: AbortSignal): Promise<SearchOutcome<CityOption>> {
  const res = await fetch(`/api/cities?${new URLSearchParams({ q })}`, { signal });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new SearchError(body?.error?.message ?? "City search isn't working right now. Try again in a moment.");
  if (body?.mode === "fallback") throw new SearchError("City search isn't working right now. Try again in a moment.");
  return { results: Array.isArray(body?.cities) ? body.cities : [] };
}

type Props = {
  value: CityOption;
  onChange: (city: CityOption) => void;
  label?: string;
  /** The id of the field button. */
  id?: string;
};

/**
 * Where the busk is: a field-shaped button with the picked city, and a search popover (shadcn Command in a Popover, the
 * combobox pattern the artist picker's list uses). Melbourne is the default and is always offered; any other city comes
 * from the geocoder.
 */
export function CityPicker({ value, onChange, label = "City", id }: Props) {
  const uid = useId();
  const fieldId = id ?? `${uid}-f`;
  const labelId = `${uid}-l`;
  const valueId = `${uid}-v`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { state, update, cancel } = useLiveSearch<CityOption>(searchCities);

  const typed = query.trim();
  const searching = typed.length >= MIN_QUERY_CHARS;
  const results = searching ? (state.status === "done" && state.query === typed ? state.results : []) : [value, ...(value.id === MELBOURNE_OPTION.id ? [] : [MELBOURNE_OPTION])];
  // The listbox exists only while it has options.
  const listed = results.length > 0;
  const [active, setActive] = useState<{ query: string; value: string } | null>(null);
  const activeValue = active && active.query === typed ? active.value : (results[0]?.id ?? "");

  function reset() {
    cancel();
    setQuery("");
    update("");
  }

  function pick(city: CityOption) {
    onChange(city);
    reset();
    setOpen(false);
  }

  return (
    <div className="relative flex min-w-0 max-w-120 flex-col gap-1.5" data-slot="city-picker" data-field="city">
      <span id={labelId} className="text-[15px] leading-5 font-bold text-foreground">
        {label}
      </span>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <PopoverTrigger asChild>
          <button
            id={fieldId}
            type="button"
            data-city={value.id}
            aria-haspopup="dialog"
            aria-labelledby={`${labelId} ${valueId}`}
            className="inline-flex h-control w-full min-w-0 cursor-pointer items-center gap-2 rounded-none border-2 border-input bg-card px-3 text-left text-base text-foreground outline-none transition-colors hover:border-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <Icon name="pin" size={18} />
            <span id={valueId} className="min-w-0 flex-1 truncate">
              {cityLabel(value)}
            </span>
            <Icon name="chevron-down" size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 gap-1 p-1" align="start">
          <Command shouldFilter={false} loop label={label} className="h-auto gap-1 border-0 p-0" value={activeValue} onValueChange={(v) => setActive({ query: typed, value: v })}>
            <CommandInput
              expanded={listed}
              value={query}
              onValueChange={(text) => {
                setQuery(text);
                update(text.trim());
              }}
              placeholder="Search a city, e.g. Tokyo"
              autoFocus
            />
            {typed && !searching && <p className={LINE}>Type {MIN_QUERY_CHARS} or more letters to search.</p>}
            {searching && state.status === "loading" && (
              <p role="status" className={LINE}>
                <Spinner size={18} label="Searching" className="text-primary" />
                Searching cities…
              </p>
            )}
            {searching && state.status === "error" && (
              <p role="alert" className={cn(LINE, "text-destructive")}>
                <Icon name="warning" size={16} className="shrink-0" />
                {state.message}
              </p>
            )}
            {searching && state.status === "done" && state.query === typed && results.length === 0 && (
              <p role="status" className={LINE}>
                No city matches “{typed}”.
              </p>
            )}
            {listed && (
              <CommandList label="City results">
                <CommandGroup>
                  {results.map((city) => (
                    <CommandItem key={city.id} value={city.id} data-checked={city.id === value.id} onSelect={() => pick(city)}>
                      <Icon name="pin" size={16} />
                      <span className="min-w-0 flex-1 break-words">{cityLabel(city)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
