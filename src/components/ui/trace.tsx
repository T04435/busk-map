import * as React from "react"
import { cn } from "cn"
import { Slot } from "radix-ui"

// shadcn Trace, restyled for the Honeycomb research feed (U22): every step is a plain line, always shown, never behind a fold,
// so the collapsible parts are left out. No box, no truncation (titles wrap), no colour or opacity per status: the step cell
// says the state. `data-status` (running, error, pending) stays on the line for styling and tests. `asChild` keeps the
// caller's element (the feed's ol, each step's header row, a heading-weight title).

function Trace({ className, asChild = false, ...props }: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div"
  return (
    <Comp
      data-slot="trace"
      className={cn("flex w-full min-w-0 flex-col", className)}
      {...props}
    />
  )
}

function TraceLine({
  className,
  status,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> & {
  status?: "running" | "error" | "pending"
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "span"
  return (
    <Comp
      data-slot="trace-line"
      data-status={status}
      className={cn("flex min-w-0 items-center gap-2", className)}
      {...props}
    />
  )
}

/** The step's cell. Decoration by default; pass `aria-hidden={undefined}` when the cell carries the step's label. */
function TraceIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="trace-icon"
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center [&_svg]:pointer-events-none",
        className
      )}
      {...props}
    />
  )
}

function TraceTitle({ className, asChild = false, ...props }: React.ComponentProps<"span"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  return (
    <Comp
      data-slot="trace-title"
      className={cn("min-w-0", className)}
      {...props}
    />
  )
}

function TraceDescription({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="trace-description"
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Trace, TraceLine, TraceIcon, TraceTitle, TraceDescription }
