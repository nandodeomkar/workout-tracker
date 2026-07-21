// Crash-safe workout/set data layer (LOG-01/LOG-02/D-06/D-15).
//
// D-15: SQLite is the sole source of truth for an in-progress workout — the
// UI holds only a pointer (activeWorkoutId) into this data, never a second
// copy of session state. Every function here is proven at the DB-layer
// (better-sqlite3, in-memory) with a fresh Drizzle instance re-reading data
// after a write, simulating a crash + cold restart.
//
// Security (T-02-03): Drizzle's parameterized query builder only — every
// predicate below is built via Drizzle's query-builder helpers, never a
// string concatenated from user input.

import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  sets,
  workoutExercises,
  workouts,
  type NewSet,
  type Set,
  type Workout,
  type WorkoutExercise,
} from './schema';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

/** Reasonable upper bound on free-text input (ASVS V5) before writing to SQLite. */
const MAX_NAME_LENGTH = 200;
/** Sane upper bound on a single set's weight (kg) — well above any real lift. */
const MAX_WEIGHT_KG = 1000;
/** Sane upper bound on a single set's rep count. */
const MAX_REPS = 1000;

function assertValidName(name: string | null | undefined): string | null {
  if (name == null) {
    return null;
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Workout name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
  return trimmed;
}

/**
 * Rejects negative/NaN/non-finite weights and caps at a sane upper bound
 * (T-02-04 / ASVS V5) before any `sets` insert or update.
 */
export function assertValidWeightKg(weightKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new Error('Weight must be a non-negative number');
  }
  if (weightKg > MAX_WEIGHT_KG) {
    throw new Error(`Weight must be ${MAX_WEIGHT_KG}kg or less`);
  }
  return weightKg;
}

/**
 * Rejects negative/NaN/non-integer reps and caps at a sane upper bound
 * (T-02-04 / ASVS V5) before any `sets` insert or update.
 */
export function assertValidReps(reps: number): number {
  if (!Number.isInteger(reps) || reps < 0) {
    throw new Error('Reps must be a non-negative integer');
  }
  if (reps > MAX_REPS) {
    throw new Error(`Reps must be ${MAX_REPS} or fewer`);
  }
  return reps;
}

export interface StartWorkoutInput {
  name?: string | null;
  templateId?: number | null;
}

/**
 * Starts a new workout: `startedAt` = now, `finishedAt` = null (LOG-01 start
 * path, D-15). This is the crash-safe session anchor — everything else in
 * this module hangs off `workoutId`.
 */
export async function startWorkout(db: AnyDrizzleDb, input: StartWorkoutInput = {}): Promise<Workout> {
  const name = assertValidName(input.name);

  const [created] = await db
    .insert(workouts)
    .values({
      name,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      templateId: input.templateId ?? null,
    })
    .returning();

  return created;
}

/**
 * Finds the most recent unfinished workout, if any (LOG-02/D-15 cold-start
 * resume). Returns `undefined` when no workout is in progress.
 */
export async function findResumableWorkout(db: AnyDrizzleDb): Promise<Workout | undefined> {
  const [row] = await db
    .select()
    .from(workouts)
    .where(isNull(workouts.finishedAt))
    .orderBy(desc(workouts.startedAt))
    .limit(1);
  return row;
}

/**
 * Adds an exercise to a workout at the given position (LOG-01 add-exercise,
 * D-16 add).
 */
export async function addWorkoutExercise(
  db: AnyDrizzleDb,
  workoutId: number,
  exerciseId: number,
  position: number,
): Promise<WorkoutExercise> {
  const [created] = await db
    .insert(workoutExercises)
    .values({ workoutId, exerciseId, position })
    .returning();

  return created;
}

export interface InsertSetInput {
  workoutExerciseId: number;
  setNumber: number;
  weightKg: number;
  reps: number;
  type?: NewSet['type'];
  rpe?: number | null;
}

/**
 * The crash-safe write: one committed row per ✓ tap (LOG-02/D-15/D-01).
 * Validates weight/reps before insert; `completedAt` is stamped at write
 * time so history/PR queries never need to guess when a set happened.
 */
export async function insertSet(db: AnyDrizzleDb, input: InsertSetInput): Promise<Set> {
  const weightKg = assertValidWeightKg(input.weightKg);
  const reps = assertValidReps(input.reps);

  const [created] = await db
    .insert(sets)
    .values({
      workoutExerciseId: input.workoutExerciseId,
      setNumber: input.setNumber,
      weightKg,
      reps,
      type: input.type ?? 'normal',
      rpe: input.rpe ?? null,
      completedAt: new Date().toISOString(),
    })
    .returning();

  return created;
}

export interface UpdateSetInput {
  weightKg?: number;
  reps?: number;
  type?: NewSet['type'];
}

/**
 * Edit-mode field writes for an already-completed set (D-13/HIST-02).
 */
export async function updateSet(db: AnyDrizzleDb, setId: number, patch: UpdateSetInput): Promise<Set> {
  const values: Partial<NewSet> = {};
  if (patch.weightKg !== undefined) {
    values.weightKg = assertValidWeightKg(patch.weightKg);
  }
  if (patch.reps !== undefined) {
    values.reps = assertValidReps(patch.reps);
  }
  if (patch.type !== undefined) {
    values.type = patch.type;
  }

  const [updated] = await db.update(sets).set(values).where(eq(sets.id, setId)).returning();

  return updated;
}

/**
 * Finds the most recent FINISHED performance of `exerciseId` (across all
 * history) and returns its sets, ordered by set number (LOG-01/D-06
 * pre-fill). An in-progress workout's own rows for this exercise are never
 * eligible, so a card never pre-fills from itself. Returns `[]` if the
 * exercise has never been performed.
 */
export async function loadLastPerformance(db: AnyDrizzleDb, exerciseId: number): Promise<Set[]> {
  const [latest] = await db
    .select({ weId: workoutExercises.id })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(and(eq(workoutExercises.exerciseId, exerciseId), isNotNull(workouts.finishedAt)))
    .orderBy(desc(workouts.startedAt), desc(workoutExercises.id));

  if (!latest) {
    return [];
  }

  return db
    .select()
    .from(sets)
    .where(eq(sets.workoutExerciseId, latest.weId))
    .orderBy(asc(sets.setNumber));
}

export interface WorkoutExerciseDetail {
  workoutExercise: WorkoutExercise;
  sets: Set[];
}

export interface WorkoutDetail {
  workout: Workout;
  exercises: WorkoutExerciseDetail[];
}

/**
 * Reads one workout with its ordered workout_exercises (by position) and
 * each one's sets (by setNumber) — used by the active-workout screen and
 * history detail. Returns `undefined` if the workout does not exist.
 */
export async function loadWorkoutDetail(db: AnyDrizzleDb, workoutId: number): Promise<WorkoutDetail | undefined> {
  const [workout] = await db.select().from(workouts).where(eq(workouts.id, workoutId));
  if (!workout) {
    return undefined;
  }

  const weRows = await db
    .select()
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId))
    .orderBy(asc(workoutExercises.position));

  const exerciseDetails: WorkoutExerciseDetail[] = [];
  for (const workoutExercise of weRows) {
    const setRows = await db
      .select()
      .from(sets)
      .where(eq(sets.workoutExerciseId, workoutExercise.id))
      .orderBy(asc(sets.setNumber));
    exerciseDetails.push({ workoutExercise, sets: setRows });
  }

  return { workout, exercises: exerciseDetails };
}
