import { cn } from "cn";

/** Big numbers with a label each, in a ruled strip. `tone="qloo"` for Qloo facts (neutral slate numerals; the labels name Qloo in words). */
export function StatStrip({ items, tone, label, className }: { items: { n: string | number; label: string }[]; tone?: "qloo"; label?: string; className?: string }) {
  return (
    <ul
      aria-label={label}
      data-slot="stat-strip"
      className={cn(
        "m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-0.5 border-2 p-0",
        tone === "qloo" ? "border-slate bg-border" : "border-rule bg-rule",
        className
      )}
    >
      {items.map((item, i) => (
        <li key={i} className="flex flex-col gap-1 bg-card p-4 text-card-foreground">
          <b className={cn("font-display text-[clamp(36px,8vw,48px)] leading-none font-extrabold whitespace-nowrap", tone === "qloo" && "text-slate")}>{item.n}</b>
          <span className="text-sm leading-5">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
