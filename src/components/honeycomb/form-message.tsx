import type { ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { cn } from "cn";

export type FormMessageTone = "note" | "error" | "success";

/**
 * The line under a field or form: a note while something loads, an error that names the field it is about, or a
 * success. An error carries a warning icon and bold text (never colour alone). Errors are `role="alert"` unless
 * `alert={false}`: use that when a separate Alert already announces the same error, so it is read once.
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
  const role = tone === "error" ? ((alert ?? true) ? "alert" : undefined) : tone === "success" ? "status" : alert ? "status" : undefined;
  return (
    <p
      id={id}
      role={role}
      data-slot="form-message"
      data-tone={tone}
      className={cn(
        "m-0 flex items-start gap-1.5 text-sm leading-5",
        tone === "error" ? "font-bold text-destructive" : tone === "success" ? "text-foreground" : "text-muted-foreground",
        className
      )}
    >
      {tone === "error" ? <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
      {tone === "success" ? <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
      <span>{children}</span>
    </p>
  );
}
