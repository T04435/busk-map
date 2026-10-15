import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EstimateLabel } from "@/components/plan/estimate-label";
import type { PlanPitch } from "@/lib/plan-schema";
import { venueDetail } from "@/lib/venue";

const FACTOR_LABELS: Record<keyof PlanPitch["factors"], string> = {
  taste: "Taste affinity (Qloo)",
  footfall: "Foot traffic for the slot",
  places: "Busy places open nearby",
  events: "Event crowds",
  discovery: "Discovery bonus (hidden gem)",
  weatherPenalty: "Weather penalty",
};

const pct = (n: number | null) => (n === null ? "no data" : `${Math.round(n * 100)}/100`);

const KIND_LABEL: Record<PlanPitch["kind"], string> = {
  designated: "Council-designated site",
  "public-space": "Public space, general permit",
  footpath: "Footpath, general permit",
};

const FOOTFALL_NOTE: Record<NonNullable<PlanPitch["footfallSource"]>, string> = {
  sensor: "",
  "nearby-sensors": " (estimated from nearby sensors)",
  "qloo-popularity": " (estimated from Qloo area popularity)",
};

/** "Hidden gem" or "Usual spot", for the card and the pitch list. */
export function DiscoveryBadge({ discovery, className }: { discovery: PlanPitch["discovery"]; className?: string }) {
  if (discovery === "hidden-gem") return <Badge className={className}>Hidden gem</Badge>;
  if (discovery === "usual") return <Badge variant="outline" className={className}>Usual spot</Badge>;
  return null;
}

export function PitchCard({ pitch, rank }: { pitch: PlanPitch; rank: number }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>Pitch {rank}</CardDescription>
        <CardTitle className="flex flex-wrap items-baseline justify-between gap-2">
          <h2>{pitch.name}</h2>
          <span aria-label={`Score ${pitch.score} out of 100`}>{pitch.score}/100</span>
        </CardTitle>
        <div className="flex flex-wrap gap-1">
          <DiscoveryBadge discovery={pitch.discovery} />
          <Badge variant="secondary">{KIND_LABEL[pitch.kind]}</Badge>
          {pitch.amplification === "unamplified-zone" && <Badge variant="outline">Unamplified only</Badge>}
          <Badge variant="outline">{pitch.whySource === "ai" ? "Explained by Claude" : "Explanation from the data"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <section aria-label="Why this crowd">
          <h3 className="font-medium">Why this crowd</h3>
          <p className="text-muted-foreground">{pitch.why}</p>
          {pitch.origin === "taste" && pitch.cellRank !== null && (
            <p className="mt-1 text-xs text-muted-foreground">
              Found from the data: Qloo taste cell no. {pitch.cellRank} for your artists, snapped to the nearest public space.
            </p>
          )}
          {pitch.discovery === "hidden-gem" && (
            <p className="mt-1 text-xs text-muted-foreground">Hidden gem: a strong taste fit away from Melbourne&apos;s well-known busking spots.</p>
          )}
          {pitch.discovery === "usual" && pitch.usualSpot && (
            <p className="mt-1 text-xs text-muted-foreground">Usual spot: at {pitch.usualSpot}, where buskers already go.</p>
          )}
        </section>

        <section aria-label="Score breakdown">
          <h3 className="font-medium">Score breakdown</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1">
            {(Object.keys(FACTOR_LABELS) as (keyof PlanPitch["factors"])[]).map((key) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">
                  {FACTOR_LABELS[key]}
                  {key === "footfall" && pitch.footfallSource ? FOOTFALL_NOTE[pitch.footfallSource] : ""}
                  {key === "footfall" && pitch.discovery === "usual" ? " (shared with other buskers)" : ""}
                </dt>
                <dd>{key === "discovery" && pitch.factors.discovery === 0 ? "none" : pct(pitch.factors[key])}</dd>
              </div>
            ))}
            {pitch.tip && (
              <div className="contents" data-testid="tip-bonus">
                <dt className="text-muted-foreground">
                  Your tip log: {pitch.tip.sessions} session{pitch.tip.sessions === 1 ? "" : "s"} here at ${Math.round(pitch.tip.perHour)}/h, against your $
                  {Math.round(pitch.tip.averagePerHour)}/h average
                </dt>
                <dd>{pitch.tip.points > 0 ? `+${pitch.tip.points}` : "none"}</dd>
              </div>
            )}
          </dl>
          {pitch.tip && (
            <p className="mt-1 text-xs text-muted-foreground">
              {pitch.tip.points > 0
                ? `You earned ${Math.round(pitch.tip.lift * 100)}% more per hour here than on average, so the score includes a personal bonus (at most +5).`
                : "You earned less here than on average. Tips never lower a score; this pitch just gets no bonus."}
            </p>
          )}
        </section>

        {(pitch.evidence.sensor || pitch.evidence.places.length > 0 || pitch.evidence.events.length > 0) && (
          <section aria-label="Evidence" className="space-y-2">
            <h3 className="font-medium">Evidence</h3>
            {pitch.evidence.sensor && (
              <p className="flex flex-wrap items-center gap-2">
                {pitch.footfallSource === "nearby-sensors"
                  ? `Roughly ${pitch.evidence.sensor.avgHourly.toLocaleString("en-AU")} people an hour on recent same weekdays, from sensors nearby (nearest: ${pitch.evidence.sensor.name})`
                  : `About ${pitch.evidence.sensor.avgHourly.toLocaleString("en-AU")} people an hour at ${pitch.evidence.sensor.name} on recent same weekdays`}{" "}
                <EstimateLabel />
              </p>
            )}
            {pitch.evidence.places.length > 0 && (
              <ul className="list-disc pl-5">
                {pitch.evidence.places.map((place) => (
                  <li key={place.name}>
                    {place.name}, {place.distanceM} m {place.open === "open" ? "(open in your slot)" : "(hours not confirmed)"}
                    {venueDetail(place) && <span className="block text-muted-foreground">Qloo: {venueDetail(place)}</span>}
                  </li>
                ))}
              </ul>
            )}
            {pitch.evidence.events.map((event, i) => (
              // The same show can run twice in a slot (e.g. 6 pm and 8:30 pm sessions): the name alone isn't a unique key.
              <p key={`${event.name}-${event.localTime}-${i}`} className="flex flex-wrap items-center gap-2">
                {event.name} at {event.venue}: crowd {event.moment === "leaving" ? "leaves" : "arrives"} around {event.localTime}
                {event.endEstimated && event.moment === "leaving" && <EstimateLabel>Estimated end</EstimateLabel>}
                {event.tasteMatch && (
                  <span className="text-muted-foreground" data-testid="event-taste-match">
                    Qloo: {event.tasteMatch.artist}&apos;s fans match your taste {Math.round(event.tasteMatch.affinity * 100)}/100
                  </span>
                )}
                {event.url && (
                  <a className="underline" href={event.url} target="_blank" rel="noreferrer">
                    Ticketmaster
                  </a>
                )}
              </p>
            ))}
          </section>
        )}

        <section aria-label="Rules" className="space-y-1">
          <h3 className="font-medium">Rules to check</h3>
          <p className="text-muted-foreground">{pitch.rules}</p>
          {pitch.cautions.length > 0 && (
            <ul className="list-disc pl-5">
              {pitch.cautions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          {pitch.rulesUrl && (
            <a className="underline" href={pitch.rulesUrl} target="_blank" rel="noreferrer">
              Site rules and contact
            </a>
          )}
          <p className="text-muted-foreground">Busk Map never confirms a pitch is legal. Check your permit conditions on the day.</p>
        </section>
      </CardContent>
    </Card>
  );
}
