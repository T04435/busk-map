import type { ReactNode } from "react";
import { Icon } from "@/components/honeycomb/icon";
import { cn } from "cn";

/**
 * A labelled row that opens to show more: "Other scored pitches (25)", "Data returned", "Every check (13)".
 * A native <details>, so keyboard and screen readers behave natively. The chevron turns when open; the count is mono.
 */
export function Disclosure({
  label,
  count,
  open,
  children,
  className,
  ...props
}: { label: ReactNode; count?: number; open?: boolean; children: ReactNode; className?: string } & Omit<React.ComponentProps<"details">, "children" | "open">) {
  return (
    <details data-slot="disclosure" className={cn("group/disclosure border-2 border-rule bg-card", className)} open={open} {...props}>
      <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-4 font-bold select-none [&::-webkit-details-marker]:hidden">
        <span>
          {label}
          {count != null ? <span className="font-mono font-normal text-muted-foreground">{` (${count})`}</span> : null}
        </span>
        <Icon name="chevron-down" size={20} className="transition-transform group-open/disclosure:rotate-180" />
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}
