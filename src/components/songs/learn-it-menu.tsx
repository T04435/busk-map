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
        <Button type="button" variant="ghost" size="xs" aria-label={`Learn it: ${title}`}>
          Learn it
          <ChevronDownIcon data-icon="inline-end" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="max-w-56 truncate">{title}</DropdownMenuLabel>
        {learnLinks(title, artist).map((link) => (
          <DropdownMenuItem key={link.id} asChild>
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap">
              {link.label}
              <ExternalLinkIcon aria-hidden className="ml-auto" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
