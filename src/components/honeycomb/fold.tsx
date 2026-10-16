"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Icon } from "@/components/honeycomb/icon";
import { cn } from "cn";

/**
 * A Disclosure that animates: the box shrinks and fades instead of vanishing. The research feed uses it on phones and
 * tablets, where it folds under the busk once the plan has arrived (`arriving` plays that fold once, on mount; nothing
 * under reduced motion). Closed content is not rendered (B-219); while it folds shut it is `inert` and `aria-hidden`, so keyboards, readers and tests never see
 * it mid-fold. A button with `aria-expanded`, so the label is clickable text like the native <details> it replaces.
 */
export function Fold({
  label,
  count,
  arriving = false,
  defaultOpen = false,
  children,
  className,
  ...props
}: { label: ReactNode; count?: number; arriving?: boolean; /** Opens already unfolded (the DS Disclosure `open`). */ defaultOpen?: boolean; children: ReactNode; className?: string } & Omit<React.ComponentProps<"div">, "children">) {
  const [open, setOpen] = useState(defaultOpen);
  // B-219: closed content isn't rendered. It stays mounted only while open, and while the box folds shut (or plays the
  // arriving fold); it unmounts when that transition or animation ends, and at once under reduced motion.
  const [mounted, setMounted] = useState(arriving || defaultOpen);
  const id = useId();
  const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Under reduced motion the arriving fold doesn't play, so no animationend comes: unmount on the first frame instead.
  useEffect(() => {
    if (!arriving) return;
    const f = requestAnimationFrame(() => {
      if (reduced()) setMounted(false);
    });
    return () => cancelAnimationFrame(f);
  }, [arriving]);
  const toggle = () => {
    if (open) {
      setOpen(false);
      if (reduced()) setMounted(false);
    } else {
      setMounted(true);
      setOpen(true);
    }
  };
  const settle = (e: React.SyntheticEvent) => {
    if (e.target === e.currentTarget && !open) setMounted(false);
  };
  return (
    <div data-slot="fold" data-state={open ? "open" : "closed"} className={cn("border-2 border-rule bg-card", className)} {...props}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className="flex min-h-tap w-full cursor-pointer items-center justify-between gap-3 px-4 text-left font-bold select-none focus-visible:outline-offset-[-4px]"
      >
        <span>
          {label}
          {count != null ? <span className="font-mono font-normal text-muted-foreground">{` (${count})`}</span> : null}
        </span>
        <Icon name="chevron-down" size={20} className={cn("transition-transform motion-reduce:transition-none", open && "rotate-180")} />
      </button>
      <div
        id={id}
        inert={!open}
        aria-hidden={!open}
        onTransitionEnd={settle}
        onAnimationEnd={settle}
        className={cn("grid transition-[grid-template-rows,opacity] duration-300 motion-reduce:transition-none", open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0", !open && arriving && mounted && "hc-fold-arrive")}
      >
        <div className="min-h-0 overflow-hidden">
          {mounted ? <div className="border-t border-border p-4">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}
