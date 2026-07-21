---
phase: 02-core-logging-active-workout
plan: 01
subsystem: logging
tags: [vitest, pure-functions, weight-conversion, epley-1rm, volume, pr-detection]

# Dependency graph
requires:
  - phase: 01-scaffold-data-foundation
    provides: "lib/exerciseName.ts pure-function convention (zero RN imports, colocated vitest tests) that this plan mirrors"
provides:
  - "lib/weightUnits.ts: kg<->display-unit conversion with plate-loadable rounding (D-14/LOG-06)"
  - "lib/estimate1RM.ts: shared Epley estimated-1RM formula for Phase 2 and Phase 4 (D-10)"
  - "lib/volume.ts: warmup-excluding working-set volume (D-03/D-10)"
  - "lib/prDetection.ts: heaviest-weight + best-e1RM PR detection vs prior history (D-10)"
affects: ["02-04 (set-entry UI)", "02-06 (finish/summary screen)", "02-07 (History detail view)", "04 (stats phase, reuses estimate1RM)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure lib/ calculator convention (zero RN/Expo/Drizzle imports, colocated .test.ts, top-of-file doc comment citing decision IDs) extended from lib/exerciseName.ts to weight math"
    - "PR detection composes the shared estimate1RM function rather than re-deriving the formula, structurally enforcing the single-source-of-truth requirement (D-10)"

key-files:
  created:
    - lib/weightUnits.ts
    - lib/weightUnits.test.ts
    - lib/estimate1RM.ts
    - lib/estimate1RM.test.ts
    - lib/volume.ts
    - lib/volume.test.ts
    - lib/prDetection.ts
    - lib/prDetection.test.ts
  modified: []

key-decisions:
  - "kg rounding: Math.round(weightKg*2)/2 (nearest 0.5 kg); lb rounding: Math.round(weightKg*KG_TO_LB) (nearest whole lb) — per RESEARCH.md's cited code example, matching UI-SPEC's plate-loadable rounding rule"
  - "estimate1RM short-circuits reps<=1 to return weightKg unchanged (Assumptions Log A3) — carried forward as-is from RESEARCH, flagged in the doc comment for reviewer awareness"
  - "detectPRs groups working (non-warmup) sets by exerciseId and finds session-best-weight and session-best-e1RM independently per exercise, since the heaviest single set and the best-e1RM set are not always the same set"

requirements-completed: [LOG-05, LOG-06]

# Metrics
duration: 4min
completed: 2026-07-21
---

# Phase 2 Plan 1: Pure Logging Calculators Summary

**Four pure `lib/` calculators (kg/lb conversion, Epley estimated 1RM, warmup-excluding volume, heaviest-weight/best-e1RM PR detection) shipped with 19 passing colocated vitest tests, zero React Native/Expo/Drizzle imports.**

## Performance

- **Duration:** ~4 min (task execution only; first commit 01:04:08 IST, last commit 01:06:03 IST)
- **Tasks:** 3
- **Files modified:** 8 (all new)

## Accomplishments
- `lib/weightUnits.ts` — canonical-kg storage with plate-loadable display rounding (nearest 0.5 kg / nearest whole lb), round-trip tested
- `lib/estimate1RM.ts` — single shared Epley formula that Phase 4 stats will also import, avoiding formula drift
- `lib/volume.ts` — working-set volume that structurally excludes warmup sets (D-03)
- `lib/prDetection.ts` — composes `estimate1RM` to detect heaviest-weight and best-e1RM PRs per exercise vs prior-history maxima supplied by the caller

## Task Commits

Each task was committed atomically:

1. **Task 1: kg/lb converter (lib/weightUnits.ts)** - `9ea143d` (feat)
2. **Task 2: estimated-1RM (Epley) + working-set volume** - `989674a` (feat)
3. **Task 3: PR detection (heaviest weight + best e1RM)** - `cde2e82` (feat)

**Plan metadata:** (this commit) `docs(02-01): complete plan`

## Files Created/Modified
- `lib/weightUnits.ts` - `kgToDisplay`/`displayToKg`, canonical kg storage, plate-loadable rounding
- `lib/weightUnits.test.ts` - rounding boundary + round-trip coverage
- `lib/estimate1RM.ts` - `estimate1RM` (Epley), shared by Phase 2 and Phase 4
- `lib/estimate1RM.test.ts` - formula + reps<=1 boundary coverage
- `lib/volume.ts` - `workingSetVolume`, excludes `type === 'warmup'` sets
- `lib/volume.test.ts` - mixed normal/warmup, empty, all-warmup coverage
- `lib/prDetection.ts` - `detectPRs`, groups sets by exercise, strict-greater-than PR logic
- `lib/prDetection.test.ts` - no-prior-history, equal-to-prior, weight-only-PR, warmup-only coverage

## Decisions Made
- Followed RESEARCH.md's cited code examples verbatim for `kgToDisplay`/`displayToKg`, `estimate1RM`, and `workingSetVolume` — no deviation from the drafted function bodies.
- For `detectPRs`, grouped current session's working sets by `exerciseId` and computed the session-best weight set and session-best e1RM set as two independent reductions (not necessarily the same underlying set), since a heavier-but-lower-rep set can be a weight PR without being an e1RM PR and vice versa. This wasn't fully specified in the plan's return-shape description but follows directly from the "heaviest weight and/or new best estimated-1RM" acceptance criterion.

## Deviations from Plan

None - plan executed exactly as written. All four files match the plan's specified exports (`kgToDisplay`, `displayToKg`, `estimate1RM`, `workingSetVolume`, `detectPRs`) and acceptance criteria verbatim, including the specific numeric assertions given in the plan (62.4→62.5, 62.24→62.0, 100kg→220lb, estimate1RM(100,5)≈116.667, mixed-set volume→1000).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All four calculators are pure, tested, and importable by the next-wave plans: set-entry UI (Plan 04) can call `kgToDisplay`/`displayToKg` for the numeric keypad and set-row display; the finish/summary screen (Plan 06) can call `workingSetVolume` and `detectPRs`; Phase 4 stats can import `estimate1RM` directly without redefining it.
- `npx vitest run lib/weightUnits.test.ts lib/estimate1RM.test.ts lib/volume.test.ts lib/prDetection.test.ts` — 19/19 passing.
- `npx tsc --noEmit` — clean.
- Verified no new file imports `react-native`, `expo-*`, or `drizzle-orm`.
- No blockers for Plan 02-02 (or whichever plan is next in the wave sequence).

---
*Phase: 02-core-logging-active-workout*
*Completed: 2026-07-21*
