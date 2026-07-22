# Phase 3: Templates, Folders & Calculators - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 21 new/modified files
**Analogs found:** 21 / 21 (all have a strong same-codebase precedent)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `db/templates.ts` | service/data-layer | CRUD | `db/workouts.ts` | exact |
| `db/templates.crud.test.ts` | test (DB-layer) | CRUD | `db/workouts.crud.test.ts` | exact |
| `db/templates.query.test.ts` | test (DB-layer) | CRUD/read | `db/workouts.query.test.ts` | exact |
| `lib/plateSolver.ts` | utility (pure fn) | transform | `lib/weightUnits.ts` | role-match (do NOT reuse its rounding — see Anti-pattern) |
| `lib/plateSolver.test.ts` | test (unit) | transform | `lib/estimate1RM.test.ts` | exact |
| `lib/warmupLadder.ts` | utility (pure fn) | transform | `lib/prDetection.ts` (pure fn, caller supplies data) | role-match |
| `lib/warmupLadder.test.ts` | test (unit) | transform | `lib/estimate1RM.test.ts` | exact |
| `lib/percentOf1RM.ts` | utility (pure fn, table lookup) | transform | `lib/estimate1RM.ts` | exact |
| `lib/percentOf1RM.test.ts` | test (unit) | transform | `lib/estimate1RM.test.ts` | exact |
| `lib/templatePrefill.ts` | utility (pure merge fn) | transform | `lib/prDetection.ts` | exact |
| `lib/templatePrefill.test.ts` | test (unit) | transform | `lib/estimate1RM.test.ts` | exact |
| `lib/templateCapture.ts` | utility (pure aggregation fn) | transform | `lib/volume.ts` (filters warmups, pure aggregation) | exact |
| `lib/templateCapture.test.ts` | test (unit) | transform | `lib/estimate1RM.test.ts` | exact |
| `components/TemplateRow.tsx` | component (list row) | request-response | `components/WorkoutRow.tsx` | exact |
| `components/FolderSectionHeader.tsx` | component (collapsible header) | request-response | none exact — new UI shape; nearest is `components/ExerciseCard.tsx`'s header row styling conventions | role-match |
| `components/PlateCalculatorSheet.tsx` | component (modal/sheet) | request-response | active-workout picker overlay pattern in `app/active-workout/[workoutId].tsx` (pickerOverlay) | role-match |
| `components/OneRMCalculatorSheet.tsx` | component (modal/sheet) | request-response | same picker-overlay pattern | role-match |
| `components/WarmupSuggestionSheet.tsx` | component (modal/sheet + one-tap insert) | event-driven (accept → write) | same picker-overlay pattern + `insertSet` write path | role-match |
| `app/templates/new.tsx` + `app/templates/[templateId].tsx` (builder) | route (controller) | CRUD/request-response | `app/(tabs)/exercises/new.tsx` + `app/(tabs)/exercises/[id].tsx` | exact |
| `app/(tabs)/index.tsx` (MODIFY — add folder-grouped template list) | route (controller) | request-response | itself (existing file, extend) | exact |
| `app/active-workout/[workoutId].tsx` + `components/ExerciseCard.tsx`/`SetRow.tsx` (MODIFY) | route/component (controller) | event-driven | itself (existing file, extend) | exact |
| `app/active-workout/summary.tsx` (MODIFY — add "Save as template") | route (controller) | request-response | itself (existing file, extend) | exact |
| `app/tools/plate-calculator.tsx`, `app/tools/one-rm-calculator.tsx` (standalone) | route (controller) | request-response | `app/(tabs)/exercises/new.tsx` (simple standalone screen with appbar) | role-match |

## Pattern Assignments

### `db/templates.ts` (service/data-layer, CRUD)

**Analog:** `db/workouts.ts` (`C:\Users\omkar\Projects\Workout Tracker\db\workouts.ts`)

**Imports + module header pattern** (lines 1-36):
```typescript
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  exercises, sets, workoutExercises, workouts,
  type NewSet, type Set, type Workout, type WorkoutExercise,
} from './schema';
import { estimate1RM } from '../lib/estimate1RM';
import { workingSetVolume } from '../lib/volume';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

const MAX_NAME_LENGTH = 200;
const MAX_WEIGHT_KG = 1000;
const MAX_REPS = 1000;
```
For `db/templates.ts`, import `templates`, `templateExercises`, `workouts` from `./schema` (need `workouts` too, for the delete-detach step), plus `TemplateExercise`/`Template`/`NewTemplate`/`NewTemplateExercise` types. Reuse the exact same `AnyDrizzleDb` type alias and the same `MAX_NAME_LENGTH`/`MAX_WEIGHT_KG`/`MAX_REPS` constants (or re-declare locally — this module must stay import-independent from `workouts.ts` except for shared validators if factored out; simplest is to copy the `assertValidName`/`assertValidWeightKg`(nullable variant for `target_weight_kg`)/`assertValidReps` guards verbatim, lines 40-80).

**Validation guard pattern to mirror exactly** (lines 40-80): `assertValidName`, `assertValidWeightKg`, `assertValidReps`. For `target_weight_kg` (nullable per D-02), wrap: return `null` early when input is `null`, otherwise delegate to the same non-negative/cap logic.

**Transaction-safe, detach-before-delete pattern** (this is the RESEARCH.md Pattern 1 example, directly applicable — mirrors `removeWorkoutExercise`/`discardWorkout` lines 373-403 which delete children before parents in a synchronous `db.transaction((tx) => { ...tx.X().run() })` callback):
```typescript
// mirrors discardWorkout's child-before-parent transaction shape (db/workouts.ts:389-403)
export async function deleteTemplate(db: AnyDrizzleDb, templateId: number): Promise<void> {
  const teRows = await db.select({ id: templateExercises.id }).from(templateExercises)
    .where(eq(templateExercises.templateId, templateId));

  db.transaction((tx) => {
    // Pitfall 3: null out referencing workouts BEFORE deleting the template row.
    tx.update(workouts).set({ templateId: null }).where(eq(workouts.templateId, templateId)).run();
    if (teRows.length > 0) {
      tx.delete(templateExercises).where(eq(templateExercises.templateId, templateId)).run();
    }
    tx.delete(templates).where(eq(templates.id, templateId)).run();
  });
}
```
Critical: the transaction callback is a **plain synchronous function using `.run()`**, never `async` — see `db/workouts.ts` lines 298-303 doc comment on `reorderWorkoutExercises` explaining why (`resultKind: 'sync'` on both drivers).

**Simple CRUD (create/update) pattern** — mirror `startWorkout` (lines 116-130) and `setExerciseRestOverride` (lines 89-104): validate inputs first, then a single parameterized `.insert()...returning()` or `.update()...where()`.

**Read/query pattern mirroring `loadWorkoutDetail`** (lines 265-288, loop-per-child-table) for `loadTemplateDetail` (template + ordered template_exercises).

**Folder-grouping aggregation-in-query-layer pattern** — mirror `loadWorkoutHistory`'s "aggregate in the query layer, screen renders only" convention (lines 433-460); RESEARCH.md already supplies a full concrete implementation for `loadTemplatesGroupedByFolder` (Pattern 5) — copy it verbatim, adjusting only the Uncategorized-last / case-insensitive-sort assumptions per Assumptions Log A3/A4 if the planner wants to lock a different order.

**`loadFolderNames`** (for tap-suggestions, D-04) — new, simple: `SELECT DISTINCT folder FROM templates WHERE folder IS NOT NULL ORDER BY folder COLLATE NOCASE` via Drizzle (`db.selectDistinct(...)`), same parameterized-query-builder-only convention (no raw SQL).

---

### `lib/plateSolver.ts` (utility, pure fn, transform)

**Analog:** `lib/weightUnits.ts` (`C:\Users\omkar\Projects\Workout Tracker\lib\weightUnits.ts`) — **for module-header conventions and doc-comment style only.** Do NOT call its `kgToDisplay`/`displayToKg` from inside the solver (Anti-Pattern — see Pitfall 2 in RESEARCH.md: display rounding, 0.5kg/1lb, is coarser/finer than actual plate granularity).

**Module header convention to copy** (lines 1-9 of `weightUnits.ts`):
```typescript
// <one-line purpose>.
//
// Pure, zero React Native / Drizzle imports (mirrors lib/exerciseName.ts convention).
```

**Core algorithm:** RESEARCH.md's Pattern 3 (`03-RESEARCH.md` lines 350-405) is a complete, ready-to-use implementation — the greedy per-side plate solver with fp-drift guards (`Math.round(x*100)/100`, `plate - 1e-9` epsilon). Copy it directly into `lib/plateSolver.ts`; it already follows this codebase's pure-fn convention.

**Test structure to mirror:** `lib/estimate1RM.test.ts` (`C:\Users\omkar\Projects\Workout Tracker\lib\estimate1RM.test.ts`) — `describe`/`it` blocks, `toBeCloseTo` for float comparisons, one `it` per edge case (exact match, below-bar, fp-drift case per Pitfall 5).

---

### `lib/percentOf1RM.ts` / `lib/warmupLadder.ts` / `lib/templatePrefill.ts` / `lib/templateCapture.ts` (utility, pure fns)

**Analog:** `lib/estimate1RM.ts` (module header + single-formula convention) and `lib/prDetection.ts` (module header explicitly stating "caller supplies the DB reads, this stays pure" — copy this framing verbatim into `templatePrefill.ts`/`templateCapture.ts`'s doc comments):
```typescript
// <purpose>. Zero React Native / Drizzle imports (mirrors lib/exerciseName.ts convention).
// This function does not persist anything and does not query the DB itself;
// [inputs] are supplied by the caller (DB layer), keeping this function pure.
```

**Warmup-exclusion filter idiom to reuse** (Pitfall 4 — from `lib/volume.ts` lines 17-21 and `lib/prDetection.ts` line 39):
```typescript
const workingSets = currentSets.filter((s) => s.type !== 'warmup');
```
Both `templatePrefill.ts` (filtering `loadLastPerformance` results before merge) and `templateCapture.ts` (filtering a workout's sets before counting/typical-reps) MUST apply this exact filter first.

RESEARCH.md's Pattern 2 (`buildTemplatePrefillRows`, lines 308-347) and Pattern 4 (`buildWarmupSets`, lines 407-437) are complete, ready-to-adapt implementations already following this codebase's `interface`-per-shape + single-exported-function convention (compare to `lib/prDetection.ts`'s `CurrentSet`/`PriorBest`/`PRHit` interfaces, lines 12-30).

**Test structure:** `lib/estimate1RM.test.ts` — same `describe('fnName', () => { it(...) })` shape, one test per Assumptions-Log-flagged edge case (A1 ladder values, A2 typical-reps rule).

---

### `db/templates.crud.test.ts` / `db/templates.query.test.ts` (DB-layer tests)

**Analog:** `db/workouts.crud.test.ts` (`C:\Users\omkar\Projects\Workout Tracker\db\workouts.crud.test.ts`)

**Imports + fixture pattern** (lines 1-16, 31-37):
```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import * as schema from './schema';
import { templates, templateExercises, workouts } from './schema';
import { createTemplate, deleteTemplate, /* ... */ } from './templates';

describe('createTemplate', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  beforeEach(() => { ({ db } = createTestDb()); });
  it('...', async () => { /* ... */ });
});
```
`db/test/fixture.ts` (`C:\Users\omkar\Projects\Workout Tracker\db\test\fixture.ts`) needs **zero changes** — `createTestDb()` already applies every generated migration including the `templates`/`template_exercises` tables (Phase-1 schema), so both new test files just import it as-is.

**Dangling-FK regression test** (Pitfall 3) is the one crucial case `db/templates.crud.test.ts` must add that `workouts.crud.test.ts` has no direct analog for — assert that after `deleteTemplate`, a workout that referenced it now has `templateId === null` (query `workouts` directly via Drizzle, same `eq()` pattern as line 219 of `workouts.ts`).

---

### `app/templates/new.tsx` + `app/templates/[templateId].tsx` (template builder route, controller, CRUD)

**Analog:** `app/(tabs)/exercises/new.tsx` + `app/(tabs)/exercises/[id].tsx` (`C:\Users\omkar\Projects\Workout Tracker\app\(tabs)\exercises\new.tsx` / `[id].tsx`)

**Imports pattern** (new.tsx lines 9-28):
```typescript
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { FilterChipRow } from '../../../components/FilterChipRow';
import { db } from '../../../db/client';
import { createExercise } from '../../../db/exercises';
import { theme } from '../../../theme';
```
For the template builder: swap `createExercise`/`findDuplicatesByName` for `createTemplate`/`addTemplateExercise`/`loadFolderNames` (folder tap-suggestions reuse `FilterChipRow`-style tap suggestions exactly like the duplicate-name warning in `new.tsx` lines 103-118, but as a simple chip list of existing folder names). Reuse `ExerciseRow`/`FilterChipRow`/`MuscleGroupPills` from `app/active-workout/[workoutId].tsx`'s exercise picker overlay (lines 897-943) verbatim for the "add exercise to template" step.

**Edit-screen load/save/notify pattern** ([id].tsx lines 36-97): `useLocalSearchParams` → `loadX` on mount → controlled form fields → `handleSave` calling `updateX` → Android-only `notify()` helper (copy verbatim, [id].tsx lines 33-40):
```typescript
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}
```
Sentinel-based create-vs-edit is expo-router's own precedent here: `new.tsx` is a distinct route file (not a `[templateId]==='new'` branch inside the dynamic route) — RESEARCH.md's Open Question 2 recommends mirroring this exact two-file split, and it is now confirmed as the codebase's only precedent (there is no combined-sentinel route anywhere in `app/`).

**Appbar + back-button pattern** (both files, lines ~84-91 / 153-164): copy the `KeyboardAvoidingView` + `appbar` `View` + `‹ Back` `Pressable` + title `Text` structure and its exact `styles.appbar`/`styles.backButton`/`styles.backText` StyleSheet block (all theme-token driven, no hardcoded colors — [id].tsx lines 257-273).

---

### `components/TemplateRow.tsx` (component, list row)

**Analog:** `components/WorkoutRow.tsx` (`C:\Users\omkar\Projects\Workout Tracker\components\WorkoutRow.tsx`) — copy its whole anatomy: props interface (`label`, summary fields, `onPress`), leading glyph + text column + trailing chevron `Pressable`, and the exact `styles.row`/`styles.icon`/`styles.textColumn`/`styles.chevron` StyleSheet block (lines 62-94) which already satisfies the 44×44 touch-target convention via `paddingVertical: theme.spacing.lg`.

### `components/FolderSectionHeader.tsx` (collapsible header, new UI shape)

No exact analog exists (first collapsible-section-header component in the codebase). Nearest structural precedent: `ExerciseCard.tsx`'s header row (lines 110-143) — a `Pressable` row with a leading glyph/chevron-style disclosure indicator and theme-token styling only. Build a small `Pressable` row: folder name (left) + count badge + a rotating `›`/`⌄` chevron `Text`, toggling an `expanded` boolean passed down from the parent list. Style exclusively via `theme.colors.surfaceAlt`/`theme.spacing`/`theme.radius` (no new tokens).

### `components/PlateCalculatorSheet.tsx` / `OneRMCalculatorSheet.tsx` / `WarmupSuggestionSheet.tsx` (modal/sheet components)

**Analog:** the picker-overlay pattern already used twice in this codebase — `app/(tabs)/index.tsx`'s history picker (lines 252-281, `styles.pickerOverlay`/`pickerHeader`/`pickerCancelButton`) and `app/active-workout/[workoutId].tsx`'s add/replace-exercise picker (lines 897-943, identical `pickerOverlay` shape). Copy the `position: 'absolute', top/left/right/bottom: 0` full-screen overlay `View` + header row with a `‹ Cancel` `Pressable` + title, for each sheet. `WarmupSuggestionSheet` additionally needs the accept-one-tap-insert wiring: each suggested row gets its own `Pressable` calling `insertSet(db, {..., type: 'warmup'})` (exact call already used in `handleLogSet`, `app/active-workout/[workoutId].tsx` lines 463-469), then closes/updates like `handleAddExercise` does after a picker selection (lines 554-570).

---

### `app/(tabs)/index.tsx` (MODIFY — add folder-grouped template list)

**Analog:** itself. The existing "Start empty" / "Start from history" block (lines 216-250) is the direct pattern to extend: add a new section below `startGroup` that calls `loadTemplatesGroupedByFolder(db)` (parallel to the existing `loadWorkoutHistory(db)` call at line 143) inside the same `useFocusEffect`/`useEffect` reload pattern (lines 99-152), and renders `FolderSectionHeader` + `TemplateRow` per group. Tapping a template mirrors `handlePickHistoryWorkout` (lines 186-206) almost exactly, except it calls `startWorkout(db, { templateId })` (already accepting this param per `db/workouts.ts` lines 106-130) and then loops `template_exercises` (ordered by position) through `addWorkoutExercise`, rather than looping a picked workout's `workoutExercise` list.

### `app/active-workout/[workoutId].tsx` + `components/ExerciseCard.tsx` / `SetRow.tsx` (MODIFY — inline calculators + warm-up auto-insert)

**Analog:** itself, plus the add-exercise picker pattern already inside the file. New affordances (plate/1RM/warm-up icons) are added to `ExerciseCard`'s header row (lines 110-143 of `ExerciseCard.tsx`, alongside the existing `restPill` `Pressable` — same `minHeight: 44` touch-target convention, lines 227-233 styles). Each icon's `onPress` opens its sheet exactly like `restStepperOpen` toggles the rest stepper (lines 78, 128, 145-165) — a local `useState` boolean lifted to a sheet-open state per card, or lifted to the parent screen (preferred, since sheets need `db`/`insertSet` access which the screen already owns per `handleLogSet`, lines 442-488). Warm-up auto-insert reuses `handleAddSet` (lines 490-503) as the template for inserting a new unsaved `Row`, then `handleLogSet`'s `insertSet(...)` call (lines 462-469) with `type: 'warmup'` for the actual persist-on-accept.

### `app/active-workout/summary.tsx` (MODIFY — add "Save as template")

**Analog:** itself. The existing `loadWorkoutDetail` + `loadPriorBests` + `detectPRs` load sequence (lines 59-100) is the model for a new "Save as template" handler: call `loadWorkoutDetail(db, workoutId)` (already loaded on this screen — reuse the in-scope `detail`/`workout` state, no extra query needed), pass its `exercises` array through `lib/templateCapture.ts#buildTemplateExercisesFromWorkout` (pure, filters warmups per Pitfall 4), then `createTemplate` + loop `addTemplateExercise` (`db/templates.ts`), followed by the same Android-only `notify()` pattern used elsewhere (`app/(tabs)/exercises/[id].tsx` lines 36-40) for a "Saved as template" confirmation.

---

## Shared Patterns

### Parameterized Drizzle queries only (never string-built SQL)
**Source:** `db/workouts.ts` (every exported function)
**Apply to:** `db/templates.ts` — every insert/update/select must use Drizzle's query-builder helpers (`eq`, `and`, `asc`, `desc`, `isNull`, `isNotNull`) exactly as imported at the top of `workouts.ts` (line 13). No raw string concatenation, ever (ASVS V5/SQL-injection mitigation already enforced project-wide).

### Synchronous transaction callbacks for multi-table writes
**Source:** `db/workouts.ts` lines 296-305 (doc comment) and 373-403 (`removeWorkoutExercise`/`discardWorkout`)
**Apply to:** `db/templates.ts#deleteTemplate` (detach `workouts.template_id` → delete `template_exercises` → delete `templates`, all inside one `db.transaction((tx) => { tx.X().run() })`, never `async`).

### Input validation guards before any numeric/text write
**Source:** `db/workouts.ts` lines 40-80 (`assertValidName`, `assertValidWeightKg`, `assertValidReps`)
**Apply to:** every `db/templates.ts` write — template `name`/`folder` (trim + `MAX_NAME_LENGTH` cap), `target_sets`/`target_reps` (non-negative integer + upper bound), `target_weight_kg` (non-negative + cap, nullable).

### Android-only transient feedback (`notify` helper)
**Source:** `app/(tabs)/exercises/[id].tsx` lines 33-40
```typescript
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}
```
**Apply to:** template save/delete confirmations, "Save as template" success, plate/1RM calculator errors — copy this exact function into each new screen file that needs it (it is currently duplicated per-file in this codebase, not centralized — follow that existing convention, do not create a new shared `lib/notify.ts` unless the planner explicitly decides to refactor).

### `useFocusEffect` cancelled-guard reload
**Source:** `app/(tabs)/index.tsx` lines 99-136, `app/(tabs)/settings.tsx` lines 28-48
**Apply to:** the Workout tab's new template-list load, and the template builder's edit-mode load — always guard with a `cancelled` flag returned from the effect cleanup.

### Pure `lib/` functions: zero RN/Drizzle imports, caller supplies all I/O
**Source:** `lib/prDetection.ts` line 8 doc comment ("does not persist anything and does not query the DB itself; ... supplied by the caller"), `lib/estimate1RM.ts`, `lib/volume.ts`, `lib/weightUnits.ts`
**Apply to:** all five new `lib/*.ts` modules this phase (`plateSolver.ts`, `warmupLadder.ts`, `percentOf1RM.ts`, `templatePrefill.ts`, `templateCapture.ts`).

### Dark-first theme tokens only, 44×44 touch targets
**Source:** every component read this session (`ExerciseCard.tsx`, `WorkoutRow.tsx`, `SetRow.tsx` via `ExerciseCard.tsx`'s row usage) — `theme.colors`/`theme.spacing`/`theme.radius`/`theme.typography` exclusively, `minHeight: 44`/`minWidth: 44` on every pressable icon/button (e.g. `ExerciseCard.tsx` lines 207-212, 238-243).
**Apply to:** `TemplateRow`, `FolderSectionHeader`, `PlateCalculatorSheet`, `OneRMCalculatorSheet`, `WarmupSuggestionSheet`, template builder screens, tools screens.

### Bar-weight setting via `settings` key/value table
**Source:** `db/settings.ts` (`getSetting`/`setSetting`, exact upsert via `onConflictDoUpdate`) and its usage in `app/(tabs)/settings.tsx` lines 50-62
**Apply to:** new `bar_weight_kg`/`bar_weight_lb` settings rows (Pitfall 1 — store as two independent keys, never convert between them) — read/write via the existing `getSetting`/`setSetting` functions, no new settings module needed.

## No Analog Found

None — every file has at least a role-match analog in the existing codebase (see table above). The two weakest matches (`FolderSectionHeader.tsx`, the calculator sheets) have no *exact* precedent since this is the first collapsible-section-header and first standalone-sheet component in the app, but both compose directly from existing, already-vetted sub-patterns (Pressable disclosure row; full-screen picker-overlay), so no external/library research is needed.

## Metadata

**Analog search scope:** `db/`, `lib/`, `components/`, `app/(tabs)/`, `app/active-workout/` (full read of every file cited above)
**Files scanned:** `db/workouts.ts`, `db/schema.ts`, `db/settings.ts`, `db/test/fixture.ts`, `db/workouts.crud.test.ts`, `lib/weightUnits.ts`, `lib/estimate1RM.ts`, `lib/estimate1RM.test.ts`, `lib/prDetection.ts`, `lib/volume.ts`, `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx`, `app/(tabs)/exercises/new.tsx`, `app/(tabs)/exercises/[id].tsx`, `app/active-workout/[workoutId].tsx`, `app/active-workout/summary.tsx`, `components/ExerciseCard.tsx`, `components/WorkoutRow.tsx`
**Pattern extraction date:** 2026-07-22
