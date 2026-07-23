---
phase: 06-programs-progression
plan: 02
subsystem: database
tags: [drizzle, sqlite-migration, vitest, tdd, programs, bundled-data]

# Dependency graph
requires:
  - phase: 06-programs-progression (Plan 01)
    provides: lib/progression.ts pure linear + percent-of-TM resolvers, DEFAULT_LINEAR_INCREMENT_KG/DEFAULT_WAVE_SCHEME constants
provides:
  - "Additive migration 0004: workouts.program_id/program_day_position (D-05 origin marker), template_exercises.consecutive_fails (D-08 fail counter)"
  - "db/programs.ts: createProgram, addProgramDay, loadProgramDetail, loadActiveProgram, setActiveProgram, deleteProgram, materializeBundledProgram, startWorkoutFromProgramDay, getTrainingMax, setTrainingMax, listProgramTrainingMaxes"
  - "db/templates.ts: TemplateExerciseInput/AddTemplateExerciseInput gain an optional progression field (D-17 authoring write-path)"
  - "data/bundledPrograms/{linear5x5.json,percentWave.json,index.ts}: two generic bundled programs + resolveExerciseSeedIds helper"
affects: [06-03-programs-ui, 06-04-finish-flow-progression, 06-05-percent-tm-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "db/programs.ts mirrors db/templates.ts exactly: driver-agnostic AnyDrizzleDb type, assertValid* guards, synchronous db.transaction((tx)=>{...run()}) callbacks"
    - "Bundled program JSON typed distinctly (BundledProgramDefinition) from Program/Template DB rows — materialization is the only translation path (clone-not-mutate, Pitfall 4)"
    - "Every bundle exercise seed_id resolved up front (before any DB write) — a missing mapping throws before any partial materialization occurs (Pitfall 6)"

key-files:
  created:
    - db/programs.ts
    - db/programs.crud.test.ts
    - data/bundledPrograms/linear5x5.json
    - data/bundledPrograms/percentWave.json
    - data/bundledPrograms/index.ts
    - drizzle/0004_bent_moondragon.sql
    - drizzle/meta/0004_snapshot.json
  modified:
    - db/schema.ts
    - db/templates.ts
    - drizzle/meta/_journal.json
    - drizzle/migrations.js

key-decisions:
  - "template_exercises.progression JSON is stored camelCase matching lib/progression.ts's LinearProgressionRule{incrementKg}/PercentTmRule{sets} TypeScript interfaces directly (not the schema.ts doc comment's stale snake_case example) — avoids a translation layer between the stored JSON and the pure resolver types it feeds"
  - "materializeBundledProgram resolves every bundle exercise seed_id across ALL days up front, before any DB write — stronger than per-day resolution, guarantees a missing seed_id never leaves a partially-materialized program"
  - "materializeBundledProgram always ends with setActiveProgram(...,0) — Add and Start are the same action at this data-layer contract; a future 'add without activating' UI affordance is out of scope for this plan"
  - "setTrainingMax uses onConflictDoUpdate keyed on training_maxes.exercise_id (mirrors db/settings.ts#setSetting), avoiding a separate exists-check/insert-or-update branch"

patterns-established:
  - "db/programs.ts: transactional program data layer reused as-is by the finish-flow progression-apply plan (06-04) and the programs-manager UI (06-03)"

requirements-completed: [PROG-01, PROG-04]

# Metrics
duration: 14min
completed: 2026-07-23
---

# Phase 6 Plan 2: Programs Data Layer Summary

**Additive migration 0004 (program origin marker + fail counter) plus a transactional `db/programs.ts` data layer that clones bundled-program JSON into user-owned rows, starts workouts from any program day with a crash-safe origin marker, and manages per-exercise training maxes.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-23T23:16:03+05:30 (approx, immediately after 06-01)
- **Completed:** 2026-07-23T23:30:11+05:30
- **Tasks:** 3 (Task 1: migration; Task 2: TDD RED+GREEN for db/programs.ts; Task 3: bundled JSON)
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments
- Migration `0004_bent_moondragon.sql` adds `workouts.program_id`/`program_day_position` (nullable, D-05 origin marker) and `template_exercises.consecutive_fails` (not-null default 0, D-08 fail counter) — generated via `drizzle-kit generate`, bundled in `migrations.js`, journal-tracked; existing `db/schema.test.ts`/`db/migrations.test.ts` (which apply every journal migration through the shared fixture) prove the SQL is valid and the columns exist at runtime
- `db/programs.ts`: full CRUD (`createProgram`/`addProgramDay`/`loadProgramDetail`), single-active-program pointer (`loadActiveProgram`/`setActiveProgram`, D-01), detach-before-delete (`deleteProgram`, mirrors `deleteTemplate`'s Pitfall-3 discipline), bundle materialization (`materializeBundledProgram`, D-15/Pitfall 4/Pitfall 6), program-day start with origin marker (`startWorkoutFromProgramDay`, D-04/D-05), and training-max storage (`getTrainingMax`/`setTrainingMax`/`listProgramTrainingMaxes`)
- `db/templates.ts` gains an optional `progression` field on `TemplateExerciseInput`/`AddTemplateExerciseInput`, persisted by `addTemplateExercise`/`setTemplateExercises` — the write-path Phase 6's template-builder authoring (D-17) and bundle materialization both drive
- Two bundled programs shipped as static JSON: "Linear 5x5 (3-Day)" (2 alternating days, linear progression) and "Percent-Based Wave (4-Day)" (16-day flattened wave, 4 lifts × 4 weeks, Week 4 = 40/50/60% deload) — both generic names, no proprietary/trademarked content
- `data/bundledPrograms/index.ts` exports typed bundle definitions, `LIFT_SEED_IDS`, and `resolveExerciseSeedIds` — the seed_id → `exercises.id` resolution step `materializeBundledProgram` requires before any write

## Task Commits

Each task was committed atomically:

1. **Task 1: Additive migration 0004** - `c19e02c` (feat)
2. **Task 2 RED: failing tests for db/programs.ts** - `42f97e8` (test)
2. **Task 2 GREEN: implement db/programs.ts + templates.ts progression field** - `7760834` (feat)
3. **Task 3: Bundled program JSON definitions** - `1fc73b7` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Task 2 was TDD (`tdd="true"`): RED (failing test, module didn't exist) → GREEN (implementation, all tests pass). No REFACTOR commit was needed — the GREEN implementation required no follow-up cleanup._

## Files Created/Modified
- `db/schema.ts` - Added `workouts.programId`/`programDayPosition` (nullable) and `templateExercises.consecutiveFails` (not-null default 0)
- `drizzle/0004_bent_moondragon.sql` - Generated additive migration (3 `ALTER TABLE ... ADD COLUMN` statements)
- `drizzle/meta/0004_snapshot.json`, `drizzle/meta/_journal.json`, `drizzle/migrations.js` - Migration bundling (drizzle-kit generated + auto-updated `migrations.js`)
- `db/programs.ts` - Program CRUD, bundle materialization, start-from-day, training-max storage, ASVS V5 guards
- `db/programs.crud.test.ts` - 15 tests: create/detail, materialize, missing-seed-id throw, clone independence, advance/pointer, origin-marker guard, delete detach, training-max CRUD/listing, seed mapping
- `db/templates.ts` - `progression` field added to `TemplateExerciseInput`/`AddTemplateExerciseInput`, persisted in `addTemplateExercise`/`setTemplateExercises`
- `data/bundledPrograms/linear5x5.json` - "Linear 5x5 (3-Day)" bundle definition
- `data/bundledPrograms/percentWave.json` - "Percent-Based Wave (4-Day)" bundle definition (16 days)
- `data/bundledPrograms/index.ts` - Typed exports, `LIFT_SEED_IDS`, `resolveExerciseSeedIds`

## Decisions Made
- Stored `progression` JSON in camelCase matching `lib/progression.ts`'s actual TS interfaces (`incrementKg`, `sets`) rather than the Phase-1 schema doc comment's stale snake_case illustration — since this plan is the first to write real data into that column, the pure resolver types are the source of truth for its shape, avoiding a parse-time translation layer.
- `materializeBundledProgram` validates every bundle exercise's seed_id across ALL days before any write (not per-day) — a stricter reading of Pitfall 6 than the plan's literal per-day framing, chosen because it guarantees zero partial materialization on a missing mapping.
- `materializeBundledProgram` unconditionally activates the newly materialized program (`setActiveProgram(..., 0)`) — matches the plan's literal instruction; Add and Start are the same action at the data-layer level for v1.

## Deviations from Plan

None - plan executed exactly as written. The migration filename (`0004_bent_moondragon.sql`, drizzle-kit's random name) differs from the plan's placeholder (`0004_programs_progression.sql`), but the plan explicitly instructed "Keep whatever filename the generator chooses" — not a deviation.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `db/programs.ts` + the two bundled JSON definitions are ready for Plan 03 (programs manager UI) to build on: `loadActiveProgram`/`loadProgramDetail` for the "Next in program" card and program detail screen, `materializeBundledProgram` + `resolveExerciseSeedIds` for the Add-bundled-program flow.
- Origin marker (`workouts.program_id`/`program_day_position`) and the training-max table are ready for Plan 04's finish-flow progression wiring (evaluate success → `resolveLinearProgression`/`computePercentTmWeight` from Plan 01 → write via a small addition to this plan's data layer, e.g. persisting `target_weight_kg`/`consecutive_fails`/`training_maxes.max_kg` on finish).
- Full test suite (63 files / 504 tests) green under `--no-file-parallelism`; `tsc --noEmit` clean. No blockers for Plan 03.

---
*Phase: 06-programs-progression*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: db/programs.ts
- FOUND: db/programs.crud.test.ts
- FOUND: data/bundledPrograms/linear5x5.json
- FOUND: data/bundledPrograms/percentWave.json
- FOUND: data/bundledPrograms/index.ts
- FOUND: drizzle/0004_bent_moondragon.sql
- FOUND: drizzle/meta/0004_snapshot.json
- FOUND: c19e02c (Task 1 commit)
- FOUND: 42f97e8 (Task 2 RED commit)
- FOUND: 7760834 (Task 2 GREEN commit)
- FOUND: 1fc73b7 (Task 3 commit)
