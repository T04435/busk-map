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
