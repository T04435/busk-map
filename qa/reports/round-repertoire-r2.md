# QA round: Repertoire R2, 17 Oct 2026

**Verdict: PASS.** B-016 and the 60-song race are fixed. 1 new Low, **B-017**, which is pre-existing and not from R2: the /week loading skeleton's `aria-label` on a role-less div. Open: High 0, Medium 0, Low 1.

**Build:** `dev/core` at **8e4cd0d** (1b81087, 6134a9f, 1b00ab4, 61f11bc, 8e4cd0d), a clean tree. Offline only.

## Gates

| Gate | Result |
|---|---|
| `NEXT_DIST_DIR=.next-qa pnpm check` | Pass, 530 unit tests; fixtures OK (292 files) |
| Clean-export build of 8e4cd0d | install 0, typecheck 0, build 0 |
| DEV's full e2e (desktop + mobile) | 312 passed, 36 skipped, 0 failed |
| QA suite at w390/w768/w1440 | **189 passed**. B-016's two `test.fail` markers were removed (they now pass), and `tests/e2e/qa/repertoire-planners.spec.ts` is new |
| QA lint | clean |

## Checks (DEV's `repertoire-planners.spec.ts` covers pre-fill, edit, save, stale save with Reload, Add to Repertoire and examples; QA added the edges below)

| Check | Result |
|---|---|
| **Repertoire on** (unedited) | ✓ (DEV) the form is pre-filled; the plan request is a snapshot with no id, revision or cookie; the top pitch is recorded as a usual pitch, and the revision doesn't move |
| **Repertoire off** | ✓ (QA) switching off clears the act, artists and songs from the form, and on restores them whole. The plan request carries only what was typed. The Repertoire's revision and songs are unchanged, and no usual pitch is recorded |
| **Edited for this busk** | ✓ (DEV) no write and no usual pitch. ✓ (QA) an edited request through the API (one song) records no usual pitch |
| **Save and the conflict path** | ✓ (DEV) an explicit save writes; a stale revision shows "changed in another tab" and Reload fills the latest. ✓ (QA, API) PATCH `songs` keeps a Learned song that stays (same id, still `learned`); more than 60 songs is 400 with nothing changed |
| **Seed** ("Save these songs as your Repertoire") | ✓ (QA) duplicate songs in a seed collapse (case and punctuation); a seed sent when a Repertoire already exists is 200 and changes nothing (no overwrite) |
| **Add to Repertoire** | ✓ (QA) 201; again is 409 `already_suggested`, including a case and punctuation variant; a song you sing is 409 `in_repertoire`; cross-site Origin is 403; suggestions don't touch the songs you can sing |
| **Usual pitches** | ✓ (QA) an unedited Repertoire busk records its top pitch; the same plan again isn't a second busk; after 5 distinct busks there are at most 3 usual pitches; the revision doesn't move |
| **Examples never touch it** | ✓ (DEV R2 spec, and QA's R1 spec, still passing) |
| **/week switch** | ✓ (DEV) |
| **B-016 focus after Remove or Move** | ✓ fixed (1b00ab4); QA's two specs pass at all three widths |
| **60-song race** | ✓ fixed by code (61f11bc, a row lock in one transaction); Postgres only, not exercisable offline |
| **Three widths and axe** | ✓ QA suite at 390/768/1440. QA's new axe test on the R2 states is clean: plan offering "Save these songs", form with a Repertoire, form edited, week with its switch. Running axe before the week finished loading found **B-017** |

## Observations
- Reopening an old busk's link (a replay of the same plan key) moves that busk back to the front of "recent busks". That's harmless (no duplicate), but "usual" then reflects the last viewed, not the last planned.
- PostgresPlaylistStore.recordBusk is a read-then-write without a lock. Two busks finishing at the same instant on one device could drop one record. That's bookkeeping only.

## Not done
Live checks: none, as the user decided.
