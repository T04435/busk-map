import { CalendarClock, ExternalLink, MapPin, ShieldCheck, Sun, TriangleAlert } from "lucide-react";
import { Chip } from "@/components/honeycomb/chip";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { FoundByBadge } from "@/components/honeycomb/found-by-badge";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { PercentCell } from "@/components/honeycomb/percent-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";
import { ScoreRing } from "@/components/honeycomb/score-ring";
import { WithCells } from "@/components/honeycomb/with-cells";
import { Badge } from "@/components/ui/badge";
import type { Plan, PlanPitch } from "@/lib/plan-schema";
import { explainedByLabel, type ExplanationsModel } from "@/lib/sources";
import { venueDetail } from "@/lib/venue";
import { FootTrafficChart } from "./foot-traffic-chart";

const KIND_LABEL: Record<PlanPitch["kind"], string> = {
  designated: "Council-designated site",
  "public-space": "Public space, general permit",
  footpath: "Footpath, general permit",
};

const Row = ({ icon, title, children }: { icon: React.ReactNode; title: React.ReactNode; children: React.ReactNode }) => (
  <section className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border py-4 first:border-t-0">
    <span aria-hidden="true" className="mt-0.5 text-muted-foreground [&>svg]:size-5">
      {icon}
    </span>
    <div className="min-w-0 space-y-1">
      <h4 className="m-0 text-base leading-6 font-bold">{title}</h4>
      {children}
    </div>
  </section>
);

/**
 * The sheet's pitch body (boards B55 to B58): the head (rank, badges, name, kind, big score), why this crowd, foot traffic by
 * hour, then the facts as plain rows: busy places, the event, the weather and the legality, last, with the never-confirms line.
 * Keeps `pitch-card`.
 */
export function PitchDetails({ plan, pitch, rank, model }: { plan: Plan; pitch: PlanPitch; rank: number; model: ExplanationsModel | null }) {
  const written = plan.explanations === "ai";
  const inSlot = (plan.weather?.hours ?? []).filter((h) => h.hour >= plan.slot.startHour && h.hour < plan.slot.endHour);
  const temps = inSlot.map((h) => h.temperatureC).filter((t): t is number => t !== null);
  const rain = Math.max(0, ...inSlot.map((h) => h.precipitationProbability ?? 0));
  const winds = inSlot.map((h) => h.windKmh).filter((w): w is number => w !== null);
  const event = pitch.evidence.events[0];
  const chips = [
    pitch.factors.taste !== null ? `Taste match ${pitch.factors.taste.toFixed(2)} (Qloo)` : null,
    event ? `${event.name} ${event.moment === "leaving" ? "lets out" : "starts"} ${event.localTime ?? ""}`.trim() : null,
    pitch.discovery === "hidden-gem" ? "Few other buskers" : null,
    pitch.evidence.places.length > 0 ? `${pitch.evidence.places.length} busy place${pitch.evidence.places.length === 1 ? "" : "s"} nearby` : null,
  ].filter((c): c is string => c !== null);
  return (
    <article data-testid="pitch-card" aria-label={`Pitch ${rank}: ${pitch.name}`} className="space-y-5 border-2 border-rule bg-card p-4 md:p-6">
      <header className="flex items-start gap-3">
        <RankTile n={rank} size="lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Pitch {String(rank).padStart(2, "0")}</span>
            <DiscoveryBadge discovery={pitch.discovery} />
            <FoundByBadge origin={pitch.origin} written={written} model={model} />
            {pitch.amplification === "unamplified-zone" && <Badge variant="neutral">Unamplified only</Badge>}
          </div>
          <h3 className="m-0 font-display text-[clamp(28px,5vw,36px)] leading-[0.95] font-extrabold break-words uppercase">{pitch.name}</h3>
          <p className="m-0 font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">{KIND_LABEL[pitch.kind]}</p>
        </div>
        <HexCell size={72} label={`Score ${pitch.score} out of 100`}>
          <ScoreRing value={pitch.score} size={60} label={false} />
        </HexCell>
      </header>

      <section aria-label="Why this crowd" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="m-0 font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">Why this crowd</h4>
          <span className="font-mono text-xs text-muted-foreground">{pitch.whySource === "ai" ? explainedByLabel(model) : "Explanation from the data"}</span>
        </div>
        {chips.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {chips.map((c) => (
              <li key={c}>
                <Chip>{c}</Chip>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0">
          <WithCells text={pitch.why} />
        </p>
        {pitch.origin === "agent" && written ? (
          <p className="m-0 text-sm text-muted-foreground">Proposed by Claude: it suggested this spot, Busk Map scored it and checked it against the busking rules.</p>
        ) : null}
        {pitch.origin === "taste" && pitch.cellRank !== null && (
          <p className="m-0 text-sm text-muted-foreground">Found from the data: Qloo taste cell no. {pitch.cellRank} for your artists, snapped to the nearest public space.</p>
        )}
        {pitch.discovery === "usual" && pitch.usualSpot && <p className="m-0 text-sm text-muted-foreground">Usual pitch: at {pitch.usualSpot}, where buskers already go.</p>}
      </section>

      <FootTrafficChart
        hourly={pitch.evidence.sensor?.hourly ?? null}
        avgHourly={pitch.evidence.sensor?.avgHourly ?? null}
        sensorName={pitch.evidence.sensor?.name ?? null}
        slot={plan.slot}
        unavailable={plan.footfallLevel === "unavailable"}
      />

      <div className="border-t-2 border-rule">
        {pitch.evidence.places.length > 0 && (
          <Row icon={<MapPin />} title="Busy places open in your slot">
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
              {pitch.evidence.places.map((place) => (
                <li key={place.name} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">
                    {place.name}
                    {venueDetail(place) ? <span className="block text-muted-foreground">Qloo: {venueDetail(place)}</span> : null}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {place.distanceM} m · {place.open === "open" ? "open" : "hours unknown"}
                  </span>
                </li>
              ))}
            </ul>
          </Row>
        )}
        {pitch.evidence.events.map((e, i) => (
          <Row key={`${e.name}-${e.localTime}-${i}`} icon={<CalendarClock />} title={e.name}>
            <p className="m-0 text-sm text-muted-foreground">
              {e.venue} · {e.moment === "leaving" ? "lets out" : "starts"} about {e.localTime}
              {e.endEstimated && e.moment === "leaving" ? " (estimated)" : ""}
              {e.url ? (
                <>
                  {" "}
                  <a className="inline-flex min-h-tap items-center underline underline-offset-3" href={e.url} target="_blank" rel="noreferrer">
                    Ticketmaster<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </>
              ) : null}
            </p>
            {e.tasteMatch && (
              <p className="m-0 flex items-center gap-2 text-sm text-muted-foreground" data-testid="event-taste-match">
                <PercentCell value={Math.round(e.tasteMatch.affinity * 100)} size={34} label="Taste match" />
                Qloo: {e.tasteMatch.artist}&apos;s fans match your taste
              </p>
            )}
          </Row>
        ))}
        {inSlot.length > 0 && temps.length > 0 && (
          <Row icon={<Sun />} title={`${Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)}°, ${rain >= 50 ? "rain in your slot" : "dry through your slot"}`}>
            <p className="m-0 text-sm text-muted-foreground">
              Rain {rain}%{winds.length > 0 ? ` · wind ${Math.round(winds.reduce((a, b) => a + b, 0) / winds.length)} km/h` : ""}
            </p>
          </Row>
        )}
        <Row icon={<ShieldCheck />} title={pitch.kind === "designated" ? "Council-designated pitch" : "General permit pitch"}>
          <section aria-label="Rules" className="space-y-1.5">
            <p className="m-0 text-sm text-muted-foreground">{pitch.rules}</p>
            {pitch.cautions.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
                {pitch.cautions.map((c) => (
                  <li key={c} className="flex items-start gap-2">
                    <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-pitch-restricted" />
                    {c}
                  </li>
                ))}
              </ul>
            )}
            {pitch.rulesUrl && (
              <a className="inline-flex min-h-tap items-center gap-1 text-sm font-bold underline underline-offset-3" href={pitch.rulesUrl} target="_blank" rel="noreferrer">
                City of Melbourne busking rules <ExternalLink aria-hidden="true" className="size-3.5" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            <p className="m-0 text-sm text-muted-foreground italic">Busk Map never confirms a pitch is legal. Check the rules before you play.</p>
          </section>
        </Row>
      </div>
    </article>
  );
}
