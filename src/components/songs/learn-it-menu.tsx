"use client";

import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import { IconAction } from "@/components/honeycomb/icon-action";
import { SongRow } from "@/components/honeycomb/song-row";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { learnLinks } from "@/lib/learn-links";

/** "Learn it": karaoke, chords and lyrics searches on other sites, each in a new tab. Never lyrics in the app. */
export function LearnItMenu({ title, artist, iconOnly, size = "md" }: { title: string; artist: string; /** The trigger is an IconAction (SongActions) instead of the text button. */ iconOnly?: boolean; size?: "md" | "sm" }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        {iconOnly ? (
          <IconAction icon="learn" label={`Learn it: ${title}`} size={size} />
        ) : (
        <Button type="button" variant="ghost" size="xs" className="group min-h-10 uppercase" aria-label={`Learn it: ${title}`}>
          Learn it
          <ChevronDownIcon data-icon="inline-end" aria-hidden className="transition-transform group-data-[state=open]:rotate-180" />
        </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <SongRow as="div" interactive={false} size="sm" title={title} artist={artist} className="py-0" />
        </DropdownMenuLabel>
        {learnLinks(title, artist).map((link) => (
          <DropdownMenuItem key={link.id} asChild className="min-h-12">
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap">
              <span className="font-bold">{link.label}</span>
              <ExternalLinkIcon aria-hidden className="ml-auto" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </DropdownMenuItem>
        ))}
        <p className="m-0 px-2 py-1.5 text-xs text-muted-foreground">Busk Map never shows lyrics or chords.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
