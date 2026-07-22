---
phase: 02-core-logging-active-workout
plan: 03
subsystem: database
tags: [drizzle, sqlite, better-sqlite3, expo-sqlite, transactions, vitest]

# Dependency graph
requires:
  - phase: 02-core-logging-active-workout
    provides: db/workouts.ts crash-safe session/set core (startWorkout, insertSet, updateSet, findResumableWorkout, loadLastPerformance, loadWorkoutDetail) from Plan 02
provides:
  - "reorderWorkoutExercises/replaceWorkoutExercise/removeWorkoutExercise — mid-session exercise-management mutations (LOG-04/D-16)"
  - "discardWorkout — transactional hard-delete cascade (LOG-05/D-11/Pitfall 2)"
  - "finishWorkout — sets finished_at (LOG-05/D-10)"
  - "loadWorkoutHistory/loadWorkoutsInMonth — History list + calendar queries (HIST-01/D-12)"
  - "loadPriorBests — prior-history maxima input to lib/prDetection.ts#detectPRs (D-10)"
affects: [02-05-exercise-management-ui, 02-06-finish-discard-summary, 02-07-history-calendar]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "db.transaction() callbacks must be plain (non-async) functions using .run() — both drizzle-orm/better-sqlite3 and drizzle-orm/expo-sqlite execute synchronously under the hood (resultKind: 'sync'), so an async callback would let the wrapper commit before its awaited queries actually ran"
    - "Replace-with-logged-sets guard: count sets before allowing an in-place exercise_id swap; throw instead of silently reattributing history (FLAG-1/Pitfall 3)"
    - "Discard is always a hard-delete transaction (sets -> workout_exercises -> workouts), never a soft-archive flag like exercises.setArchived"

key-files:
  created: []
  modified:
    - db/workouts.ts
    - db/workouts.crud.test.ts
    - db/workouts.query.test.ts

key-decisions:
  - "db.transaction callbacks are synchronous (non-async) functions calling .run() explicitly, not awaited async closures, because both configured Drizzle drivers execute SQLite calls synchronously"
  - "replaceWorkoutExercise throws once the card has >=1 logged set rather than silently reattributing history or allowing a warn-and-proceed path (Open Question #1 resolved to option (a) in RESEARCH.md)"
  - "loadWorkoutHistory reuses lib/volume.ts#workingSetVolume for the warmup-exclusion filter instead of reimplementing it inline"
  - "loadWorkoutsInMonth takes a 1-indexed month (1=January) and computes UTC ISO date-range bounds in JS, passed as bound parameters"
  - "loadPriorBests treats 'before' as started_at strictly earlier than the target workout's own started_at, which naturally excludes the current and any later workout"

patterns-established:
  - "Synchronous db.transaction() callback + .run() pattern for multi-statement cascades on the sync-resultKind Drizzle drivers used by this project"

requirements-completed: [LOG-04, LOG-05, HIST-01, HIST-02]

# Metrics
duration: 20min
completed: 2026-07-22
---

# Phase 02 Plan 03: Exercise Mutations, Discard/Finish, History Queries Summary

**Completed the workout data layer: transactional reorder/replace/remove exercise mutations with the FLAG-1 replace-guard, a transactional hard-delete discard + finish, and the history/month-range/prior-bests read queries — all proven against a discovered sync-execution constraint in both configured Drizzle drivers.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-22T02:15:00Z (approx.)
- **Completed:** 2026-07-22T02:42:24Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `db/workouts.ts` now exports the full LOG-04/LOG-05/HIST-01/HIST-02 data-layer surface Plans 05, 06, and 07 need: `reorderWorkoutExercises`, `replaceWorkoutExercise`, `removeWorkoutExercise`, `discardWorkout`, `finishWorkout`, `loadWorkoutHistory`, `loadWorkoutsInMonth`, `loadPriorBests`.
- Proved (via tests) the two riskiest semantics called out by RESEARCH.md: replace-with-logged-sets throws and mutates nothing (FLAG-1/Pitfall 3), and discard hard-deletes across all three tables while leaving an unrelated workout untouched (Pitfall 2).
- Discovered and correctly handled a load-bearing runtime constraint: both `drizzle-orm/better-sqlite3` and `drizzle-orm/expo-sqlite` construct their `BaseSQLiteDatabase` with `resultKind: "sync"` — every query executes synchronously under the hood (`executeSync`/`stmt.run()`), and `db.transaction()` invokes its callback synchronously before committing. An `async` transaction callback using `await` would let the driver commit before the awaited writes actually ran (the `.then()` on a thenable is deferred to a microtask by the JS spec, not called synchronously by `await`). All four transactional functions therefore use plain synchronous callbacks with explicit `.run()` calls instead.
- `loadWorkoutHistory` reuses `lib/volume.ts#workingSetVolume` rather than reimplementing the warmup-exclusion filter, keeping "what counts as volume" defined in exactly one place across Phase 2 and the later stats phase.

## Task Commits

Each task was committed atomically:

1. **Task 1: Exercise mutations — reorder / replace / remove (LOG-04/D-16, FLAG-1)** - `615cb86` (feat)
2. **Task 2: Discard (hard-delete cascade) + finish — LOG-05/D-11/D-10** - `16105ef` (feat)
3. **Task 3: History list + month-range + prior-bests queries — HIST-01/HIST-02/D-10/D-12** - `98197c1` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `db/workouts.ts` - Added `reorderWorkoutExercises`, `replaceWorkoutExercise`, `removeWorkoutExercise`, `discardWorkout`, `finishWorkout`, `loadWorkoutHistory`, `loadWorkoutsInMonth`, `loadPriorBests`, plus `WorkoutHistoryEntry` and `PriorBest` interfaces.
- `db/workouts.crud.test.ts` - Added `describe` blocks for `reorderWorkoutExercises`, `replaceWorkoutExercise`, `removeWorkoutExercise`, `discardWorkout`, `finishWorkout`.
- `db/workouts.query.test.ts` - Added `describe` blocks for `loadWorkoutHistory`, `loadWorkoutsInMonth`, `loadPriorBests`.

## Decisions Made

- `db.transaction()` callbacks in this codebase must be synchronous functions using `.run()`, never `async`/`await` — documented as a doc-comment on `reorderWorkoutExercises` (the first transactional function) and referenced by the other three transactional functions rather than repeated four times.
- `replaceWorkoutExercise` implements RESEARCH.md's resolved Open Question #1 option (a): disallow in-place replace once the card has any logged sets, forcing the caller (Plan 05 UI) to remove+re-add instead.
- `loadWorkoutsInMonth(db, year, month)` uses a 1-indexed month convention (1=January) since that is the natural fit for a calendar UI calling it with `new Date().getMonth() + 1`.
- `loadPriorBests` compares by the target workout's own `started_at` (strictly earlier), not by row id, since `started_at` is this schema's canonical chronological anchor.

## Deviations from Plan

None — plan executed as written. The synchronous-transaction-callback constraint above was investigated during implementation (Rule 1/Rule 3 territory: a blocking correctness issue for the `db.transaction` calls the plan explicitly requires) and resolved before writing any code, so no plan output changed as a result — it just determined *how* the required transactions were implemented correctly.

## Issues Encountered

- Before writing the transactional functions, traced both `node_modules/drizzle-orm/better-sqlite3/session.js` and `node_modules/drizzle-orm/expo-sqlite/session.js` to confirm both drivers are constructed with `resultKind: "sync"` and execute via synchronous `executeSync`/`stmt.run()` calls. This confirmed that an `async` transaction callback would be unsafe (the driver's wrapper commits synchronously right after invoking the callback, before any `await`-deferred microtask runs) and that the correct, portable pattern across both the on-device (expo-sqlite) and test (better-sqlite3) drivers is a synchronous callback using `.run()`. Verified end-to-end via the discard/reorder/remove tests, which assert on post-transaction row counts.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05 (exercise-management UI) can wire drag-to-reorder, replace, and remove directly to `reorderWorkoutExercises`/`replaceWorkoutExercise`/`removeWorkoutExercise` without re-deciding any of the FLAG-1 semantics.
- Plan 06 (finish/discard + summary) can call `discardWorkout`/`finishWorkout` and feed `loadPriorBests` output straight into `lib/prDetection.ts#detectPRs`.
- Plan 07 (History + start-from-history) can render `loadWorkoutHistory` and `loadWorkoutsInMonth` directly; no additional query-layer work needed.
- Full `npx vitest run` (14 files, 101 tests) and `npx tsc --noEmit` both green at end of this plan.

---
*Phase: 02-core-logging-active-workout*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: db/workouts.ts
- FOUND: db/workouts.crud.test.ts
- FOUND: db/workouts.query.test.ts
- FOUND: .planning/phases/02-core-logging-active-workout/02-03-SUMMARY.md
- FOUND commit: 615cb86 (Task 1)
- FOUND commit: 16105ef (Task 2)
- FOUND commit: 98197c1 (Task 3)
- FOUND commit: 177a85e (docs: summary)
