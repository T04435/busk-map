import Link from "next/link";
import { Calendar, Clock } from "lucide-react";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Button } from "@/components/ui/button";

/** A stored busk whose slot is over: a dashed box with a clock cell, the slot struck through in mono, and a way to plan again. Never re-plans by itself. */
export function SlotPassed({ slotLabel, againHref, alone = false }: { slotLabel: string; againHref: string; alone?: boolean }) {
  return (
    <section
      role="status"
      data-testid="slot-passed"
      className={cn("flex gap-4 border-2 border-dashed border-input bg-card p-5", alone ? "mx-auto max-w-xl flex-col items-center text-center" : "flex-col sm:flex-row sm:items-start")}
    >
      <HexCell size={alone ? 64 : 44} tone="dashed" lift={alone}>
        <Clock aria-hidden="true" className={alone ? "size-7" : "size-5"} />
      </HexCell>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase line-through">{slotLabel}</span>
        <h2 className="m-0 font-display text-[28px] leading-none font-extrabold uppercase">This slot has passed</h2>
        <p className="m-0">
          {alone
            ? "There's no stored research for this busk. Plan again with the same act for a new date."
            : "This busk was for a time that's gone, so it's shown as it was. Plan again with the same act for a new date."}
        </p>
        <div>
          <Button asChild variant="outline">
            <Link href={againHref}>
              <Calendar aria-hidden="true" />
              Plan again for a new date
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
