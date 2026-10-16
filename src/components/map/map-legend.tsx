import { cn } from "cn";
import { HexCell } from "@/components/honeycomb/hex-cell";

const RAMP = ["bg-taste-1", "bg-taste-2", "bg-taste-3", "bg-taste-4", "bg-taste-5"];
const HEX = "[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]";

/**
 * The map's key: the taste ramp as five honeycomb cells from low to high, the top pin, the hidden-gem diamond and the quiet
 * dot for the other scored pitches. Only symbols the map draws: no events or no-busking zones (the plan has no coordinates for them).
 */
export function MapLegend({ testData, className }: { testData: boolean; className?: string }) {
  return (
    <div data-slot="map-legend" aria-label="Map legend" role="group" className={cn("space-y-2 border-2 border-rule bg-popover p-3 text-xs text-foreground md:shadow-sm", className)}>
      <div>
        <p className="m-0 mb-1 font-mono text-[11px] font-bold tracking-[0.04em] uppercase">Taste map (Qloo heatmap{testData ? ", test data" : ""})</p>
        <div className="flex items-center gap-1" aria-hidden="true">
          <span>low</span>
          {RAMP.map((c) => (
            <i key={c} className={cn("block h-[18px] w-4 border border-rule/40", c, HEX)} />
          ))}
          <span>high: a stronger match for your artists</span>
        </div>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
        <li className="flex items-center gap-1.5">
          <HexCell size={18} tone="primary" fontSize={10}>
            1
          </HexCell>
          Top pitch
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="block size-3.5 rotate-45 border-2 border-bluestone bg-honey" />
          Hidden gem
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className={cn("block h-4 w-3.5 bg-usual-spot", HEX)} />
          Other scored pitch
        </li>
      </ul>
    </div>
  );
}
