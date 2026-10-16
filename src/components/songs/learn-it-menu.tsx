"use client";

import { ChevronDownIcon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { learnLinks } from "@/lib/learn-links";

/** "Learn it": karaoke, chords and lyrics searches on other sites, each in a new tab. Never lyrics in the app. */
export function LearnItMenu({ title, artist }: { title: string; artist: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="xs" className="group min-h-10 uppercase" aria-label={`Learn it: ${title}`}>
          Learn it
          <ChevronDownIcon data-icon="inline-end" aria-hidden className="transition-transform group-data-[state=open]:rotate-180" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="max-w-60">
          <span className="block truncate font-display text-lg leading-tight font-extrabold uppercase">{title}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">{artist}</span>
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
