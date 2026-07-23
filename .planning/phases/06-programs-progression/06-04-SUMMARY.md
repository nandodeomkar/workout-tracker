---
phase: 06-programs-progression
plan: 04
subsystem: database+ui
tags: [drizzle, vitest, tdd, programs, progression, finish-flow]

# Dependency graph
requires:
  - phase: 06-programs-progression (Plan 02)
    provides: db/programs.ts CRUD + program-origin marker (workouts.programId/programDayPosition) + template_exercises.consecutiveFails
  - phase: 06-programs-progression (Plan 01)
    provides: lib/progression.ts pure resolvers (evaluateLinearSuccess, resolveLinearProgression, nextDayPosition, computePercentTmWeight)
provides:
  - "db/programs.ts#applyProgressionAndAdvance — finish-time orchestration: evaluate linear success/hold/deload, write target_weight_kg/consecutive_fails in place, advance/wrap program_state.current_day_position"
  - "app/active-workout/summary.tsx: Program progress section + pointer-advance caption, guarded on program origin"
affects: [06-05-percent-tm-wiring, 06-06-custom-program-builder]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "applyProgressionAndAdvance guards on workout.programId == null as the FIRST query result checked, before any program-table read (Pitfall 1/7) — an ad-hoc/template-only/empty finish does zero program work"
    - "Progression JSON validated (type discriminant + numeric-range checks) via parseValidLinearRule/parseValidPercentTmSets BEFORE any resolver call — a malformed/negative rule is skipped per-exercise, never aborts the whole finish (T-06-01)"
    - "All writes (template_exercises bumps + program_state pointer advance) happen in ONE synchronous db.transaction, mirroring setTemplateExercises's convention — never nested transactions"

key-files:
  created: []
  modified:
    - db/programs.ts
    - db/programs.crud.test.ts
    - app/active-workout/summary.tsx

key-decisions:
  - "ProgramProgressResult uses an `applied: boolean` discriminant (not a nullable/undefined result) so the UI's guard reads as `programProgress?.applied` — a single clean boolean check instead of separately checking for null AND an empty-outcomes case"
  - "Deload outcome reports `consecutiveFails: DEFAULT_FAIL_THRESHOLD` (the miss count that fired the deload) rather than the post-reset 0 written to the DB, so the finish-screen copy '{N} misses in a row' shows the number that actually triggered the event, not the reset value"
  - "percent_tm outcome reports the LAST (highest-pct) validated set in the day's scheme as the single representative pct/reps pair for the UI-SPEC's single-line 'prescribed {pct}% × {reps}' copy — this is informational only per Task 1's explicit scope (no TM bump here, that's Plan 05)"
  - "Program progress section renders the heading + rows only when outcomes.length > 0, but the pointer-advance caption always renders whenever the finish was program-origin (programProgress.applied) — a program day with zero progression-rule exercises still gets the 'Next up' caption without an empty heading above it"

patterns-established:
  - "Finish-flow effect in app/active-workout/summary.tsx computes program-progress row copy (exercise names + display-unit formatting) once inside the load effect using the same local unitSetting variable already fetched for volume/PR display, then stores pre-rendered rows in state — avoids re-deriving copy from raw outcome values at render time"

requirements-completed: [PROG-02]

# Metrics
duration: 8min
completed: 2026-07-24
---

# Phase 6 Plan 4: Finish-Flow Progression Summary

**`applyProgressionAndAdvance` (db/programs.ts) evaluates each linear-progression exercise on a finished program-day, bumps/holds/deloads its weight in place via lib/progression.ts's pure resolvers, and advances/wraps the program pointer — all in one transaction — with the outcome now rendered on the finish screen's new "Program progress" section.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-23T23:55:00+05:30 (approx, immediately after 06-03)
- **Completed:** 2026-07-24T00:00:06+05:30
- **Tasks:** 2 (Task 1: TDD RED+GREEN for `applyProgressionAndAdvance`; Task 2: finish-screen UI wiring)
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments

- `db/programs.ts#applyProgressionAndAdvance(db, workoutId)`: the finish-time orchestration completing the linear engine end-to-end (D-02/D-09). Guards on `workout.programId == null` as the very first check (Pitfall 1/7, zero program-table queries for an ad-hoc finish), loads the finished day's template exercises + logged sets, and for each `{type:"linear"}` rule: validates the parsed JSON (rejects negative/non-finite `incrementKg` before any math, T-06-01), calls `evaluateLinearSuccess`/`resolveLinearProgression` (lib/progression.ts, Plan 01), and queues a write of `targetWeightKg`/`consecutiveFails` onto the user-owned `template_exercises` row. `{type:"percent_tm"}` rules produce an informational-only outcome (no training-max write — that's Plan 05's TM-bump-on-wrap). The pointer always advances via `nextDayPosition`, wrapping last day back to 0. Every write (bumps + pointer advance) happens in ONE synchronous `db.transaction`.
- `app/active-workout/summary.tsx`: the load effect now calls `applyProgressionAndAdvance` exactly once (guarded on program origin, never re-invoked on re-render), pre-renders per-exercise outcome copy (exercise name + display-unit formatting resolved once, in-effect), and shows a new "Program progress" section between the stats row and the PR list — reusing the existing `prRow`/`prBadge`/`prText` styling verbatim. Linear success shows an amber `"+{N}{unit}"` badge; hold shows plain `textMuted` copy (no badge — a hold is not a win); deload shows a `"−{pct}%"` badge. The pointer-advance caption (`"Next up: Day {N} of {M} — {day label}."`) always renders for a program-origin finish, independent of whether any exercise carried a progression rule that day.
- `db/programs.crud.test.ts` gained a 6-case `applyProgressionAndAdvance` describe block: linear success (bump + fails reset + pointer advance), a miss (hold + fails increment), three consecutive misses (exactly one deload, fails reset), pointer wrap (last day → 0, `wrapped: true`), an ad-hoc workout (empty result, zero writes), and a malformed negative-increment rule (skipped without aborting the finish).

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing tests for applyProgressionAndAdvance** - `56a84ac` (test)
2. **Task 1 GREEN: implement applyProgressionAndAdvance** - `76ba4b8` (feat)
3. **Task 2: Finish/summary screen Program progress section** - `035dbfb` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Task 1 was TDD (`tdd="true"`): RED (6 failing tests, function didn't exist) → GREEN (implementation, all 20 tests in the file pass). No REFACTOR commit was needed — the GREEN implementation required no follow-up cleanup._

## TDD Gate Compliance

RED gate: `56a84ac test(06-04): add failing tests for applyProgressionAndAdvance` (6 new tests failed with `TypeError: applyProgressionAndAdvance is not a function`, 14 pre-existing tests still passed).
GREEN gate: `76ba4b8 feat(06-04): implement applyProgressionAndAdvance finish-time orchestration` (all 20 tests in `db/programs.crud.test.ts` pass).
Sequence verified in git log — RED precedes GREEN. Compliant.

## Files Created/Modified

- `db/programs.ts` — Adds `applyProgressionAndAdvance`, `ProgramProgressResult`/`ProgressionOutcome`/`LinearProgressionOutcome`/`PercentTmProgressionOutcome` types, and the private `parseValidLinearRule`/`parseValidPercentTmSets` JSON-validation guards
- `db/programs.crud.test.ts` — Adds a 6-case `applyProgressionAndAdvance` describe block (success/hold/deload/wrap/ad-hoc-guard/malformed-JSON-skip)
- `app/active-workout/summary.tsx` — Adds the Program progress section (guarded on program origin), the pointer-advance caption, and the `ProgramProgressRow` pre-render type + new styles (`programProgressSection`, `programProgressHeading`, `mutedOutcomeText`, `nextUpCaption`)

## Decisions Made

- `ProgramProgressResult.applied: boolean` discriminant instead of a nullable return — lets the UI use a single `programProgress?.applied` guard rather than separately checking for a null result and an empty-outcomes edge case.
- Deload outcome's `consecutiveFails` field reports the threshold value that fired the deload (not the post-write reset-to-0 value), so the finish-screen copy "{N} misses in a row" shows the triggering count.
- percent_tm outcome reports the last (highest-pct) validated set in the day's scheme as the single representative pct/reps pair for the UI-SPEC's single-line copy — purely informational per Task 1's explicit scope (Plan 05 adds the TM bump).
- The "Program progress" heading + rows render only when `outcomes.length > 0`; the pointer-advance caption always renders whenever the finish is program-origin, so a program day with no progression-rule exercises still surfaces the "Next up" caption without an empty heading.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria are met verbatim: guard-first ad-hoc handling, in-place linear writes, exactly-one-deload-on-third-miss, pointer wrap, malformed-JSON rejection without aborting the finish, and the finish-screen section/caption behind the program-origin guard.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The linear progression engine is now complete end-to-end: starting any program day (Plan 03), finishing it evaluates/bumps/holds/deloads and advances/wraps the pointer (this plan), with the outcome visible on the finish screen.
- `ProgressionOutcome`'s `percent_tm` case is deliberately informational-only — Plan 05 (percent-of-TM wiring) will add the TM-bump-on-wrap logic (writing `training_maxes.max_kg`) and the "🎉 Cycle complete" banner, both explicitly left as extension points in this plan's code (`db/programs.ts`'s percent_tm branch comment, `summary.tsx`'s JSX comment above the Program progress section).
- Full test suite (63 files / 511 tests) green under `--no-file-parallelism`; `tsc --noEmit` clean. No blockers for Plan 05.

---
*Phase: 06-programs-progression*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: db/programs.ts
- FOUND: db/programs.crud.test.ts
- FOUND: app/active-workout/summary.tsx
- FOUND: .planning/phases/06-programs-progression/06-04-SUMMARY.md
- FOUND: 56a84ac (Task 1 RED commit)
- FOUND: 76ba4b8 (Task 1 GREEN commit)
- FOUND: 035dbfb (Task 2 commit)
- FOUND: 89de991 (Summary commit)
