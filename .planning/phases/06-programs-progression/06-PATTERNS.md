# Phase 6: Programs & Progression - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 11 (new/modified)
**Analogs found:** 11 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `lib/progression.ts` | utility (calculator) | transform | `lib/warmupLadder.ts` + `lib/plateSolver.ts` + `lib/estimate1RM.ts` | exact |
| `lib/progression.test.ts` | test | transform | `lib/estimate1RM.test.ts` / `lib/plateSolver.test.ts` | exact |
| `db/programs.ts` | service (data layer) | CRUD | `db/templates.ts` | exact |
| `db/programs.crud.test.ts` | test | CRUD | `db/templates.crud.test.ts` | exact |
| `db/trainingMaxes.ts` (or folded into `db/programs.ts`) | service (data layer) | CRUD | `db/settings.ts` (keyed single-row table) | role-match |
| `drizzle/0004_*.sql` (+ `drizzle/meta/0004_snapshot.json`, `_journal.json` update) | migration | batch | `drizzle/0003_awesome_fat_cobra.sql` (+ `drizzle-kit generate`) | exact |
| `data/bundledPrograms/linear5x5.json`, `percentWave.json` | config (seed data) | batch | `db/seed/exercises.seed.json` + `db/seed/runSeed.ts` | role-match |
| `components/TemplateBuilderForm.tsx` (MODIFIED) | component | request-response | itself (extend in place) | exact |
| `app/programs/*` (new route group — manager, day list, TM setup) | route/screen | request-response | `app/active-workout/summary.tsx` + templates screens | role-match |
| `app/active-workout/summary.tsx` (MODIFIED) | screen (finish-flow hook) | event-driven | itself (extend `handleDone`/effect) | exact |
| `app/(tabs)/index.tsx` (MODIFIED — "Next in program" card) | screen/component | request-response | existing Workout-home template list rendering | role-match |
| Zustand: none needed (no new store) | — | — | `store/activeWorkout.ts` (reference only — confirms no persist middleware, no program state belongs here) | n/a |

## Pattern Assignments

### `lib/progression.ts` (utility, transform)

**Analogs:** `lib/warmupLadder.ts`, `lib/plateSolver.ts`, `lib/estimate1RM.ts` (all pure, zero-RN-import calculator modules in `lib/`)

**Module header / doc-comment convention** (`lib/warmupLadder.ts` lines 1-13):
```typescript
// Warm-up ladder builder (D-09, UTIL-03).
//
// Pure, zero React Native / Drizzle imports (mirrors lib/exerciseName.ts
// convention). This function does not persist anything and does not query
// the DB itself; workingWeight/barWeight are supplied by the caller, keeping
// this function pure (mirrors lib/prDetection.ts's "caller supplies data"
// framing).
```
Copy this exact framing for `lib/progression.ts`'s header: pure, zero RN/Drizzle imports, caller supplies all inputs (e.g. `barWeightKg`, `unit` passed in — never read from `db/settings.ts` internally, per RESEARCH.md Open Question 2).

**Reuse-don't-reimplement pattern** (`lib/estimate1RM.ts` lines 1-11):
```typescript
// Estimated 1-rep-max via Epley's formula (D-10).
//
// This is the SINGLE shared formula used by both Phase 2 (finish-summary PR
// detection) and Phase 4 (per-exercise stats/trend charts) — do not
// reimplement this math anywhere else.
```
`lib/progression.ts#computeTrainingMaxFromOneRepMax` must `import { estimate1RM } from './estimate1RM'` rather than reimplementing Epley math — mirror this exact "single shared formula" framing in `progression.ts`'s own doc comment for its two new exports (linear resolver, %TM weight computer) so future phases don't reimplement them either.

**Plate-loadable rounding delegation** (`lib/plateSolver.ts` lines 33-63, `lib/warmupLadder.ts` lines 36-42):
```typescript
export function solvePlates(targetWeight: number, barWeight: number, unit: 'kg' | 'lb'): PlateSolveResult { ... }

// consumer pattern (warmupLadder.ts):
export function buildWarmupSets(workingWeight: number, barWeight: number, unit: 'kg' | 'lb'): WarmupStep[] {
  return LADDER.map((step) => {
    const rawTarget = step.percent === 0 ? barWeight : workingWeight * step.percent;
    const { achievableWeight } = solvePlates(rawTarget, barWeight, unit);
    return { label: step.label, weight: achievableWeight, reps: step.reps };
  });
}
```
`computePercentTmWeight(trainingMaxKg, pct, barWeightKg, unit)` should call `solvePlates(trainingMaxKg * pct, barWeightKg, unit).achievableWeight` exactly like `buildWarmupSets` calls it per-step — per RESEARCH.md Open Question 1 / Assumption A2, use `plateSolver.ts` (true per-side loadability), NOT `weightUnits.ts#kgToDisplay` (coarser display rounding) — this repeats an already-solved Phase-3 pitfall if gotten wrong.

**Fixed-scheme table constant pattern** (`lib/warmupLadder.ts` lines 22-27):
```typescript
const LADDER = [
  { label: 'Bar', percent: 0, reps: 8 },
  { label: '40%', percent: 0.4, reps: 5 },
  { label: '60%', percent: 0.6, reps: 3 },
  { label: '80%', percent: 0.8, reps: 2 },
] as const;
```
Mirror this shape for `DEFAULT_WAVE_SCHEME` (4 weeks × 3 sets each, see RESEARCH.md Code Examples) — a `readonly` array-of-arrays-of-`{pct, reps, amrap?}` constant, not a class or enum.

---

### `db/programs.ts` (service/data layer, CRUD)

**Analog:** `db/templates.ts` (372 lines — closest role+flow match; also cross-reference `db/workouts.ts` for `startWorkout`/`finishWorkout` transactional style)

**Module header convention** (`db/templates.ts` lines 1-17):
```typescript
// Parameterized, transaction-safe template data layer (TMPL-01/TMPL-02).
//
// Mirrors db/workouts.ts exactly: driver-agnostic sqlite-core schema imports
// only (works unchanged against the on-device Drizzle driver and the vitest
// in-memory Drizzle driver), assertValid* guards before every write, and
// synchronous db.transaction((tx) => { tx.X().run() }) callbacks (both
// drivers construct BaseSQLiteDatabase with resultKind: 'sync' — an async
// transaction callback would return before its awaited queries ran).
//
// Security (T-03-06/T-03-07/T-03-08): every predicate below is built via
// Drizzle's parameterized query-builder helpers, never a string concatenated
// from user input.
```
Copy this exact header shape into `db/programs.ts`, updated for PROG-01..04 req IDs.

**Imports pattern** (lines 19-33):
```typescript
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  templateExercises,
  templates,
  workouts,
  type NewTemplate,
  type NewTemplateExercise,
  type Template,
  type TemplateExercise,
} from './schema';
import { addWorkoutExercise, startWorkout } from './workouts';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;
```
`db/programs.ts` should import `programs, programDays, programState, trainingMaxes, templateExercises, templates` from `./schema`, plus `createTemplate`/`setTemplateExercises` from `./templates` (for materialization, Pattern 2) and `startWorkoutFromTemplate` (for program-day start, D-04).

**Validation-guard pattern** (lines 56-101, `assertValidTargetWeightKg`/`assertValidTargetReps`/`assertValidTargetSets`):
```typescript
function assertValidTargetWeightKg(weightKg: number | null | undefined): number | null {
  if (weightKg == null) return null;
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new Error('Target weight must be a non-negative number');
  }
  if (weightKg > MAX_WEIGHT_KG) {
    throw new Error(`Target weight must be ${MAX_WEIGHT_KG}kg or less`);
  }
  return weightKg;
}
```
Copy this shape for new guards: `assertValidIncrementKg`, `assertValidTrainingMaxKg`, `assertValidConsecutiveFails`, `assertValidDayPosition` — same finite/non-negative/upper-bound checks (ASVS V5, per RESEARCH.md Security Domain).

**Transactional bulk-write pattern** (lines 215-242, `setTemplateExercises`):
```typescript
db.transaction((tx) => {
  tx.delete(templateExercises).where(eq(templateExercises.templateId, templateId)).run();
  for (const row of validatedRows) {
    tx.insert(templateExercises).values(row).run();
  }
});
```
`materializeBundledProgram` (Pattern 2 in RESEARCH.md) must use this exact synchronous `db.transaction((tx) => { tx.X().run() })` shape — never `async`/`await` inside the callback (both drivers are sync per the header comment) — for: clone templates + template_exercises, insert `programs`/`program_days` rows, insert the initial `program_state` row, all atomically.

**Detach-before-delete pattern** (lines 244-266, `deleteTemplate`):
```typescript
db.transaction((tx) => {
  tx.update(workouts).set({ templateId: null }).where(eq(workouts.templateId, templateId)).run();
  if (teRows.length > 0) {
    tx.delete(templateExercises).where(eq(templateExercises.templateId, templateId)).run();
  }
  tx.delete(templates).where(eq(templates.id, templateId)).run();
});
```
Apply the same "detach references before delete" discipline if/when a program is deleted: null out `program_state` row and any `workouts.program_id` referencing it before deleting `program_days`/`programs`.

**Detail-read pattern** (lines 268-297, `loadTemplateDetail`):
```typescript
export async function loadTemplateDetail(db: AnyDrizzleDb, templateId: number): Promise<TemplateDetail | undefined> {
  const [template] = await db.select().from(templates).where(eq(templates.id, templateId));
  if (!template) return undefined;
  const teRows = await db.select().from(templateExercises).where(eq(templateExercises.templateId, templateId)).orderBy(asc(templateExercises.position));
  return { template, exercises: teRows.map((templateExercise) => ({ templateExercise })) };
}
```
Mirror this exact shape for `loadProgramDetail(db, programId)`: select the `programs` row, `undefined`-guard, then select `program_days` ordered by `asc(programDays.position)`.

**Start-from-template delegation pattern** (lines 355-372, `startWorkoutFromTemplate`):
```typescript
export async function startWorkoutFromTemplate(db: AnyDrizzleDb, templateId: number) {
  const detail = await loadTemplateDetail(db, templateId);
  const workout = await startWorkout(db, { templateId });
  if (detail) {
    for (const [index, { templateExercise }] of detail.exercises.entries()) {
      await addWorkoutExercise(db, workout.id, templateExercise.exerciseId, index);
    }
  }
  return workout;
}
```
`db/programs.ts#startWorkoutFromProgramDay(db, programId, dayPosition)` should call `startWorkoutFromTemplate` internally then set `workouts.program_id`/`workouts.program_day_position` (the new additive columns, Pattern 4 in RESEARCH.md) via a follow-up `update` — OR extend `startWorkoutFromTemplate` itself with optional `programId`/`programDayPosition` params. Also advance `program_state.current_day_position` to `dayPosition` immediately at start time per D-04 ("pointer follows whatever day was started").

---

### `db/programs.crud.test.ts` (test, CRUD)

**Analog:** `db/templates.crud.test.ts` — read this file directly (not excerpted here per stop-early rule) for the exact `describe`/`beforeEach` fixture-DB setup convention (`db/test/fixture.ts`) before writing new tests; follow the same one-`describe`-block-per-exported-function structure.

---

### `drizzle/0004_*.sql` (migration, batch)

**Analog:** `drizzle/0003_awesome_fat_cobra.sql` (additive `CREATE TABLE`) — but since Phase 6 needs additive COLUMNS not a new table, the closer shape is `ALTER TABLE ... ADD COLUMN`:
```sql
-- drizzle/0003_awesome_fat_cobra.sql (existing additive-table example)
CREATE TABLE `metric_definitions` (
	`metric_key` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`unit_type` text NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL
);
```
**Do not hand-write this file.** Add the new columns to `db/schema.ts` first (`workouts.programId` int nullable FK to `programs.id`, `workouts.programDayPosition` int nullable, `templateExercises.consecutiveFails` int not-null default 0), then run `drizzle-kit generate` per `CLAUDE.md`'s stack contract ("New tables require `drizzle-kit generate` to produce a numbered migration that gets bundled" — same applies to new columns). This produces `0004_*.sql` + `drizzle/meta/0004_snapshot.json` + an updated `_journal.json` automatically; `db/test/fixture.ts` already reads `drizzle/meta/_journal.json` to build its migration list (per RESEARCH.md Wave 0 Gaps note), so no fixture code change is needed.

---

### `data/bundledPrograms/linear5x5.json`, `percentWave.json` (config/seed data, batch)

**Analog:** `db/seed/exercises.seed.json` (data shape) + `db/seed/runSeed.ts` (idempotent, no-clobber materialization pattern)

**Idempotent-seed pattern** (`db/seed/runSeed.ts` lines 35-48):
```typescript
for (const exercise of curatedExercises) {
  await db
    .insert(exercises)
    .values({
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      equipment: exercise.equipment,
      notes: exercise.notes,
      seedId: exercise.seedId,
      isCustom: false,
      archived: false,
    })
    .onConflictDoNothing({ target: exercises.seedId });
}
```
**Important distinction:** this `onConflictDoNothing`-keyed-by-`seedId` pattern is for data seeded directly into shared tables (exercises, metric definitions) at app launch. Bundled PROGRAMS must NOT follow this exact pattern (per D-15/Pitfall 4 — never insert bundle rows directly into `programs`/`templates`, never share/mutate). Instead, only reuse the **stable `seed_id` keying convention** (`LIFT_SEED_IDS` in RESEARCH.md Code Examples, resolved against `exercises.seedId`) to look up real `exercises.id` values before `materializeBundledProgram` clones fresh rows via `db/programs.ts` (Pattern 2). The JSON *shape itself* (plain data file imported as a module, `import curatedExercises from './exercises.seed.json'`) is the reusable part — the *materialization* is NOT `onConflictDoNothing`, it is always a fresh insert into user-owned rows.

---

### `components/TemplateBuilderForm.tsx` (component, request-response) — MODIFIED

**Analog:** itself (extend in place) — file is 81+ lines; read the existing exercise-row editing section directly before adding the progression field UI. Add an optional per-exercise "Progression" control (segmented none/linear/%TM) that writes into the `progression` JSON column via the existing `setTemplateExercises`/`addTemplateExercise` calls in `db/templates.ts` (already accepts arbitrary rows — planner must add a `progression` field to `TemplateExerciseInput`/`AddTemplateExerciseInput` in `db/templates.ts` since D-17 authoring writes through the existing template builder, not a new form).

---

### `app/active-workout/summary.tsx` (screen, event-driven) — MODIFIED

**Analog:** itself (extend the existing `useEffect` load block)

**Guard-first pattern to add** (mirrors the existing `if (!detail) { setLoading(false); return; }` early-return at lines 94-97):
```typescript
// existing early-return convention, lines 94-97:
if (!detail) {
  setLoading(false);
  return;
}
```
Per RESEARCH.md Pitfall 7, the new progression-eval block must follow this exact "guard first, before any DB round-trip" convention: `if (workout.programId == null) { /* skip entirely, ad-hoc workout */ }` must be the very first check inside the effect, before any `db/programs.ts` calls — mirroring how this file already short-circuits on missing `detail`.

**Save-as-template async-action convention** (lines 153-186, `handleSaveAsTemplate`) is the template to copy for a new `applyProgressionAndAdvance` handler: `try/catch` wrapping multiple sequential `await db.*` calls, `notify(...)` (Android toast) on success/failure, a `saving`-style boolean guard against double-invocation.

---

### `app/(tabs)/index.tsx` — MODIFIED ("Next in program" card)

**Analog:** existing Workout-home template-list rendering section in the same file (read directly — not excerpted here per non-overlapping-read rule since the "closest analog" is this same file's own list-rendering pattern). Reuse the same card/list-item styling conventions already established there (see `theme.ts` tokens used throughout `summary.tsx` above: `theme.colors.surface`, `theme.radius.md`, `theme.spacing.*`) for visual consistency with existing home-screen cards.

---

## Shared Patterns

### Driver-agnostic data layer + sync transactions
**Source:** `db/templates.ts` lines 1-33, 236-242
**Apply to:** `db/programs.ts`, `db/trainingMaxes.ts`
```typescript
type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;
// ...
db.transaction((tx) => {
  tx.delete(...).run();
  tx.insert(...).run();
});
```
Never use an `async` callback inside `db.transaction(...)` — both the on-device and vitest drivers are constructed with `resultKind: 'sync'`.

### Input validation guards (ASVS V5)
**Source:** `db/templates.ts` lines 56-101
**Apply to:** All new `db/programs.ts` / `db/trainingMaxes.ts` write paths
```typescript
function assertValidX(value: ...): ... {
  if (!Number.isFinite(value) || value < 0) throw new Error('...');
  if (value > MAX) throw new Error('...');
  return value;
}
```

### Pure lib/ calculator module conventions
**Source:** `lib/estimate1RM.ts`, `lib/plateSolver.ts`, `lib/warmupLadder.ts` (all)
**Apply to:** `lib/progression.ts`
- Zero React Native / Drizzle imports.
- Caller supplies all external state (bar weight, unit, current TM) as parameters — never reads `db/settings.ts` or Drizzle directly.
- Delegate to existing shared formulas (`estimate1RM`, `solvePlates`) rather than reimplementing.
- Round to a stable increment after arithmetic to avoid float drift (mirror `plateSolver.ts`'s `Math.round((remaining - plate) * 100) / 100` epsilon-guard convention) — apply the same after every progression write (RESEARCH.md Pitfall 5).

### Android toast + guarded async action in screens
**Source:** `app/active-workout/summary.tsx` lines 34-40, 153-186
**Apply to:** `app/active-workout/summary.tsx` (progression trigger), any new `app/programs/*` screens
```typescript
function notify(message: string): void {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
}
```

### Ephemeral-only Zustand — no program state belongs here
**Source:** `store/activeWorkout.ts` lines 1-19
**Apply to:** Any temptation to add a program-origin or progression field to a Zustand store
```
// Do NOT add `persist` middleware (AsyncStorage/MMKV) here — that would
// create a second, driftable persistence layer competing with SQLite.
```
Confirms RESEARCH.md Pattern 4's recommendation: program origin marker and consecutive-fail counter MUST be additive SQLite columns, never Zustand fields — this file's own header comment is the codebase's explicit rationale for that constraint.

## No Analog Found

None — every file in Phase 6's scope has a strong existing analog in the codebase (this phase is explicitly "reuse-heavy" per RESEARCH.md's own framing: "almost nothing in this phase should be clever").

## Metadata

**Analog search scope:** `db/`, `lib/`, `components/`, `app/`, `store/`, `drizzle/`, `db/seed/`
**Files scanned:** `db/templates.ts`, `db/schema.ts`, `db/workouts.ts` (signatures only), `lib/estimate1RM.ts`, `lib/plateSolver.ts`, `lib/warmupLadder.ts`, `db/seed/runSeed.ts`, `app/active-workout/summary.tsx`, `store/activeWorkout.ts`, `drizzle/0003_awesome_fat_cobra.sql`, `lib/estimate1RM.test.ts`
**Pattern extraction date:** 2026-07-23
