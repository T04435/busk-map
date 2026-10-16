import { RotateCw, WifiOff } from "lucide-react";
import { DataStatusBadge } from "@/components/honeycomb/data-status-badge";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { QlooWordmark } from "@/components/honeycomb/logo";
import { Button } from "@/components/ui/button";

/**
 * Qloo is down (board Q03): no plan without taste data. The error cell, the reason in plain words, Qloo's status, and Try again,
 * which plans again with the same act, day and permit. (Not counting that run against the limit is server logic, on dev/core.)
 */
export function QlooDownPanel({ onRetry, busy = false }: { onRetry: () => void; busy?: boolean }) {
  return (
    <section data-testid="qloo-down" role="alert" className="flex flex-col items-start gap-4 border-2 border-rule bg-card p-5 shadow-md md:p-6">
      <HexCell size={64} tone="error" lift>
        <WifiOff aria-hidden="true" className="size-7" />
      </HexCell>
      <h2 className="m-0 font-display text-[clamp(32px,5vw,44px)] leading-[0.95] font-extrabold uppercase">No plan without taste data</h2>
      <p className="m-0 max-w-[52ch] text-base leading-6">
        Busk Map plans around your sound, and Qloo, our taste data source, isn&apos;t answering. Your act, day and permit are kept: try again in a minute.
      </p>
      <span className="inline-flex flex-wrap items-center gap-2">
        <QlooWordmark width={52} />
        <DataStatusBadge status="unavailable" label="Unavailable" reason="not responding" />
      </span>
      <Button type="button" onClick={onRetry} disabled={busy} data-testid="qloo-retry">
        <RotateCw aria-hidden="true" />
        Try again
      </Button>
    </section>
  );
}
