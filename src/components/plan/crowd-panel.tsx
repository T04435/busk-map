import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/lib/plan-schema";

/** What this city's crowd likes, given the performer's taste (Qloo explainability). */
export function CrowdPanel({ crowd, resolved }: { crowd: Plan["crowd"]; resolved: Plan["resolvedArtists"] }) {
  const unmatched = resolved.filter((r) => !r.matched).map((r) => r.query);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Who this crowd likes</CardTitle>
        <CardDescription>Aggregate taste from Qloo, never data about individuals.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {crowd.localArtists.length === 0 ? (
          <p className="text-muted-foreground">No crowd data for this plan.</p>
        ) : (
          <ul className="space-y-1">
            {crowd.localArtists.map((a) => (
              <li key={a.name}>
                <span className="font-medium">{a.name}</span>
                {a.affinity !== null && <span className="text-muted-foreground"> · affinity {Math.round(a.affinity * 100)}/100</span>}
                {a.because.length > 0 && <span className="block text-muted-foreground">Because you sound like {a.because.join(" and ")}</span>}
              </li>
            ))}
          </ul>
        )}
        {unmatched.length > 0 && <p className="text-muted-foreground">Not found in Qloo: {unmatched.join(", ")}.</p>}
      </CardContent>
    </Card>
  );
}
