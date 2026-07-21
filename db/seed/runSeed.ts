// Silent first-launch seed (D-16: no progress UI). Gated by a `settings`
// row (key='seed_version') so re-runs are cheap no-ops, and additive so
// app updates never overwrite user-edited rows (D-04/D-10) — inserts use
// `onConflictDoNothing` targeting the stable `seed_id` column.
//
// This is a STUB seed (~5 hardcoded exercises). Plan 02 replaces it with
// the curated ~400-500-row JSON from free-exercise-db.
//
// Security (T-1-02): parameterized query builder only — no raw SQL string
// concatenation anywhere in this file.

import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { exercises, settings } from '../schema';
import { CURRENT_SEED_VERSION } from './seedVersion';

const SEED_VERSION_KEY = 'seed_version';

interface StubExercise {
  seedId: string;
  name: string;
  muscleGroup: string;
  equipment: string;
}

const STUB_EXERCISES: StubExercise[] = [
  { seedId: 'barbell-bench-press', name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { seedId: 'barbell-back-squat', name: 'Barbell Back Squat', muscleGroup: 'Quads', equipment: 'Barbell' },
  { seedId: 'conventional-deadlift', name: 'Conventional Deadlift', muscleGroup: 'Back', equipment: 'Barbell' },
  { seedId: 'pull-up', name: 'Pull-Up', muscleGroup: 'Back', equipment: 'Bodyweight' },
  { seedId: 'dumbbell-shoulder-press', name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell' },
];

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

export async function runSeedIfNeeded(db: AnyDrizzleDb): Promise<void> {
  const rows = await db.select().from(settings).where(eq(settings.key, SEED_VERSION_KEY));
  const row = rows[0];

  const installedVersion = row ? Number(row.value) : 0;
  if (installedVersion >= CURRENT_SEED_VERSION) {
    return;
  }

  for (const exercise of STUB_EXERCISES) {
    await db
      .insert(exercises)
      .values({
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        equipment: exercise.equipment,
        seedId: exercise.seedId,
        isCustom: false,
        archived: false,
      })
      .onConflictDoNothing({ target: exercises.seedId });
  }

  await db
    .insert(settings)
    .values({ key: SEED_VERSION_KEY, value: String(CURRENT_SEED_VERSION) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: String(CURRENT_SEED_VERSION) },
    });
}

