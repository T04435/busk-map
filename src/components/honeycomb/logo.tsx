import { cn } from "cn";

/** Pointy-top hexagon points, like Qloo's H3 cells. */
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

// Stencil caps, chamfered on a 26-unit grid; the word gap is tightened to 22 units.
const STENCIL: Record<string, string> = {
  B: "M0 0H18L24 6V14L19 20H0M19 20L26 26V34L19 40H0M0 0V40",
  U: "M0 0V34L6 40H20L26 34V0",
  S: "M26 0H6L0 6V14L6 20H20L26 26V34L20 40H0",
  K: "M0 0V40M24 0L5 20L24 40",
  M: "M0 40V0L13 18L26 0V40",
  A: "M0 40V8L8 0H18L26 8V40M0 22H26",
  P: "M0 40V0H20L26 6V16L20 22H0",
};
const WORD_X = [0, 44, 88, 132, 198, 242, 286];

function WordPaths() {
  return "BUSKMAP".split("").map((c, i) => <path key={i} transform={`translate(${5.5 + WORD_X[i]} 5.5)`} d={STENCIL[c]} />);
}

function Word() {
  return (
    <>
      <g className="stroke-primary" transform="translate(3 3)" fill="none" strokeWidth={9} strokeLinejoin="miter" strokeLinecap="square">
        <WordPaths />
      </g>
      <g className="stroke-current" fill="none" strokeWidth={9} strokeLinejoin="miter" strokeLinecap="square">
        <WordPaths />
      </g>
    </>
  );
}

/** The pitch ring: a 306-degree arc (the crowd) around one honeycomb cell (the performer). */
function Ring({ core = "fill-card dark:fill-foreground" }: { core?: string }) {
  return (
    <>
      <path d="M38.554 20.371A15 15 0 1 1 27.629 9.446" fill="none" stroke="currentColor" strokeWidth={6.5} strokeLinecap="round" />
      <polygon points={hexPoints(24, 24, 6.6)} className={core} />
    </>
  );
}

function Tile({ bare }: { bare?: boolean }) {
  return (
    <>
      <polygon points={hexPoints(24, 24, 22.75)} className={cn("fill-primary stroke-[var(--fill-rule)]", bare && "stroke-none")} strokeWidth={2.5} strokeLinejoin="miter" />
      <g className="text-primary-foreground" transform="translate(4.8 4.8) scale(0.8)">
        <Ring />
      </g>
    </>
  );
}

export type LogoProps = { variant?: "lockup" | "mark" | "wordmark" | "ring"; size?: number; className?: string; /** Drop the 2px rule on the tile: for the bluestone header, where the tile is its own edge. */ bare?: boolean };

/**
 * The Busk Map logo, drawn in the page's colours: the orange cell, the ring and the stencil word. Inherits `color`
 * for the word, so on the bluestone header set a light text colour.
 */
export function Logo({ variant = "lockup", size = 32, className, bare }: LogoProps) {
  const title = <title>Busk Map</title>;
  const base = cn("inline-flex items-center text-foreground", className);
  if (variant === "ring") {
    return (
      <span className={base}>
        <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Busk Map">
          {title}
          <Ring core="fill-signal-text" />
        </svg>
      </span>
    );
  }
  if (variant === "mark") {
    return (
      <span className={base}>
        <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Busk Map">
          {title}
          <Tile bare={bare} />
        </svg>
      </span>
    );
  }
  if (variant === "wordmark") {
    return (
      <span className={base}>
        <svg height={size} viewBox="0 0 322 52" role="img" aria-label="Busk Map">
          {title}
          <Word />
        </svg>
      </span>
    );
  }
  return (
    <span className={base}>
      <svg height={size} viewBox="2 0 256 48" role="img" aria-label="Busk Map" className="w-auto">
        {title}
        <Tile bare={bare} />
        <g transform="translate(58 8) scale(0.615)">
          <Word />
        </g>
      </svg>
    </span>
  );
}

/** Qloo's wordmark: letters in the current colour, the bar in Qloo's purple. */
export function QlooWordmark({ width = 48, className }: { width?: number; className?: string }) {
  return (
    <svg role="img" aria-label="Qloo" viewBox="0 0 64 22" width={width} height={Math.round((width * 22) / 64)} fill="none" className={cn("block", className)}>
      <path d="M29.34 0H25.67V22H29.34V0Z" fill="currentColor" />
      <path d="M22 11C22 4.92 17.08 0 11 0C4.92 0 0 4.92 0 11C0 17.08 4.92 22 11 22C13.38 22 15.570 21.24 17.37 19.96L19.41 22L22 19.41L19.96 17.37C21.24 15.57 22 13.37 22 11ZM11 18.33C6.96 18.33 3.67 15.04 3.67 11C3.67 6.96 6.96 3.67 11 3.67C15.04 3.67 18.33 6.96 18.33 11C18.33 12.36 17.95 13.63 17.31 14.72L13.68 11.09L11.09 13.68L14.72 17.31C13.63 17.96 12.36 18.33 11 18.33Z" fill="currentColor" />
      <path d="M56.67 11C58.69 11 60.34 12.64 60.34 14.67C60.34 16.7 58.7 18.34 56.67 18.34C54.64 18.34 53 16.7 53 14.67C53 12.64 54.64 11 56.67 11ZM56.67 7.33C52.62 7.33 49.34 10.61 49.34 14.66C49.34 18.71 52.62 21.99 56.67 21.99C60.72 21.99 64 18.71 64 14.66C64 10.61 60.72 7.33 56.67 7.33Z" fill="currentColor" />
      <path d="M40.17 11C42.19 11 43.84 12.64 43.84 14.67C43.84 16.7 42.2 18.34 40.17 18.34C38.14 18.34 36.5 16.7 36.5 14.67C36.5 12.64 38.14 11 40.17 11ZM40.17 7.33C36.12 7.33 32.84 10.61 32.84 14.66C32.84 18.71 36.12 21.99 40.17 21.99C44.22 21.99 47.5 18.71 47.5 14.66C47.5 10.61 44.22 7.33 40.17 7.33Z" fill="currentColor" />
      <path d="M56.67 0H40.17V3.67H56.67V0Z" fill="#8C8CC8" />
    </svg>
  );
}
