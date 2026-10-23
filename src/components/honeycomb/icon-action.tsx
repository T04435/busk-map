import type { ComponentProps } from "react";
import { Icon, type IconName } from "@/components/honeycomb/icon";
import { Button } from "@/components/ui/button";

const variants = { ghost: "icon-ghost", outline: "icon-outline", primary: "icon-primary" } as const;

/**
 * A square icon-only button (shadcn Button): 44px, or 36px (`sm`) in dense rows. The `label` is required: it is the accessible
 * name (no tooltip). Square, one focus ring, no glyph characters: the icon is always a DS Icon.
 */
export function IconAction({
  icon,
  label,
  pressed,
  variant = "ghost",
  size = "md",
  className,
  ...rest
}: Omit<ComponentProps<"button">, "children" | "aria-label" | "title"> & {
  icon: IconName;
  /** The accessible name (no tooltip: the user wants none). */
  label: string;
  /** Makes it a toggle (aria-pressed). */
  pressed?: boolean;
  variant?: keyof typeof variants;
  /** md = 44px, sm = 36px (dense rows). */
  size?: "md" | "sm";
}) {
  return (
    <Button
      type="button"
      {...rest}
      data-slot="icon-action"
      variant={variants[variant]}
      size={size === "sm" ? "icon-dense" : "icon"}
      aria-label={label}
      aria-pressed={pressed}
      className={className}
    >
      <Icon name={icon} size={size === "sm" ? 16 : 18} className={size === "sm" ? "size-4" : "size-[18px]"} />
    </Button>
  );
}
