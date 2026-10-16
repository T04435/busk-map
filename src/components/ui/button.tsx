import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Honeycomb buttons: square, uppercase, tracked, a 2px border. The orange fill carries a `rule` by day and none at night
// (--fill-rule). Focus: one 2px outline in the ring token (2px gap), never an opacity ring.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-none border-2 border-transparent text-sm font-bold tracking-[0.03em] whitespace-nowrap uppercase transition-colors select-none active:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:opacity-disabled aria-disabled:cursor-not-allowed aria-disabled:opacity-disabled aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "focus-visible:ring-2 focus-visible:ring-ring border-(--fill-rule) bg-primary text-primary-foreground hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--foreground))]",
        outline:
          "focus-visible:ring-2 focus-visible:ring-ring border-input bg-transparent text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        secondary:
          "focus-visible:ring-2 focus-visible:ring-ring border-rule bg-transparent text-secondary-foreground hover:bg-secondary aria-expanded:bg-secondary",
        ghost: "focus-visible:ring-2 focus-visible:ring-ring text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        destructive:
          "focus-visible:ring-2 focus-visible:ring-ring border-destructive bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklab,var(--destructive)_88%,var(--foreground))]",
        // The hero and closing calls to action: a 2px cream edge and a hard offset shadow. The focus ring is an outline 10px out, so the
        // offset shadow stays exactly as it is (B-018); no ring box-shadow competes with it.
        poster:
          "h-16 border-2 border-foreground bg-primary px-9 font-display text-2xl font-extrabold tracking-[0.01em] text-primary-foreground shadow-[6px_6px_0_var(--foreground)] hover:-translate-x-px hover:-translate-y-px hover:bg-[color-mix(in_oklab,var(--primary)_88%,var(--foreground))] hover:shadow-[7px_7px_0_var(--foreground)] focus-visible:outline-3 focus-visible:outline-offset-10 focus-visible:outline-ring focus-visible:outline-solid",
        // A link in a button's clothes: signal-text (never orange text), underlined, sentence case.
        link: "focus-visible:ring-2 focus-visible:ring-ring h-auto min-h-0 border-0 px-0 font-bold tracking-normal text-signal-text normal-case underline underline-offset-4 hover:decoration-2",
      },
      size: {
        default: "h-control gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        // xs and the small icon buttons stay at least 40px where they are tap targets (remove buttons, Learn it).
        xs: "h-10 gap-1.5 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-control-sm gap-1.5 px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-13 gap-2 px-6 text-base",
        icon: "size-control",
        "icon-xs": "size-10 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
