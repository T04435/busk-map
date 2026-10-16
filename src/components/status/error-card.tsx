"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/honeycomb/icon";
import { StatusCard } from "@/components/status/status-card";
import { Button } from "@/components/ui/button";

export const ERROR_TITLE = "Something went wrong";
export const ERROR_DESCRIPTION = "Something went wrong loading this page. Try again, or start over from the home page.";
/** The root layout failed: the whole app, not one pitch. */
export const GLOBAL_ERROR_DESCRIPTION = "Something went wrong loading Busk Map. Try again, or start over from the home page.";

/**
 * Set when Try again was pressed. The boundary remounts the card when the retry fails again, which resets component state,
 * so this survives the remount: the new card says the retry failed and takes focus (WCAG 2.4.3, 4.1.3; B-229).
 */
let retriedOnce = false;
/** Safety net: if a retry settles without remounting or unmounting the card, stop showing "Trying again". */
const PENDING_MAX_MS = 8000;

/**
 * Shared by error.tsx and global-error.tsx. Never shows error.message or a stack: only the digest,
 * which matches the server log line. The server logger is server-only, so this logs with console.error.
 */
export function ErrorCard({ error, onRetry, plainLinks = false }: { error: Error & { digest?: string }; onRetry: () => void; /** A plain <a> for "Go home": global-error.tsx has no router or layout to lean on. */ plainLinks?: boolean }) {
  const [pending, setPending] = useState(false);
  const [failedAgain] = useState(() => retriedOnce);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // A retry that failed again remounts this card: leave the flag for a later retry, and put focus on the heading.
    if (!failedAgain) return;
    const heading = rootRef.current?.querySelector<HTMLElement>("h1");
    if (!heading) return;
    heading.tabIndex = -1; // set here, not in the markup: focusable by script only, never a tab stop
    heading.focus();
  }, [failedAgain]);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(false), PENDING_MAX_MS);
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    console.error("Busk Map render error", { digest: error.digest, name: error.name });
  }, [error]);

  // global-error.tsx replaces the root layout and has no router: a plain link is the self-contained way home.
  const home = plainLinks ? (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/">
      Go home
      <Icon name="arrow-right" size={16} />
    </a>
  ) : (
    <Link href="/">
      Go home
      <Icon name="arrow-right" size={16} />
    </Link>
  );

  const retry = () => {
    // aria-disabled, not disabled: a disabled button drops keyboard focus to the body.
    if (pending) return;
    retriedOnce = true;
    setPending(true);
    onRetry();
  };

  const reference = error.digest ? <>Reference: <code>{error.digest}</code></> : null;
  const footnote = failedAgain ? (
    <>
      Tried again and it still failed.{reference ? <> </> : null}
      {reference}
    </>
  ) : (
    reference
  );

  return (
    <div ref={rootRef} className="flex flex-1 flex-col">
    <StatusCard
      testId="route-error"
      tone="error"
      title={ERROR_TITLE}
      description={plainLinks ? GLOBAL_ERROR_DESCRIPTION : ERROR_DESCRIPTION}
      footnote={footnote}
      actions={
        <>
          <Button onClick={retry} aria-disabled={pending || undefined} className={pending ? "cursor-progress" : undefined}>
            <Icon name="refresh" size={16} className={pending ? "motion-safe:animate-spin" : undefined} />
            {pending ? "Trying again…" : "Try again"}
          </Button>
          {/* Always in the DOM so the change is announced (WCAG 4.1.3). */}
          <span role="status" className="sr-only">
            {pending ? "Trying again." : ""}
          </span>
          <Button asChild variant="outline">
            {home}
          </Button>
        </>
      }
    />
    </div>
  );
}
