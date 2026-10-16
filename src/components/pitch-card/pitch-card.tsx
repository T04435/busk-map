import { Plus } from "lucide-react";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";
import { ScoreRing } from "@/components/honeycomb/score-ring";
import { WithCells } from "@/components/honeycomb/with-cells";
import { EstimateLabel } from "@/components/plan/estimate-label";
import { Badge } from "@/components/ui/badge";
import type { Plan, PlanPitch } from "@/lib/plan-schema";
import { explainedByLabel, type ExplanationsModel } from "@/lib/sources";
import { venueDetail } from "@/lib/venue";

const FACTORS: { key: keyof PlanPitch["factors"]; weight: keyof Plan["weights"]; label: string; color: string }[] = [
  { key: "taste", weight: "taste", label: "Taste affinity (Qloo)", color: "var(--chart-1)" },
  { key: "footfall", weight: "footfall", label: "Foot traffic for the slot", color: "var(--chart-2)" },
  { key: "places", weight: "places", label: "Busy places open nearby", color: "var(--chart-3)" },
  { key: "events", weight: "events", label: "Event crowds", color: "var(--chart-4)" },
  { key: "discovery", weight: "discovery", label: "Discovery bonus (hidden gem)", color: "var(--honey-deep)" },
  { key: "weatherPenalty", weight: "weather", label: "Weather penalty", color: "var(--chart-5)" },
];

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

const money = (n: number) => `A$${Math.round(n)}`;

const H3 = ({ children }: { children: React.ReactNode }) => <h4 className="m-0 font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">{children}</h4>;

/**
 * One pitch, in a fixed order: who (why this crowd), the score and how it adds up, how busy, what is nearby and the rules,
 * with legality last and the never-confirms line. `model`: who wrote an "ai" why, Claude or the test model offline (B-010).
 * `weights` (the plan's) show beside each factor as "× 0.35".
 */
export function PitchCard({ pitch, rank, model = null, weights }: { pitch: PlanPitch; rank: number; model?: ExplanationsModel | null; weights?: Plan["weights"] }) {
  return (
    <article data-testid="pitch-card" aria-label={`Pitch ${rank}: ${pitch.name}`} className="space-y-5 border-2 border-rule bg-card p-4 md:p-6">
      <header className="flex items-start gap-3">
        <RankTile n={rank} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="m-0 font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Pitch {rank}</p>
          <h3 className="m-0 font-display text-[32px] leading-[0.95] font-extrabold break-words uppercase">{pitch.name}</h3>
          <div className="flex flex-wrap gap-2">
            <DiscoveryBadge discovery={pitch.discovery} />
            <Badge variant="neutral">{KIND_LABEL[pitch.kind]}</Badge>
            {pitch.amplification === "unamplified-zone" && <Badge variant="neutral">Unamplified only</Badge>}
            <Badge variant="neutral">{pitch.whySource === "ai" ? explainedByLabel(model) : "Explanation from the data"}</Badge>
          </div>
        </div>
        <HexCell size={72} label={`Score ${pitch.score} out of 100`}>
          <ScoreRing value={pitch.score} size={60} label={false} />
        </HexCell>
      </header>

      <section aria-label="Why this crowd" className="space-y-1">
        <H3>Why this crowd</H3>
        <p className="m-0">
          <WithCells text={pitch.why} />
        </p>
        {pitch.origin === "taste" && pitch.cellRank !== null && (
          <p className="m-0 text-sm text-muted-foreground">Found from the data: Qloo taste cell no. {pitch.cellRank} for your artists, snapped to the nearest public space.</p>
        )}
        {pitch.discovery === "hidden-gem" && <p className="m-0 text-sm text-muted-foreground">Hidden gem: a strong taste fit away from Melbourne&apos;s well-known busking pitches.</p>}
        {pitch.discovery === "usual" && pitch.usualSpot && <p className="m-0 text-sm text-muted-foreground">Usual pitch: at {pitch.usualSpot}, where buskers already go.</p>}
      </section>

      <section aria-label="Score breakdown" className="space-y-3">
        <H3>Score breakdown</H3>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {FACTORS.map(({ key, weight, label, color }) => {
            const v = pitch.factors[key];
            const none = key === "discovery" && v === 0;
            return (
              <li key={key} className="flex items-center gap-3">
                <PercentCell value={v === null || none ? null : v * 100} size={40} label={label} />
                <span className="min-w-0 flex-1 text-sm">
                  <span aria-hidden="true" className="mr-2 inline-block size-2.5" style={{ background: color }} />
                  {label}
                  {key === "footfall" && pitch.footfallSource ? FOOTFALL_NOTE[pitch.footfallSource] : ""}
                  {key === "footfall" && pitch.discovery === "usual" ? " (shared with other buskers)" : ""}
                  {none ? <span className="text-muted-foreground"> · none</span> : null}
                </span>
                {weights ? <span className="font-mono text-xs text-muted-foreground" title="Weight">× {weights[weight].toFixed(2)}</span> : null}
              </li>
            );
          })}
          {pitch.tip && (
            <li data-testid="tip-bonus" className="flex items-center justify-between gap-3 border-t border-border pt-2 text-sm">
              <span className="flex items-center gap-2">
                <Plus aria-hidden="true" className="size-4" />
                Your tip log: {pitch.tip.sessions} session{pitch.tip.sessions === 1 ? "" : "s"} here at {money(pitch.tip.perHour)} an hour, against your {money(pitch.tip.averagePerHour)} an hour average
              </span>
              <b className="font-mono">{pitch.tip.points > 0 ? `+${pitch.tip.points}` : "none"}</b>
            </li>
          )}
        </ul>
        {pitch.tip && (
          <p className="m-0 text-sm text-muted-foreground">
            {pitch.tip.points > 0
              ? `You earned ${Math.round(pitch.tip.lift * 100)}% more per hour here than on average, so the score includes a personal bonus (at most +5).`
              : "You earned less here than on average. Tips never lower a score; this pitch just gets no bonus."}
          </p>
        )}
      </section>

      {(pitch.evidence.sensor || pitch.evidence.places.length > 0 || pitch.evidence.events.length > 0) && (
        <section aria-label="Evidence" className="space-y-3">
          <H3>Evidence</H3>
          {pitch.evidence.sensor && (
            <p className="m-0 flex flex-wrap items-center gap-2">
              {pitch.footfallSource === "nearby-sensors"
                ? `Roughly ${pitch.evidence.sensor.avgHourly.toLocaleString("en-AU")} people an hour on recent same weekdays, from sensors nearby (nearest: ${pitch.evidence.sensor.name})`
                : `About ${pitch.evidence.sensor.avgHourly.toLocaleString("en-AU")} people an hour at ${pitch.evidence.sensor.name} on recent same weekdays`}{" "}
              <EstimateLabel />
            </p>
          )}
          {pitch.evidence.places.length > 0 && (
            <ul className="m-0 list-disc pl-5">
              {pitch.evidence.places.map((place) => (
                <li key={place.name}>
                  {place.name}, {place.distanceM} m {place.open === "open" ? "(open in your slot)" : "(hours not confirmed)"}
                  {venueDetail(place) && <span className="block text-sm text-muted-foreground">Qloo: {venueDetail(place)}</span>}
                </li>
              ))}
            </ul>
          )}
          {pitch.evidence.events.map((event, i) => (
            // The same show can run twice in a slot (e.g. 6 pm and 8:30 pm sessions): the name alone isn't a unique key.
            <div key={`${event.name}-${event.localTime}-${i}`} className="space-y-1">
              <p className="m-0 flex flex-wrap items-center gap-2">
                {event.name} at {event.venue}: crowd {event.moment === "leaving" ? "leaves" : "arrives"} around {event.localTime}
                {event.endEstimated && event.moment === "leaving" && <EstimateLabel tag="Estimated end" />}
                {event.url && (
                  <a className="underline underline-offset-3" href={event.url} target="_blank" rel="noreferrer">
                    Ticketmaster
                  </a>
                )}
              </p>
              {event.tasteMatch && (
                <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground" data-testid="event-taste-match">
                  <PercentCell value={Math.round(event.tasteMatch.affinity * 100)} size={34} label="Taste match" />
                  Qloo: {event.tasteMatch.artist}&apos;s fans match your taste
                </p>
              )}
            </div>
          ))}
        </section>
      )}

      <section aria-label="Rules" className="space-y-2">
        <H3>Rules to check</H3>
        <p className="m-0 text-muted-foreground">{pitch.rules}</p>
        {pitch.cautions.length > 0 && (
          <ul className="m-0 list-disc pl-5">
            {pitch.cautions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        {pitch.rulesUrl && (
          <a className="font-bold underline underline-offset-3" href={pitch.rulesUrl} target="_blank" rel="noreferrer">
            Site rules and contact
          </a>
        )}
        <p className="m-0 text-sm font-bold">Busk Map never confirms a pitch is legal. Check your permit conditions on the day.</p>
      </section>
    </article>
  );
}
