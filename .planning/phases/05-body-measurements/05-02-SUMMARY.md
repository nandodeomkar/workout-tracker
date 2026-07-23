---
phase: 05-body-measurements
plan: 02
subsystem: db (schema + migration + data layer)
tags: [drizzle, sqlite, migration, crud, vitest, better-sqlite3]

# Dependency graph
requires:
  - phase: 05-body-measurements
    plan: 01
    provides: BUILT_IN_METRICS registry (seed source), UnitType
provides:
  - metric_definitions table (metric_key PK, label, unit_type, is_custom, position) + generated migration 0003
  - MetricDefinition/NewMetricDefinition inferred types
  - db/measurements.ts (guarded, parameterized CRUD + history + custom-metric creation)
  - Built-in metric seed (seed_version 4) additive into metric_definitions
affects: [05-03-measurements-index, 05-04-per-metric-chart, 05-05-custom-metrics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seeded-plus-custom table pattern (exercises precedent) applied to metric_definitions: metricKey plays seedId's unique-conflict-target role"
    - "Driver-agnostic AnyDrizzleDb = BaseSQLiteDatabase<'async'|'sync',any,any> signature convention (db/settings.ts/db/workouts.ts precedent) applied to db/measurements.ts"
    - "Select-then-branch upsert-by-key (loadLastPerformance precedent) for upsertReadingForDate/insertReadingsForDate, since body_measurements has no DB-level unique key across (metric, measuredAt)"

key-files:
  created:
    - db/measurements.ts
    - db/measurements.crud.test.ts
    - drizzle/0003_awesome_fat_cobra.sql
    - drizzle/meta/0003_snapshot.json
  modified:
    - db/schema.ts
    - db/schema.test.ts
    - db/migrations.test.ts
    - db/seed/runSeed.ts
    - db/seed/seedVersion.ts
    - drizzle/meta/_journal.json
    - drizzle/migrations.js

key-decisions:
  - "Kept drizzle-kit's generated random migration filename (0003_awesome_fat_cobra.sql) rather than renaming to the plan's placeholder 0003_metric_definitions.sql, matching this project's established precedent (0000/0001/0002 all kept their generated names)"
  - "loadLatestPerMetric's 'most recent' tie-break uses measuredAt then id (highest wins), mirroring lib/measurementSeries.ts's latest-id-wins convention (D-12) rather than insertion order alone"
  - "insertReadingsForDate pre-fetches existing same-date rows in one query OUTSIDE the transaction, then only performs .run() writes inside the synchronous transaction callback — avoids relying on undocumented sync-only query-builder methods (.all()) on the AnyDrizzleDb union type inside a transaction"

requirements-completed: [MEAS-01, MEAS-02]

# Metrics
duration: 25min
completed: 2026-07-23
---

# Phase 05 Plan 02: Body-Measurements Persistence Layer Summary

**Additive `metric_definitions` table (generated migration 0003) seeded with the 15 built-in metrics, plus `db/measurements.ts` — a fully guarded, parameterized CRUD + history + custom-metric-creation data layer every measurement screen will read/write through.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-23T09:00Z
- **Tasks:** 2 completed
- **Files modified:** 11 (4 new, 7 modified)

## Accomplishments
- `db/schema.ts` gains `metricDefinitions` (mirrors `exercises`' `seedId`/`isCustom` shape) plus `MetricDefinition`/`NewMetricDefinition` inferred types
- Generated migration `drizzle/0003_awesome_fat_cobra.sql` is a single additive `CREATE TABLE metric_definitions` — no `ALTER`/`DROP` on any existing table, journal/meta/migrations.js updated by `drizzle-kit generate` itself
- `db/migrations.test.ts` gained a `MEAS-01: migration 0002 -> 0003` upgrade test proving a populated `body_measurements` table survives the upgrade unchanged and the new table appears with all 5 expected columns
- `db/schema.test.ts`'s `EXPECTED_TABLES` extended to 14 tables including `metric_definitions`
- `db/seed/runSeed.ts` additively seeds all 15 `BUILT_IN_METRICS` via `onConflictDoNothing({ target: metricDefinitions.metricKey })`; `CURRENT_SEED_VERSION` bumped 3 → 4
- `db/measurements.ts` provides `assertValidMeasurementValue`/`assertValidMeasuredAt` guards, `loadMetricDefinitions`/`loadLatestPerMetric`/`loadReadingsForMetric` queries, `insertReading`/`updateReading`/`deleteReading`/`upsertReadingForDate`/`insertReadingsForDate` writes, and `createCustomMetric` — all driver-agnostic (`AnyDrizzleDb`), all parameterized Drizzle (zero raw SQL)
- `db/measurements.crud.test.ts` covers seed count/idempotency, every guard rejection path, CRUD round-trip, date/id ordering, upsert-vs-insert branching, and custom-metric persistence + duplicate no-op

## Task Commits

Each task was committed atomically:

1. **Task 1: metric_definitions schema + generated migration 0003 + data-intact upgrade test** - `bcef50a` (feat)
2. **Task 2: Seed built-ins + validated CRUD/history data layer (db/measurements.ts)** - `e119f00` (feat)

**Plan metadata:** pending (docs: complete plan, this commit)

## Files Created/Modified
- `db/schema.ts` - added `metricDefinitions` table + `MetricDefinition`/`NewMetricDefinition` types
- `drizzle/0003_awesome_fat_cobra.sql` - generated additive `CREATE TABLE metric_definitions`
- `drizzle/meta/0003_snapshot.json`, `drizzle/meta/_journal.json`, `drizzle/migrations.js` - generated/updated migration bookkeeping (journal idx 3, `m0003` import)
- `db/schema.test.ts` - `EXPECTED_TABLES` now lists 14 tables including `metric_definitions`
- `db/migrations.test.ts` - new `MEAS-01: migration 0002 -> 0003` data-intact upgrade test block
- `db/seed/runSeed.ts` - additive `metric_definitions` seed loop from `BUILT_IN_METRICS`
- `db/seed/seedVersion.ts` - `CURRENT_SEED_VERSION` 3 → 4, with `// v4:` comment
- `db/measurements.ts` - new CRUD + history + custom-metric data layer (11 exported functions/guards)
- `db/measurements.crud.test.ts` - new in-memory test suite (18 tests)

## Decisions Made
- Kept the drizzle-kit-generated random migration filename (`0003_awesome_fat_cobra.sql`) instead of renaming to the plan's placeholder `0003_metric_definitions.sql` — matches this project's established precedent (STATE.md: "Kept drizzle-kit's standard 0000-indexed migration filename instead of renaming... to preserve safe forward migration-numbering")
- `loadLatestPerMetric`'s tie-break for "most recent" compares `measuredAt` then `id` (highest wins on a same-date tie), consistent with `lib/measurementSeries.ts#buildMeasurementSeries`'s latest-id-wins convention from Plan 01 (D-12) rather than relying on insertion/select order
- `insertReadingsForDate` pre-fetches existing same-date rows via one `await`ed query **before** opening the transaction, then the transaction callback contains only synchronous `.run()` writes — sidesteps any ambiguity around whether `.all()` is a safe/typed method to call on a `tx` built from the `'async' | 'sync'` union `AnyDrizzleDb` type inside a transaction callback, while still honoring the "no `await` inside `db.transaction`" convention from `db/workouts.ts#reorderWorkoutExercises`

## Deviations from Plan

None — plan executed exactly as written. Both tasks' `<action>` blocks were followed verbatim: schema addition → `drizzle-kit generate` → schema-test/migration-test updates (Task 1); seed loop + seed-version bump → `db/measurements.ts` → CRUD test suite (Task 2). The one implementation-detail choice not explicitly pinned by the plan (the exact form of the pre-fetch-then-transaction shape for `insertReadingsForDate`, described above) is a same-behavior refinement of the plan's stated `db.transaction((tx)=>{….run()})` shape, not a deviation from its `<behavior>`/`<acceptance_criteria>`.

## Issues Encountered

A full-suite `npx vitest run` intermittently threw `Error: The paging file is too small for this operation to complete` from `better-sqlite3`'s native binding when Windows' default multi-fork worker pool ran out of virtual memory for a subset of concurrently-spawned workers — a machine/environment resource constraint (Windows paging file sizing), not a code defect. Confirmed by re-running the affected file in isolation (passed cleanly) and by re-running the entire 61-file, 464-test suite with `--no-file-parallelism`, which passed 100% green with zero failures. No code change was made in response to this; it is an environment characteristic of this specific Windows machine, not a regression in this plan's changes.

The previously-logged pre-existing `db/templates.query.test.ts` "Cannot find module 'drizzle-orm/table.js'" failure (noted in the 05-01 SUMMARY and `deferred-items.md`) did **not** reproduce during this plan's full-suite run — it passed. No action taken; the deferred-items entry is left as-is since Plan 05-02 did not touch that file and cannot confirm whether the earlier failure was itself an intermittent module-resolution flake.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 03-05 can now build every screen against a single, fully-tested data layer: `loadMetricDefinitions`/`loadLatestPerMetric` for the measurements index list, `loadReadingsForMetric` + `lib/measurementSeries.ts#buildMeasurementSeries` (Plan 01) for the per-metric trend graph, `insertReading`/`updateReading`/`deleteReading` for full edit/delete control (D-09), `upsertReadingForDate`/`insertReadingsForDate` for the quick-weigh-in and dated-session entry flows (D-08), and `createCustomMetric` for user-added metrics (D-02/D-06).

No blockers.

---
*Phase: 05-body-measurements*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 10 created/modified files (schema, measurements data layer + test, generated migration + snapshot, seed files, schema/migration test files, and this SUMMARY.md) verified present on disk. Both task commits (`bcef50a`, `e119f00`) verified present in git log.
