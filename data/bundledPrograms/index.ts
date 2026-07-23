// Bundled program definitions (PROG-04/D-14) — static, read-only app data.
//
// These JSON files are imported as modules (resolveJsonModule, native to
// Metro + vitest per tsconfig.base) and typed as BundledProgramDefinition
// (db/programs.ts) — NEVER as Program/Template DB rows. This keeps
// materializeBundledProgram's clone-only contract (Pitfall 4) type-checked:
// the only way to turn one of these into DB rows is through
// materializeBundledProgram's fresh inserts, never a direct write.

import { inArray } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { exercises } from '../../db/schema';
import type { BundledProgramDefinition } from '../../db/programs';
import linear5x5Raw from './linear5x5.json';
import percentWaveRaw from './percentWave.json';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

/** "Linear 5x5 (3-Day)" — generic full-body linear-progression program (D-14). */
export const linear5x5: BundledProgramDefinition = linear5x5Raw as BundledProgramDefinition;

/** "Percent-Based Wave (4-Day)" — generic 4-lift/4-week %TM wave program (D-14). */
export const percentWave: BundledProgramDefinition = percentWaveRaw as BundledProgramDefinition;

/** All bundled programs shipped with the app (D-14) — never mutated, never seeded into the DB (D-15). */
export const BUNDLED_PROGRAMS: readonly BundledProgramDefinition[] = [linear5x5, percentWave];

/**
 * Stable seed_ids for the five compound lifts these bundled programs
 * reference (verified against db/seed/exercises.seed.json — Standard Stack
 * → Bundled program exercise-seed mapping, 06-RESEARCH.md).
 */
export const LIFT_SEED_IDS = {
  squat: 'barbell-squat',
  bench: 'barbell-bench-press-medium-grip',
  deadlift: 'barbell-deadlift',
  overheadPress: 'standing-military-press',
  row: 'bent-over-barbell-row',
} as const;

/**
 * Resolves every distinct exercise seed_id referenced by a bundle against
 * this install's exercise library, returning the seed_id -> exercises.id
 * map materializeBundledProgram consumes (Pitfall 6). A seed_id with no
 * matching row is simply absent from the returned map — the caller
 * (materializeBundledProgram) is responsible for throwing on a missing
 * mapping, not this resolver.
 */
export async function resolveExerciseSeedIds(
  db: AnyDrizzleDb,
  bundle: BundledProgramDefinition,
): Promise<Map<string, number>> {
  const seedIds = [...new Set(bundle.days.flatMap((day) => day.exercises.map((exercise) => exercise.seedId)))];
  if (seedIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({ id: exercises.id, seedId: exercises.seedId })
    .from(exercises)
    .where(inArray(exercises.seedId, seedIds));

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.seedId != null) {
      map.set(row.seedId, row.id);
    }
  }
  return map;
}
