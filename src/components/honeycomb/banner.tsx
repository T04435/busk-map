import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/honeycomb/icon";
import { cn } from "cn";

export type BannerTone = "info" | "test" | "offline" | "less";

// The DS maps the tones to info / info / offline / footfall (its BANNER_ICON): test data uses the info glyph.
const ICON: Record<BannerTone, IconName> = { info: "info", test: "info", offline: "offline", less: "footfall" };
const STYLE: Record<BannerTone, string> = {
  info: "bg-accent text-accent-foreground",
  // Test data: the hatch, with the words on a solid chip so they stay readable.
  test: "bm-hatch-test text-accent-foreground [&>span]:bg-accent [&>span]:px-1.5",
  offline: "bg-foreground text-background",
  less: "bg-secondary text-secondary-foreground",
};

/** A full-width strip of context above a page or form: planning again, test data, offline, less data. A polite status. */
export function Banner({ tone = "info", action, children, className, testId }: { tone?: BannerTone; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <div role="status" data-slot="banner" data-testid={testId} data-tone={tone} className={cn("flex items-center gap-3 px-4 py-2.5 text-sm leading-5 [&_b]:font-bold [&_b]:tracking-[0.03em] [&_b]:uppercase", STYLE[tone], className)}>
      <Icon name={ICON[tone]} size={18} />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}
