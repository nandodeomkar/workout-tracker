// STAT-01 query-layer tests (db/stats.ts).
//
// Subject under test:
//   - loadExerciseChartSets: parameterized fetch of one exercise's sets from
//     finished workouts (T-04-02/T-04-04).

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { exercises, workouts } from './schema';
import { addWorkoutExercise, insertSet, startWorkout } from './workouts';
import { loadExerciseChartSets } from './stats';

async function seedExercise(db: ReturnType<typeof createTestDb>['db'], name = 'Squat') {
  const [exercise] = await db
    .insert(exercises)
    .values({ name, muscleGroup: 'Legs', equipment: 'Barbell', isCustom: false, archived: false })
    .returning();
  return exercise;
}

describe('loadExerciseChartSets', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns an empty array for an exercise with no finished sets', async () => {
    const exercise = await seedExercise(db);
    const rows = await loadExerciseChartSets(db, exercise.id);
    expect(rows).toEqual([]);
  });

  it('returns rows scoped to the given exerciseId, ordered by started_at ascending', async () => {
    const squat = await seedExercise(db, 'Squat');
    const bench = await seedExercise(db, 'Bench Press');

    const older = await startWorkout(db, { name: 'Older' });
    const olderWe = await addWorkoutExercise(db, older.id, squat.id, 0);
    await insertSet(db, { workoutExerciseId: olderWe.id, setNumber: 1, weightKg: 80, reps: 5 });
    await db
      .update(workouts)
      .set({ startedAt: '2026-07-01T10:00:00.000Z', finishedAt: '2026-07-01T11:00:00.000Z' })
      .where(eq(workouts.id, older.id));

    const newer = await startWorkout(db, { name: 'Newer' });
    const newerWe = await addWorkoutExercise(db, newer.id, squat.id, 0);
    await insertSet(db, { workoutExerciseId: newerWe.id, setNumber: 1, weightKg: 100, reps: 3 });
    await db
      .update(workouts)
      .set({ startedAt: '2026-07-10T10:00:00.000Z', finishedAt: '2026-07-10T11:00:00.000Z' })
      .where(eq(workouts.id, newer.id));

    // Wrong-exercise's sets must never appear.
    const benchWorkout = await startWorkout(db, { name: 'Bench day' });
    const benchWe = await addWorkoutExercise(db, benchWorkout.id, bench.id, 0);
    await insertSet(db, { workoutExerciseId: benchWe.id, setNumber: 1, weightKg: 60, reps: 8 });
    await db
      .update(workouts)
      .set({ startedAt: '2026-07-05T10:00:00.000Z', finishedAt: '2026-07-05T11:00:00.000Z' })
      .where(eq(workouts.id, benchWorkout.id));

    const rows = await loadExerciseChartSets(db, squat.id);

    expect(rows.map((r) => r.weightKg)).toEqual([80, 100]);
    expect(rows.every((r) => r.workoutId === olderWe.workoutId || r.workoutId === newerWe.workoutId)).toBe(true);
  });

  it('excludes sets from an in-progress (unfinished) workout', async () => {
    const exercise = await seedExercise(db);

    const finished = await startWorkout(db, { name: 'Finished' });
    const finishedWe = await addWorkoutExercise(db, finished.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: finishedWe.id, setNumber: 1, weightKg: 90, reps: 5 });
    await db.update(workouts).set({ finishedAt: new Date().toISOString() }).where(eq(workouts.id, finished.id));

    const inProgress = await startWorkout(db, { name: 'In progress' });
    const inProgressWe = await addWorkoutExercise(db, inProgress.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: inProgressWe.id, setNumber: 1, weightKg: 999, reps: 1 });

    const rows = await loadExerciseChartSets(db, exercise.id);

    expect(rows).toHaveLength(1);
    expect(rows[0].weightKg).toBe(90);
  });

  it('returns warmup rows too (filtering is buildChartSeries responsibility, not SQL)', async () => {
    const exercise = await seedExercise(db);

    const workout = await startWorkout(db, { name: 'Session' });
    const we = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: we.id, setNumber: 1, weightKg: 20, reps: 10, type: 'warmup' });
    await insertSet(db, { workoutExerciseId: we.id, setNumber: 2, weightKg: 90, reps: 5 });
    await db.update(workouts).set({ finishedAt: new Date().toISOString() }).where(eq(workouts.id, workout.id));

    const rows = await loadExerciseChartSets(db, exercise.id);

    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.type === 'warmup')).toBe(true);
  });

  it('each row carries workoutId, startedAt, weightKg, reps, type', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db, { name: 'Session' });
    const we = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: we.id, setNumber: 1, weightKg: 90, reps: 5 });
    await db.update(workouts).set({ finishedAt: new Date().toISOString() }).where(eq(workouts.id, workout.id));

    const [row] = await loadExerciseChartSets(db, exercise.id);

    expect(row).toEqual({
      workoutId: workout.id,
      startedAt: workout.startedAt,
      weightKg: 90,
      reps: 5,
      type: 'normal',
    });
  });
});
