# Deferred Items — Phase 05 (body-measurements)

Out-of-scope discoveries logged during execution, not fixed per the executor's
scope-boundary rule (only auto-fix issues directly caused by the current
task's changes).

## Plan 05-01

- **`db/templates.query.test.ts` fails to load** — `npx vitest run` (full
  suite) reports `Error: Cannot find module
  'node_modules/drizzle-orm/table.js' imported from
  node_modules/drizzle-orm/sqlite-core/query-builders/delete.js`. This is a
  module-resolution issue in an unrelated Phase 3 test file (templates
  query layer), not caused by any file this plan touches
  (`lib/measurementMetrics.ts`, `lib/measurementSeries.ts`,
  `lib/lengthUnits.ts`, `lib/dateRange.ts`, `app/stats/[exerciseId].tsx`).
  All 435 other tests across 59 files pass. Needs investigation at the start
  of the next plan/phase that touches the templates data layer, or a
  standalone dependency-resolution fix (possibly a `drizzle-orm` package
  export-map mismatch surfaced by an unrelated dependency bump).
