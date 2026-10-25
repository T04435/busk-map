import { strengthWord } from "@/lib/plain-scores";
import { Chip } from "@/components/honeycomb/chip";
import { mentionsIn } from "@/lib/mention";
import { planMentions } from "@/lib/plan-mentions";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { FoundByBadge } from "@/components/honeycomb/found-by-badge";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Icon } from "@/components/honeycomb/icon";
import { ArtistChip } from "@/components/honeycomb/artist-chip";
import { InfoTag } from "@/components/honeycomb/info-tag";
import { Reason } from "@/components/honeycomb/reason";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import { RankTile } from "@/components/honeycomb/rank-tile";
import { ScoreRing } from "@/components/honeycomb/score-ring";
import { Badge } from "@/components/ui/badge";
import type { Plan, PlanPitch } from "@/lib/plan-schema";
import type { ExplanationsModel } from "@/lib/sources";
import { venueDetail } from "@/lib/venue";
import { levelsToLabel, levelWord, liveSource, rulesChecked, type LevelSignal } from "@/lib/signal-level";
import { ActivityChart } from "./activity-chart";
import { Cautions, Fact, QlooDetail } from "./tool-results";

const KIND_LABEL: Record<PlanPitch["kind"], string> = {
  designated: "Council-designated site",
  "public-space": "Public space, general permit",
  footpath: "Footpath, general permit",
};
/** A city whose busking rules aren't checked (V2 2.4): the kind names no permit. */
const KIND_UNCHECKED: Record<PlanPitch["kind"], string> = { designated: "Public space", "public-space": "Public space", footpath: "Footpath" };

/**
 * The sheet's pitch body (boards B55 to B58): the head (rank, badges, name, kind, big score), why this crowd, estimated activity by
 * hour, then the facts as plain rows: busy places, the event, the weather and the legality, last, with the never-confirms line.
 * Keeps `pitch-card`.
 */
export function PitchDetails({ plan, pitch, rank, model }: { plan: Plan; pitch: PlanPitch; rank: number; model: ExplanationsModel | null }) {
  const written = plan.explanations === "ai";
  // V2 2.2: outside Melbourne each fact names its level; Melbourne's facts stay as they are.
  const levels = levelsToLabel(plan.city, plan.cityLevels);
  const checked = rulesChecked(levels);
  const level = (signal: LevelSignal) => levelWord(signal, levels, liveSource(signal, plan.dataStatus));
  const inSlot = (plan.weather?.hours ?? []).filter((h) => h.hour >= plan.slot.startHour && h.hour < plan.slot.endHour);
  const temps = inSlot.map((h) => h.temperatureC).filter((t): t is number => t !== null);
  const rain = Math.max(0, ...inSlot.map((h) => h.precipitationProbability ?? 0));
  const winds = inSlot.map((h) => h.windKmh).filter((w): w is number => w !== null);
  const event = pitch.evidence.events[0];
  const chips = [
    pitch.factors.taste !== null ? `${strengthWord(pitch.factors.taste)} taste match (Qloo)` : null,
    event ? `${event.name} ${event.moment === "leaving" ? "lets out" : "starts"} ${event.localTime ?? ""}`.trim() : null,
    pitch.discovery === "hidden-gem" ? "Few other buskers" : null,
    pitch.evidence.places.length > 0 ? `${pitch.evidence.places.length} busy place${pitch.evidence.places.length === 1 ? "" : "s"} nearby` : null,
  ].filter((c): c is string => c !== null);
  const meta = "font-mono text-[11px] leading-4 font-medium tracking-[0.06em] uppercase";
  return (
    <article data-testid="pitch-card" aria-label={`Pitch ${rank}: ${pitch.name}`} className="grid gap-4 border-2 border-rule bg-card p-4 md:p-6">
      <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
        <RankTile n={rank} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${meta} text-muted-foreground`}>Pitch {String(rank).padStart(2, "0")}</span>
            <DiscoveryBadge discovery={pitch.discovery} />
            <FoundByBadge origin={pitch.origin} written={written} model={model} />
            {pitch.amplification === "unamplified-zone" && <Badge variant="neutral">Unamplified only</Badge>}
          </div>
          <h3 className="m-0 mt-1 mb-0.5 font-display text-[26px] leading-[26px] font-extrabold tracking-[0.01em] break-words uppercase">{pitch.name}</h3>
          <p className="m-0 font-mono text-[11px] tracking-[0.04em] text-muted-foreground uppercase">{(checked ? KIND_LABEL : KIND_UNCHECKED)[pitch.kind]}</p>
        </div>
        <HexCell size={72} label={`Score ${pitch.score} out of 100`}>
          <ScoreRing value={pitch.score} size={60} label={false} />
        </HexCell>
      </header>

      <section aria-label="Why this crowd">
        <h4 className={`m-0 mb-2 ${meta} text-muted-foreground`}>Why this crowd</h4>
        {chips.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {chips.map((c) => (
              <li key={c}>
                <Chip>{c}</Chip>
              </li>
            ))}
          </ul>
        )}
        <Reason text={mentionsIn(pitch.why, planMentions(plan))} className="mt-2" />
      </section>

      <ActivityChart activity={pitch.evidence.activity} slot={pitch.window ?? plan.slot} />

      <div className="grid border-t-2 border-rule">
        {pitch.evidence.places.length > 0 && (
          <Fact icon="store" tone="places" title="Busy places open in your slot" level={level("taste")}>
            <ul className="m-0 mt-1 grid list-none gap-0.5 p-0 text-sm leading-5 font-normal">
              {pitch.evidence.places.map((place) => (
                <li key={place.name} className="flex justify-between gap-3">
                  <span>
                    {place.name}
                    {venueDetail(place) ? <QlooDetail>{venueDetail(place)}</QlooDetail> : null}
                  </span>
                  <span className="shrink-0 text-right font-mono text-muted-foreground tabular-nums">
                    {place.distanceM} m · {place.open === "open" ? "open" : "hours unknown"}
                  </span>
                </li>
              ))}
            </ul>
          </Fact>
        )}
        {pitch.evidence.events.map((e, i) => (
          <Fact
            key={`${e.name}-${e.localTime}-${i}`}
            icon="ticket"
            tone="event"
            title={e.name}
            level={level("events")}
            sub={
              <>
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
              </>
            }
          >
            {e.tasteMatch && (
              <div data-testid="event-taste-match">
                <ArtistChip
                  name={e.tasteMatch.artist}
                  score={<ScoreCell value={Math.round(e.tasteMatch.affinity * 100)} size="sm" label="Taste match" />}
                  info={<InfoTag tone="qloo">Qloo: fans match your taste</InfoTag>}
                />
              </div>
            )}
          </Fact>
        ))}
        {inSlot.length > 0 && temps.length > 0 && (
          <Fact
            icon={rain >= 50 ? "rain" : rain >= 20 ? "cloud" : "sun"}
            tone="weather"
            level={level("weather")}
            title={`${Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)}°, ${rain >= 50 ? "rain in your slot" : "dry through your slot"}`}
            sub={`Rain ${rain}%${winds.length > 0 ? ` · wind ${Math.round(winds.reduce((a, b) => a + b, 0) / winds.length)} km/h` : ""}`}
          />
        )}
        <Fact icon="legal" tone="legal" title={!checked ? "Busking rules" : pitch.kind === "designated" ? "Council-designated pitch" : "General permit pitch"} sub={pitch.rules} level={level("rules")}>
          <section aria-label="Rules">
            <Cautions items={pitch.cautions} />
            {pitch.rulesUrl && (
              <div className="mt-2">
                <a className="inline-flex min-h-tap items-center gap-1 text-sm leading-5 font-normal text-foreground underline decoration-[1.5px] underline-offset-3 hover:decoration-[2.5px]" href={pitch.rulesUrl} target="_blank" rel="noreferrer">
                  City of Melbourne busking rules <Icon name="external" size={14} />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            )}
          </section>
        </Fact>
      </div>
    </article>
  );
}
