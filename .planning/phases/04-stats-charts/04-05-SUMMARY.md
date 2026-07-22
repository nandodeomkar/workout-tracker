---
phase: 04-stats-charts
plan: 05
subsystem: ui
tags: [react-native, expo-router, records, stats, drizzle]

# Dependency graph
requires:
  - phase: 04-stats-charts (Plan 02)
    provides: app/stats/[exerciseId].tsx per-exercise chart screen, MetricToggle component
  - phase: 04-stats-charts (Plan 04)
    provides: lib/records.ts#computeExerciseRecordBoard, CURATED_REP_MAXES, db/stats.ts#loadAllHistorySets
provides:
  - "Per-exercise record board view (D-08/D-09) added to app/stats/[exerciseId].tsx"
  - "Chart/Records view toggle unifying both surfaces under one route"
affects: [05-body-measurements, 08-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single route with a Chart/Records single-select view toggle (MetricToggle) instead of a second pushed screen"
    - "Records view piggybacks on the chart screen's existing useFocusEffect (one fetch, filtered/reduced in JS), never a second query"

key-files:
  created: []
  modified:
    - app/stats/[exerciseId].tsx

key-decisions:
  - "Records view fetches loadAllHistorySets in the same useFocusEffect as the chart's loadExerciseChartSets call, filters to this exerciseId in JS, and derives the board via computeExerciseRecordBoard in a useMemo — no new db/stats.ts query added, nothing persisted (T-04-07)"

patterns-established:
  - "Best-e1RM hero card uses theme.typography.display for a single focal numeral, rep-max rows use Body-sized rows (UI-SPEC discretionary choice)"

requirements-completed: [STAT-03]

# Metrics
duration: 5min
completed: 2026-07-22
---

# Phase 04 Plan 05: Per-Exercise Record Board Summary

**Live-computed per-exercise record board (curated 1/3/5/8/10/12-rep maxes + best est-1RM) added to the existing chart screen via a Chart/Records view toggle, reusing Plan 04's `computeExerciseRecordBoard` with zero new queries.**

## Performance

- **Duration:** 5 min (implementation was already present in the working tree at session start; this run verified, typechecked, tested, and committed it)
- **Started:** 2026-07-22T18:20:00Z
- **Completed:** 2026-07-22T18:23:34Z
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments
- `app/stats/[exerciseId].tsx` now has a "Chart" / "Records" segmented toggle (reusing `MetricToggle`) at the top of the screen, so both views share `/stats/[exerciseId]` and PR-feed row taps (from `app/(tabs)/stats.tsx` and `app/stats/records.tsx`) resolve to a real board.
- Records view derives its board live inside the existing `useFocusEffect` — `loadAllHistorySets(db)` runs alongside the chart's `loadExerciseChartSets` fetch, filtered to this `exerciseId` in JS, then reduced via `computeExerciseRecordBoard` in a `useMemo` — no new query added to `db/stats.ts`, nothing persisted.
- Rep-max rows iterate `CURATED_REP_MAXES` ([1,3,5,8,10,12]) and render only rep counts with a logged entry (no placeholder rows); each row shows "{N}RM", weight in the user's display unit via `kgToDisplay`, and the date achieved.
- Best-e1RM is rendered as a hero card (`theme.typography.display`) above the rep-max rows, always shown when non-null.
- Empty state ("No records yet" / "Your rep-max records will appear here once you log a set.") renders when the board has zero rep-maxes and a null best-e1RM (zero non-warmup sets).

## Task Commits

Each task was committed atomically:

1. **Task 1: Per-exercise record board view** - `7f0cde0` (feat)

**Plan metadata:** (final commit below)

## Files Created/Modified
- `app/stats/[exerciseId].tsx` - Added Records view (Chart/Records toggle, rep-max rows, best-e1RM hero card, empty state), reusing `loadAllHistorySets` + `computeExerciseRecordBoard` inside the existing live `useFocusEffect`.

## Decisions Made
- Records view fetches `loadAllHistorySets` in the same `useFocusEffect` as the chart's existing `loadExerciseChartSets` call rather than adding a second effect or a new query — keeps one live-recompute discipline for the whole screen (D-11).
- Best-e1RM rendered with `theme.typography.display` as a hero numeral (UI-SPEC's discretionary option), rep-max rows kept Body-sized in a card list below it.

## Deviations from Plan

None - plan executed exactly as written. The implementation matched the plan's task description exactly (view toggle, live recompute, curated rows, display-unit conversion, empty state) and required no additional fixes.

## Issues Encountered

None. `npx tsc --noEmit` exits clean and the full `npx vitest run` suite (27 files, 205 tests) passes, including existing `lib/records.test.ts` coverage of `computeExerciseRecordBoard` (empty input and scoped-board equivalence to `computeAllTimeRecords`) — no new test needed per the plan's verification note.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- STAT-03's full PR surface (recent feed + per-exercise record board) is now complete: PR-feed row taps navigate to a live-computed board in the user's display unit.
- Phase 04's remaining plan (06, if any) and the phase-gate device pass (PR-feed tap → record board → curated rows → empty state) are the only outstanding verification steps for this phase.
- No blockers identified.

---
*Phase: 04-stats-charts*
*Completed: 2026-07-22*

## Self-Check: PASSED
