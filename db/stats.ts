// Stats query layer (STAT-01). Read-only, parameterized Drizzle queries
// feeding the pure lib/chartSeries.ts reduction. Follows db/workouts.ts's
// driver-agnostic AnyDrizzleDb convention verbatim so the same functions run
// against both drizzle-orm/expo-sqlite (device) and drizzle-orm/better-sqlite3
// (vitest via db/test/fixture.ts).
//
// Security (T-04-02): every predicate uses Drizzle's parameterized builder
// helpers (eq/and/isNotNull) — exerciseId is a Number(param), never
// string-concatenated into raw SQL (mirrors loadPriorBests/loadWorkoutsInMonth).
//
// T-04-04: isNotNull(workouts.finishedAt) excludes in-progress workouts from
// ever surfacing in historical charts (parity with loadWorkoutHistory).
//
// Do NOT aggregate/MAX() in SQL here (Pitfall 4) — fetch raw rows and let
// lib/chartSeries.ts#buildChartSeries reduce them in JS, calling the shared
// estimate1RM/workingSetVolume formulas.

import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { sets, workoutExercises, workouts } from './schema';
import type { ChartSet } from '../lib/chartSeries';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

/**
 * Fetches one exercise's sets from FINISHED workouts only, ordered by
 * workout start date ascending (D-07 requires chronological input to
 * buildChartSeries). Warmup rows ARE included — exclusion is
 * buildChartSeries's job, not this query's (parity with the "reduce in JS,
 * never aggregate in SQL" rule). Returns `[]` if the exercise has no
 * finished sets.
 */
export async function loadExerciseChartSets(db: AnyDrizzleDb, exerciseId: number): Promise<ChartSet[]> {
  return db
    .select({
      workoutId: workoutExercises.workoutId,
      startedAt: workouts.startedAt,
      weightKg: sets.weightKg,
      reps: sets.reps,
      type: sets.type,
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(sets.workoutExerciseId, workoutExercises.id))
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(and(eq(workoutExercises.exerciseId, exerciseId), isNotNull(workouts.finishedAt)))
    .orderBy(asc(workouts.startedAt));
}
