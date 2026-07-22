// LOG-01/LOG-02/D-15 mutation-layer tests (db/workouts.ts).
//
// Subjects under test:
//   - startWorkout: crash-safe session anchor (started_at set, finished_at null)
//   - insertSet: crash-safe write, incl. reject-negative-weight/reps
//   - updateSet: edit-mode field writes
//   - crash-safe persistence: a second, independent Drizzle instance on the
//     same sqlite handle re-reads a written set (simulates a fresh cold start)

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import * as schema from './schema';
import { exercises, sets, workoutExercises, workouts } from './schema';
import {
  addWorkoutExercise,
  deleteSet,
  discardWorkout,
  findResumableWorkout,
  finishWorkout,
  insertSet,
  loadWorkoutDetail,
  removeWorkoutExercise,
  reorderWorkoutExercises,
  replaceWorkoutExercise,
  startWorkout,
  updateSet,
} from './workouts';

describe('startWorkout', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('inserts a workout with started_at set and finished_at null', async () => {
    const workout = await startWorkout(db);

    expect(workout.finishedAt).toBeNull();
    expect(typeof workout.startedAt).toBe('string');
    expect(workout.startedAt.length).toBeGreaterThan(0);
  });

  it('trims and persists an optional name', async () => {
    const workout = await startWorkout(db, { name: '  Push Day  ' });
    expect(workout.name).toBe('Push Day');
  });

  it('defaults name to null when omitted or blank', async () => {
    const blank = await startWorkout(db, { name: '   ' });
    expect(blank.name).toBeNull();

    const omitted = await startWorkout(db);
    expect(omitted.name).toBeNull();
  });
});

async function seedExercise(db: ReturnType<typeof createTestDb>['db']) {
  const [exercise] = await db
    .insert(exercises)
    .values({ name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell', isCustom: false, archived: false })
    .returning();
  return exercise;
}

describe('insertSet', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('writes a set with weight/reps and stamps completed_at (LOG-02/D-15)', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db);
    const workoutExercise = await addWorkoutExercise(db, workout.id, exercise.id, 0);

    const set = await insertSet(db, {
      workoutExerciseId: workoutExercise.id,
      setNumber: 1,
      weightKg: 100,
      reps: 5,
    });

    expect(set.weightKg).toBe(100);
    expect(set.reps).toBe(5);
    expect(set.type).toBe('normal');
    expect(typeof set.completedAt).toBe('string');
    expect(set.completedAt.length).toBeGreaterThan(0);
  });

  it('rejects a negative weight', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db);
    const workoutExercise = await addWorkoutExercise(db, workout.id, exercise.id, 0);

    await expect(
      insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: 1, weightKg: -10, reps: 5 }),
    ).rejects.toThrow();
  });

  it('rejects negative and non-integer reps', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db);
    const workoutExercise = await addWorkoutExercise(db, workout.id, exercise.id, 0);

    await expect(
      insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: 1, weightKg: 60, reps: -1 }),
    ).rejects.toThrow();

    await expect(
      insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: 1, weightKg: 60, reps: 5.5 }),
    ).rejects.toThrow();
  });

  it('is crash-safe: a fresh Drizzle instance on the same sqlite handle re-reads the set', async () => {
    const { sqlite, db: writeDb } = createTestDb();
    const exercise = await seedExercise(writeDb);
    const workout = await startWorkout(writeDb);
    const workoutExercise = await addWorkoutExercise(writeDb, workout.id, exercise.id, 0);

    await insertSet(writeDb, { workoutExerciseId: workoutExercise.id, setNumber: 1, weightKg: 80, reps: 8 });

    // Simulate a crash + cold restart: open a SECOND, independent Drizzle
    // instance on the same underlying sqlite connection and re-select.
    const freshDb = drizzle(sqlite, { schema });
    const rows = await freshDb.select().from(schema.sets);

    expect(rows).toHaveLength(1);
    expect(rows[0].weightKg).toBe(80);
    expect(rows[0].reps).toBe(8);
  });
});

describe('updateSet', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('updates weight/reps/type on an existing set', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db);
    const workoutExercise = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    const set = await insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: 1, weightKg: 60, reps: 10 });

    const updated = await updateSet(db, set.id, { weightKg: 65, reps: 8, type: 'warmup' });

    expect(updated.weightKg).toBe(65);
    expect(updated.reps).toBe(8);
    expect(updated.type).toBe('warmup');
  });

  it('rejects an invalid weight/reps patch', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db);
    const workoutExercise = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    const set = await insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: 1, weightKg: 60, reps: 10 });

    await expect(updateSet(db, set.id, { weightKg: -5 })).rejects.toThrow();
    await expect(updateSet(db, set.id, { reps: -1 })).rejects.toThrow();
  });
});

async function seedSecondExercise(db: ReturnType<typeof createTestDb>['db']) {
  const [exercise] = await db
    .insert(exercises)
    .values({ name: 'Incline Bench Press', muscleGroup: 'Chest', equipment: 'Barbell', isCustom: false, archived: false })
    .returning();
  return exercise;
}

describe('reorderWorkoutExercises', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('persists new positions matching the given id order (LOG-04/D-16)', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db);
    const first = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    const second = await addWorkoutExercise(db, workout.id, exercise.id, 1);
    const third = await addWorkoutExercise(db, workout.id, exercise.id, 2);

    await reorderWorkoutExercises(db, workout.id, [third.id, first.id, second.id]);

    const detail = await loadWorkoutDetail(db, workout.id);
    expect(detail?.exercises.map((e) => e.workoutExercise.id)).toEqual([third.id, first.id, second.id]);
    expect(detail?.exercises.map((e) => e.workoutExercise.position)).toEqual([0, 1, 2]);
  });

  it('throws when an id does not belong to the workout and leaves positions untouched', async () => {
    const exercise = await seedExercise(db);
    const workoutA = await startWorkout(db, { name: 'A' });
    const workoutB = await startWorkout(db, { name: 'B' });
    const weA = await addWorkoutExercise(db, workoutA.id, exercise.id, 0);
    const weB = await addWorkoutExercise(db, workoutB.id, exercise.id, 0);

    await expect(reorderWorkoutExercises(db, workoutA.id, [weB.id])).rejects.toThrow();

    const detail = await loadWorkoutDetail(db, workoutA.id);
    expect(detail?.exercises[0].workoutExercise.id).toBe(weA.id);
    expect(detail?.exercises[0].workoutExercise.position).toBe(0);
  });
});

describe('replaceWorkoutExercise', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('swaps exercise_id in place when the card has zero logged sets', async () => {
    const original = await seedExercise(db);
    const replacement = await seedSecondExercise(db);
    const workout = await startWorkout(db);
    const workoutExercise = await addWorkoutExercise(db, workout.id, original.id, 0);

    const updated = await replaceWorkoutExercise(db, workoutExercise.id, replacement.id);

    expect(updated.exerciseId).toBe(replacement.id);
  });

  it('throws and mutates nothing once the card has a logged set (FLAG-1/Pitfall 3)', async () => {
    const original = await seedExercise(db);
    const replacement = await seedSecondExercise(db);
    const workout = await startWorkout(db);
    const workoutExercise = await addWorkoutExercise(db, workout.id, original.id, 0);
    await insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: 1, weightKg: 60, reps: 5 });

    await expect(replaceWorkoutExercise(db, workoutExercise.id, replacement.id)).rejects.toThrow();

    const detail = await loadWorkoutDetail(db, workout.id);
    expect(detail?.exercises[0].workoutExercise.exerciseId).toBe(original.id);
    expect(detail?.exercises[0].sets).toHaveLength(1);
  });
});

describe('removeWorkoutExercise', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('deletes the workout_exercise and its sets, leaving zero orphan sets (D-16 remove)', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db);
    const workoutExercise = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: 1, weightKg: 60, reps: 5 });
    await insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: 2, weightKg: 60, reps: 5 });

    await removeWorkoutExercise(db, workoutExercise.id);

    const detail = await loadWorkoutDetail(db, workout.id);
    expect(detail?.exercises).toHaveLength(0);

    const orphanSets = await db.select().from(sets).where(eq(sets.workoutExerciseId, workoutExercise.id));
    expect(orphanSets).toHaveLength(0);
  });
});

describe('discardWorkout', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('hard-deletes all sets, workout_exercises, and the workout row (LOG-05/D-11/Pitfall 2)', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db);
    const we1 = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    const we2 = await addWorkoutExercise(db, workout.id, exercise.id, 1);
    await insertSet(db, { workoutExerciseId: we1.id, setNumber: 1, weightKg: 60, reps: 5 });
    await insertSet(db, { workoutExerciseId: we2.id, setNumber: 1, weightKg: 40, reps: 8 });

    await discardWorkout(db, workout.id);

    const remainingSets = await db.select().from(sets);
    const remainingWorkoutExercises = await db.select().from(workoutExercises);
    const remainingWorkout = await db.select().from(workouts).where(eq(workouts.id, workout.id));

    expect(remainingSets).toHaveLength(0);
    expect(remainingWorkoutExercises).toHaveLength(0);
    expect(remainingWorkout).toHaveLength(0);
  });

  it('does not affect an unrelated workout (no over-broad delete)', async () => {
    const exercise = await seedExercise(db);
    const target = await startWorkout(db, { name: 'Discard me' });
    const targetWe = await addWorkoutExercise(db, target.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: targetWe.id, setNumber: 1, weightKg: 60, reps: 5 });

    const other = await startWorkout(db, { name: 'Keep me' });
    const otherWe = await addWorkoutExercise(db, other.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: otherWe.id, setNumber: 1, weightKg: 100, reps: 3 });

    await discardWorkout(db, target.id);

    const otherDetail = await loadWorkoutDetail(db, other.id);
    expect(otherDetail?.workout.id).toBe(other.id);
    expect(otherDetail?.exercises).toHaveLength(1);
    expect(otherDetail?.exercises[0].sets).toHaveLength(1);
  });
});

describe('deleteSet', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('deletes exactly the targeted set and leaves siblings intact', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db);
    const workoutExercise = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    const first = await insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: 1, weightKg: 60, reps: 5 });
    const second = await insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: 2, weightKg: 65, reps: 5 });

    await deleteSet(db, first.id);

    const detail = await loadWorkoutDetail(db, workout.id);
    expect(detail?.exercises).toHaveLength(1);
    expect(detail?.exercises[0].sets).toHaveLength(1);
    expect(detail?.exercises[0].sets[0].id).toBe(second.id);
  });

  it('is crash-safe: a fresh Drizzle instance re-reads the delete', async () => {
    const { sqlite, db: writeDb } = createTestDb();
    const exercise = await seedExercise(writeDb);
    const workout = await startWorkout(writeDb);
    const workoutExercise = await addWorkoutExercise(writeDb, workout.id, exercise.id, 0);
    const first = await insertSet(writeDb, {
      workoutExerciseId: workoutExercise.id,
      setNumber: 1,
      weightKg: 60,
      reps: 5,
    });
    const second = await insertSet(writeDb, {
      workoutExerciseId: workoutExercise.id,
      setNumber: 2,
      weightKg: 65,
      reps: 5,
    });

    await deleteSet(writeDb, first.id);

    // Simulate a crash + cold restart: open a SECOND, independent Drizzle
    // instance on the same underlying sqlite connection and re-select.
    const freshDb = drizzle(sqlite, { schema });
    const rows = await freshDb.select().from(schema.sets);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(second.id);
  });
});

describe('finishWorkout', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('sets finishedAt and makes the workout non-resumable (LOG-05/D-10)', async () => {
    const workout = await startWorkout(db);
    expect(workout.finishedAt).toBeNull();

    const finished = await finishWorkout(db, workout.id);
    expect(finished.finishedAt).not.toBeNull();
    expect(typeof finished.finishedAt).toBe('string');

    const resumable = await findResumableWorkout(db);
    expect(resumable).toBeUndefined();
  });
});

