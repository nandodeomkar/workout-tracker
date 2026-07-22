---
phase: 04-stats-charts
plan: 04
subsystem: stats
tags: [pure-function, sqlite, drizzle, expo-router, personal-records]

requires:
  - phase: 04-stats-charts (Plan 03)
    provides: Stats overview dashboard shell (Section B weekly volume, Section C exercise picker) with the Section A placeholder this plan fills in
provides:
  - "computeAllTimeRecords / computeExerciseRecordBoard (lib/records.ts) — chronological all-history rep-max + best-e1RM scan"
  - "loadAllHistorySets (db/stats.ts) — single-query, all-exercise, chronological finished-workout set fetch"
  - "Live-recomputed recent PR feed (Stats tab Section A) + full chronological PR history screen (app/stats/records.tsx)"
affects: [04-05 (per-exercise record board reuses computeExerciseRecordBoard), 04-06 (STAT-04 perf test exercises this exact scan path)]

tech-stack:
  added: []
  patterns:
    - "Chronological single-pass running-best scan (Map<`${exerciseId}:${reps}`, best> + Map<exerciseId, best>) — extends lib/prDetection.ts's per-session convention across all history"
    - "Board curation as a presentation-layer step: the full event timeline detects a PR at every rep count logged; only CURATED_REP_MAXES ([1,3,5,8,10,12]) are projected onto the display board"

key-files:
  created:
    - lib/records.ts
    - lib/records.test.ts
    - app/stats/records.tsx
  modified:
    - db/stats.ts
    - db/stats.query.test.ts
    - app/(tabs)/stats.tsx

key-decisions:
  - "computeAllTimeRecords/computeExerciseRecordBoard track running bests as { weightKg/e1rm, workoutId, date } objects (not raw numbers) so PREvent and RecordBoardEntry can be emitted directly from the same running-best record without a second lookup pass"
  - "computeExerciseRecordBoard derives exerciseId from the first row of its (single-exercise) input rather than requiring a separate parameter — matches the RESEARCH.md sketch's call shape (setsForOneExercise) and keeps the function signature a plain array-in reduction"
  - "Section A's card list style (prFeedList/prFeedRow) is a new sibling to the existing Section C pickerList/pickerRow pattern rather than a shared component, since the plan scoped files_modified to app/(tabs)/stats.tsx + app/stats/records.tsx only (no new components/ file)"

requirements-completed: [STAT-03]

duration: 13min
completed: 2026-07-22
---

# Phase 4 Plan 4: Live PR Feed Summary

**Live-recomputed recent-PR feed (chronological rep-max + best-e1RM scan, never cached) with a full-history "See all" screen.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-22T23:24:49+05:30
- **Completed:** 2026-07-22T23:36:37+05:30
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- `lib/records.ts`: `computeAllTimeRecords` does a single chronological pass over all-history sets, tracking a running best per `(exerciseId, reps)` and per-exercise best e1RM, emitting a `PREvent` on every strict improvement (ties never emit — parity with `lib/prDetection.ts`). Returns both the full event timeline and per-exercise `ExerciseRecordBoard`s curated to `CURATED_REP_MAXES = [1,3,5,8,10,12]`.
- `db/stats.ts#loadAllHistorySets`: one parameterized query (no per-exercise loop) fetching every set across all exercises from finished workouts, ordered by `workouts.startedAt` then `sets.id` for deterministic same-session ordering — the exact chronological precondition `computeAllTimeRecords` requires.
- Stats tab Section A: "Recent PRs" — up to 12 most-recent PR events across all exercises, recomputed inside `useFocusEffect` on every focus (STAT-03/D-11 — no cache, no stored table; verified by grep for absent writes). Row tap opens the exercise's chart; "See all" opens the full history.
- `app/stats/records.tsx`: unbounded `FlatList` of the complete chronological PR history, same row anatomy as Section A, same live-recompute-on-focus data flow.

## Task Commits

Each task was committed atomically (Task 1 and Task 2 followed TDD RED→GREEN):

1. **Task 1: All-history record/PR-event computation (lib/records.ts)** - `b1feeea` (test — RED+GREEN combined; see Deviations)
2. **Task 2: All-history set query (db/stats.ts append)** - `80e8bce` (test, RED) → `a60bed8` (feat, GREEN)
3. **Task 3: PR feed (Section A) + full-history 'See all' screen** - `cee31c0` (feat)

## Files Created/Modified

- `lib/records.ts` - `computeAllTimeRecords`, `computeExerciseRecordBoard`, `CURATED_REP_MAXES`, and the `HistoricalSet`/`RecordBoardEntry`/`ExerciseRecordBoard`/`PREvent` types
- `lib/records.test.ts` - 11 tests: empty input, first-set-always-PR, warmup skip, strict-tie no-emit, heavier-set new-PR, live-recompute proof, per-exercise e1RM independence, curated-rep-max omission, per-exercise isolation, `computeExerciseRecordBoard` parity + empty-input safety
- `db/stats.ts` - appended `loadAllHistorySets(db)`
- `db/stats.query.test.ts` - appended `describe('loadAllHistorySets')` (4 tests: empty DB, cross-exercise chronological ordering, warmup inclusion, unfinished-workout exclusion)
- `app/(tabs)/stats.tsx` - Section A recent PR feed wired into the existing `useFocusEffect` load; new `prFeedList`/`prFeedRow`/`seeAllLink` styles
- `app/stats/records.tsx` - new full-history route, `/stats/records`

## Decisions Made

- Running-best `Map`s store `{ weightKg/e1rm, workoutId, date }` objects rather than bare numbers, so both the `PREvent` timeline and the final `ExerciseRecordBoard` can be built from the same scan without a second data structure.
- `computeExerciseRecordBoard` reads `exerciseId` from its input's first row (the RESEARCH.md sketch's call shape is "sets for one exercise") rather than taking it as a separate argument — empty input returns `exerciseId: 0` with empty boards, never throws.
- Section A's card-list styling is duplicated locally rather than factored into a shared component, since the plan's `files_modified` scoped this to exactly `app/(tabs)/stats.tsx` and `app/stats/records.tsx`.

## Deviations from Plan

### Process deviation (not a functional issue)

**Task 1's RED and GREEN steps landed in a single commit instead of two.** The plan/TDD convention calls for a `test(...)` commit (failing test) followed by a separate `feat(...)` commit (passing implementation). For Task 1, `lib/records.ts` was written immediately after confirming the test failed (RED verified via `npx vitest run lib/records.test.ts` before either file was staged), but both files were staged and committed together as `test(04-04): add failing test for all-history PR/record computation` (`b1feeea`). The RED state was genuinely verified (the failure output — `Cannot find module './records'` — is captured in the execution transcript) before the implementation was written; only the git history's commit-count granularity is affected, not correctness. Task 2 followed the correct two-commit RED→GREEN split (`80e8bce` → `a60bed8`), as does the plan-level `type="tdd"` gate-sequence expectation (a `test(...)` commit exists before a `feat(...)` commit, satisfying gate-sequence validation even though Task 1's `feat` step is folded into its `test` commit).

**Total deviations:** 1 process-only deviation (no auto-fix, no scope change).
**Impact on plan:** None on functionality, test coverage, or acceptance criteria — all Task 1 acceptance criteria are met and verified. The deviation only affects commit-history granularity for Task 1.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `computeExerciseRecordBoard` is ready for Plan 05's per-exercise record board screen (D-08/D-09) — verified to produce the same board `computeAllTimeRecords` would for that exercise.
- `loadAllHistorySets` + `computeAllTimeRecords` together are the exact data/compute path Plan 06's STAT-04 performance test should exercise (RESEARCH.md's "worst case, touches every non-warmup set ever logged" scan).
- Human-check deferred to the phase gate per plan: on-device verification that the feed renders correctly, live-updates after logging a new PR and returning to the tab, and that "See all" navigates as expected.

---
*Phase: 04-stats-charts*
*Completed: 2026-07-22*

## Self-Check: PASSED

All created/modified files confirmed present on disk; all task commit hashes (`b1feeea`, `80e8bce`, `a60bed8`, `cee31c0`) confirmed in git log.
