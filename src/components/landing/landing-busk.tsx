"use client";

import { useRef, useState } from "react";
import { BothAgreeBadge } from "@/components/honeycomb/both-agree-badge";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { PitchRow } from "@/components/honeycomb/pitch-row";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { LazyPlanMap } from "@/components/map/lazy-plan-map";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EXAMPLE_CENTER, EXAMPLE_OTHERS, EXAMPLE_PITCHES, EXAMPLE_TASTE_CELLS } from "@/lib/landing-example-busk";

const SUMMARY =
  "Southbank Promenade has the closest crowd to your folk sound on Qloo, busy in your slot (an estimate from Qloo), and a matinee letting out at 2:45 pm. Hardware Lane is the quieter hidden gem; Degraves Street is busier but shared.";

const PLAN = { tasteCells: EXAMPLE_TASTE_CELLS, pitches: EXAMPLE_PITCHES, others: EXAMPLE_OTHERS };

/**
 * "Your busk" as the deck draws it: the summary and the three ranked pitches beside the real PlanMap, all example data. Picking a
 * pitch (in the list or on the map) selects it in both, exactly as on a plan.
 */
const DETAILS: Record<string, { facts: string[]; why: string }> = {
  "ex-southbank": {
    why: "The strongest folk taste area on Qloo, with a steady walking crowd along the river and a matinee letting out at 2:45 pm.",
    facts: ["Busy in your slot (estimate from Qloo: popular places open nearby)", "General permit pitch, clear of the no-busking zones", "Open with Fast Car: this crowd knows it best"],
  },
  "ex-hardware": {
    why: "A quieter laneway where cafe diners linger. Fewer people pass, but they stop, and few buskers work it.",
    facts: ["A hidden gem: a good score that most buskers miss", "Close crowd match on Qloo for your artists", "Allowed with a general permit"],
  },
  "ex-degraves": {
    why: "Busier than the other two and shared with the usual buskers, so it is a safe fallback when the others are taken.",
    facts: ["The plain AI picked it too: both agree", "A pitch you would already know", "Allowed with a general permit"],
  },
};

export function LandingBusk() {
  const [selectedId, setSelectedId] = useState(EXAMPLE_PITCHES[0].id);
  const [openId, setOpenId] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = EXAMPLE_PITCHES.find((p) => p.id === openId) ?? null;
  return (
    <div className="grid items-stretch border-2 border-rule bg-card lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="flex flex-col gap-4 p-4 md:p-6 lg:border-r-2 lg:border-rule">
        <div>
          <h3 className="m-0 font-display text-[clamp(36px,4vw,56px)] leading-[0.92] font-extrabold uppercase">Your busk</h3>
          <p className="m-0 font-mono text-xs leading-4 font-medium text-muted-foreground">Sunday · 12–3 pm · General permit</p>
        </div>
        <p className="m-0 text-base leading-6">{SUMMARY}</p>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {EXAMPLE_PITCHES.map((pitch, i) => (
            <PitchRow
              key={pitch.id}
              pitchId={pitch.id}
              rank={i + 1}
              name={pitch.name}
              score={pitch.score}
              selected={pitch.id === selectedId}
              onSelect={() => setSelectedId(pitch.id)}
              onDetails={() => {
                opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
                setSelectedId(pitch.id);
                setOpenId(pitch.id);
              }}
              badges={
                <>
                  <DiscoveryBadge discovery={pitch.discovery} />
                  {pitch.id === "ex-degraves" ? <BothAgreeBadge /> : null}
                </>
              }
            />
          ))}
        </ol>
      </div>
      <div className="min-w-0 border-t-2 border-rule lg:border-t-0">
        <LazyPlanMap plan={PLAN} center={EXAMPLE_CENTER} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          side="right"
          className="w-full gap-0 bg-background p-0 sm:max-w-xl"
          data-testid="example-pitch-sheet"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus();
          }}
        >
          {open ? (
            <>
              <SheetHeader className="border-b-2 border-rule bg-popover p-4 pr-16 md:p-6 md:pr-16">
                <SheetTitle className="font-display text-[34px] leading-[0.95] font-extrabold uppercase">{open.name}</SheetTitle>
                <SheetDescription className="font-mono text-xs font-bold tracking-[0.06em] uppercase">
                  Pitch {EXAMPLE_PITCHES.indexOf(open) + 1} · {open.when} · Score {open.score}
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-4 p-4 md:p-6">
                <p className="m-0 text-base leading-6">{DETAILS[open.id].why}</p>
                <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm leading-5">
                  {DETAILS[open.id].facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <p className="m-0 text-sm text-muted-foreground">This is the example busk. A real plan has the pitch card, your set and the crowd for each pitch.</p>
                <Button asChild className="self-start">
                  <Link href="/busks">
                    Plan your busk <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
