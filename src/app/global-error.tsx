"use client";

import "./globals.css";
import { ErrorCard } from "@/components/status/error-card";

/**
 * Errors in the root layout, which error.tsx can't catch. Replaces the layout, so it renders its own
 * document. No providers, fonts or app state: only the global styles and the shared card.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <title>Something went wrong · Busk Map</title>
        <ErrorCard error={error} onRetry={retry} />
      </body>
    </html>
  );
}
