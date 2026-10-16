"use client";

import { ChevronRightIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentSteps } from "@/components/plan/agent-steps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { applyLearnEvent, emptyLive, type LearnLive } from "@/lib/learn-live";
import type { LearnEnd, LearnListView, LearnRunView, LearnStreamEvent } from "@/lib/learn-schema";
import { PLAYLIST_COPY } from "@/lib/playlist-copy";
import type { LearnSuggestionView } from "@/lib/playlist-schema";
import { joinLearn, loadLearn, patchSuggestion, pageFaults, startLearn, type Refusal } from "./learn-api";
import { LearnSongCard } from "./learn-song-card";

const COPY = PLAYLIST_COPY.learn;
const MIN_SONGS = 3;
const POLL_MS = 5000;
/** shadcn's destructive description is destructive/90, which is 4.49:1 on white: just under AA. Full strength passes. */
const DESTRUCTIVE = "*:data-[slot=alert-description]:text-destructive";

/** What the run bar says when a run did not give a normal result (docs §7.4). */
type Notice =
  | { kind: "limit"; scope: "repertoire" | "ip"; message: string }
  | { kind: "qloo"; message: string }
  | { kind: "error"; message: string }
  | { kind: "info"; message: string };

const whenOf = (iso: string) => new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });

/** The funnel of a run: what it looked at and what it left out, with Qloo's request count. */
function Totals({ live }: { live: LearnLive }) {
  const t = live.totals;
  const items: [keyof typeof COPY.totals, number][] = [
    ["artists", t.artists],
    ["crowds", t.crowds],
    ["liked", t.liked],
    ["songsChecked", t.songsChecked],
    ["alreadySuggested", t.alreadySuggested],
    ["dismissedSkipped", t.dismissedSkipped],
    ["alreadyKnown", t.alreadyKnown],
    ["newSongs", t.newSongs],
    ["qlooCalls", t.qlooCalls],
    ["qlooCacheHits", t.qlooCacheHits],
  ];
  return (
    <div data-testid="learn-totals" className="space-y-1">
      <h4 className="text-sm font-medium">{COPY.totalsHeading}</h4>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
        {items.map(([key, value]) => (
          <div key={key} className="flex items-baseline gap-1.5" data-total={key}>
            <dt className="order-2 text-muted-foreground">{COPY.totals[key]}</dt>
            <dd className="order-1 font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RunFeed({ live, heading, running }: { live: LearnLive; heading: string; running: boolean }) {
  return (
    <div className="space-y-3 rounded-lg border p-4" data-testid="learn-run" data-run={live.number ?? ""} data-replay={live.replay ? "true" : "false"}>
      <h3 className="text-base font-semibold">
        {heading}
        {live.replay && <span className="ml-2 text-sm font-normal text-muted-foreground">(replay)</span>}
      </h3>
      {live.status && <p className="text-sm text-muted-foreground">{live.status}</p>}
      <Totals live={live} />
      <AgentSteps steps={live.steps} model={live.model} kind="learn" label="Learn run steps" />
      {running && live.steps.length === 0 && <Skeleton className="h-10 w-full" />}
    </div>
  );
}

/** How a finished run reads on the run bar. */
function EndNotice({ end }: { end: LearnEnd }) {
  if (!end.ok && (end.code === "qloo_unavailable" || end.code === "no_match")) {
    return (
      <Alert variant="destructive" className={DESTRUCTIVE} data-testid="learn-end" data-state="qloo">
        <AlertTitle>{COPY.qlooDownTitle}</AlertTitle>
        <AlertDescription>
          <p>{end.message}</p>
          <p data-testid="learn-safe">
            {COPY.songsSafe} {COPY.notCounted}
          </p>
        </AlertDescription>
      </Alert>
    );
  }
  if (!end.ok) {
    return (
      <Alert variant="destructive" className={DESTRUCTIVE} data-testid="learn-end" data-state="error">
        <AlertTitle>{COPY.errorTitle}</AlertTitle>
        <AlertDescription>
          <p>{end.message}</p>
          <p data-testid="learn-safe">{COPY.songsSafe}</p>
        </AlertDescription>
      </Alert>
    );
  }
  if (end.newCount === 0) {
    return (
      <Alert role="status" data-testid="learn-end" data-state="nothing-new">
        <AlertDescription>{end.message}</AlertDescription>
      </Alert>
    );
  }
  if (end.mode === "fallback") {
    return (
      <Alert role="status" data-testid="learn-end" data-state="fallback">
        <AlertTitle>{COPY.fallbackTitle}</AlertTitle>
        <AlertDescription>{end.message}</AlertDescription>
      </Alert>
    );
  }
  return (
    <p role="status" className="text-sm" data-testid="learn-end" data-state="done">
      {end.message}
    </p>
  );
}

function runMeta(run: LearnRunView): string {
  const parts = [whenOf(run.startedAt), PLAYLIST_COPY.learn.modelLabel[run.model], COPY.looked(run.inputs.songs, run.inputs.pitches.length)];
  if (run.status === "done" || run.status === "fallback") parts.push(COPY.newCount(run.newCount));
  else parts.push(COPY.statusLabel[run.status]);
  return parts.join(" · ");
}

type Group = { key: string; title: string; run: LearnRunView | null; songs: LearnSuggestionView[] };

/** The Songs to learn list, grouped by run (newest first), then "Added from plans", then runs whose row was capped. */
function groupsOf(list: LearnListView): Group[] {
  const groups: Group[] = list.runs.map((run) => ({ key: run.runId, title: COPY.runHeading(run.number), run, songs: list.suggestions.filter((s) => s.runId === run.runId) }));
  const fromPlans = list.suggestions.filter((s) => s.runId === null && s.songSource === "plan");
  const earlier = list.suggestions.filter((s) => s.runId === null && s.songSource !== "plan");
  if (fromPlans.length) groups.push({ key: "plans", title: PLAYLIST_COPY.addedFromPlans, run: null, songs: fromPlans });
  if (earlier.length) groups.push({ key: "earlier", title: COPY.earlierRuns, run: null, songs: earlier });
  return groups;
}

/**
 * Songs to learn (docs/playlist-architecture.md §7): the "Find songs to learn" button starts a learn run; its steps stream
 * live (the plan's step view, reused); the suggestions are kept in a list grouped by run, with Learned, Not for me and
 * Undo. Every state in §7.4: idle, running, done, fallback, nothing new, limit (both scopes), Qloo down, error, empty
 * Repertoire, empty history, list full. Plain shadcn; the look comes later.
 */
export function LearnPanel({ songCount, hasPlaylist, onSongsChanged }: { songCount: number; hasPlaylist: boolean; onSongsChanged: () => void }) {
  const [list, setList] = useState<LearnListView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [live, setLive] = useState<LearnLive | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [replays, setReplays] = useState<Record<string, { live: LearnLive | null; state: "loading" | "open" | "failed" }>>({});
  const [folds, setFolds] = useState<Record<string, boolean>>({});
  const focusAfter = useRef<string | null>(null);
  const mounted = useRef(true);
  const joined = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const result = await loadLearn();
    if (!mounted.current) return;
    if (result.ok) {
      setList(result.list);
      setLoadError(null);
    } else setLoadError(result.message);
  }, []);

  /** Read a run's events into the page: steps, totals, then the end. A broken stream is an error state, never silence. */
  const consume = useCallback(
    async (events: AsyncGenerator<LearnStreamEvent>) => {
      setRunning(true);
      let ended = false;
      try {
        for await (const event of events) {
          if (!mounted.current) return;
          if (event.type === "end") ended = true;
          setLive((current) => applyLearnEvent(event.type === "run" ? emptyLive() : (current ?? emptyLive()), event));
        }
      } catch {
        // handled below as a broken stream
      }
      if (!mounted.current) return;
      if (!ended) setNotice({ kind: "error", message: COPY.errors.unavailable });
      setRunning(false);
      await refresh();
    },
    [refresh],
  );

  // Load the list; a run already going (a reload, a second tab) is joined.
  useEffect(() => {
    mounted.current = true;
    void loadLearn().then((result) => {
      if (!mounted.current) return;
      if (result.ok) setList(result.list);
      else setLoadError(result.message);
    });
    return () => {
      mounted.current = false;
    };
  }, []);

  const runningId = list?.running?.runId ?? null;
  useEffect(() => {
    if (!runningId || running || joined.current === runningId) return;
    joined.current = runningId;
    void joinLearn(runningId).then((result) => {
      if (!mounted.current) return;
      // Going on another server: no live feed here, so poll the list until it finishes.
      if (result.ok) void consume(result.events);
    });
  }, [runningId, running, consume]);
  useEffect(() => {
    if (!runningId || running) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [runningId, running, refresh]);

  useEffect(() => {
    const target = focusAfter.current;
    if (!target || busy) return;
    focusAfter.current = null;
    document.querySelector<HTMLElement>(`[data-focus-id="${target}"]`)?.focus();
  }, [list, busy]);

  async function start() {
    setNotice(null);
    setInfo("");
    setLive(emptyLive());
    setRunning(true);
    const result = await startLearn(pageFaults());
    if (!mounted.current) return;
    if (result.ok) {
      joined.current = "started";
      await consume(result.events);
      return;
    }
    setRunning(false);
    setLive(null);
    setNotice(noticeFor(result));
    if (result.code === "already_running" && typeof result.extra.runId === "string") {
      void refresh();
    }
  }

  const songs = list?.suggestions ?? [];
  const pendingCount = songs.filter((s) => s.status === "pending").length;
  const full = list ? pendingCount >= list.pending.max : false;
  const limit = list?.limit;
  const limited = limit !== undefined && limit.remaining === 0;
  const enough = hasPlaylist && songCount >= MIN_SONGS;
  const groups = useMemo(() => (list ? groupsOf(list) : []), [list]);

  async function change(song: LearnSuggestionView, status: "pending" | "learned" | "dismissed") {
    setBusy(true);
    setInfo("");
    const result = await patchSuggestion(song.id, status);
    if (!mounted.current) return;
    if (result.ok) {
      setList((current) => (current ? { ...current, suggestions: current.suggestions.map((s) => (s.id === song.id ? { ...result.suggestion, isNew: s.isNew } : s)) } : current));
      if (status === "learned") {
        setInfo(COPY.movedToSung(song.title));
        focusAfter.current = `undo-${song.id}`;
      } else if (status === "dismissed") {
        setInfo(COPY.dismissedDone(song.title));
        const pending = groups.filter((g, i) => folds[g.key] ?? (!g.run || i === 0)).flatMap((g) => g.songs).filter((s) => s.status === "pending" && s.id !== song.id);
        const next = pending.find((_, i, all) => all[i - 1]?.id === song.id) ?? pending[0];
        focusAfter.current = next ? `learned-${next.id}` : "learn-run-button";
      } else {
        setInfo(COPY.undone(song.title));
        focusAfter.current = `learned-${song.id}`;
      }
      if (status === "learned" || song.status === "learned") onSongsChanged();
    } else {
      setInfo(result.message);
      if (result.status === 404) void refresh();
    }
    setBusy(false);
  }

  async function replay(run: LearnRunView) {
    if (replays[run.runId]?.state === "open") {
      setReplays((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== run.runId)));
      return;
    }
    setReplays((current) => ({ ...current, [run.runId]: { live: null, state: "loading" } }));
    const result = await joinLearn(run.runId);
    if (!mounted.current) return;
    if (!result.ok) {
      setReplays((current) => ({ ...current, [run.runId]: { live: null, state: "failed" } }));
      return;
    }
    let state = emptyLive();
    for await (const event of result.events) state = applyLearnEvent(state, event);
    if (mounted.current) setReplays((current) => ({ ...current, [run.runId]: { live: state, state: "open" } }));
  }

  const buttonLabel = running ? COPY.finding : list && list.runs.length > 0 ? PLAYLIST_COPY.findMore : PLAYLIST_COPY.findToLearn;
  const reason = !enough ? (hasPlaylist ? COPY.needSongs(MIN_SONGS) : COPY.needRepertoire) : full && list ? COPY.errors.listFull(list.pending.max) : null;
  const lastRun = list?.runs.find((r) => r.status === "done" || r.status === "fallback");

  return (
    <section aria-labelledby="learn-heading" className="max-w-2xl space-y-4" data-testid="learn-section">
      <div className="space-y-1">
        <h2 id="learn-heading" className="text-xl font-semibold">
          {PLAYLIST_COPY.toLearn}
        </h2>
        <p className="text-sm text-muted-foreground">{COPY.intro}</p>
      </div>

      {!list && !loadError && (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-9 w-56" />
        </div>
      )}
      {loadError && !list && (
        <Alert variant="destructive" className={DESTRUCTIVE}>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {(list || loadError) && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="button" data-testid="learn-run-button" data-focus-id="learn-run-button" disabled={running || Boolean(reason) || limited || !list} onClick={() => void start()}>
              {buttonLabel}
            </Button>
            {limit && !running && !limited && <span className="text-sm text-muted-foreground">{COPY.runsLeft(limit.remaining)}</span>}
          </div>

          {reason && (
            <p className="text-sm text-muted-foreground" data-testid="learn-reason">
              {reason}
            </p>
          )}
          {!reason && list && list.runs.length === 0 && songs.length === 0 && !running && !live && (
            <p className="text-sm text-muted-foreground" data-testid="learn-first-time">
              {COPY.firstTime}
            </p>
          )}
          {!running && lastRun && !live && (
            <p className="text-sm text-muted-foreground" data-testid="learn-last-run">
              {COPY.lastRun(dayOf(lastRun.startedAt), lastRun.newCount)}
            </p>
          )}

          {running && (
            <div role="status" className="space-y-1" data-testid="learn-running">
              <p className="text-sm font-medium">{COPY.running}</p>
              <p className="text-sm text-muted-foreground">{COPY.runningHint}</p>
            </div>
          )}

          {notice?.kind === "limit" && (
            <Alert data-testid="learn-limit" data-scope={notice.scope}>
              <AlertTitle>{COPY.limitTitle[notice.scope]}</AlertTitle>
              <AlertDescription>{notice.message}</AlertDescription>
            </Alert>
          )}
          {limited && !notice && limit && (
            <Alert role="status" data-testid="learn-limit" data-scope="repertoire">
              <AlertTitle>{COPY.limitTitle.repertoire}</AlertTitle>
              <AlertDescription>{COPY.limitMessage("repertoire", limit.retryInMinutes ?? 1, limit.max)}</AlertDescription>
            </Alert>
          )}
          {notice?.kind === "qloo" && (
            <Alert variant="destructive" className={DESTRUCTIVE} data-testid="learn-end" data-state="qloo">
              <AlertTitle>{COPY.qlooDownTitle}</AlertTitle>
              <AlertDescription>
                <p>{notice.message}</p>
                <p data-testid="learn-safe">
                  {COPY.songsSafe} {COPY.notCounted}
                </p>
              </AlertDescription>
            </Alert>
          )}
          {notice?.kind === "error" && (
            <Alert variant="destructive" className={DESTRUCTIVE} data-testid="learn-end" data-state="error">
              <AlertTitle>{COPY.errorTitle}</AlertTitle>
              <AlertDescription>
                <p>{notice.message}</p>
                <p data-testid="learn-safe">{COPY.songsSafe}</p>
              </AlertDescription>
            </Alert>
          )}
          {notice?.kind === "info" && (
            <Alert role="status" data-testid="learn-end" data-state="info">
              <AlertDescription>{notice.message}</AlertDescription>
            </Alert>
          )}
          {live?.end && !running && <EndNotice end={live.end} />}

          {live && (running || live.steps.length > 0) && <RunFeed live={live} heading={live.number ? COPY.runHeading(live.number) : COPY.starting} running={running} />}
        </div>
      )}

      <div role="status" aria-live="polite" className="text-sm empty:hidden" data-testid="learn-info">
        {info}
      </div>

      {groups.map((group, index) => {
        const dismissed = group.songs.filter((s) => s.status === "dismissed");
        const shown = group.songs.filter((s) => s.status !== "dismissed");
        const run = group.run;
        const open = run ? replays[run.runId] : undefined;
        // The newest run is open and older runs fold (B-030); a group the performer opened or closed stays that way.
        const expanded = folds[group.key] ?? (!run || index === 0);
        return (
          <Collapsible key={group.key} open={expanded} onOpenChange={(next) => setFolds((current) => ({ ...current, [group.key]: next }))} className="space-y-1" data-testid="learn-group" data-run={run?.number ?? group.key} data-open={expanded ? "true" : "false"}>
            <div className="space-y-1">
              <h3 className="text-base font-semibold">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="group -ml-2 h-auto px-2 py-1 text-base font-semibold" data-testid="learn-group-toggle">
                    <ChevronRightIcon aria-hidden className="transition-transform group-data-[state=open]:rotate-90" />
                    {group.title}
                  </Button>
                </CollapsibleTrigger>
              </h3>
              {run && <p className="text-sm text-muted-foreground">{runMeta(run)}</p>}
            </div>
            <CollapsibleContent className="space-y-1">
              {run && run.status !== "running" && (
                <Button type="button" variant="link" size="sm" className="h-auto px-0" aria-expanded={open?.state === "open"} onClick={() => void replay(run)} disabled={!run.stepsKept}>
                  {open?.state === "open" ? COPY.hideSteps : run.stepsKept ? COPY.replay : COPY.stepsPruned}
                </Button>
              )}
              {open?.state === "loading" && <p className="text-sm text-muted-foreground">{COPY.replayLoading}</p>}
              {open?.state === "failed" && <p className="text-sm text-destructive">{COPY.replayFailed}</p>}
              {open?.state === "open" && open.live && <RunFeed live={open.live} heading={`${COPY.runHeading(run!.number)}: ${COPY.stepsHeading}`} running={false} />}
              {shown.length > 0 ? (
                <ul aria-label={group.title} className="divide-y">
                  {shown.map((song) => (
                    <LearnSongCard key={song.id} song={song} busy={busy} onStatus={(s, status) => void change(s, status)} />
                  ))}
                </ul>
              ) : (
                run && dismissed.length === 0 && <p className="text-sm text-muted-foreground">{run.status === "failed" ? COPY.errorTitle : COPY.nothingNewTitle}</p>
              )}
              {dismissed.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="link" size="sm" className="group h-auto px-0 text-muted-foreground">
                      <ChevronRightIcon aria-hidden className="transition-transform group-data-[state=open]:rotate-90" />
                      {COPY.dismissedGroup(dismissed.length)}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul aria-label={`${group.title}: ${COPY.notForMe}`} className="divide-y">
                      {dismissed.map((song) => (
                        <LearnSongCard key={song.id} song={song} busy={busy} onStatus={(s, status) => void change(s, status)} />
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </section>
  );
}

/** A refusal before a run starts, as the run bar says it (docs §7.2). */
function noticeFor(r: Refusal): Notice {
  if (r.status === 429 && r.code === "limit") {
    const scope = (r.extra.limit as { scope?: string } | undefined)?.scope === "ip" ? "ip" : "repertoire";
    return { kind: "limit", scope, message: r.message };
  }
  if (r.code === "empty_playlist" || r.code === "no_playlist" || r.code === "list_full" || r.code === "already_running") return { kind: "info", message: r.message };
  return { kind: "error", message: r.message };
}
