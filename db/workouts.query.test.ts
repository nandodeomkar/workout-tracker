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
  loadPriorBests,
  loadWorkoutDetail,
  loadWorkoutHistory,
  loadWorkoutsInMonth,
  startWorkout,
} from './workouts';
import { estimate1RM } from '../lib/estimate1RM';

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

describe('loadWorkoutHistory', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns only finished workouts, newest-first, with exerciseCount and totalVolumeKg (HIST-01)', async () => {
    const bench = await seedExercise(db, 'Bench Press');
    const squat = await seedExercise(db, 'Squat');

    // Older finished workout: 1 exercise, 2 working sets, no warmups.
    const older = await startWorkout(db, { name: 'Older' });
    const olderWe = await addWorkoutExercise(db, older.id, bench.id, 0);
    await insertSet(db, { workoutExerciseId: olderWe.id, setNumber: 1, weightKg: 60, reps: 5 });
    await insertSet(db, { workoutExerciseId: olderWe.id, setNumber: 2, weightKg: 60, reps: 5 });
    await db
      .update(workouts)
      .set({ finishedAt: new Date(Date.now() - 20_000).toISOString() })
      .where(eq(workouts.id, older.id));

    // Newer finished workout: 2 exercises, includes a warmup set excluded from volume.
    const newer = await startWorkout(db, { name: 'Newer' });
    const newerWe1 = await addWorkoutExercise(db, newer.id, bench.id, 0);
    const newerWe2 = await addWorkoutExercise(db, newer.id, squat.id, 1);
    await insertSet(db, { workoutExerciseId: newerWe1.id, setNumber: 1, weightKg: 20, reps: 10, type: 'warmup' });
    await insertSet(db, { workoutExerciseId: newerWe1.id, setNumber: 2, weightKg: 70, reps: 5 });
    await insertSet(db, { workoutExerciseId: newerWe2.id, setNumber: 1, weightKg: 100, reps: 3 });
    await db
      .update(workouts)
      .set({ finishedAt: new Date(Date.now() - 5_000).toISOString() })
      .where(eq(workouts.id, newer.id));

    // Unfinished workout — must never appear.
    const unfinished = await startWorkout(db, { name: 'In progress' });
    await addWorkoutExercise(db, unfinished.id, bench.id, 0);

    const history = await loadWorkoutHistory(db);

    expect(history.map((h) => h.workout.id)).toEqual([newer.id, older.id]);

    const olderEntry = history.find((h) => h.workout.id === older.id);
    expect(olderEntry?.exerciseCount).toBe(1);
    expect(olderEntry?.totalVolumeKg).toBe(60 * 5 + 60 * 5);

    const newerEntry = history.find((h) => h.workout.id === newer.id);
    expect(newerEntry?.exerciseCount).toBe(2);
    expect(newerEntry?.totalVolumeKg).toBe(70 * 5 + 100 * 3);
  });
});

describe('loadWorkoutsInMonth', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns only finished workouts started within the given month (HIST-01/D-12)', async () => {
    const exercise = await seedExercise(db);

    const july = await startWorkout(db, { name: 'July' });
    await addWorkoutExercise(db, july.id, exercise.id, 0);
    await db
      .update(workouts)
      .set({ startedAt: '2026-07-15T10:00:00.000Z', finishedAt: '2026-07-15T11:00:00.000Z' })
      .where(eq(workouts.id, july.id));

    const august = await startWorkout(db, { name: 'August' });
    await addWorkoutExercise(db, august.id, exercise.id, 0);
    await db
      .update(workouts)
      .set({ startedAt: '2026-08-02T10:00:00.000Z', finishedAt: '2026-08-02T11:00:00.000Z' })
      .where(eq(workouts.id, august.id));

    const julyUnfinished = await startWorkout(db, { name: 'July unfinished' });
    await db.update(workouts).set({ startedAt: '2026-07-20T10:00:00.000Z' }).where(eq(workouts.id, julyUnfinished.id));

    const result = await loadWorkoutsInMonth(db, 2026, 7);

    expect(result.map((w) => w.id)).toEqual([july.id]);
  });
});

describe('loadPriorBests', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns the max non-warmup weight and best e1RM from finished workouts before the given workout (D-10)', async () => {
    const exercise = await seedExercise(db, 'Bench Press');

    const earlier = await startWorkout(db, { name: 'Earlier' });
    const earlierWe = await addWorkoutExercise(db, earlier.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: earlierWe.id, setNumber: 1, weightKg: 90, reps: 10, type: 'warmup' });
    await insertSet(db, { workoutExerciseId: earlierWe.id, setNumber: 2, weightKg: 80, reps: 5 });
    await db
      .update(workouts)
      .set({ startedAt: '2026-07-01T10:00:00.000Z', finishedAt: '2026-07-01T11:00:00.000Z' })
      .where(eq(workouts.id, earlier.id));

    const current = await startWorkout(db, { name: 'Current' });
    const currentWe = await addWorkoutExercise(db, current.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: currentWe.id, setNumber: 1, weightKg: 200, reps: 3 });
    await db.update(workouts).set({ startedAt: '2026-07-10T10:00:00.000Z' }).where(eq(workouts.id, current.id));

    const later = await startWorkout(db, { name: 'Later' });
    const laterWe = await addWorkoutExercise(db, later.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: laterWe.id, setNumber: 1, weightKg: 300, reps: 1 });
    await db
      .update(workouts)
      .set({ startedAt: '2026-07-20T10:00:00.000Z', finishedAt: '2026-07-20T11:00:00.000Z' })
      .where(eq(workouts.id, later.id));

    const result = await loadPriorBests(db, [exercise.id], current.id);

    expect(result).toEqual([{ exerciseId: exercise.id, bestWeightKg: 80, bestE1RM: estimate1RM(80, 5) }]);
  });

  it('returns null bests for an exercise that has never been performed', async () => {
    const exercise = await seedExercise(db, 'Deadlift');
    const current = await startWorkout(db);

    const result = await loadPriorBests(db, [exercise.id], current.id);

    expect(result).toEqual([{ exerciseId: exercise.id, bestWeightKg: null, bestE1RM: null }]);
  });
});
