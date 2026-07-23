---
phase: 06-programs-progression
plan: 01
subsystem: database
tags: [vitest, tdd, progression, plate-solver, pure-function]

# Dependency graph
requires:
  - phase: 03-templates-folders-calculators
    provides: lib/plateSolver.ts (solvePlates plate-loadable rounding), lib/estimate1RM.ts (Epley formula convention)
provides:
  - "lib/progression.ts: pure linear + percent-of-training-max progression resolvers"
  - "Six exported functions: evaluateLinearSuccess, resolveLinearProgression, computeTrainingMaxFromOneRepMax, computePercentTmWeight, bumpTrainingMax, nextDayPosition"
  - "Shared constants: DEFAULT_LINEAR_INCREMENT_KG, DEFAULT_FAIL_THRESHOLD, DEFAULT_DELOAD_PCT, DEFAULT_TM_PERCENT, DEFAULT_WAVE_SCHEME, DEFAULT_TM_BUMP_KG"
affects: [06-02-programs-data-layer, 06-04-finish-flow, 06-05-percent-tm-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure lib/ calculator module (zero RN/Drizzle imports, caller supplies all external state)"
    - "Plate-loadable rounding delegation to lib/plateSolver.ts#solvePlates instead of lib/weightUnits.ts display rounding"
    - "Round-to-nearest-0.5kg float-drift guard applied after every progression arithmetic op"

key-files:
  created: [lib/progression.ts, lib/progression.test.ts]
  modified: []

key-decisions:
  - "computePercentTmWeight delegates to solvePlates (plate-loadable), never raw TM*pct — resolves Open Question 1 / Assumption A2"
  - "resolveLinearProgression resets consecutive_fails to 0 in BOTH the success and deload branches, preventing repeated deloads after the first miss following a deload (Pitfall 8)"
  - "All returned weights rounded to nearest 0.5kg via Math.round(x*2)/2 to guard against IEEE-754 float drift across many progression cycles (Pitfall 5)"

patterns-established:
  - "lib/progression.ts: pure, zero-RN/Drizzle progression math — db/programs.ts (Plan 02) will be a thin transactional wrapper around this module's pure results"

requirements-completed: [PROG-02, PROG-03]

# Metrics
duration: 10min
completed: 2026-07-23
---

# Phase 6 Plan 1: Progression Resolvers Summary

**Pure TDD-built `lib/progression.ts` with linear success/hold/deload resolver and percent-of-training-max weight/TM-bump math, delegating plate rounding to the existing `solvePlates` helper.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-23T23:10:00+05:30 (approx, session start)
- **Completed:** 2026-07-23T23:12:44+05:30
- **Tasks:** 2 (TDD: RED, GREEN)
- **Files modified:** 2 (both created)

## Accomplishments
- `evaluateLinearSuccess`: strict all-non-warmup-sets-hit-target rule (D-06), verified against a mixed warmup+working fixture (Pitfall 2)
- `resolveLinearProgression`: increments on success, holds on miss, deloads exactly once at the fail threshold with counter reset in both success and deload branches (D-08, Pitfall 8), verified via a 4-consecutive-miss loop and a 50-iteration float-drift loop (Pitfall 5)
- `computeTrainingMaxFromOneRepMax` (D-10) and `bumpTrainingMax` (D-12): simple percent/delta math, rounded to nearest 0.5kg
- `computePercentTmWeight` (D-13): delegates to `solvePlates` for true plate-loadable rounding, verified against a case where the raw `TM*pct` product is NOT plate-loadable (Assumption A2)
- `nextDayPosition` (D-03): wraps from the last day back to 0, flags the wrap for the caller (used later to trigger %TM cycle TM-bumps)

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — failing vitest for every progression resolver** - `d7e80e2` (test)
2. **Task 2: GREEN — implement lib/progression.ts pure resolvers** - `5ddd79c` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `lib/progression.ts` - Pure progression resolvers + shared strength-training constants (zero RN/Drizzle imports)
- `lib/progression.test.ts` - 27 vitest cases covering all six exports plus the four flagged pitfall/assumption cases

## Decisions Made
- Followed the plan's TDD gate sequence exactly: RED commit (module missing, all imports fail) before GREEN commit (all 27 tests pass).
- Kept `computePercentTmWeight`'s signature pure (`barWeightKg`/`unit` as plain parameters) per Open Question 2's resolution — no settings/DB access inside `lib/progression.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed an invalid assertion in my own RED-phase test fixture**
- **Found during:** Task 2 (GREEN implementation, first test run)
- **Issue:** The `computePercentTmWeight` test used TM=100, pct=0.85, bar=20kg as the "must differ from raw TM*pct" case — but 100*0.85=85 turns out to be exactly plate-loadable with a 20kg bar (per-side 32.5 is an exact multiple of the 1.25kg smallest plate), so `result !== rawProduct` failed since both equaled 85.
- **Fix:** Swapped the fixture to pct=0.83 (TM*pct=83, not plate-loadable; solvePlates rounds to 82.5), which correctly demonstrates the plate-loadable rounding differs from the raw product while still asserting equality with `solvePlates`'s own output.
- **Files modified:** lib/progression.test.ts
- **Verification:** `npx vitest run lib/progression.test.ts --no-file-parallelism` — all 27 tests green after the fix.
- **Committed in:** 5ddd79c (Task 2 commit, alongside the GREEN implementation)

---

**Total deviations:** 1 auto-fixed (1 bug in test fixture written in this same plan)
**Impact on plan:** No scope creep — this was a self-authored test bug caught immediately during the GREEN run, not a defect in the implementation or an unplanned feature.

## Issues Encountered
None beyond the test-fixture bug documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `lib/progression.ts` is ready for Plan 02 (`db/programs.ts`) to wrap transactionally: `resolveLinearProgression`, `computePercentTmWeight`, `bumpTrainingMax`, and `nextDayPosition` cover every pure-math need identified in 06-RESEARCH.md's Architectural Responsibility Map.
- Full test suite (62 files / 491 tests) verified green after this plan's changes — no regressions introduced.
- No blockers for Plan 02.

---
*Phase: 06-programs-progression*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: lib/progression.ts
- FOUND: lib/progression.test.ts
- FOUND: d7e80e2 (test commit)
- FOUND: 5ddd79c (feat commit)
