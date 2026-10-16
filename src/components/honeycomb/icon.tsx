import type { CSSProperties, ReactElement } from "react";
import { cn } from "@/lib/utils";

/**
 * Busk Map's own monoline icons, PORTED 1:1 from the design system (v67, components/Icon in bundle.js).
 * 24-unit grid, 2px stroke, round caps and joins, currentColor. Never reinterpret the paths: if the DS looks wrong, report it.
 * DS icons first. Lucide is a stopgap only, where the DS has no glyph.
 *
 * Spec format, as in the DS: parts joined by "|". "cX,Y,R" is a circle; "F<d>" is a filled path (no stroke); anything else is a stroked path.
 */
export const ICON_PATHS = {
  "pin": "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z|c12,9.5,2.5",
  "clock": "c12,12,9|M12 7v5l3 2",
  "calendar": "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5Z|M4 10h16|M8 3v4|M16 3v4",
  "music": "M9 18V5l11-2v13|c6.5,18,2.5|c17.5,16,2.5",
  "users": "c9,8,3.5|M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6|M16 4.5a3.5 3.5 0 0 1 0 7|M18 14c1.9.7 3 2.9 3 6",
  "footfall": "M3 20h18|M6 20v-5|M10 20V9|M14 20v-8|M18 20V5",
  "rain": "M7 15a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.5 8a3.5 3.5 0 0 1-.5 7Z|M8 18l-1 2.5|M12 18l-1 2.5|M16 18l-1 2.5",
  "sun": "c12,12,4|M12 2.5v2|M12 19.5v2|M2.5 12h2|M19.5 12h2|M5.3 5.3l1.4 1.4|M17.3 17.3l1.4 1.4|M5.3 18.7l1.4-1.4|M17.3 6.7l1.4-1.4",
  "cloud": "M7 18a4.5 4.5 0 1 1 1.2-8.8A5.5 5.5 0 0 1 18.5 11a3.5 3.5 0 0 1-.5 7Z",
  "wind": "M3 9h11a3 3 0 1 0-3-3|M3 15h15a3 3 0 1 1-3 3|M3 12h7",
  "ticket": "M3 8a2 2 0 0 0 0 4v0a2 2 0 0 1 0 4v2h18v-2a2 2 0 0 1 0-4v0a2 2 0 0 0 0-4V6H3Z|M14 6v12",
  "legal": "M12 3l7 3v5.5c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V6Z|M8.5 12l2.5 2.5 4.5-5",
  "restricted": "c12,12,9|M5.6 5.6l12.8 12.8",
  "gem": "M12 2.5l9.5 9.5-9.5 9.5L2.5 12Z",
  "usual": "c12,12,8|c12,12,2.5",
  "info": "c12,12,9|M12 11v5.5|M12 7.6v.1",
  "warning": "M12 3.5l9.5 16.5h-19Z|M12 10v4.5|M12 17.4v.1",
  "alert-circle": "c12,12,9|M12 7.5v5.5|M12 16.4v.1",
  "help-circle": "c12,12,9|M9.6 9.3a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.2-2.5 3.7|M12 17v.1",
  "check": "M5 12.5l4.5 4.5L19 7.5",
  "x": "M6 6l12 12|M18 6L6 18",
  "minus": "M6 12h12",
  "pencil": "M4 20h4L19 9l-4-4L4 16Z|M13.5 6.5l4 4",
  "chevron-down": "M6 9l6 6 6-6",
  "chevron-up": "M6 15l6-6 6 6",
  "chevron-right": "M9 6l6 6-6 6",
  "arrow-right": "M4 12h16|M14 6l6 6-6 6",
  "arrow-left": "M20 12H4|M10 6l-6 6 6 6",
  "plus": "M12 5v14|M5 12h14",
  "search": "c11,11,6.5|M16 16l4.5 4.5",
  "share": "M12 15V3.5|M7.5 8L12 3.5 16.5 8|M5 12v7.5h14V12",
  "copy": "M8 8h11v12H8Z|M5 16V4h11",
  "download": "M12 3.5V15|M7.5 10.5L12 15l4.5-4.5|M5 19.5h14",
  "database": "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3Z|M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6|M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  "coins": "M3 7c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3Z|M3 7v4c0 1.7 3.1 3 7 3|M3 11v4c0 1.7 3.1 3 7 3|M10 15c0-1.7 3.1-3 7-3s4 .6 4 1.5V19c0 1.1-1.8 2-4 2s-7-1.3-7-3Z",
  "map": "M3 6l6-2.5 6 2.5 6-2.5v14.5L15 20.5 9 18l-6 2.5Z|M9 3.5V18|M15 6v14.5",
  "list": "M9 6h11|M9 12h11|M9 18h11|M4 6h.1|M4 12h.1|M4 18h.1",
  "offline": "M3 3l18 18|M8.5 16.5a5 5 0 0 1 7 0|M5 13a10 10 0 0 1 4.5-2.6|M14.5 10.4A10 10 0 0 1 19 13|M2 9.5a14.5 14.5 0 0 1 4.3-2.8|M11 5.6A14.5 14.5 0 0 1 22 9.5|M12 20h.1",
  "trending": "M3 17l6-6 4 4 8-8|M15 7h6v6",
  "volume": "M4 9.5h3.5L12 5.5v13l-4.5-4H4Z|M16 9a4 4 0 0 1 0 6|M18.5 6.5a7.5 7.5 0 0 1 0 11",
  "volume-off": "M4 9.5h3.5L12 5.5v13l-4.5-4H4Z|M16 9.5l5 5|M21 9.5l-5 5",
  "external": "M14 4h6v6|M20 4l-9 9|M18 14v6H4V6h6",
  "play": "FM8 5.2v13.6a1 1 0 0 0 1.5.86l10.7-6.8a1 1 0 0 0 0-1.72L9.5 4.34A1 1 0 0 0 8 5.2z",
  "github": "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4|M9 18c-4.51 2-5-2-7-2",
  "home": "M4 11l8-7 8 7v9H4Z|M10 20v-5h4v5",
  "week": "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5Z|M4 10h16|M8 3v4|M16 3v4|M8 14h2|M14 14h2|M8 17h2",
  "trash": "M4 7h16|M9 7V4h6v3|M6 7l1 13h10l1-13",
  "loader": "M12 3a9 9 0 1 1-9 9",
  "spotify": "c12,12,9|M7.5 9.5c3-1 6.5-.7 9 .8|M8 12.8c2.4-.7 5-.5 7 .7|M8.6 15.8c1.8-.5 3.7-.3 5.2.5",
  "learn": "M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5Z|M13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13Z",
  "store": "M4 9l1.5-5h13L20 9|M4 9h16v2a2.7 2.7 0 0 1-5.3 0 2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 4 11Z|M5.5 13v7h13v-7",
  "train": "M6 4h12a1 1 0 0 1 1 1v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Z|M5 10h14|M8.5 14.5h.1|M15.5 14.5h.1|M8 18l-2 3|M16 18l2 3",
  "dots": "M5 12h.1|M12 12h.1|M19 12h.1",
  "refresh": "M20 12a8 8 0 1 1-2.6-5.9|M20 4v5h-5",
} as const;

export type IconName = keyof typeof ICON_PATHS;

/** Every DS icon name, in the DS's order (`Icon.names` in the DS). */
export const ICON_NAMES = Object.keys(ICON_PATHS) as IconName[];

export type IconProps = {
  name: IconName;
  /** Pixel size of the square svg. Default 20. */
  size?: number;
  /** Gives the icon role="img" and this accessible name. Leave it out when a visible word sits next to it (almost always). */
  label?: string;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
};

function parts(spec: string): ReactElement[] {
  return spec.split("|").map((d, i) => {
    if (d.charAt(0) === "c") {
      const [cx, cy, r] = d.slice(1).split(",");
      return <circle key={i} cx={cx} cy={cy} r={r} />;
    }
    if (d.charAt(0) === "F") return <path key={i} d={d.slice(1)} fill="currentColor" stroke="none" />;
    return <path key={i} d={d} />;
  });
}

export function Icon({ name, size = 20, label, strokeWidth, className, style }: IconProps) {
  // The DS falls back to "info" for an unknown name.
  const spec: string = ICON_PATHS[name] ?? ICON_PATHS.info;
  return (
    <svg
      className={cn("bm-icon inline-block shrink-0 align-middle", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth || 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={style}
    >
      {parts(spec)}
    </svg>
  );
}
Icon.names = ICON_NAMES;
