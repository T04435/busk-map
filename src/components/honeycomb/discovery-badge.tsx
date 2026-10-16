import { Diamond, Dot } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type Discovery = "hidden-gem" | "usual" | "none" | null | undefined;

/**
 * "Hidden gem" (a strong taste fit off the usual busking circuit: a honey badge with a diamond) or "Usual pitch" (a
 * well-known busking hotspot: quiet slate). Never a warning. The brand words list names both; there is no "spot".
 */
export function DiscoveryBadge({ discovery, className }: { discovery: Discovery; className?: string }) {
  if (discovery === "hidden-gem") {
    return (
      <Badge variant="gem" title="A strong taste fit off the usual busking circuit" className={className}>
        <Diamond aria-hidden="true" />
        Hidden gem
      </Badge>
    );
  }
  if (discovery === "usual") {
    return (
      <Badge variant="usual" title="A well-known busking hotspot" className={className}>
        <Dot aria-hidden="true" />
        Usual pitch
      </Badge>
    );
  }
  return null;
}
