"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Toggle as TogglePrimitive } from "radix-ui"

// The shadcn toggle look (default, outline) and the Busk Map looks that reuse a toggle's behaviour: `button` is the Button's
// outline look that turns into its orange fill when on (the genre picks), `chip` is the Chip (sentence case on a 1.5px rule,
// inverted when on). Each variant carries its whole look, so `chip` and `button` match their components exactly.
const shadcnLook =
  "gap-1.5 border-2 border-rule text-sm font-bold tracking-[0.03em] whitespace-nowrap uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ring hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-disabled aria-invalid:border-destructive aria-pressed:bg-foreground aria-pressed:text-background data-[state=on]:border-foreground data-[state=on]:bg-foreground data-[state=on]:text-background [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

const toggleVariants = cva(
  "group/toggle inline-flex items-center rounded-none",
  {
    variants: {
      variant: {
        default: `justify-center bg-transparent ${shadcnLook}`,
        outline: `justify-center border-input bg-transparent ${shadcnLook}`,
        button:
          "shrink-0 justify-center border-2 border-input bg-transparent text-sm font-bold tracking-[0.03em] whitespace-nowrap text-foreground uppercase transition-colors select-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus-visible:ring-0 active:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:opacity-disabled aria-invalid:border-destructive data-[state=on]:border-(--fill-rule) data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary-hover [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        chip: "min-h-10 cursor-pointer gap-1.5 border-[1.5px] border-rule bg-transparent px-3 py-1 font-sans text-sm leading-5 hover:bg-secondary aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:font-bold aria-pressed:text-background",
      },
      size: {
        default:
          "h-control min-w-control px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        sm: "h-control-sm min-w-control-sm px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-13 min-w-13 px-6 text-base",
        // The Button's own sm (no minimum width): the `button` toggles sit beside Buttons.
        "button-sm": "h-control-sm gap-1.5 px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = variant === "chip" ? null : "default",
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
