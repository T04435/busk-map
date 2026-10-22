import type { ReactNode } from "react";
import { cn } from "cn";
import { Icon, type IconName } from "@/components/honeycomb/icon";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import type { MentionSource } from "@/lib/mention";
import { Badge } from "@/components/ui/badge";

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
  source,
  className,
}: {
  children?: ReactNode;
  icon?: IconName;
  tone?: keyof typeof tones;
  /** A data source: the tag is its logo only (Spotify, Last.fm, Qloo), the name in the accessible label. Replaces the words. */
  source?: MentionSource;
  className?: string;
}) {
  if (source) return <SourceLogo source={source} height={14} className={cn("py-0.5", className)} />;
  return (
    <Badge variant="data" data-slot="info-tag" data-tone={tone} className={cn(tones[tone], className)}>
      {icon ? <Icon name={icon} size={12} className="mt-0.5 flex-none" /> : null}
      <span>{children}</span>
    </Badge>
  );
}
