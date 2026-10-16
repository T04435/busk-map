"use client";

import Link from "next/link";
import { Coins, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { PageHeader } from "@/components/honeycomb/page-header";
import { TipLogForm } from "@/components/tips/tip-log-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EXAMPLE_TIPS, examplesForKey } from "@/lib/example-tips";
import { EXAMPLES } from "@/lib/examples";
import { formatHour } from "@/lib/slot";
import { loadTips, saveTips, sessionHours, summariesByPerformer, summarizeTips, TIP_STORAGE_KEY, writeTipCookie, type TipEntry } from "@/lib/tips";
import { TIP_BONUS_MAX, TIP_FULL_LIFT, TIP_FULL_SESSIONS, TIP_MIN_SESSIONS, tipBonus } from "@/server/scoring/tips";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("buskmap:tips", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("buskmap:tips", onChange);
  };
}

const SERVER = "\u0000server";

function snapshot(): string | null {
  try {
    return window.localStorage.getItem(TIP_STORAGE_KEY);
  } catch {
    return null;
  }
}

const money = (n: number) => `A$${n.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;
/** Rows and entries: "A$40/h". Sentences say "A$40 an hour". */
const perHour = (n: number) => `${money(Math.round(n))}/h`;
const anHour = (n: number) => `${money(Math.round(n))} an hour`;

type Group = { key: string; name: string; example: boolean; exampleId: string | null; entries: TipEntry[] };

function groupByPerformer(entries: TipEntry[]): Group[] {
  const groups = new Map<string, Group>();
  for (const entry of entries) {
    const exampleId = entry.performerKey.startsWith("example:") ? entry.performerKey.slice("example:".length) : null;
    const group = groups.get(entry.performerKey) ?? { key: entry.performerKey, name: entry.performerName, example: false, exampleId, entries: [] };
    group.entries.push(entry);
    group.example ||= entry.example;
    groups.set(entry.performerKey, group);
  }
  for (const group of groups.values()) group.entries.sort((a, b) => b.date.localeCompare(a.date) || b.startHour - a.startHour);
  return [...groups.values()];
}

/** The tip log: log takings, then history per performer, and how it changes their plans. */
export function TipLogView() {
  // The server can't see localStorage: it renders a loading line, then the browser fills in.
  const raw = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  const hydrated = raw !== SERVER;
  const [notice, setNotice] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<TipEntry | null>(null);
  // `raw` changes whenever the log does; loadTips validates it.
  const own = useMemo(() => (raw === SERVER || raw === null ? [] : loadTips()), [raw]);

  useEffect(() => {
    // Keep the cookie the plans read in step with the log.
    writeTipCookie(summariesByPerformer(loadTips(), examplesForKey));
  }, []);

  const yours = groupByPerformer(own);
  const examples = groupByPerformer(EXAMPLE_TIPS);

  function remove(entry: TipEntry) {
    const ok = saveTips(
      loadTips().filter((e) => e.id !== entry.id),
      examplesForKey,
    );
    setConfirming(null);
    setNotice(ok ? "Session deleted." : "This browser blocked the change.");
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        meta="Kept in this browser only"
        title="Tip log"
        subtitle="What you earned, per pitch and session. No account, and nothing stored on Busk Map's servers."
      />

      <TipLogForm />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>How your results change your plans</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="m-0">
            Busk Map compares what you made per hour at each pitch with your own average. A pitch where you earned more gets a small bonus in
            your next plans and week: up to +{Math.round(TIP_BONUS_MAX * 100)} in your plans, in full when you made {Math.round(TIP_FULL_LIFT * 100)}% more than
            your average there over {TIP_FULL_SESSIONS} sessions, and less with fewer sessions.
          </p>
          <p className="m-0">
            A pitch where you earned less is never marked down, and the bonus needs at least {TIP_MIN_SESSIONS} logged sessions. Plans only receive the
            summary (takings per hour per pitch), never your individual sessions, and it is never put in a link you share.
          </p>
        </CardContent>
      </Card>

      <p role="status" className="m-0 text-sm text-muted-foreground empty:hidden">
        {notice ?? ""}
      </p>

      <section aria-labelledby="yours" className="flex flex-col gap-4">
        <h2 id="yours" className="m-0 font-display text-[clamp(32px,4vw,44px)] leading-none font-extrabold uppercase">
          Your sessions
        </h2>
        {!hydrated ? (
          <p className="m-0 text-muted-foreground">Loading your tip log…</p>
        ) : yours.length === 0 ? (
          <div data-testid="tips-empty" className="flex flex-col items-center gap-3 border-2 border-dashed border-input p-8 text-center">
            <HexCell size={64} tone="dashed" lift>
              <Coins className="size-7" aria-hidden="true" />
            </HexCell>
            <h3 className="m-0 font-display text-2xl leading-none font-extrabold uppercase">Nothing logged yet</h3>
            <p className="m-0 max-w-[40ch] text-[15px] leading-[22px] text-muted-foreground">
              No sessions logged in this browser yet. <Link className="font-bold text-foreground underline underline-offset-3" href="/busks">Plan a session</Link>, play it, then log what you earned.
            </p>
          </div>
        ) : (
          yours.map((group) => <PerformerLog key={group.key} group={group} onDelete={setConfirming} />)
        )}
      </section>

      <section aria-labelledby="example-sessions" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 id="example-sessions" className="m-0 flex flex-wrap items-center gap-3 font-display text-[clamp(32px,4vw,44px)] leading-none font-extrabold uppercase">
            Example sessions <Badge variant="estimate">Example data</Badge>
          </h2>
          <p className="m-0 text-sm text-muted-foreground">
            Invented takings for the example performers, to show how a tip log reweights their plans. Not real data.
          </p>
        </div>
        {examples.map((group) => (
          <PerformerLog key={group.key} group={group} />
        ))}
      </section>

      <Dialog open={confirming !== null} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          {confirming ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete this session?</DialogTitle>
                <DialogDescription>
                  {confirming.pitchName} for {confirming.performerName}, {confirming.date}, {formatHour(confirming.startHour)}–{formatHour(confirming.endHour)}:{" "}
                  {money(confirming.amount)}. It leaves your tip log and your next plans stop counting it. This can&apos;t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirming(null)}>
                  Keep it
                </Button>
                <Button variant="destructive" onClick={() => remove(confirming)}>
                  <Trash2 aria-hidden="true" />
                  Delete session
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PerformerLog({ group, onDelete }: { group: Group; onDelete?: (entry: TipEntry) => void }) {
  const exampleSeeds = group.exampleId && !group.example ? examplesForKey(group.key) : [];
  const history = summarizeTips([...exampleSeeds, ...group.entries]);
  const pitches = new Map(group.entries.map((e) => [e.pitchId, e.pitchName]));
  const example = EXAMPLES.find((e) => e.id === group.exampleId);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <h3 className="m-0 text-[length:inherit] leading-[inherit]">{group.name}</h3>
          {group.example && <Badge variant="estimate">Example data</Badge>}
        </CardTitle>
        {history && (
          <CardDescription className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="font-mono">
              {history.sessions} session{history.sessions === 1 ? "" : "s"}
              {exampleSeeds.length > 0 ? ` (including ${exampleSeeds.length} example sessions)` : ""} · average {anHour(history.perHour)}
            </span>
            {example && (
              <Button asChild variant="outline">
                <Link href={`/plan?example=${example.id}`}>Open a plan →</Link>
              </Button>
            )}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {history && (
          <section aria-label={`Bonus per pitch for ${group.name}`} className="space-y-1">
            <h4 className="m-0 font-mono text-xs leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase">Effect on future plans</h4>
            <ul className="m-0 grid list-none p-0">
              {history.pitches.map((p) => {
                const bonus = tipBonus(p.id, history);
                const points = bonus ? Math.round(bonus.bonus * 100) : 0;
                return (
                  <li key={p.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-border py-2.5">
                    <span className="grid gap-0.5">
                      <b>{pitches.get(p.id) ?? examplesForKey(group.key).find((e) => e.pitchId === p.id)?.pitchName ?? p.id}</b>
                      <span className="font-mono text-xs text-muted-foreground">
                        {p.sessions} session{p.sessions === 1 ? "" : "s"} · {perHour(p.perHour)}
                      </span>
                    </span>
                    <span className={points > 0 ? "font-mono text-[13px] font-bold text-signal-text" : "font-mono text-[13px] text-muted-foreground"}>
                      {!bonus ? "Log one more session for a bonus" : points > 0 ? `+${points} in your plans` : "No bonus: below your average"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section aria-label={`Sessions for ${group.name}`} className="space-y-1">
          <h4 className="m-0 font-mono text-xs leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase">History</h4>
          <ul className="m-0 list-none p-0">
            {group.entries.map((e) => (
              <li key={e.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 border-t border-border py-3">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <b>{e.pitchName}</b>
                  {e.example ? <Badge variant="estimate">Example data</Badge> : null}
                </span>
                <span className="flex items-center justify-end gap-1">
                  <span className="font-display text-[28px] leading-none font-extrabold tabular-nums">{money(e.amount)}</span>
                  {onDelete && !e.example ? (
                    <Button variant="ghost" size="icon" onClick={() => onDelete(e)} aria-label={`Delete the ${e.date} session at ${e.pitchName}`}>
                      <Trash2 aria-hidden="true" />
                    </Button>
                  ) : null}
                </span>
                <span className="font-mono text-[13px] text-muted-foreground">
                  {e.date} · {formatHour(e.startHour)}–{formatHour(e.endHour)}
                  {sessionHours(e) > 0 ? ` · ${perHour(e.amount / sessionHours(e))}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
