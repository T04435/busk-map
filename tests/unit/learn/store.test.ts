import { describe, expect, it } from "vitest";
import { ZERO_LEARN_TOTALS } from "@/lib/learn-schema";
import { playlistSongKey } from "@/lib/playlist-schema";
import { LEARN_LIMITS, LEARN_MAX_RUNS, LEARN_MAX_SUGGESTIONS, MAX_SONGS } from "@/server/playlist/config";
import { MemoryLearnStore, PostgresLearnStore } from "@/server/learn/store";
import type { Evidence, FinishRun, NewSuggestion } from "@/server/learn/types";
import { MemoryPlaylistStore } from "@/server/playlist/store";
import { createRateLimiter, learnRunGate } from "@/server/rate-limit";
import { hashToken, newToken } from "@/server/playlist/token";

const DAY = 24 * 60 * 60_000;
const evidence = (over: Partial<Evidence> = {}): Evidence => ({ ranker: "mock", artistFrom: "related_artists", because: ["Paul Kelly"], affinity: 0.5, growth: null, trendDelta: null, basedOn: [], ...over });
let n = 0;
const pick = (title: string, artist = "Gillian Welch", over: Partial<NewSuggestion> = {}): NewSuggestion => ({
  songKey: playlistSongKey(artist, title),
  title,
  artist,
  spotifyTrackId: null,
  qlooArtistId: null,
  year: 1998,
  durationMs: 200_000,
  imageUrl: null,
  sourceUrl: null,
  songSource: "spotify",
  reason: "Because.",
  evidence: evidence(),
  rank: ++n,
  ...over,
});
const inputs = { songs: 5, soundsLike: ["Paul Kelly"], pitches: [] };
const finish = (over: Partial<FinishRun> = {}): FinishRun => ({ status: "done", endCode: null, steps: [], totals: ZERO_LEARN_TOTALS, usage: null, newCount: 0, skippedCount: 0, ...over });

async function make() {
  const playlists = new MemoryPlaylistStore();
  const playlist = await playlists.create(hashToken(newToken()));
  const store = new MemoryLearnStore(playlists);
  return { playlists, playlist, store, id: playlist.id };
}

async function oneRun(store: MemoryLearnStore, id: string, picks: NewSuggestion[], now = Date.now(), over: Partial<FinishRun> = {}) {
  const started = await store.startRun(id, { model: "mock", inputs }, now);
  if (!started.ok) throw new Error("run not started");
  const saved = await store.insertSuggestions(id, started.run.id, picks, now);
  await store.finishRun(started.run.id, finish({ newCount: saved.length, ...over }), now + 1000);
  return { run: started.run, saved };
}

describe("MemoryLearnStore: runs", () => {
  it("numbers runs per Repertoire and admits one running run at a time", async () => {
    const { store, id } = await make();
    const first = await store.startRun(id, { model: "claude", inputs });
    expect(first).toMatchObject({ ok: true, run: { number: 1, status: "running" } });
    const second = await store.startRun(id, { model: "claude", inputs });
    expect(second).toEqual({ ok: false, reason: "already_running", runId: first.ok ? first.run.id : "" });
    await store.finishRun(first.ok ? first.run.id : "", finish());
    expect(await store.startRun(id, { model: "claude", inputs })).toMatchObject({ ok: true, run: { number: 2 } });
    // Another Repertoire has its own numbers and its own running slot.
    const other = await make();
    expect(await other.store.startRun(other.id, { model: "claude", inputs })).toMatchObject({ ok: true, run: { number: 1 } });
  });

  it("marks a run left running past the time cap as failed, which frees the slot", async () => {
    const { store, id } = await make();
    const t0 = 1_000_000;
    const started = await store.startRun(id, { model: "claude", inputs }, t0);
    expect(await store.sweepStale(id, t0 + LEARN_LIMITS.timeoutMs)).toBe(0);
    expect(await store.sweepStale(id, t0 + LEARN_LIMITS.timeoutMs + LEARN_LIMITS.staleGraceMs + 1)).toBe(1);
    expect(await store.getRun(id, started.ok ? started.run.id : "")).toMatchObject({ status: "failed", endCode: "timeout" });
    expect(await store.startRun(id, { model: "claude", inputs }, t0 + LEARN_LIMITS.timeoutMs + LEARN_LIMITS.staleGraceMs + 2)).toMatchObject({ ok: true, run: { number: 2 } });
  });

  it("counts the runs in the window, but not the ones that ended before the model", async () => {
    const { store, id } = await make();
    const now = Date.now();
    await oneRun(store, id, [pick("A")], now - 10 * 60_000);
    await oneRun(store, id, [], now - 5 * 60_000, { status: "failed", endCode: "qloo_unavailable" });
    await oneRun(store, id, [], now - 4 * 60_000, { status: "failed", endCode: "no_match" });
    await oneRun(store, id, [pick("B")], now - 2 * 3_600_000);
    const recent = await store.recentRuns(id, now - 3_600_000);
    expect(recent).toEqual({ count: 1, oldestStartedAt: now - 10 * 60_000 });
    // A run still going counts.
    await store.startRun(id, { model: "claude", inputs }, now - 1000);
    expect((await store.recentRuns(id, now - 3_600_000)).count).toBe(2);
  });
});

describe("the run gate counts stored runs (B-028)", () => {
  it("three runs that ended with Qloo down leave the Repertoire's hour untouched; three real runs fill it", async () => {
    const { store, id } = await make();
    const now = Date.now();
    const gate = async () => learnRunGate({ offline: false, ip: "1.2.3.4", recent: await store.recentRuns(id, now - 3_600_000) }, createRateLimiter(6, 3_600_000), now);
    for (const [i, code] of ["qloo_unavailable", "no_match", "qloo_unavailable"].entries()) await oneRun(store, id, [], now - (10 - i) * 60_000, { status: "failed", endCode: code });
    expect(await gate()).toEqual({ ok: true });
    // A failure that isn't Qloo's (a stream that broke, a timeout) still counts.
    await oneRun(store, id, [], now - 5 * 60_000, { status: "failed", endCode: null });
    await oneRun(store, id, [], now - 4 * 60_000, { status: "failed", endCode: "timeout" });
    await oneRun(store, id, [pick("Counted")], now - 3 * 60_000);
    expect(await gate()).toMatchObject({ ok: false, scope: "repertoire", max: 3 });
  });
});

describe("MemoryLearnStore: no repeats (D9)", () => {
  it("saves a song once per Repertoire whatever its status: a second run never returns an earlier suggestion", async () => {
    const { store, id } = await make();
    const first = await oneRun(store, id, [pick("Orphan Girl"), pick("Elvis Presley Blues")]);
    expect(first.saved.map((s) => s.title)).toEqual(["Orphan Girl", "Elvis Presley Blues"]);
    const [orphan] = first.saved;
    // pending, learned and dismissed all block a repeat
    const learned = await store.setStatus(id, orphan.id, "learned");
    expect(learned.ok).toBe(true);
    const second = await oneRun(store, id, [pick("Orphan Girl"), pick("ORPHAN GIRL (Remastered)"), pick("Elvis Presley Blues"), pick("Fresh One")]);
    expect(second.saved.map((s) => s.title)).toEqual(["Fresh One"]);
    const dismissedId = first.saved[1].id;
    await store.setStatus(id, dismissedId, "dismissed");
    const third = await oneRun(store, id, [pick("Elvis Presley Blues"), pick("Another")]);
    expect(third.saved.map((s) => s.title)).toEqual(["Another"]);
    // the list holds each song once
    const { suggestions } = await store.list(id);
    expect(suggestions.map((s) => s.title).sort()).toEqual(["Another", "Elvis Presley Blues", "Fresh One", "Orphan Girl"]);
  });

  it("skips a song you can already sing, and one whose dismissal was dropped by the size cap", async () => {
    const { store, id, playlists } = await make();
    await playlists.addSong(id, { title: "Jolene", artist: "Dolly Parton", own: false, source: "typed" });
    playlists.dismissedKeys.set(id, new Set([playlistSongKey("Lil Nas X", "Old Town Road")]));
    const run = await oneRun(store, id, [pick("Jolene", "Dolly Parton"), pick("Old Town Road", "Lil Nas X"), pick("New Song")]);
    expect(run.saved.map((s) => s.title)).toEqual(["New Song"]);
  });

  it("history lists every suggestion with its status, newest first, and the keys the cap removed", async () => {
    const { store, id, playlists } = await make();
    playlists.dismissedKeys.set(id, new Set(["x|y"]));
    await oneRun(store, id, [pick("One"), pick("Two")]);
    await oneRun(store, id, [pick("Three")]);
    const h = await store.history(id);
    expect(h.suggestions.map((s) => s.title)).toEqual(["Three", "Two", "One"]);
    expect(h.suggestions.map((s) => s.runNumber)).toEqual([2, 1, 1]);
    expect(h.dismissedKeys).toEqual(["x|y"]);
    expect(h.earlierRuns).toBe(2);
    expect(h.lastRun).toMatchObject({ number: 2, newCount: 1 });
  });
});

describe("MemoryLearnStore: Learned, Not for me, Undo (§1.3)", () => {
  it("Learned moves the song into Songs you can sing (learned, suggested), and Undo takes it out again", async () => {
    const { store, id, playlists } = await make();
    const { saved } = await oneRun(store, id, [pick("Orphan Girl")]);
    const before = (await playlists.get(id))!.revision;
    const result = await store.setStatus(id, saved[0].id, "learned");
    expect(result).toMatchObject({ ok: true, suggestion: { status: "learned" }, song: { title: "Orphan Girl", state: "learned", source: "suggested" } });
    expect((await playlists.songs(id)).map((s) => [s.title, s.state, s.source])).toEqual([["Orphan Girl", "learned", "suggested"]]);
    expect((await playlists.get(id))!.revision).toBe(before + 1);
    const undone = await store.setStatus(id, saved[0].id, "pending");
    expect(undone).toMatchObject({ ok: true, suggestion: { status: "pending", learnedAt: null }, song: null });
    expect(await playlists.songs(id)).toEqual([]);
    expect((await playlists.get(id))!.revision).toBe(before + 2);
  });

  it("Not for me dismisses, Undo brings it back; nothing else is a transition", async () => {
    const { store, id } = await make();
    const { saved } = await oneRun(store, id, [pick("A"), pick("B")]);
    expect(await store.setStatus(id, saved[0].id, "dismissed")).toMatchObject({ ok: true, suggestion: { status: "dismissed" } });
    expect(await store.setStatus(id, saved[0].id, "learned")).toEqual({ ok: false, reason: "invalid" });
    expect(await store.setStatus(id, saved[0].id, "dismissed")).toEqual({ ok: false, reason: "invalid" });
    expect(await store.setStatus(id, saved[0].id, "pending")).toMatchObject({ ok: true, suggestion: { status: "pending", dismissedAt: null } });
    expect(await store.setStatus(id, saved[1].id, "pending")).toEqual({ ok: false, reason: "invalid" });
    expect(await store.setStatus(id, "999", "dismissed")).toEqual({ ok: false, reason: "missing" });
  });

  it("refuses Learned when Songs you can sing already holds 60", async () => {
    const { store, id, playlists } = await make();
    for (let i = 0; i < MAX_SONGS; i++) await playlists.addSong(id, { title: `S${i}`, artist: "A", own: false, source: "typed" });
    const { saved } = await oneRun(store, id, [pick("New")]);
    expect(await store.setStatus(id, saved[0].id, "learned")).toEqual({ ok: false, reason: "full" });
    expect((await store.list(id)).suggestions[0].status).toBe("pending");
  });

  it("a song typed into Songs you can sing marks the matching pending suggestion learned", async () => {
    const { store, id, playlists } = await make();
    await oneRun(store, id, [pick("Orphan Girl")]);
    await playlists.addSong(id, { title: "orphan girl", artist: "gillian welch", own: false, source: "typed" });
    expect((await store.list(id)).suggestions[0]).toMatchObject({ status: "learned" });
  });

  it("isNew is true only for the latest finished run's suggestions", async () => {
    const { store, id } = await make();
    await oneRun(store, id, [pick("Old")]);
    await oneRun(store, id, [pick("Newer")]);
    const list = (await store.list(id)).suggestions;
    expect(list.map((s) => [s.title, s.isNew, s.runNumber])).toEqual([["Newer", true, 2], ["Old", false, 1]]);
    // a failed run after it does not move "New this run" on
    await oneRun(store, id, [], Date.now(), { status: "failed", endCode: "qloo_unavailable" });
    expect((await store.list(id)).suggestions[0].isNew).toBe(true);
  });
});

describe("MemoryLearnStore: retention and caps", () => {
  it("keeps steps for the last 5 runs and 30 days, and keeps the suggestions of older runs", async () => {
    const { store, id } = await make();
    const now = Date.now();
    for (let i = 0; i < 7; i++) await oneRun(store, id, [pick(`Song ${i}`)], now - (7 - i) * 60_000, { steps: [{ type: "status", message: "x" }] });
    const runs = (await store.list(id)).runs;
    expect(runs.map((r) => [r.number, r.stepsKept])).toEqual([[7, true], [6, true], [5, true], [4, true], [3, true], [2, false], [1, false]]);
    expect((await store.list(id)).suggestions).toHaveLength(7);
    // 30 days: a run older than the cutoff loses its steps even among the newest five
    await oneRun(store, id, [], now - 31 * DAY, { steps: [{ type: "status", message: "old" }] });
    expect((await store.getRun(id, (await store.list(id)).runs[0].id))!.steps).not.toBeNull();
    expect(await store.pruneSteps(id, now)).toBe(1);
    expect((await store.list(id)).runs.filter((r) => r.stepsKept).map((r) => r.number)).toEqual([7, 6, 5, 4]);
  });

  it("keeps 50 runs; older run rows go and their suggestions stay under no run", async () => {
    const { store, id } = await make();
    for (let i = 0; i < LEARN_MAX_RUNS + 2; i++) await oneRun(store, id, [pick(`R${i}`)]);
    const list = await store.list(id);
    expect(list.runs).toHaveLength(LEARN_MAX_RUNS);
    expect(list.suggestions).toHaveLength(LEARN_MAX_RUNS + 2);
    expect(list.suggestions.filter((s) => s.runId === null)).toHaveLength(2);
  });

  it("past 400 suggestions the oldest dismissed rows go and their keys keep them from coming back", async () => {
    const { store, id, playlists } = await make();
    const run = await store.startRun(id, { model: "mock", inputs });
    if (!run.ok) throw new Error();
    const rows = Array.from({ length: LEARN_MAX_SUGGESTIONS + 3 }, (_, i) => pick(`Song ${i}`, `Artist ${i}`));
    await store.insertSuggestions(id, run.run.id, rows);
    const all = (await store.list(id)).suggestions;
    for (const s of all.slice(0, 5)) await store.setStatus(id, s.id, "dismissed");
    await store.finishRun(run.run.id, finish());
    const after = (await store.list(id)).suggestions;
    expect(after).toHaveLength(LEARN_MAX_SUGGESTIONS);
    expect(playlists.dismissedKeys.get(id)!.size).toBe(3);
    // a removed dismissal still blocks the song
    const gone = [...playlists.dismissedKeys.get(id)!][0];
    const [artist, title] = [rows.find((r) => r.songKey === gone)!.artist, rows.find((r) => r.songKey === gone)!.title];
    const again = await oneRun(store, id, [pick(title, artist)]);
    expect(again.saved).toEqual([]);
    expect((await store.history(id)).dismissedKeys).toContain(gone);
  });
});

describe("PostgresLearnStore: SQL shape", () => {
  function fake(results: unknown[][] = []) {
    const calls: { text: string; params: unknown[] }[] = [];
    const query = async (text: string, params: unknown[] = []) => (calls.push({ text, params }), results.shift() ?? []);
    const transaction = async (build: (txn: { query: typeof query }) => Promise<unknown>[]) => {
      const txn = { query: (text: string, params: unknown[] = []) => (calls.push({ text, params }), Promise.resolve(results.shift() ?? [])) };
      return Promise.all(build(txn as never));
    };
    return { store: new PostgresLearnStore({ query, transaction } as never), calls };
  }
  const runRow = { id: "11111111-1111-4111-8111-111111111111", playlist_id: "p", number: 1, started_at: new Date(), finished_at: null, status: "running", end_code: null, model: "claude", inputs, totals: {}, usage: null, new_count: 0, skipped_count: 0 };

  it("starts a run with the next number in the insert, after sweeping stuck runs, then prunes steps", async () => {
    const f = fake([[], [runRow], []]);
    expect(await f.store.startRun("p", { model: "claude", inputs })).toMatchObject({ ok: true, run: { number: 1 } });
    expect(f.calls[0].text).toMatch(/UPDATE learn_runs SET status = 'failed', end_code = 'timeout'/);
    expect(f.calls[1].text).toMatch(/INSERT INTO learn_runs[\s\S]*COALESCE\(MAX\(number\), 0\) \+ 1/);
    expect(f.calls[2].text).toMatch(/UPDATE learn_runs SET steps = NULL[\s\S]*ORDER BY number DESC LIMIT/);
  });

  it("a second start while one runs gets already_running with the running id", async () => {
    const calls: string[] = [];
    let first = true;
    const query = async (text: string) => {
      calls.push(text);
      if (/INSERT INTO learn_runs/.test(text)) throw Object.assign(new Error("duplicate key"), { code: "23505" });
      if (/SELECT id FROM learn_runs/.test(text)) return [{ id: "run-1" }];
      first = false;
      return [];
    };
    void first;
    const store = new PostgresLearnStore({ query } as never);
    expect(await store.startRun("p", { model: "claude", inputs })).toEqual({ ok: false, reason: "already_running", runId: "run-1" });
  });

  it("saves picks in one INSERT … SELECT guarded by the unique key, sung songs and dismissed_keys", async () => {
    const f = fake([[{ id: "7" }], []]);
    await f.store.insertSuggestions("p", "11111111-1111-4111-8111-111111111111", [pick("One")]);
    const { text, params } = f.calls[0];
    expect(text).toMatch(/INSERT INTO learn_suggestions[\s\S]*jsonb_to_recordset[\s\S]*NOT EXISTS \(SELECT 1 FROM playlist_songs[\s\S]*dismissed_keys[\s\S]*ON CONFLICT \(playlist_id, song_key\) DO NOTHING/);
    expect(JSON.parse(params[2] as string)[0]).toMatchObject({ title: "One", song_source: "spotify" });
  });

  it("counts the window in the database and leaves out the runs that ended before the model", async () => {
    const f = fake([[{ n: 2, oldest: new Date(5_000) }]]);
    expect(await f.store.recentRuns("p", 1000)).toEqual({ count: 2, oldestStartedAt: 5000 });
    expect(f.calls[0].text).toMatch(/NOT IN \('qloo_unavailable', 'no_match'\)/);
  });

  it("Learned runs in one transaction under the Repertoire's lock and the 60-song limit; Undo deletes the song in the same statement", async () => {
    const row = { id: "7", run_id: null, run_number: null, rank: null, title: "T", artist: "A", year: null, duration_ms: null, image_url: null, song_source: "plan", source_url: null, reason: "r", evidence: {}, status: "pending", created_at: new Date(), learned_at: null, dismissed_at: null, is_new: false };
    const f = fake([[row], [], [{ id: "7" }], [{ id: "9", song_key: "a|t", state: "learned", source: "suggested", title: "T", artist: "A", own: false, spotify_track_id: null, year: null, duration_ms: null, added_at: new Date() }], [], [{ ...row, status: "learned" }], [{ revision: 4 }]]);
    const learned = await f.store.setStatus("p", "7", "learned");
    expect(learned).toMatchObject({ ok: true, song: { id: "9", state: "learned" }, revision: 4 });
    const texts = f.calls.map((c) => c.text);
    expect(texts.some((t) => /FOR UPDATE/.test(t))).toBe(true);
    expect(texts.some((t) => /UPDATE learn_suggestions SET status = 'learned'[\s\S]*< \$3::integer/.test(t))).toBe(true);
    expect(texts.some((t) => /INSERT INTO playlist_songs[\s\S]*'learned', 'suggested'/.test(t))).toBe(true);
    const undo = fake([[{ ...row, status: "learned" }], [{ moved: 1, removed: 1 }], [{ ...row, status: "pending" }], [{ revision: 5 }]]);
    expect(await undo.store.setStatus("p", "7", "pending")).toMatchObject({ ok: true, song: null, revision: 5 });
    expect(undo.calls[1].text).toMatch(/UPDATE learn_suggestions SET status = 'pending'[\s\S]*DELETE FROM playlist_songs[\s\S]*suggestion_id IN \(SELECT id FROM s\)/);
  });

  it("ids that are not numbers never reach a cast", async () => {
    const f = fake();
    expect(await f.store.setStatus("p", "1; drop table", "learned")).toEqual({ ok: false, reason: "missing" });
    expect(f.calls).toHaveLength(0);
  });
});
