// Silent first-launch seed (D-16: no progress UI). Gated by a `settings`
// row (key='seed_version') so re-runs are cheap no-ops, and additive so
// app updates never overwrite user-edited rows (D-04/D-10) — inserts use
// `onConflictDoNothing` targeting the stable `seed_id` column.
//
// Loads the curated ~400-500-row exercises.seed.json produced by
// scripts/curate-exercises.ts (Plan 02) — every row already carries
// exactly one valid muscleGroup and equipment value from the fixed
// taxonomy (constants/taxonomy.ts).
//
// Security (T-1-02): parameterized query builder only — no raw SQL string
// concatenation anywhere in this file.

import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { BUILT_IN_METRICS } from '../../lib/measurementMetrics';
import { exercises, metricDefinitions, settings } from '../schema';
import curatedExercises from './exercises.seed.json';
import { CURRENT_SEED_VERSION } from './seedVersion';

const SEED_VERSION_KEY = 'seed_version';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

export async function runSeedIfNeeded(db: AnyDrizzleDb): Promise<void> {
  const rows = await db.select().from(settings).where(eq(settings.key, SEED_VERSION_KEY));
  const row = rows[0];

  const installedVersion = row ? Number(row.value) : 0;
  if (installedVersion >= CURRENT_SEED_VERSION) {
    return;
  }

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

  for (const metric of BUILT_IN_METRICS) {
    await db
      .insert(metricDefinitions)
      .values({
        metricKey: metric.metricKey,
        label: metric.label,
        unitType: metric.unitType,
        isCustom: false,
        position: metric.position,
      })
      .onConflictDoNothing({ target: metricDefinitions.metricKey });
  }

  await db
    .insert(settings)
    .values({ key: SEED_VERSION_KEY, value: String(CURRENT_SEED_VERSION) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: String(CURRENT_SEED_VERSION) },
    });
}
