// STAT-01/STAT-02/STAT-03 query-layer tests (db/stats.ts).
//
// Subject under test:
//   - loadExerciseChartSets: parameterized fetch of one exercise's sets from
//     finished workouts (T-04-02/T-04-04).
//   - loadWeeklyVolumeSets: parameterized, date-windowed fetch of finished-
//     workout sets joined to exercises.muscle_group (T-04-02, STAT-02).
//   - loadExercisesWithSets: distinct trained exercises feeding the Section C
//     picker (D-03a).
//   - loadAllHistorySets: every set across ALL exercises from finished
//     workouts, chronological asc (STAT-03/D-11 — feeds computeAllTimeRecords).

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { exercises, workouts } from './schema';
import { addWorkoutExercise, insertSet, startWorkout } from './workouts';
import { loadAllHistorySets, loadExerciseChartSets, loadExercisesWithSets, loadWeeklyVolumeSets } from './stats';

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

describe('loadWeeklyVolumeSets', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns [] on an empty DB', async () => {
    const rows = await loadWeeklyVolumeSets(db, '2020-01-01T00:00:00.000Z');
    expect(rows).toEqual([]);
  });

  it('returns finished-workout sets on/after sinceIso, joined to exercise muscle_group', async () => {
    const exercise = await seedExercise(db, 'Squat');

    const inWindow = await startWorkout(db, { name: 'In window' });
    const inWindowWe = await addWorkoutExercise(db, inWindow.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: inWindowWe.id, setNumber: 1, weightKg: 100, reps: 5 });
    await db
      .update(workouts)
      .set({ startedAt: '2026-07-10T10:00:00.000Z', finishedAt: '2026-07-10T11:00:00.000Z' })
      .where(eq(workouts.id, inWindow.id));

    const beforeWindow = await startWorkout(db, { name: 'Before window' });
    const beforeWindowWe = await addWorkoutExercise(db, beforeWindow.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: beforeWindowWe.id, setNumber: 1, weightKg: 999, reps: 1 });
    await db
      .update(workouts)
      .set({ startedAt: '2026-06-01T10:00:00.000Z', finishedAt: '2026-06-01T11:00:00.000Z' })
      .where(eq(workouts.id, beforeWindow.id));

    const rows = await loadWeeklyVolumeSets(db, '2026-07-01T00:00:00.000Z');

    expect(rows).toEqual([
      {
        startedAt: '2026-07-10T10:00:00.000Z',
        weightKg: 100,
        reps: 5,
        type: 'normal',
        muscleGroup: 'Legs',
      },
    ]);
  });

  it('excludes sets from an in-progress (unfinished) workout', async () => {
    const exercise = await seedExercise(db);

    const inProgress = await startWorkout(db, { name: 'In progress' });
    const we = await addWorkoutExercise(db, inProgress.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: we.id, setNumber: 1, weightKg: 100, reps: 5 });
    await db.update(workouts).set({ startedAt: '2026-07-10T10:00:00.000Z' }).where(eq(workouts.id, inProgress.id));

    const rows = await loadWeeklyVolumeSets(db, '2026-01-01T00:00:00.000Z');

    expect(rows).toEqual([]);
  });

  it('returns warmup rows too (filtering is buildWeeklyVolume responsibility, not SQL)', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db, { name: 'Session' });
    const we = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: we.id, setNumber: 1, weightKg: 20, reps: 10, type: 'warmup' });
    await insertSet(db, { workoutExerciseId: we.id, setNumber: 2, weightKg: 90, reps: 5 });
    await db
      .update(workouts)
      .set({ startedAt: '2026-07-10T10:00:00.000Z', finishedAt: '2026-07-10T11:00:00.000Z' })
      .where(eq(workouts.id, workout.id));

    const rows = await loadWeeklyVolumeSets(db, '2026-01-01T00:00:00.000Z');

    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.type === 'warmup')).toBe(true);
  });
});

describe('loadExercisesWithSets', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns [] on an empty DB', async () => {
    const rows = await loadExercisesWithSets(db);
    expect(rows).toEqual([]);
  });

  it('excludes a never-trained exercise', async () => {
    const trained = await seedExercise(db, 'Squat');
    await seedExercise(db, 'Never Trained');

    const workout = await startWorkout(db, { name: 'Session' });
    const we = await addWorkoutExercise(db, workout.id, trained.id, 0);
    await insertSet(db, { workoutExerciseId: we.id, setNumber: 1, weightKg: 100, reps: 5 });
    await db.update(workouts).set({ finishedAt: new Date().toISOString() }).where(eq(workouts.id, workout.id));

    const rows = await loadExercisesWithSets(db);

    expect(rows).toEqual([{ id: trained.id, name: 'Squat', muscleGroup: 'Legs' }]);
  });

  it('excludes an exercise whose only sets belong to an unfinished workout', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db, { name: 'In progress' });
    const we = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: we.id, setNumber: 1, weightKg: 100, reps: 5 });

    const rows = await loadExercisesWithSets(db);

    expect(rows).toEqual([]);
  });

  it('dedupes an exercise trained across multiple workouts and sorts case-insensitively by name', async () => {
    const zebra = await seedExercise(db, 'zebra curl');
    const apple = await seedExercise(db, 'Apple Press');

    for (const [exercise, count] of [[zebra, 2] as const, [apple, 1] as const]) {
      for (let i = 0; i < count; i++) {
        const workout = await startWorkout(db, { name: `Session ${i}` });
        const we = await addWorkoutExercise(db, workout.id, exercise.id, 0);
        await insertSet(db, { workoutExerciseId: we.id, setNumber: 1, weightKg: 50, reps: 5 });
        await db.update(workouts).set({ finishedAt: new Date().toISOString() }).where(eq(workouts.id, workout.id));
      }
    }

    const rows = await loadExercisesWithSets(db);

    expect(rows).toEqual([
      { id: apple.id, name: 'Apple Press', muscleGroup: 'Legs' },
      { id: zebra.id, name: 'zebra curl', muscleGroup: 'Legs' },
    ]);
  });
});

describe('loadAllHistorySets', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns [] on an empty DB', async () => {
    const rows = await loadAllHistorySets(db);
    expect(rows).toEqual([]);
  });

  it('returns sets across ALL exercises, ordered by workout started_at ascending', async () => {
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
    const newerWe = await addWorkoutExercise(db, newer.id, bench.id, 0);
    await insertSet(db, { workoutExerciseId: newerWe.id, setNumber: 1, weightKg: 60, reps: 8 });
    await db
      .update(workouts)
      .set({ startedAt: '2026-07-10T10:00:00.000Z', finishedAt: '2026-07-10T11:00:00.000Z' })
      .where(eq(workouts.id, newer.id));

    const rows = await loadAllHistorySets(db);

    expect(rows).toEqual([
      {
        exerciseId: squat.id,
        workoutId: older.id,
        startedAt: '2026-07-01T10:00:00.000Z',
        weightKg: 80,
        reps: 5,
        type: 'normal',
      },
      {
        exerciseId: bench.id,
        workoutId: newer.id,
        startedAt: '2026-07-10T10:00:00.000Z',
        weightKg: 60,
        reps: 8,
        type: 'normal',
      },
    ]);
  });

  it('includes warmup rows in the raw result (filtering is computeAllTimeRecords responsibility, not SQL)', async () => {
    const exercise = await seedExercise(db);
    const workout = await startWorkout(db, { name: 'Session' });
    const we = await addWorkoutExercise(db, workout.id, exercise.id, 0);
    await insertSet(db, { workoutExerciseId: we.id, setNumber: 1, weightKg: 20, reps: 10, type: 'warmup' });
    await insertSet(db, { workoutExerciseId: we.id, setNumber: 2, weightKg: 90, reps: 5 });
    await db.update(workouts).set({ finishedAt: new Date().toISOString() }).where(eq(workouts.id, workout.id));

    const rows = await loadAllHistorySets(db);

    expect(rows).toHaveLength(2);
    expect(rows.some((r) => r.type === 'warmup')).toBe(true);
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

    const rows = await loadAllHistorySets(db);

    expect(rows).toHaveLength(1);
    expect(rows[0].weightKg).toBe(90);
  });
});
