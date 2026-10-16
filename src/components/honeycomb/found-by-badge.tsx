import { Database, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { modelName, type ExplanationsModel } from "@/lib/sources";

/**
 * Where a pitch came from, when it matters: "Found by Claude" when the model added it to Busk Map's scores, and "From the data"
 * on every row of a plan the model did not write (it ran out of time, or no artist matched), so the page never credits Claude
 * with a plan it did not make.
 */
export function FoundByBadge({ origin, written, model }: { origin: string; written: boolean; model: ExplanationsModel | null }) {
  if (!written)
    return (
      <Badge variant="neutral" title="Ranked from Busk Map's scores, with standard reasons">
        <Database aria-hidden="true" />
        From the data
      </Badge>
    );
  if (origin !== "agent") return null;
  return (
    <Badge variant="neutral" title={`${modelName(model, "start")} suggested this spot, and Busk Map scored it`}>
      <Search aria-hidden="true" />
      Found by {modelName(model)}
    </Badge>
  );
}
