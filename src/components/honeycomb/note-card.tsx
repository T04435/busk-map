import type { ReactNode } from "react";
import { cn } from "cn";

/** A short titled note. `variant="next"` is the dashed "Next · not built yet" card: planned work is always labelled. */
export function NoteCard({ title, variant, children, className }: { title?: ReactNode; variant?: "next"; children: ReactNode; className?: string }) {
  const next = variant === "next";
  return (
    <section data-slot="note-card" className={cn("flex flex-col gap-2 border-[1.5px] p-5", next ? "border-dashed border-input bg-transparent" : "border-border bg-card", className)}>
      {/* A heading, so planned work is findable by its label. */}
      {next ? <h3 className="m-0 font-mono text-xs leading-4 font-bold tracking-[0.08em] text-signal-text uppercase">Next · not built yet</h3> : null}
      {title ? <h3 className="m-0 font-display text-[26px] leading-none font-extrabold uppercase">{title}</h3> : null}
      <div className="text-[15px] leading-[23px]">{children}</div>
    </section>
  );
}
