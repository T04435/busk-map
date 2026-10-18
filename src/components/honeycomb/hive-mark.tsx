"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "cn";

/**
 * The Hive's mark: seven pointy-top cells in one comb. Ported 1:1 from the design project's HiveMark (Hive Identity): the
 * geometry, timings and easing below are the design's, in its 24-unit box. Colour is `currentColor` (signal orange by default,
 * `text-signal-text` for the 14px inline tag); only the centre cell of a single-source step takes the source's colour.
 *
 * - `state="rest"`: all seven cells full (done, replayed, standing). `state="working"`: the centre is full and the outer cells
 *   move per `anim`. Reduced motion (checked live) and `motion={false}` hold the anim's fixed working frame.
 * - `source`: the centre cell takes the source's colour (tokens `--source-*`) and, from 20px up, its logo. Outer cells keep
 *   animating in Hive orange. Mixed-source steps omit it.
 * - `muted`: the dashed plain hex used when the Hive didn't run (the design's engine-only state does not use the mark).
 */
export type HiveAnim = "origami" | "flip" | "bud" | "comet" | "wave";
export type HiveSource = "qloo" | "spotify" | "lastfm";

export type HiveMarkProps = {
  /** working: the outer cells move; rest (default): all seven full. */
  state?: "working" | "rest";
  /** The working animation. Default origami. */
  anim?: HiveAnim;
  /** The one source a single-source step runs on. Omit for mixed-source steps. */
  source?: HiveSource;
  /** Width and height in px: 14 (tag, the minimum), 16, 20–24, 28, 72–104. */
  size?: number;
  /** false freezes the working frame. Default true. */
  motion?: boolean;
  /** Hide it from assistive tech when adjacent text names the state. */
  decorative?: boolean;
  /** Spoken name when not decorative. Default "The Hive" / "The Hive, researching". */
  label?: string;
  /** The Hive didn't run: a dashed plain hex instead of the comb. */
  muted?: boolean;
  className?: string;
};

/** Frozen working frame per anim: the time (ms) the reduced-motion and motion={false} marks hold. */
const FROZEN: Record<HiveAnim, number> = { origami: 1100, flip: 700, bud: 800, comet: 700, wave: 0 };
const DIRS = [-60, 0, 60, 120, 180, 240];

type Cell = { points: string; fill: string; stroke: string; sw: number; op: number };

/** The centre cell's logo per source, drawn in a nested viewBox: Qloo's ring and tail (the design's), Spotify's symbol (the official full logo's first path), Last.fm's "as". */
const LOGOS: Record<HiveSource, { viewBox: string; ink: string; body: React.ReactNode }> = {
  qloo: {
    viewBox: "0 0 24 24",
    ink: "var(--source-qloo-ink)",
    body: (
      <>
        <circle cx="11" cy="11" r="7.5" fill="none" stroke="var(--source-qloo-ink)" strokeWidth="3.4" />
        <path d="M14.5 14.5 L20.5 20.5" stroke="var(--source-qloo-ink)" strokeWidth="3.6" strokeLinecap="round" />
      </>
    ),
  },
  spotify: {
    viewBox: "11.8 3.2 218.8 218.8",
    ink: "var(--source-spotify-ink)",
    body: (
      <path
        fill="var(--source-spotify-ink)"
        d="m125.52,3.31C65.14.91,14.26,47.91,11.86,108.29c-2.4,60.38,44.61,111.26,104.98,113.66,60.38,2.4,111.26-44.6,113.66-104.98C232.89,56.59,185.89,5.7,125.52,3.31Zm46.18,160.28c-1.36,2.4-4.01,3.6-6.59,3.24-.79-.11-1.58-.37-2.32-.79-14.46-8.23-30.22-13.59-46.84-15.93-16.62-2.34-33.25-1.53-49.42,2.4-3.51.85-7.04-1.3-7.89-4.81-.85-3.51,1.3-7.04,4.81-7.89,17.78-4.32,36.06-5.21,54.32-2.64,18.26,2.57,35.58,8.46,51.49,17.51,3.13,1.79,4.23,5.77,2.45,8.91Zm14.38-28.72c-2.23,4.12-7.39,5.66-11.51,3.43-16.92-9.15-35.24-15.16-54.45-17.86-19.21-2.7-38.47-1.97-57.26,2.16-1.02.22-2.03.26-3.01.12-3.41-.48-6.33-3.02-7.11-6.59-1.01-4.58,1.89-9.11,6.47-10.12,20.77-4.57,42.06-5.38,63.28-2.4,21.21,2.98,41.46,9.62,60.16,19.74,4.13,2.23,5.66,7.38,3.43,11.51Zm15.94-32.38c-2.1,4.04-6.47,6.13-10.73,5.53-1.15-.16-2.28-.52-3.37-1.08-19.7-10.25-40.92-17.02-63.07-20.13-22.15-3.11-44.42-2.45-66.18,1.97-5.66,1.15-11.17-2.51-12.32-8.16-1.15-5.66,2.51-11.17,8.16-12.32,24.1-4.89,48.74-5.62,73.25-2.18,24.51,3.44,47.99,10.94,69.81,22.29,5.12,2.66,7.11,8.97,4.45,14.09Z"
      />
    ),
  },
  lastfm: {
    viewBox: "0 0 24 24",
    ink: "var(--source-lastfm-ink)",
    body: (
      <path
        fill="var(--source-lastfm-ink)"
        d="M10.584 17.21l-.88-2.392s-1.43 1.595-3.573 1.595c-1.897 0-3.244-1.65-3.244-4.29 0-3.382 1.705-4.592 3.382-4.592 2.42 0 3.19 1.568 3.85 3.575l.88 2.75c.88 2.667 2.53 4.812 7.285 4.812 3.41 0 5.72-1.045 5.72-3.795 0-2.227-1.265-3.382-3.628-3.932l-1.76-.385c-1.21-.275-1.567-.77-1.567-1.595 0-.935.742-1.485 1.952-1.485 1.32 0 2.032.495 2.14 1.677l2.75-.33C22.51 5.52 20.664 4.5 18.096 4.5c-2.832 0-5.007 1.072-5.007 3.762 0 1.787.865 2.915 3.052 3.437l1.842.44c1.38.33 1.87.907 1.87 1.7 0 1.017-.99 1.43-2.86 1.43-2.77 0-3.927-1.452-4.592-3.463l-.907-2.75C10.32 6.51 8.918 4.5 5.38 4.5 1.926 4.5 0 6.7 0 10.52c0 3.658 1.87 6.18 5.2 6.18 2.69 0 4.07-1.265 4.07-1.265l1.314 1.775z"
      />
    ),
  },
};

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));

/** Per outer cell: s = fill 0..1, k = radial offset, sx = horizontal squash. */
function outer(anim: HiveAnim, t: number): { s: number; k: number; sx: number }[] {
  return DIRS.map((_, i) => {
    let s = 1;
    let k = 0;
    let sx = 1;
    if (anim === "flip") {
      const ph = t % 2200;
      sx = Math.abs(Math.cos(Math.PI * ease((ph - i * 200) / 420)));
    } else if (anim === "bud") {
      const ph = t % 3000;
      const e = ph < 2400 ? ease((ph - i * 230) / 420) : 1 - ease((ph - 2400) / 450);
      k = -8 * (1 - e);
      s = e;
    } else if (anim === "comet") {
      const d = ((((t / 210) % 6) - i + 6) % 6);
      s = d < 1 ? 1 : Math.max(0, 1 - (d - 1) / 2.4);
    } else if (anim === "wave") {
      s = 0.5 + 0.5 * Math.sin(2 * Math.PI * (t / 1500 - i / 6));
    }
    return { s, k, sx };
  });
}

const hex = (x: number, y: number, r: number, sx = 1) =>
  [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = (Math.PI / 180) * (60 * i - 90);
      return `${(x + sx * r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`;
    })
    .join(" ");

const solid = (points: string, op = 1): Cell => ({ points, fill: "currentColor", stroke: "none", sw: 0, op });

function cellsOf(working: boolean, anim: HiveAnim, source: HiveSource | undefined, size: number, t: number): Cell[] {
  const R = 4.1;
  const D = 8;
  const C = 12;
  const sw = 1.5;
  const seed = 0.42;
  const centre = (): Cell => ({ points: hex(C, C, R), fill: source ? `var(--source-${source})` : "currentColor", stroke: "none", sw: 0, op: 1 });
  const cells: Cell[] = [];
  if (!working) {
    DIRS.forEach((d) => {
      const a = (Math.PI / 180) * d;
      cells.push(solid(hex(C + D * Math.cos(a), C + D * Math.sin(a), R)));
    });
    cells.push(centre());
  } else if (anim === "origami") {
    // each cell hinges on the line halfway to the centre, lifts in perspective and lands face-down on it, one at a time
    const H = 4;
    const P = 26;
    const back: Cell[] = [];
    const ph = t % 4400;
    DIRS.forEach((d, i) => {
      const a = (Math.PI / 180) * d;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const vx = -uy;
      const vy = ux;
      const p = ph < 2600 ? ease((ph - i * 350) / 500) : 1 - ease((ph - 2700 - (5 - i) * 250) / 450);
      const th = Math.PI * p;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      const pts = [0, 1, 2, 3, 4, 5]
        .map((j) => {
          const va = (Math.PI / 180) * (60 * j - 90);
          const wx = D * ux + R * Math.cos(va);
          const wy = D * uy + R * Math.sin(va);
          const u = wx * ux + wy * uy - H;
          const v = wx * vx + wy * vy;
          const r = H + u * c;
          const f = P / (P - u * sn);
          return `${(C + (r * ux + v * vx) * f).toFixed(2)},${(C + (r * uy + v * vy) * f).toFixed(2)}`;
        })
        .join(" ");
      const flipped = th > Math.PI / 2;
      (flipped ? back : cells).push(solid(pts, flipped ? 0.5 : +(1 - 0.4 * sn).toFixed(3)));
    });
    cells.push(centre(), ...back);
  } else {
    const st = outer(anim, t);
    const seedless = anim === "bud";
    const outline = size >= 20;
    DIRS.forEach((d, i) => {
      const a = (Math.PI / 180) * d;
      const hx = C + D * Math.cos(a);
      const hy = C + D * Math.sin(a);
      const { s, k, sx } = st[i];
      const px = C + (D + k) * Math.cos(a);
      const py = C + (D + k) * Math.sin(a);
      if (outline) {
        if (s < 0.999 || Math.abs(k) > 0.01) cells.push({ points: hex(hx, hy, R - sw * 0.6), fill: "none", stroke: "currentColor", sw, op: 1 });
        if (R * s > 0.6) cells.push(solid(hex(px, py, R * s, sx)));
      } else {
        const r = seedless ? R * s : R * (seed + (1 - seed) * s);
        if (r > 0.4) cells.push(solid(hex(px, py, r, Math.max(sx, 0.12))));
      }
    });
    cells.push(centre());
  }
  return cells;
}

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const reducedNow = () => window.matchMedia(REDUCED).matches;

export function HiveMark({ state = "rest", anim = "origami", source, size = 24, motion = true, decorative = false, label, muted = false, className }: HiveMarkProps) {
  const working = state === "working";
  const kind: HiveAnim = anim in FROZEN ? anim : "origami";
  // Prefers-reduced-motion is read live; on the server and the first paint the mark holds its fixed frame.
  const reduced = useSyncExternalStore(subscribeReduced, reducedNow, () => true);
  const animating = working && motion !== false && !reduced && !muted;
  const [t, setT] = useState<number | null>(null);
  useEffect(() => {
    if (!animating) return;
    const t0 = performance.now();
    let last = 0;
    let raf = 0;
    const loop = (now: number) => {
      // The page's pause switch (MotionPause) holds the frame.
      if (now - last > 30 && document.documentElement.dataset.motion !== "paused") {
        last = now;
        setT(now - t0);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [animating, kind]);

  const spoken = decorative ? undefined : (label ?? (muted ? "The Hive didn't run" : working ? "The Hive, researching" : "The Hive"));
  const common = {
    "data-slot": "hive-mark",
    "data-state": muted ? "muted" : state,
    role: decorative ? undefined : "img",
    "aria-label": spoken,
    "aria-hidden": decorative ? true : undefined,
    className: cn("inline-flex flex-none align-middle leading-none text-primary", className),
    style: { lineHeight: 0 },
  } as const;

  if (muted) {
    return (
      <span {...common}>
        <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", overflow: "visible" }} focusable="false">
          <polygon points={hex(12, 12, 8.6)} fill="none" style={{ stroke: "var(--input)" }} strokeWidth={1.5} strokeDasharray="2.4 1.8" />
        </svg>
      </span>
    );
  }

  const cells = cellsOf(working, kind, source, size, animating && t !== null ? t : FROZEN[kind]);
  const logo = source && size >= 20 ? LOGOS[source] : null;
  const lw = 4.6;
  return (
    <span {...common} data-anim={working ? kind : undefined} data-source={source}>
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block", overflow: "visible" }} focusable="false">
        {cells.map((c, i) => (
          <polygon key={i} points={c.points} fill={c.fill} stroke={c.stroke} strokeWidth={c.sw} fillOpacity={c.op} strokeLinejoin="miter" />
        ))}
        {logo ? (
          <svg x={12 - lw / 2} y={12 - lw / 2} width={lw} height={lw} viewBox={logo.viewBox}>
            {logo.body}
          </svg>
        ) : null}
      </svg>
    </span>
  );
}
