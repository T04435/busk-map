import { cn } from "cn";
import { HIVE_CELLS } from "@/lib/agent-persona";

/** Pointy-top hexagon points around a centre (the DS's hexPts). */
function hexPts(cx: number, cy: number, R: number): string {
  const p: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    p.push(`${(cx + R * Math.cos(a)).toFixed(2)},${(cy + R * Math.sin(a)).toFixed(2)}`);
  }
  return p.join(" ");
}

/** The ring in fill order: clockwise from the top-right (screen angles, y down). */
const RING = [-60, 0, 60, 120, 180, 240];

/** The hex rule at each size: 2px at 40 and up, 1.5px at 24, 1px at 14. */
function strokeFor(size: number): number {
  return size >= 40 ? 2 : size >= 20 ? 1.5 : 1;
}

/** Gap between neighbouring cells' outer edges. */
function gapFor(size: number): number {
  return size >= 72 ? 3 : size >= 40 ? 2 : size >= 20 ? 1 : 0.6;
}

/** The pulse on the next cell. Only emitted while live; still under reduced motion and when the page pauses its loops. */
const PULSE_CSS =
  "@keyframes hive-pulse{0%,100%{opacity:1}50%{opacity:.35}}" +
  ".hive-pulse{animation:hive-pulse 1.4s ease-in-out infinite}" +
  "@media (prefers-reduced-motion: reduce){.hive-pulse{animation:none}}" +
  ':root[data-motion="paused"] .hive-pulse{animation-play-state:paused}';

export type HiveMarkProps = {
  /** Filled cells, 0–7 (hiveProgress in lib/agent-persona): the centre first, then the ring clockwise from the top-right. Default 7 (the full comb). */
  progress?: number;
  /** Width and height in px: 14 (tag), 24 (status line), 40 (header), 96 (Brain). */
  size?: number;
  /** Running: the next cell to fill pulses as an orange outline (dashed at 40 and up). */
  live?: boolean;
  /** Nothing ran: every cell unfilled on a dashed rule. */
  muted?: boolean;
  /** Spoken name, e.g. "The Hive, 3 of 7 steps done". Without it the mark is decorative (aria-hidden). */
  label?: string;
  className?: string;
};

/**
 * The Hive's mark: seven pointy-top cells in a comb. The centre is the agent (signal orange once it starts), the six around
 * it are its sources; the cells fill as steps finish, so the mark doubles as progress. Pure SVG, colours from tokens only.
 */
export function HiveMark({ progress = 7, size = 24, live = false, muted = false, label, className }: HiveMarkProps) {
  const filled = muted ? 0 : Math.max(0, Math.min(HIVE_CELLS, Math.round(progress)));
  const sw = strokeFor(size);
  const c = size / 2;
  // Fit the comb to the box: centres span 2·√3 r across and 3 r down; each drawn cell (stroke included) stays inside r.
  const r = size / 5.2;
  const d = r * Math.sqrt(3);
  // Shrink each drawn cell so the outer stroke edges of neighbours sit `gap` apart.
  const rho = r - (sw + gapFor(size)) / Math.sqrt(3);
  const pos: [number, number][] = [[c, c], ...RING.map((deg): [number, number] => [c + d * Math.cos((deg * Math.PI) / 180), c + d * Math.sin((deg * Math.PI) / 180)])];
  const next = live && !muted && filled < HIVE_CELLS ? filled : -1;
  // Two dashes per edge (an edge is rho long).
  const dash = `${(rho * 0.3).toFixed(2)} ${(rho * 0.2).toFixed(2)}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn("inline-block flex-none align-middle", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-slot="hive-mark"
      data-progress={filled}
    >
      {next >= 0 ? <style>{PULSE_CSS}</style> : null}
      {pos.map(([x, y], i) => {
        const on = i < filled;
        const pulse = i === next;
        const pts = hexPts(x, y, rho);
        if (on) {
          // Orange underneath at full width, the rule on top. At night the rule drops (--fill-rule is transparent, like HexCell's
          // primary tone) and the orange keeps the cell's full size instead of shrinking by the stroke.
          return (
            <g key={i}>
              <polygon points={pts} style={{ fill: "var(--primary)", stroke: "var(--primary)", strokeWidth: sw }} />
              <polygon points={pts} style={{ fill: "none", stroke: "var(--fill-rule, var(--rule))", strokeWidth: sw }} />
            </g>
          );
        }
        return (
          <polygon
            key={i}
            points={pts}
            className={pulse ? "hive-pulse" : undefined}
            style={{
              fill: "var(--card)",
              // The working cell is an orange dashed outline, so it never reads as done, even when the pulse is still (a
              // half-lit fill turned brown at night).
              stroke: pulse ? "var(--primary)" : muted ? "var(--input)" : "var(--rule)",
              strokeWidth: muted ? Math.max(1, sw - 0.5) : sw,
              // Under 40px the dashes break the cell up, so the working cell keeps a solid orange outline there.
              strokeDasharray: (pulse && size >= 40) || muted ? dash : undefined,
            }}
          />
        );
      })}
    </svg>
  );
}
