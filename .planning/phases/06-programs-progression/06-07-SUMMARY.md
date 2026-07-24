---
phase: 06-programs-progression
plan: 07
subsystem: database
tags: [drizzle, sqlite, migration, progression, schema, expo-sqlite]

# Dependency graph
requires:
  - phase: 06-programs-progression (Plan 02)
    provides: programs/program_days/template_exercises tables, migration 0004, drizzle/migrations.js m0004 wiring, db/migrations.test.ts additive-migration harness
provides:
  - program_exercise_progress table (composite PK on program_id, exercise_id) — the per-LIFT-per-PROGRAM shared linear progression state (nullable working_weight_kg + consecutive_fails)
  - ProgramExerciseProgress / NewProgramExerciseProgress inferred row types
  - additive migration 0005 (generated) proven data-safe against a populated 0004 DB
affects: [06-programs-progression]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite-primary-key drizzle table via primaryKey({ columns: [...] }) in the table's second-arg callback (first use of a composite PK in this schema)"
    - "Migration-safety test keyed by journal INDEX (idx 5), never by drizzle-kit's random 0005 filename, so the test survives regeneration"

key-files:
  created:
    - drizzle/0005_mushy_gressill.sql
    - drizzle/meta/0005_snapshot.json
  modified:
    - db/schema.ts
    - drizzle/meta/_journal.json
    - drizzle/migrations.js
    - db/migrations.test.ts

key-decisions:
  - "Kept drizzle-kit's generated random migration filename (0005_mushy_gressill.sql) per established project precedent"
  - "working_weight_kg is NULLABLE — null encodes 'unset' (first run, before any finish has anchored the lift); consecutive_fails is NOT NULL DEFAULT 0"
  - "Composite PK (program_id, exercise_id) enforces one shared progression row per lift per program at the DB level"
  - "Migration-safety test references the journal entry by index (journal.entries[5]) and seeds via raw SQL (schema.ts head is ahead of the 0004 point, so Drizzle inserts would reference not-yet-created columns)"

patterns-established:
  - "Per-lift-per-program progression storage row: the storage contract Plan 06-08 reads (prefill) and writes (finish-time upsert)"

requirements-completed: [PROG-02]

# Metrics
duration: 8min
completed: 2026-07-24
---

# Phase 06 Plan 07: Per-Lift Progression Storage Model Summary

**New `program_exercise_progress` table (composite PK program_id+exercise_id, nullable working_weight_kg + consecutive_fails) plus additive migration 0005, proven data-safe against a populated 0004 DB — the storage contract the Test-3 blocker fix (Plan 06-08) builds on.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-24T10:19:53+05:30
- **Completed:** 2026-07-24T10:20:50+05:30
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- Added `programExerciseProgress` to `db/schema.ts`: a program-scoped, per-lift progression state row keyed by a composite `(program_id, exercise_id)` primary key, carrying a nullable `working_weight_kg` and a `consecutive_fails` (NOT NULL DEFAULT 0). Exported `ProgramExerciseProgress` / `NewProgramExerciseProgress` inferred types.
- Generated additive migration `0005_mushy_gressill.sql` via `drizzle-kit generate` — a single `CREATE TABLE program_exercise_progress` with the composite PK and both FKs, zero `ALTER`/`DROP`. Journal, snapshot, and `migrations.js` m0005 wiring all owned by the generator.
- Added a `db/migrations.test.ts` case proving 0004→0005 is a safe simulated app upgrade: seeded `programs`/`program_days` rows are byte-identical before and after, and `program_exercise_progress` appears with its four expected columns.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add program_exercise_progress table + generate additive migration 0005** - `bdd2bbc` (feat)
2. **Task 2: Migration-safety test — 0004 → 0005 preserves data** - `3629cce` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `db/schema.ts` - Added the `programExerciseProgress` composite-PK table + its two inferred row types; imported `primaryKey` from `drizzle-orm/sqlite-core`
- `drizzle/0005_mushy_gressill.sql` - Generated additive migration (single CREATE TABLE, composite PK, two FK clauses, no ALTER/DROP)
- `drizzle/meta/0005_snapshot.json` - Generated schema snapshot for 0005
- `drizzle/meta/_journal.json` - Appended idx-5 journal entry (tag `0005_mushy_gressill`)
- `drizzle/migrations.js` - Generator-added `import m0005` + m0005 entry
- `db/migrations.test.ts` - Appended the PROG-02 0004→0005 additive-safety describe block, indexed by journal position (idx 5)

## Decisions Made
- Followed plan as specified — nullable `working_weight_kg` (encodes "unset"), NOT NULL `consecutive_fails` default 0, composite PK, generator-owned migration files, journal-index-based test.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

The executor subagent terminated early on an API connection error (`Connection closed mid-response`) *after* both task commits (`bdd2bbc`, `3629cce`) landed but *before* writing this SUMMARY. Closed out via the orchestrator safe-resume path: spot-checked that both commits, migration 0005, journal/migrations.js wiring, and the test case were present and correct on disk, re-ran verification (`tsc --noEmit` clean; `vitest run db/migrations.test.ts --no-file-parallelism` → 6/6 pass), then authored this SUMMARY. No re-execution or duplicate commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The storage contract Plan 06-08 depends on is in place: `program_exercise_progress` exists in schema, migration 0005 is wired and data-safe.
- `npx tsc --noEmit` clean. `npx vitest run db/migrations.test.ts --no-file-parallelism` passes (6/6).
- Additive migration verified purely `CREATE TABLE` — no existing table altered or dropped.
- Ready for Plan 06-08 (linear prefill + per-lift progression sharing keyed on this table).

---
*Phase: 06-programs-progression*
*Completed: 2026-07-24*

## Self-Check: PASSED

All created/modified files exist on disk; both task commit hashes (bdd2bbc, 3629cce) verified present in git log; tsc clean; migration test green (6/6).
