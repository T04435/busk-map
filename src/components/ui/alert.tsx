import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { CircleAlert, Info, TriangleAlert, CircleHelp } from "lucide-react"
import { cn } from "cn"

// Honeycomb alerts: the tone colours the icon and the 2px border only. The text stays `foreground` on a faint tint of
// `card`, so it always reads. `default` is the info tone and `destructive` the error tone (shadcn's names, kept).
const alertVariants = cva(
  "group/alert relative flex w-full items-start gap-3 rounded-none border-2 border-(--tone) bg-[color-mix(in_oklab,var(--tone)_8%,var(--card))] px-4 py-3 text-left text-sm text-foreground has-data-[slot=alert-action]:pr-18",
  {
    variants: {
      variant: {
        default: "[--tone:var(--foreground)]",
        info: "[--tone:var(--foreground)]",
        warning: "[--tone:var(--pitch-restricted)]",
        destructive: "[--tone:var(--destructive)]",
        error: "[--tone:var(--destructive)]",
        estimate: "[--tone:var(--estimate)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const TONE_ICON = {
  default: Info,
  info: Info,
  warning: TriangleAlert,
  destructive: CircleAlert,
  error: CircleAlert,
  estimate: CircleHelp,
} as const

function Alert({
  className,
  variant,
  icon,
  children,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof alertVariants> & {
    /** Replace the tone's icon, or `false` for none. The icon is decoration: the title says what happened. */
    icon?: React.ReactNode | false
  }) {
  const Icon = TONE_ICON[variant ?? "default"]
  return (
    <div
      data-slot="alert"
      data-variant={variant ?? "default"}
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {icon === false ? null : (
        <span aria-hidden="true" className="mt-0.5 flex-none text-(--tone)">
          {icon ?? <Icon className="size-5" />}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-0.5">{children}</div>
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-mono text-xs leading-5 font-bold tracking-[0.05em] uppercase [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:decoration-2",
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
        "text-sm text-pretty text-foreground [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:decoration-2 [&_p:not(:last-child)]:mb-4",
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
