import { cn } from "cn";
import { HexCell, type HexTone } from "@/components/honeycomb/hex-cell";
import { Icon, type IconName } from "@/components/honeycomb/icon";
import { Loader } from "@/components/honeycomb/loader";

export type StepCellStatus = "pending" | "running" | "done" | "failed" | "skipped";

const TONE: Record<StepCellStatus, HexTone> = { pending: "dashed", running: "primary", done: "default", failed: "error", skipped: "muted" };
const WORDS: Record<StepCellStatus, string> = { pending: "waiting", running: "working", done: "done", failed: "didn't work", skipped: "skipped" };

/**
 * One research step's cell (user feedback U09): every step has its own DS icon, and the state is the cell's look, so finished
 * steps no longer all show the waiting "...".
 * - pending: a dashed hex, the step's icon muted;
 * - running: the orange hex with the working Loader;
 * - done: the solid hex with the orange outline, the step's icon, and a small check cell on the corner;
 * - failed: the error hex with a warning icon;
 * - skipped: the muted hex with the step's icon, quiet.
 * `label` is the spoken name ("Step 3, done" by default from `n`); `icon` is any existing DS icon name.
 */
export function StepCell({
  status,
  icon,
  size = 40,
  n,
  label,
  className,
}: {
  status: StepCellStatus;
  icon: IconName;
  size?: number;
  /** The step number, for the default spoken label. */
  n?: number;
  /** Overrides the spoken label. */
  label?: string;
  className?: string;
}) {
  const glyph = Math.round(size * 0.45);
  const spoken = label ?? `${n != null ? `Step ${n}, ` : ""}${WORDS[status]}`;
  return (
    <span data-slot="step-cell" data-status={status} className={cn("relative inline-flex flex-none", className)}>
      <HexCell size={size} tone={TONE[status]} label={spoken} className={cn(status === "pending" && "opacity-90")}>
        {status === "running" ? (
          <Loader size={glyph} label="Working" />
        ) : status === "failed" ? (
          <Icon name="warning" size={glyph} />
        ) : (
          <Icon name={icon} size={glyph} />
        )}
      </HexCell>
      {status === "done" && size >= 32 ? (
        <HexCell size={Math.round(size * 0.4)} tone="primary" className="absolute -right-1 -bottom-0.5">
          <Icon name="check" size={Math.round(size * 0.24)} strokeWidth={3} />
        </HexCell>
      ) : null}
    </span>
  );
}
