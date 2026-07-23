// PROG-01/PROG-04 mutation-layer tests (db/programs.ts write path).
//
// Subjects under test:
//   - createProgram / addProgramDay / loadProgramDetail: basic CRUD + detail read
//   - materializeBundledProgram: clone-into-user-owned-rows (D-15), missing
//     seed_id throws (Pitfall 6), clone independence (Pitfall 4)
//   - startWorkoutFromProgramDay: origin marker (D-05) + pointer-follows (D-04)
//   - deleteProgram: detach-before-delete (mirrors db/templates.ts#deleteTemplate)
//   - training maxes: validated upsert + program-scoped %TM listing

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { exercises, programDays, programState, workouts } from './schema';
import { createTemplate, setTemplateExercises, startWorkoutFromTemplate } from './templates';
import { finishWorkout, insertSet, loadWorkoutDetail } from './workouts';
import {
  addProgramDay,
  applyProgressionAndAdvance,
  createProgram,
  deleteProgram,
  getTrainingMax,
  listProgramTrainingMaxes,
  loadActiveProgram,
  loadAllPrograms,
  loadProgramDetail,
  materializeBundledProgram,
  setTrainingMax,
  startWorkoutFromProgramDay,
  type BundledProgramDefinition,
} from './programs';
import { linear5x5, percentWave, resolveExerciseSeedIds } from '../data/bundledPrograms';

type TestDb = ReturnType<typeof createTestDb>['db'];

async function seedExercise(db: TestDb, name = 'Barbell Squat', seedId?: string) {
  const [exercise] = await db
    .insert(exercises)
    .values({
      name,
      muscleGroup: 'Legs',
      equipment: 'Barbell',
      isCustom: false,
      archived: false,
      seedId: seedId ?? null,
    })
    .returning();
  return exercise;
}

function twoDaySquatBenchBundle(squatSeedId: string, benchSeedId: string): BundledProgramDefinition {
  return {
    name: 'Linear 5x5 (3-Day)',
    notes: null,
    days: [
      {
        name: 'Day A',
        exercises: [
          {
            seedId: squatSeedId,
            targetSets: 5,
            targetReps: 5,
            progression: { type: 'linear', incrementKg: 2.5 },
          },
        ],
      },
      {
        name: 'Day B',
        exercises: [
          {
            seedId: benchSeedId,
            targetSets: 5,
            targetReps: 5,
            progression: { type: 'linear', incrementKg: 2.5 },
          },
        ],
      },
    ],
  };
}

describe('createProgram / addProgramDay / loadProgramDetail', () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('creates a program and loads its ordered days with template detail', async () => {
    const exercise = await seedExercise(db);
    const template = await createTemplate(db, { name: 'Day A', position: 0 });
    await setTemplateExercises(db, template.id, [
      { exerciseId: exercise.id, position: 0, targetSets: 5, targetReps: 5, targetWeightKg: 100 },
    ]);

    const program = await createProgram(db, { name: 'Custom Program' });
    await addProgramDay(db, { programId: program.id, position: 0, templateId: template.id });

    const detail = await loadProgramDetail(db, program.id);
    expect(detail?.program.name).toBe('Custom Program');
    expect(detail?.days).toHaveLength(1);
    expect(detail?.days[0]?.template.exercises[0]?.templateExercise.exerciseId).toBe(exercise.id);
  });

  it('rejects an empty program name before insert', async () => {
    await expect(createProgram(db, { name: '   ' })).rejects.toThrow();
  });
});

describe('loadAllPrograms', () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('summarizes day count and origin per program (Linear/Percent-TM/Mixed/Custom)', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');

    const linearTemplate = await createTemplate(db, { name: 'Day A', position: 0 });
    await setTemplateExercises(db, linearTemplate.id, [
      {
        exerciseId: squat.id,
        position: 0,
        targetSets: 5,
        targetReps: 5,
        targetWeightKg: null,
        progression: JSON.stringify({ type: 'linear', incrementKg: 2.5 }),
      },
    ]);
    const linearProgram = await createProgram(db, { name: 'Linear Only' });
    await addProgramDay(db, { programId: linearProgram.id, position: 0, templateId: linearTemplate.id });

    const customTemplate = await createTemplate(db, { name: 'Day B', position: 0 });
    await setTemplateExercises(db, customTemplate.id, [
      { exerciseId: squat.id, position: 0, targetSets: 3, targetReps: 8, targetWeightKg: null },
    ]);
    const customProgram = await createProgram(db, { name: 'No Progression Yet' });
    await addProgramDay(db, { programId: customProgram.id, position: 0, templateId: customTemplate.id });

    const summaries = await loadAllPrograms(db);
    expect(summaries).toHaveLength(2);

    const linearSummary = summaries.find((s) => s.program.id === linearProgram.id);
    expect(linearSummary?.dayCount).toBe(1);
    expect(linearSummary?.origin).toBe('Linear');

    const customSummary = summaries.find((s) => s.program.id === customProgram.id);
    expect(customSummary?.dayCount).toBe(1);
    expect(customSummary?.origin).toBe('Custom');
  });
});

describe('materializeBundledProgram (materialize)', () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('clones bundle templates + program_days into user-owned rows and sets program_state at position 0', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    const bench = await seedExercise(db, 'Barbell Bench Press', 'barbell-bench-press-medium-grip');
    const bundle = twoDaySquatBenchBundle('barbell-squat', 'barbell-bench-press-medium-grip');
    const seedMap = new Map([
      [squat.seedId!, squat.id],
      [bench.seedId!, bench.id],
    ]);

    const program = await materializeBundledProgram(db, bundle, seedMap);

    const detail = await loadProgramDetail(db, program.id);
    expect(detail?.days).toHaveLength(2);
    expect(detail?.days[0]?.template.exercises[0]?.templateExercise.exerciseId).toBe(squat.id);
    expect(detail?.days[0]?.template.exercises[0]?.templateExercise.progression).toBe(
      JSON.stringify({ type: 'linear', incrementKg: 2.5 }),
    );

    const stateRows = await db.select().from(programState).where(eq(programState.programId, program.id));
    expect(stateRows).toHaveLength(1);
    expect(stateRows[0]?.currentDayPosition).toBe(0);
  });

  it('throws a clear error naming the missing seed_id and inserts nothing (Pitfall 6)', async () => {
    const bundle = twoDaySquatBenchBundle('barbell-squat', 'barbell-bench-press-medium-grip');
    const emptyMap = new Map<string, number>();

    await expect(materializeBundledProgram(db, bundle, emptyMap)).rejects.toThrow(/barbell-squat/);

    const dayRowsAfter = await db.select().from(programDays);
    expect(dayRowsAfter).toHaveLength(0);
  });

  it('adding the same bundle twice creates two independent, non-shared user copies (clone independence)', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    const bench = await seedExercise(db, 'Barbell Bench Press', 'barbell-bench-press-medium-grip');
    const bundle = twoDaySquatBenchBundle('barbell-squat', 'barbell-bench-press-medium-grip');
    const seedMap = new Map([
      [squat.seedId!, squat.id],
      [bench.seedId!, bench.id],
    ]);

    const programOne = await materializeBundledProgram(db, bundle, seedMap);
    const programTwo = await materializeBundledProgram(db, bundle, seedMap);

    expect(programOne.id).not.toBe(programTwo.id);

    const detailOne = await loadProgramDetail(db, programOne.id);
    const detailTwo = await loadProgramDetail(db, programTwo.id);
    const templateIdsOne = detailOne!.days.map((d) => d.template.template.id);
    const templateIdsTwo = detailTwo!.days.map((d) => d.template.template.id);
    expect(templateIdsOne.some((id) => templateIdsTwo.includes(id))).toBe(false);

    const active = await loadActiveProgram(db);
    expect(active?.program.id).toBe(programTwo.id);
  });
});

describe('startWorkoutFromProgramDay (advance / pointer)', () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('writes the origin marker and moves the active-program pointer to the started day', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    const bench = await seedExercise(db, 'Barbell Bench Press', 'barbell-bench-press-medium-grip');
    const bundle = twoDaySquatBenchBundle('barbell-squat', 'barbell-bench-press-medium-grip');
    const seedMap = new Map([
      [squat.seedId!, squat.id],
      [bench.seedId!, bench.id],
    ]);
    const program = await materializeBundledProgram(db, bundle, seedMap);

    const workout = await startWorkoutFromProgramDay(db, program.id, 1);

    expect(workout.programId).toBe(program.id);
    expect(workout.programDayPosition).toBe(1);

    const active = await loadActiveProgram(db);
    expect(active?.state.currentDayPosition).toBe(1);
  });
});

describe('origin marker guard (ad-hoc vs program workout)', () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('an ad-hoc startWorkoutFromTemplate leaves program_id null even when the template belongs to an active program', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    const bench = await seedExercise(db, 'Barbell Bench Press', 'barbell-bench-press-medium-grip');
    const bundle = twoDaySquatBenchBundle('barbell-squat', 'barbell-bench-press-medium-grip');
    const seedMap = new Map([
      [squat.seedId!, squat.id],
      [bench.seedId!, bench.id],
    ]);
    const program = await materializeBundledProgram(db, bundle, seedMap);

    const detail = await loadProgramDetail(db, program.id);
    const dayOneTemplateId = detail!.days[0]!.template.template.id;

    const adhocWorkout = await startWorkoutFromTemplate(db, dayOneTemplateId);

    expect(adhocWorkout.programId).toBeNull();
    expect(adhocWorkout.programDayPosition).toBeNull();
  });
});

describe('deleteProgram', () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('detaches referencing workouts and deletes program_state/program_days/programs', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    const bench = await seedExercise(db, 'Barbell Bench Press', 'barbell-bench-press-medium-grip');
    const bundle = twoDaySquatBenchBundle('barbell-squat', 'barbell-bench-press-medium-grip');
    const seedMap = new Map([
      [squat.seedId!, squat.id],
      [bench.seedId!, bench.id],
    ]);
    const program = await materializeBundledProgram(db, bundle, seedMap);
    const workout = await startWorkoutFromProgramDay(db, program.id, 0);

    await deleteProgram(db, program.id);

    const [reloadedWorkout] = await db.select().from(workouts).where(eq(workouts.id, workout.id));
    expect(reloadedWorkout?.programId).toBeNull();
    expect(reloadedWorkout?.programDayPosition).toBeNull();

    const stateRows = await db.select().from(programState).where(eq(programState.programId, program.id));
    expect(stateRows).toHaveLength(0);

    const dayRows = await db.select().from(programDays).where(eq(programDays.programId, program.id));
    expect(dayRows).toHaveLength(0);
  });
});

describe('training maxes', () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('setTrainingMax upserts and getTrainingMax reads it back', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');

    await setTrainingMax(db, squat.id, 120);
    let tm = await getTrainingMax(db, squat.id);
    expect(tm?.maxKg).toBe(120);

    await setTrainingMax(db, squat.id, 125);
    tm = await getTrainingMax(db, squat.id);
    expect(tm?.maxKg).toBe(125);
  });

  it('rejects a non-positive training max', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    await expect(setTrainingMax(db, squat.id, -5)).rejects.toThrow();
  });

  it('listProgramTrainingMaxes returns distinct percent_tm exercises with current max', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    const template = await createTemplate(db, { name: 'Week1 Squat', position: 0 });
    await setTemplateExercises(db, template.id, [
      {
        exerciseId: squat.id,
        position: 0,
        targetSets: 3,
        targetReps: 5,
        targetWeightKg: null,
        progression: JSON.stringify({ type: 'percent_tm', sets: [{ pct: 0.65, reps: 5 }] }),
      },
    ]);
    const program = await createProgram(db, { name: '%TM Program' });
    await addProgramDay(db, { programId: program.id, position: 0, templateId: template.id });
    await setTrainingMax(db, squat.id, 140);

    const tms = await listProgramTrainingMaxes(db, program.id);
    expect(tms).toEqual([{ exerciseId: squat.id, maxKg: 140 }]);
  });
});

describe('applyProgressionAndAdvance', () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  async function setupTwoDayLinearProgram(initialWeightKg = 100) {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    const templateA = await createTemplate(db, { name: 'Day A', position: 0 });
    await setTemplateExercises(db, templateA.id, [
      {
        exerciseId: squat.id,
        position: 0,
        targetSets: 5,
        targetReps: 5,
        targetWeightKg: initialWeightKg,
        progression: JSON.stringify({ type: 'linear', incrementKg: 2.5 }),
      },
    ]);
    const templateB = await createTemplate(db, { name: 'Day B', position: 0 });
    await setTemplateExercises(db, templateB.id, [
      {
        exerciseId: squat.id,
        position: 0,
        targetSets: 5,
        targetReps: 5,
        targetWeightKg: initialWeightKg,
        progression: JSON.stringify({ type: 'linear', incrementKg: 2.5 }),
      },
    ]);
    const program = await createProgram(db, { name: 'Linear Test' });
    await addProgramDay(db, { programId: program.id, position: 0, templateId: templateA.id });
    await addProgramDay(db, { programId: program.id, position: 1, templateId: templateB.id });
    return { program, squat, templateA, templateB };
  }

  async function logSets(workoutId: number, weightKg: number, reps: number, count = 5) {
    const detail = await loadWorkoutDetail(db, workoutId);
    const workoutExercise = detail!.exercises[0]!.workoutExercise;
    for (let i = 0; i < count; i++) {
      await insertSet(db, { workoutExerciseId: workoutExercise.id, setNumber: i + 1, weightKg, reps, type: 'normal' });
    }
  }

  it('linear success bumps weight, resets fails, and advances the pointer', async () => {
    const { program } = await setupTwoDayLinearProgram(100);
    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 5);
    await finishWorkout(db, workout.id);

    const result = await applyProgressionAndAdvance(db, workout.id);

    expect(result.applied).toBe(true);
    expect(result.outcomes).toHaveLength(1);
    const outcome = result.outcomes[0] as any;
    expect(outcome.type).toBe('linear');
    expect(outcome.outcome).toBe('success');
    expect(outcome.nextWeightKg).toBe(102.5);
    expect(result.nextPosition).toBe(1);
    expect(result.wrapped).toBe(false);
    expect(result.totalDays).toBe(2);

    const detail = await loadProgramDetail(db, program.id);
    const updatedTe = detail!.days[0]!.template.exercises[0]!.templateExercise;
    expect(updatedTe.targetWeightKg).toBe(102.5);
    expect(updatedTe.consecutiveFails).toBe(0);

    const active = await loadActiveProgram(db);
    expect(active?.state.currentDayPosition).toBe(1);
  });

  it('a miss holds the weight and increments the fail counter', async () => {
    const { program } = await setupTwoDayLinearProgram(100);
    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 3); // missed target reps
    await finishWorkout(db, workout.id);

    const result = await applyProgressionAndAdvance(db, workout.id);
    const outcome = result.outcomes[0] as any;
    expect(outcome.outcome).toBe('hold');
    expect(outcome.nextWeightKg).toBe(100);
    expect(outcome.consecutiveFails).toBe(1);

    const detail = await loadProgramDetail(db, program.id);
    const updatedTe = detail!.days[0]!.template.exercises[0]!.templateExercise;
    expect(updatedTe.targetWeightKg).toBe(100);
    expect(updatedTe.consecutiveFails).toBe(1);
  });

  it('three consecutive misses trigger exactly one deload on the third', async () => {
    const { program } = await setupTwoDayLinearProgram(100);

    let workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 3);
    await finishWorkout(db, workout.id);
    let result = await applyProgressionAndAdvance(db, workout.id);
    expect((result.outcomes[0] as any).outcome).toBe('hold');

    workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 3);
    await finishWorkout(db, workout.id);
    result = await applyProgressionAndAdvance(db, workout.id);
    expect((result.outcomes[0] as any).outcome).toBe('hold');

    workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 3);
    await finishWorkout(db, workout.id);
    result = await applyProgressionAndAdvance(db, workout.id);
    const outcome = result.outcomes[0] as any;
    expect(outcome.outcome).toBe('deload');
    expect(outcome.nextWeightKg).toBe(90);

    const detail = await loadProgramDetail(db, program.id);
    const updatedTe = detail!.days[0]!.template.exercises[0]!.templateExercise;
    expect(updatedTe.targetWeightKg).toBe(90);
    expect(updatedTe.consecutiveFails).toBe(0);
  });

  it('wraps the pointer from the last day back to 0 with wrapped:true', async () => {
    const { program } = await setupTwoDayLinearProgram(100);
    const workout = await startWorkoutFromProgramDay(db, program.id, 1);
    await logSets(workout.id, 100, 5);
    await finishWorkout(db, workout.id);

    const result = await applyProgressionAndAdvance(db, workout.id);
    expect(result.nextPosition).toBe(0);
    expect(result.wrapped).toBe(true);

    const active = await loadActiveProgram(db);
    expect(active?.state.currentDayPosition).toBe(0);
  });

  it('an ad-hoc workout (program_id null) returns an empty result with no writes', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    const template = await createTemplate(db, { name: 'Ad-hoc', position: 0 });
    await setTemplateExercises(db, template.id, [
      { exerciseId: squat.id, position: 0, targetSets: 5, targetReps: 5, targetWeightKg: 100 },
    ]);
    const workout = await startWorkoutFromTemplate(db, template.id);
    await logSets(workout.id, 100, 5);
    await finishWorkout(db, workout.id);

    const result = await applyProgressionAndAdvance(db, workout.id);
    expect(result.applied).toBe(false);
    expect(result.outcomes).toHaveLength(0);

    const active = await loadActiveProgram(db);
    expect(active).toBeUndefined();
  });

  it('skips a malformed (negative-increment) progression rule without throwing the whole finish', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    const template = await createTemplate(db, { name: 'Day A', position: 0 });
    await setTemplateExercises(db, template.id, [
      {
        exerciseId: squat.id,
        position: 0,
        targetSets: 5,
        targetReps: 5,
        targetWeightKg: 100,
        progression: JSON.stringify({ type: 'linear', incrementKg: -5 }),
      },
    ]);
    const program = await createProgram(db, { name: 'Malformed' });
    await addProgramDay(db, { programId: program.id, position: 0, templateId: template.id });

    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 5);
    await finishWorkout(db, workout.id);

    const applied = await applyProgressionAndAdvance(db, workout.id);
    expect(applied.applied).toBe(true);
    expect(applied.outcomes).toHaveLength(0);

    const detail = await loadProgramDetail(db, program.id);
    const te = detail!.days[0]!.template.exercises[0]!.templateExercise;
    expect(te.targetWeightKg).toBe(100);
  });
});

describe('bundled program seed mapping (seed mapping)', () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('resolves every seed_id in both bundles against the seeded exercise library (Pitfall 6)', async () => {
    const lifts = [
      { name: 'Barbell Squat', seedId: 'barbell-squat' },
      { name: 'Barbell Bench Press', seedId: 'barbell-bench-press-medium-grip' },
      { name: 'Barbell Deadlift', seedId: 'barbell-deadlift' },
      { name: 'Standing Military Press', seedId: 'standing-military-press' },
      { name: 'Bent Over Barbell Row', seedId: 'bent-over-barbell-row' },
    ];
    for (const lift of lifts) {
      await seedExercise(db, lift.name, lift.seedId);
    }

    const linearSeedMap = await resolveExerciseSeedIds(db, linear5x5);
    const waveSeedMap = await resolveExerciseSeedIds(db, percentWave);

    const linearSeedIds = new Set(linear5x5.days.flatMap((day) => day.exercises.map((exercise) => exercise.seedId)));
    const waveSeedIds = new Set(percentWave.days.flatMap((day) => day.exercises.map((exercise) => exercise.seedId)));

    for (const seedId of linearSeedIds) {
      expect(linearSeedMap.has(seedId)).toBe(true);
    }
    for (const seedId of waveSeedIds) {
      expect(waveSeedMap.has(seedId)).toBe(true);
    }
  });

  it('materializes linear5x5 into 2 program_days and percentWave into exactly 16', async () => {
    const lifts = [
      { name: 'Barbell Squat', seedId: 'barbell-squat' },
      { name: 'Barbell Bench Press', seedId: 'barbell-bench-press-medium-grip' },
      { name: 'Barbell Deadlift', seedId: 'barbell-deadlift' },
      { name: 'Standing Military Press', seedId: 'standing-military-press' },
      { name: 'Bent Over Barbell Row', seedId: 'bent-over-barbell-row' },
    ];
    for (const lift of lifts) {
      await seedExercise(db, lift.name, lift.seedId);
    }

    const linearSeedMap = await resolveExerciseSeedIds(db, linear5x5);
    const linearProgram = await materializeBundledProgram(db, linear5x5, linearSeedMap);
    const linearDayRows = await db.select().from(programDays).where(eq(programDays.programId, linearProgram.id));
    expect(linearDayRows).toHaveLength(2);

    const waveSeedMap = await resolveExerciseSeedIds(db, percentWave);
    const waveProgram = await materializeBundledProgram(db, percentWave, waveSeedMap);
    const waveDayRows = await db.select().from(programDays).where(eq(programDays.programId, waveProgram.id));
    expect(waveDayRows).toHaveLength(16);
  });
});
