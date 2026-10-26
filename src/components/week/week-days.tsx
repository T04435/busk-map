import Link from "next/link";
import { cn } from "cn";
import { Icon } from "@/components/honeycomb/icon";
import { ScoreRing } from "@/components/honeycomb/score-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { planPath } from "@/lib/plan-id";
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

/** The seven days of a week: each one's status, and for a day you play, its best pitch, hours and a link to its own busk plan. */
export function WeekDays({ days }: { days: readonly WeekDayResult[] }) {
  return (
    <ol className="m-0 grid list-none divide-y-2 divide-rule border-2 border-rule bg-card p-0" aria-label="Your seven days" data-testid="week-days">
      {days.map((day) => {
        const status = DAY_STATUS[day.status];
        const playing = day.status === "ready" && day.pitch;
        return (
          <li
            key={day.date}
            data-testid="week-day"
            data-status={day.status}
            data-date={day.date}
            className={cn("grid min-w-0 grid-cols-1 gap-3 p-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center md:px-6", !playing && "text-muted-foreground")}
          >
            <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-start">
              <span className="font-display text-xl leading-6 font-extrabold text-foreground uppercase">{day.label}</span>
              <Badge variant={status.tone} data-testid="week-day-status">
                {status.word}
              </Badge>
            </div>
            <div className="grid min-w-0 gap-1">
              {playing ? (
                <>
                  <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <b className="text-lg leading-6 text-foreground [overflow-wrap:anywhere]" data-testid="week-day-pitch">
                      {day.pitch!.name}
                    </b>
                    <span className="font-mono text-sm text-muted-foreground tabular-nums" data-testid="week-day-hours">
                      {day.window}
                    </span>
                    {day.anyTime ? <Badge variant="tag-quiet">Any time</Badge> : null}
                  </p>
                  <p className="m-0 line-clamp-3 text-sm leading-5 text-muted-foreground">{day.pitch!.why}</p>
                </>
              ) : day.status === "pending" ? (
                <div className="grid gap-2" aria-hidden="true">
                  <Skeleton className="h-4 w-[55%]" />
                  <Skeleton className="h-3 w-[80%]" />
                </div>
              ) : (
                <>
                  {day.window && day.status !== "failed" ? <span className="font-mono text-sm tabular-nums">{day.window}</span> : null}
                  {day.reason ? (
                    <p className="m-0 text-sm leading-5" data-testid="week-day-reason">
                      {day.reason}
                    </p>
                  ) : null}
                </>
              )}
              {day.status === "pending" ? <span className="sr-only">Planning this day</span> : null}
            </div>
            {playing ? (
              <div className="flex items-center gap-3 sm:justify-end">
                <ScoreRing value={day.pitch!.score} size={48} />
                {day.planId ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={planPath(day.planId)} data-testid="week-day-plan" aria-label={`Open the plan for ${day.label}`}>
                      Open plan
                      <Icon name="arrow-right" size={16} />
                    </Link>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
