#!/usr/bin/env node
/**
 * Database smoke test for the Repertoire and learn SQL (docs/playlist-architecture.md §1, §2.10). No model or Qloo cost:
 * the server runs with BUSKMAP_OFFLINE=1 (mock model, Qloo mock, synthetic Spotify) and BUSKMAP_OFFLINE_DB=1 (the real
 * Postgres stores and the real learn run limits).
 *
 * 1. Start a server against the Neon DEV branch, with the dev env loaded into the process (Next reads .env.local, which
 *    may point elsewhere, unless the variables are already set):
 *      DATABASE_URL=… BUSKMAP_OFFLINE=1 BUSKMAP_OFFLINE_DB=1 NEXT_DIST_DIR=.next-smoke next dev -p 3250
 * 2. node --env-file=.env.development.local scripts/smoke-learn-db.mjs http://localhost:3250
 *
 * It creates one Repertoire, exercises the flow, checks the rows with SQL, then deletes everything it created (the forget
 * route, then a SQL sweep by its playlist id). It refuses VERCEL_ENV=production and never prints a connection string.
 */
import { guardOrExit } from "./db-guard.mjs";
import { neon } from "@neondatabase/serverless";

if (process.env.VERCEL_ENV === "production") throw new Error("Refusing to run with VERCEL_ENV=production.");
const base = process.argv[2] ?? "http://localhost:3250";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("The server must be on localhost.");
guardOrExit("smoke-learn-db");
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (expected from .env.development.local).");
const sql = neon(url);
console.log(`database host: ${new URL(url).hostname}`);

let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

let cookie = "";
async function call(method, path, body, extra = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json", Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const c of res.headers.getSetCookie?.() ?? []) if (c.startsWith("buskmap_playlist=")) cookie = c.split(";")[0];
  const text = await res.text();
  return { status: res.status, headers: res.headers, text, json: () => JSON.parse(text) };
}
const ndjson = (res) => res.text.split("\n").filter(Boolean).map((l) => JSON.parse(l));

const SONGS = [
  { title: "Dumb Things", artist: "Paul Kelly" },
  { title: "To Her Door", artist: "Paul Kelly" },
  { title: "Avant Gardener", artist: "Courtney Barnett" },
  { title: "Scar", artist: "Missy Higgins" },
  { title: "Riptide", artist: "Vance Joy" },
];

let playlistId = null;
try {
  // 1. Create a Repertoire.
  const [{ t0 }] = await sql.query("SELECT now() AS t0");
  const created = await call("POST", "/api/playlist", { songs: SONGS });
  check("create a Repertoire (201/200, cookie set)", created.status < 300 && Boolean(cookie), `status ${created.status}`);
  const [pl] = await sql.query("SELECT id, revision FROM playlists WHERE created_at >= $1 ORDER BY created_at DESC LIMIT 1", [t0]);
  playlistId = pl.id;
  const [{ n: songRows }] = await sql.query("SELECT count(*)::int AS n FROM playlist_songs WHERE playlist_id = $1", [playlistId]);
  check("playlists + playlist_songs rows written", songRows === SONGS.length, `${songRows} songs`);

  // 2. The stuck-run sweep: a 'running' run that is old is failed (timeout) by the list read.
  await sql.query(
    `INSERT INTO learn_runs (playlist_id, number, status, model, inputs, started_at) VALUES ($1, 1, 'running', 'mock', '{"songs":5,"soundsLike":[],"pitches":[]}'::jsonb, now() - interval '30 minutes')`,
    [playlistId],
  );
  const list0 = await call("GET", "/api/playlist/learn");
  const [stuck] = await sql.query("SELECT status, end_code, finished_at IS NOT NULL AS finished FROM learn_runs WHERE playlist_id = $1 AND number = 1", [playlistId]);
  check("stuck-run sweep fails the old running run with end_code timeout", stuck.status === "failed" && stuck.end_code === "timeout" && stuck.finished, `${stuck.status}/${stuck.end_code}`);
  check("list: no running run after the sweep", list0.json().running === null);

  // 3. Run A.
  const a = await call("POST", "/api/playlist/learn", {});
  const aEvents = ndjson(a);
  const aEnd = aEvents.at(-1);
  check("run A streams to an ok end", a.status === 200 && aEnd.type === "end" && aEnd.ok === true, `${aEvents.length} events, ${aEnd.mode}, ${aEnd.newCount} new`);
  const runA = aEvents.find((e) => e.type === "run");
  const [runRowA] = await sql.query("SELECT number, status, model, new_count, steps IS NOT NULL AS has_steps, totals FROM learn_runs WHERE id = $1", [runA.runId]);
  check("learn_runs row: number 2, done, model mock, steps kept, totals set", runRowA.number === 2 && ["done", "fallback"].includes(runRowA.status) && runRowA.model === "mock" && runRowA.has_steps && Object.keys(runRowA.totals).length > 0, `${runRowA.status}, new_count ${runRowA.new_count}`);
  const sugA = await sql.query("SELECT id, song_key, title, artist, status, rank, run_id FROM learn_suggestions WHERE playlist_id = $1 ORDER BY rank", [playlistId]);
  check("learn_suggestions rows: pending, ranked, linked to run A, count = new_count", sugA.length === runRowA.new_count && sugA.length >= 3 && sugA.every((s) => s.status === "pending" && s.run_id === runA.runId), `${sugA.length} rows`);
  const keysA = new Set(sugA.map((s) => s.song_key));

  // 4. Mark one learned, dismiss one, undo both.
  const [one, two] = sugA;
  const learned = await call("PATCH", `/api/playlist/learn/suggestions/${one.id}`, { status: "learned" });
  const [afterLearn] = await sql.query("SELECT status, learned_at IS NOT NULL AS stamped FROM learn_suggestions WHERE id = $1", [one.id]);
  const [sung] = await sql.query("SELECT state, suggestion_id::text AS sid FROM playlist_songs WHERE playlist_id = $1 AND song_key = $2", [playlistId, one.song_key]);
  check("mark learned: suggestion learned, song joins playlist_songs as can_sing/learned", learned.status === 200 && afterLearn.status === "learned" && afterLearn.stamped && sung?.sid === String(one.id), `${learned.status} ${sung?.state}`);
  const [rev1] = await sql.query("SELECT revision FROM playlists WHERE id = $1", [playlistId]);
  check("the Repertoire's revision moved when a song joined", rev1.revision > pl.revision, `${pl.revision} -> ${rev1.revision}`);
  const dismissed = await call("PATCH", `/api/playlist/learn/suggestions/${two.id}`, { status: "dismissed" });
  const [afterDismiss] = await sql.query("SELECT status, dismissed_at IS NOT NULL AS stamped FROM learn_suggestions WHERE id = $1", [two.id]);
  check("dismiss: status dismissed, dismissed_at set", dismissed.status === 200 && afterDismiss.status === "dismissed" && afterDismiss.stamped, `${dismissed.status}`);
  const bad = await call("PATCH", `/api/playlist/learn/suggestions/${two.id}`, { status: "learned" });
  check("dismissed -> learned directly is refused (400 invalid transition)", bad.status === 400, `${bad.status}`);
  const undoDismiss = await call("PATCH", `/api/playlist/learn/suggestions/${two.id}`, { status: "pending" });
  const [afterUndoD] = await sql.query("SELECT status, dismissed_at FROM learn_suggestions WHERE id = $1", [two.id]);
  check("undo dismiss: back to pending, stamp cleared", undoDismiss.status === 200 && afterUndoD.status === "pending" && afterUndoD.dismissed_at === null);
  const undoLearn = await call("PATCH", `/api/playlist/learn/suggestions/${one.id}`, { status: "pending" });
  const [afterUndoL] = await sql.query("SELECT status, learned_at FROM learn_suggestions WHERE id = $1", [one.id]);
  const [gone] = await sql.query("SELECT count(*)::int AS n FROM playlist_songs WHERE playlist_id = $1 AND song_key = $2", [playlistId, one.song_key]);
  check("undo learned: pending again, the song leaves playlist_songs", undoLearn.status === 200 && afterUndoL.status === "pending" && afterUndoL.learned_at === null && gone.n === 0);
  // Leave one learned and one dismissed for the next run's history.
  await call("PATCH", `/api/playlist/learn/suggestions/${one.id}`, { status: "learned" });
  await call("PATCH", `/api/playlist/learn/suggestions/${two.id}`, { status: "dismissed" });

  // 5. Run B: nothing from run A comes back.
  const b = await call("POST", "/api/playlist/learn", {});
  const bEvents = ndjson(b);
  const bEnd = bEvents.at(-1);
  check("run B streams to an ok end", b.status === 200 && bEnd.type === "end" && bEnd.ok === true, `${bEnd.mode}, ${bEnd.newCount} new, ${bEnd.skippedCount} left out`);
  const runB = bEvents.find((e) => e.type === "run");
  const sugB = await sql.query("SELECT song_key FROM learn_suggestions WHERE playlist_id = $1 AND run_id = $2", [playlistId, runB.runId]);
  check("run B suggests no song from run A (nor the learned or dismissed ones)", sugB.every((s) => !keysA.has(s.song_key)), `${sugB.length} new`);
  const [{ n: total }] = await sql.query("SELECT count(*)::int AS n FROM learn_suggestions WHERE playlist_id = $1", [playlistId]);
  const [{ n: distinct }] = await sql.query("SELECT count(DISTINCT song_key)::int AS n FROM learn_suggestions WHERE playlist_id = $1", [playlistId]);
  check("no duplicate (playlist_id, song_key) rows", total === distinct, `${total} rows`);
  let dup = null;
  try {
    await sql.query(
      `INSERT INTO learn_suggestions (playlist_id, song_key, title, artist, song_source, reason, evidence, status) VALUES ($1, $2, 'x', 'y', 'plan', 'z', '{}'::jsonb, 'pending')`,
      [playlistId, one.song_key],
    );
  } catch (error) {
    dup = error;
  }
  check("the unique index refuses a repeated song (23505)", dup !== null && /duplicate key|23505|learn_suggestions_key/i.test(String(dup?.message ?? dup?.code)));
  const plan = await call("POST", "/api/playlist/learn/suggestions", { title: one.title, artist: one.artist, reason: "from a plan" });
  check("adding an already-suggested song from a plan is refused politely (409)", plan.status === 409, `${plan.status}`);

  // 6. Replay run A from stored steps.
  const replay = await call("GET", `/api/playlist/learn/runs/${runA.runId}/events`);
  const rEvents = ndjson(replay);
  check("replay of run A: stored events with replay:true and the same end", replay.status === 200 && rEvents[0]?.type === "run" && rEvents[0].replay === true && rEvents.at(-1).type === "end", `${rEvents.length} events`);
  check("replay suggestions carry their CURRENT status", rEvents.filter((e) => e.type === "suggestion").some((e) => e.id === String(one.id) && e.status === "learned"));

  // 7. The run limit: stuck run 1 + A + B = 3 in the hour, so run C is refused.
  const list1 = (await call("GET", "/api/playlist/learn")).json();
  const c = await call("POST", "/api/playlist/learn", {});
  check("list shows the allowance used (0 remaining)", list1.limit.remaining === 0, `remaining ${list1.limit.remaining}`);
  check("run C is refused with 429 scope repertoire and a Retry-After", c.status === 429 && c.json().error.limit.scope === "repertoire" && Number(c.headers.get("retry-after")) > 0, `${c.status}`);
  const [{ n: runCount }] = await sql.query("SELECT count(*)::int AS n FROM learn_runs WHERE playlist_id = $1", [playlistId]);
  check("a refused run writes no learn_runs row", runCount === 3, `${runCount} runs`);

  // 8. One running run at a time (the partial unique index).
  await sql.query(`INSERT INTO learn_runs (playlist_id, number, status, model, inputs) VALUES ($1, 9, 'running', 'mock', '{}'::jsonb)`, [playlistId]);
  let second = null;
  try {
    await sql.query(`INSERT INTO learn_runs (playlist_id, number, status, model, inputs) VALUES ($1, 10, 'running', 'mock', '{}'::jsonb)`, [playlistId]);
  } catch (error) {
    second = error;
  }
  check("a second running run is refused by learn_runs_one_running", second !== null);
  await sql.query("DELETE FROM learn_runs WHERE playlist_id = $1 AND number = 9", [playlistId]);

  // 9. Step pruning: steps are kept for the last 5 runs (by number) and 30 days. The rows are backdated on the dev branch,
  //    which also frees the hourly allowance. Run D's start and finish prune.
  await sql.query("UPDATE learn_runs SET started_at = started_at - interval '2 hours', finished_at = finished_at - interval '2 hours' WHERE playlist_id = $1", [playlistId]);
  for (const n of [11, 12, 13, 14, 15]) {
    await sql.query(
      `INSERT INTO learn_runs (playlist_id, number, status, model, inputs, steps, started_at, finished_at) VALUES ($1, $2, 'done', 'mock', '{}'::jsonb, '[]'::jsonb, now() - interval '2 hours', now() - interval '2 hours')`,
      [playlistId, n],
    );
  }
  // Number 21 is within the last 5 by number, so only its age (40 days) can prune it.
  await sql.query(
    `INSERT INTO learn_runs (playlist_id, number, status, model, inputs, steps, started_at, finished_at) VALUES ($1, 21, 'done', 'mock', '{}'::jsonb, '[]'::jsonb, now() - interval '40 days', now() - interval '40 days')`,
    [playlistId],
  );
  const d = await call("POST", "/api/playlist/learn", {});
  const dEnd = ndjson(d).at(-1);
  check("run D (after backdating) streams to an ok end and is numbered 22", d.status === 200 && dEnd.type === "end" && dEnd.ok === true, `${d.status}`);
  const withSteps = (await sql.query("SELECT number FROM learn_runs WHERE playlist_id = $1 AND steps IS NOT NULL ORDER BY number", [playlistId])).map((r) => r.number);
  check("step pruning keeps only the last 5 runs: 2, 3, 11, 12 lose their steps", withSteps.every((n) => n >= 13) && !withSteps.includes(2) && !withSteps.includes(11), `steps kept on ${withSteps.join(",")}`);
  check("step pruning drops steps older than 30 days even inside the last 5 (run 21)", !withSteps.includes(21), `steps kept on ${withSteps.join(",")}`);
  check("the newest runs keep their steps (13, 14, 15, 22)", [13, 14, 15, 22].every((n) => withSteps.includes(n)), `steps kept on ${withSteps.join(",")}`);
  const [{ n: rowsKept }] = await sql.query("SELECT count(*)::int AS n FROM learn_runs WHERE playlist_id = $1 AND number IN (2, 3, 11, 12, 21)", [playlistId]);
  check("pruned runs keep their rows (only steps go)", rowsKept === 5, `${rowsKept}`);
  const pruned = await call("GET", `/api/playlist/learn/runs/${runA.runId}/events`);
  const prunedEvents = ndjson(pruned);
  check("replay of a pruned run still works: stepsKept false, no step events, the end and its suggestions", pruned.status === 200 && prunedEvents[0]?.stepsKept === false && !prunedEvents.some((e) => e.type === "tool-start" || e.type === "tool-end" || e.type === "note") && prunedEvents.at(-1)?.type === "end", `${pruned.status}, ${prunedEvents.length} events`);

  // 10. The 400-suggestion cap: past it the OLDEST dismissed rows go and their keys move to dismissed_keys.
  await sql.query(
    `INSERT INTO learn_suggestions (playlist_id, song_key, title, artist, song_source, reason, evidence, status, dismissed_at)
     SELECT $1::uuid, 'smoke cap ' || g || '|smoke', 'Smoke ' || g, 'Smoke', 'plan', 'cap test', '{}'::jsonb, 'dismissed', now() - (g || ' minutes')::interval
       FROM generate_series(1, 405) g`,
    [playlistId],
  );
  const [{ n: beforeCap }] = await sql.query("SELECT count(*)::int AS n FROM learn_suggestions WHERE playlist_id = $1", [playlistId]);
  const e = await call("POST", "/api/playlist/learn", {});
  const eEnd = ndjson(e).at(-1);
  check("run E streams to an ok end", e.status === 200 && eEnd.type === "end" && eEnd.ok === true, `${e.status}, ${eEnd.newCount} new`);
  const [{ n: afterCap }] = await sql.query("SELECT count(*)::int AS n FROM learn_suggestions WHERE playlist_id = $1", [playlistId]);
  const [{ keys: movedKeys }] = await sql.query("SELECT dismissed_keys AS keys FROM playlists WHERE id = $1", [playlistId]);
  check("the cap holds: 400 suggestions after the run", afterCap === 400, `${beforeCap} before, ${eEnd.newCount} new, ${afterCap} after`);
  check("the dropped rows' keys moved to dismissed_keys (one each, none lost)", movedKeys.length === beforeCap + eEnd.newCount - 400, `${movedKeys.length} keys`);
  const [{ n: stillThere }] = await sql.query("SELECT count(*)::int AS n FROM learn_suggestions WHERE playlist_id = $1 AND song_key = ANY ($2::text[])", [playlistId, movedKeys]);
  check("no moved key is still a suggestion row", stillThere === 0);
  check("the oldest dismissed went first (the highest minute offsets)", movedKeys.includes("smoke cap 405|smoke") && !movedKeys.includes("smoke cap 1|smoke"));
  const [{ n: keptLearned }] = await sql.query("SELECT count(*)::int AS n FROM learn_suggestions WHERE playlist_id = $1 AND status IN ('learned', 'pending')", [playlistId]);
  check("pending and learned rows are never trimmed", keptLearned >= 1, `${keptLearned}`);
} finally {
  // Cleanup: the forget route first (it exercises the cascade), then a sweep by id.
  if (cookie) {
    const forget = await call("DELETE", "/api/playlist");
    check("forget my Repertoire (DELETE)", forget.status < 300, `${forget.status}`);
  }
  if (playlistId) {
    const left = async () => {
      const [r] = await sql.query(
        `SELECT (SELECT count(*) FROM playlists WHERE id = $1)::int AS p, (SELECT count(*) FROM playlist_songs WHERE playlist_id = $1)::int AS s,
                (SELECT count(*) FROM learn_runs WHERE playlist_id = $1)::int AS r, (SELECT count(*) FROM learn_suggestions WHERE playlist_id = $1)::int AS g`,
        [playlistId],
      );
      return r;
    };
    const before = await left();
    check("forget cascades: no playlists, songs, runs or suggestions left", before.p + before.s + before.r + before.g === 0, JSON.stringify(before));
    if (before.p + before.s + before.r + before.g > 0) await sql.query("DELETE FROM playlists WHERE id = $1", [playlistId]);
    const after = await left();
    check("cleanup leaves 0 rows for the smoke Repertoire", after.p + after.s + after.r + after.g === 0, JSON.stringify(after));
  }
}
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
