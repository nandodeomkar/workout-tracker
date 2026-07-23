# Phase 5: Body Measurements - Pattern Map

**Mapped:** 2026-07-23
**Files analyzed:** 15 (10 new, 5 modified)
**Analogs found:** 15 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `db/schema.ts` (MODIFIED — add `metricDefinitions`) | model | CRUD | `db/schema.ts` (existing `bodyMeasurements`/`exercises` tables in same file) | exact (self) |
| `db/measurements.ts` (NEW) | service/data-layer | CRUD | `db/workouts.ts` (driver-agnostic `AnyDrizzleDb`, `assertValid*` guards) + `db/settings.ts` (upsert shape) | exact |
| `db/measurements.crud.test.ts` (NEW) | test | CRUD | `db/migrations.test.ts` / existing `db/*.test.ts` in-memory pattern | role-match |
| `db/seed/runSeed.ts` (MODIFIED — seed `metric_definitions`) | service | batch/event-driven (first-launch) | `db/seed/runSeed.ts` (itself — exercises seeding loop) | exact (self) |
| `db/seed/seedVersion.ts` (MODIFIED — bump to 4) | config | n/a | `db/seed/seedVersion.ts` (itself) | exact (self) |
| `drizzle/000X_*.sql` (NEW, generated) | migration | batch | `drizzle/0002_young_preak.sql` (additive `ALTER`/`CREATE` precedent) | role-match |
| `db/schema.test.ts` (MODIFIED — add table to `EXPECTED_TABLES`) | test | CRUD | `db/schema.test.ts` (itself) | exact (self) |
| `db/migrations.test.ts` (MODIFIED — new upgrade `describe` block) | test | batch | `db/migrations.test.ts` "D-08: migration 0001 -> 0002" block | exact |
| `lib/measurementMetrics.ts` (NEW) | utility (pure lib) | transform | `lib/weightUnits.ts` (pure, zero-import convention) / registry shape is new but constants-file pattern matches `constants/muscleIcons.ts` | role-match |
| `lib/measurementMetrics.test.ts` (NEW) | test | transform | `lib/estimate1RM.test.ts` (pure-fn vitest convention) | role-match |
| `lib/lengthUnits.ts` (NEW) | utility (pure lib) | transform | `lib/weightUnits.ts` | exact |
| `lib/lengthUnits.test.ts` (NEW) | test | transform | vitest tests for `lib/weightUnits.ts`-style modules | role-match |
| `lib/measurementSeries.ts` (NEW) | utility (pure lib) | transform | `lib/chartSeries.ts` (shape only — NOT the min/max reduction, see Pitfall 3 below) | role-match |
| `lib/measurementSeries.test.ts` (NEW) | test | transform | vitest tests for `lib/chartSeries.ts`-style modules | role-match |
| `lib/dateRange.ts` (NEW, extracted) | utility (pure lib) | transform | `app/stats/[exerciseId].tsx`'s local `rangeCutoffISO` (extraction target) | exact |
| `components/MetricRow.tsx` (NEW) | component | request-response (presentational) | `components/TemplateRow.tsx` | exact |
| `components/HistoryRow.tsx` (NEW) | component | request-response (presentational) | `app/stats/[exerciseId].tsx`'s inline `recordRow` style block | role-match |
| `app/measurements/index.tsx` (NEW) | route/screen | request-response | `app/stats/[exerciseId].tsx` (focus-reload + list) + `app/(tabs)/index.tsx` (`startButton`/quick-action card) | role-match |
| `app/measurements/[metric].tsx` (NEW) | route/screen | request-response + streaming (chart) | `app/stats/[exerciseId].tsx` | exact |
| `app/measurements/entry.tsx` (NEW) | route/screen (modal-style form) | request-response | active-workout's add-exercise picker overlay (`pickerOverlay`/`pickerHeader`) — not directly read this pass; `NumericKeypad`/`MonthCalendar` usage is the load-bearing part | role-match |
| `app/(tabs)/settings.tsx` (MODIFIED — 2 new rows) | route/screen | request-response | `app/(tabs)/settings.tsx` (itself — existing Units pill row + Tools nav row) | exact (self) |

## Pattern Assignments

### `db/measurements.ts` (service, CRUD)

**Analog:** `db/workouts.ts` + `db/settings.ts`

**Driver-agnostic signature + imports** (`db/workouts.ts:1-29`):
```typescript
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { exercises, sets, workoutExercises, workouts, /* types */ } from './schema';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;
```
Apply identically: `import { bodyMeasurements, metricDefinitions, type BodyMeasurement, type NewBodyMeasurement, type MetricDefinition } from './schema';` and the same `AnyDrizzleDb` type alias — copy verbatim, do not redefine differently per RESEARCH.md Pattern 2.

**Validation-guard convention** (`db/workouts.ts:31-80`):
```typescript
const MAX_NAME_LENGTH = 200;
const MAX_WEIGHT_KG = 1000;

function assertValidName(name: string | null | undefined): string | null { /* trim, length cap, throw */ }
export function assertValidWeightKg(weightKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new Error('Weight must be a non-negative number');
  }
  if (weightKg > MAX_WEIGHT_KG) {
    throw new Error(`Weight must be ${MAX_WEIGHT_KG}kg or less`);
  }
  return weightKg;
}
```
`db/measurements.ts` needs the parallel shape: `assertValidMeasurementValue(value, unitType)` — sane range per unit type (weight: 0–1000kg canonical; length: 0–300cm canonical; percent: 0–100) — mirror the `Number.isFinite` + range-cap + `throw new Error(...)` shape exactly. Custom metric labels reuse `assertValidName`'s `MAX_NAME_LENGTH` convention verbatim.

**Upsert-by-key convention** (`db/settings.ts:33-38`):
```typescript
await db
  .insert(settings)
  .values({ key, value })
  .onConflictDoUpdate({ target: settings.key, set: { value } });
```
Reuse this exact `onConflictDoUpdate` shape for the quick-weigh-in "upsert today's weight reading" behavior (UI-SPEC §1) — but note `body_measurements` has no natural unique key across `(metric, measuredAt)`, so the upsert must first `select` for an existing same-date row (see `db/workouts.ts:246-263`'s `loadLastPerformance` select-then-branch pattern) and either `update` or `insert`, rather than relying on a DB-level `onConflict`.

**Transaction convention for multi-row writes** (`db/workouts.ts:319-344`, `reorderWorkoutExercises`):
```typescript
// Note: both drivers execute synchronously under the hood (resultKind: "sync"),
// so the transaction callback here is intentionally a plain (non-async)
// function using `.run()` — an `async` callback would return before its
// awaited queries actually ran.
db.transaction((tx) => {
  orderedWorkoutExerciseIds.forEach((id, index) => {
    tx.update(workoutExercises).set({ position: index }).where(/* ... */).run();
  });
});
```
Apply for the dated-session save (D-08b): writing several metric rows for one date in one transaction, synchronous callback + `.run()`, exactly as here — do not `await` inside the transaction callback.

**Custom metric creation** (mirrors `db/seed/runSeed.ts:34-47`'s `onConflictDoNothing` shape, applied at runtime instead of seed time):
```typescript
await db
  .insert(metricDefinitions)
  .values({ metricKey, label, unitType, isCustom: true, position })
  .onConflictDoNothing({ target: metricDefinitions.metricKey });
```

---

### `lib/lengthUnits.ts` (utility, transform)

**Analog:** `lib/weightUnits.ts` (verbatim shape, full file — 31 lines, read in one pass)

```typescript
// Source: lib/weightUnits.ts:1-30 — the exact two-function shape to mirror
const KG_TO_LB = 2.20462;

export function kgToDisplay(weightKg: number, unit: 'kg' | 'lb'): number {
  if (unit === 'kg') {
    return Math.round(weightKg * 2) / 2;
  }
  return Math.round(weightKg * KG_TO_LB);
}

export function displayToKg(displayValue: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? displayValue : displayValue / KG_TO_LB;
}
```
`lib/lengthUnits.ts` copies this exact two-function pair renamed: `cmToDisplay(cm, unit: 'cm' | 'in')` (round to 1 decimal cm, or nearest 0.25 in per UI-SPEC "Display precision") / `displayToCm(value, unit)`. Zero React Native / Drizzle imports — pure module, same header-comment convention ("Canonical storage unit... These are the only functions that should convert...").

---

### `lib/measurementSeries.ts` (utility, transform)

**Analog:** `lib/chartSeries.ts` — mirror the **shape** (grouping + point interfaces + sort), explicitly NOT the min/max reduction (RESEARCH.md Pitfall 3).

```typescript
// Source: lib/chartSeries.ts:1-65 — shape to mirror (interfaces, Map-based
// group-by, final sort), NOT the Math.max reduction (no "best" direction
// exists for a body measurement)
export interface ChartSet {
  workoutId: number;
  startedAt: string;
  weightKg: number;
  reps: number;
  type: string;
}
export interface ChartPoint {
  workoutId: number;
  date: string;
  value: number;
}
export function buildChartSeries(sets: ChartSet[], metric: ChartMetric): ChartPoint[] {
  const byWorkout = new Map<number, ChartSet[]>();
  // ...
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
```
`lib/measurementSeries.ts`'s `buildMeasurementSeries` groups by `(metric, date)` via a `Map<string, MeasurementReading>` keyed on `measuredAt`, keeping the **highest-id row** (not `Math.max`/`Math.min` over `value`) per RESEARCH.md's Code Examples section — the exact reducer body is already spec'd there. Copy the `.sort((a, b) => a.date.localeCompare(b.date))` tail verbatim (identical sort call in both modules).

---

### `app/measurements/[metric].tsx` (route/screen)

**Analog:** `app/stats/[exerciseId].tsx` (full file read, 389 lines)

**Imports + font pattern** (lines 21-37, 83):
```typescript
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CartesianChart, Line, Scatter } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';

import { MetricToggle } from '../../components/MetricToggle';
import { db } from '../../db/client';
import { getSetting } from '../../db/settings';
import { kgToDisplay } from '../../lib/weightUnits';
import { theme } from '../../theme';

const font = useFont(require('../../assets/fonts/SpaceMono-Regular.ttf'), 12);
```
Mirror verbatim; add `import { cmToDisplay } from '../../lib/lengthUnits';` and `import { buildMeasurementSeries } from '../../lib/measurementSeries';`.

**Range option + cutoff (extract to `lib/dateRange.ts` per RESEARCH.md Open Question 2)** (lines 39, 64-76):
```typescript
type RangeOption = '3M' | '1Y' | 'All';

function rangeCutoffISO(range: RangeOption): string | null {
  if (range === 'All') return null;
  const cutoff = new Date();
  if (range === '3M') cutoff.setMonth(cutoff.getMonth() - 3);
  else cutoff.setFullYear(cutoff.getFullYear() - 1);
  return cutoff.toISOString();
}
```
Extract this exact function (currently module-private) into `lib/dateRange.ts`, export it, and update BOTH `app/stats/[exerciseId].tsx` and the new `app/measurements/[metric].tsx` to import from there — avoids a second inline copy (RESEARCH.md recommendation, matches the `lib/duration.ts` extraction precedent already in this repo's history).

**Focus-reload + memoized pipeline** (lines 94-146):
```typescript
useFocusEffect(
  useCallback(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [sets, exerciseRow, unitSetting] = await Promise.all([/* loads */]);
      if (cancelled) return;
      setUnit(unitSetting === 'lb' ? 'lb' : 'kg');
      setChartSets(sets);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [exerciseId]),
);

const allPoints = useMemo(() => buildChartSeries(chartSets, metric), [chartSets, metric]);
const rangeFilteredPoints = useMemo(() => {
  const cutoff = rangeCutoffISO(range);
  return cutoff === null ? allPoints : allPoints.filter((p) => p.date >= cutoff);
}, [allPoints, range]);
const displayPoints = useMemo(
  () => rangeFilteredPoints.map((p) => ({ date: p.date, value: kgToDisplay(p.value, unit) })),
  [rangeFilteredPoints, unit],
);
```
Copy this exact three-stage `useMemo` pipeline shape; swap `buildChartSeries` for `buildMeasurementSeries`, and swap the final conversion call based on the metric's `unitType` (`kgToDisplay` / `cmToDisplay` / passthrough for percent).

**Chart JSX + empty/sparse states** (lines 186-207, 255-333 styles):
```typescript
{displayPoints.length === 0 ? (
  <View style={styles.emptyState}>
    <Text style={styles.emptyHeading}>No data yet for {exercise.name}</Text>
    <Text style={styles.emptyBody}>Log a working set for this exercise to start tracking progress.</Text>
  </View>
) : (
  <>
    <View style={styles.chartContainer}>
      <CartesianChart data={displayPoints} xKey="date" yKeys={['value']} axisOptions={{ font }}>
        {({ points }) => (
          <>
            <Line points={points.value} color={theme.colors.accent} strokeWidth={3} />
            <Scatter points={points.value} color={theme.colors.accent} radius={6} />
          </>
        )}
      </CartesianChart>
    </View>
    {displayPoints.length === 1 ? (
      <Text style={styles.sparseCaption}>Log one more workout to see a trend line.</Text>
    ) : null}
  </>
)}
```
Copy near-verbatim; swap copy per UI-SPEC's Copywriting Contract ("No {metric label} logged yet" / "Add a reading to start tracking..." / "Log one more reading to see a trend line."). `chartContainer` (min-height 240, `surface` bg, `theme.radius.lg`) style block is copy-paste identical (lines 301-308).

**Appbar + back-nav pattern** (lines 168-173, 276-294):
```typescript
<View style={[styles.appbar, { paddingTop: insets.top + theme.spacing.sm }]}>
  <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
    <Text style={styles.backText}>‹ Stats</Text>
  </Pressable>
</View>
```
Copy verbatim, changing label text to `‹ Body Measurements`.

---

### `app/measurements/index.tsx` (route/screen)

**Analogs:** `app/stats/[exerciseId].tsx` (focus-reload shape, above) + `app/(tabs)/settings.tsx` (below, for the quick-weigh-in card's persisted-state read/write pattern) + `components/TemplateRow.tsx` (for `MetricRow`).

**Focus-reload settings read** (`app/(tabs)/settings.tsx:41-67`):
```typescript
useFocusEffect(
  useCallback(() => {
    let cancelled = false;
    (async () => {
      const [unitsValue, restValue] = await Promise.all([
        getSetting(db, 'units'),
        getSetting(db, 'default_rest_seconds'),
      ]);
      if (cancelled) return;
      setUnits(unitsValue === 'lb' ? 'lb' : 'kg');
      // ... typed fallback per RESEARCH.md A4 convention
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []),
);
```
Reuse this exact `Promise.all` + cancelled-guard shape for loading `units`, `length_units`, `metricDefinitions`, and `loadLatestPerMetric` together on the Measurements index screen.

---

### `components/MetricRow.tsx` (component, presentational)

**Analog:** `components/TemplateRow.tsx` (full file, 96 lines)

```typescript
// Source: components/TemplateRow.tsx:19-51 — exact anatomy to mirror
export function TemplateRow({ label, exerciseCount, onPress, onEdit }: TemplateRowProps) {
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={`${label}, ${exerciseLabel}`}>
      <Text style={styles.icon}>📋</Text>
      <View style={styles.textColumn}>
        <Text style={styles.name} numberOfLines={1}>{label}</Text>
        <Text style={styles.secondary} numberOfLines={1}>{exerciseLabel}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}
```
`MetricRow` copies this leading-glyph + text-column + trailing-chevron anatomy verbatim: emoji (from the Metric Icon Registry) in place of `📋`, metric label as primary line, `"{value}{unit} · {relative date}"` / `"No data yet"` as the secondary caption line. The `row`/`icon`/`textColumn`/`name`/`secondary`/`chevron` style block (lines 53-95) is copy-paste identical — same `theme.spacing.lg` padding, hairline `theme.colors.border` bottom-border, 26px icon column width.

---

### `app/measurements/entry.tsx` — `NumericKeypad` usage

**Analog:** `components/NumericKeypad.tsx` (props contract, lines 1-33)

```typescript
interface NumericKeypadProps {
  visible: boolean;
  label: string;
  initialValue: number;
  allowDecimal?: boolean;
  onDone: (value: number) => void;
  onCancel: () => void;
}
```
Reuse verbatim — `label` becomes `"{Metric label} ({unit})"` per UI-SPEC, `allowDecimal: true` for all metric types, `onDone` writes the parsed value through `db/measurements.ts`'s insert/update (never a per-keystroke DB write — the header comment's stated anti-pattern applies identically here).

---

### `app/(tabs)/settings.tsx` (MODIFIED)

**Analog:** the file itself — existing `Units` section (lines 108-114) and `Tools` nav-row section (lines 162-178).

**Nav row pattern** (lines 164-177):
```typescript
<Pressable onPress={() => router.push('/tools/plate-calculator')} accessibilityRole="button" style={styles.toolRow}>
  <Text style={styles.toolRowText}>Plate calculator</Text>
</Pressable>
```
Add a `"Body Measurements"` row with this exact shape → `router.push('/measurements')`.

**Two-pill unit-row pattern** (lines 108-114, `UnitPill` component lines 185-196):
```typescript
<View style={styles.unitRow}>
  <UnitPill label="kg" active={units === 'kg'} onPress={() => void handleSelectUnit('kg')} />
  <UnitPill label="lb" active={units === 'lb'} onPress={() => void handleSelectUnit('lb')} />
</View>
```
Add a second, fully independent settings row using the identical `UnitPill`/`pill`/`pillActive`/`pillIdle`/`pillLabel*` styles for `cm`/`in`, backed by a new `length_units` key — **never** derive from or sync with the existing `units` key (D-04, matches this file's own header-comment precedent about `bar_weight_kg`/`bar_weight_lb` being independently stored, lines 18-21).

---

## Shared Patterns

### Driver-agnostic DB module signature
**Source:** `db/settings.ts:14-18`, `db/workouts.ts:13-29`
**Apply to:** `db/measurements.ts` (all exported functions)
```typescript
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;
export async function fnName(db: AnyDrizzleDb, /* ...args */): Promise<ReturnType> { /* ... */ }
```
No exceptions — every function in `db/measurements.ts` must take `db: AnyDrizzleDb` as its first param so the same module runs against both `drizzle-orm/expo-sqlite` (device) and `drizzle-orm/better-sqlite3` (vitest).

### Numeric input validation guards
**Source:** `db/workouts.ts:58-80` (`assertValidWeightKg`, `assertValidReps`)
**Apply to:** `db/measurements.ts` (every insert/update path)
```typescript
export function assertValidWeightKg(weightKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new Error('Weight must be a non-negative number');
  }
  if (weightKg > MAX_WEIGHT_KG) {
    throw new Error(`Weight must be ${MAX_WEIGHT_KG}kg or less`);
  }
  return weightKg;
}
```
Write a parallel `assertValidMeasurementValue(value, unitType)` following this exact `Number.isFinite` + non-negative + upper-bound-cap + `throw new Error(...)` shape.

### Seeded-plus-custom table (additive, `onConflictDoNothing`)
**Source:** `db/seed/runSeed.ts:34-47`, `db/schema.ts:15-39` (`exercises.seedId`/`isCustom`)
**Apply to:** `db/schema.ts` (`metricDefinitions`), `db/seed/runSeed.ts` (seed loop), `db/seed/seedVersion.ts` (bump)
```typescript
for (const exercise of curatedExercises) {
  await db.insert(exercises).values({ /* ... */ seedId: exercise.seedId, isCustom: false, archived: false })
    .onConflictDoNothing({ target: exercises.seedId });
}
```
`metricDefinitions` mirrors this exactly: `metricKey` plays `seedId`'s role as the unique conflict target, `isCustom` false for the 15 built-ins / true for user-added rows.

### Settings key/value upsert
**Source:** `db/settings.ts:33-38`
**Apply to:** the new `length_units` key, read/written via the existing `getSetting`/`setSetting` — no new table needed for this scalar preference.
```typescript
await db.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
```

### Chart chrome (victory-native XL)
**Source:** `app/stats/[exerciseId].tsx:193-207`
**Apply to:** `app/measurements/[metric].tsx`
```typescript
<CartesianChart data={displayPoints} xKey="date" yKeys={['value']} axisOptions={{ font }}>
  {({ points }) => (
    <>
      <Line points={points.value} color={theme.colors.accent} strokeWidth={3} />
      <Scatter points={points.value} color={theme.colors.accent} radius={6} />
    </>
  )}
</CartesianChart>
```

### Anti-pattern reminder (do NOT copy)
`lib/chartSeries.ts`'s `Math.max` best-of-session reduction must NOT be copied into `lib/measurementSeries.ts` — there is no "best" body-measurement value. Also do not aggregate in SQL (`db/stats.ts`'s stated house rule) — fetch raw rows in `db/measurements.ts`, reduce in `lib/measurementSeries.ts`.

## No Analog Found

None — every file in this phase's scope has at least a role-match analog already in the codebase (this phase is explicitly designed to reuse Phase 1-4 patterns per RESEARCH.md's "Don't Hand-Roll" section).

## Metadata

**Analog search scope:** `db/`, `lib/`, `app/stats/`, `app/(tabs)/`, `components/`
**Files read directly:** `db/workouts.ts`, `db/settings.ts`, `db/schema.ts`, `db/seed/runSeed.ts`, `db/seed/seedVersion.ts`, `db/schema.test.ts`, `db/migrations.test.ts`, `lib/weightUnits.ts`, `lib/chartSeries.ts`, `components/MetricToggle.tsx`, `components/TemplateRow.tsx`, `components/NumericKeypad.tsx`, `app/stats/[exerciseId].tsx`, `app/(tabs)/settings.tsx`
**Pattern extraction date:** 2026-07-23
