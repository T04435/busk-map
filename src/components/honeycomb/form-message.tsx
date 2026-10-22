import type { ReactNode } from "react";
import { Icon } from "@/components/honeycomb/icon";
import { cn } from "cn";
import { FieldDescription, FieldError } from "@/components/ui/field";

export type FormMessageTone = "note" | "error" | "success";

/**
 * The line under a field or form: a note while something loads, an error that names the field it is about, or a
 * success. An error carries a warning icon and bold text (never colour alone). Errors are `role="alert"` unless
 * `alert={false}`: use that when a separate Alert already announces the same error, so it is read once. Built on shadcn Field
 * (FieldError for errors, FieldDescription for notes and successes).
 */
export function FormMessage({
  tone = "note",
  id,
  alert,
  children,
  className,
}: {
  tone?: FormMessageTone;
  id?: string;
  /** Announce as an alert (default for errors). Notes say nothing by default; successes are a polite status. */
  alert?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const icon = tone === "error" ? <Icon name="warning" size={16} className="mt-0.5" /> : tone === "success" ? <Icon name="check" size={16} className="mt-0.5" /> : null;
  if (tone === "error")
    return (
      <FieldError id={id} role={(alert ?? true) ? "alert" : undefined} data-slot="form-message" data-tone={tone} className={className}>
        {icon}
        <span>{children}</span>
      </FieldError>
    );
  return (
    <FieldDescription
      id={id}
      role={tone === "success" || alert ? "status" : undefined}
      data-slot="form-message"
      data-tone={tone}
      className={cn(tone === "success" && "text-foreground", className)}
    >
      {icon}
      <span>{children}</span>
    </FieldDescription>
  );
}
