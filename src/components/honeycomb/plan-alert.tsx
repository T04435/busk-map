import type { ReactNode } from "react";
import { Icon } from "@/components/honeycomb/icon";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QLOO_TEST_LABEL } from "@/lib/sources";

export type PlanAlertKind = "limit" | "agent-error" | "fallback" | "test-data" | "bad-link";

/**
 * Every plan-level alert the page shows, with its copy, so the states never drift. Titles and bodies are the app's own
 * words (they already match the design).
 */
export function PlanAlert({
  kind,
  message,
  note,
  testId,
  children,
}: {
  kind: PlanAlertKind;
  /** The server's or parser's own sentence (limit, bad-link, agent-error). */
  message?: string;
  note?: string;
  testId?: string;
  children?: ReactNode;
}) {
  switch (kind) {
    case "limit":
      return (
        <div className="flex max-w-[760px] flex-col gap-3" data-testid={testId ?? "fresh-limit"}>
          <Alert variant="warning" icon={<Icon name="clock" size={20} />}>
            <AlertTitle>Plan limit reached</AlertTitle>
            <AlertDescription>
              <p>{message}</p>
            </AlertDescription>
          </Alert>
          {children}
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
            The taste map, crowd and trends on this page come from Busk Map&apos;s local mock of the Qloo API, which runs when no Qloo key is
            configured (and in tests). It is test data, not Qloo data. Venue and street names are real (OpenStreetMap); foot traffic, busking
            rules, events and weather are real wherever the sources say Live.
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
