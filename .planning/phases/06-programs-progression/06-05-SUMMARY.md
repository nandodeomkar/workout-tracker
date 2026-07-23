---
phase: 06-programs-progression
plan: 05
subsystem: database+ui
tags: [drizzle, vitest, tdd, expo-router, react-native, programs, progression, training-max]

# Dependency graph
requires:
  - phase: 06-programs-progression (Plan 02)
    provides: db/programs.ts CRUD + training-max storage (getTrainingMax/setTrainingMax/listProgramTrainingMaxes)
  - phase: 06-programs-progression (Plan 03)
    provides: app/programs/* route group (training-maxes.tsx placeholder, [programId].tsx TODO extension point, index.tsx %TM Add & start chain)
  - phase: 06-programs-progression (Plan 04)
    provides: applyProgressionAndAdvance finish-time orchestration + summary.tsx Program progress section extension points
provides:
  - "app/programs/training-maxes.tsx: functional TM-setup sheet (first-time ?programId= + single-exercise ?exerciseId= edit mode), all three D-10 TM sources (direct entry, manual 1RM, best logged e1RM)"
  - "db/programs.ts#startWorkoutFromProgramDay: %TM prescribed-weight prefill via computePercentTmWeight at day start (D-13)"
  - "db/programs.ts#applyProgressionAndAdvance: TM-bump-on-cycle-wrap (bumpTrainingMax), reported via ProgramProgressResult.bumpedTrainingMaxes (D-12)"
  - "app/programs/[programId].tsx: Training Maxes section with per-exercise Edit link"
  - "app/active-workout/summary.tsx: Cycle-complete banner rendering %TM training-max bumps"
affects: [06-06-custom-program-builder]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "computePrescribedWeightKg (db/programs.ts): converts a canonical-kg training max to the active display unit via lib/weightUnits.ts#kgToDisplay before delegating to lib/progression.ts#computePercentTmWeight/solvePlates, then converts the plate-loadable result back to kg via displayToKg for the sets.weight_kg write — the only place %TM crosses the kg<->display-unit boundary"
    - "TM-bump-on-wrap writes (trainingMaxes upsert) happen inside applyProgressionAndAdvance's existing synchronous db.transaction, alongside the template_exercises bumps and program_state pointer advance — one atomic finish-time write"
    - "TM_BUMP_CATEGORY_BY_SEED_ID (db/programs.ts): small seed_id -> upper/lower map resolving D-12's per-lift bump category at runtime (exercises table carries no lift-category column), defaulting to 'upper' for any %TM exercise outside the bundled five lifts"

key-files:
  created: []
  modified:
    - app/programs/training-maxes.tsx
    - app/programs/index.tsx
    - app/programs/[programId].tsx
    - db/programs.ts
    - db/programs.crud.test.ts
    - app/active-workout/summary.tsx

key-decisions:
  - "computePercentTmWeight's barWeightKg/trainingMaxKg parameters are unit-agnostic pass-throughs (matching 06-01's own lb-mode test, which passes a raw lb-scale number under that name) — db/programs.ts's new computePrescribedWeightKg wrapper is what performs the actual kg<->display-unit conversion via kgToDisplay/displayToKg before/after calling it, since sets.weight_kg is always canonical kg"
  - "TM bump lift-category (upper/lower) resolved via a new TM_BUMP_CATEGORY_BY_SEED_ID map keyed by exercises.seed_id, since neither template_exercises nor exercises carries a lift-category column; an unmapped exercise defaults to the smaller 'upper' bump"
  - "Training-maxes.tsx's 'Compute from 1RM' helper is an inline expandable menu (not a separate route/modal) offering 'Enter a 1RM' (opens a second NumericKeypad) and 'Use my best logged 1RM' (only shown when computeExerciseRecordBoard reports a non-null bestE1RM) — both feed the same computeTrainingMaxFromOneRepMax call and pre-fill the same editable TM field, never auto-saving"
  - "app/programs/training-maxes.tsx first-time mode is scoped via a ?programId= query param (added to the %TM Add & start chain in index.tsx) rather than reading the sole active program implicitly, so the TM-setup sheet is unambiguous even if the user backs out and switches active programs mid-flow"

patterns-established:
  - "kg<->display-unit conversion always goes through lib/weightUnits.ts (kgToDisplay/displayToKg) even when the value being converted isn't a literal set weight (e.g. a training max) — computePrescribedWeightKg is the reference example for future 'stored-kg value needs plate-loadable per-unit math' cases"

requirements-completed: [PROG-03]

# Metrics
duration: 16min
completed: 2026-07-24
---

# Phase 6 Plan 5: Percent-of-Training-Max Wiring Summary

**Functional TM-setup sheet (direct entry / manual 1RM / best logged e1RM), plate-loadable %TM prescribed-weight prefill at day start, training-max bump on cycle wrap, a program-detail Training Maxes section, and a finish-screen "Cycle complete" banner — completing the %TM engine end-to-end.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-24T00:03:47+05:30 (approx, immediately after 06-04)
- **Completed:** 2026-07-24T00:19:55+05:30
- **Tasks:** 3 (Task 1: TM-setup sheet + UI wiring; Task 2: TDD RED+GREEN for prefill/TM-bump; Task 3: finish-screen banner)
- **Files modified:** 6

## Accomplishments

- `app/programs/training-maxes.tsx` replaces the Plan-03 "Coming soon" placeholder with a real TM-setup sheet: first-time mode (`?programId=`) lists every distinct %TM exercise in the program via `listProgramTrainingMaxes`; single-exercise edit mode (`?exerciseId=`) is reached from the new program-detail Training Maxes section. Each row supports all three D-10 sources feeding the same editable TM field — direct-entry keypad, "Enter a 1RM" (a second keypad, converted via `computeTrainingMaxFromOneRepMax`), and "Use my best logged 1RM" (via `loadAllHistorySets` -> `computeExerciseRecordBoard` -> `bestE1RM.e1rm`, hidden when the exercise has no history). Save is disabled until every row is non-zero and writes via `setTrainingMax`.
- `db/programs.ts#startWorkoutFromProgramDay` now prefills plate-loadable %TM prescribed set weights at day start (D-13) via a new `computePrescribedWeightKg` helper that converts the canonical-kg training max into the active display unit before delegating to `computePercentTmWeight`/`solvePlates`, then converts the result back to kg for the `sets` write. A missing training max leaves that exercise's card with no inserted sets (falls back to the existing last-performance/target pre-fill) rather than a garbage 0-weight prescription.
- `db/programs.ts#applyProgressionAndAdvance` bumps every distinct %TM exercise's training max by its upper/lower amount (`bumpTrainingMax`) exactly once, gated strictly on `wrapped === true` (never per lift-week, Pitfall 3) — written inside the same synchronous transaction as the pointer advance. Bumps are reported via the new `ProgramProgressResult.bumpedTrainingMaxes` field.
- `app/programs/[programId].tsx` gained a "🎯 Training Maxes" section (rendered only when the program has a distinct %TM exercise), each row showing the current TM in display unit with an "Edit" link into the single-exercise TM-setup sheet.
- `app/active-workout/summary.tsx` renders a distinct accent-bordered "Cycle complete" banner above the per-exercise Program-progress rows whenever a finish wraps the pointer AND bumps at least one %TM training max, listing each bumped lift's delta and new value in display unit.

## Task Commits

Each task was committed atomically:

1. **Task 1: TM-setup sheet + %TM Add-and-start chain + Training Maxes section** - `a64e2cb` (feat)
2. **Task 2 RED: failing tests for %TM prefill + TM bump** - `22343d4` (test)
2. **Task 2 GREEN: implement %TM prefill + TM bump on wrap** - `879cd47` (feat)
3. **Task 3: Finish screen cycle-complete banner** - `52bfd8a` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Task 2 was TDD (`tdd="true"`): RED (3 new tests failed against the unmodified `db/programs.ts` — confirmed by reverting the implementation and re-running vitest) -> GREEN (implementation restored, all 24 tests in the file pass, including a test-assertion fix once real plate-loadability math was checked). No REFACTOR commit was needed._

## TDD Gate Compliance

RED gate: `22343d4 test(06-05): add failing tests for %TM prefill + TM bump on cycle wrap` (3 new tests failed — `expected [] to have a length of 3` and `Target cannot be null or undefined` on the not-yet-existing `bumpedTrainingMaxes` field — against `db/programs.ts` reverted to its pre-Task-2 state; 21 pre-existing tests still passed).
GREEN gate: `879cd47 feat(06-05): implement %TM prescribed-weight prefill + TM bump on wrap` (implementation restored, all 24 tests in `db/programs.crud.test.ts` pass).
Sequence verified in git log — RED precedes GREEN. Compliant.

## Files Created/Modified

- `app/programs/training-maxes.tsx` — Functional TM-setup sheet (first-time + single-exercise edit modes, three D-10 TM sources, Save gate)
- `app/programs/index.tsx` — %TM Add & start chain now passes the materialized program's id into the TM-setup sheet
- `app/programs/[programId].tsx` — Adds the "Training Maxes" section (Edit links into single-exercise TM-setup)
- `db/programs.ts` — Adds `computePrescribedWeightKg`, `prefillPercentTmSets` (called from `startWorkoutFromProgramDay`), `TM_BUMP_CATEGORY_BY_SEED_ID`, `BumpedTrainingMax` type, and TM-bump-on-wrap logic in `applyProgressionAndAdvance`
- `db/programs.crud.test.ts` — Adds a 4-case describe block covering prefill (plate-loadable + missing-TM), non-wrap no-bump, and wrap-bumps-every-distinct-exercise-once
- `app/active-workout/summary.tsx` — Adds the "Cycle complete" banner (pre-rendered `cycleCompleteRows`, rendered above the Program progress section)

## Decisions Made

- `computePercentTmWeight`'s `barWeightKg`/`trainingMaxKg` parameters are unit-agnostic pass-throughs (confirmed against 06-01's own lb-mode test, which passes a raw lb-scale number under the `barWeightKg` name) — the new `computePrescribedWeightKg` wrapper in `db/programs.ts` performs the actual kg<->display-unit conversion via `kgToDisplay`/`displayToKg` before/after delegating, since `sets.weight_kg` is always canonical kg.
- TM bump lift-category (upper/lower) is resolved via a new `TM_BUMP_CATEGORY_BY_SEED_ID` map keyed by `exercises.seed_id`, since no schema column carries a lift-category; an unmapped exercise defaults to the smaller "upper" bump.
- The "Compute from 1RM" helper is an inline expandable menu (not a separate route/modal) so both the manual-1RM and best-logged-e1RM paths stay on the same screen and feed the same editable TM field.
- The TM-setup sheet's first-time mode is scoped via an explicit `?programId=` query param (rather than implicitly reading the sole active program) so the sheet stays unambiguous if the user backs out and switches active programs mid-flow.

## Deviations from Plan

None - plan executed exactly as written. One test-file self-correction during Task 2's GREEN phase: the first prefill test asserted the 65%-of-100kg set's weight was NOT the raw unrounded value, but 65 turned out to already be plate-loadable against a 20kg bar (per-side (65-20)/2=22.5, an exact multiple of the 1.25kg smallest plate) — the invalid inequality assertion was removed in favor of the direct `computePercentTmWeight` equality checks already present for all three scheme sets (part of the GREEN commit, not a separate deviation).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The %TM engine is now complete end-to-end: TM-setup (any of the three D-10 sources) -> plate-loadable prescribed weights at day start -> training-max bump exactly once per completed cycle -> program-detail Training Maxes section with Edit -> finish-screen Cycle-complete banner.
- Full test suite (63 files / 515 tests) green under `--no-file-parallelism`; `tsc --noEmit` clean.
- Manual device UAT (deferred to phase end per the plan's own verification section): add Percent-Based Wave -> TM-setup (manual / from-1RM / best-logged-e1RM) -> prescribed weights -> complete a full 16-day cycle -> confirm the Cycle-complete banner and bumped TMs.
- No blockers for Plan 06 (custom program builder).

---
*Phase: 06-programs-progression*
*Completed: 2026-07-24*

## Self-Check: PASSED

- FOUND: app/programs/training-maxes.tsx
- FOUND: app/programs/index.tsx
- FOUND: app/programs/[programId].tsx
- FOUND: db/programs.ts
- FOUND: db/programs.crud.test.ts
- FOUND: app/active-workout/summary.tsx
- FOUND: a64e2cb (Task 1 commit)
- FOUND: 22343d4 (Task 2 RED commit)
- FOUND: 879cd47 (Task 2 GREEN commit)
- FOUND: 52bfd8a (Task 3 commit)
