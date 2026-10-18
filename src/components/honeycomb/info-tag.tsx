import type { ReactNode } from "react";
import { cn } from "cn";
import { Icon, type IconName } from "@/components/honeycomb/icon";

const tones = {
  neutral: "border-input text-foreground",
  // Qloo purple only where Qloo is named ("Qloo", "Crowd by Qloo").
  qloo: "border-qloo text-qloo",
  signal: "border-primary text-signal-text",
} as const;

/**
 * THE data badge: Rising +x, Usual crowd too, a source (Spotify, Last.fm, Qloo), Builds on X, Crowd at X. Mono, square, a
 * hairline outline (a SongTag is bold caps with a heavy rule: this one is data, not a label). The words wrap, never truncate.
 */
export function InfoTag({
  children,
  icon,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  icon?: IconName;
  tone?: keyof typeof tones;
  className?: string;
}) {
  return (
    <span
      data-slot="info-tag"
      data-tone={tone}
      className={cn(
        "inline-flex max-w-full items-start gap-1.5 border bg-transparent px-1.5 py-0.5 font-mono text-[11px] leading-4 font-medium [overflow-wrap:anywhere]",
        tones[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={12} className="mt-0.5 flex-none" /> : null}
      <span>{children}</span>
    </span>
  );
}
