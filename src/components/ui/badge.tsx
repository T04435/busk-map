import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Honeycomb badges: mono caps at the 11px floor, a 1.5px border, square. The text and border are the tone's token on a
// 10% tint of it over `card`; every pair holds 4.5:1 in both themes. A badge always says its meaning in words.
const tint = "border-(--tone) bg-[color-mix(in_oklab,var(--tone)_10%,var(--card))] text-(--tone)"

const badgeVariants = cva(
  "group/badge inline-flex min-h-6 w-fit shrink-0 items-center justify-center gap-1 rounded-none border-[1.5px] px-2 py-0.5 font-mono text-[11px] leading-4 font-bold tracking-[0.06em] uppercase transition-colors max-w-full text-center has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        // Meaning tones (Honeycomb). `neutral` is the quiet default for plain facts.
        neutral: `[--tone:var(--muted-foreground)] ${tint}`,
        // Rare emphasis: an orange fill (with its day rule). Never for Hidden gem: that is `gem`.
        solid: "border-(--fill-rule) bg-primary text-primary-foreground",
        // A strong taste fit off the usual circuit: a honey fill, bluestone text.
        gem: "border-rule bg-honey text-bluestone dark:border-honey",
        usual: `[--tone:var(--usual-spot)] ${tint}`,
        legal: `[--tone:var(--pitch-legal)] ${tint}`,
        restricted: `[--tone:var(--pitch-restricted)] ${tint}`,
        event: `[--tone:var(--event)] ${tint}`,
        weather: `[--tone:var(--weather)] ${tint}`,
        footfall: `[--tone:var(--footfall)] ${tint}`,
        estimate: `[--tone:var(--estimate)] ${tint}`,
        destructive: `[--tone:var(--destructive)] ${tint}`,
        // shadcn names, kept for the app's existing callers.
        default: "border-(--fill-rule) bg-primary text-primary-foreground [a]:hover:bg-primary/90",
        secondary: `[--tone:var(--muted-foreground)] ${tint} [a]:hover:bg-secondary`,
        outline: `[--tone:var(--muted-foreground)] ${tint} [a]:hover:bg-secondary`,
        ghost: "border-transparent text-foreground hover:bg-secondary",
        link: "border-transparent text-signal-text normal-case underline underline-offset-4 hover:decoration-2",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant = "neutral",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
