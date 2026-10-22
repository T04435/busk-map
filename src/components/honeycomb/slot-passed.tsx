import Link from "next/link";
import { cn } from "cn";
import { Icon } from "@/components/honeycomb/icon";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

const SLOT_CLS = "font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase line-through";
const H2_CLS = "m-0 font-display leading-none font-extrabold uppercase";

function Again({ href }: { href: string }) {
  return (
    <Button asChild variant="outline">
      <Link href={href}>
        <Icon name="calendar" />
        Plan again for a new date
      </Link>
    </Button>
  );
}

/**
 * A stored busk whose slot is over: a clock cell, the slot struck through in mono, and a way to plan again. Never re-plans by itself.
 * `alone` (no stored research): the centred empty state (shadcn Empty). Otherwise the dashed row above the busk (shadcn Item).
 */
export function SlotPassed({ slotLabel, againHref, alone = false }: { slotLabel: string; againHref: string; alone?: boolean }) {
  if (alone)
    return (
      <Empty role="status" data-testid="slot-passed" className="mx-auto max-w-xl grid-cols-1 items-start gap-4 border-2 border-rule bg-card px-5 py-12">
        <EmptyMedia>
          <HexCell size={64} tone="dashed" lift>
            <Icon name="clock" size={28} />
          </HexCell>
        </EmptyMedia>
        <div className="grid min-w-0 justify-items-center gap-1.5">
          <span className={SLOT_CLS}>{slotLabel}</span>
          <EmptyTitle>
            <h2 className={cn(H2_CLS, "text-[40px]")}>This slot has passed</h2>
          </EmptyTitle>
          <EmptyDescription className="max-w-[60ch]">There&apos;s no stored research for this busk. Plan again with the same act for a new date.</EmptyDescription>
          <EmptyContent className="block">
            <Again href={againHref} />
          </EmptyContent>
        </div>
      </Empty>
    );
  return (
    <Item asChild variant="outline" className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 bg-card px-5 py-4">
      <section role="status" data-testid="slot-passed">
        <ItemMedia>
          <HexCell size={40} tone="dashed">
            <Icon name="clock" size={20} />
          </HexCell>
        </ItemMedia>
        <ItemContent className="grid gap-1.5">
          <span className={SLOT_CLS}>{slotLabel}</span>
          <ItemTitle asChild className={cn(H2_CLS, "text-[26px]")}>
            <h2>This slot has passed</h2>
          </ItemTitle>
          <ItemDescription className="max-w-[60ch] text-[15px] leading-[22px]">This busk was for a time that&apos;s gone, so it&apos;s shown as it was. Plan again with the same act for a new date.</ItemDescription>
          <div>
            <Again href={againHref} />
          </div>
        </ItemContent>
      </section>
    </Item>
  );
}
