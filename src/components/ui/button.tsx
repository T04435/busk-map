import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Honeycomb buttons: square, uppercase, tracked, a 2px border. The orange fill carries a `rule` by day and none at night
// (--fill-rule). Focus (B-134): ONE 2px outline in the ring token, 2px OUTSIDE the button, so the ring sits against the page ground
// (6.5:1 at night, 14.8:1 by day), never against the orange fill or the outline button's border (both under 3:1 at night).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-none border-2 border-transparent text-sm font-bold tracking-[0.03em] whitespace-nowrap uppercase transition-colors select-none active:not-aria-[haspopup]:translate-y-px disabled:cursor-not-allowed disabled:opacity-disabled aria-disabled:cursor-not-allowed aria-disabled:opacity-disabled aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus-visible:ring-0 border-(--fill-rule) bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus-visible:ring-0 border-input bg-transparent text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        secondary:
          "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus-visible:ring-0 border-rule bg-transparent text-secondary-foreground hover:bg-secondary aria-expanded:bg-secondary",
        ghost: "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus-visible:ring-0 text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        destructive:
          "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus-visible:ring-0 border-destructive bg-destructive text-destructive-foreground hover:bg-[color-mix(in_oklab,var(--destructive)_88%,var(--foreground))]",
        // The hero and closing calls to action: a 2px cream edge and a hard offset shadow. The focus ring is an outline 10px out, so the
        // offset shadow stays exactly as it is (B-018); no ring box-shadow competes with it.
        poster:
          "border-2 border-foreground bg-primary font-display font-extrabold tracking-[0.01em] text-primary-foreground shadow-[6px_6px_0_var(--foreground)] hover:-translate-x-px hover:-translate-y-px hover:bg-primary-hover hover:shadow-[7px_7px_0_var(--foreground)] focus-visible:outline-3 focus-visible:outline-offset-10 focus-visible:outline-ring focus-visible:outline-solid",
        // A link in a button's clothes: signal-text (never orange text), underlined, sentence case.
        // The square icon-only actions (IconAction): no press nudge, the hover is the muted ground, a ghost turns muted when pressed.
        "icon-ghost":
          "cursor-pointer border-0 bg-transparent text-foreground hover:bg-muted aria-pressed:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none active:not-aria-[haspopup]:translate-y-0 transition-none",
        "icon-outline":
          "cursor-pointer border-2 border-rule bg-card text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none active:not-aria-[haspopup]:translate-y-0 transition-none",
        "icon-primary":
          "cursor-pointer border-2 border-rule bg-primary text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none active:not-aria-[haspopup]:translate-y-0 transition-none",
        link: "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 focus-visible:ring-0 h-auto min-h-0 border-0 px-0 font-bold tracking-normal text-signal-text normal-case underline underline-offset-4 hover:decoration-2",
      },
      size: {
        default: "h-control gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        // xs and the small icon buttons stay at least 40px where they are tap targets (remove buttons, Learn it).
        xs: "h-10 gap-1.5 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-control-sm gap-1.5 px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-13 gap-2 px-6 text-base",
        // The poster variant's own heights (BRAND): the closing call to action is 64px, the hero's 76px. The variant picks "poster" when no size is given.
        poster: "h-16 gap-3 px-9 text-2xl",
        "poster-lg": "h-19 gap-3 px-8 text-[34px] leading-none",
        icon: "size-control",
        "icon-xs": "size-10 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-10",
        "icon-lg": "size-12",
        // 36px, the dense rows' icon actions (--size-control-sm).
        "icon-dense": "size-control-sm",
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
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"
  size ??= variant === "poster" ? "poster" : "default"

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
