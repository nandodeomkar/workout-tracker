// LOG-01/LOG-02/D-15 mutation-layer tests (db/workouts.ts).
//
// Subjects under test:
//   - startWorkout: crash-safe session anchor (started_at set, finished_at null)
//   - insertSet: crash-safe write, incl. reject-negative-weight/reps
//   - updateSet: edit-mode field writes
//   - crash-safe persistence: a second, independent Drizzle instance on the
//     same sqlite handle re-reads a written set (simulates a fresh cold start)

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import * as schema from './schema';
import { exercises } from './schema';
import { addWorkoutExercise, insertSet, startWorkout, updateSet } from './workouts';

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
