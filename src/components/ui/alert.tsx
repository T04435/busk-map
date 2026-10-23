import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Icon } from "@/components/honeycomb/icon"
import { cn } from "cn"

// Honeycomb alerts: the tone colours the icon and a 45% tint of it the 2px border (the DS .bm-alert). The text stays `foreground` on a faint tint of
// `card`, so it always reads. `default` is the info tone and `destructive` the error tone (shadcn's names, kept).
const banner =
  "[--tone:currentColor] items-center border-0 py-2.5 [&_b]:font-bold [&_b]:tracking-[0.03em] [&_b]:uppercase [&>[data-slot=alert-icon]]:mt-0 [&>[data-slot=alert-icon]]:flex"

const alertVariants = cva(
  "group/alert relative flex w-full items-start gap-3 rounded-none border-2 border-[color-mix(in_oklab,var(--tone)_45%,var(--card))] bg-[color-mix(in_oklab,var(--tone)_8%,var(--card))] px-4 py-3 text-left text-sm leading-5 text-foreground has-data-[slot=alert-action]:pr-18",
  {
    variants: {
      variant: {
        default: "[--tone:var(--foreground)]",
        info: "[--tone:var(--foreground)]",
        warning: "[--tone:var(--pitch-restricted)]",
        destructive: "[--tone:var(--destructive)]",
        error: "[--tone:var(--destructive)]",
        estimate: "[--tone:var(--estimate)]",
        // Banners (Banner): a full-width strip of context, no border, a solid ground, the icon in the text's colour.
        "banner-info": `${banner} bg-accent text-accent-foreground`,
        // Test data: the hatch, with the words on a solid chip so they stay readable.
        "banner-test": `${banner} bm-hatch-test bg-transparent text-accent-foreground [&_[data-slot=banner-text]]:bg-accent [&_[data-slot=banner-text]]:px-1.5`,
        "banner-offline": `${banner} bg-foreground text-background`,
        "banner-less": `${banner} bg-secondary text-secondary-foreground`,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// DS glyphs per tone (the DS ALERT_ICON table): info, warning, alert-circle for error, help-circle for estimate.
const TONE_ICON = {
  default: () => <Icon name="info" size={20} />,
  info: () => <Icon name="info" size={20} />,
  warning: () => <Icon name="warning" size={20} />,
  destructive: () => <Icon name="alert-circle" size={20} />,
  error: () => <Icon name="alert-circle" size={20} />,
  estimate: () => <Icon name="help-circle" size={20} />,
  "banner-info": () => <Icon name="info" size={18} />,
  "banner-test": () => <Icon name="info" size={18} />,
  "banner-offline": () => <Icon name="offline" size={18} />,
  "banner-less": () => <Icon name="footfall" size={18} />,
} as const

function Alert({
  className,
  variant,
  icon,
  action,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    /** Replace the tone's icon, or `false` for none. The icon is decoration: the title says what happened. */
    icon?: React.ReactNode | false
    /** A control in the flow after the text (a banner's action). */
    action?: React.ReactNode
  }) {
  const ToneIcon = TONE_ICON[variant ?? "default"]
  return (
    <div
      data-slot="alert"
      data-variant={variant ?? "default"}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {icon === false ? null : (
        <span data-slot="alert-icon" aria-hidden="true" className="mt-0.5 flex-none text-(--tone)">
          {icon ?? <ToneIcon />}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-0.5">{children}</div>
      {action}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-mono text-xs leading-[22px] font-bold tracking-[0.05em] uppercase [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:decoration-2",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "mt-0.5 text-sm leading-5 text-pretty text-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:decoration-2 [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute top-2 right-2", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction, alertVariants }
