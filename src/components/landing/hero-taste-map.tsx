import { cn } from "cn";

const R = 15;
const W = Math.sqrt(3) * R;
const COLS = 30;
const ROWS = 26;
const WIDTH = COLS * W + W / 2;
const HEIGHT = (ROWS - 1) * 1.5 * R + 2 * R;

type Heat = { x: number; y: number; a: number }[];
type MapPin = { rank: number; col: number; row: number; kind: "top" | "gem" };

/** Hot spots on the grid (cell units): where this crowd gathers. A made-up pattern, not a city's data. */
const HERO_HEAT: Heat = [
  { x: 14.7, y: 13.3, a: 1 },
  { x: 9.5, y: 8, a: 0.86 },
  { x: 19.6, y: 9.1, a: 0.74 },
  { x: 20.6, y: 16.5, a: 0.5 },
];

function affinity(heat: Heat, cx: number, cy: number): number {
  let best = 0;
  for (const h of heat) {
    const d = Math.hypot(cx - h.x, (cy - h.y) * 1.15);
    best = Math.max(best, h.a * Math.exp(-(d * d) / 13));
  }
  return best;
}
const level = (a: number) => (a >= 0.7 ? 5 : a >= 0.5 ? 4 : a >= 0.3 ? 3 : a >= 0.14 ? 2 : 1);

function hexPoints(x: number, y: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const t = (Math.PI / 180) * (60 * i - 90);
    return `${(x + r * Math.cos(t)).toFixed(1)},${(y + r * Math.sin(t)).toFixed(1)}`;
  }).join(" ");
}

const center = (col: number, row: number) => ({ x: col * W + (row % 2 ? W : W / 2), y: row * 1.5 * R + R });

const HERO_PINS: MapPin[] = [
  { rank: 1, col: 14, row: 13, kind: "top" },
  { rank: 2, col: 9, row: 8, kind: "gem" },
  { rank: 3, col: 19, row: 9, kind: "top" },
];

/** L05 hero orange-only (user, 17 Oct): the hero shows only the orange cells (taste level 3 and up). */
const HERO_ORANGE_ONLY = true;

/** A few faint streets under the cells, so it reads as a map. */
const STREETS = ["M0 170 L760 240", "M0 380 L760 340", "M230 0 L290 600", "M520 0 L470 600", "M0 270 L760 120"];

/**
 * An illustration of a taste map: pointy-top cells in the five-step taste ramp, three pitch pins on top. The pattern is
 * made up for the hero, and says so. Server-rendered; the cells fill in coolest first and the pins drop (CSS only; static under reduced
 * motion). The real map is on the plan page.
 */
export function HeroTasteMap({ className, label, heat = HERO_HEAT, pins = HERO_PINS }: { className?: string; label: string; heat?: Heat; pins?: MapPin[] }) {
  const cells = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const { x, y } = center(col, row);
      const a = affinity(heat, col + (row % 2 ? 0.5 : 0), row);
      const lv = level(a);
      // L05 hero orange-only (user): the dark, low-taste cells are dropped.
      if (HERO_ORANGE_ONLY && lv < 3) continue;
      cells.push(
        <polygon
          key={`${col}-${row}`}
          className={lv === 5 ? "hc-cell-hot" : "hc-cell"}
          style={{ "--d": `${Math.round(a * 900 + ((col * 7 + row * 3) % 5) * 40)}ms` } as React.CSSProperties}
          points={hexPoints(x, y, R - 1.5)}
          fill={`var(--taste-${lv})`}
          opacity={0.9}
        />,
      );
    }
  }
  return (
    // Full-bleed (F19): the map fills whatever box it is given, edge to edge, with no frame and no empty space.
    <svg role="img" aria-label={label} viewBox={`0 0 ${WIDTH.toFixed(0)} ${HEIGHT.toFixed(0)}`} preserveAspectRatio="xMidYMid slice" className={cn("block size-full", className)}>
      <g fill="none" stroke="var(--foreground)" strokeOpacity={0.14} strokeWidth={2}>
        {STREETS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {cells}
      {pins.map((pin) => {
        const { x, y } = center(pin.col, pin.row);
        // Every ranked pitch is a numbered pin, hidden gems too (the gem is marked where pitches are listed).
        return (
          <g key={pin.rank} className="hc-pin" style={{ "--d": `${1500 + pin.rank * 160}ms` } as React.CSSProperties}>
            <polygon points={hexPoints(x, y, 24)} fill="var(--bluestone)" stroke="var(--primary)" strokeWidth={3} />
            <text x={x} y={y + 8} textAnchor="middle" fill="var(--primary)" style={{ font: "800 22px var(--font-display)" }}>
              {pin.rank}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
