# Phase 2: Core Logging (Active Workout) - Pattern Map

**Mapped:** 2026-07-21
**Files analyzed:** 24 (new/modified) from CONTEXT.md/RESEARCH.md/UI-SPEC.md Wave 0 + integration points
**Analogs found:** 22 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `db/schema.ts` (modify: add `exercises.restSeconds`) | model | CRUD (additive migration) | `db/schema.ts` itself (existing `archived`/`seedId` additive columns) | exact |
| `drizzle/000X_*.sql` (generated) | migration | batch | `drizzle/0001_*.sql` / `drizzle/0002_*.sql` (generated, not hand-written) | exact |
| `db/migrations.test.ts` (extend) | test | batch | `db/migrations.test.ts` (existing FNDN-02 upgrade harness) | exact |
| `db/workouts.ts` | data layer (service) | CRUD | `db/exercises.ts` | exact |
| `db/workouts.query.test.ts` | test | CRUD | `db/exercises.query.test.ts` | exact |
| `db/workouts.crud.test.ts` | test | CRUD | `db/exercises.crud.test.ts` | exact |
| `db/settings.ts` | data layer (service) | CRUD (key-value) | `db/exercises.ts` (query/mutation conventions), schema's bare `settings` table | role-match |
| `lib/estimate1RM.ts` + `.test.ts` | pure lib | transform | `lib/exerciseName.ts` + `.test.ts` | exact |
| `lib/weightUnits.ts` + `.test.ts` | pure lib | transform | `lib/exerciseName.ts` + `.test.ts` | exact |
| `lib/volume.ts` + `.test.ts` | pure lib | transform | `lib/exerciseName.ts` + `.test.ts` | exact |
| `lib/prDetection.ts` + `.test.ts` | pure lib | transform | `lib/exerciseName.ts` + `.test.ts` | exact |
| `lib/restTimer.ts` + `.test.ts` | pure lib (thin wrapper, mocked I/O) | event-driven | `lib/exerciseFilter.ts` (pure-lib shape); no existing notification-wrapper analog | partial (no analog for the I/O-wrapper half) |
| `store/activeWorkout.ts` | Zustand store | event-driven / session-state | none in codebase (first store this phase) | no analog — new pattern per RESEARCH.md |
| `app/active-workout/_layout.tsx` | route (Stack layout) | request-response (navigation) | `app/(tabs)/exercises/_layout.tsx` | exact |
| `app/active-workout/[workoutId].tsx` | route screen | CRUD + event-driven | `app/(tabs)/exercises/[id].tsx` | role-match (form/detail shape reused; this screen is much more stateful) |
| `app/(tabs)/index.tsx` (rewrite) | route screen | request-response | `app/(tabs)/exercises/index.tsx` (list/empty-state chrome) + itself (current stub) | role-match |
| `app/(tabs)/history/_layout.tsx` | route (Stack layout) | request-response (navigation) | `app/(tabs)/exercises/_layout.tsx` | exact |
| `app/(tabs)/history/index.tsx` | route screen | CRUD (read, list) | `app/(tabs)/exercises/index.tsx` | exact |
| `app/(tabs)/history/[workoutId].tsx` | route screen | CRUD (read) | `app/(tabs)/exercises/[id].tsx` (read-only variant) | role-match |
| `app/(tabs)/settings.tsx` (extend) | route screen | CRUD | `app/(tabs)/exercises/[id].tsx` (form input + save pattern), current stub `settings.tsx` | role-match |
| `components/SetRow.tsx` | component | request-response (local UI state) | `components/ExerciseRow.tsx` (row anatomy/theme usage) | role-match |
| `components/ExerciseCard.tsx` | component | request-response + event-driven (drag) | `components/ExerciseRow.tsx` (theme/card conventions); no drag analog exists | partial |
| `components/NumericKeypad.tsx` | component | request-response (local UI state) | `components/FilterChipRow.tsx` (Pressable-grid theming conventions) | partial |
| `components/RestTimerBar.tsx` | component | event-driven (timer) | `components/MuscleGroupPills.tsx` (Pressable row + theme conventions); no timer analog exists | partial |
| `components/WorkoutRow.tsx` | component | request-response | `components/ExerciseRow.tsx` | exact |
| `components/MonthCalendar.tsx` | component | transform (date bucketing) + request-response | `components/MuscleGroupPills.tsx` (theme/grid conventions); no calendar analog exists | partial |

## Pattern Assignments

### `db/workouts.ts` (data layer, CRUD)

**Analog:** `db/exercises.ts` (190 lines, read in full)

**Imports pattern** (lines 13-19):
```typescript
import { asc, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { exercises, type Exercise } from './schema';
import type { EquipmentType, MuscleGroup } from '../constants/taxonomy';
import { normalizeExerciseName } from '../lib/exerciseName';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;
```
For `db/workouts.ts`: same `AnyDrizzleDb` type alias (copy verbatim — it's what makes the module driver-agnostic, usable by both `drizzle-orm/expo-sqlite` on-device and `drizzle-orm/better-sqlite3` in tests), plus `desc`, `isNull`, `and` from `drizzle-orm` for the resume/pre-fill/history queries (RESEARCH.md Patterns 1-2), and import `workouts`, `workoutExercises`, `sets`, type `Workout`/`WorkoutExercise`/`Set` from `./schema`.

**Input-bound validation pattern** (lines 22-45):
```typescript
const MAX_NAME_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;

function assertValidName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) { throw new Error('Exercise name is required'); }
  if (trimmed.length > MAX_NAME_LENGTH) { throw new Error(`Exercise name must be ${MAX_NAME_LENGTH} characters or fewer`); }
  return trimmed;
}
```
Mirror this exact shape for `workouts.name`/`workouts.notes` (both nullable free text on the schema) — apply the same `MAX_NAME_LENGTH`/`MAX_NOTES_LENGTH` bound (ASVS V5, per RESEARCH.md § Security Domain). Add a parallel `assertValidWeightKg`/`assertValidReps` guard (reject negative, cap at a sane upper bound) before any `sets` insert/update — no existing analog for numeric bounds in this codebase, but the *shape* (throw `Error` with a user-facing message, called at the top of the mutator before touching the DB) is the established convention to copy.

**Query pattern — parameterized, ordered, `undefined`-safe return** (lines 50-56, 71-74):
```typescript
export async function loadActiveExercises(db: AnyDrizzleDb): Promise<Exercise[]> {
  return db.select().from(exercises).where(eq(exercises.archived, false)).orderBy(asc(sql`lower(${exercises.name})`));
}

export async function loadExerciseById(db: AnyDrizzleDb, id: number): Promise<Exercise | undefined> {
  const [row] = await db.select().from(exercises).where(eq(exercises.id, id));
  return row;
}
```
Use this exact `const [row] = await db.select()...; return row;` destructure-first-row idiom for `findResumableWorkout` (RESEARCH.md Pattern 1) and the `loadLastPerformance` latest-`workout_exercise` lookup (Pattern 2) — both return `undefined`/`[]` rather than throwing when nothing is found, matching `loadExerciseById`'s contract.

**Mutation pattern — validate, `.returning()`, no side effects beyond the single table** (lines 122-140):
```typescript
export async function createExercise(db: AnyDrizzleDb, input: CreateExerciseInput): Promise<Exercise> {
  const name = assertValidName(input.name);
  const notes = assertValidNotes(input.notes);
  const [created] = await db.insert(exercises).values({ name, ...., isCustom: true, archived: false, seedId: null, notes }).returning();
  return created;
}
```
Mirror for `startWorkout`/`insertSet`/`addWorkoutExercise`: validate → `db.insert(...).values({...}).returning()` → destructure `[created]` → return it. For multi-table writes (discard cascade: `sets` → `workout_exercises` → `workouts`; finish-workout: `UPDATE workouts SET finished_at`), there is no existing multi-statement transaction example in `db/exercises.ts` (every exercises.ts mutator touches exactly one table) — this is new ground for `db/workouts.ts`; follow Drizzle's `db.transaction(async (tx) => {...})` API and keep child-before-parent delete order per RESEARCH.md Pitfall 2.

**Reversible-flag pattern (NOT applicable to discard)** (lines 176-189):
```typescript
export async function setArchived(db: AnyDrizzleDb, id: number, archived: boolean): Promise<Exercise> {
  const [updated] = await db.update(exercises).set({ archived }).where(eq(exercises.id, id)).returning();
  return updated;
}
```
**Do not copy this pattern for `discardWorkout`** — RESEARCH.md Pitfall 2 explicitly warns against pattern-matching this soft-flip precedent; discard is a hard delete cascade, not a status flag.

---

### `db/workouts.query.test.ts` / `db/workouts.crud.test.ts` (DB-layer tests)

**Analog:** `db/exercises.query.test.ts` + `db/exercises.crud.test.ts`

**Fixture/setup pattern** (`db/exercises.crud.test.ts` lines 1-26):
```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDb } from './test/fixture';
import { exercises } from './schema';
import { createExercise, findByName, findDuplicatesByName, setArchived, updateExercise } from './exercises';

describe('createExercise', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  beforeEach(() => { ({ db } = createTestDb()); });
  it('inserts a custom exercise with is_custom=true, archived=false, seed_id=null', async () => {
    const created = await createExercise(db, { name: 'Cable Pullover', muscleGroup: 'Back', equipment: 'Cable' });
    expect(created.isCustom).toBe(true);
    ...
  });
});
```
Copy verbatim: `createTestDb()` from `./test/fixture` in a `beforeEach`, `describe`/`it` per function, assert on the returned row's fields directly (no separate re-query needed since mutators use `.returning()`).

**Row-builder helper pattern** (`db/exercises.query.test.ts` lines 15-25):
```typescript
function makeRow(overrides: Partial<Exercise> & Pick<Exercise, 'id' | 'name'>): Exercise {
  return { muscleGroup: 'Chest', equipment: 'Barbell', isCustom: false, notes: null, seedId: null, archived: false, ...overrides };
}
```
Build an equivalent `makeWorkoutRow`/`makeSetRow` helper with sane defaults for `workouts.query.test.ts` — needed because `loadLastPerformance`/`findResumableWorkout` tests will want to seed multiple historical rows quickly.

**No existing analog:** transaction/cascade-delete test assertions (discard, finish) — write these fresh following the `beforeEach(createTestDb)` + direct-insert-then-call-mutator-then-reselect shape already established, but there's nothing to copy verbatim for asserting cross-table row counts post-cascade.

---

### `db/migrations.test.ts` (extend for `exercises.restSeconds`)

**Analog:** `db/migrations.test.ts` itself (110 lines, read in full) — this is the FNDN-02 harness to extend, not just reference.

**Exact pattern to replicate** (lines 62-109):
```typescript
describe('FNDN-02: migration 0001 -> next migration preserves data (simulated app upgrade)', () => {
  it('applies the next migration on top of a populated 0001 database without losing rows or the settings row', () => {
    const sqlite = new Database(':memory:');
    applyMigrationsUpTo(sqlite, 1);
    const db = drizzle(sqlite, { schema: { exercises, settings } });
    for (const ex of SEED_EXERCISES) { db.insert(exercises).values(ex).run(); }
    ...
    const journal = readJournal();
    const nextEntry = journal.entries[1]!;
    applyMigrationEntry(sqlite, nextEntry);
    // assert all previous rows survive unchanged + new column/index present
  });
});
```
For the new `rest_seconds` migration: add a sibling `describe` block (`applyMigrationsUpTo(sqlite, N)` where N = the current migration count before this phase's new one, then `applyMigrationEntry` for the newly-generated entry), seed `exercises` rows via the query builder, assert every row survives with `restSeconds` defaulting to `null` (additive column, no data loss) — this directly proves RESEARCH.md Pattern 4's "additive, non-destructive" claim, matching the existing test's exact assertion style (`expect(after).toEqual(before)` per row, plus a `sqlite_master` PRAGMA check if adding an index).

---

### `lib/estimate1RM.ts`, `lib/weightUnits.ts`, `lib/volume.ts`, `lib/prDetection.ts` (pure logic)

**Analog:** `lib/exerciseName.ts` (31 lines, read in full)

**Pattern — zero imports, single exported pure function, doc comment ties to requirement ID:**
```typescript
// Name normalization for duplicate detection (D-12 / GAP-2).
// ...doc comment explaining the WHY and edge cases...
export function normalizeExerciseName(name: string): string {
  const collapsed = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  return collapsed.replace(/([^s])s$/, '$1');
}
```
Every new `lib/*.ts` file in this phase (`estimate1RM.ts`, `weightUnits.ts`, `volume.ts`, `prDetection.ts`) must follow this exact shape: a top-of-file comment linking to the CONTEXT.md decision ID (D-10, D-14, D-03/D-10, D-10 respectively), zero React Native or Drizzle imports, one or two small exported pure functions, no classes. RESEARCH.md's own Code Examples section (`lib/weightUnits.ts`, `lib/estimate1RM.ts`, `lib/volume.ts`) already drafts the function bodies — combine those bodies with this file's doc-comment/no-import convention.

**Test pattern analog:** `lib/exerciseName.test.ts` exists as the sibling test — follow its `describe`/`it` shape (not read in full this pass, but confirmed present via Glob; same vitest conventions as the DB-layer tests, just without `createTestDb()` since these are pure-function tests with plain input/output assertions).

---

### `lib/restTimer.ts` (thin `expo-notifications` wrapper — partial analog)

**Analog:** `lib/exerciseFilter.ts` for the "pure lib module, single responsibility" shape only — **no existing codebase analog for an I/O-wrapping (non-pure) lib module**, since `db/exercises.ts` is the only "impure" existing module and it wraps Drizzle, not expo-notifications.

**Follow RESEARCH.md's own drafted shape instead** (RESEARCH.md § Code Examples, Pattern 3):
```typescript
import * as Notifications from 'expo-notifications';

export async function scheduleRestNotification(seconds: number): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Rest complete', body: 'Time for your next set.', sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

export async function cancelRestNotification(id: string | null): Promise<void> {
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
}
```
Test this with `expo-notifications` mocked (vitest `vi.mock`) — no existing mock-setup precedent in this codebase; this is the one genuinely new testing pattern the phase introduces.

---

### `store/activeWorkout.ts` (Zustand — no existing analog, first store in codebase)

**No analog found.** This is the first Zustand store in the project. Follow RESEARCH.md's explicit architectural guidance directly rather than a codebase precedent:
- **Anti-pattern to avoid** (RESEARCH.md § Anti-Patterns): do NOT use `zustand/middleware persist` with AsyncStorage/MMKV — SQLite is the sole source of truth (D-15); the store holds only ephemeral session state (`activeWorkoutId`, `mode: 'logging' | 'editing'`, `restEndsAt`, `restNotificationId`, per-card UI transient state).
- Store `restEndsAt` as an absolute timestamp, never a decrementing counter (RESEARCH.md Pitfall 4).
- Naming/file convention: colocate in a new top-level `store/` directory (matches `lib/`, `db/`, `components/` flat-directory precedent already established at the repo root).

---

### `app/active-workout/_layout.tsx` and `app/(tabs)/history/_layout.tsx` (Stack route groups)

**Analog:** `app/(tabs)/exercises/_layout.tsx` (25 lines, read in full)

**Exact pattern to copy verbatim (parametrize only the `Stack.Screen name=` values):**
```typescript
import { Stack } from 'expo-router';
import { theme } from '../../../theme'; // adjust relative depth per new file's location

export default function ExercisesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
      <Stack.Screen name="new" />
    </Stack>
  );
}
```
For `app/(tabs)/history/_layout.tsx`: `<Stack.Screen name="index" />` + `<Stack.Screen name="[workoutId]" />`. For `app/active-workout/_layout.tsx` (a *sibling* to `(tabs)`, not nested inside it — mirrors how `app/_layout.tsx` itself declares `<Stack.Screen name="(tabs)" />` as a top-level sibling): a single `<Stack.Screen name="[workoutId]" />`, registered in `app/_layout.tsx`'s root `<Stack>` as a second `<Stack.Screen name="active-workout" />` sibling to `(tabs)` (this is the "full-screen over tabs" mechanism per D-15/UI-SPEC — verified against `app/_layout.tsx` lines 44-56).

---

### `app/active-workout/[workoutId].tsx` (active-workout screen — most complex new screen)

**Analog:** `app/(tabs)/exercises/[id].tsx` (368 lines, read in full) — reuse its chrome/lifecycle conventions; this new screen is substantially larger (drag-reorder, timer, keypad) so treat the analog as a skeleton, not a template to fill in mechanically.

**Imports/chrome conventions to copy** (lines 1-31):
```typescript
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, ToastAndroid, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../../db/client';
import { theme } from '../../../theme';
```
Plus this phase's new imports: `useActiveWorkoutStore` (or equivalent hook) from `store/activeWorkout.ts`, `Gesture`/`GestureDetector` from `react-native-gesture-handler`, `Animated` from `react-native-reanimated`.

**Android-first toast helper — copy verbatim** (lines 36-40):
```typescript
function notify(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  }
}
```
Reuse for "Couldn't save that set..." (UI-SPEC error copy) and any other transient confirmation.

**`useFocusEffect`-equivalent load pattern** (lines 57-72, adapted from `useCallback`+`useEffect` here — note `exercises/index.tsx` uses the stricter `useFocusEffect` variant, prefer that one for history screens):
```typescript
const loadExercise = useCallback(async () => {
  setLoading(true);
  const row = await loadExerciseById(db, exerciseId);
  if (row) { setExercise(row); ...set form fields... }
  setLoading(false);
}, [exerciseId]);

useEffect(() => { loadExercise(); }, [loadExercise]);
```

**Destructive confirm dialog — copy verbatim shape for Discard (D-11)** (lines 121-132):
```typescript
Alert.alert(
  'Archive exercise?',
  `"${exercise.name}" will be hidden from the library. You can unarchive it any time from "Show archived".`,
  [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Archive', style: 'destructive', onPress: () => void applyArchived(true) },
  ],
);
```
For discard: `Alert.alert('Discard this workout?', "All sets logged in this session will be deleted. This can't be undone.", [{text:'Cancel',style:'cancel'},{text:'Discard',style:'destructive',onPress:...}])` — exact same 2-button shape, per UI-SPEC's copywriting contract. Same pattern again for "Remove exercise with logged sets."

**In-screen app-bar anatomy** (lines 153-164, styles 257-283): back-affordance-left / center-title / right-badge-or-action — reuse this row layout for the active-workout app-bar (left="Discard" text button instead of back-chevron, right="Finish workout" filled button per UI-SPEC).

**No analog for:** drag-to-reorder gesture composition, sticky bottom rest-timer bar, numeric keypad bottom sheet — these are genuinely new interaction patterns for this codebase; RESEARCH.md's Architecture Patterns/Anti-Patterns sections are the primary source since no existing screen in the repo does gesture-driven reordering or bottom-sheet input.

---

### `app/(tabs)/index.tsx` (Workout tab — rewrite from stub)

**Analog for list/empty-state chrome:** `app/(tabs)/exercises/index.tsx` — specifically its `ListEmptyComponent` pattern (lines 152-165) and app-bar-with-action-button pattern (lines 88-101) for the "Start empty workout"/"Start from history" button pair and the sparse empty-state copy.

**Analog for current stub being replaced** (`app/(tabs)/index.tsx`, read in full, 32 lines) — the existing "Coming soon" stub's `StyleSheet` token usage is the file this one directly replaces; keep the same `theme.colors.background` full-screen container convention, discard everything else.

---

### `app/(tabs)/history/index.tsx`, `[workoutId].tsx` (History tab)

**Analog:** `app/(tabs)/exercises/index.tsx` (list + search chrome) for `history/index.tsx`'s List view, and `app/(tabs)/exercises/[id].tsx` (read-only sections, app-bar) for `history/[workoutId].tsx`'s detail view. The segmented List/Calendar toggle at the top of `history/index.tsx` should reuse `MuscleGroupPills`' single-select pill-row visual pattern (component analog below), reduced to two options.

**`useFocusEffect` reload — copy verbatim from `exercises/index.tsx`** (lines 46-59):
```typescript
useFocusEffect(
  useCallback(() => {
    let cancelled = false;
    const load = showArchived ? loadAllExercises(db) : loadActiveExercises(db);
    load.then((rows) => { if (!cancelled) { setAllExercises(rows); } });
    return () => { cancelled = true; };
  }, [showArchived]),
);
```
Use this exact cancelled-flag-guarded `useFocusEffect` shape for `history/index.tsx`'s workout list reload (so edits made via "Edit" → active-workout screen → back are reflected, per CONTEXT.md's Integration Points note) and for `history/[workoutId].tsx`'s detail reload.

---

### `app/(tabs)/settings.tsx` (extend stub with Units + Default rest rows)

**Analog:** `app/(tabs)/exercises/[id].tsx`'s form-field + save pattern (label + input + save button, lines 179-219) for the two new functional rows; current stub (`app/(tabs)/settings.tsx`, 34 lines, read in full) is the file being extended — keep its `theme.colors.background` full-screen container, add the two new rows below the existing "More"/"Coming soon" heading (or replace it once Units/Default-rest are the actual content, per UI-SPEC's "exactly two functional rows added" scope).

---

### `components/SetRow.tsx`, `components/WorkoutRow.tsx`

**Analog:** `components/ExerciseRow.tsx` (127 lines, read in full)

**Row anatomy pattern — leading glyph, text column, trailing chevron/action, all theme-token-styled:**
```typescript
export function ExerciseRow({ name, muscleGroup, equipment, isCustom = false, archived = false, onPress }: ExerciseRowProps) {
  return (
    <Pressable onPress={onPress} style={[styles.row, archived ? styles.rowArchived : null]} accessibilityRole="button">
      <Text style={styles.icon}>{muscleIcon(muscleGroup)}</Text>
      <View style={styles.textColumn}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {isCustom ? <View style={styles.badge}><Text style={styles.badgeText}>CUSTOM</Text></View> : null}
        </View>
        <Text style={styles.secondary} numberOfLines={1}>{muscleGroup} · {equipment}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}
```
`WorkoutRow.tsx` (History list row) is a near-direct copy: leading glyph (🏋 or calendar Ionicon) + text column (date/name primary line, "N exercises · volume · duration" caption secondary line per UI-SPEC) + trailing chevron, same `styles.row`/`styles.rowArchived`-equivalent border/padding/touch-target values (`paddingVertical: theme.spacing.lg`, `borderBottomWidth: StyleSheet.hairlineWidth`).

`SetRow.tsx` diverges more (steppers + tappable number + ✓ button instead of a simple Pressable row) but should still use `theme.spacing`/`theme.colors`/`theme.radius` exclusively and the same `accessibilityRole="button"` + explicit `accessibilityLabel` convention seen throughout (UI-SPEC mandates labels for every icon-only control: `"Log set"`, `"Decrease weight"`, etc.).

---

### `components/FilterChipRow.tsx` reused directly (not a new file — imported wholesale)

**Analog:** `components/FilterChipRow.tsx` is directly reused by the exercise picker (add/replace flow reuses Phase 1's exercises screen wholesale per UI-SPEC) — no changes needed to this file; import it as-is into any new exercise-picker screen/sheet.

---

### `components/ExerciseCard.tsx`, `components/RestTimerBar.tsx`, `components/NumericKeypad.tsx`, `components/MonthCalendar.tsx`

**Partial analogs only** — copy the *theming discipline*, not structural code, from `components/MuscleGroupPills.tsx` (87 lines, read in full):
```typescript
const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  pillIdle: { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
});
```
And the `accessibilityState={{ selected: active }}` + `accessibilityRole="button"` pattern (lines 44-46) for `MonthCalendar`'s day cells and any active/inactive toggle state in `RestTimerBar`/`NumericKeypad`.

No codebase precedent exists for: drag-gesture composition (`ExerciseCard`'s reorder handle), a sticky-bottom-bar-with-live-countdown (`RestTimerBar`), a bottom-sheet numeric grid (`NumericKeypad`), or a 7-column date grid (`MonthCalendar`). Build these fresh per RESEARCH.md's Architecture Patterns/Don't-Hand-Roll guidance (hand-rolled via `react-native-gesture-handler`+`reanimated`, zero new dependencies) while strictly reusing `theme.ts` tokens and the accessibility-label mandate throughout.

## Shared Patterns

### Theme tokens (mandatory for every new file)
**Source:** `theme.ts` (46 lines, read in full)
**Apply to:** every new component and screen file, no exceptions (D-14 lock).
```typescript
export const theme = {
  colors: { background: '#0B0E11', surface: '#161A1F', surfaceAlt: '#1E232A', text: '#F5F7FA', textMuted: '#8B94A3', accent: '#4F8EF7', border: '#262C34', danger: '#EF4444', badge: '#F59E0B' },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  typography: { title: {...}, body: {...}, caption: {...} },
  radius: { sm: 6, md: 10, lg: 16 },
} as const;
```
UI-SPEC adds exactly one new token this phase: `theme.typography.display` (32px/700, line-height 1.1/35px) — add it to `theme.ts` before building `RestTimerBar.tsx`; it is the only planned addition to this locked file.

### Driver-agnostic DB access (`AnyDrizzleDb`)
**Source:** `db/exercises.ts` lines 14, 20
**Apply to:** `db/workouts.ts`, `db/settings.ts` — every data-layer function takes `db: AnyDrizzleDb` as its first parameter so the same function runs against both `drizzle-orm/expo-sqlite` (device, via `db/client.ts`) and `drizzle-orm/better-sqlite3` (vitest, via `db/test/fixture.ts`).
```typescript
type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;
```

### Android-first transient feedback
**Source:** `app/(tabs)/exercises/[id].tsx` lines 36-40
**Apply to:** `active-workout/[workoutId].tsx` (set-write failure toast per UI-SPEC), any screen with a save/write action.
```typescript
function notify(message: string): void {
  if (Platform.OS === 'android') { ToastAndroid.show(message, ToastAndroid.SHORT); }
}
```

### Destructive confirm dialog shape
**Source:** `app/(tabs)/exercises/[id].tsx` lines 124-131
**Apply to:** Discard-workout confirm (D-11), Remove-exercise-with-logged-sets confirm (D-16/UI-SPEC) — both are `Alert.alert(title, body, [Cancel, {text, style:'destructive', onPress}])`.

### `useFocusEffect` cancelled-guard reload
**Source:** `app/(tabs)/exercises/index.tsx` lines 46-59
**Apply to:** `app/(tabs)/history/index.tsx`, `history/[workoutId].tsx`, `app/(tabs)/index.tsx`'s resume-session check — any screen whose data can change on a pushed screen and must reflect that change on return-to-focus.

### Stack-per-route-group (no phantom tabs)
**Source:** `app/(tabs)/exercises/_layout.tsx` (full file)
**Apply to:** `app/active-workout/_layout.tsx`, `app/(tabs)/history/_layout.tsx` — any new multi-screen route group needs its own `Stack` with `headerShown: false` + `contentStyle: { backgroundColor: theme.colors.background }`, else expo-router leaks sibling files into the bottom tab bar.

### DB-layer vitest fixture
**Source:** `db/test/fixture.ts` (full file) + `db/exercises.crud.test.ts` lines 21-26
**Apply to:** `db/workouts.query.test.ts`, `db/workouts.crud.test.ts`, extended `db/migrations.test.ts`.
```typescript
import { createTestDb } from './test/fixture';
let db: ReturnType<typeof createTestDb>['db'];
beforeEach(() => { ({ db } = createTestDb()); });
```

### Pure `lib/` module shape (zero RN imports, doc-comment ties to decision ID)
**Source:** `lib/exerciseName.ts` (full file)
**Apply to:** `lib/estimate1RM.ts`, `lib/weightUnits.ts`, `lib/volume.ts`, `lib/prDetection.ts`.

## No Analog Found

Files/patterns with no close existing match — planner should rely on RESEARCH.md's Architecture Patterns / Code Examples sections instead:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `store/activeWorkout.ts` | Zustand store | event-driven | First Zustand store in the codebase — no prior state-management module exists to pattern-match; follow RESEARCH.md's explicit "no persist middleware, SQLite is source of truth" guidance directly. |
| `lib/restTimer.ts` | pure-ish lib (I/O wrapper) | event-driven | First non-Drizzle I/O wrapper in `lib/`; `db/exercises.ts` wraps Drizzle but nothing wraps `expo-notifications` yet. Use RESEARCH.md's drafted `scheduleRestNotification`/`cancelRestNotification` shape verbatim. |
| `components/ExerciseCard.tsx` (drag-reorder portion) | component | event-driven (gesture) | No existing gesture-handler/reanimated drag composition in the repo. |
| `components/RestTimerBar.tsx` (countdown portion) | component | event-driven (timer) | No existing wall-clock-anchored countdown component; must avoid the decrementing-integer anti-pattern per RESEARCH.md Pitfall 4. |
| `components/NumericKeypad.tsx` | component | request-response (custom input) | No bottom-sheet/custom-keypad precedent; only `TextInput`-based forms exist today. |
| `components/MonthCalendar.tsx` | component | transform + request-response | No date-grid/calendar precedent in the repo; build as plain `View`/`FlatList` 7-column grid per UI-SPEC's explicit no-new-dependency instruction. |

## Metadata

**Analog search scope:** `db/`, `lib/`, `components/`, `app/`, `theme.ts` (entire repo source tree excluding `node_modules`, `drizzle/`, `docs/`)
**Files scanned:** `db/schema.ts`, `db/exercises.ts`, `db/exercises.query.test.ts`, `db/exercises.crud.test.ts`, `db/migrations.test.ts`, `db/test/fixture.ts`, `db/client.ts`, `theme.ts`, `components/ExerciseRow.tsx`, `components/MuscleGroupPills.tsx`, `components/FilterChipRow.tsx` (glob-located, not opened — referenced via other files' usage), `lib/exerciseName.ts`, `lib/exerciseFilter.ts` (glob-located), `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/history.tsx`, `app/(tabs)/settings.tsx`, `app/(tabs)/exercises/_layout.tsx`, `app/(tabs)/exercises/index.tsx`, `app/(tabs)/exercises/[id].tsx`
**Pattern extraction date:** 2026-07-21
