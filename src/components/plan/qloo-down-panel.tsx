import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { QlooWordmark } from "@/components/honeycomb/logo";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

/**
 * Qloo is down (board Q03): no plan without taste data. The error cell, the reason in plain words, Qloo's status, and Try again,
 * which plans again with the same act, day and permit. (Not counting that run against the limit is server logic, on dev/core.)
 */
export function QlooDownPanel({ onRetry, busy = false }: { onRetry: () => void; busy?: boolean }) {
  return (
    <Empty data-testid="qloo-down" role="alert" className="border-2 border-rule bg-card">
      <EmptyMedia>
        <HexCell size={64} tone="error" lift>
          <Icon name="offline" size={28} />
        </HexCell>
      </EmptyMedia>
      <EmptyTitle>
        <h2 className="m-0 font-display text-xl leading-[26px] font-extrabold tracking-[0.01em] uppercase">No plan without taste data</h2>
      </EmptyTitle>
      <EmptyDescription>Everything you entered is kept: try again in a minute.</EmptyDescription>
      <span className="inline-flex flex-wrap items-center justify-center gap-2">
        <QlooWordmark width={52} />
        <DataStatusBadge status="unavailable" label="Unavailable" reason="not responding" />
      </span>
      <EmptyContent>
        <Button type="button" onClick={onRetry} disabled={busy} data-testid="qloo-retry">
          <Icon name="refresh" size={16} />
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}
