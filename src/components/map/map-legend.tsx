"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const HEX = "[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]";

/** The DS LEGEND_TIPS, word for word. */
const TIPS = {
  taste: "Orange cells are where Qloo says your crowd gathers: the brighter, the closer the match. No cell, no match.",
  zone: "Hatched cells: busking isn't allowed there.",
  event: "An event letting out near a pitch in your slot.",
} as const;

/** One legend entry (DS bm-legend-li): a focusable key with a dotted underline, its tooltip opening on hover and on keyboard focus. With no tip it is a plain label. */
function Key({ tip, children }: { tip?: string; children: ReactNode }) {
  if (!tip) return <span className="inline-flex min-h-8 items-center gap-1.5 font-mono text-xs leading-4 font-medium text-foreground">{children}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex min-h-8 cursor-help items-center gap-1.5 border-0 border-b border-dotted border-muted-foreground bg-transparent p-0 font-mono text-xs leading-4 font-medium text-foreground">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

/** DS bm-legend-sw: a 14px box centring the swatch. */
const Sw = ({ children }: { children: ReactNode }) => (
  <span aria-hidden="true" className="grid size-3.5 flex-none place-items-center">
    {children}
  </span>
);

/**
 * DS TasteMapLegend `line` (F03): ONE line along the bottom of the map, the details in tooltips. It lists only what the map draws:
 * the taste ramp (orange steps 3 to 5) when there are cells, the numbered top pitches, the other-pitch cells, no-busking cells and
 * events when there are any. It never says "test data".
 */
export function MapLegend({ taste = true, top = true, others = true, zones = false, events = false, className }: { taste?: boolean; /** The numbered top pitches; off on a map without pitches (the Repertoire fans map). */ top?: boolean; others?: boolean; zones?: boolean; events?: boolean; className?: string }) {
  return (
    <TooltipProvider>
      <div
        data-slot="map-legend"
        aria-label="Map legend"
        role="group"
        className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 border-t-2 border-rule bg-[color-mix(in_srgb,var(--card)_94%,transparent)] px-3 py-2 font-mono text-xs leading-4 font-medium text-foreground", className)}
      >
        {taste ? (
          <Key tip={TIPS.taste}>
            <span aria-hidden="true" className="inline-flex gap-px">
              {["bg-taste-3", "bg-taste-4", "bg-taste-5"].map((c) => (
                <i key={c} className={cn("block h-[11px] w-2.5", c, HEX)} />
              ))}
            </span>
            Taste match
          </Key>
        ) : null}
        {top ? (
          <Key>
            <Sw>
              <i className={cn("block h-[21px] w-[18px] [background:radial-gradient(circle_at_50%_50%,#fbf9f5_0_2.2px,var(--primary)_2.7px_5.6px,var(--bluestone)_6.1px)]", HEX)} />
            </Sw>
            Top pitch
          </Key>
        ) : null}
        {others ? (
          <Key>
            <Sw>
              <i className={cn("block h-3.5 w-3 bg-usual-spot", HEX)} />
            </Sw>
            Other pitch
          </Key>
        ) : null}
        {zones ? (
          <Key tip={TIPS.zone}>
            <Sw>
              <i className={cn("block h-[18px] w-4 bg-[repeating-linear-gradient(45deg,var(--zone-pink)_0_2px,transparent_2px_5px)]", HEX)} />
            </Sw>
            No busking
          </Key>
        ) : null}
        {events ? (
          <Key tip={TIPS.event}>
            <Sw>
              <i className="block size-3 rotate-45 bg-event" />
            </Sw>
            Event
          </Key>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
