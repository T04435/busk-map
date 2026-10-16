"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusCard } from "@/components/status/status-card";
import { Button } from "@/components/ui/button";

export const ERROR_TITLE = "Something went wrong";
export const ERROR_DESCRIPTION = "Something went wrong while setting up the pitch. Try again, or start over from the home page.";

/**
 * Shared by error.tsx and global-error.tsx. Never shows error.message or a stack: only the digest,
 * which matches the server log line. The server logger is server-only, so this logs with console.error.
 */
export function ErrorCard({ error, onRetry }: { error: Error & { digest?: string }; onRetry: () => void }) {
  useEffect(() => {
    console.error("Busk Map render error", { digest: error.digest, name: error.name });
  }, [error]);

  return (
    <StatusCard
      testId="route-error"
      title={ERROR_TITLE}
      description={ERROR_DESCRIPTION}
      footnote={error.digest ? <>Reference: <code>{error.digest}</code></> : null}
      actions={
        <>
          <Button onClick={() => onRetry()}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </>
      }
    />
  );
}
