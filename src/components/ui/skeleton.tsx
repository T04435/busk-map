import { cn } from "cn"

// The slow shimmer (.bm-skeleton in globals.css) is the only gradient allowed; it stops under reduced motion.
// shape="cell" is for anything that loads into a honeycomb cell (rank, score).
function Skeleton({
  className,
  shape = "box",
  ...props
}: React.ComponentProps<"div"> & { shape?: "box" | "cell" }) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bm-skeleton rounded-none", shape === "cell" && "[clip-path:polygon(50%_0,100%_25%,100%_75%,50%_100%,0_75%,0_25%)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
