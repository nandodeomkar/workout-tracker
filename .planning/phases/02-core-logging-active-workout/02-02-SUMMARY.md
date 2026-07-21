---
phase: 02-core-logging-active-workout
plan: 02
subsystem: database
tags: [drizzle, sqlite, better-sqlite3, vitest, migrations, crash-safety]

# Dependency graph
requires:
  - phase: 01-scaffold-data-foundation
    provides: db/schema.ts, db/exercises.ts conventions (AnyDrizzleDb, validate-then-.returning()), db/test/fixture.ts (createTestDb), migration-safety harness precedent (FNDN-02)
provides:
  - "exercises.restSeconds nullable column (D-08) via additive migration 0002_young_preak.sql"
  - "db/workouts.ts: crash-safe workout/set write, resume, and last-performance pre-fill data layer"
  - "db/settings.ts: key-value settings read-with-fallback helper (units, default_rest_seconds)"
affects: [02-03 (exercise mutations/discard/finish/history), 02-04 (active-workout screen), 02-05 (settings screen), 02-06 (rest timer)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Raw sqlite prepared statements (not the Drizzle query builder) for populating/reading pre-migration snapshots in upgrade-safety tests, since db/schema.ts always describes the current full schema and Drizzle's insert always references every schema-declared column"
    - "AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any> reused verbatim in db/workouts.ts and db/settings.ts for driver-agnostic modules"

key-files:
  created:
    - db/workouts.ts
    - db/workouts.query.test.ts
    - db/workouts.crud.test.ts
    - db/settings.ts
    - db/settings.test.ts
    - drizzle/0002_young_preak.sql
  modified:
    - db/schema.ts
    - db/migrations.test.ts
    - db/exercises.query.test.ts

key-decisions:
  - "Rewrote both migration-upgrade tests (existing FNDN-02 block + new D-08 block) to populate/read via raw sqlite statements instead of Drizzle, since schema.ts is now ahead of any pre-head migration point and Drizzle's insert unconditionally references every schema column"
  - "loadLastPerformance filters workouts.finishedAt IS NOT NULL (RESEARCH.md Pattern 2 note) so an in-progress workout's own just-added, sets-less row never wins the pre-fill query"
  - "startWorkout accepts an optional templateId in addition to the plan's documented name-only input, since workouts.templateId already exists on the schema and costs nothing to thread through now"

requirements-completed: [LOG-01, LOG-02, LOG-06]

# Metrics
duration: 10min
completed: 2026-07-22
---

# Phase 02 Plan 02: Crash-Safe Workout/Set Data Core Summary

**Additive `exercises.rest_seconds` migration plus a crash-safe `db/workouts.ts` write/resume/pre-fill data layer and `db/settings.ts` key-value helper, all proven at the better-sqlite3 in-memory vitest layer.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-22T01:08Z (after 02-01 completion)
- **Completed:** 2026-07-22T01:18:46+05:30
- **Tasks:** 3
- **Files modified:** 9 (3 modified, 6 created, plus generated migration snapshot/journal/bundle)

## Accomplishments
- `exercises.restSeconds` nullable column added via `drizzle-kit generate` (migration `drizzle/0002_young_preak.sql`), proven non-destructive against a populated DB by a new `db/migrations.test.ts` describe block
- `db/workouts.ts` crash-safe session-write core: `startWorkout`, `findResumableWorkout`, `addWorkoutExercise`, `insertSet`, `updateSet`, `loadLastPerformance`, `loadWorkoutDetail`, plus `assertValidWeightKg`/`assertValidReps` input guards
- `db/settings.ts` key-value helper (`getSetting`/`setSetting`) with safe upsert via `onConflictDoUpdate`, mirroring the existing `runSeed.ts` seed_version precedent
- A dedicated crash-safety test opens a second, independent Drizzle instance on the same sqlite handle and re-reads a just-written set, proving LOG-02/D-15 persistence semantics

## Task Commits

Each task was committed atomically:

1. **Task 1: Additive rest_seconds migration (D-08/FNDN-02)** - `95c3c3e` (feat)
2. **Task 2: Workout/set session-write core (db/workouts.ts)** - `8e28d21` (feat)
3. **Task 3: Settings key-value helper (db/settings.ts)** - `f76b82b` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `db/schema.ts` - added `exercises.restSeconds` nullable int column (D-08)
- `drizzle/0002_young_preak.sql` - generated additive `ALTER TABLE exercises ADD rest_seconds` migration
- `drizzle/meta/_journal.json`, `drizzle/meta/0002_snapshot.json`, `drizzle/migrations.js` - drizzle-kit-generated migration bundle updates
- `db/migrations.test.ts` - new D-08 upgrade-safety describe block; both blocks rewritten to use raw sqlite statements for pre-migration population/reads
- `db/exercises.query.test.ts` - `makeRow` helper default `restSeconds: null` to satisfy the widened `Exercise` type
- `db/workouts.ts` - crash-safe workout/set data layer (LOG-01/LOG-02/D-06/D-15)
- `db/workouts.query.test.ts` - resume detection, last-performance pre-fill, workout-detail ordering tests
- `db/workouts.crud.test.ts` - startWorkout/insertSet/updateSet tests incl. reject-negative-weight/reps and the crash-safe re-read test
- `db/settings.ts` - `getSetting`/`setSetting` key-value helper (D-07/D-14)
- `db/settings.test.ts` - absent-key, round-trip, idempotent-update tests

## Decisions Made
- Used raw `sqlite.prepare(...)` statements (not Drizzle) to populate/read the "before" snapshot in both migration-upgrade tests, since `db/schema.ts` always reflects the current full schema head and Drizzle's insert query builder unconditionally references every schema-declared column (writing `NULL` for omitted ones) — this breaks against a physical table that hasn't yet received a later migration's columns. This is a structural pattern any future N→N+1 upgrade test in this file must follow.
- `loadLastPerformance` explicitly filters `isNotNull(workouts.finishedAt)` per RESEARCH.md Pattern 2's note, confirmed necessary by a dedicated test (an in-progress workout's own empty row would otherwise win the "most recent" ordering).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed the FNDN-02 migration test breaking after the schema.ts change**
- **Found during:** Task 1 (rest_seconds migration)
- **Issue:** Adding `exercises.restSeconds` to `db/schema.ts` made the *existing* FNDN-02 upgrade test fail: `db.insert(exercises).values(ex).run()` against a table still at migration 0000 threw `SqliteError: table exercises has no column named rest_seconds`, because Drizzle's insert always references every schema-declared column (using `NULL` for undefined ones), and the physical table hadn't reached migration 0002 yet. The new D-08 upgrade test I was writing hit the identical failure.
- **Fix:** Rewrote both `db/migrations.test.ts` describe blocks to populate and read the pre-migration snapshot via raw `better-sqlite3` prepared statements instead of the Drizzle query builder, keeping Drizzle only implicitly out of the loop until the DB is fully at the schema head. Documented the reasoning in the file's header comment so future N→N+1 migration tests in this file follow the same pattern.
- **Files modified:** `db/migrations.test.ts`
- **Verification:** `npx vitest run db/migrations.test.ts` — both describe blocks pass.
- **Committed in:** `95c3c3e` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed a TypeScript compile error in an out-of-scope test file**
- **Found during:** Task 1, post-change `npx tsc --noEmit` check
- **Issue:** `db/exercises.query.test.ts`'s `makeRow` helper builds a full `Exercise` object without `restSeconds`; the widened `Exercise` type (now requiring `restSeconds: number | null`, not optional) made this a compile error.
- **Fix:** Added `restSeconds: null` to `makeRow`'s default field set.
- **Files modified:** `db/exercises.query.test.ts`
- **Verification:** `npx tsc --noEmit` clean; `npx vitest run` all 68 tests (pre-Task-2 count) pass.
- **Committed in:** `95c3c3e` (Task 1 commit)

**3. [Rule 1 - Bug] Fixed loadLastPerformance not filtering on finished workouts**
- **Found during:** Task 2, while writing the "ignores an in-progress workout's own rows" test
- **Issue:** The initial `loadLastPerformance` implementation joined `workout_exercises` → `workouts` and ordered by `startedAt DESC` but did not filter `workouts.finishedAt IS NOT NULL` — RESEARCH.md Pattern 2 explicitly calls this out as required. The test caught it: an in-progress workout's own empty `workout_exercises` row was winning the "most recent" ordering, returning `[]` instead of the finished performance's sets.
- **Fix:** Added `isNotNull(workouts.finishedAt)` to the join's `where` clause (via `and(...)`).
- **Files modified:** `db/workouts.ts`
- **Verification:** `npx vitest run db/workouts.query.test.ts` — the "ignores an in-progress workout" test and all others pass.
- **Committed in:** `8e28d21` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs surfaced by the schema change, 1 bug caught by the plan's own required test coverage)
**Impact on plan:** All three are correctness fixes directly within this plan's scope (its own schema change and its own new module). No scope creep — no unrelated files touched.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `db/workouts.ts` and `db/settings.ts` are ready for Plan 04 (active-workout screen) to call directly — every function takes `db: AnyDrizzleDb` first, matching the existing `db/exercises.ts` convention.
- `exercises.restSeconds` is live on the schema and migration chain; Plan 05 (settings/rest UI) and Plan 06 (rest timer) can read/write it.
- Plan 03 still owes: exercise mutations during an active workout (add/reorder/replace/remove), discard/finish-workout hard-delete cascade, and history queries — none of that is implemented here by design (plan boundary stated in the phase-goal note).
- No blockers identified.

---
*Phase: 02-core-logging-active-workout*
*Completed: 2026-07-22*

## Self-Check: PASSED

All created files verified present on disk; all three task commits (95c3c3e, 8e28d21, f76b82b) verified present in git log.
