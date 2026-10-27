"use client";

import Link from "next/link";
import { Disclosure } from "@/components/honeycomb/disclosure";
import { DiscoveryBadge } from "@/components/honeycomb/discovery-badge";
import { FoundByBadge } from "@/components/honeycomb/found-by-badge";
import { Reason } from "@/components/honeycomb/reason";
import { BuskPitches } from "@/components/plan/busk-pitches";
import { PitchDetailsBody } from "@/components/plan/pitch-sheet";
import { WeatherStrip } from "@/components/plan/weather-strip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { mentionsIn } from "@/lib/mention";
import { planPath } from "@/lib/plan-id";
import { planMentions } from "@/lib/plan-mentions";
import type { Plan } from "@/lib/plan-schema";
import type { ExplanationsModel } from "@/lib/sources";
import type { WeekDayResult, WeekDayStatus } from "@/lib/week-schema";

type BadgeTone = React.ComponentProps<typeof Badge>["variant"];

/** Each day's status word and badge: playing, not worth it, can't play, planning, didn't finish. */
export const DAY_STATUS: Record<WeekDayStatus, { word: string; tone: BadgeTone }> = {
  ready: { word: "Playing", tone: "tag-on" },
  "not-worth": { word: "Not worth it", tone: "tag-quiet" },
  "cant-play": { word: "Can't play", tone: "tag-quiet" },
  pending: { word: "Planning", tone: "tag-live" },
  failed: { word: "Didn't finish", tone: "tag-failed" },
};

/**
 * The seven days, each in full on the page (no other page to open): a day you play shows what its busk plan shows (its pitch
 * with score, badges and hours, the why, the pitch's details, the suggested set and the day's weather); any other day its
 * status and reason. Each day folds; `open` is the day shown (kept in step with the week's map).
 */
export function WeekDays({
  days,
  plans,
  open,
  onOpen,
  selectedPitch,
  onSelectPitch,
  model,
  rulesChecked,
  showWeather,
}: {
  days: readonly WeekDayResult[];
  /** Each playing day's stored plan, by date (empty while the run goes). */
  plans: Readonly<Record<string, Plan>>;
  /** The open days. */
  open: ReadonlySet<string>;
  onOpen: (date: string, open: boolean) => void;
  selectedPitch: string | null;
  onSelectPitch: (date: string, pitchId: string) => void;
  model: ExplanationsModel | null;
  rulesChecked: boolean;
  /** False when no day has a forecast (the week says so once, at the top). */
  showWeather: boolean;
}) {
  return (
    <ol className="m-0 flex list-none flex-col gap-3 p-0" aria-label="Your seven days" data-testid="week-days">
      {days.map((day, i) => {
        const status = DAY_STATUS[day.status];
        const plan = plans[day.date];
        const pitch = day.status === "ready" ? day.pitch : null;
        const label = (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-mono text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase" data-testid="week-day-number">
              Day {i + 1}
            </span>
            <span className="font-display text-xl leading-6 font-extrabold uppercase">{day.label}</span>
            <Badge variant={status.tone} data-testid="week-day-status">
              {status.word}
            </Badge>
            {pitch ? (
              <>
                <b className="leading-6 [overflow-wrap:anywhere]" data-testid="week-day-pitch">
                  {pitch.name}
                </b>
                <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums" data-testid="week-day-hours">
                  {day.window}
                </span>
              </>
            ) : day.window && day.status !== "failed" ? (
              <span className="font-mono text-sm font-normal text-muted-foreground tabular-nums">{day.window}</span>
            ) : null}
          </span>
        );
        return (
          <li key={day.date} data-testid="week-day" data-status={day.status} data-date={day.date} data-open={open.has(day.date) || undefined} className="min-w-0">
            <Disclosure label={label} expanded={open.has(day.date)} onOpenChange={(o) => onOpen(day.date, o)}>
              {pitch && plan ? (
                <div className="flex min-w-0 flex-col gap-5" data-testid="week-day-plan-inline">
                  <BuskPitches
                    plan={plan}
                    selectedId={selectedPitch}
                    onSelect={(id) => onSelectPitch(day.date, id)}
                    rulesChecked={rulesChecked}
                    className="space-y-3"
                    badges={(p) => (
                      <>
                        <DiscoveryBadge discovery={p.discovery} />
                        <FoundByBadge origin={p.origin} written={plan.explanations === "ai"} model={plan.explanationsModel ?? model} />
                      </>
                    )}
                  />
                  <Reason text={mentionsIn(pitch.why, planMentions(plan))} />
                  {showWeather && day.slot ? (
                    <div data-testid="week-day-weather">
                      <WeatherStrip weather={plan.weather} slot={plan.slot} titleAs="h3" label={`Weather, ${day.label}`} />
                    </div>
                  ) : null}
                  {plan.pitches[0] ? <PitchDetailsBody plan={plan} pitch={plan.pitches[0]} model={plan.explanationsModel ?? model} /> : null}
                  {day.planId ? (
                    <Link href={planPath(day.planId)} className="self-start text-sm underline underline-offset-3" data-testid="week-day-plan">
                      This day as its own plan
                    </Link>
                  ) : null}
                </div>
              ) : day.status === "pending" || (pitch && !plan) ? (
                <div className="grid gap-2" role="status" aria-label={`Planning ${day.label}`}>
                  <Skeleton className="h-4 w-[55%]" />
                  <Skeleton className="h-3 w-[80%]" />
                </div>
              ) : (
                <p className="m-0 text-sm leading-5" data-testid="week-day-reason">
                  {day.reason ?? (day.status === "cant-play" ? "You can't play this day." : "")}
                </p>
              )}
            </Disclosure>
          </li>
        );
      })}
    </ol>
  );
}
