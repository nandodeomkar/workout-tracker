---
phase: 05-body-measurements
plan: 03
subsystem: app (measurements routes + presentational components)
tags: [expo-router, react-native, victory-native, typed-routes]

# Dependency graph
requires:
  - phase: 05-body-measurements
    plan: 01
    provides: BUILT_IN_METRICS/getMetricIcon, buildMeasurementSeries, cmToDisplay/displayToCm, rangeCutoffISO/RangeOption
  - phase: 05-body-measurements
    plan: 02
    provides: metric_definitions table, db/measurements.ts (loadMetricDefinitions/loadLatestPerMetric/loadReadingsForMetric/upsertReadingForDate/deleteReading)
provides:
  - "/measurements" route (metric list + latest values + quick weigh-in)
  - "/measurements/[metric]" route (hero + trend chart + history + delete)
  - components/MetricRow.tsx, components/HistoryRow.tsx (presentational)
  - Settings/More -> Body Measurements navigation entry point
affects: [05-04-dated-session-entry, 05-05-custom-metrics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Placeholder-route-then-implement pattern (Phase 2 history/[workoutId] precedent) applied to app/measurements/index.tsx and app/measurements/[metric].tsx so expo-router's generated typed-routes file resolves router.push calls across sequential same-plan tasks"
    - "Per-metric detail screen mirrors app/stats/[exerciseId].tsx's three-stage useMemo pipeline (buildMeasurementSeries -> range-cutoff filter -> unit conversion) verbatim, swapping buildChartSeries for buildMeasurementSeries per D-12"

key-files:
  created:
    - components/MetricRow.tsx
    - components/HistoryRow.tsx
    - app/measurements/index.tsx
    - app/measurements/[metric].tsx
  modified:
    - app/(tabs)/settings.tsx
    - app/_layout.tsx

key-decisions:
  - "Created minimal placeholder route files ahead of their full implementation within the same plan (index.tsx before Task 2 landed, [metric].tsx before Task 3 landed) so expo-router's generated .expo/types/router.d.ts could resolve each router.push call's typed literal — required an `npx expo start` cycle (Metro's file watcher) to regenerate the types file after each new route file appeared, since tsc alone does not trigger expo-router's codegen"
  - "Date-only YYYY-MM-DD readings are formatted via a manual year/month/day Date constructor (not `new Date(iso)`) to avoid a UTC-midnight-parse day-shift in negative-UTC-offset timezones — a proactive correctness fix (Rule 1) since app/stats/[exerciseId].tsx's formatRecordDate precedent operates on full ISO timestamps, not date-only strings"
  - "Two-section grouping (Body Weight: position <=1, Body Measurements: position >=2) implemented via array filters on the already-loaded metric_definitions list, no new query"

requirements-completed: [MEAS-01, MEAS-02]

# Metrics
duration: ~22min
completed: 2026-07-23
---

# Phase 05 Plan 03: Measurements Screens (Index + Per-Metric Detail) Summary

**Two new routes (`/measurements`, `/measurements/[metric]`) plus MetricRow/HistoryRow components deliver the first demoable slice: open Settings -> Body Measurements, quick-log today's weight, then view its trend chart and dated history with delete-to-correct — reusing Phase 4's chart chrome verbatim.**

## Performance

- **Duration:** ~22 min
- **Completed:** 2026-07-23T09:28Z
- **Tasks:** 3 completed
- **Files modified:** 6 (4 new, 2 modified)

## Accomplishments
- `components/MetricRow.tsx` — presentational metric-list row (leading emoji, label + caption text column, trailing chevron), exact `TemplateRow` anatomy/styles
- `components/HistoryRow.tsx` — dated reading row with two 44x44 accessible icon buttons (`accessibilityLabel="Edit reading"` / `"Delete reading"`, mandatory per UI-SPEC Dim-2)
- `app/(tabs)/settings.tsx` — new "Body Measurements" nav row (`router.push('/measurements')`), added without touching any existing Units/rest/bar-weight/Tools rows
- `app/_layout.tsx` — registered `measurements` as a new pushed-route Stack sibling
- `app/measurements/index.tsx` — loads `metric_definitions` + latest-per-metric on every focus; quick weigh-in card opens `NumericKeypad` and upserts today's canonical-kg weight via `upsertReadingForDate`; two-section grouped `MetricRow` list with unit-aware value + relative-date captions ("Today" / "N days ago" / "Jul 20, 2026"); "Log measurements" CTA wired to a `TODO(05-04)` placeholder
- `app/measurements/[metric].tsx` — mirrors `app/stats/[exerciseId].tsx`'s chart chrome: latest-value hero card, `MetricToggle` range chips (default All), `CartesianChart`/`Line`/`Scatter` fed by `buildMeasurementSeries`, empty/sparse states, reverse-chronological `HistoryRow` history list, and delete-to-correct via `Alert.alert` destructive confirmation + `deleteReading`

## Task Commits

Each task was committed atomically:

1. **Task 1: Row components + Settings nav row + route registration** - `166062f` (feat)
2. **Task 2: Measurements index screen (list + quick weigh-in)** - `9873777` (feat)
3. **Task 3: Per-metric detail screen (hero + trend chart + history + delete)** - `37e4849` (feat)

**Plan metadata:** pending (docs: complete plan, this commit)

## Files Created/Modified
- `components/MetricRow.tsx` - exports `MetricRow`, no `db/` imports
- `components/HistoryRow.tsx` - exports `HistoryRow`, accessible edit/delete icon buttons
- `app/(tabs)/settings.tsx` - new "Body Measurements" section/row (`navRow`/`navChevron` styles added)
- `app/_layout.tsx` - `<Stack.Screen name="measurements" />` sibling registration
- `app/measurements/index.tsx` - metric list + latest-value captions + quick weigh-in upsert
- `app/measurements/[metric].tsx` - hero + range chips + trend chart + history + delete

## Decisions Made
- Placeholder-route-then-implement: because both new screens are consumed by `router.push` calls made from earlier tasks in this same plan (Settings -> `/measurements` in Task 1; index -> `/measurements/[metric]` in Task 2), and expo-router's typed routes are generated from files that must physically exist on disk, each route file was created as a minimal placeholder in the task that first references it, then fully implemented in its own designated task. This matches the project's established Phase 2 precedent (`history/[workoutId].tsx` placeholder, documented in STATE.md). Regenerating `.expo/types/router.d.ts` required briefly running `npx expo start` (Metro's file watcher performs the codegen) after each new route file appeared — `tsc` alone does not trigger it.
- `formatDateLabel` parses `YYYY-MM-DD` readings via `new Date(year, month-1, day)` rather than `new Date(dateString)`, avoiding a UTC-midnight parse that can shift the displayed date by one day in negative-UTC-offset timezones — applied proactively (Rule 1) since this project's readings are date-only, unlike the full-ISO-timestamp precedent in `app/stats/[exerciseId].tsx#formatRecordDate`.
- Section grouping on the index screen (`position <= 1` → "Body Weight", `position >= 2` → "Body Measurements") is a plain array filter over the already-fetched `metric_definitions` list — no new query, matching the plan's "no SQL aggregation" house rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Placeholder route files required to unblock typed-route resolution across sequential tasks**
- **Found during:** Task 1 (Settings' `router.push('/measurements')`) and Task 2 (index's `router.push(\`/measurements/${metricKey}\`)`)
- **Issue:** expo-router's `experiments.typedRoutes` (enabled in `app.json`) generates a literal union type for every valid `router.push` target from the files that exist under `app/`. Since Task 1 references a route (`/measurements`) not yet created until Task 2, and Task 2 references a dynamic route (`/measurements/[metric]`) not yet created until Task 3, `npx tsc --noEmit` fails with a type error on each `router.push` call until the target file exists on disk and Metro's file watcher regenerates `.expo/types/router.d.ts`.
- **Fix:** Created a minimal one-line placeholder screen (`<View />`) at each target path in the task that first references it, then ran a short-lived `npx expo start` cycle to trigger the typed-routes codegen, confirming `tsc` passed before committing. The placeholder was then fully replaced in its own later task (Task 2 replaced the `index.tsx` placeholder; Task 3 replaced the `[metric].tsx` placeholder).
- **Files modified:** `app/measurements/index.tsx` (placeholder in Task 1's commit, full implementation in Task 2's commit), `app/measurements/[metric].tsx` (placeholder in Task 2's commit, full implementation in Task 3's commit)
- **Commits:** `166062f`, `9873777`, `37e4849`

This is the only deviation — all three tasks' `<action>` blocks were otherwise followed as written.

### Auth Gates

None — no external service configuration required for this plan.

## Issues Encountered

None beyond the typed-routes placeholder mechanic documented above. Full-suite `npx vitest run --no-file-parallelism` (61 files, 464 tests) passed 100% green after Task 3, confirming no regression to the `lib/`/`db/` layers this plan consumes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 04 (dated-session entry form) can now wire its two deferred markers directly: the index screen's "Log measurements" CTA (`// TODO(05-04)` in `app/measurements/index.tsx`) and the per-metric detail screen's "+ Add a reading" links + history-row edit action (`// TODO(05-04)` in `app/measurements/[metric].tsx`). Plan 05 (custom metrics) can add its "+ Add custom metric" entry point to the index screen's metric list without touching this plan's quick-weigh-in or navigation code.

No blockers.

## Human Verification Required

Per this plan's `<verify>` `<human-check>` notes (informational, not a blocking checkpoint — all three tasks are `type="auto"`/`autonomous: true`):
- On device: Settings -> Body Measurements opens the index; quick weigh-in upserts (not duplicates) today's weight; metric list shows correct captions.
- On device: after >=2 weigh-ins on different dates, the Weight detail screen's hero/chart/range-chips/history render correctly; delete removes a row and updates the chart; a metric with zero readings shows the empty state.

---
*Phase: 05-body-measurements*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 6 created/modified source files and this SUMMARY.md verified present on disk. All 3 task commits (`166062f`, `9873777`, `37e4849`) verified present in git log.
