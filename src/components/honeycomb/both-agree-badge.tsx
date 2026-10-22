import { Icon } from "@/components/honeycomb/icon";
import { Badge } from "@/components/ui/badge";

/** The plain AI also named this pitch: a confidence signal only, it never changes a score. */
export function BothAgreeBadge() {
  return (
    <Badge variant="neutral">
      <Icon name="check" size={14} strokeWidth={2.5} />
      Both agree
    </Badge>
  );
}
