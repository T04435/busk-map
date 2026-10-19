import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { QlooWordmark } from "@/components/honeycomb/logo";
import { Button } from "@/components/ui/button";

/**
 * Qloo is down (board Q03): no plan without taste data. The error cell, the reason in plain words, Qloo's status, and Try again,
 * which plans again with the same act, day and permit. (Not counting that run against the limit is server logic, on dev/core.)
 */
export function QlooDownPanel({ onRetry, busy = false }: { onRetry: () => void; busy?: boolean }) {
  return (
    <section data-testid="qloo-down" role="alert" className="grid justify-items-center gap-3 border-2 border-rule bg-card px-4 py-8 text-center">
      <HexCell size={64} tone="error" lift>
        <Icon name="offline" size={28} />
      </HexCell>
      <h2 className="m-0 font-display text-xl leading-[26px] font-extrabold tracking-[0.01em] uppercase">No plan without taste data</h2>
      <p className="m-0 max-w-[36ch] text-[15px] leading-[22px] text-muted-foreground">
        Everything you entered is kept: try again in a minute.
      </p>
      <span className="inline-flex flex-wrap items-center justify-center gap-2">
        <QlooWordmark width={52} />
        <DataStatusBadge status="unavailable" label="Unavailable" reason="not responding" />
      </span>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={onRetry} disabled={busy} data-testid="qloo-retry">
          <Icon name="refresh" size={16} />
          Try again
        </Button>
      </div>
    </section>
  );
}
