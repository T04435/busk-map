"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const ORANGE_STEPS = ["bg-taste-3", "bg-taste-4", "bg-taste-5"];
const HEX = "[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]";

/** One legend entry: a focusable key whose tooltip (on hover and on keyboard focus) says what the symbol means. */
function Key({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex min-h-8 cursor-help items-center gap-1.5 border-0 bg-transparent p-0 text-xs text-foreground">
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The map's key (F03): ONE line along the bottom of the map, the details in tooltips that open on hover and on keyboard focus.
 * It lists only what the map draws: the taste cells (orange, steps 3 to 5) when there are any, the numbered top pitches, and the
 * quiet dots when other pitches were scored. No events or no-busking zones yet (the plan has no coordinates for them), and it
 * never says "test data".
 */
export function MapLegend({ taste = true, others = true, className }: { taste?: boolean; others?: boolean; className?: string }) {
  return (
    <TooltipProvider>
      <div
        data-slot="map-legend"
        aria-label="Map legend"
        role="group"
        className={cn("flex flex-wrap items-center gap-x-4 gap-y-0 border-t-2 border-rule bg-popover px-3 py-1 text-xs text-foreground", className)}
      >
        {taste ? (
          <Key tip="Taste match from Qloo's heatmap for your artists: the deeper the orange, the closer the crowd's taste is to yours. Cells with a weak match are left off, so the streets show.">
            <span>Taste match</span>
            <span aria-hidden="true" className="flex items-center gap-0.5">
              {ORANGE_STEPS.map((c) => (
                <i key={c} className={cn("block h-[16px] w-3.5 border border-rule/40", c, HEX)} />
              ))}
            </span>
          </Key>
        ) : null}
        <Key tip="Your top three pitches, numbered by rank.">
          <HexCell size={18} tone="primary" fontSize={10}>
            1
          </HexCell>
          Top pitch
        </Key>
        {others ? (
          <Key tip="Other pitches that were scored but did not make the top three. Use Browse other pitches to read them.">
            <span aria-hidden="true" className={cn("block h-4 w-3.5 bg-usual-spot", HEX)} />
            Other pitch
          </Key>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
