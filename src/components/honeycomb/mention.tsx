import { Fragment, type ReactNode } from "react";
import { cn } from "cn";
import { HexCell, initialsOf } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import type { Mention as MentionData, RichText as RichTextData } from "@/lib/mention";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:shadow-none";

/**
 * A mention inside a sentence (user feedback U05/U08): an artist is a small hex photo (initials without one) plus the name in
 * brand orange, bold; a song is a small cover cell plus the title; a source is its partner logo (name in the label only).
 * `href` makes it a plain link to Spotify (no icon, opens in a new tab); without it, it is not a link. It wraps with the text
 * and never truncates. An artist with a `score` shows an xs ScoreCell after the name.
 */
export function Mention({ mention, className }: { mention: MentionData; className?: string }) {
  if (mention.kind === "source") return <SourceLogo source={mention.source} height={14} className={cn("mx-0.5 align-[-2px]", className)} />;
  const isArtist = mention.kind === "artist";
  const name = isArtist ? mention.name : mention.title;
  const href = mention.href || undefined;
  const [first, ...rest] = name.split(" ");
  const label = (
    <span className="font-bold text-signal-text [overflow-wrap:anywhere]">
      {/* The cell and the name's first word never part, so the cell is not left alone at a line end. */}
      <span className="whitespace-nowrap">
        <HexCell size={18} tone="media" image={mention.image} fontSize={7} className="mr-1 align-[-5px]">
          {isArtist ? initialsOf(name) : <Icon name="music" size={9} />}
        </HexCell>
        {first}
      </span>
      {rest.length > 0 ? ` ${rest.join(" ")}` : null}
    </span>
  );
  const score = isArtist && mention.score != null ? <ScoreCell value={mention.score} size="xs" label="Weight" className="ml-1 align-middle" /> : null;
  return (
    <span data-slot="mention" data-kind={mention.kind} className={cn("inline", className)}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className={cn("text-inherit underline-offset-4 hover:underline", FOCUS)}>
          {label}
          <span className="sr-only"> (opens Spotify)</span>
        </a>
      ) : (
        label
      )}
      {score}
    </span>
  );
}

/** Renders a sentence of plain strings and mentions, inline, in order. A plain string is text as it is. */
export function RichText({ text }: { text: string | RichTextData }): ReactNode {
  if (typeof text === "string") return text;
  return (
    <>
      {text.map((part, i) => (
        <Fragment key={i}>{typeof part === "string" ? part : <Mention mention={part} />}</Fragment>
      ))}
    </>
  );
}

/**
 * A plain sentence plus the artists behind it, as RichText: each artist's name in the sentence becomes its mention in place
 * ("Fans of [Wolfine] and [Residente] love this"); artists the sentence doesn't name follow as "Because [a], [b]". So a reason
 * names each artist once, inline, never as a chip row under the text.
 */
export function mentionArtists(text: string, artists: readonly Extract<MentionData, { kind: "artist" }>[]): RichTextData {
  const named = [...artists].filter((a) => a.name && text.includes(a.name)).sort((a, b) => b.name.length - a.name.length);
  const parts: RichTextData = [];
  const used = new Set<string>();
  if (named.length) {
    const re = new RegExp(`(${named.map((a) => a.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
    for (const piece of text.split(re)) {
      if (!piece) continue;
      const a = named.find((x) => x.name === piece);
      if (a) used.add(a.name);
      parts.push(a ?? piece);
    }
  } else if (text) parts.push(text);
  const rest = artists.filter((a) => !used.has(a.name));
  rest.forEach((a, i) => parts.push(i ? ", " : `${text ? " " : ""}Because `, a));
  return parts;
}
