---
phase: 03-templates-folders-calculators
plan: 02
subsystem: templates
tags: [vitest, tdd, pure-functions, templates]

# Dependency graph
requires:
  - phase: 02-core-logging-active-workout
    provides: loadLastPerformance (Set[] including warmups), WorkoutDetail/WorkoutExerciseDetail shapes, lib/volume.ts warm-up-filter idiom, lib/prDetection.ts pure-module convention
provides:
  - "lib/templatePrefill.ts#buildTemplatePrefillRows — pure structure+history+fallback merge (D-01, TMPL-02)"
  - "lib/templateCapture.ts#buildTemplateExercisesFromWorkout — pure save-as-template aggregation (D-02, TMPL-03)"
affects: [03-templates-folders-calculators (later waves: db/templates.ts, active-workout screen, summary screen), 06-programs-progression (may reuse the same pure-merge pattern for program-day pre-fill)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["pure lib/*.ts + co-located vitest .test.ts, zero React Native/Drizzle imports (mirrors lib/prDetection.ts, lib/volume.ts)"]

key-files:
  created: [lib/templatePrefill.ts, lib/templatePrefill.test.ts, lib/templateCapture.ts, lib/templateCapture.test.ts]
  modified: []

key-decisions:
  - "buildTemplatePrefillRows loops i from 0 to targetSets, using history[i]?.weightKg ?? target.targetWeightKg ?? 0 and history[i]?.reps ?? target.targetReps — verbatim per RESEARCH.md Pattern 2"
  - "buildTemplateExercisesFromWorkout includes an all-warmup exercise as targetSets 0 / targetReps 0 rather than skipping it, preserving exercise-slot structure in the captured template"
  - "Both functions assume warmup-filtered input is the caller's responsibility (templatePrefill) or filter internally themselves (templateCapture) — templateCapture filters internally since it receives the raw finished-workout sets, while templatePrefill's history is pre-filtered upstream by the active-workout screen"

patterns-established:
  - "Pattern 2 (D-01 pre-fill merge): pure fn mirrors lib/prDetection.ts's module-doc + interface-per-shape style, caller supplies all DB reads"

requirements-completed: [TMPL-02, TMPL-03]

# Metrics
duration: 2min
completed: 2026-07-22
---

# Phase 03 Plan 02: Template Pre-fill Merge + Save-as-Template Capture Summary

**Two pure `lib/` functions — `buildTemplatePrefillRows` (D-01 structure+history+fallback merge) and `buildTemplateExercisesFromWorkout` (D-02 save-as-template aggregation) — both zero-dependency, vitest-tested, and ready for the db/templates.ts + screen wiring in later Wave-1/2 plans.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-22T17:50:19+05:30
- **Completed:** 2026-07-22T17:52:07+05:30
- **Tasks:** 2
- **Files modified:** 4 (all created)

## Accomplishments
- `buildTemplatePrefillRows` merges a template's `targetSets`/`targetReps`/`targetWeightKg` with caller-supplied non-warmup history into exactly `targetSets` rows, falling back to the template target once history runs out (and to `0` when `targetWeightKg` is null, matching the Phase-2 never-performed convention)
- `buildTemplateExercisesFromWorkout` captures each finished workout exercise's non-warmup working-set count and last-set reps ("typical reps," A2) into a `CapturedTemplateExercise` with `targetWeightKg` always null, preserving structure even for an all-warmup exercise
- Both modules follow the existing `lib/prDetection.ts` / `lib/volume.ts` pure-function convention (module-doc header, interface-per-shape, zero React Native/Drizzle imports) and passed full-suite regression (138 tests, 21 files green)

## Task Commits

Each task followed the RED → GREEN TDD cycle:

1. **Task 1: Start-from-template pre-fill merge (D-01/TMPL-02)**
   - `c37a599` (test) — failing test: exact/short/long history + null-target-weight fallback cases
   - `6296102` (feat) — `buildTemplatePrefillRows` implementation, green
2. **Task 2: Save-as-template capture (D-02/TMPL-03)**
   - `54271ac` (test) — failing test: straight-sets count, warmup exclusion, last-set reps, null weight, position ordering, all-warmup edge case
   - `874509d` (feat) — `buildTemplateExercisesFromWorkout` implementation, green

**Plan metadata:** (final commit recorded below, after STATE/ROADMAP update)

_Both TDD tasks: test commit precedes feat commit — RED then GREEN, gate sequence verified via `git log`._

## Files Created/Modified
- `lib/templatePrefill.ts` — `buildTemplatePrefillRows(target, history)`, exports `TemplateTarget`, `HistorySet`, `PrefillRow`
- `lib/templatePrefill.test.ts` — 5 cases (exact-length, short, long/truncated, null-target-weight, no-history)
- `lib/templateCapture.ts` — `buildTemplateExercisesFromWorkout(exercises)`, exports `CapturedTemplateExercise`
- `lib/templateCapture.test.ts` — 6 cases (straight-sets, warmup exclusion, last-set reps, null weight, position ordering, all-warmup edge)

## Decisions Made
- Followed RESEARCH.md Pattern 2 verbatim for `buildTemplatePrefillRows` (exact same fallback expression: `history[i]?.weightKg ?? target.targetWeightKg ?? 0`)
- For the all-warmup edge case in `buildTemplateExercisesFromWorkout`, chose "include with targetSets 0" per the plan's explicit recommendation (preserves exercise-slot structure for the template builder to still show/allow editing that slot)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both pure modules are ready for `db/templates.ts` (Wave 1, later plan) and the active-workout / summary screen wiring (later waves) to call
- Existing Phase-2 `loadPrefillRows` inline logic was NOT touched, per the plan's explicit constraint — no regression risk to already-verified non-template pre-fill behavior
- Full vitest suite (138 tests / 21 files) stays green; no blockers for downstream plans in this phase

## TDD Gate Compliance
Both tasks confirmed: `test(...)` commit exists immediately before its corresponding `feat(...)` commit (RED before GREEN), verified via `git log --oneline`.

---
*Phase: 03-templates-folders-calculators*
*Completed: 2026-07-22*

## Self-Check: PASSED

All 4 created files found on disk (lib/templatePrefill.ts, lib/templatePrefill.test.ts, lib/templateCapture.ts, lib/templateCapture.test.ts). All 4 commit hashes verified present in git log (c37a599, 6296102, 54271ac, 874509d).
