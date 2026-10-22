import { cn } from "cn";

/** The required OpenStreetMap credit (ODbL): shown wherever OSM-derived places show, and in the footer. */
export function OsmCredit({ className }: { className?: string }) {
  return (
    <a
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex min-h-tap items-center font-bold text-foreground underline underline-offset-3 hover:decoration-2", className)}
    >
      © OpenStreetMap contributors
    </a>
  );
}
