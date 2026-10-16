import Link from "next/link";
import { Icon } from "@/components/honeycomb/icon";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Button } from "@/components/ui/button";

/** A stored busk whose slot is over: a dashed box with a clock cell, the slot struck through in mono, and a way to plan again. Never re-plans by itself. */
export function SlotPassed({ slotLabel, againHref, alone = false }: { slotLabel: string; againHref: string; alone?: boolean }) {
  return (
    <section
      role="status"
      data-testid="slot-passed"
      className={cn(
        "grid items-start gap-4 bg-card",
        alone ? "mx-auto max-w-xl grid-cols-1 justify-items-center border-2 border-rule px-5 py-12 text-center" : "grid-cols-[auto_minmax(0,1fr)] border-[1.5px] border-dashed border-input px-5 py-4",
      )}
    >
      <HexCell size={alone ? 64 : 40} tone="dashed" lift={alone}>
        <Icon name="clock" size={alone ? 28 : 20} />
      </HexCell>
      <div className={cn("grid min-w-0 gap-1.5", alone && "justify-items-center")}>
        <span className="font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase line-through">{slotLabel}</span>
        <h2 className={cn("m-0 font-display leading-none font-extrabold uppercase", alone ? "text-[40px]" : "text-[26px]")}>This slot has passed</h2>
        <p className="m-0 max-w-[60ch] text-[15px] leading-[22px] text-muted-foreground">
          {alone
            ? "There's no stored research for this busk. Plan again with the same act for a new date."
            : "This busk was for a time that's gone, so it's shown as it was. Plan again with the same act for a new date."}
        </p>
        <div>
          <Button asChild variant="outline">
            <Link href={againHref}>
              <Icon name="calendar" />
              Plan again for a new date
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
