import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { Icon, type IconName } from "@/components/honeycomb/icon"

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
        // A signal Busk Map has not checked for this city (rules outside Melbourne): the quiet tone on a dashed rule.
        unchecked: `[--tone:var(--muted-foreground)] ${tint} border-dashed`,
        destructive: `[--tone:var(--destructive)] ${tint}`,
        // shadcn names, kept for the app's existing callers.
        default: "border-(--fill-rule) bg-primary text-primary-foreground [a]:hover:bg-primary/90",
        secondary: `[--tone:var(--muted-foreground)] ${tint} [a]:hover:bg-secondary`,
        outline: `[--tone:var(--muted-foreground)] ${tint} [a]:hover:bg-secondary`,
        ghost: "border-transparent text-foreground hover:bg-secondary",
        link: "border-transparent text-signal-text normal-case underline underline-offset-4 hover:decoration-2",
        // The entity tags, each the DS look exactly (they reset the badge box above; no colour transition, as the DS tags).
        // Chip: a square sans label on a 1.5px rule (Chip).
        chip: "transition-none min-h-8 max-w-none shrink justify-start gap-1.5 border-rule bg-transparent px-3 py-1 text-left font-sans text-sm leading-5 font-normal tracking-normal normal-case",
        // Song: mono caps on a 2px rule over the card (SongTag).
        song: "transition-none min-h-0 max-w-none shrink justify-start gap-1.5 border-2 border-rule bg-card px-1.5 text-left text-foreground [&>svg]:size-3!",
        // Data: mono, medium, sentence case, a hairline whose colour is the tone's; the words wrap, never truncate (InfoTag).
        data: "transition-none min-h-0 shrink items-start justify-start gap-1.5 border bg-transparent px-1.5 text-left font-medium tracking-normal normal-case [overflow-wrap:anywhere] [&>svg]:size-3!",
        // Step tags (the research feeds): the text's own box with an inset 1.5px rule. `tag` keeps the text colour.
        tag: "transition-none min-h-0 shrink border-0 px-1.5 py-[3px] leading-[normal] shadow-[inset_0_0_0_1.5px_var(--rule)]",
        "tag-quiet": "transition-none min-h-0 shrink border-0 px-1.5 py-[3px] leading-[normal] text-muted-foreground shadow-[inset_0_0_0_1.5px_var(--border)]",
        "tag-failed": "transition-none min-h-0 shrink border-0 px-1.5 py-[3px] leading-[normal] text-destructive shadow-[inset_0_0_0_1.5px_var(--destructive)]",
        // On: the orange fill. `tag-live` alone, `tag-on` with the rule (the feed's Live).
        "tag-live": "transition-none min-h-0 shrink border-0 bg-primary px-1.5 py-[3px] leading-[normal] text-primary-foreground",
        "tag-on": "transition-none min-h-0 shrink border-0 bg-primary px-1.5 py-[3px] leading-[normal] text-primary-foreground shadow-[inset_0_0_0_1.5px_var(--rule)]",
        // The forecast's "Your slot": the orange fill on its 2px day rule.
        "tag-slot": "transition-none min-h-0 shrink border-0 bg-primary px-1.5 py-[3px] leading-[14px] whitespace-nowrap text-primary-foreground shadow-[inset_0_0_0_2px_var(--fill-rule)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

// DS tone icons (TONE_ICON): the glyph a tone carries when the caller passes none. A caller's own svg hides it (CSS below).
const TONE_ICON: Partial<Record<NonNullable<VariantProps<typeof badgeVariants>["variant"]>, IconName>> = {
  event: "ticket",
  weather: "cloud",
  legal: "legal",
  restricted: "restricted",
  destructive: "warning",
}

function Badge({
  className,
  variant = "neutral",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"
  const toneIcon = asChild ? undefined : TONE_ICON[variant ?? "neutral"]

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), toneIcon && "[&:has(>svg)>[data-tone-icon]]:hidden", className)}
      {...props}
    >
      {toneIcon ? <span data-tone-icon="" className="contents"><Icon name={toneIcon} size={14} strokeWidth={2.5} /></span> : null}
      {children}
    </Comp>
  )
}

export { Badge, badgeVariants }
