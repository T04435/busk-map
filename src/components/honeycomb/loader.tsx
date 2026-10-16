import { cn } from "cn";

/** A small spinning arc for work in progress. It stops under reduced motion but stays visible. `label` names it for screen readers. */
export function Loader({ size = 18, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3.5}
      strokeLinecap="square"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0 motion-safe:animate-spin", className)}
    >
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
