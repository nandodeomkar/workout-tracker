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

import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt } from 'drizzle-orm';
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
import { estimate1RM } from '../lib/estimate1RM';
import { workingSetVolume } from '../lib/volume';

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

/**
 * Reorders the exercise cards within a workout by writing each
 * `workout_exercises.position` to its index in `orderedWorkoutExerciseIds`
 * (LOG-04/D-16 reorder). Every id must already belong to `workoutId` —
 * throws otherwise, so a stale/foreign id can never write a position onto
 * the wrong workout. Runs as a single transaction so a partial reorder is
 * never observable.
 *
 * Note: both the better-sqlite3 and expo-sqlite Drizzle drivers execute
 * synchronously under the hood (`resultKind: "sync"`), so the transaction
 * callback here is intentionally a plain (non-async) function using `.run()`
 * — an `async` callback would return before its awaited queries actually
 * ran, causing the wrapper to commit before the writes happened.
 */
export async function reorderWorkoutExercises(
  db: AnyDrizzleDb,
  workoutId: number,
  orderedWorkoutExerciseIds: number[],
): Promise<void> {
  const existing = await db
    .select({ id: workoutExercises.id })
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId));
  const existingIds = new Set(existing.map((row) => row.id));

  for (const id of orderedWorkoutExerciseIds) {
    if (!existingIds.has(id)) {
      throw new Error(`workout_exercise ${id} does not belong to workout ${workoutId}`);
    }
  }

  db.transaction((tx) => {
    orderedWorkoutExerciseIds.forEach((id, index) => {
      tx.update(workoutExercises)
        .set({ position: index })
        .where(and(eq(workoutExercises.id, id), eq(workoutExercises.workoutId, workoutId)))
        .run();
    });
  });
}

/**
 * Swaps the exercise on an existing workout_exercises card (LOG-04/D-16
 * replace). FLAG-1/Pitfall 3 safe semantics: a naive `UPDATE exercise_id`
 * would retroactively reattribute already-completed sets on this card to
 * the new exercise, corrupting both exercises' PR/volume history. So this
 * THROWS once the card already has ≥1 logged set — the caller must
 * remove+re-add instead (or confirm the deletion first). Only a card with
 * zero sets can be swapped in place.
 */
export async function replaceWorkoutExercise(
  db: AnyDrizzleDb,
  workoutExerciseId: number,
  newExerciseId: number,
): Promise<WorkoutExercise> {
  const existingSets = await db
    .select({ id: sets.id })
    .from(sets)
    .where(eq(sets.workoutExerciseId, workoutExerciseId));

  if (existingSets.length > 0) {
    throw new Error(
      'Cannot replace an exercise that already has logged sets — remove it and add the new one instead',
    );
  }

  const [updated] = await db
    .update(workoutExercises)
    .set({ exerciseId: newExerciseId })
    .where(eq(workoutExercises.id, workoutExerciseId))
    .returning();

  return updated;
}

/**
 * Removes a single exercise card from a workout — a hard delete of that
 * slot's sets, then the workout_exercises row itself (child-before-parent,
 * D-16 remove). This is intentional data loss the UI confirms only when
 * sets already exist on the card (UI-SPEC "Remove {exercise}?"). Runs as a
 * single transaction (see `reorderWorkoutExercises` doc comment for why the
 * callback is synchronous).
 */
export async function removeWorkoutExercise(db: AnyDrizzleDb, workoutExerciseId: number): Promise<void> {
  db.transaction((tx) => {
    tx.delete(sets).where(eq(sets.workoutExerciseId, workoutExerciseId)).run();
    tx.delete(workoutExercises).where(eq(workoutExercises.id, workoutExerciseId)).run();
  });
}

/**
 * Hard-deletes a workout and everything under it — `sets`, then
 * `workout_exercises`, then the `workouts` row itself, children before
 * parent (LOG-05/D-11/Pitfall 2). This is NOT a soft-archive/status-flag
 * (unlike `exercises.setArchived`) — matches the UI-SPEC's "can't be
 * undone" discard-copy contract exactly. Runs as a single transaction (see
 * `reorderWorkoutExercises` doc comment for why the callback is
 * synchronous).
 */
export async function discardWorkout(db: AnyDrizzleDb, workoutId: number): Promise<void> {
  const weRows = await db
    .select({ id: workoutExercises.id })
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId));
  const weIds = weRows.map((row) => row.id);

  db.transaction((tx) => {
    if (weIds.length > 0) {
      tx.delete(sets).where(inArray(sets.workoutExerciseId, weIds)).run();
    }
    tx.delete(workoutExercises).where(eq(workoutExercises.workoutId, workoutId)).run();
    tx.delete(workouts).where(eq(workouts.id, workoutId)).run();
  });
}

/**
 * Ends a workout session by stamping `finished_at` = now (LOG-05/D-10).
 * Duration (finishedAt − startedAt) is computed at render time from these
 * two timestamps, not stored.
 */
export async function finishWorkout(db: AnyDrizzleDb, workoutId: number): Promise<Workout> {
  const [updated] = await db
    .update(workouts)
    .set({ finishedAt: new Date().toISOString() })
    .where(eq(workouts.id, workoutId))
    .returning();

  return updated;
}

export interface WorkoutHistoryEntry {
  workout: Workout;
  exerciseCount: number;
  totalVolumeKg: number;
}

/**
 * Lists finished workouts newest-first with a per-workout exercise count
 * and total working-set volume (HIST-01) — feeds the History list and the
 * "start from history" picker (D-04/D-05). Unfinished workouts are never
 * included. Volume excludes warmup sets via the shared
 * `lib/volume.ts#workingSetVolume` (do not reimplement that filter here).
 */
export async function loadWorkoutHistory(db: AnyDrizzleDb): Promise<WorkoutHistoryEntry[]> {
  const finished = await db
    .select()
    .from(workouts)
    .where(isNotNull(workouts.finishedAt))
    .orderBy(desc(workouts.startedAt));

  const entries: WorkoutHistoryEntry[] = [];
  for (const workout of finished) {
    const weRows = await db
      .select({ id: workoutExercises.id })
      .from(workoutExercises)
      .where(eq(workoutExercises.workoutId, workout.id));

    let totalVolumeKg = 0;
    for (const we of weRows) {
      const setRows = await db
        .select({ weightKg: sets.weightKg, reps: sets.reps, type: sets.type })
        .from(sets)
        .where(eq(sets.workoutExerciseId, we.id));
      totalVolumeKg += workingSetVolume(setRows);
    }

    entries.push({ workout, exerciseCount: weRows.length, totalVolumeKg });
  }

  return entries;
}

/**
 * Finished workouts whose `started_at` falls within the given calendar
 * month (1-indexed: 1=January) — feeds the History calendar's dot markers
 * (HIST-01/D-12). Bounds are computed in JS as ISO strings and passed as
 * bound parameters, never string-interpolated (T-02-08).
 */
export async function loadWorkoutsInMonth(db: AnyDrizzleDb, year: number, month: number): Promise<Workout[]> {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();

  return db
    .select()
    .from(workouts)
    .where(and(isNotNull(workouts.finishedAt), gte(workouts.startedAt, start), lt(workouts.startedAt, end)))
    .orderBy(asc(workouts.startedAt));
}

export interface PriorBest {
  exerciseId: number;
  bestWeightKg: number | null;
  bestE1RM: number | null;
}

/**
 * For each exercise id, the max non-warmup weight and max Epley-1RM
 * (`lib/estimate1RM.ts`) across sets in FINISHED workouts started strictly
 * before `beforeWorkoutId`'s own `started_at` (D-10) — excludes the current
 * workout and anything later. Returns the exact `{ exerciseId, bestWeightKg,
 * bestE1RM }` shape `lib/prDetection.ts#detectPRs` consumes; `null` means
 * the exercise has never been performed in prior history.
 */
export async function loadPriorBests(
  db: AnyDrizzleDb,
  exerciseIds: number[],
  beforeWorkoutId: number,
): Promise<PriorBest[]> {
  if (exerciseIds.length === 0) {
    return [];
  }

  const [target] = await db
    .select({ startedAt: workouts.startedAt })
    .from(workouts)
    .where(eq(workouts.id, beforeWorkoutId));

  if (!target) {
    return exerciseIds.map((exerciseId) => ({ exerciseId, bestWeightKg: null, bestE1RM: null }));
  }

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

    let bestWeightKg: number | null = null;
    let bestE1RM: number | null = null;
    for (const row of rows) {
      if (row.type === 'warmup') {
        continue;
      }
      if (bestWeightKg === null || row.weightKg > bestWeightKg) {
        bestWeightKg = row.weightKg;
      }
      const e1rm = estimate1RM(row.weightKg, row.reps);
      if (bestE1RM === null || e1rm > bestE1RM) {
        bestE1RM = e1rm;
      }
    }

    results.push({ exerciseId, bestWeightKg, bestE1RM });
  }

  return results;
}
