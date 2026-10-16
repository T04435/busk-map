import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { QLOO_TEST_LABEL } from "@/lib/sources";

export type PlanAlertKind = "limit" | "qloo-down" | "agent-error" | "fallback" | "no-pitch" | "test-data" | "bad-link";

/**
 * Every plan-level alert the page shows, with its copy, so the states never drift. Titles and bodies are the app's own
 * words (they already match the design). Qloo down has no re-run button: a reload tries again.
 */
export function PlanAlert({
  kind,
  message,
  note,
  rulesHref,
  testId,
  children,
}: {
  kind: PlanAlertKind;
  /** The server's or parser's own sentence (limit, bad-link, agent-error). */
  message?: string;
  note?: string;
  rulesHref?: string;
  testId?: string;
  children?: ReactNode;
}) {
  const home = (label: string) => (
    <Button asChild variant="outline" className="mt-2">
      <Link href="/">{label}</Link>
    </Button>
  );
  switch (kind) {
    case "limit":
      return (
        <Alert variant="warning" icon={<Clock className="size-5" />} data-testid={testId ?? "fresh-limit"}>
          <AlertTitle>Plan limit reached</AlertTitle>
          <AlertDescription>
            <p>{message}</p>
            {home("Back to Busk Map home")}
          </AlertDescription>
        </Alert>
      );
    case "qloo-down":
      return (
        <Alert variant="error" data-testid={testId ?? "qloo-down"}>
          <AlertTitle>Qloo is unavailable</AlertTitle>
          <AlertDescription>Busk Map needs Qloo&apos;s taste data to plan. Please try again in a few minutes.</AlertDescription>
        </Alert>
      );
    case "agent-error":
      return (
        <Alert variant="error" data-testid={testId ?? "agent-error"}>
          <AlertTitle>The agent could not finish</AlertTitle>
          <AlertDescription>{children ?? message}</AlertDescription>
        </Alert>
      );
    case "fallback":
      return (
        <Alert variant="estimate" data-testid={testId ?? "agent-fallback"}>
          <AlertTitle>Shown: the engine&apos;s plan</AlertTitle>
          <AlertDescription>{note ?? message}</AlertDescription>
        </Alert>
      );
    case "no-pitch":
      return (
        <Alert variant="warning" data-testid={testId ?? "no-pitch"}>
          <AlertTitle>No pitch to recommend</AlertTitle>
          <AlertDescription>
            The busking rules or the data for this slot left no candidate pitches.{" "}
            <a href={rulesHref} target="_blank" rel="noreferrer" className="inline-flex min-h-tap items-center">
              Read the council&apos;s busking rules
            </a>
            .
          </AlertDescription>
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
