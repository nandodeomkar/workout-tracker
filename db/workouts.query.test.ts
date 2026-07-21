// LOG-01/LOG-02/D-06/D-15 query-layer tests (db/workouts.ts).
//
// Subjects under test:
//   - findResumableWorkout: cold-start resume detection (Pattern 1)
//   - loadLastPerformance: last-performance pre-fill query (Pattern 2)
//   - loadWorkoutDetail: ordered workout/exercises/sets read

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { exercises, workouts } from './schema';
import {
  addWorkoutExercise,
  findResumableWorkout,
  insertSet,
  loadLastPerformance,
  loadWorkoutDetail,
  startWorkout,
} from './workouts';

describe('findResumableWorkout', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns undefined when no workout has ever been started', async () => {
    const resumable = await findResumableWorkout(db);
    expect(resumable).toBeUndefined();
  });

  it('returns the unfinished workout', async () => {
    const workout = await startWorkout(db, { name: 'Push Day' });

    const resumable = await findResumableWorkout(db);
    expect(resumable?.id).toBe(workout.id);
  });

  it('returns undefined once the workout is finished', async () => {
    const workout = await startWorkout(db);
    await db.update(workouts).set({ finishedAt: new Date().toISOString() }).where(eq(workouts.id, workout.id));

    const resumable = await findResumableWorkout(db);
    expect(resumable).toBeUndefined();
  });

  it('returns the most recently started unfinished workout when multiple exist', async () => {
    const first = await startWorkout(db, { name: 'Earlier' });
    // Ensure a distinct, later started_at than `first`.
    const later = new Date(Date.now() + 1000).toISOString();
    const [second] = await db.insert(workouts).values({ name: 'Later', startedAt: later, finishedAt: null }).returning();

    const resumable = await findResumableWorkout(db);
    expect(resumable?.id).toBe(second.id);
    expect(resumable?.id).not.toBe(first.id);
  });
});

async function seedExercise(db: ReturnType<typeof createTestDb>['db'], name = 'Squat') {
  const [exercise] = await db
    .insert(exercises)
    .values({ name, muscleGroup: 'Legs', equipment: 'Barbell', isCustom: false, archived: false })
    .returning();
  return exercise;
}

describe('loadLastPerformance', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns an empty array when the exercise has never been performed', async () => {
    const exercise = await seedExercise(db);
    const sets = await loadLastPerformance(db, exercise.id);
    expect(sets).toEqual([]);
  });

  it('returns the most recent FINISHED performance sets, ordered by set number', async () => {
    const exercise = await seedExercise(db);

    // Older finished workout.
    const older = await startWorkout(db, { name: 'Older' });
    const olderWe = await addWorkoutExercise(db, older.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: olderWe.id, setNumber: 1, weightKg: 60, reps: 10 });
    await db
      .update(workouts)
      .set({ finishedAt: new Date(Date.now() - 10_000).toISOString() })
      .where(eq(workouts.id, older.id));

    // Most recent finished workout — this is the one that should win.
    const recent = await startWorkout(db, { name: 'Recent' });
    const recentWe = await addWorkoutExercise(db, recent.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: recentWe.id, setNumber: 2, weightKg: 70, reps: 8 });
    await insertSet(db, { workoutExerciseId: recentWe.id, setNumber: 1, weightKg: 70, reps: 10 });
    await db.update(workouts).set({ finishedAt: new Date().toISOString() }).where(eq(workouts.id, recent.id));

    const result = await loadLastPerformance(db, exercise.id);

    expect(result.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(result.every((s) => s.workoutExerciseId === recentWe.id)).toBe(true);
  });

  it('ignores an in-progress workout own rows and only pre-fills from finished performances', async () => {
    const exercise = await seedExercise(db);

    // Finished performance (should be the pre-fill source).
    const finished = await startWorkout(db, { name: 'Finished' });
    const finishedWe = await addWorkoutExercise(db, finished.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: finishedWe.id, setNumber: 1, weightKg: 50, reps: 12 });
    await db.update(workouts).set({ finishedAt: new Date().toISOString() }).where(eq(workouts.id, finished.id));

    // Current in-progress workout with this exercise added but no sets yet.
    const inProgress = await startWorkout(db, { name: 'In progress' });
    await addWorkoutExercise(db, inProgress.id, exercise.id, 0);

    const result = await loadLastPerformance(db, exercise.id);

    expect(result).toHaveLength(1);
    expect(result[0].workoutExerciseId).toBe(finishedWe.id);
    expect(result[0].weightKg).toBe(50);
  });
});

describe('loadWorkoutDetail', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns undefined for a non-existent workout', async () => {
    const detail = await loadWorkoutDetail(db, 999);
    expect(detail).toBeUndefined();
  });

  it('returns the workout with exercises ordered by position and sets ordered by set number', async () => {
    const bench = await seedExercise(db, 'Bench Press');
    const squat = await seedExercise(db, 'Squat');
    const workout = await startWorkout(db, { name: 'Full Body' });

    const squatWe = await addWorkoutExercise(db, workout.id, squat.id, 1);
    const benchWe = await addWorkoutExercise(db, workout.id, bench.id, 0);

    await insertSet(db, { workoutExerciseId: benchWe.id, setNumber: 2, weightKg: 60, reps: 5 });
    await insertSet(db, { workoutExerciseId: benchWe.id, setNumber: 1, weightKg: 60, reps: 8 });
    await insertSet(db, { workoutExerciseId: squatWe.id, setNumber: 1, weightKg: 100, reps: 5 });

    const detail = await loadWorkoutDetail(db, workout.id);

    expect(detail?.workout.id).toBe(workout.id);
    expect(detail?.exercises.map((e) => e.workoutExercise.id)).toEqual([benchWe.id, squatWe.id]);
    expect(detail?.exercises[0].sets.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(detail?.exercises[1].sets.map((s) => s.setNumber)).toEqual([1]);
  });
});
