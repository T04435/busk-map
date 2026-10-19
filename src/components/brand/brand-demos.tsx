"use client";

import { useState } from "react";
import { PermitPicker } from "@/components/forms/permit-picker";
import { TimeSlotPicker, type TimeSlotId } from "@/components/forms/time-slot-picker";
import { Chip } from "@/components/honeycomb/chip";
import { LazyPlanMap } from "@/components/map/lazy-plan-map";
import { PicksList, type PickedSong } from "@/components/landing/repertoire-picker";
import { EXAMPLE_CENTER, EXAMPLE_OTHERS, EXAMPLE_PITCHES, EXAMPLE_TASTE_CELLS } from "@/lib/landing-example-busk";

/** The real PermitPicker, with state so it can be tried. */
export function BrandChoiceDemo() {
  const [permit, setPermit] = useState("general");
  return <PermitPicker value={permit} onValueChange={setPermit} />;
}

/** The real TimeSlotPicker (Any time picked) and chips, with state so they can be tried. */
export function BrandSlotDemo() {
  const [slot, setSlot] = useState<TimeSlotId | "">("any");
  const [chips, setChips] = useState<string[]>(["Folk"]);
  return (
    <div className="flex flex-col gap-4">
      <TimeSlotPicker anyTime value={slot} onChange={setSlot} />
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

const MAP_PLAN = { tasteCells: EXAMPLE_TASTE_CELLS, pitches: EXAMPLE_PITCHES, others: EXAMPLE_OTHERS };

/** The real plan map (with its legend), fed the landing's example busk. */
export function BrandMapDemo() {
  const [selected, setSelected] = useState(EXAMPLE_PITCHES[0].id);
  return <LazyPlanMap plan={MAP_PLAN} center={EXAMPLE_CENTER} selectedId={selected} onSelect={setSelected} />;
}

const SONGS: PickedSong[] = [
  { key: "ex-fast-car", title: "Fast Car", artist: "Tracy Chapman", album: "Tracy Chapman", image: null, durationMs: 296000, own: false },
  { key: "ex-laneway", title: "Laneway Light", artist: "The Larkspur Two", album: null, image: null, durationMs: 192000, own: true },
];

/** The real picked-songs list, with example songs; Remove works on the example. */
export function BrandPickedSongsDemo() {
  const [songs, setSongs] = useState(SONGS);
  return <PicksList songs={songs} onRemove={(s) => setSongs((cur) => cur.filter((x) => x !== s))} />;
}

