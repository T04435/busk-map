import type { MouseEventHandler } from "react";
import { cn } from "cn";
import { Icon, type IconName } from "@/components/honeycomb/icon";

const variants = {
  ghost: "border-0 bg-transparent hover:bg-muted",
  outline: "border-2 border-rule bg-card hover:bg-muted",
  primary: "border-2 border-rule bg-primary text-primary-foreground",
} as const;

/**
 * A square icon-only button: 44px, or 36px (`sm`) in dense rows. The `label` is required: it is the accessible name and
 * the tooltip. Square, one focus ring, no glyph characters: the icon is always a DS Icon.
 */
export function IconAction({
  icon,
  label,
  onClick,
  pressed,
  disabled,
  variant = "ghost",
  size = "md",
  className,
}: {
  icon: IconName;
  /** aria-label and title. */
  label: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** Makes it a toggle (aria-pressed). */
  pressed?: boolean;
  disabled?: boolean;
  variant?: keyof typeof variants;
  /** md = 44px, sm = 36px (dense rows). */
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <button
      type="button"
      data-slot="icon-action"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex flex-none cursor-pointer items-center justify-center rounded-none text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "size-9" : "size-11",
        variants[variant],
        pressed && variant === "ghost" && "bg-muted",
        className,
      )}
    >
      <Icon name={icon} size={size === "sm" ? 16 : 18} />
    </button>
  );
}
