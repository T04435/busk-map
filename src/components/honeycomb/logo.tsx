import { cn } from "cn";

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

export type LogoProps = { size?: number; className?: string };

/**
 * The Busk Map logo, and the only one the app shows (F12): the stencil wordmark, drawn in the page's colours. Its letters
 * take `color` (so it reads on paper and on the bluestone header) and the offset takes the signal orange. The lockup and the
 * mark stay in /brand as downloadable assets and are never part of the app's own UI.
 */
export function Logo({ size = 32, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center text-foreground", className)}>
      <svg height={size} viewBox="0 0 322 52" role="img" aria-label="Busk Map" className="w-auto">
        <title>Busk Map</title>
        <Word />
      </svg>
    </span>
  );
}

/** Qloo's wordmark: letters in the current colour, the bar in Qloo's purple. */
function QlooSvg({ width = 48, className }: { width?: number; className?: string }) {
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

/**
 * Every Qloo logo in the app is this link (F09): it goes to qloo.com in a new tab, with rel="noopener noreferrer", and its
 * name says that it opens in a new tab. The logo inside is decorative, so the link has one name, not two.
 */
export function QlooWordmark({ width = 48, className, wordmarkClassName }: { width?: number; className?: string; wordmarkClassName?: string }) {
  return (
    <a
      href="https://qloo.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Qloo (opens qloo.com in a new tab)"
      className={cn("inline-flex items-center", className)}
    >
      <QlooSvg width={width} className={wordmarkClassName ?? "text-foreground"} />
    </a>
  );
}

/** Kept for callers that say "link": the Qloo wordmark is always the link. */
export const QlooLink = QlooWordmark;
