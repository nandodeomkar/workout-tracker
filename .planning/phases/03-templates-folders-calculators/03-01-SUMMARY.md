---
phase: 03-templates-folders-calculators
plan: 01
subsystem: utilities
tags: [vitest, pure-functions, plate-math, warmup, 1rm, nsca]

# Dependency graph
requires:
  - phase: 02-core-logging-active-workout
    provides: "lib/estimate1RM.ts (Epley), lib/weightUnits.ts (display rounding convention, NOT reused here), lib/prDetection.ts (pure-fn module-header convention)"
provides:
  - "lib/plateSolver.ts#solvePlates — greedy per-side plate breakdown, native per-unit denominations, below-bar + fp-drift guarded (UTIL-01)"
  - "lib/warmupLadder.ts#buildWarmupSets — 4-step %-of-working-weight warm-up ladder, plate-rounded via solvePlates (UTIL-03)"
  - "lib/percentOf1RM.ts#percentOf1RM — NSCA %1RM->reps table lookup for programming (UTIL-02)"
affects: [03-02 (db/templates.ts), 03-03..03-06 (calculator sheet components, inline affordances)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["pure lib/ modules with co-located vitest suite, zero RN/Drizzle imports", "native per-unit plate denominations (never cross-unit converted)", "greedy plate-fill provably minimal because each denomination is an exact multiple of the smallest"]

key-files:
  created:
    - lib/plateSolver.ts
    - lib/plateSolver.test.ts
    - lib/warmupLadder.ts
    - lib/warmupLadder.test.ts
    - lib/percentOf1RM.ts
    - lib/percentOf1RM.test.ts
  modified: []

key-decisions:
  - "Plate sets are native per display unit (PLATE_SET_KG / PLATE_SET_LB) — never derived by converting one unit's set through the other (Pitfall 1)"
  - "Plate-solver rounding uses its own plate set's smallest denomination, not lib/weightUnits.ts's 0.5kg/1lb display rounding (Pitfall 2)"
  - "Warm-up ladder values locked as [ASSUMED A1]: Bar x8, 40% x5, 60% x3, 80% x2"
  - "percentOf1RM does not import estimate1RM — it consumes a caller-supplied 1RM, keeping Epley the single formula source"

patterns-established:
  - "Pattern 3 (RESEARCH.md): greedy per-side plate solver with fp-drift guards (Math.round(x*100)/100 + plate - 1e-9 epsilon)"
  - "Pattern 4 (RESEARCH.md): warm-up ladder step weights always delegate rounding to solvePlates, never ad-hoc"

requirements-completed: [UTIL-01, UTIL-02, UTIL-03]

# Metrics
duration: 8min
completed: 2026-07-22
---

# Phase 3 Plan 1: Calculator Utilities Summary

**Pure plate solver, warm-up ladder, and NSCA %-of-1RM table — three tested `lib/` modules backing UTIL-01/02/03, each with zero React Native/Drizzle imports.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-22T12:08:51Z
- **Completed:** 2026-07-22T12:16:39Z
- **Tasks:** 3 completed
- **Files modified:** 6 (all new)

## Accomplishments
- `solvePlates` resolves a (target, bar, unit) triple to a per-side plate breakdown, nearest-achievable weight, and signed delta — handles exact-loadable, not-exactly-loadable, below-bar, and fp-drift-prone edge cases, using native per-unit plate denominations (never cross-unit converted)
- `buildWarmupSets` builds the fixed 4-step %-of-working-weight warm-up ladder (Bar/40%/60%/80%), every non-bar step rounded through `solvePlates` so suggestions are always actually loadable
- `percentOf1RM` maps a supplied 1RM to the 11-row NSCA Training Load Chart (%1RM -> reps -> weight), leaving `lib/estimate1RM.ts`'s Epley formula untouched as the single 1RM source

## Task Commits

Each task followed the RED/GREEN TDD cycle:

1. **Task 1: Plate solver (lib/plateSolver.ts) — UTIL-01**
   - RED: `c95f67b` (test)
   - GREEN: `788743e` (feat)
2. **Task 2: Warm-up ladder (lib/warmupLadder.ts) — UTIL-03**
   - RED: `8181e2d` (test)
   - GREEN: `43b9eaf` (feat)
3. **Task 3: %-of-1RM table (lib/percentOf1RM.ts) — UTIL-02**
   - RED: `2135d4d` (test)
   - GREEN: `3695b5e` (feat)

**Plan metadata:** (this commit) `docs(03-01): complete calculator utilities plan`

_No REFACTOR commits were needed — each implementation was written cleanly against RESEARCH.md's ready-to-use patterns on the first GREEN pass._

## Files Created/Modified
- `lib/plateSolver.ts` - `solvePlates` greedy plate breakdown; exports `PlateSolveResult`, `PLATE_SET_KG`, `PLATE_SET_LB`
- `lib/plateSolver.test.ts` - 8 cases: exact-loadable, not-exactly-loadable, descending-order/formula check, below-bar, target-at-bar, kg-set membership, lb-set membership, fp-drift
- `lib/warmupLadder.ts` - `buildWarmupSets`; exports `WarmupStep`; imports `solvePlates`
- `lib/warmupLadder.test.ts` - 4 cases: step count/labels/reps, Bar==barWeight, plate-rounded steps match solvePlates output, lb unit passthrough
- `lib/percentOf1RM.ts` - `percentOf1RM`; exports `PercentRow`; NSCA table transcribed from RESEARCH.md
- `lib/percentOf1RM.test.ts` - 3 cases: row count/percents/reps, weight computation at 1-decimal, 100%-row equals input

## Decisions Made
- Followed RESEARCH.md's Pattern 3/4 implementations near-verbatim (they were already complete, ready-to-use references) — no deviation from the recommended algorithm
- Test fixture values for plate-solver tests were computed by hand-tracing the greedy algorithm against RESEARCH.md's rounding formula (rather than copying RESEARCH.md's own partially-illustrative example numbers, which described the rounding step only, not the exact final greedy decomposition) — verified against the running implementation before commit

## Deviations from Plan

None - plan executed exactly as written. All three modules match the plan's `<action>` specifications (module-scope consts, exported interfaces, exact algorithm) verbatim.

## Issues Encountered

None. Each RED test failed on missing module (as expected), then passed cleanly on the first implementation attempt — no debugging iterations needed.

## User Setup Required

None - no external service configuration required. All three modules are pure, in-repo, dependency-free.

## Next Phase Readiness

- `solvePlates`/`PLATE_SET_KG`/`PLATE_SET_LB` are ready for Wave-2's `PlateCalculatorSheet` and `WarmupSuggestionSheet` components (03-0x) to import directly
- `buildWarmupSets` is ready for `WarmupSuggestionSheet`'s one-tap-accept flow
- `percentOf1RM` is ready for `OneRMCalculatorSheet`, alongside the existing `estimate1RM`
- No blockers for 03-02 (`db/templates.ts`) — that plan has no dependency on this one (wave 1, parallel-eligible per frontmatter `depends_on: []`)

---
*Phase: 03-templates-folders-calculators*
*Completed: 2026-07-22*

## Self-Check: PASSED

All 6 created files found on disk; all 6 task commit hashes (c95f67b, 788743e, 8181e2d, 43b9eaf, 2135d4d, 3695b5e) confirmed in git log.
