---
phase: 01-scaffold-data-foundation
plan: 03
subsystem: database
tags: [drizzle-orm, drizzle-kit, vitest, better-sqlite3, sqlite, migrations]

# Dependency graph
requires:
  - phase: 01-scaffold-data-foundation (Plan 01)
    provides: Driver-agnostic Drizzle schema (db/schema.ts), generated migration 0000, db/test/fixture.ts with applyMigrationsUpTo(n) helper
provides:
  - Additive search/filter indexes on exercises (idx_exercises_name, idx_exercises_muscle_group, idx_exercises_equipment)
  - Generated migration 0001 (drizzle/0001_funny_impossible_man.sql) — pure CREATE INDEX, no table rebuild
  - db/migrations.test.ts — the canonical FNDN-02 migration-safety harness (populate at migration N, apply N+1, assert zero data loss) that all future schema changes are validated against
affects: [02-core-logging, 03-templates-calculators, 04-stats]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "db/migrations.test.ts as the canonical simulated-upgrade harness: open a fresh in-memory DB, applyMigrationsUpTo(n) to reach a known prior schema state, populate through the query builder, apply the next journal migration's raw SQL directly, then assert row-for-row equality plus new-index presence in sqlite_master"

key-files:
  created:
    - db/migrations.test.ts
    - drizzle/0001_funny_impossible_man.sql
    - drizzle/meta/0001_snapshot.json
  modified:
    - db/schema.ts
    - drizzle/meta/_journal.json
    - drizzle/migrations.js

key-decisions:
  - "Generated migration is 0001_funny_impossible_man.sql, not the plan's literal '0002' — consistent with Plan 01's documented 0-indexed drizzle-kit numbering (0000 is the first migration, so the second is 0001). Environment notes for this plan explicitly called out this expected mismatch; treated 'migration 0001/0002' in the plan text as 'initial migration / new migration' per that guidance."

patterns-established:
  - "db/migrations.test.ts is the canonical analog for any future N->N+1 migration-safety test: populate at applyMigrationsUpTo(N), apply migration N+1's raw SQL, assert data intact + new schema objects present."

requirements-completed: [FNDN-02]

# Metrics
duration: ~12min
completed: 2026-07-21
---

# Phase 1 Plan 3: FNDN-02 Migration-Safety Test & Exercise Search Indexes Summary

**Additive migration (0001) creates three exercise search/filter indexes via `drizzle-kit generate`, proven via a new simulated-upgrade test (`db/migrations.test.ts`) that populates a database at migration 0000 and asserts every row and the settings row survive unchanged after the upgrade, with the new indexes present in `sqlite_master`.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-21T12:27:00Z (approx)
- **Completed:** 2026-07-21T12:39:12Z
- **Tasks:** 2 (Task 1 executed as TDD: RED then GREEN via Task 2)
- **Files created/modified:** 6

## Accomplishments
- Wrote `db/migrations.test.ts`, the FNDN-02 simulated-upgrade harness: opens a fresh in-memory DB, applies only the first migration via `applyMigrationsUpTo(1)`, populates 3 exercises + 1 settings row through the Drizzle query builder, then applies the next migration's raw SQL directly and asserts pre/post row equality plus settings-row equality
- Confirmed the test is RED before the additive migration exists (journal has only one entry) — proves the test actually exercises the upgrade path rather than trivially passing
- Added three additive indexes (`idx_exercises_name`, `idx_exercises_muscle_group`, `idx_exercises_equipment`) to the `exercises` table via the `sqliteTable` index callback, with zero changes to existing columns/tables
- Generated migration 0001 via `npx drizzle-kit generate` — three `CREATE INDEX` statements only, no table rebuild; migration 0000 is byte-unchanged
- Confirmed GREEN: the populated database survives the 0000→0001 upgrade with zero data loss and all three indexes present afterward
- Full suite (12/12 tests across 4 files) and `tsc --noEmit` both clean after the change; re-running `drizzle-kit generate` is a no-op (schema and migration are in sync)

## Task Commits

Each task was committed atomically:

1. **Task 1: FNDN-02 simulated-upgrade test — RED** - `96a45ec` (test)
2. **Task 2: Additive exercise indexes + generate migration 0001 — GREEN** - `9b1923e` (feat)

**Plan metadata:** pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified

- `db/migrations.test.ts` - FNDN-02 harness: populate at migration 0000, apply the next migration's raw SQL, assert exercises + settings rows intact and the three new indexes exist in `sqlite_master`
- `db/schema.ts` - `exercises` table gains a third `sqliteTable` argument declaring `idx_exercises_name`, `idx_exercises_muscle_group`, `idx_exercises_equipment` via `index().on(...)`
- `drizzle/0001_funny_impossible_man.sql` - generated migration: three `CREATE INDEX` statements, no `DROP TABLE`/rebuild
- `drizzle/meta/0001_snapshot.json`, `drizzle/meta/_journal.json`, `drizzle/migrations.js` - drizzle-kit-generated migration bookkeeping (journal now lists 0000 then 0001 in order)

## Decisions Made

- **Migration numbering (0001, not the plan's literal "0002"):** `drizzle-kit@0.31.10` is 0-indexed, so with 0000 as the first migration (from Plan 01), the second migration it generates is 0001, not 0002. This exact mismatch was called out in advance in this plan's environment notes ("treat plan references to '0001/0002' as 'initial migration / your new migration'"), consistent with the same numbering behavior documented in Plan 01's SUMMARY. No functional impact: the journal correctly orders 0000 then 0001, `applyMigrationsUpTo(1)` reaches the post-0000 state, and the FNDN-02 test proves the upgrade path end-to-end regardless of the file's numeric prefix.

## Deviations from Plan

None (beyond the pre-acknowledged migration-numbering naming note above, which was explicitly anticipated in the plan's environment context and is not a functional deviation) - plan executed exactly as written otherwise.

## Issues Encountered

None. `npx vitest run` (12/12 tests), `npx tsc --noEmit` (0 errors), and a repeat `npx drizzle-kit generate` (no-op, schema/migration in sync) all pass cleanly on the final state.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `db/migrations.test.ts` is now the established pattern for validating every future schema change in Phases 2-8: populate at the last-known migration, apply the next one, assert data intact.
- The `exercises` table now has real search/filter indexes backing the substring search and chip filtering that Plan 04 (Exercise Library UI) will build against.
- No blockers for the next plan in this phase.

---
*Phase: 01-scaffold-data-foundation*
*Completed: 2026-07-21*

## Self-Check: PASSED

- All key files verified present on disk (`db/migrations.test.ts`, `drizzle/0001_funny_impossible_man.sql`, `drizzle/meta/0001_snapshot.json`).
- Both task commit hashes verified present in `git log` (`96a45ec`, `9b1923e`).
- Plan-level verification re-run clean: `npx drizzle-kit generate` (no-op), `npx vitest run db/migrations.test.ts` (1/1 passed), `npx vitest run` (12/12 passed), `npx tsc --noEmit` (0 errors).
