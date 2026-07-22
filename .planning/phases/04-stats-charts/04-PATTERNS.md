# Phase 4: Stats & Charts - Pattern Map

**Mapped:** 2026-07-22
**Files analyzed:** 8 new + 2 modified
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `lib/chartSeries.ts` | utility (pure math) | transform | `lib/prDetection.ts` | exact (pure-function convention, group-by-exercise reduction) |
| `lib/chartSeries.test.ts` | test | transform | `lib/prDetection.test.ts` | exact |
| `lib/records.ts` | utility (pure math) | transform / event-driven | `lib/prDetection.ts` | role-match (extends session-only PR logic to all-history chronological scan) |
| `lib/records.test.ts` | test | transform | `lib/prDetection.test.ts` | exact |
| `lib/weeklyVolume.ts` | utility (pure math) | transform / batch | `lib/volume.ts` | role-match (reuses `workingSetVolume`, adds week-bucketing) |
| `db/stats.ts` | service (query layer) | CRUD (read-only) | `db/workouts.ts` (`loadWorkoutHistory`, `loadPriorBests`, `loadWorkoutDetail`) | exact (driver-agnostic `AnyDrizzleDb`, per-row-group JS reduction) |
| `db/stats.query.test.ts` | test | CRUD (read-only) | `db/workouts.query.test.ts` | exact |
| `db/stats.performance.test.ts` | test | batch | `db/workouts.query.test.ts` (structure) + `db/test/fixture.ts` (`createTestDb`) | role-match (new: synthetic-history generator + timed assertions, no existing analog for the perf-timing part) |
| `app/(tabs)/stats.tsx` (replace placeholder) | component (screen) | request-response | `app/(tabs)/history/[workoutId].tsx` | exact (useFocusEffect load pattern, theme usage, stat-row anatomy) |
| `app/stats/[exerciseId].tsx` | component (screen) | request-response | `app/(tabs)/history/[workoutId].tsx` | exact (pushed-route detail screen, `useLocalSearchParams`, appbar back button) |
| `app/stats/records.tsx` | component (screen) | request-response | `app/(tabs)/history/[workoutId].tsx` | role-match ("see all" list screen, same appbar/back pattern) |
| Exercise detail screen "View progress" affordance | component (modification) | request-response | `app/(tabs)/exercises/[id].tsx` | exact (existing file to modify, add a `Pressable`/link using `useRouter().push`) |

## Pattern Assignments

### `lib/chartSeries.ts` (utility, transform)

**Analog:** `lib/prDetection.ts` (86 lines) + `lib/volume.ts`

**Imports pattern** (`lib/prDetection.ts` lines 1-17):
```typescript
// PR detection — heaviest weight + best estimated 1RM vs prior history (D-10).
import { estimate1RM } from './estimate1RM';

interface CurrentSet {
  exerciseId: number;
  weightKg: number;
  reps: number;
  type: string;
}
```
Zero React Native / Drizzle imports — pure function module. `lib/chartSeries.ts` must follow this exactly: only import `estimate1RM` from `./estimate1RM` and `workingSetVolume` from `./volume` (do not reimplement the tonnage sum inline — RESEARCH.md flags this explicitly).

**Core grouping/reduction pattern** (`lib/prDetection.ts` lines 39-53, group-by-exercise):
```typescript
const workingSets = currentSets.filter((s) => s.type !== 'warmup');
const setsByExercise = new Map<number, CurrentSet[]>();
for (const set of workingSets) {
  const existing = setsByExercise.get(set.exerciseId);
  if (existing) {
    existing.push(set);
  } else {
    setsByExercise.set(set.exerciseId, [set]);
  }
}
```
For `buildChartSeries`, mirror this shape but group by `workoutId` instead of `exerciseId` (per D-07 "one point per workout"), then reduce each bucket to a single point per the `metric` param (`e1rm` / `topSet` / `volume`). Sort output by date ascending (RESEARCH.md Pattern 1 sketch) — `sortedSets.sort((a, b) => a.date.localeCompare(b.date))` follows the ISO-string comparison convention already used in `db/workouts.ts` (`gte(workouts.startedAt, start)` bound-parameter dates).

**Formula reuse (never reimplement):**
```typescript
// lib/estimate1RM.ts line 17-20
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

// lib/volume.ts line 17-21
export function workingSetVolume(completedSets: VolumeSet[]): number {
  return completedSets
    .filter((s) => s.type !== 'warmup')
    .reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}
```

---

### `lib/chartSeries.test.ts` / `lib/records.test.ts` (test, transform)

**Analog:** `lib/prDetection.test.ts` (46 lines)

**Test structure pattern** (lines 1-21):
```typescript
import { describe, expect, it } from 'vitest';
import { estimate1RM } from './estimate1RM';
import { detectPRs } from './prDetection';

describe('detectPRs', () => {
  it('first-ever set (no prior history) yields both a weight and e1rm hit', () => {
    const hits = detectPRs(
      [{ exerciseId: 1, weightKg: 100, reps: 5, type: 'normal' }],
      []
    );
    expect(hits).toHaveLength(2);
    expect(hits).toEqual(
      expect.arrayContaining([...])
    );
  });
  // ...edge cases: exact-tie (strict >), warmup exclusion, etc.
});
```
Follow this exact `describe`/`it` shape with literal fixture objects (no mocking framework) for both new test files. Cover: empty input, single workout, warmup exclusion, and (for `records.test.ts`) the "re-running the scan after inserting a new heavier set immediately reflects it" behavior called out in RESEARCH.md's Phase Requirements → Test Map for STAT-03.

---

### `lib/records.ts` (utility, transform / event-driven)

**Analog:** `lib/prDetection.ts` (session-only PR logic — extend to all-history chronological scan)

Reuse the same per-exercise `Map`-keyed running-best pattern from `prDetection.ts` lines 56-83, but scan chronologically across ALL sets (not one session) and emit a `PREvent` on every improvement, per the `computeAllTimeRecords` sketch in 04-RESEARCH.md (Code Examples section, lines 406-434) — this sketch is the concrete target shape; do not deviate from its `Map<string, number>` keying scheme (`${exerciseId}:${reps}` for rep-max, `Map<number, number>` for e1rm bests) without cause, since it is what makes both D-09's "recent feed" (event dates) and "record board" (final Map state) derivable from a single pass.

**Error handling:** None of `lib/prDetection.ts`, `lib/estimate1RM.ts`, or `lib/volume.ts` throw — they are pure functions that return sentinel values (`null`, `[]`) for missing/empty input. `lib/records.ts` and `lib/chartSeries.ts` should follow this convention: no thrown errors for empty/malformed data, only for truly invalid states if ever needed (mirrors `db/workouts.ts`'s validation-at-the-boundary convention, which throws only in the DB-write layer, not the pure-math layer).

---

### `lib/weeklyVolume.ts` (utility, transform / batch)

**Analog:** `lib/volume.ts` (`workingSetVolume`)

Reuse `workingSetVolume` per-week bucket (do not reimplement the `weightKg * reps` sum). New logic needed: a `getWeekStart(date)` Monday-Sunday bucketing helper (D-15) — RESEARCH.md's "Don't Hand-Roll" table explicitly calls out this as one shared helper, analogous to `lib/duration.ts`'s shared-formatter pattern (used in `app/(tabs)/history/[workoutId].tsx` line 21: `formatDurationMs`). No existing week-boundary helper exists in the codebase — this is genuinely new, model its export/import shape on `lib/duration.ts`'s single-purpose formatter convention (one exported pure function, JSDoc above it explaining the boundary rule).

---

### `db/stats.ts` (service/query layer, CRUD read-only)

**Analog:** `db/workouts.ts` (560 lines — `loadWorkoutHistory`, `loadPriorBests`, `loadWorkoutDetail`)

**Imports pattern** (`db/workouts.ts` lines 13-27):
```typescript
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  exercises,
  sets,
  workoutExercises,
  workouts,
  type NewSet,
  type Set,
  type Workout,
  type WorkoutExercise,
} from './schema';
import { estimate1RM } from '../lib/estimate1RM';
import { workingSetVolume } from '../lib/volume';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;
```
`db/stats.ts` must use this exact `AnyDrizzleDb` type alias (driver-agnostic — works with both `drizzle-orm/expo-sqlite` on-device and `drizzle-orm/better-sqlite3` in vitest) and import `estimate1RM`/`workingSetVolume`/`lib/chartSeries.ts`/`lib/records.ts` rather than reimplementing any math.

**Core CRUD/read pattern — parameterized query + JS-side reduction** (`db/workouts.ts` lines 508-560, `loadPriorBests`):
```typescript
export async function loadPriorBests(
  db: AnyDrizzleDb,
  exerciseIds: number[],
  beforeWorkoutId: number,
): Promise<PriorBest[]> {
  if (exerciseIds.length === 0) {
    return [];
  }
  // ... fetch target workout's startedAt as a bound parameter ...
  const results: PriorBest[] = [];
  for (const exerciseId of exerciseIds) {
    const rows = await db
      .select({ weightKg: sets.weightKg, reps: sets.reps, type: sets.type })
      .from(sets)
      .innerJoin(workoutExercises, eq(sets.workoutExerciseId, workoutExercises.id))
      .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
      .where(
        and(
          eq(workoutExercises.exerciseId, exerciseId),
          isNotNull(workouts.finishedAt),
          lt(workouts.startedAt, target.startedAt),
        ),
      );
    // reduce rows to bests in JS, filtering warmups, calling estimate1RM per set
    results.push({ exerciseId, bestWeightKg, bestE1RM });
  }
  return results;
}
```
This is the exact idiom `db/stats.ts` should follow for the chart-series query (scoped to one `exerciseId`, joined `sets` → `workout_exercises` → `workouts`, `isNotNull(workouts.finishedAt)`, ordered/bound-parameterized) and for the all-history record scan (same joins, no `exerciseId` filter, ordered `asc(workouts.startedAt)` for the chronological pass `lib/records.ts#computeAllTimeRecords` requires). **Never** aggregate in SQL (`MAX(weight_kg * ...)`) — always fetch raw rows and reduce via the shared pure functions (Pitfall 4 in RESEARCH.md).

**Security (parameterized queries only, ASVS V5):** every predicate above uses Drizzle's builder helpers (`eq`, `and`, `isNotNull`, `lt`, `gte`) — never string-concatenate a date bound or exercise id into raw SQL, exactly as `loadWorkoutsInMonth` does (`db/workouts.ts` lines 483-492) for its calendar-month bound-parameter pattern.

---

### `db/stats.query.test.ts` (test, CRUD read-only)

**Analog:** `db/workouts.query.test.ts` (294 lines)

**Test setup pattern** (lines 1-31):
```typescript
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { exercises, workouts } from './schema';
import { /* functions under test */ } from './workouts';
import { estimate1RM } from '../lib/estimate1RM';

describe('findResumableWorkout', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns undefined when no workout has ever been started', async () => {
    const resumable = await findResumableWorkout(db);
    expect(resumable).toBeUndefined();
  });
  // ...
});
```
Use `createTestDb()` from `db/test/fixture.ts` in a `beforeEach` for a fresh in-memory better-sqlite3 DB per test, exactly as `workouts.query.test.ts` does. Seed rows via the same helper functions under test (`startWorkout`, `insertSet`, etc. — reuse `db/workouts.ts`'s own writers to set up fixture data for `db/stats.ts`'s read queries, rather than hand-writing raw inserts).

---

### `db/stats.performance.test.ts` (test, batch)

**Analog:** `db/test/fixture.ts` (`createTestDb`) for the DB bootstrap + `db/workouts.query.test.ts` for `describe`/`it` structure. No existing in-repo analog for timed-assertion tests — this is genuinely new.

**Pattern to build:** Extend `createTestDb()` with a new synthetic-history seed generator (per 04-RESEARCH.md's "STAT-04 performance strategy" section: ~780 workouts / ~15,600 sets over 5 years), then wrap each of the three query paths (per-exercise chart series, 12-week volume, all-history record scan) in `performance.now()` before/after, asserting e.g. "full-history PR scan completes in under 500ms" as a regression-guard ceiling (not a tight budget). Use the same `beforeEach(() => { ({ db } = createTestDb()); })` bootstrap as `stats.query.test.ts`.

---

### `app/(tabs)/stats.tsx` (screen, request-response) — replace placeholder

**Analog:** `app/(tabs)/history/[workoutId].tsx` (367 lines) for data-loading/theme conventions; current placeholder for the file to replace.

**Current placeholder** (`app/(tabs)/stats.tsx`, full file, 31 lines):
```typescript
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

export default function StatsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stats</Text>
      <Text style={styles.caption}>Coming soon</Text>
    </View>
  );
}
// styles: container (flex/center, theme.colors.background, theme.spacing.xl padding),
// title (theme.typography.title), caption (theme.typography.caption, textMuted)
```

**Data-loading pattern to copy** (`app/(tabs)/history/[workoutId].tsx` lines 54-108, `useFocusEffect` + cancelled-guard):
```typescript
useFocusEffect(
  useCallback(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [workoutDetail, exercisesList, unitSetting] = await Promise.all([
        loadWorkoutDetail(db, workoutId),
        loadAllExercises(db),
        getSetting(db, 'units'),
      ]);
      if (cancelled) return;
      // ... derive view state ...
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workoutId]),
);
```
The Stats overview dashboard (D-01/D-02) should use this exact `useFocusEffect` + `Promise.all` + `cancelled`-guard shape to load PR feed data, weekly volume data, and the `units` setting together on every tab focus (STAT-03/D-11 requires live recompute on every open — `useFocusEffect`, not `useEffect`, is the correct hook since it re-fires on tab re-focus, matching the "never stored" requirement).

**Stat-row / card anatomy to reuse for the PR feed and volume chart cards** (`app/(tabs)/history/[workoutId].tsx` lines 170-200, `statsRow`/`statCard`/`prList`/`prRow`/`prBadge` styles) — same `theme.colors.surface` card background, `theme.radius.md`, `theme.spacing` tokens, PR badge (`theme.colors.badge`) pattern directly reusable for the overview's PR feed rows.

---

### `app/stats/[exerciseId].tsx` (screen, request-response) — new per-exercise chart

**Analog:** `app/(tabs)/history/[workoutId].tsx` (route param + appbar + back button pattern)

**Route/appbar pattern** (lines 11-14, 41-46, 154-163):
```typescript
import { useLocalSearchParams, useRouter } from 'expo-router';
// ...
const { workoutId: workoutIdParam } = useLocalSearchParams<{ workoutId: string }>();
const workoutId = Number(workoutIdParam);
const router = useRouter();
const insets = useSafeAreaInsets();
// ...
<View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
  <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
    <Text style={styles.backText}>‹ History</Text>
  </Pressable>
  {/* right-side CTA, e.g. edit or nothing */}
</View>
```
`app/stats/[exerciseId].tsx` should follow this identical param-parsing (`useLocalSearchParams<{ exerciseId: string }>()`), safe-area appbar, and back-button pattern (back label becomes "‹ Stats"). Add the segmented metric toggle (D-05: e1RM/topSet/volume) and range chips (D-06: 3M/1Y/All) as new controls above the `CartesianChart`, following the same `theme.colors.accent` active-state styling used elsewhere (cf. `editText`/`backText` accent-colored pressable text).

**Loading/not-found state pattern** (lines 132-149):
```typescript
if (loading) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}
if (!detail) {
  return (
    <View style={styles.centered}>
      <Text style={styles.notFoundText}>Workout not found.</Text>
      <Pressable onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.backLink}>Go back</Text>
      </Pressable>
    </View>
  );
}
```
Reuse verbatim for a "no exercise found" / "no data logged yet" empty state (empty-state visuals are Claude's Discretion per CONTEXT.md, but the loading/not-found *structure* should match this existing convention).

---

### `app/stats/records.tsx` (screen, request-response) — "see all" full PR history

**Analog:** `app/(tabs)/history/[workoutId].tsx` (list rendering + appbar pattern), `app/(tabs)/history/index.tsx` likely has a list-screen analog too (not read in detail — same appbar/back convention applies).

Follow the same appbar-with-back-button + `ScrollView`/`FlatList` list-row pattern as the PR list rendering in `[workoutId].tsx` lines 187-200 (`prList`/`prRow`/`prBadge`), extended to a scrollable full-history feed grouped by exercise (per-exercise record board, D-09).

---

### Exercise detail screen — "View progress" entry point (D-03)

**Analog:** `app/(tabs)/exercises/[id].tsx` (existing file to modify)

**Current imports/router pattern** (lines 8-31):
```typescript
import { useLocalSearchParams, useRouter } from 'expo-router';
import { db } from '../../../db/client';
import { loadExerciseById, setArchived, updateExercise } from '../../../db/exercises';
import type { Exercise } from '../../../db/schema';
import { theme } from '../../../theme';
// ...
const { id } = useLocalSearchParams<{ id: string }>();
const exerciseId = Number(id);
const router = useRouter();
```
Add a "View progress" `Pressable` that calls `router.push({ pathname: '/stats/[exerciseId]', params: { exerciseId: String(exerciseId) } })` — mirrors the exact `router.push` call shape already used in `app/(tabs)/history/[workoutId].tsx` line 129 (`handleEdit`):
```typescript
router.push({ pathname: '/active-workout/[workoutId]', params: { workoutId: String(workoutId) } });
```

---

## Shared Patterns

### Pure-math / driver-agnostic split (load-bearing architecture)
**Source:** `lib/estimate1RM.ts`, `lib/volume.ts`, `lib/prDetection.ts` (pure lib) vs. `db/workouts.ts` (query layer with `AnyDrizzleDb`)
**Apply to:** All new `lib/*.ts` and `db/stats.ts` files. Math (e1RM, volume, chart-series reduction, record scanning) is pure TS with zero RN/Drizzle imports and vitest coverage; DB reads live in `db/stats.ts` using `type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>` so the same functions run against both `drizzle-orm/expo-sqlite` (device) and `drizzle-orm/better-sqlite3` (vitest via `db/test/fixture.ts`).

### Theme tokens (dark-first, no ad-hoc colors)
**Source:** `theme.ts`
```typescript
export const theme = {
  colors: { background: '#0B0E11', surface: '#161A1F', surfaceAlt: '#1E232A',
    text: '#F5F7FA', textMuted: '#8B94A3', accent: '#4F8EF7', border: '#262C34',
    danger: '#EF4444', badge: '#F59E0B' },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  typography: { title: {...}, body: {...}, caption: {...}, display: {...} },
  radius: { sm: 6, md: 10, lg: 16 },
} as const;
```
**Apply to:** All new Stats screens/components — import `theme` from the project root (`../../theme` or `../../../theme` depending on nesting), never inline color/spacing literals.

### kg↔display-unit conversion (D-16)
**Source:** `lib/weightUnits.ts` — `kgToDisplay(weightKg, unit)` / `displayToKg(displayValue, unit)`
**Apply to:** Every chart axis label, record-board value, and PR-feed value. Underlying math/storage stays in kg (canonical); only the render-time label converts. Read the `units` setting via `getSetting(db, 'units')` (same call as `[workoutId].tsx` line 63) at screen-load time, exactly as the History detail screen already does.

### Parameterized queries only (ASVS V5, carried forward)
**Source:** `db/workouts.ts` (all query functions use Drizzle's `eq`/`and`/`isNotNull`/`lt`/`gte` builders)
**Apply to:** `db/stats.ts` — never string-concatenate a date bound, exercise id, or muscle-group filter into raw SQL. Range-chip selection (3M/1Y/All per D-06) is a closed enum handled entirely client-side (RESEARCH.md's Open Question #2 recommendation: fetch all-time once, filter client-side in the pure lib layer) — not even a query-parameter risk.

### `useFocusEffect` + cancelled-guard for live recompute (STAT-03/D-11 non-negotiable)
**Source:** `app/(tabs)/history/[workoutId].tsx` lines 54-108
**Apply to:** `app/(tabs)/stats.tsx` and `app/stats/[exerciseId].tsx` — PR feed and chart data must be recomputed from `db/stats.ts` queries on every screen focus, never cached/stored. `useFocusEffect` (not `useEffect`) is required so a re-focus (e.g., returning from logging a new set) triggers a fresh live query.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `lib/weeklyVolume.ts`'s `getWeekStart` helper | utility | transform | No existing week-boundary bucketing helper in the codebase (only `lib/duration.ts`'s formatter exists as a "shared single-purpose helper" convention analog — the week-boundary logic itself is net-new) |
| `db/stats.performance.test.ts` | test | batch | No existing timed-performance-assertion test exists anywhere in the repo; must be built fresh per RESEARCH.md's STAT-04 strategy, using `createTestDb()` + a new synthetic-history seed generator |
| Chart rendering itself (`CartesianChart`+`Line`/`StackedBar`, victory-native XL) | component | streaming/render | victory-native is not yet installed in this codebase (RESEARCH.md D-18/Install gap) — no in-repo analog exists; follow the official docs code examples cited in 04-RESEARCH.md Patterns 2 & 3 verbatim instead |

## Metadata

**Analog search scope:** `lib/`, `db/`, `app/(tabs)/`, `app/active-workout/`, `theme.ts` — full repo file listing enumerated via `find app -type f`.
**Files scanned:** `lib/prDetection.ts`, `lib/prDetection.test.ts`, `lib/estimate1RM.ts`, `lib/volume.ts`, `lib/weightUnits.ts`, `theme.ts`, `db/workouts.ts`, `db/workouts.query.test.ts`, `db/schema.ts`, `db/test/fixture.ts`, `app/(tabs)/stats.tsx`, `app/(tabs)/history/[workoutId].tsx`, `app/(tabs)/exercises/[id].tsx`.
**Pattern extraction date:** 2026-07-22
