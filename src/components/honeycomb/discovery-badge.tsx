import { Icon } from "@/components/honeycomb/icon";
import { Badge } from "@/components/ui/badge";

export type Discovery = "hidden-gem" | "usual" | "none" | null | undefined;

/**
 * "Hidden gem" (a strong taste fit off the usual busking circuit: a honey badge with a diamond) or "Usual pitch" (a
 * well-known busking hotspot: quiet slate). Never a warning. The brand words list names both; there is no "spot".
 */
export function DiscoveryBadge({ discovery, className }: { discovery: Discovery; className?: string }) {
  if (discovery === "hidden-gem") {
    return (
      <Badge variant="gem" className={className}>
        <Icon name="gem" size={14} strokeWidth={2.5} />
        Hidden gem
      </Badge>
    );
  }
  if (discovery === "usual") {
    return (
      <Badge variant="usual" className={className}>
        <Icon name="usual" size={14} strokeWidth={2.5} />
        Usual pitch
      </Badge>
    );
  }
  return null;
}
