"use client";

import { ErrorCard } from "@/components/status/error-card";

/** Runtime errors in a route segment below the root layout. Error boundaries can't export metadata. */
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <title>Something went wrong · Busk Map</title>
      <ErrorCard error={error} onRetry={retry} />
    </>
  );
}
