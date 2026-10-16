# QA round: Repertoire R1, 17 Oct 2026

**Verdict: PASS with 1 Low.** The API, the cookie, the limits, the 409 paths and the "examples never write" rule all hold. One keyboard defect: **B-016 Low**, focus is lost after Remove. Open: High 0, Medium 0, Low 1.

**Build:** `dev/core` at **cbda583** (fa348e3, b4cf4f1, cbda583), offline only (memory store, mock model). While QA tested, DEV had uncommitted R2 work in the shared checkout (`usual.ts` and a migration 006), which didn't typecheck at the time. So every result below comes from a **clean `git archive cbda583` export** with only QA's own files overlaid, not from the working tree.

## Gates (on the export)

| Gate | Result |
|---|---|
| `pnpm check` | 507 unit tests pass (run before DEV's R2 edits started); fixtures OK (280 files) |
| Typecheck, lint, build of the export | typecheck 0, lint 0 errors, build 0 |
| DEV's full e2e (desktop + mobile) | 282 passed, 36 skipped, 0 failed |
| QA suite at w390/w768/w1440 | **168 passed** (the 6 B-016 specs marked `test.fail`). `/repertoire` added to the axe and layout specs: 0 violations and no layout break at all three widths, with screenshots looked at |
| QA unit (`qa/vitest.config.mts`) | 8/8: the fresh-run gate plus a new Repertoire creation gate test |

## What QA checked (new `tests/e2e/qa/repertoire.spec.ts`, `qa/unit/playlist-create-gate.test.ts`)

| Check | Result |
|---|---|
| GET never creates or sets a cookie | ✓ `{playlist: null}`, no Set-Cookie, `no-store` |
| Cookie on the first save | ✓ 22-character token; `HttpOnly; SameSite=Lax; Path=/; Max-Age=34560000` (400 days). No `Secure` on the offline http server, by design. The header builder with Secure is unit-tested (DEV). The token never appears in the response body |
| Reload keeps the Repertoire | ✓ (DEV's spec, also passing in QA's run) |
| Duplicate refused | ✓ 409 `already_added` for "riptide / vance joy", "Riptide! / Vance  Joy" and "Riptide - Remastered 2011", with only 1 song stored |
| 60-song limit | ✓ 60 fit; the 61st is 409 `playlist_full`, and the message names 60. Learned counts toward the 60 (moving frees nothing); removing frees a slot |
| PATCH revision | ✓ the current revision is 200 and bumps it; a stale revision is 409 `stale` and changes nothing |
| Bad input | ✓ 400 for non-JSON, an empty title, a 500-character title and an unknown state; nothing written |
| Origin check | ✓ 403 `bad_origin` with Origin `https://evil.example` on POST songs, POST, PATCH song, DELETE song and DELETE; `Origin: null` is refused too; no cookie and no write |
| Another device's song id | ✓ 404 (`no_playlist`, then `song_not_found`); the owner's song is unchanged |
| Forged or unknown cookie | ✓ no Repertoire; a save issues a **new** token, not the forged one (no session fixation) |
| Examples never write | ✓ browsing /, the 3 examples (through their short links), a week, /brain, /tips and /repertoire: no non-GET request to `/api/playlist`, no cookie, `/api/playlist` still null, and the page shows "No songs yet." |
| Creation limit, 10 an hour per IP | ✓ at the gate (unit): 10 allowed, the 11th refused with retryAfterS ≤ 3600; per IP; resets after an hour; offline not limited. The route-level 429 isn't reachable offline, because offline is exempt |
| Keyboard | Adding with Enter works; Remove is reachable and works. **✗ B-016:** after Remove, focus falls to `<body>` |
| Three widths | ✓ rendered at 390, 768 and 1440 |

## Observations (not defects)
- The Postgres `addSong` caps at 60 with `INSERT … WHERE (SELECT count(*)) < 60`. Two concurrent adds from the same device could both pass at 59 under READ COMMITTED, giving 61 songs (and a plan request over `songs.max(60)`). It needs two simultaneous saves from one device, so it's unlikely. Not testable offline (the memory store is synchronous).
- At 1440 the divider under "Add a song" is wider than the content column (plain shadcn; the design sync will restyle it).

## Not done
Live checks: none, as the user decided ("offline only").
