"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusCard } from "@/components/status/status-card";
import { Button } from "@/components/ui/button";

export const ERROR_TITLE = "Something went wrong";
export const ERROR_DESCRIPTION = "Something went wrong while setting up the pitch. Try again, or start over from the home page.";
/** The root layout failed: the whole app, not one pitch. */
export const GLOBAL_ERROR_DESCRIPTION = "Something went wrong loading Busk Map. Try again, or start over from the home page.";

/**
 * Shared by error.tsx and global-error.tsx. Never shows error.message or a stack: only the digest,
 * which matches the server log line. The server logger is server-only, so this logs with console.error.
 */
export function ErrorCard({ error, onRetry, plainLinks = false }: { error: Error & { digest?: string }; onRetry: () => void; /** A plain <a> for "Go home": global-error.tsx has no router or layout to lean on. */ plainLinks?: boolean }) {
  useEffect(() => {
    console.error("Busk Map render error", { digest: error.digest, name: error.name });
  }, [error]);

  // global-error.tsx replaces the root layout and has no router: a plain link is the self-contained way home.
  // eslint-disable-next-line @next/next/no-html-link-for-pages
  const home = plainLinks ? <a href="/">Go home</a> : <Link href="/">Go home</Link>;

  return (
    <StatusCard
      testId="route-error"
      tone="error"
      title={ERROR_TITLE}
      description={plainLinks ? GLOBAL_ERROR_DESCRIPTION : ERROR_DESCRIPTION}
      footnote={error.digest ? <>Reference: <code>{error.digest}</code></> : null}
      actions={
        <>
          <Button onClick={() => onRetry()}>Try again</Button>
          <Button asChild variant="outline">
            {home}
          </Button>
        </>
      }
    />
  );
}
