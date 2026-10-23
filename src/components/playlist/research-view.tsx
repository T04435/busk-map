"use client";

import { FansMap } from "@/components/honeycomb/repertoire/fans-map";
import { LIST_MAX_HEIGHT, RepertoireResultsLayout } from "@/components/honeycomb/repertoire/repertoire-sections";
import { artist as mentionArtist, mentionsIn, song as mentionSong, spotifyHref, type Mention } from "@/lib/mention";
import { AgentLockup } from "@/components/honeycomb/agent-lockup";
import { PlanAlert } from "@/components/honeycomb/plan-alert";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TrackResult } from "@/components/forms/repertoire-api";
import { ArtistChip, ArtistChipList } from "@/components/honeycomb/artist-chip";
import { ArtistProfile, AudienceTags } from "@/components/honeycomb/artist-profile";
import { InfoTag } from "@/components/honeycomb/info-tag";
import { Reason } from "@/components/honeycomb/reason";
import { SongActions } from "@/components/honeycomb/song-actions";
import { SongRow } from "@/components/honeycomb/song-row";
import { SongTag } from "@/components/honeycomb/song-tag";
import { LeanBar } from "@/components/honeycomb/lean-bar";
import { PageHeader } from "@/components/honeycomb/page-header";
import { ArtistPicker, typedArtists, type PickedArtist } from "@/components/landing/artist-picker";
import { SongSearch } from "@/components/landing/song-search";
import { AgentStepStream, applyStreamEvent, type AgentStep } from "@/components/plan/agent-steps";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ZERO_LEARN_TOTALS, type LearnListView, type LearnStreamEvent } from "@/lib/learn-schema";
import { PLAYLIST_COPY as COPY } from "@/lib/playlist-copy";
import { playlistSongKey, type LearnSuggestionView, type PlaylistView } from "@/lib/playlist-schema";
import { fansMapProps } from "@/lib/fans-map";
import { OFFLINE_TEST_ARTIST, researchUsable, researchWaiting } from "@/lib/repertoire-research";
import { toRepertoireView, type LearnSong, type RepertoireView } from "@/lib/repertoire-research-view";
import { parseSpotifyArtistId, spotifyArtistUrl } from "@/lib/spotify-link";
import { joinLearn, loadLearn, pageFaults, patchSuggestion, sendResearchInput, startResearch, type ResearchAnswer } from "./learn-api";
import { ResearchAsk } from "./research-ask";
import { REPERTOIRE_STEPS } from "@/components/honeycomb/repertoire/repertoire-research";
import { ResearchFunnel } from "./learn-feed";
import { QlooCandidates, RESEARCH_H2 as H2 } from "./qloo-prompts";
import { addSong, forgetPlaylist, loadPlaylist, moveSong, removeSong, savePlaylist } from "./playlist-api";

/** Where focus goes when a row leaves its list (B-016): the next row's action, else the previous one's, else the page's main field. */
function nextFocus(rows: readonly { id: string }[], id: string, action: "remove" | "move"): string {
  const i = rows.findIndex((r) => r.id === id);
  const near = rows[i + 1] ?? rows[i - 1];
  return near ? `${action}-${near.id}` : MAIN_FIELD;
}
const MAIN_FIELD = "main-field";
const removed = (title: string) => `Removed ${title}.`;
const added = (title: string) => `Added ${title}.`;
const moved = (title: string) => `${title} moved to ${COPY.canSing}.`;

/** The action button inside a row (rows carry `data-focus-row`; SongActions names its buttons "Remove X" and "Move to can sing: X"). */
function focusTarget(target: string): HTMLElement | null {
  if (target === MAIN_FIELD) return document.querySelector<HTMLElement>("#spotify-link, [data-focus-id='add-song']");
  const m = /^(remove|move)-(.+)$/.exec(target);
  if (!m) return null;
  return document.querySelector<HTMLElement>(`[data-focus-row="${CSS.escape(m[2])}"] [aria-label^="${m[1] === "remove" ? "Remove" : "Move to"}"]`);
}

/**
 * One suggestion in Songs you should learn (docs/playlist-architecture.md §7.3): THE song row with its tags (New, Learned),
 * the model's reason with the artists behind it, the evidence as info tags (builds on, the crowd, growth, rising, source),
 * and the actions: Learn it, Learned and Not for me on a pending song, Undo on a learned or dismissed one.
 */
function SuggestionRow({ song, media, known, busy, onStatus }: { song: LearnSuggestionView; /** What the view model knows of it: the artist photo and the Spotify link (U03, U06). */ media?: LearnSong; /** The artists and songs this page knows, for the names inside the reason (U05). */ known: readonly Mention[]; busy: boolean; onStatus: (song: LearnSuggestionView, status: "pending" | "learned" | "dismissed") => void }) {
  const L = COPY.learn;
  const go = (status: "pending" | "learned" | "dismissed") => () => {
    if (!busy) onStatus(song, status);
  };
  // U05: the names inside the reason become their mentions where they stand; nothing is tacked on after it.
  const entities: Mention[] = [
    ...(media?.because ?? []).map((a) => mentionArtist(a.name, { image: a.image, href: (a as { href?: string | null }).href })),
    mentionArtist(song.artist, { image: media?.artistImage, href: media?.artistHref }),
    ...known,
  ];
  const reasonText = song.reason && song.because && !song.reason.includes(song.because) && song.basedOn.length === 0 ? `${song.reason} ${song.because}.` : song.reason;
  const info = [
    ...song.basedOn.filter((b) => b.kind === "learned").map((b) => <InfoTag key={`b-${b.name}`}>{L.buildsOn(b.name)}</InfoTag>),
    ...song.basedOn.filter((b) => b.kind === "crowd").map((b) => <InfoTag key={`c-${b.name}`}>{L.crowdAt(b.name)}</InfoTag>),
    ...(song.growth !== null ? [<InfoTag key="growth">{L.growth}</InfoTag>] : []),
    ...(song.trendDelta !== null ? [<InfoTag key="rising">{L.rising(song.trendDelta)}</InfoTag>] : []),
    // U15: Spotify and Last.fm show as the row's source logo only; a song added from a plan still says so.
    ...(song.songSource === "plan" ? [<InfoTag key="source">{L.source.plan}</InfoTag>] : []),
  ];
  const pending = song.status === "pending";
  return (
    <li data-testid="learn-card" data-song={song.title} data-artist={song.artist} data-status={song.status}>
      <SongRow
        as="div"
        title={song.title}
        artist={song.artist}
        year={song.year}
        durationMs={song.durationMs}
        image={song.image ?? media?.image}
        artistImage={media?.artistImage}
        artistHref={media?.artistHref}
        href={media?.href ?? spotifyHref(song.sourceUrl) ?? undefined}
        source={media?.source ?? (song.songSource === "plan" ? undefined : song.songSource)}
        muted={song.status === "dismissed"}
        tags={song.status === "learned" ? <SongTag kind="learned" /> : undefined}
        info={info}
        reason={<Reason text={mentionsIn(reasonText, entities)} />}
        actions={<SongActions title={song.title} artist={song.artist} disabled={busy} learnIt onLearned={pending ? go("learned") : undefined} onDismiss={pending ? go("dismissed") : undefined} onUndo={pending ? undefined : go("pending")} />}
      />
    </li>
  );
}

/** A long list gets a filter (U37) once it passes this many rows. */
const FILTER_AT = 20;

/** A song list in the shared ScrollArea (U37, U41): grows to its max height, then scrolls; the heading, filter and actions stay outside it. */
function ListScroll({ label, maxHeight = LIST_MAX_HEIGHT, children }: { label: string; maxHeight?: string; children: ReactNode }) {
  return (
    <ScrollArea label={label} maxHeight={maxHeight} className="border-y border-border" data-testid="list-scroll">
      <div className="pr-3 pl-2">{children}</div>
    </ScrollArea>
  );
}

const R = COPY.research;
/** How often the list is read while a joined run is going on another instance (409 running_elsewhere). */
const ELSEWHERE_POLL_MS = 3000;
/** shadcn's destructive description is destructive/90 (4.49:1): full strength passes AA. */
const DESTRUCTIVE = "*:data-[slot=alert-description]:text-destructive";

const stepsOf = (events: readonly LearnStreamEvent[]): AgentStep[] => events.reduce<AgentStep[]>((steps, e) => applyStreamEvent(steps, e), []);

/** A results section: its heading, and a skeleton until its step has landed (null). */
function Section({ id, title, ready, live, children, testId }: { id: string; title: string; ready: boolean; live: boolean; children: ReactNode; testId: string }) {
  // Outside a run, a section with nothing yet (a Repertoire made before research) is left out rather than skeletoned.
  if (!ready && !live) return null;
  return (
    <section aria-labelledby={id} className="w-full space-y-3 border-t-2 border-rule pt-6" data-testid={testId} data-ready={ready ? "true" : "false"}>
      <h2 id={id} className={H2}>
        {title}
      </h2>
      {ready ? (
        children
      ) : (
        <div aria-hidden="true" className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      )}
    </section>
  );
}

/**
 * The Repertoire page as Repertoire research (hackathons/qloo-2026/repertoire-research-spec.md): ONE input, the Spotify
 * artist link. Submitting it starts a streamed research run: the research on top while it runs, then the results on top
 * with the research below it ("How we built your Repertoire", always shown). Rendered from lib/repertoire-research-view.ts, with
 * plain existing pieces (PageHeader, HexCell, Chip, LeanBar, AgentStepStream, the learn funnel); BRAND restyles later.
 */
export function ResearchView() {
  const [playlist, setPlaylist] = useState<PlaylistView | null>(null);
  const [list, setList] = useState<LearnListView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [events, setEvents] = useState<LearnStreamEvent[] | null>(null);
  const [replay, setReplay] = useState<LearnStreamEvent[] | null>(null);
  const [running, setRunning] = useState(false);
  /** The last stream ended with no `end`: the run is shown stopped (the step cut short, Try again), never as still going. */
  const [cut, setCut] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [changingLink, setChangingLink] = useState(false);
  const [actName, setActName] = useState("");
  const [artists, setArtists] = useState<PickedArtist[]>([]);
  const [artistQuery, setArtistQuery] = useState("");
  const [canSingQuery, setCanSingQuery] = useState("");
  const [offline, setOffline] = useState(false);
  const mounted = useRef(true);
  const joined = useRef<string | null>(null);
  const focusAfter = useRef<string | null>(null);

  const fill = (view: PlaylistView | null) => {
    setActName(view?.actName ?? "");
    setArtists((view?.soundsLike ?? []).map((a): PickedArtist => ({ name: a.name, spotifyId: a.spotifyId ?? null, qlooId: a.qlooId ?? null, image: a.image ?? null })));
    setArtistQuery("");
  };

  const apply = useCallback(([p, l]: [Awaited<ReturnType<typeof loadPlaylist>>, Awaited<ReturnType<typeof loadLearn>>]) => {
    if (!mounted.current) return;
    if (p.ok) {
      setPlaylist(p.playlist);
      fill(p.playlist);
    } else setNotice({ kind: "error", text: p.message });
    if (l.ok) setList(l.list);
    setLoaded(true);
  }, []);
  const reload = useCallback(() => Promise.all([loadPlaylist(), loadLearn()]).then(apply), [apply]);

  /** Read a run's events into the page. A broken stream is an error, never silence. */
  const consume = useCallback(
    async (stream: AsyncGenerator<LearnStreamEvent>) => {
      setRunning(true);
      setCut(false);
      let ended = false;
      try {
        for await (const event of stream) {
          if (!mounted.current) return;
          if (event.type === "end") ended = true;
          setEvents((current) => (event.type === "run" ? [event] : [...(current ?? []), event]));
        }
      } catch {
        // below
      }
      if (!mounted.current) return;
      // A stream that ends with no `end` (dropped, or the server stopped mid-step) is a stopped run: the feed's own alert says so.
      if (!ended) setCut(true);
      setRunning(false);
      await reload();
    },
    [reload],
  );

  useEffect(() => {
    mounted.current = true;
    void Promise.all([loadPlaylist(), loadLearn()]).then(apply);
    // Offline test mode offers the mock artist link (never on a live server).
    void fetch("/api/health", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((h: { offline?: boolean } | null) => mounted.current && setOffline(Boolean(h?.offline)))
      .catch(() => {});
    return () => {
      mounted.current = false;
    };
  }, [apply]);

  // A run already going (a reload, a second tab) is joined. One going on another server instance (or one whose function was
  // stopped, until the stale sweep marks it failed) is a 409 running_elsewhere: the list is polled until the run leaves
  // `running`, then it is replayed (its end, or the failed state the sweep gave it).
  const runningId = list?.running?.runId ?? null;
  useEffect(() => {
    if (!runningId || running || joined.current === runningId) return;
    joined.current = runningId;
    const still = () => mounted.current && joined.current === runningId;
    void (async () => {
      let r = await joinLearn(runningId);
      while (!r.ok && r.code === "running_elsewhere" && still()) {
        await new Promise((resolve) => setTimeout(resolve, ELSEWHERE_POLL_MS));
        if (!still()) return;
        const l = await loadLearn();
        if (!still()) return;
        if (l.ok && l.list.running?.runId === runningId) continue;
        r = await joinLearn(runningId);
      }
      if (r.ok && still()) void consume(r.events);
    })();
  }, [runningId, running, consume]);

  // The folded research of a saved run: its stored steps, replayed once (no model, no Qloo).
  const snapshotRun = playlist?.research?.runId ?? null;
  useEffect(() => {
    if (!snapshotRun || events || running) return;
    let live = true;
    void joinLearn(snapshotRun).then(async (r) => {
      if (!r.ok) return;
      const all: LearnStreamEvent[] = [];
      for await (const e of r.events) all.push(e);
      if (live && mounted.current) setReplay(all);
    });
    return () => {
      live = false;
    };
  }, [snapshotRun, events, running]);

  const view: RepertoireView = useMemo(
    () => toRepertoireView({ snapshot: playlist?.research ?? null, events, playlist, suggestions: running ? null : (list?.suggestions ?? null), cut: cut && !running }),
    [playlist, events, list, running, cut],
  );

  useEffect(() => {
    const target = focusAfter.current;
    if (!target || busy) return;
    focusAfter.current = null;
    focusTarget(target)?.focus();
  }, [playlist, busy]);

  async function start(body: { link?: string; refresh?: boolean; mode?: "full" | "more"; qlooChoice?: { id: string } | { none: true }; genre?: string }) {
    setNotice(null);
    setInfo("");
    setCut(false);
    setRunning(true);
    setEvents([]);
    const result = await startResearch(body, pageFaults());
    if (!mounted.current) return;
    if (result.ok) {
      joined.current = "started";
      setChangingLink(false);
      await consume(result.events);
      return;
    }
    setRunning(false);
    setEvents(null);
    setNotice({ kind: result.code === "up_to_date" || result.code === "already_running" ? "info" : "error", text: result.message });
  }

  /** The answer to a run that waits for input: the same run carries on in the same panel. */
  async function answer(runId: string, body: ResearchAnswer) {
    setNotice(null);
    setInfo("");
    setRunning(true);
    const result = await sendResearchInput(runId, body, pageFaults());
    if (!mounted.current) return;
    if (result.ok) {
      joined.current = "started";
      await consume(result.events);
      return;
    }
    setRunning(false);
    setNotice({ kind: result.code === "already_running" ? "info" : "error", text: result.message });
  }

  function submitLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = parseSpotifyArtistId(link.trim());
    if (!id) return setNotice({ kind: "error", text: R.errors.badLink });
    const same = playlist?.research?.spotifyArtistId === id;
    void start({ link: id, ...(same ? { refresh: true } : {}) });
  }

  async function act(action: () => Promise<{ ok: true; playlist: PlaylistView | null } | { ok: false; message: string }>, done?: string) {
    setBusy(true);
    try {
      const result = await action();
      if (result.ok) {
        setPlaylist(result.playlist);
        setNotice(null);
        if (done) setInfo(done);
        return true;
      }
      setNotice({ kind: "error", text: result.message });
      focusAfter.current = null;
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function changeSuggestion(song: LearnSuggestionView, status: "pending" | "learned" | "dismissed") {
    setBusy(true);
    const result = await patchSuggestion(song.id, status);
    if (mounted.current) {
      if (result.ok) {
        setInfo(status === "learned" ? COPY.learn.movedToSung(song.title) : status === "dismissed" ? COPY.learn.dismissedDone(song.title) : COPY.learn.undone(song.title));
        await reload();
      } else setInfo(result.message);
      setBusy(false);
    }
  }

  const research = playlist?.research ?? null;
  const hasContent = view.phase !== "empty" || (playlist?.songs.length ?? 0) > 0 || (list?.suggestions.length ?? 0) > 0;
  const showForm = !running && (!research || changingLink);
  const stopped = cut && !running && events !== null && !view.end;
  const live = running || (events !== null && !view.end && !stopped);
  /** Try again after a stopped run: the same kind of run, for the same link. */
  const retryCut = () => {
    const kind = events?.find((e) => e.type === "run");
    const id = playlist?.spotifyArtistId ?? research?.spotifyArtistId ?? parseSpotifyArtistId(link.trim());
    if (kind?.type === "run" && kind.inputs.kind === "more") void start({ mode: "more" });
    else if (id) void start({ link: id, refresh: true });
  };
  const feedEvents = events && events.length > 0 ? events : replay;
  const feed = feedEvents ? stepsOf(feedEvents) : [];
  const songs = playlist?.songs ?? [];
  const keys = new Set(songs.map((s) => playlistSongKey(s.artist, s.title)));
  const pending = (list?.suggestions ?? []).filter((s) => s.status !== "dismissed");
  const dismissed = (list?.suggestions ?? []).filter((s) => s.status === "dismissed");
  const limit = list?.limit;
  const r = view.results;
  // "Where your fans are": the saved world map (no city, no switch).
  const mapProps = r.fansMap ? fansMapProps(r.fansMap) : null;
  const learnMedia = new Map((r.toLearn ?? []).map((s) => [s.id, s]));
  // Every artist and song this page knows, so a reason's names can be drawn in place (U05).
  const known: Mention[] = [
    ...(r.profile ? [mentionArtist(r.profile.name, { image: r.profile.image, href: r.profile.href })] : []),
    ...[...(r.soundsLike ?? []), ...(r.fansLove ?? [])].map((a) => mentionArtist(a.name, { image: a.image, href: (a as { href?: string | null }).href })),
    ...[...(r.canSing ?? []), ...(r.learned ?? []), ...(r.toLearn ?? [])].map((x) => mentionSong(x.title, { artist: x.artist, image: x.image, href: x.href })),
  ];
  const photoOf = new Map((r.soundsLike ?? []).map((a) => [a.name.toLowerCase(), a]));
  const chosenArtists = () => {
    const chosen = [...artists];
    for (const typed of typedArtists(artistQuery)) if (!chosen.some((a) => a.name.toLowerCase() === typed.toLowerCase())) chosen.push({ name: typed, spotifyId: null, image: null });
    return chosen.slice(0, 10);
  };

  const soundsLikePatch = () => chosenArtists().map((a) => ({ name: a.name, ...(a.spotifyId ? { spotifyId: a.spotifyId } : {}), ...(a.qlooId ? { qlooId: a.qlooId } : {}), ...(a.image && /^https:\/\//.test(a.image) ? { image: a.image } : {}) }));
  // The run paused on a question (Qloo wasn't sure which artist is the act), or for input (no taste signal: artists or a genre).
  const waiting = !running && !live ? researchWaiting(research) : null;
  // The run waiting for input: the live one that just paused, else the saved one (a refresh or a later visit).
  const askRun = running || live ? null : view.end ? (view.end.code === "needs_sounds_like" ? view.end.runId : null) : waiting === "input" && research ? research.runId : null;
  // Paused is not done: while the run waits for an answer the page stays the researching layout.
  const active = live || askRun !== null;
  // The pause is brought into view once (smoothly, instantly with reduced motion), not left to the page jumping to its end.
  const askKey = askRun ? `${askRun}:${research?.waiting?.asks ?? 0}` : null;
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!askKey) {
      scrolledTo.current = null;
      return;
    }
    if (scrolledTo.current === askKey) return;
    const frame = requestAnimationFrame(() => {
      const target = document.querySelector('[data-testid="research-ask"]');
      if (!target) return;
      scrolledTo.current = askKey;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [askKey]);
  const askStep = research?.waiting?.step ?? "soundsLike";
  const upcoming = askRun ? REPERTOIRE_STEPS.slice(REPERTOIRE_STEPS.findIndex((s) => s.key === askStep) + 1).map((s) => ({ key: s.key, title: s.title, icon: s.icon })) : undefined;
  const askedFor = research?.steps.qloo?.output?.candidates ?? [];

  const runEvent = feedEvents?.find((e) => e.type === "run");
  const lastTotals = feedEvents?.findLast((e) => e.type === "totals");
  const researchFeed = () =>
    feed.length > 0 ? (
      <div className="grid gap-3">
        {/* The research header lockup (Hive Identity board). */}
        <p className="m-0" data-testid="research-agent">
          <AgentLockup live={active} status={active ? "is researching your act" : undefined} />
        </p>
        <AgentStepStream
          steps={feed}
          model={runEvent?.type === "run" && runEvent.model === "claude" ? "claude" : "mock"}
          phase={live ? "working" : askRun ? "waiting" : stopped ? "stopped" : "done"}
          onRetry={stopped ? retryCut : undefined}
          mode={!events && replay ? "replay" : "live"}
          title={active ? R.heading : R.howBuilt}
          wording={R.waiting}
          footer={<ResearchFunnel kind="learn" totals={lastTotals?.type === "totals" ? lastTotals.totals : ZERO_LEARN_TOTALS} running={active} />}
          upcoming={upcoming}
          renderWaiting={(step) =>
            askRun ? (
              <ResearchAsk
                message={step.summary ?? R.ask.first}
                busy={busy || running}
                onSubmit={(body) => void answer(askRun, body)}
              />
            ) : step.summary ? (
              <p className="m-0 text-[13px] leading-[18px] text-muted-foreground">{step.summary}</p>
            ) : null
          }
        />
      </div>
    ) : null;

  // U38: the profile header (photo, name, genre tags under the name) is the layout's `profile`; Your audience and the act name field have their own slots.
  const profileBlock =
    r.profile || active ? (
      <section aria-label={R.profileHeading} className="w-full" data-testid="research-profile" data-ready={r.profile ? "true" : "false"}>
        <ArtistProfile size="md" profile={r.profile} loading={!r.profile} maxGenres={5} audience={false} summary={false} />
      </section>
    ) : null;
  const audienceBlock = r.profile ? <AudienceTags profile={r.profile} /> : null;
  const actNameBlock =
    r.profile && playlist && !active ? (
      <div className="flex max-w-md flex-wrap items-end gap-2" data-testid="research-act-name">
        <div className="min-w-0 flex-1 basis-56 space-y-1.5">
          <Label htmlFor="act-name">{R.actName}</Label>
          <Input id="act-name" value={actName} maxLength={80} onChange={(e) => setActName(e.target.value)} aria-describedby="act-name-hint" />
          <p id="act-name-hint" className="text-xs text-muted-foreground">
            {R.actNameHint}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || actName.trim() === (playlist.actName ?? "") || !actName.trim()}
          onClick={() => void act(() => savePlaylist({ revision: playlist.revision, actName: actName.replace(/\s+/g, " ").trim() }), COPY.act.savedPage)}
        >
          {R.saveActName}
        </Button>
      </div>
    ) : null;
  const canSingQ = canSingQuery.trim().toLowerCase();
  const canSingShown = canSingQ ? (r.canSing ?? []).filter((row) => [row.title, row.artist].some((text) => text.toLowerCase().includes(canSingQ))) : (r.canSing ?? []);
  // U37: the filter (once the list is long) sits above the ScrollArea, under the heading.
  const canSingFilter =
    (r.canSing?.length ?? 0) > FILTER_AT ? (
      <Input type="search" value={canSingQuery} onChange={(e) => setCanSingQuery(e.target.value)} aria-label={COPY.filterLabel} placeholder={COPY.filterPlaceholder} className="max-w-sm" data-testid="folded-list-filter" />
    ) : null;
  const canSingBlock = (
    <>
      {/* 2. Songs you can sing: your own songs straight in, removable. */}
      <Section id="research-can-sing" title={COPY.canSing} ready={r.canSing !== null} live={active} testId="research-can-sing">
        {playlist && <p className="text-sm text-muted-foreground tabular-nums">{COPY.count(songs.length)}</p>}
        {r.canSing && r.canSing.length > 0 ? (
          <>
            {canSingFilter}
            {canSingQ && canSingShown.length === 0 ? (
              <p className="text-sm text-muted-foreground">{COPY.noFilterMatch}</p>
            ) : (
              <ListScroll label={COPY.canSing}>
                <ul aria-label={COPY.canSing} className="m-0 list-none divide-y divide-border p-0">
                  {canSingShown.map((song) => (
                    <li key={song.id} data-testid="can-sing-row" data-focus-row={song.id}>
                      <SongRow
                        as="div"
                        title={song.title}
                        artist={song.artist}
                        year={song.year}
                        album={song.album}
                        image={song.image}
                        artistImage={song.artistImage}
                        artistHref={song.artistHref}
                        source={song.source}
                        durationMs={song.durationMs}
                        href={song.href}
                        actions={
                          <SongActions
                            title={song.title}
                            disabled={busy || active}
                            onRemove={() => {
                              if (busy || active) return;
                              focusAfter.current = nextFocus(r.canSing!, song.id, "remove");
                              void act(() => removeSong(song.id), removed(song.title));
                            }}
                          />
                        }
                      />
                    </li>
                  ))}
                </ul>
              </ListScroll>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{COPY.empty}</p>
        )}
        {!active && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="link" size="sm" className="h-auto px-0" data-focus-id="add-song">
                {COPY.searchLabel}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <SongSearch
                artists={[]}
                isAdded={(t: TrackResult) => keys.has(playlistSongKey(t.artists[0]?.name ?? "Unknown artist", t.title))}
                onAdd={(t: TrackResult) =>
                  void act(() => addSong({ title: t.title, artist: t.artists[0]?.name ?? "Unknown artist", source: "spotify", ...(/^[A-Za-z0-9]{22}$/.test(t.id) ? { spotifyTrackId: t.id } : {}), ...(t.durationMs ? { durationMs: t.durationMs } : {}), ...(t.image && /^https:\/\//.test(t.image) ? { image: t.image } : {}) }), added(t.title))
                }
                onAddTyped={(s) => act(() => addSong({ ...s, source: "typed" }), added(s.title))}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </Section>
    </>
  );
  const soundsLikeBlock = (
    <>
      {/* 3. Artists you sound like (editable). */}
      <Section id="research-sounds-like" title={R.soundsLikeHeading} ready={r.soundsLike !== null} live={active} testId="research-sounds-like">
        {active ? (
          <ArtistChipList inline label={R.soundsLikeHeading}>
            {(r.soundsLike ?? []).map((a) => (
              <li key={a.name}>
                <ArtistChip size="xs" name={a.name} image={a.image} href={a.href} />
              </li>
            ))}
          </ArtistChipList>
        ) : (
          <div className="space-y-2">
            <ArtistPicker hideLabel value={artists.map((a) => ({ ...a, image: a.image ?? photoOf.get(a.name.toLowerCase())?.image ?? null }))} onChange={setArtists} query={artistQuery} onQueryChange={setArtistQuery} />
            {playlist && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() =>
                  void act(() => savePlaylist({ revision: playlist.revision, soundsLike: soundsLikePatch() }), COPY.act.savedPage)
                }
              >
                {COPY.act.savePage}
              </Button>
            )}
          </div>
        )}
      </Section>
    </>
  );
  const fansBlock = (
    <>
      {/* 4. Who your fans are. */}
      <Section id="research-fans" title={R.fansHeading} ready={r.fans !== null} live={active} testId="research-fans">
        {r.fans && (r.fans.age.length > 0 || r.fans.gender.length > 0) ? (
          <div className="space-y-3">
            {[r.fans.age, r.fans.gender].map((rows, i) =>
              rows.length ? (
                <ul key={i} aria-label={i === 0 ? "Age lean of your fans" : "Gender lean of your fans"} className="m-0 grid list-none gap-1.5 p-0">
                  {rows.map((row) => (
                    <LeanBar key={row.label} label={row.label} lean={row.lean} max={Math.max(...rows.map((x) => Math.abs(x.lean)))} />
                  ))}
                </ul>
              ) : null,
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No clear lean in Qloo&apos;s data.</p>
        )}
      </Section>
    </>
  );
  const fansMapBlock = (
    <>
      {/* 4b. Where your fans are (U24). BRAND replaces the plain list with the FansMap component. */}
      {mapProps ? (
        // FansMap brings its own heading, Qloo mark and honesty line; the plain Section only holds the place while it loads.
        <div id="research-fans-map" data-testid="research-fans-map" className="w-full space-y-2">
          <FansMap cells={mapProps.cells} cities={mapProps.cities} />
        </div>
      ) : (
        <Section id="research-fans-map" title={R.fansMapHeading} ready={false} live={active} testId="research-fans-map">
          {null}
        </Section>
      )}
    </>
  );
  const fansLoveBlock = (
    <>
      {/* 5. What your fans also love. */}
      <Section id="research-fans-love" title={R.fansLoveHeading} ready={r.fansLove !== null} live={active} testId="research-fans-love">
        <ArtistChipList inline label={R.fansLoveHeading}>
          {(r.fansLove ?? []).map((a) => (
            <li key={a.name}>
              <ArtistChip size="xs" name={a.name} image={a.image} href={a.href} />
            </li>
          ))}
        </ArtistChipList>
      </Section>
    </>
  );
  const toLearnBlock = (
    <>
      {/* 6. Songs you should learn, with "Find more songs to learn". */}
      <Section id="research-to-learn" title={COPY.toLearn} ready={r.toLearn !== null || (!active && (list?.suggestions.length ?? 0) > 0)} live={active} testId="research-to-learn">
        {pending.length > 0 ? (
          <ListScroll label={COPY.toLearn}>
            <ul aria-label={COPY.toLearn} className="m-0 list-none divide-y divide-border p-0">
              {pending.map((song) => (
                <SuggestionRow key={song.id} song={song} media={learnMedia.get(song.id)} known={known} busy={busy || active} onStatus={(s, status) => void changeSuggestion(s, status)} />
              ))}
            </ul>
          </ListScroll>
        ) : (
          <p className="text-sm text-muted-foreground">{COPY.learn.nothingNewTitle}</p>
        )}
        {dismissed.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="link" size="sm" className="h-auto px-0 text-muted-foreground">
                {COPY.learn.dismissedGroup(dismissed.length)}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ListScroll label={COPY.learn.notForMe}>
                <ul aria-label={COPY.learn.notForMe} className="m-0 list-none divide-y divide-border p-0">
                  {dismissed.map((song) => (
                    <SuggestionRow key={song.id} song={song} media={learnMedia.get(song.id)} known={known} busy={busy} onStatus={(s, status) => void changeSuggestion(s, status)} />
                  ))}
                </ul>
              </ListScroll>
            </CollapsibleContent>
          </Collapsible>
        )}
        {researchUsable(research) && !active && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button type="button" data-testid="research-more" disabled={busy || running || limit?.remaining === 0} onClick={() => void start({ mode: "more" })}>
              {R.findMore}
            </Button>
            {limit && <span className="text-sm text-muted-foreground">{COPY.learn.runsLeft(limit.remaining)}</span>}
          </div>
        )}
      </Section>
    </>
  );
  const learnedBlock = (
    <>
      {r.learned && !active && (
        <section aria-labelledby="research-learned" className="w-full space-y-3 border-t-2 border-rule pt-6" data-testid="research-learned">
          <h2 id="research-learned" className={H2}>
            {COPY.learned}
          </h2>
          {r.learned.length === 0 && <p className="text-sm text-muted-foreground">{COPY.emptyLearned}</p>}
          {r.learned.length > 0 && <ListScroll label={COPY.learned} maxHeight="max-h-[280px] lg:max-h-[320px]"><ul aria-label={COPY.learned} className="m-0 list-none divide-y divide-border p-0">
            {r.learned.map((s) => (
              <li key={s.id} data-focus-row={s.id}>
                <SongRow
                  as="div"
                  title={s.title}
                  artist={s.artist}
                  year={s.year}
                  album={s.album}
                  image={s.image}
                  artistImage={s.artistImage}
                  artistHref={s.artistHref}
                  source={s.source}
                  durationMs={s.durationMs}
                  href={s.href}
                  tags={<SongTag kind="learned" />}
                  actions={
                    <SongActions
                      title={s.title}
                      disabled={busy || active}
                      onMoveToCanSing={() => {
                        if (busy || active) return;
                        focusAfter.current = nextFocus(r.learned!, s.id, "move");
                        void act(() => moveSong(s.id, "can_sing"), moved(s.title));
                      }}
                      onRemove={() => {
                        if (busy || active) return;
                        focusAfter.current = nextFocus(r.learned!, s.id, "remove");
                        void act(() => removeSong(s.id), removed(s.title));
                      }}
                    />
                  }
                />
              </li>
            ))}
          </ul></ListScroll>}
        </section>
      )}
    </>
  );
  // U37 to U43: BRAND's rows. The act (profile + act name | Your audience), the fans (who | sound-alikes over also love), the map,
  // the songs (can sing | learn + learned), then the research. The layout puts the research first while it runs (CSS order).
  // U21/U22: the research is always shown, in one surface: no fold, no chevron, no card inside it.
  const researchNode = live || stopped ? researchFeed() : research && feed.length > 0 ? <div data-testid="research-steps">{researchFeed()}</div> : null;
  const showResults = (hasContent || running) && (running || !changingLink);
  const results = (
    <div data-testid="research-results">
      <RepertoireResultsLayout
        phase={active ? "running" : "done"}
        profile={profileBlock}
        actName={actNameBlock}
        audience={audienceBlock}
        fans={r.fans !== null || active ? fansBlock : undefined}
        soundsLike={r.soundsLike !== null || active ? soundsLikeBlock : undefined}
        fansLove={r.fansLove !== null || active ? fansLoveBlock : undefined}
        fansMap={mapProps || active ? fansMapBlock : undefined}
        canSing={r.canSing !== null || active ? canSingBlock : undefined}
        toLearn={!waiting && (r.toLearn !== null || (!active && (list?.suggestions.length ?? 0) > 0) || active) ? toLearnBlock : undefined}
        learned={learnedBlock}
        research={showResults ? researchNode : undefined}
      />
    </div>
  );

  return (
    <div className="space-y-8" data-testid="research-page" data-phase={running || active ? "running" : view.phase}>
      <PageHeader title={COPY.pageTitle} />

      <div role="status" aria-live="polite" className="text-sm empty:hidden" data-testid="research-info">
        {info}
      </div>
      {notice && (
        <Alert variant={notice.kind === "error" ? "destructive" : "default"} className={notice.kind === "error" ? DESTRUCTIVE : undefined} role={notice.kind === "error" ? "alert" : "status"} data-testid="research-notice">
          <AlertDescription>{notice.text}</AlertDescription>
        </Alert>
      )}

      {!loaded ? (
        <div className="space-y-3" aria-busy="true">
          <p className="sr-only" role="status">
            {COPY.loading}
          </p>
          <Skeleton className="h-12 w-full max-w-2xl" />
        </div>
      ) : (
        <>
          {/* Empty state: one field and its example. */}
          {showForm && (
            // Named by its action, so the link field stays the only control called "Your Spotify artist link".
            <form onSubmit={submitLink} className="max-w-2xl space-y-2" aria-labelledby="research-start" data-testid="research-form">
              <Label htmlFor="spotify-link">{R.linkLabel}</Label>
              <div className="flex flex-wrap gap-2">
                <Input id="spotify-link" className="min-w-0 flex-1 basis-64" value={link} onChange={(e) => setLink(e.target.value)} placeholder={R.linkPlaceholder} autoComplete="off" inputMode="url" aria-describedby="spotify-link-hint" />
                <Button id="research-start" type="submit" disabled={running || !link.trim()}>
                  {R.start}
                </Button>
              </div>
              <p id="spotify-link-hint" className="text-sm text-muted-foreground">
                {R.example}
              </p>
              {offline && (
                <Button type="button" variant="link" size="sm" className="h-auto px-0" data-testid="research-test-artist" onClick={() => setLink(spotifyArtistUrl(OFFLINE_TEST_ARTIST.spotifyId))}>
                  {R.exampleTest} ({OFFLINE_TEST_ARTIST.name})
                </Button>
              )}
            </form>
          )}

          {view.end && !view.end.ok && !running && view.end.code === "qloo_budget_spent" && <PlanAlert kind="limit" budget message={view.end.message} testId="research-end" />}
          {view.end && !view.end.ok && !running && view.end.code !== "qloo_budget_spent" && (
            <Alert variant="destructive" className={DESTRUCTIVE} data-testid="research-end" data-code={view.end.code ?? ""}>
              <AlertTitle>{view.end.code === "qloo_unavailable" ? COPY.learn.qlooDownTitle : COPY.learn.errorTitle}</AlertTitle>
              <AlertDescription>
                <p>{view.end.code === "no_match" ? R.errors.noMatch : view.end.message}</p>
                <p>{COPY.learn.songsSafe}</p>
              </AlertDescription>
            </Alert>
          )}
          {view.end?.ok && !running && view.end.code !== "needs_choice" && view.end.code !== "needs_sounds_like" && (
            <p role="status" className="text-sm" data-testid="research-end" data-code={view.end.code ?? ""}>
              {view.end.message}
            </p>
          )}

          {/* The run paused: Qloo wasn't sure which artist is the act. */}
          {waiting === "choice" && research && (
            <QlooCandidates
              candidates={askedFor}
              busy={busy}
              onPick={(id) => void start({ link: research.spotifyArtistId, refresh: true, qlooChoice: { id } })}
              onNone={() => void start({ link: research.spotifyArtistId, refresh: true, qlooChoice: { none: true } })}
            />
          )}

          {/* The results, with the research inside the layout (first while it runs, last when done). */}
          {showResults ? results : researchNode}

          {/* Done: the actions. */}
          {!active && research && (
            <div className="flex max-w-2xl flex-wrap items-center gap-2" data-testid="research-actions">
              <Button type="button" variant="outline" size="sm" disabled={busy || running} onClick={() => void start({ link: research.spotifyArtistId, refresh: true })}>
                {R.refresh}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={busy || running} onClick={() => (setChangingLink(true), setLink(spotifyArtistUrl(research.spotifyArtistId)))}>
                {R.changeLink}
              </Button>
            </div>
          )}
          {playlist && !active && (
            <section className="max-w-2xl">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={busy}>
                    {COPY.forget}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{COPY.forgetTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{COPY.forgetConfirm}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{COPY.forgetCancel}</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() =>
                        void act(async () => {
                          const res = await forgetPlaylist();
                          if (res.ok) {
                            setEvents(null);
                            setReplay(null);
                            setList(null);
                            fill(null);
                          }
                          return res;
                        }, COPY.forgotten)
                      }
                    >
                      {COPY.forgetAction}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          )}
        </>
      )}

    </div>
  );
}
