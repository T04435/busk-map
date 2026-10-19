import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";

const base =
  "inline-flex min-h-8 items-center gap-1.5 rounded-none border-[1.5px] border-rule px-3 py-1 text-sm leading-5 font-sans";

/** A square chip. With `selected` it is a toggle (`aria-pressed`) and inverts when on; without, a plain label. */
export function Chip({
  icon,
  selected,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "children"> & { icon?: ReactNode; selected?: boolean; children: ReactNode }) {
  if (selected === undefined && !props.onClick) {
    return (
      <span data-slot="chip" className={cn(base, "bg-transparent", className)}>
        {icon ? <span aria-hidden="true" className="[&>svg]:size-4">{icon}</span> : null}
        {children}
      </span>
    );
  }
  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={Boolean(selected)}
      className={cn(base, "min-h-10 cursor-pointer bg-transparent hover:bg-secondary aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:font-bold aria-pressed:text-background", className)}
      {...props}
    >
      {icon ? <span aria-hidden="true" className="[&>svg]:size-4">{icon}</span> : null}
      {children}
    </button>
  );
}
