// Query layer: archived-visible exercise library, ordered A-Z (D-11).
//
// Security (T-1-04): Drizzle's parameterized query builder only — the
// `archived` predicate is a static boolean equality, never a string built
// from user input. The live search string never reaches SQL at all (it is
// filtered in memory by lib/exerciseFilter.ts).

import { asc, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { exercises, type Exercise } from './schema';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

/**
 * Returns all non-archived exercises, ordered A-Z by name (case-insensitive).
 */
export async function loadActiveExercises(db: AnyDrizzleDb): Promise<Exercise[]> {
  return db
    .select()
    .from(exercises)
    .where(eq(exercises.archived, false))
    .orderBy(asc(sql`lower(${exercises.name})`));
}
