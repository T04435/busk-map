import { cn } from "cn"

/** Pointy-top hexagon points, like Qloo's H3 cells (the DS's hexPts). */
function hexPts(cx0: number, cy0: number, R: number): string {
  const p: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90)
    p.push(`${(cx0 + R * Math.cos(a)).toFixed(2)},${(cy0 + R * Math.sin(a)).toFixed(2)}`)
  }
  return p.join(" ")
}

const CORE = hexPts(24, 24, 6.6)

/**
 * shadcn Spinner, drawing the DS loader: the pitch ring turns, the performer's cell stays put (ported 1:1 from the DS Loader). Add
 * `bm-loader-think` for the slower ring with a breathing core. It stops under reduced motion but stays drawn. `label` names it for
 * screen readers; inside a labelled cell pass `aria-hidden` and let the cell speak.
 */
function Spinner({
  size = 24,
  label,
  className,
  ...props
}: Omit<React.ComponentProps<"span">, "children"> & { size?: number; label?: string }) {
  return (
    <span
      data-slot="spinner"
      className={cn("bm-loader", className)}
      role="status"
      aria-label={label || "Loading"}
      {...props}
    >
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
        <g className="bm-ringspin">
          <path d="M38.554 20.371A15 15 0 1 1 27.629 9.446" fill="none" stroke="currentColor" strokeWidth={6.5} strokeLinecap="round" />
        </g>
        <polygon className="bm-loader-core" points={CORE} fill="currentColor" />
      </svg>
    </span>
  )
}

export { Spinner }
