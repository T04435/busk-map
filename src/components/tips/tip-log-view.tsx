"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const money = (n: number) => `$${n.toLocaleString("en-AU", { maximumFractionDigits: 2 })}`;
const perHour = (n: number) => `${money(Math.round(n))}/h`;

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

/** The tip log: history per performer, and how it changes their plans. */
export function TipLogView() {
  // The server can't see localStorage: it renders a loading line, then the browser fills in.
  const raw = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  const hydrated = raw !== SERVER;
  const [notice, setNotice] = useState<string | null>(null);
  // `raw` changes whenever the log does; loadTips validates it.
  const own = useMemo(() => (raw === SERVER || raw === null ? [] : loadTips()), [raw]);

  useEffect(() => {
    // Keep the cookie the plans read in step with the log.
    writeTipCookie(summariesByPerformer(loadTips(), examplesForKey));
  }, []);

  const yours = groupByPerformer(own);
  const examples = groupByPerformer(EXAMPLE_TIPS);

  function remove(id: string) {
    const ok = saveTips(
      loadTips().filter((e) => e.id !== id),
      examplesForKey,
    );
    setNotice(ok ? "Session deleted." : "This browser blocked the change.");
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Tip log</h1>
        <p className="text-muted-foreground">
          What you earned, per pitch and session. It is saved only in this browser: no account, nothing stored on Busk Map&apos;s servers. To log a
          session, open a plan and use <span className="font-medium text-foreground">Log your takings</span>.
        </p>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>How your results change your plans</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>
              Busk Map compares what you made per hour at each pitch with your own average. A pitch where you earned more gets a small bonus in
              your next plans and week: up to +{Math.round(TIP_BONUS_MAX * 100)} points out of 100, in full when you made{" "}
              {Math.round(TIP_FULL_LIFT * 100)}% more than your average there over {TIP_FULL_SESSIONS} sessions, and less with fewer sessions.
            </p>
            <p>
              A pitch where you earned less is never marked down, and the bonus needs at least {TIP_MIN_SESSIONS} logged sessions. Plans only receive the
              summary (takings per hour per pitch), never your individual sessions, and it is never put in a link you share.
            </p>
          </CardContent>
        </Card>
      </header>

      <p role="status" className="text-sm text-muted-foreground">
        {notice ?? ""}
      </p>

      <section aria-labelledby="yours" className="space-y-4">
        <h2 id="yours" className="text-xl font-semibold">
          Your sessions
        </h2>
        {!hydrated ? (
          <p className="text-muted-foreground">Loading your tip log…</p>
        ) : yours.length === 0 ? (
          <p className="text-muted-foreground">
            No sessions logged in this browser yet. <Link className="underline" href="/">Plan a session</Link>, play it, then log what you earned.
          </p>
        ) : (
          yours.map((group) => <PerformerLog key={group.key} group={group} onDelete={remove} />)
        )}
      </section>

      <section aria-labelledby="example-sessions" className="space-y-4">
        <div className="space-y-1">
          <h2 id="example-sessions" className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            Example sessions <Badge variant="secondary">Example data</Badge>
          </h2>
          <p className="text-sm text-muted-foreground">
            Invented takings for the example performers, to show how a tip log reweights their plans. Not real data.
          </p>
        </div>
        {examples.map((group) => (
          <PerformerLog key={group.key} group={group} />
        ))}
      </section>
    </div>
  );
}

function PerformerLog({ group, onDelete }: { group: Group; onDelete?: (id: string) => void }) {
  const exampleSeeds = group.exampleId && !group.example ? examplesForKey(group.key) : [];
  const history = summarizeTips([...exampleSeeds, ...group.entries]);
  const pitches = new Map(group.entries.map((e) => [e.pitchId, e.pitchName]));
  const example = EXAMPLES.find((e) => e.id === group.exampleId);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <h3>{group.name}</h3>
          {group.example && <Badge variant="secondary">Example data</Badge>}
        </CardTitle>
        {history && (
          <CardDescription>
            {history.sessions} session{history.sessions === 1 ? "" : "s"}
            {exampleSeeds.length > 0 ? ` (including ${exampleSeeds.length} example sessions)` : ""}, average {perHour(history.perHour)}.
            {example && (
              <>
                {" "}
                <Link className="underline" href={`/plan?example=${example.id}`}>
                  Open this performer&apos;s plan
                </Link>
              </>
            )}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {history && (
          <section aria-label={`Bonus per pitch for ${group.name}`} className="space-y-1">
            <h4 className="font-medium">Effect on future plans</h4>
            <ul className="space-y-1">
              {history.pitches.map((p) => {
                const bonus = tipBonus(p.id, history);
                const points = bonus ? Math.round(bonus.bonus * 100) : 0;
                return (
                  <li key={p.id} className="flex flex-wrap justify-between gap-x-4">
                    <span>
                      {pitches.get(p.id) ?? examplesForKey(group.key).find((e) => e.pitchId === p.id)?.pitchName ?? p.id} · {p.sessions} session{p.sessions === 1 ? "" : "s"},{" "}
                      {perHour(p.perHour)}
                    </span>
                    <span className="text-muted-foreground">
                      {!bonus ? "no bonus yet (log another session)" : points > 0 ? `+${points} points` : "no bonus (below your average)"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        <section aria-label={`Sessions for ${group.name}`} className="space-y-1">
          <h4 className="font-medium">History</h4>
          <ul className="divide-y">
            {group.entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{e.pitchName}</span>
                  <span className="block text-muted-foreground">
                    {e.date}, {formatHour(e.startHour)}–{formatHour(e.endHour)}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-right tabular-nums">
                    {money(e.amount)}
                    <span className="block text-muted-foreground">{sessionHours(e) > 0 ? perHour(e.amount / sessionHours(e)) : ""}</span>
                  </span>
                  {onDelete && !e.example && (
                    <Button variant="outline" size="sm" onClick={() => onDelete(e.id)} aria-label={`Delete the ${e.date} session at ${e.pitchName}`}>
                      Delete
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
