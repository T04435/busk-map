"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/honeycomb/icon";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "cn";

/**
 * A labelled row that opens to show more: "Other scored pitches (25)", "Data returned", "Every check (13)".
 * Built on shadcn Collapsible: the trigger is a button with aria-expanded. The chevron turns when open; the count is mono.
 */
export function Disclosure({
  label,
  count,
  open,
  children,
  className,
  ...props
}: { label: ReactNode; count?: number; /** Starts open. */ open?: boolean; children: ReactNode; className?: string } & Omit<React.ComponentProps<typeof Collapsible>, "children" | "open" | "defaultOpen">) {
  return (
    <Collapsible data-slot="disclosure" defaultOpen={open} className={cn("group/disclosure border-2 border-rule bg-card", className)} {...props}>
      <CollapsibleTrigger className="flex min-h-tap w-full cursor-pointer items-center justify-between gap-3 px-4 text-left font-bold select-none">
        <span>
          {label}
          {count != null ? <span className="font-mono font-normal text-muted-foreground">{` (${count})`}</span> : null}
        </span>
        <Icon name="chevron-down" size={20} className="transition-transform group-data-[state=open]/disclosure:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border p-4">{children}</CollapsibleContent>
    </Collapsible>
  );
}
