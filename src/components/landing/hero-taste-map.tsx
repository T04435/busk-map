import { cn } from "cn";

const R = 25;
const W = Math.sqrt(3) * R;
const COLS = 13;
const ROWS = 10;
const WIDTH = COLS * W + W / 2;
const HEIGHT = (ROWS - 1) * 1.5 * R + 2 * R;

type Heat = { x: number; y: number; a: number }[];
type MapPin = { rank: number; col: number; row: number; kind: "top" | "gem" };

/** Hot spots on the grid (cell units): where this crowd gathers. A made-up pattern, not a city's data. */
const HERO_HEAT: Heat = [
  { x: 6.2, y: 5.4, a: 1 },
  { x: 3.4, y: 2.6, a: 0.86 },
  { x: 8.8, y: 3.2, a: 0.74 },
  { x: 9.6, y: 6.8, a: 0.5 },
];

function affinity(heat: Heat, cx: number, cy: number): number {
  let best = 0;
  for (const h of heat) {
    const d = Math.hypot(cx - h.x, (cy - h.y) * 1.15);
    best = Math.max(best, h.a * Math.exp(-(d * d) / 9));
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
  { rank: 1, col: 6, row: 5, kind: "top" },
  { rank: 2, col: 3, row: 2, kind: "gem" },
  { rank: 3, col: 9, row: 3, kind: "top" },
];

/** The pattern behind "What you get back": another made-up crowd, with the pins of the example busk. */
export const PLAN_PREVIEW = {
  heat: [
    { x: 3.6, y: 6.4, a: 1 },
    { x: 7.4, y: 2.8, a: 0.9 },
    { x: 9.4, y: 6.2, a: 0.72 },
    { x: 1.6, y: 1.8, a: 0.4 },
  ] satisfies Heat,
  pins: [
    { rank: 1, col: 3, row: 6, kind: "top" },
    { rank: 2, col: 7, row: 3, kind: "gem" },
    { rank: 3, col: 9, row: 6, kind: "top" },
  ] satisfies MapPin[],
};

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
      cells.push(
        <polygon
          key={`${col}-${row}`}
          className={lv === 5 ? "hc-cell-hot" : "hc-cell"}
          style={{ "--d": `${Math.round(a * 900 + ((col * 7 + row * 3) % 5) * 40)}ms` } as React.CSSProperties}
          points={hexPoints(x, y, R - 1.5)}
          fill={`var(--taste-${lv})`}
          opacity={0.85}
        />,
      );
    }
  }
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${WIDTH.toFixed(0)} ${HEIGHT.toFixed(0)}`} className={cn("block h-auto w-full border-2 border-rule bg-background", className)}>
      {cells}
      {pins.map((pin) => {
        const { x, y } = center(pin.col, pin.row);
        // Every ranked pitch is a numbered pin, hidden gems too (the gem is marked where pitches are listed).
        return (
          <g key={pin.rank} className="hc-pin" style={{ "--d": `${1500 + pin.rank * 160}ms` } as React.CSSProperties}>
            <polygon points={hexPoints(x, y, 21)} fill="var(--bluestone)" stroke="var(--primary)" strokeWidth={3} />
            <text x={x} y={y + 8} textAnchor="middle" fill="var(--primary)" style={{ font: "800 22px var(--font-display)" }}>
              {pin.rank}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
