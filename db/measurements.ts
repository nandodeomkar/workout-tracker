// Validated, driver-agnostic body-measurement CRUD + history data layer
// (MEAS-01/MEAS-02, D-06/D-09/D-12). Every screen in Plans 03-05 reads and
// writes exclusively through this module — no raw SQL, no unvalidated
// writes.
//
// Security (T-05-01..T-05-04): Drizzle's parameterized query builder only —
// never a string-concatenated/interpolated `sql\`\`` template. Every numeric
// value and date string is guarded (assertValidMeasurementValue /
// assertValidMeasuredAt) before it reaches an insert/update.
//
// House rule (mirrors db/stats.ts): do NOT aggregate/MAX() in SQL here —
// fetch raw rows and let lib/measurementSeries.ts reduce them in JS.

import { and, asc, eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  bodyMeasurements,
  metricDefinitions,
  type BodyMeasurement,
  type MetricDefinition,
} from './schema';
import type { UnitType } from '../lib/measurementMetrics';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

/** Sane upper bound on a body-weight reading (kg), well above any real body weight. */
const MAX_MEASUREMENT_WEIGHT_KG = 1000;
/** Sane upper bound on a body-part length reading (cm). */
const MAX_LENGTH_CM = 300;
/** A percent-type reading (e.g. body-fat %) can never exceed 100. */
const MAX_PERCENT = 100;
/** Reasonable upper bound on a custom metric's free-text label (ASVS V5). */
const MAX_LABEL_LENGTH = 200;

/**
 * Rejects non-finite/negative measurement values and caps them at a sane
 * upper bound per unit type (T-05-01/ASVS V5) before any insert/update.
 */
export function assertValidMeasurementValue(value: number, unitType: UnitType): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Measurement value must be a non-negative number');
  }

  const max =
    unitType === 'weight' ? MAX_MEASUREMENT_WEIGHT_KG : unitType === 'length' ? MAX_LENGTH_CM : MAX_PERCENT;

  if (value > max) {
    throw new Error(`Measurement value must be ${max} or less`);
  }

  return value;
}

/**
 * Rejects any string that isn't a plain `YYYY-MM-DD` date, and rejects any
 * date later than today (D-09: never-future) before any insert/update
 * (T-05-02/ASVS V5). Date-only (no time component) — see 05-RESEARCH.md
 * Pitfall 5: two same-day readings must compare equal for the
 * latest-reading-per-date reduction to work.
 */
export function assertValidMeasuredAt(measuredAt: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredAt)) {
    throw new Error('Measured date must be in YYYY-MM-DD format');
  }

  const today = new Date().toISOString().slice(0, 10);
  if (measuredAt > today) {
    throw new Error('Measured date cannot be in the future');
  }

  return measuredAt;
}

/** Trims and length-caps a custom metric's label (mirrors db/workouts.ts#assertValidName, T-05-03). */
function assertValidLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    throw new Error('Metric label must not be empty');
  }
  if (trimmed.length > MAX_LABEL_LENGTH) {
    throw new Error(`Metric label must be ${MAX_LABEL_LENGTH} characters or fewer`);
  }
  return trimmed;
}

/**
 * All metric definitions (built-in + custom), ordered by their display
 * position (MEAS-01/MEAS-02) — the single source both the entry and graph
 * screens read from.
 */
export async function loadMetricDefinitions(db: AnyDrizzleDb): Promise<MetricDefinition[]> {
  return db.select().from(metricDefinitions).orderBy(asc(metricDefinitions.position));
}

/**
 * The single most recent reading for every metric that has at least one
 * reading (D-07 "latest value" list). Fetches all rows and reduces in JS
 * (house rule: no SQL aggregation) — "most recent" means highest id when
 * more than one row shares the same `measuredAt` (mirrors
 * lib/measurementSeries.ts's latest-id-wins convention, D-12).
 */
export async function loadLatestPerMetric(db: AnyDrizzleDb): Promise<BodyMeasurement[]> {
  const rows = await db.select().from(bodyMeasurements);

  const latestByMetric = new Map<string, BodyMeasurement>();
  for (const row of rows) {
    const existing = latestByMetric.get(row.metric);
    if (
      !existing ||
      row.measuredAt > existing.measuredAt ||
      (row.measuredAt === existing.measuredAt && row.id > existing.id)
    ) {
      latestByMetric.set(row.metric, row);
    }
  }

  return [...latestByMetric.values()];
}

/**
 * All readings for one metric, ordered by date then id ascending (MEAS-02)
 * so lib/measurementSeries.ts#buildMeasurementSeries can build a trend
 * without re-sorting.
 */
export async function loadReadingsForMetric(db: AnyDrizzleDb, metric: string): Promise<BodyMeasurement[]> {
  return db
    .select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.metric, metric))
    .orderBy(asc(bodyMeasurements.measuredAt), asc(bodyMeasurements.id));
}

export interface ReadingInput {
  metric: string;
  value: number;
  measuredAt: string;
  unitType: UnitType;
}

/** Inserts a new dated reading (guarded), returning its new id (MEAS-01). */
export async function insertReading(db: AnyDrizzleDb, input: ReadingInput): Promise<BodyMeasurement> {
  const value = assertValidMeasurementValue(input.value, input.unitType);
  const measuredAt = assertValidMeasuredAt(input.measuredAt);

  const [created] = await db
    .insert(bodyMeasurements)
    .values({ metric: input.metric, value, measuredAt })
    .returning();

  return created;
}

export interface UpdateReadingInput {
  value: number;
  measuredAt: string;
  unitType: UnitType;
}

/** Edits an existing reading's value/date in place (D-09 full correction control). */
export async function updateReading(
  db: AnyDrizzleDb,
  id: number,
  patch: UpdateReadingInput,
): Promise<BodyMeasurement> {
  const value = assertValidMeasurementValue(patch.value, patch.unitType);
  const measuredAt = assertValidMeasuredAt(patch.measuredAt);

  const [updated] = await db
    .update(bodyMeasurements)
    .set({ value, measuredAt })
    .where(eq(bodyMeasurements.id, id))
    .returning();

  return updated;
}

/** Deletes a single reading (D-09 full correction control). */
export async function deleteReading(db: AnyDrizzleDb, id: number): Promise<void> {
  await db.delete(bodyMeasurements).where(eq(bodyMeasurements.id, id));
}

/**
 * Updates the existing (metric, date) reading if one already exists, else
 * inserts a new row — quick weigh-in / dated-session correction semantics
 * (D-09). Select-then-branch, mirroring db/workouts.ts#loadLastPerformance's
 * pattern, since `body_measurements` has no DB-level unique key across
 * (metric, measuredAt) to `onConflict` against.
 */
export async function upsertReadingForDate(db: AnyDrizzleDb, input: ReadingInput): Promise<BodyMeasurement> {
  const value = assertValidMeasurementValue(input.value, input.unitType);
  const measuredAt = assertValidMeasuredAt(input.measuredAt);

  const [existing] = await db
    .select()
    .from(bodyMeasurements)
    .where(and(eq(bodyMeasurements.metric, input.metric), eq(bodyMeasurements.measuredAt, measuredAt)));

  if (existing) {
    const [updated] = await db
      .update(bodyMeasurements)
      .set({ value })
      .where(eq(bodyMeasurements.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(bodyMeasurements)
    .values({ metric: input.metric, value, measuredAt })
    .returning();

  return created;
}

export interface DatedEntry {
  metric: string;
  value: number;
  unitType: UnitType;
}

/**
 * Saves several metrics for one date in a single transaction (D-08b dated
 * session: weight + any body parts entered together). Each entry goes
 * through the same upsert-by-date logic as `upsertReadingForDate`. Both the
 * better-sqlite3 and expo-sqlite Drizzle drivers execute synchronously
 * under the hood (`resultKind: "sync"`), so the transaction callback is
 * intentionally a plain (non-async) function using `.run()` — mirrors
 * db/workouts.ts#reorderWorkoutExercises's documented convention.
 */
export async function insertReadingsForDate(
  db: AnyDrizzleDb,
  measuredAt: string,
  entries: DatedEntry[],
): Promise<void> {
  const validatedMeasuredAt = assertValidMeasuredAt(measuredAt);

  // Pre-fetch existing same-date rows (keyed by metric) OUTSIDE the
  // transaction — mirrors db/workouts.ts#reorderWorkoutExercises's
  // select-then-branch convention, keeping the transaction callback itself
  // limited to synchronous `.run()` writes only.
  const existingRows = await db
    .select()
    .from(bodyMeasurements)
    .where(eq(bodyMeasurements.measuredAt, validatedMeasuredAt));
  const existingByMetric = new Map(existingRows.map((row) => [row.metric, row]));

  const validatedEntries = entries.map((entry) => ({
    metric: entry.metric,
    value: assertValidMeasurementValue(entry.value, entry.unitType),
  }));

  db.transaction((tx) => {
    for (const entry of validatedEntries) {
      const existing = existingByMetric.get(entry.metric);
      if (existing) {
        tx.update(bodyMeasurements).set({ value: entry.value }).where(eq(bodyMeasurements.id, existing.id)).run();
      } else {
        tx.insert(bodyMeasurements)
          .values({ metric: entry.metric, value: entry.value, measuredAt: validatedMeasuredAt })
          .run();
      }
    }
  });
}

export interface CreateCustomMetricInput {
  metricKey: string;
  label: string;
  unitType: UnitType;
}

/**
 * Inserts a new user-created custom metric (D-02/D-06) at
 * `position = max(existing) + 1`, `isCustom = true`. A no-op on a duplicate
 * `metricKey` (`onConflictDoNothing`), mirroring the built-in seed's
 * additive-insert convention.
 */
export async function createCustomMetric(db: AnyDrizzleDb, input: CreateCustomMetricInput): Promise<void> {
  const label = assertValidLabel(input.label);

  const existingDefinitions = await loadMetricDefinitions(db);
  const nextPosition =
    existingDefinitions.length === 0
      ? 0
      : Math.max(...existingDefinitions.map((definition) => definition.position)) + 1;

  await db
    .insert(metricDefinitions)
    .values({
      metricKey: input.metricKey,
      label,
      unitType: input.unitType,
      isCustom: true,
      position: nextPosition,
    })
    .onConflictDoNothing({ target: metricDefinitions.metricKey });
}
