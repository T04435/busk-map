import { cn } from "cn";

export type LogoProps = {
  /** Height in px: 36 in the header, 34 in the footer. */
  size?: number;
  className?: string;
  /** "dark" always uses the dark-ground file (the bluestone header); "auto" picks by theme. */
  ground?: "auto" | "dark";
};

/**
 * THE Busk Map logo, and the only one the app shows (F12, as corrected): the design system's lockup [hex mark][new wordmark],
 * as an image file so the wordmark is clipped to its own box (inline, its M rises above the viewBox and shows the old tall M).
 * The dark or light file is picked by theme. One accessible name, "Busk Map". Every place that shows the logo uses this
 * component. The mark alone is only the favicon and the app icon.
 */
export function Logo({ size = 34, className, ground = "auto" }: LogoProps) {
  const width = Math.round((size * 239.04) / 48);
  return (
    <span className={cn("inline-flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/busk-map-lockup-dark.svg" alt="Busk Map" width={width} height={size} className={ground === "dark" ? "block" : "hidden dark:block"} style={{ height: size, width: "auto" }} />
      {ground === "auto" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/busk-map-lockup-light.svg" alt="Busk Map" width={width} height={size} className="block dark:hidden" style={{ height: size, width: "auto" }} />
      ) : null}
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
      // At least 24 px tall (WCAG 2.5.8 target size): the small wordmarks in credit lines are under that on their own.
      className={cn("inline-flex min-h-6 min-w-6 items-center", className)}
    >
      <QlooSvg width={width} className={wordmarkClassName ?? "text-foreground"} />
    </a>
  );
}

/** Kept for callers that say "link": the Qloo wordmark is always the link. */
export const QlooLink = QlooWordmark;
