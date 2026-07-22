---
phase: 04-stats-charts
plan: 02
subsystem: ui
tags: [victory-native, react-native-skia, drizzle, vitest, charts, expo-router]

# Dependency graph
requires:
  - phase: 04-01
    provides: victory-native@41.26.0 + @shopify/react-native-skia@2.9.1 installed and linked into a rebuilt dev client
provides:
  - "lib/chartSeries.ts#buildChartSeries — pure one-point-per-workout reduction for e1rm/topSet/volume (D-07)"
  - "db/stats.ts#loadExerciseChartSets — parameterized, exercise-scoped, finished-workout-only chart-series query"
  - "components/MetricToggle.tsx — generic single-select pill row, reused for metric toggle + range chips"
  - "app/stats/[exerciseId].tsx — working per-exercise progress chart screen (CartesianChart + Line)"
  - "'View progress' entry point on the exercise detail screen (D-03b)"
affects: [04-03, 04-04, 04-05, stats-charts]

# Tech tracking
tech-stack:
  added: []
  patterns: ["victory-native XL CartesianChart+Line for per-exercise trend charts", "useFocusEffect + cancelled-guard live recompute (STAT-03/D-11 — never cached)", "client-side range-chip filtering over a single all-time fetch (no per-chip DB re-query)"]

key-files:
  created: [lib/chartSeries.ts, lib/chartSeries.test.ts, db/stats.ts, db/stats.query.test.ts, components/MetricToggle.tsx, "app/stats/[exerciseId].tsx"]
  modified: ["app/(tabs)/exercises/[id].tsx"]

key-decisions:
  - "buildChartSeries stores raw ChartSet[] in screen state and recomputes the chart series via useMemo(metric) instead of re-fetching on every metric-toggle tap — only exerciseId triggers the live useFocusEffect DB reload; metric/range are pure client-side derivations (D-11 + RESEARCH.md Open Question 2)"
  - "MetricToggle built as its own small generic single-select component rather than reusing FilterChipRow directly, since FilterChipRow is multi-select (per UI-SPEC's explicit call-out)"

patterns-established:
  - "Pure lib (zero RN/Drizzle imports) + AnyDrizzleDb query-layer split extended cleanly from db/workouts.ts + lib/prDetection.ts convention to the new stats domain"

requirements-completed: [STAT-01]

# Metrics
duration: ~10min
completed: 2026-07-22
---

# Phase 4 Plan 02: Per-Exercise Progress Chart (STAT-01 Vertical Slice) Summary

**Working per-exercise progress chart (`app/stats/[exerciseId].tsx`) rendering a Skia `CartesianChart`+`Line` of est-1RM/top-set/volume, live-loaded via a new `db/stats.ts#loadExerciseChartSets` query and the pure `lib/chartSeries.ts#buildChartSeries` reduction, reachable from a new "View progress" link on the exercise detail screen**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-22T17:34:35Z
- **Tasks:** 3 (2 TDD lib/query tasks + 1 screen/entry-point task)
- **Files modified:** 7 (5 created, 1 new test-only, 1 modified)

## Accomplishments
- `lib/chartSeries.ts#buildChartSeries` — pure, one point per workout (D-07), reuses `estimate1RM`/`workingSetVolume` verbatim (D-17), zero RN/Drizzle imports, 9/9 tests green
- `db/stats.ts#loadExerciseChartSets` — parameterized Drizzle query (join `sets` → `workout_exercises` → `workouts`), `isNotNull(finishedAt)` excludes in-progress workouts (T-04-04), 5/5 tests green
- `app/stats/[exerciseId].tsx` — full chart screen: metric toggle (Est. 1RM default, D-04), range chips (All default, D-06), empty/sparse states, kg→display-unit conversion at render (D-16)
- "View progress" `Pressable` added to the exercise detail screen, routing to `/stats/[exerciseId]` (D-03b)
- Full vitest suite (172 tests, 25 files) green; `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically (TDD RED→GREEN pairs for Tasks 1-2):

1. **Task 1: Pure chart-series reduction (buildChartSeries)**
   - `edd7d48` (test) — failing test for buildChartSeries
   - `fc776d7` (feat) — buildChartSeries implementation
2. **Task 2: Chart-series query (db/stats.ts#loadExerciseChartSets)**
   - `7388cce` (test) — failing test for loadExerciseChartSets
   - `c4de125` (feat) — loadExerciseChartSets implementation
3. **Task 3: Per-exercise chart screen + 'View progress' entry point** - `4ea1757` (feat)

## Files Created/Modified
- `lib/chartSeries.ts` - `buildChartSeries(sets, metric)` pure reduction; `ChartSet`/`ChartPoint`/`ChartMetric` types
- `lib/chartSeries.test.ts` - 9 tests covering empty input, warmup exclusion, workout collapsing, all 3 metrics, sort order
- `db/stats.ts` - `loadExerciseChartSets(db, exerciseId)` parameterized query, `AnyDrizzleDb` driver-agnostic type
- `db/stats.query.test.ts` - 5 tests: empty result, exercise scoping + ordering, unfinished-workout exclusion, warmup rows returned, row shape
- `components/MetricToggle.tsx` - generic `MetricToggle<T>` single-select pill row (metric toggle + range chips)
- `app/stats/[exerciseId].tsx` - chart screen: appbar/back, title, MetricToggle x2, `CartesianChart`+`Line`, empty/sparse states
- `app/(tabs)/exercises/[id].tsx` - added "View progress" `Pressable` below the exercise name, routing to `/stats/[exerciseId]`

## Decisions Made
- Stored raw `ChartSet[]` in screen state and derived the metric-specific series via `useMemo` rather than re-running the DB query on every toggle tap — keeps `useFocusEffect`'s live-recompute guarantee (D-11) scoped to `exerciseId` changes/re-focus, while metric/range stay cheap client-side derivations (matches RESEARCH.md's Open Question 2 resolution: fetch all-time once, filter client-side).
- `MetricToggle` built as a dedicated small component (not a reuse of `FilterChipRow`), since the UI-SPEC explicitly calls out that FilterChipRow is multi-select and this needs single-select radio-group semantics.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- STAT-01's first vertical slice (lib → query → screen) is fully wired and demoable: a user can open an exercise, tap "View progress", and see a real Skia line chart with working metric toggle and range chips.
- `db/stats.ts` and `lib/chartSeries.ts` establish the pure-lib/query-layer pattern the remaining Phase 4 plans (weekly volume, PR feed, record board, STAT-04 performance) will extend.
- On-device human verification of chart rendering (toggle swap, range filter, empty/sparse states) is deferred to the phase gate per the plan's verification section — not yet performed in this plan.

---
*Phase: 04-stats-charts*
*Completed: 2026-07-22*

## Self-Check: PASSED

All created files verified present on disk; all task commits (`edd7d48`, `fc776d7`, `7388cce`, `c4de125`, `4ea1757`) and this summary's commit verified in git log.
