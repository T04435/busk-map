"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

/**
 * A Disclosure that animates: the box shrinks and fades instead of vanishing. The research feed uses it on phones and
 * tablets, where it folds under the busk once the plan has arrived (`arriving` plays that fold once, on mount; nothing
 * under reduced motion). Closed content is `inert` and `aria-hidden` at once, so keyboards, readers and tests never see
 * it mid-fold. A button with `aria-expanded`, so the label is clickable text like the native <details> it replaces.
 */
export function Fold({
  label,
  count,
  arriving = false,
  children,
  className,
  ...props
}: { label: ReactNode; count?: number; arriving?: boolean; children: ReactNode; className?: string } & Omit<React.ComponentProps<"div">, "children">) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div data-slot="fold" data-state={open ? "open" : "closed"} className={cn("border-2 border-rule bg-card", className)} {...props}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-tap w-full cursor-pointer items-center justify-between gap-3 px-4 text-left font-bold select-none focus-visible:outline-offset-[-4px]"
      >
        <span>
          {label}
          {count != null ? <span className="font-mono font-normal text-muted-foreground">{` (${count})`}</span> : null}
        </span>
        <ChevronDown aria-hidden="true" className={cn("size-5 shrink-0 transition-transform motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      <div
        id={id}
        inert={!open}
        aria-hidden={!open}
        className={cn("grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0", !open && arriving && "hc-fold-arrive")}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-border p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
