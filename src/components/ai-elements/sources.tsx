"use client";

// AI Elements Sources (registry @ai-elements/sources), restyled for Busk Map: no prose colour or size of its own (the caller's
// type), the DS icons instead of lucide, no enter/exit animation, and Source takes a className. Busk Map ships it open
// (defaultOpen): the data credits (OSM, Open-Meteo, Qloo, Spotify, Last.fm) must stay visible.
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/honeycomb/icon";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export type SourcesProps = ComponentProps<typeof Collapsible>;

export const Sources = ({ className, ...props }: SourcesProps) => (
  <Collapsible
    data-slot="sources"
    className={cn("not-prose", className)}
    {...props}
  />
);

export type SourcesTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  count: number;
};

export const SourcesTrigger = ({
  className,
  count,
  children,
  ...props
}: SourcesTriggerProps) => (
  <CollapsibleTrigger
    data-slot="sources-trigger"
    className={cn("flex items-center gap-2", className)}
    {...props}
  >
    {children ?? (
      <>
        <span className="font-medium">Used {count} sources</span>
        <Icon name="chevron-down" size={16} />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourcesContentProps = ComponentProps<typeof CollapsibleContent>;

export const SourcesContent = ({
  className,
  ...props
}: SourcesContentProps) => (
  <CollapsibleContent
    data-slot="sources-content"
    className={cn("outline-none", className)}
    {...props}
  />
);

export type SourceProps = ComponentProps<"a">;

export const Source = ({ href, title, children, className, ...props }: SourceProps) => (
  <a
    data-slot="source"
    className={cn("inline-flex items-center gap-2", className)}
    href={href}
    rel="noreferrer"
    target="_blank"
    {...props}
  >
    {children ?? (
      <>
        <Icon name="external" size={16} />
        <span className="block font-medium">{title}</span>
      </>
    )}
  </a>
);
