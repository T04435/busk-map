import type { ComponentProps, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";

const iconSlot = (icon: ReactNode) => (icon ? <span aria-hidden="true" className="[&>svg]:size-4">{icon}</span> : null);

/** A square chip. With `selected` it is a toggle (`aria-pressed`, shadcn Toggle) and inverts when on; without, a plain label (shadcn Badge). */
export function Chip({
  icon,
  selected,
  className,
  children,
  ...props
}: Omit<ComponentProps<"button">, "children"> & { icon?: ReactNode; selected?: boolean; children: ReactNode }) {
  if (selected === undefined && !props.onClick) {
    return (
      <Badge variant="chip" data-slot="chip" className={className}>
        {iconSlot(icon)}
        {children}
      </Badge>
    );
  }
  return (
    <Toggle variant="chip" data-slot="chip" pressed={Boolean(selected)} className={className} {...props}>
      {iconSlot(icon)}
      {children}
    </Toggle>
  );
}
