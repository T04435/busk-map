import type { ReactNode } from "react";
import { Icon } from "@/components/honeycomb/icon";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EXAMPLES } from "@/lib/examples";
import { QLOO_TEST_LABEL } from "@/lib/sources";

export type PlanAlertKind = "limit" | "agent-error" | "fallback" | "test-data" | "bad-link";

/**
 * Every plan-level alert the page shows, with its copy, so the states never drift. Titles and bodies are the app's own
 * words (they already match the design).
 */
export function PlanAlert({
  kind,
  message,
  budget = false,
  note,
  testId,
  children,
}: {
  kind: PlanAlertKind;
  /** The server's or parser's own sentence (limit, bad-link, agent-error). */
  message?: string;
  /** kind "limit" only: today's Qloo budget is spent, so the example plans are offered. */
  budget?: boolean;
  note?: string;
  testId?: string;
  children?: ReactNode;
}) {
  switch (kind) {
    case "limit":
      return (
        <div className="flex max-w-[760px] flex-col gap-3" data-testid={testId ?? (budget ? "qloo-budget" : "fresh-limit")}>
          <Alert variant="warning" icon={<Icon name="clock" size={20} />}>
            <AlertTitle>{budget ? "Taste data paused for today" : "Plan limit reached"}</AlertTitle>
            <AlertDescription>
              <p>{message}</p>
            </AlertDescription>
          </Alert>
          {children}
          {budget && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Example plans" data-testid="budget-examples">
              {EXAMPLES.map((e) => (
                <li key={e.id}>
                  <Link className="inline-flex min-h-tap items-center font-bold text-signal-text underline underline-offset-3 hover:decoration-2" href={`/plan?example=${e.id}`}>
                    {e.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="inline-flex min-h-tap items-center self-start font-bold text-signal-text underline underline-offset-3 hover:decoration-2" href="/">
            Back to Busk Map home
          </Link>
        </div>
      );
    case "agent-error":
      return (
        <Alert variant="error" data-testid={testId ?? "agent-error"}>
          <AlertTitle>The Hive could not finish</AlertTitle>
          <AlertDescription>{children ?? message}</AlertDescription>
        </Alert>
      );
    case "fallback":
      return (
        <Alert variant="estimate" data-testid={testId ?? "agent-fallback"}>
          <AlertTitle>Planned from the data alone</AlertTitle>
          <AlertDescription>{note ?? message}</AlertDescription>
        </Alert>
      );
    case "test-data":
      return (
        <Alert variant="estimate" data-testid={testId ?? "test-data"}>
          <AlertTitle>{QLOO_TEST_LABEL}</AlertTitle>
          <AlertDescription>
            The taste map, crowd and trends here come from a local mock of the Qloo API, not from Qloo.
          </AlertDescription>
        </Alert>
      );
    case "bad-link":
      return (
        <Alert variant="error" data-testid={testId ?? "bad-link"}>
          <AlertTitle>We couldn&apos;t read this plan</AlertTitle>
          <AlertDescription>
            {message}{" "}
            <Link href="/">Start again</Link>.
          </AlertDescription>
        </Alert>
      );
  }
}
