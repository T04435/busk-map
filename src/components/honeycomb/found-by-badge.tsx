import { HIVE_SIZES, HiveMark } from "@/components/honeycomb/hive-mark";
import { Icon } from "@/components/honeycomb/icon";
import { Badge } from "@/components/ui/badge";
import { modelName, type ExplanationsModel } from "@/lib/sources";

/**
 * Where a pitch came from, when it matters: "Found by the Hive", with the Hive's mark at rest (HIVE_SIZES.badge), when the model
 * added it to Busk Map's scores, and "From the data" on every row of a plan the model did not write (it ran out of time, or no
 * artist matched), so the page never credits the Hive with a plan it did not make. The mark pulls in 2px top and bottom so the
 * badge keeps its 24px height.
 */
export function FoundByBadge({ origin, written, model }: { origin: string; written: boolean; model: ExplanationsModel | null }) {
  if (!written)
    return (
      <Badge variant="neutral" title="Ranked from Busk Map's scores, with standard reasons">
        <Icon name="database" size={14} />
        From the data
      </Badge>
    );
  if (origin !== "agent") return null;
  return (
    <Badge variant="neutral" title={`${modelName(model, "start")} suggested this spot, and Busk Map scored it`}>
      <HiveMark size={HIVE_SIZES.badge} decorative className="-my-0.5" />
      Found by {modelName(model)}
    </Badge>
  );
}
