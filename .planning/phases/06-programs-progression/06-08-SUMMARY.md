---
phase: 06-programs-progression
plan: 08
subsystem: database
tags: [drizzle, sqlite, progression, tdd, gap-closure]

# Dependency graph
requires:
  - phase: 06-programs-progression (Plan 07)
    provides: program_exercise_progress table (composite PK program_id+exercise_id), migration 0005, ProgramExerciseProgress/NewProgramExerciseProgress types
provides:
  - getProgramExerciseProgress read helper (single-row per-lift-per-program select)
  - applyProgressionAndAdvance's linear branch reading/writing program_exercise_progress instead of per-row template_exercises columns
  - prefillLinearSets — prescribes linear straight-sets at day start from the per-lift working weight
affects: [06-programs-progression]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-lift shared progression state read at BOTH finish-time (applyProgressionAndAdvance) and day-start (prefillLinearSets) via the same getProgramExerciseProgress reader, mirroring the %TM training-max read pattern"
    - "assertValidWorkingWeightKg mirrors assertValidTrainingMaxKg's finite/positive/capped invariant, applied before every program_exercise_progress upsert"

key-files:
  created: []
  modified:
    - db/programs.ts
    - db/programs.crud.test.ts

key-decisions:
  - "successTarget for evaluateLinearSuccess resolves prior?.workingWeightKg ?? templateExercise.targetWeightKg ?? loggedWeightKg — the per-lift prior state now wins over the (now largely vestigial) template row, preserving CR-01's anchor-on-logged-weight fallback for a lift's true first finish"
  - "prefillLinearSets passes the stored working weight straight to insertSet with zero unit conversion / plate-solving, since program_exercise_progress.working_weight_kg is already a real plate-loadable weight anchored on what the user actually lifted (unlike %TM, which derives a weight from a training max at prefill time)"
  - "template_exercises.targetWeightKg/consecutiveFails columns are left in the schema unchanged (still used for percent_tm's targetWeightKg=null seed and as a template-authoring initial value) — only the LINEAR branch of applyProgressionAndAdvance stopped reading/writing them"

patterns-established:
  - "prefillLinearSets is a workout-day-start sibling to prefillPercentTmSets: same hasX-early-out / same-order workoutExercises lookup / same T-0X-02 missing-state-skips-prescription discipline, differing only in weight source (stored working weight vs. TM*pct) and set shape (targetSets identical straight sets vs. a pct/reps scheme)"

requirements-completed: [PROG-02]

# Metrics
duration: 10min
completed: 2026-07-24
---

# Phase 06 Plan 08: Linear Progression Per-Lift Prefill + Cross-Day Sharing Summary

**Closed the Test-3 PROG-02 blocker: `applyProgressionAndAdvance`'s linear branch now reads/writes the per-lift `program_exercise_progress` table (not per-row `template_exercises`), and a new `prefillLinearSets` prescribes straight-sets at day start from that shared working weight — so a Squat bump on Day A now reaches Day B's Squat prescription instead of silently falling back to the last-lifted weight.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-24T10:19:xx+05:30 (immediately following Plan 06-07)
- **Completed:** 2026-07-24T10:33:xx+05:30
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `getProgramExerciseProgress(db, programId, exerciseId)` — a single-row select on the Plan-06-07 composite-key `program_exercise_progress` table, mirroring `getTrainingMax`'s shape.
- Rewrote the LINEAR branch of `applyProgressionAndAdvance`: reads the prior per-lift state once (`prior = await getProgramExerciseProgress(...)`), evaluates success against `prior?.workingWeightKg ?? templateExercise.targetWeightKg ?? loggedWeightKg`, uses `prior?.consecutiveFails ?? 0` as the fail-streak baseline, and upserts the result into `program_exercise_progress` (composite-key `onConflictDoUpdate`) inside the existing finish-time transaction — replacing the old per-row `tx.update(templateExercises)...` write. CR-01 (anchor-on-logged-weight, never 0) is preserved verbatim.
- Added `assertValidWorkingWeightKg` (T-08-01) — finite/positive/capped-at-`MAX_WEIGHT_KG`, mirroring `assertValidTrainingMaxKg` — validated before every upsert alongside the existing `assertValidConsecutiveFails`.
- Extended `deleteProgram`'s existing detach-before-delete transaction to also delete the program's `program_exercise_progress` rows, so a deleted program leaves no orphan per-lift state.
- Added `prefillLinearSets(db, workoutId, programId, templateDetail)` — modeled on `prefillPercentTmSets`: early-outs if no linear exercise is on the day, walks the day's exercises in the same 1:1 index order as the created `workout_exercises` rows, reads each linear exercise's per-lift working weight via `getProgramExerciseProgress`, and inserts `targetSets` straight sets (`setNumber` 1..targetSets, all at `workingWeightKg`/`targetReps`, type `'normal'`) — StrongLifts-style flat-weight sets, no plate-solving (the stored weight is already plate-loadable). A missing/null/non-finite/≤0 working weight (T-08-02 — first run, or a tampered row) leaves the card unprescribed, falling back to the existing last-performance/target pre-fill.
- Wired `prefillLinearSets` into `startWorkoutFromProgramDay` right after the existing `prefillPercentTmSets` call, inside the same `templateDetail` guard — no active-workout screen changes needed (it already renders any pre-inserted `setRows.length > 0` sets, exactly as it does for %TM).

## Task Commits

Each task followed RED → GREEN:

1. **Task 1 RED — failing per-lift progression storage coverage** - `2750b25` (test)
2. **Task 1 GREEN — move linear progression to per-lift shared state** - `dda73d6` (feat)
3. **Task 2 RED — failing prefillLinearSets coverage** - `d38dbae` (test)
4. **Task 2 GREEN — prescribe linear sets at day start from per-lift working weight** - `325f342` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `db/programs.ts` - Added `getProgramExerciseProgress`, `assertValidWorkingWeightKg`, `prefillLinearSets`; rewrote the linear branch of `applyProgressionAndAdvance` (per-lift read/write instead of per-row); extended `deleteProgram`'s transaction; wired `prefillLinearSets` into `startWorkoutFromProgramDay`.
- `db/programs.crud.test.ts` - Updated every existing `applyProgressionAndAdvance` finish-logic assertion (linear success, both CR-01 cases, a-miss-holds, three-consecutive-misses) to read `getProgramExerciseProgress` instead of `template_exercises`; added cross-day-write-sharing, `deleteProgram` cleanup, ad-hoc-writes-nothing, and malformed-rule-writes-nothing assertions; added the HEADLINE cross-day prefill regression test, a same-day re-prefill test, a first-run-fallback test, and a `targetSets`-honored test for `prefillLinearSets`.

## Decisions Made

- Followed the plan's approved resolution exactly: `program_exercise_progress` (Plan 06-07) becomes the single source of truth for linear progression state; `template_exercises.target_weight_kg`/`consecutive_fails` are left in the schema (still used for %TM's null seed / template-authoring) but the linear branch no longer reads or writes them.
- `successTarget` falls back through three levels (`prior?.workingWeightKg` → `templateExercise.targetWeightKg` → `loggedWeightKg`) rather than two, to keep the CR-01 first-finish guarantee intact now that a per-lift prior state exists as an additional, higher-priority source.

## Deviations from Plan

None — plan executed exactly as written, including the exact test behaviors and threat-model mitigations (T-08-01, T-08-02) it specified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required; this plan only touches the DB data layer and its test suite.

## Next Phase Readiness

- `npx tsc --noEmit` clean.
- `npx vitest run db/programs.crud.test.ts --no-file-parallelism` → 33/33 pass.
- Full-suite sanity: `npx vitest run --no-file-parallelism` → 525/525 pass (63 test files).
- 06-UAT.md Test 3 (PROG-02) blocker is closed: both defect (A) linear sets are now prescribed at day start, and defect (B) the working weight is shared per-lift across program days.
- No app/screen files were touched — the active-workout screen's existing `setRows.length > 0` render branch picks up the newly-inserted prescribed sets automatically.

---
*Phase: 06-programs-progression*
*Completed: 2026-07-24*
