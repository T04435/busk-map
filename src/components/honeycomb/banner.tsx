import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";

export type BannerTone = "info" | "test" | "offline" | "less";

// The DS maps the tones to info / info / offline / footfall (its BANNER_ICON): the banner-* Alert tones carry the glyphs.
const VARIANT = { info: "banner-info", test: "banner-test", offline: "banner-offline", less: "banner-less" } as const;

/** A full-width strip of context above a page or form: planning again, test data, offline, less data. A polite status (shadcn Alert). */
export function Banner({ tone = "info", action, children, className, testId }: { tone?: BannerTone; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <Alert role="status" variant={VARIANT[tone]} action={action} data-slot="banner" data-testid={testId} data-tone={tone} className={className}>
      <span data-slot="banner-text" className="block min-w-0">
        {children}
      </span>
    </Alert>
  );
}
