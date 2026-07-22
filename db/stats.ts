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

import { and, asc, eq, gte, isNotNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { exercises, sets, workoutExercises, workouts } from './schema';
import type { ChartSet } from '../lib/chartSeries';
import type { WeeklyVolumeSet } from '../lib/weeklyVolume';

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

/**
 * Fetches non-warmup-eligible sets (warmup rows ARE included — filtering is
 * lib/weeklyVolume.ts#buildWeeklyVolume's job, not this query's) from
 * FINISHED workouts started on/after `sinceIso`, each row joined to its
 * exercise's `muscle_group` (STAT-02/D-13). `sinceIso` is a JS-computed
 * bound parameter via Drizzle's `gte`, never string-interpolated (T-04-02).
 * Ordered ascending by workout start date. Returns `[]` on an empty DB or
 * when nothing falls in the window.
 */
export async function loadWeeklyVolumeSets(db: AnyDrizzleDb, sinceIso: string): Promise<WeeklyVolumeSet[]> {
  return db
    .select({
      startedAt: workouts.startedAt,
      weightKg: sets.weightKg,
      reps: sets.reps,
      type: sets.type,
      muscleGroup: exercises.muscleGroup,
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(sets.workoutExerciseId, workoutExercises.id))
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(and(isNotNull(workouts.finishedAt), gte(workouts.startedAt, sinceIso)))
    .orderBy(asc(workouts.startedAt));
}

export interface TrainedExercise {
  id: number;
  name: string;
  muscleGroup: string;
}

/**
 * Distinct exercises with at least one set logged in a FINISHED workout
 * (feeds the Section C exercise picker, D-03a — never-trained exercises must
 * not appear). Dedup happens in JS (an exercise trained across many
 * workouts/sets would otherwise repeat once per matching row); sort is
 * case-insensitive by name via JS `localeCompare`, mirroring
 * `db/templates.ts#loadFolderNames`'s precedent so this query stays
 * identical across both Drizzle drivers this module supports. Returns `[]`
 * on an empty DB.
 */
export async function loadExercisesWithSets(db: AnyDrizzleDb): Promise<TrainedExercise[]> {
  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      muscleGroup: exercises.muscleGroup,
    })
    .from(sets)
    .innerJoin(workoutExercises, eq(sets.workoutExerciseId, workoutExercises.id))
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .innerJoin(exercises, eq(workoutExercises.exerciseId, exercises.id))
    .where(isNotNull(workouts.finishedAt));

  const byId = new Map<number, TrainedExercise>();
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, row);
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}
