import { Badge } from "@/components/ui/badge";

/** Marks a number as an estimate (architecture: honest UI). */
export function EstimateLabel({ children = "Estimate" }: { children?: React.ReactNode }) {
  return (
    <Badge variant="outline" className="font-normal">
      {children}
    </Badge>
  );
}
