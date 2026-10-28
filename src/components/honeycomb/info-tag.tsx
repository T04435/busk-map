import type { ReactNode } from "react";
import { cn } from "cn";
import { Icon, type IconName } from "@/components/honeycomb/icon";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import type { MentionSource } from "@/lib/mention";
import { Badge } from "@/components/ui/badge";
import { FILLED_BY_NOTONQ, viaStandInsLabel } from "@/lib/notonq";

const tones = {
  neutral: "border-input text-foreground",
  // Neutral slate for Qloo-sourced data, always with "Qloo" in the words ("Crowd by Qloo"); never a Qloo colour or logo.
  qloo: "border-slate text-slate",
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
  testId,
}: {
  children?: ReactNode;
  icon?: IconName;
  tone?: keyof typeof tones;
  /** A data source: Spotify and Last.fm as their icon, the name in the accessible label; Qloo as the neutral glyph plus the word "Qloo". Replaces the words. */
  source?: MentionSource;
  className?: string;
  testId?: string;
}) {
  if (source) return <SourceLogo source={source} height={14} className={cn("py-0.5", className)} />;
  return (
    <Badge variant="data" data-slot="info-tag" data-tone={tone} data-testid={testId} className={cn(tones[tone], className)}>
      {icon ? <Icon name={icon} size={12} className="mt-0.5 flex-none" /> : null}
      <span>{children}</span>
    </Badge>
  );
}

/**
 * THE NotOnQ label (lib/notonq.ts), on anything NotOnQ supplied rather than Qloo: "Filled by NotOnQ" on an artist it filled in, or,
 * with `standIns`, "Via NotOnQ stand-ins: A, B" on a result Qloo answered for similar artists it knows. A neutral data tag: NotOnQ's
 * fills are not Qloo data, so never the Qloo tone.
 */
export function NotOnQTag({ standIns, className }: { standIns?: readonly string[]; className?: string }) {
  return (
    <InfoTag className={className} testId={standIns ? "notonq-via" : "notonq-filled"}>
      {standIns ? viaStandInsLabel(standIns) : FILLED_BY_NOTONQ}
    </InfoTag>
  );
}
