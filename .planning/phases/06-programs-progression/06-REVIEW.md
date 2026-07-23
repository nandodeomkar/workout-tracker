---
phase: 06-programs-progression
reviewed: 2026-07-24T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - lib/progression.ts
  - lib/progression.test.ts
  - db/programs.ts
  - db/programs.crud.test.ts
  - db/schema.ts
  - db/templates.ts
  - drizzle/0004_bent_moondragon.sql
  - drizzle/meta/0004_snapshot.json
  - drizzle/meta/_journal.json
  - drizzle/migrations.js
  - data/bundledPrograms/index.ts
  - data/bundledPrograms/linear5x5.json
  - data/bundledPrograms/percentWave.json
  - app/_layout.tsx
  - app/(tabs)/index.tsx
  - app/(tabs)/settings.tsx
  - app/active-workout/summary.tsx
  - app/programs/_layout.tsx
  - app/programs/index.tsx
  - app/programs/[programId].tsx
  - app/programs/training-maxes.tsx
  - components/TemplateBuilderForm.tsx
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-24
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the Programs & Progression phase: the pure progression math (`lib/progression.ts`), the transactional data layer (`db/programs.ts`), migration 0004, bundled program JSON, and the programs/summary UI.

The isolated, pure-function progression math in `lib/progression.ts` is correct and well-tested, and the transaction discipline / parameterized-query / parse-and-skip guards in `db/programs.ts` are solid. Migration 0004 is genuinely additive-safe (the `programs`/`program_days`/`program_state`/`training_maxes` tables are created in migration 0000; 0004 only adds one `NOT NULL DEFAULT 0` column plus two nullable columns).

However, there is one **BLOCKER**: the linear-progression orchestration anchors the next prescribed weight on `template_exercises.target_weight_kg`, and **every** code path that creates a program (bundled materialization *and* the custom template builder) hard-codes that column to `null`. On the first finish the "current weight" is therefore read as `0`, and the flagship "Linear 5x5" program prescribes `2.5 kg` next — completely divorced from what the user actually lifted. This case is never covered by tests (all fixtures pre-seed `target_weight_kg = 100`), which is why it passed CI.

Two WARNINGs cover a missing idempotency guard on the finish-time write path and a template-deletion integrity gap that desyncs the program pointer.

## Critical Issues

### CR-01: Linear progression computes next weight from 0 — never from the weight actually lifted

**File:** `db/programs.ts:880-882` (with `db/programs.ts:451`, `components/TemplateBuilderForm.tsx:446`)

**Issue:**
`applyProgressionAndAdvance` derives the working weight for the linear resolver from the template row:

```ts
const currentWeightKg = templateExercise.targetWeightKg ?? 0;
const success = evaluateLinearSuccess(setsForEval, currentWeightKg);
const result = resolveLinearProgression(currentWeightKg, linearRule, success, templateExercise.consecutiveFails);
```

`result.nextWeightKg` is then written back as the new `target_weight_kg`. This only works if `target_weight_kg` was seeded with a real starting weight. It never is:

- `materializeBundledProgram` writes every bundled row with `targetWeightKg: null` (`db/programs.ts:451`), and `data/bundledPrograms/linear5x5.json` carries no weight.
- The custom builder writes `targetWeightKg: null` for every row (`components/TemplateBuilderForm.tsx:446`) and exposes **no UI at all** to set a target weight.

So on the first finish, `currentWeightKg = null ?? 0 = 0`. `evaluateLinearSuccess` compares each logged set to `0` (`weightKg >= 0` is always true), so success rides on reps alone; `resolveLinearProgression(0, {incrementKg: 2.5}, true, 0)` returns `nextWeightKg = 2.5`. The template now says the next squat target is **2.5 kg**, regardless of the 100 kg actually performed, and it crawls up by the increment (2.5 → 5 → 7.5…) forever, never tracking reality. A deload (`currentWeightKg * (1 - deloadPct)`) would deload from ~0. This breaks the core auto-progression promise for both bundled and custom linear programs. The bug is masked because every test fixture (`db/programs.crud.test.ts:369`, `:380`) pre-sets `targetWeightKg: initialWeightKg`.

**Fix:** Anchor the linear "current weight" on the weight the user actually logged this session (falling back to the template target only when there are no working sets), and/or seed `target_weight_kg` at start time. For example, derive the anchor from the just-finished working sets:

```ts
const workingSets = setsForEval.filter((s) => s.type !== 'warmup');
const loggedWeightKg = workingSets.length > 0
  ? Math.min(...workingSets.map((s) => s.weightKg))
  : (templateExercise.targetWeightKg ?? 0);
const success = evaluateLinearSuccess(setsForEval, templateExercise.targetWeightKg ?? loggedWeightKg);
const result = resolveLinearProgression(loggedWeightKg, linearRule, success, templateExercise.consecutiveFails);
```

Add a regression test that starts a bundled/custom linear program with `target_weight_kg = null`, logs 100 kg × 5, finishes, and asserts the stored next target is `102.5`, not `2.5`.

## Warnings

### WR-01: `applyProgressionAndAdvance` is not idempotent — a summary remount double-advances the pointer and re-bumps training maxes

**File:** `db/programs.ts:816-981` (caller: `app/active-workout/summary.tsx:147-148`)

**Issue:** The finish-time write path keys entirely off `workout.programId != null`, which stays set after progression runs. Nothing records that a given workout has already been progressed. The only thing preventing a second application is that the summary screen's load effect happens to run once per mount:

```ts
if (detail.workout.programId != null) {
  progressResult = await applyProgressionAndAdvance(db, workoutId);
```

The effect's `cancelled` flag guards `setState`, not the in-flight DB write. If the summary component remounts for the same `workoutId` (React StrictMode double-invoke in dev, fast-refresh, or any re-navigation to `/active-workout/summary?workoutId=X`), `applyProgressionAndAdvance` runs again: it advances the pointer a second time and, on a cycle-wrapping finish, bumps every `%TM` training max again (e.g. squat 100 → 105 → 110). For an app whose core value is "never lose/corrupt data," a mutation this consequential should be structurally idempotent, not reliant on mount timing. The code comment at `summary.tsx:140-141` asserts "runs exactly once … never re-invoked" but nothing enforces it.

**Fix:** Make the operation idempotent. Cheapest option: guard on a marker so a re-run is a no-op — e.g. after applying, clear the origin marker (`workouts.program_id`/`program_day_position`) inside the same transaction, or add a `progression_applied_at` column and early-return `EMPTY_PROGRESS_RESULT` when it is already set. A stored flag is preferable to clearing `program_id` since history/reporting may want the origin.

### WR-02: Deleting a template leaves dangling `program_days`, silently desyncing the program pointer and cycle-wrap math

**File:** `db/templates.ts:263-278` (consumed by `db/programs.ts:241-246` and `:916`)

**Issue:** `deleteTemplate` detaches `workouts.template_id` but never touches `program_days`, even though `program_days.template_id` references `templates.id`. SQLite here does not enforce FKs at write time (per the module's own Pitfall-3 note), so deleting a template that a program uses as a day leaves a dangling `program_days` row. Downstream:

- `loadProgramDetail` (`db/programs.ts:241-246`) silently skips any day whose template fails to load, so `detail.days` shrinks and its positions become non-contiguous.
- `applyProgressionAndAdvance` computes the wrap boundary from that filtered length: `nextDayPosition(dayPosition, detail.days.length)` (`db/programs.ts:916`). A dropped day therefore shifts the modulo boundary, mistiming the cycle-wrap (and thus the `%TM` training-max bump), or `day = detail.days.find(d => d.day.position === dayPosition)` returns `undefined` and the finish silently no-ops (`db/programs.ts:830-833`), stranding the active pointer.

This mirrors exactly the "dangling reference on delete" class of bug that `deleteTemplate`/`deleteProgram` were written to prevent for workouts, but the program_days edge was missed.

**Fix:** In `deleteTemplate`, refuse to delete (or detach) a template still referenced by `program_days` inside the same transaction — e.g. throw a clear "template is used by a program" error, or null/remove the referencing `program_days` rows. Separately, base the wrap math on the true `program_days` count rather than the post-filter `detail.days.length` so a transiently unloadable day cannot move the wrap boundary.

## Info

### IN-01: Stale comment claims `%TM` never bumps training maxes

**File:** `app/active-workout/summary.tsx:177-178`

**Issue:** The comment reads "percent_tm — informational only (Plan 05 adds the TM-bump-on-wrap extension; this task never bumps training_maxes)." The TM-bump-on-wrap is now fully implemented in this same file (`cycleCompleteRows`, lines 195-203) and in `db/programs.ts:922-951`. The comment is misleading to the next reader.

**Fix:** Update the comment to reflect that the cycle-wrap TM bump is implemented and surfaced via the cycle-complete banner.

### IN-02: `load()` in program detail writes state without honoring the effect's `cancelled` flag

**File:** `app/programs/[programId].tsx:97-131`

**Issue:** The `useFocusEffect` wrapper creates a `cancelled` flag and checks it in the `.then()` callback, but `load()` itself calls `setDetail`/`setActiveProgramState`/`setTrainingMaxes`/`setLoading` unconditionally (lines 104-115). If the screen loses focus mid-load, these fire after teardown, producing a potential "set state on unmounted component" warning and a wasted render. The `.then(() => { if (cancelled) return; })` guard is effectively a no-op because it guards nothing.

**Fix:** Pass the `cancelled` flag (or an `AbortController`/mounted ref) into `load()` and gate every `setState` behind it, matching the cancelled-guard pattern used correctly in `app/(tabs)/index.tsx`.

---

_Reviewed: 2026-07-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
