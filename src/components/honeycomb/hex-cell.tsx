import { useId, type CSSProperties, type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "cn";
import { CellImage } from "@/components/honeycomb/cell-image";

/** A pointy-top hexagon filling its box: width : height = 0.866 : 1. */
const HEX_POINTS = "50,0 100,25 100,75 50,100 0,75 0,25";
/** Height of a cell for a given width. */
export function cellHeight(width: number): number {
  return Math.round((width / 0.866) * 10) / 10;
}

/**
 * The honeycomb cell as an SVG that fills its parent. The stroke is drawn inside the edge (clipped, doubled), so a
 * cell never grows past its box. Colours come from --hex-fill, --hex-stroke, --hex-sw and --hex-dash on an ancestor.
 */
export function Hex({ className }: { className?: string }) {
  const id = `hx${useId().replace(/:/g, "")}`;
  return (
    <svg
      className={cn("pointer-events-none absolute inset-0 size-full overflow-visible", className)}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={id}>
          <polygon points={HEX_POINTS} />
        </clipPath>
      </defs>
      <polygon
        points={HEX_POINTS}
        clipPath={`url(#${id})`}
        vectorEffect="non-scaling-stroke"
        className="fill-[var(--hex-fill,var(--card))] stroke-[var(--hex-stroke,var(--rule))] [stroke-dasharray:var(--hex-dash,none)] [stroke-width:var(--hex-sw,4px)]"
      />
    </svg>
  );
}

const cellVariants = cva("relative inline-grid flex-none place-items-center font-display font-extrabold leading-none", {
  variants: {
    tone: {
      default: "text-foreground",
      // Orange fill: a 2px rule by day, none at night.
      primary: "text-primary-foreground [--hex-fill:var(--primary)] [--hex-stroke:var(--fill-rule)]",
      muted: "text-muted-foreground [--hex-fill:var(--muted)] [--hex-stroke:var(--border)]",
      error: "text-destructive [--hex-stroke:var(--destructive)]",
      dashed: "text-muted-foreground [--hex-fill:transparent] [--hex-stroke:var(--input)] [--hex-dash:5_4]",
    },
    lift: {
      none: "",
      primary: "drop-shadow-[4px_4px_0_var(--primary)]",
      error: "drop-shadow-[4px_4px_0_var(--destructive)]",
    },
  },
  defaultVariants: { tone: "default", lift: "none" },
});

export type HexTone = "default" | "primary" | "muted" | "error" | "dashed";

export type HexCellProps = {
  /** Width in px; the height follows (0.866 : 1). */
  size?: number;
  tone?: HexTone;
  /** Lift the cell by a 4px hard offset (empty and error states). */
  lift?: boolean;
  /** A picture, clipped to the cell. Falls back to the children if it fails to load. Spotify images are never sent a referrer. */
  image?: string | null;
  /** Spoken name. Without it the cell is decorative (aria-hidden). */
  label?: string;
  fontSize?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/** One honeycomb cell holds one thing: a person, a song, a score, an icon. */
export function HexCell({ size = 40, tone = "default", lift, image, label, fontSize, className, style, children }: HexCellProps) {
  return (
    <span
      className={cn(cellVariants({ tone, lift: lift ? (tone === "error" ? "error" : "primary") : "none" }), className)}
      style={{ width: size, height: cellHeight(size), fontSize: fontSize ?? Math.round(size * 0.4), ...style }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-slot="hex-cell"
      data-tone={tone}
    >
      {image ? (
        <CellImage src={image} fallback={<><Hex /><span className="relative">{children}</span></>} />
      ) : (
        <>
          <Hex />
          <span className="relative">{children}</span>
        </>
      )}
    </span>
  );
}

/** "Hana Lee" -> "HL". */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
