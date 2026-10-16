"use client";

import "./globals.css";
import { ErrorCard } from "@/components/status/error-card";

const SYSTEM = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
/** The brand faces come from the root layout, which this replaces: every family token becomes the system stack (the title stays bold caps). */
const FONT_VARS = { "--font-display": SYSTEM, "--font-sans": SYSTEM, "--font-mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" } as React.CSSProperties;

/**
 * Errors in the root layout, which error.tsx can't catch. Replaces the layout, so it renders its own
 * document. No providers, brand fonts or app state: only the global styles and the shared card, set in the system
 * font stack (the brand faces are loaded by the root layout, which this replaces).
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-AU" className="h-full antialiased" style={{ fontFamily: SYSTEM, ...FONT_VARS }}>
      <body className="flex min-h-full flex-col">
        <title>Something went wrong · Busk Map</title>
        <ErrorCard error={error} onRetry={retry} plainLinks />
      </body>
    </html>
  );
}
