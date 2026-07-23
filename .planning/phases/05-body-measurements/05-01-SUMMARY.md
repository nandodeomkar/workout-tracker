---
phase: 05-body-measurements
plan: 01
subsystem: lib (pure math/registry)
tags: [typescript, vitest, unit-conversion, chart-series, metric-registry]

# Dependency graph
requires:
  - phase: 04-stats-charts
    provides: lib/chartSeries.ts group-by-Map convention, app/stats/[exerciseId].tsx rangeCutoffISO logic to extract
provides:
  - BUILT_IN_METRICS (15-entry metric registry, D-01/D-03) + getMetricIcon
  - buildMeasurementSeries (one-point-per-date, latest-id-wins reducer, D-12)
  - cmToDisplay/displayToCm (cm<->in converter, D-04/D-05)
  - rangeCutoffISO/RangeOption shared helper (extracted from Stats screen)
affects: [05-02-db-layer, 05-03-measurements-index, 05-04-per-metric-chart, 05-05-custom-metrics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure lib module convention (zero RN/Drizzle imports, header comment citing D-refs) reused for 4th/5th/6th time (weightUnits, chartSeries, duration precedent)"
    - "Non-finite numeric guard (Number.isFinite ? value : 0) applied to lengthUnits converters, mirroring NumericKeypad sentinel"
    - "Shared cross-screen helper extraction pattern (lib/duration.ts precedent) reused for lib/dateRange.ts"

key-files:
  created:
    - lib/measurementMetrics.ts
    - lib/measurementMetrics.test.ts
    - lib/measurementSeries.ts
    - lib/measurementSeries.test.ts
    - lib/lengthUnits.ts
    - lib/lengthUnits.test.ts
    - lib/dateRange.ts
    - lib/dateRange.test.ts
  modified:
    - app/stats/[exerciseId].tsx

key-decisions:
  - "BuiltInMetric includes an icon field (per plan's explicit interface, not RESEARCH.md's icon-less code example) so getMetricIcon has a single data source"
  - "body_fat_pct shipped as a seeded built-in (unitType 'percent'), resolving D-03's planner-discretion clause"
  - "Length rounding: 0.1cm / nearest 0.25in, cosmetic only, no plate-loadable analog (05-UI-SPEC Display precision)"

patterns-established:
  - "Metric registry as single code-side source of truth, later seeded into metric_definitions (Plan 05-02)"
  - "lib/dateRange.ts as the shared range-cutoff helper for any future chart screen (Stats + Measurements)"

requirements-completed: [MEAS-01, MEAS-02]

# Metrics
duration: 8min
completed: 2026-07-23
---

# Phase 05 Plan 01: Body-Measurements Pure-Logic Substrate Summary

**Built-in 15-metric registry, cm/in converter, one-point-per-date series reducer, and an extracted shared range-cutoff helper — the tested math substrate the DB layer and screens in Plans 02-05 consume.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-23T11:01:00+05:30
- **Completed:** 2026-07-23T11:05:00+05:30
- **Tasks:** 3 completed
- **Files modified:** 9 (8 new, 1 modified)

## Accomplishments
- `lib/measurementMetrics.ts` exports the single 15-entry `BUILT_IN_METRICS` registry (key/label/unitType/icon/position) plus `getMetricIcon`, seeding source for Plan 02's `metric_definitions` table
- `lib/measurementSeries.ts#buildMeasurementSeries` reduces per-metric readings to one point per date, highest-id wins on same-date duplicates (D-12), sorted ascending
- `lib/lengthUnits.ts` provides `cmToDisplay`/`displayToCm` (D-04/D-05), cosmetic rounding (0.1cm / 0.25in), non-finite input guarded to 0
- `lib/dateRange.ts` extracted `RangeOption`/`rangeCutoffISO` out of `app/stats/[exerciseId].tsx` (non-breaking refactor) so the upcoming per-metric chart screen shares one range helper

## Task Commits

Each task was committed atomically:

1. **Task 1: Built-in metric registry (lib/measurementMetrics.ts)** - `ec6d500` (feat)
2. **Task 2: Series reducer + cm/in converter (lib/measurementSeries.ts, lib/lengthUnits.ts)** - `2e99a17` (feat)
3. **Task 3: Extract shared range-cutoff helper (lib/dateRange.ts) + rewire Stats screen** - `c718a04` (refactor)

**Plan metadata:** pending (docs: complete plan, this commit)

## Files Created/Modified
- `lib/measurementMetrics.ts` - `UnitType`, `BuiltInMetric`, 15-entry `BUILT_IN_METRICS`, `CUSTOM_METRIC_ICON`, `getMetricIcon`
- `lib/measurementMetrics.test.ts` - count/uniqueness/position-contiguity/unit-type/icon-lookup tests
- `lib/measurementSeries.ts` - `MeasurementReading`, `MeasurementPoint`, `buildMeasurementSeries` (latest-id-wins per date)
- `lib/measurementSeries.test.ts` - empty/dedup/sort/no-max-min tests
- `lib/lengthUnits.ts` - `cmToDisplay`, `displayToCm` (canonical cm, D-04/D-05)
- `lib/lengthUnits.test.ts` - rounding/zero/non-finite/round-trip tests
- `lib/dateRange.ts` - `RangeOption`, `rangeCutoffISO` (extracted verbatim from Stats screen)
- `lib/dateRange.test.ts` - All->null, non-null ISO, 3M>1Y-cutoff tests
- `app/stats/[exerciseId].tsx` - removed local `RangeOption`/`rangeCutoffISO`, imports from `lib/dateRange`; all call sites and `RANGE_OPTIONS` unchanged

## Decisions Made
- `BuiltInMetric` includes an `icon` field directly in the interface (per plan Task 1's explicit spec) rather than a separate icon map, so `getMetricIcon` has one lookup table to maintain
- `body_fat_pct` seeded as a built-in metric with `unitType: 'percent'` — resolves CONTEXT.md D-03's planner-discretion clause in favor of "seeded built-in" (matches RESEARCH.md Assumption A1)
- Length display rounding fixed at nearest 0.1cm / nearest 0.25in — cosmetic only, explicitly no plate-loadable analog for body-part measurements (05-UI-SPEC "Display precision")

## Deviations from Plan

None - plan executed exactly as written. All four `lib/*.ts` modules, their tests, and the Stats-screen refactor match the plan's `<action>` blocks and `must_haves.artifacts` contract.

## Issues Encountered

The task 1 acceptance-criteria grep (`grep -v '^//' lib/measurementMetrics.ts | grep -c "metricKey:"` expected to return 15) returns 17 because the `BuiltInMetric` interface's field declaration (`metricKey: string;`) and `getMetricIcon`'s parameter (`metricKey: string`) also match the literal pattern `metricKey:`, in addition to the 15 array-entry occurrences. This is a heuristic-grep mismatch in the plan's acceptance script, not a functional defect — the actual `<verify>` mechanism (the vitest suite, which asserts exactly 15 entries, uniqueness, and 0..14 contiguous positions) passes cleanly. No code change was made to force the grep count, since doing so would require an unnatural rename of the interface field or the function parameter.

A full-suite `npx vitest run` (all 60 test files) surfaced one pre-existing, unrelated failure: `db/templates.query.test.ts` cannot load due to `Cannot find module 'drizzle-orm/table.js'` imported from `drizzle-orm/sqlite-core/query-builders/delete.js`. This file is untouched by this plan and the failure is a module-resolution issue in the Phase 3 templates data layer, not caused by any of this plan's changes. All 435 individual tests across the other 59 files pass, including the four new `lib/*.test.ts` suites and the full pre-existing Phase 1-4 regression set (confirming the `dateRange.ts` extraction is non-breaking). Logged to `.planning/phases/05-body-measurements/deferred-items.md` per the scope-boundary rule rather than fixed inline.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 02-05 can now import a tested, single-source metric registry, series reducer, length converter, and shared range helper. `metric_definitions` seeding (Plan 02) reads `BUILT_IN_METRICS` directly; the per-metric chart screen (Plan 04) imports `buildMeasurementSeries`, `cmToDisplay`/`displayToCm`, and `rangeCutoffISO` without re-deriving any of this math.

No blockers. The pre-existing `db/templates.query.test.ts` module-resolution failure (see Issues Encountered) should be triaged before or during whichever future plan next touches the templates data layer, or as a standalone dependency-resolution fix.

---
*Phase: 05-body-measurements*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 8 created/modified `lib/`+screen files and the SUMMARY.md itself verified present on disk. All 3 task commits (`ec6d500`, `2e99a17`, `c718a04`) verified present in git log.
