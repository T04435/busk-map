import type { ReactNode } from "react";
import { CircleOff, Footprints, Info, WifiOff } from "lucide-react";
import { cn } from "cn";

export type BannerTone = "info" | "test" | "offline" | "less";

const ICON = { info: Info, test: CircleOff, offline: WifiOff, less: Footprints } as const;
const STYLE: Record<BannerTone, string> = {
  info: "bg-accent text-accent-foreground",
  // Test data: the hatch, with the words on a solid chip so they stay readable.
  test: "bm-hatch-test text-accent-foreground [&>span]:bg-accent [&>span]:px-1.5",
  offline: "bg-foreground text-background",
  less: "bg-secondary text-secondary-foreground",
};

/** A full-width strip of context above a page or form: planning again, test data, offline, less data. A polite status. */
export function Banner({ tone = "info", action, children, className, testId }: { tone?: BannerTone; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  const Icon = ICON[tone];
  return (
    <div role="status" data-slot="banner" data-testid={testId} data-tone={tone} className={cn("flex items-center gap-3 border-2 border-rule px-4 py-2.5 text-sm leading-5", STYLE[tone], className)}>
      <Icon aria-hidden="true" className="size-[18px] shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}
