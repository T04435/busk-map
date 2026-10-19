import type { Metadata } from "next";
import Link from "next/link";
import { StatusCard } from "@/components/status/status-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found · Busk Map",
  description: "This page doesn't exist.",
};

/** Any unmatched URL (and notFound() outside /p/<id>). Next returns a 404 status for it. */
export default function NotFound() {
  return (
    <StatusCard
      testId="site-not-found"
      numeral="404"
      title="No pitch here"
      description="This page doesn't exist. It may have moved, or the link may be incomplete."
      actions={
        <>
          <Button asChild>
            <Link href="/">Go to Busk Map home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/plan?example=acoustic">Try an example plan</Link>
          </Button>
        </>
      }
    />
  );
}
