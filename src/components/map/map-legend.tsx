"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const RAMP = ["bg-taste-1", "bg-taste-2", "bg-taste-3", "bg-taste-4", "bg-taste-5"];
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
 * The map's key, on one line under (or over the bottom of) the map: the taste ramp as five honeycomb cells from low to high, the
 * top pin, the hidden-gem diamond and the quiet dot for the other scored pitches. The details are in tooltips, which open on hover
 * and on keyboard focus. Only symbols the map draws: no events or no-busking zones (the plan has no coordinates for them).
 */
export function MapLegend({ testData = false, className }: { testData?: boolean; className?: string }) {
  return (
    <TooltipProvider>
      <div
        data-slot="map-legend"
        aria-label="Map legend"
        role="group"
        className={cn("flex flex-wrap items-center gap-x-4 gap-y-0 border-2 border-rule bg-popover px-3 py-1 text-xs text-foreground md:shadow-sm", className)}
      >
        <Key tip={`Taste map from Qloo's heatmap${testData ? " (test data)" : ""}: cells run from a weak match on the left to a strong match on the right, for your artists.`}>
          <span>Taste</span>
          <span aria-hidden="true" className="flex items-center gap-0.5">
            {RAMP.map((c) => (
              <i key={c} className={cn("block h-[16px] w-3.5 border border-rule/40", c, HEX)} />
            ))}
          </span>
        </Key>
        <Key tip="Your top three pitches, numbered by rank.">
          <HexCell size={18} tone="primary" fontSize={10}>
            1
          </HexCell>
          Top pitch
        </Key>
        <Key tip="A pitch that scores well for your crowd but that most buskers overlook.">
          <span aria-hidden="true" className="block size-3.5 rotate-45 border-2 border-bluestone bg-honey" />
          Hidden gem
        </Key>
        <Key tip="Other pitches that were scored but did not make the top three. Use Browse other pitches to read them.">
          <span aria-hidden="true" className={cn("block h-4 w-3.5 bg-usual-spot", HEX)} />
          Other
        </Key>
      </div>
    </TooltipProvider>
  );
}
