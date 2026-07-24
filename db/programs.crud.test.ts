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
import { exercises, programDays, programExerciseProgress, programState, workouts } from './schema';
import { createTemplate, setTemplateExercises, startWorkoutFromTemplate } from './templates';
import { finishWorkout, insertSet, loadWorkoutDetail } from './workouts';
import {
  addProgramDay,
  applyProgressionAndAdvance,
  createProgram,
  deleteProgram,
  getProgramExerciseProgress,
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
import { computePercentTmWeight } from '../lib/progression';

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

  async function setupTwoDayLinearProgram(initialWeightKg: number | null = 100) {
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
    const { program, squat } = await setupTwoDayLinearProgram(100);
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

    const progress = await getProgramExerciseProgress(db, program.id, squat.id);
    expect(progress?.workingWeightKg).toBe(102.5);
    expect(progress?.consecutiveFails).toBe(0);

    const active = await loadActiveProgram(db);
    expect(active?.state.currentDayPosition).toBe(1);
  });

  // Cross-day write sharing (defect B): setupTwoDayLinearProgram's Day A and
  // Day B both use the SAME squat exercise. Finishing Day A success must
  // write exactly ONE program_exercise_progress row keyed (program, squat) —
  // never two independent per-day rows.
  it('CROSS-DAY WRITE SHARING: finishing Day A success writes exactly one shared per-lift row', async () => {
    const { program, squat } = await setupTwoDayLinearProgram(100);
    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 5);
    await finishWorkout(db, workout.id);
    await applyProgressionAndAdvance(db, workout.id);

    const rows = await db
      .select()
      .from(programExerciseProgress)
      .where(eq(programExerciseProgress.programId, program.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.exerciseId).toBe(squat.id);
    expect(rows[0]!.workingWeightKg).toBe(102.5);
  });

  it('deleteProgram removes the program_exercise_progress rows it wrote', async () => {
    const { program, squat } = await setupTwoDayLinearProgram(100);
    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 5);
    await finishWorkout(db, workout.id);
    await applyProgressionAndAdvance(db, workout.id);

    const before = await getProgramExerciseProgress(db, program.id, squat.id);
    expect(before?.workingWeightKg).toBe(102.5);

    await deleteProgram(db, program.id);

    const rows = await db
      .select()
      .from(programExerciseProgress)
      .where(eq(programExerciseProgress.programId, program.id));
    expect(rows).toHaveLength(0);
  });

  // CR-01 regression: every program-creation path (bundled materialization,
  // custom template builder) seeds target_weight_kg = null. The first finish
  // must anchor on the weight actually logged this session, not 0 — otherwise
  // a 100 kg squat prescribes 2.5 kg next (0 + increment) and crawls up forever.
  it('CR-01: null target anchors on the logged weight so success prescribes lifted+increment (not 2.5)', async () => {
    const { program, squat } = await setupTwoDayLinearProgram(null);
    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 5);
    await finishWorkout(db, workout.id);

    const result = await applyProgressionAndAdvance(db, workout.id);

    const outcome = result.outcomes[0] as any;
    expect(outcome.outcome).toBe('success');
    expect(outcome.nextWeightKg).toBe(102.5); // 100 + 2.5, never 0 + 2.5

    const progress = await getProgramExerciseProgress(db, program.id, squat.id);
    expect(progress?.workingWeightKg).toBe(102.5);
  });

  it('CR-01: a missed-reps finish with null target holds at the logged weight, not 0', async () => {
    const { program, squat } = await setupTwoDayLinearProgram(null);
    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 3); // missed target reps (5)
    await finishWorkout(db, workout.id);

    const result = await applyProgressionAndAdvance(db, workout.id);

    const outcome = result.outcomes[0] as any;
    expect(outcome.outcome).toBe('hold');
    expect(outcome.nextWeightKg).toBe(100); // holds at the logged weight, NOT 0

    const progress = await getProgramExerciseProgress(db, program.id, squat.id);
    expect(progress?.workingWeightKg).toBe(100);
    expect(progress?.consecutiveFails).toBe(1);
  });

  it('a miss holds the weight and increments the fail counter', async () => {
    const { program, squat } = await setupTwoDayLinearProgram(100);
    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout.id, 100, 3); // missed target reps
    await finishWorkout(db, workout.id);

    const result = await applyProgressionAndAdvance(db, workout.id);
    const outcome = result.outcomes[0] as any;
    expect(outcome.outcome).toBe('hold');
    expect(outcome.nextWeightKg).toBe(100);
    expect(outcome.consecutiveFails).toBe(1);

    const progress = await getProgramExerciseProgress(db, program.id, squat.id);
    expect(progress?.workingWeightKg).toBe(100);
    expect(progress?.consecutiveFails).toBe(1);
  });

  it('three consecutive misses trigger exactly one deload on the third', async () => {
    const { program, squat } = await setupTwoDayLinearProgram(100);

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

    const progress = await getProgramExerciseProgress(db, program.id, squat.id);
    expect(progress?.workingWeightKg).toBe(90);
    expect(progress?.consecutiveFails).toBe(0);
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

    const progress = await getProgramExerciseProgress(db, program.id, squat.id);
    expect(progress).toBeUndefined();
  });

  it('an ad-hoc finish (program_id null) writes nothing to program_exercise_progress', async () => {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat');
    const template = await createTemplate(db, { name: 'Ad-hoc', position: 0 });
    await setTemplateExercises(db, template.id, [
      {
        exerciseId: squat.id,
        position: 0,
        targetSets: 5,
        targetReps: 5,
        targetWeightKg: 100,
        progression: JSON.stringify({ type: 'linear', incrementKg: 2.5 }),
      },
    ]);
    const workout = await startWorkoutFromTemplate(db, template.id);
    await logSets(workout.id, 100, 5);
    await finishWorkout(db, workout.id);

    const result = await applyProgressionAndAdvance(db, workout.id);
    expect(result.applied).toBe(false);

    const rows = await db.select().from(programExerciseProgress);
    expect(rows).toHaveLength(0);
  });

  // Task 2 (PROG-02 blocker close): starting a linear day must now PRESCRIBE
  // sets at the lift's current per-lift working weight — mirrors %TM prefill.
  it('prescribes linear straight-sets at day start from the per-lift working weight', async () => {
    const { program, squat } = await setupTwoDayLinearProgram(100);
    const workoutA = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workoutA.id, 100, 5);
    await finishWorkout(db, workoutA.id);
    await applyProgressionAndAdvance(db, workoutA.id);

    const progress = await getProgramExerciseProgress(db, program.id, squat.id);
    expect(progress?.workingWeightKg).toBe(102.5);

    // Re-starting Day A (same lift) must now prescribe the bumped weight.
    const rerunWorkout = await startWorkoutFromProgramDay(db, program.id, 0);
    const detail = await loadWorkoutDetail(db, rerunWorkout.id);
    const sets = detail!.exercises[0]!.sets;
    expect(sets).toHaveLength(5); // targetSets
    for (const set of sets) {
      expect(set.weightKg).toBe(102.5);
      expect(set.reps).toBe(5); // targetReps
      expect(set.type).toBe('normal');
    }
  });

  // HEADLINE cross-day regression (the Test-3 blocker, defects A+B together):
  // setupTwoDayLinearProgram's Day A and Day B share the SAME squat exercise.
  it('HEADLINE: a Squat bump on Day A is prescribed on Day B (cross-day sharing)', async () => {
    const { program } = await setupTwoDayLinearProgram(100);

    const workoutA = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workoutA.id, 100, 5);
    await finishWorkout(db, workoutA.id);
    await applyProgressionAndAdvance(db, workoutA.id);

    const workoutB = await startWorkoutFromProgramDay(db, program.id, 1);
    const detailB = await loadWorkoutDetail(db, workoutB.id);
    const setsB = detailB!.exercises[0]!.sets;
    expect(setsB).toHaveLength(5);
    for (const set of setsB) {
      expect(set.weightKg).toBe(102.5); // NOT 100, NOT unchanged
    }
  });

  it('FIRST RUN: a fresh program with no prior finish inserts zero linear sets (falls back to last-performance/target)', async () => {
    const { program } = await setupTwoDayLinearProgram(100);
    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    const detail = await loadWorkoutDetail(db, workout.id);
    expect(detail!.exercises[0]!.sets).toHaveLength(0);
  });

  it('honors targetSets (a 1-set linear exercise prescribes exactly 1 set, not a fixed 5)', async () => {
    const deadlift = await seedExercise(db, 'Barbell Deadlift', 'barbell-deadlift');
    const template = await createTemplate(db, { name: 'Deadlift Day', position: 0 });
    await setTemplateExercises(db, template.id, [
      {
        exerciseId: deadlift.id,
        position: 0,
        targetSets: 1,
        targetReps: 5,
        targetWeightKg: 100,
        progression: JSON.stringify({ type: 'linear', incrementKg: 5 }),
      },
    ]);
    const program = await createProgram(db, { name: 'Deadlift Only' });
    await addProgramDay(db, { programId: program.id, position: 0, templateId: template.id });

    const workout1 = await startWorkoutFromProgramDay(db, program.id, 0);
    await logSets(workout1.id, 100, 5, 1);
    await finishWorkout(db, workout1.id);
    await applyProgressionAndAdvance(db, workout1.id);

    const workout2 = await startWorkoutFromProgramDay(db, program.id, 0);
    const detail2 = await loadWorkoutDetail(db, workout2.id);
    const sets2 = detail2!.exercises[0]!.sets;
    expect(sets2).toHaveLength(1);
    expect(sets2[0]!.weightKg).toBe(105);
    expect(sets2[0]!.reps).toBe(5);
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

describe('%TM prescribed-weight prefill + TM bump on cycle wrap (06-05 Task 2)', () => {
  let db: TestDb;

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  const WAVE_SCHEME = {
    type: 'percent_tm',
    sets: [
      { pct: 0.65, reps: 5 },
      { pct: 0.75, reps: 5 },
      { pct: 0.85, reps: 5, amrap: true },
    ],
  };

  async function setupTwoDayPercentTmProgram() {
    const squat = await seedExercise(db, 'Barbell Squat', 'barbell-squat'); // lower, +5
    const bench = await seedExercise(db, 'Barbell Bench Press', 'barbell-bench-press-medium-grip'); // upper, +2.5

    const templateA = await createTemplate(db, { name: 'Day A', position: 0 });
    await setTemplateExercises(db, templateA.id, [
      {
        exerciseId: squat.id,
        position: 0,
        targetSets: 3,
        targetReps: 5,
        targetWeightKg: null,
        progression: JSON.stringify(WAVE_SCHEME),
      },
    ]);
    const templateB = await createTemplate(db, { name: 'Day B', position: 0 });
    await setTemplateExercises(db, templateB.id, [
      {
        exerciseId: bench.id,
        position: 0,
        targetSets: 3,
        targetReps: 5,
        targetWeightKg: null,
        progression: JSON.stringify(WAVE_SCHEME),
      },
    ]);

    const program = await createProgram(db, { name: '%TM Test' });
    await addProgramDay(db, { programId: program.id, position: 0, templateId: templateA.id });
    await addProgramDay(db, { programId: program.id, position: 1, templateId: templateB.id });
    return { program, squat, bench };
  }

  it('prefills prescribed set weights from the training max via computePercentTmWeight (plate-loadable, not raw TM*pct)', async () => {
    const { program, squat } = await setupTwoDayPercentTmProgram();
    await setTrainingMax(db, squat.id, 100);

    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    const detail = await loadWorkoutDetail(db, workout.id);
    const sets = detail!.exercises[0]!.sets;

    expect(sets).toHaveLength(3);
    expect(sets[0]!.weightKg).toBe(computePercentTmWeight(100, 0.65, 20, 'kg'));
    expect(sets[1]!.weightKg).toBe(computePercentTmWeight(100, 0.75, 20, 'kg'));
    expect(sets[2]!.weightKg).toBe(computePercentTmWeight(100, 0.85, 20, 'kg'));
    expect(sets[0]!.reps).toBe(5);
    expect(sets[0]!.type).toBe('normal');
    // Assumption A2: each weight is asserted directly against the delegated
    // computePercentTmWeight call above (plate-loadable), never a raw,
    // unrounded TM*pct value inlined separately in this test.
  });

  it('leaves weights unprescribed (no sets inserted) when the training max is missing', async () => {
    const { program } = await setupTwoDayPercentTmProgram();

    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    const detail = await loadWorkoutDetail(db, workout.id);
    expect(detail!.exercises[0]!.sets).toHaveLength(0);
  });

  it('does not bump the training max on a non-wrapping finish (day 0 of 2)', async () => {
    const { program, squat } = await setupTwoDayPercentTmProgram();
    await setTrainingMax(db, squat.id, 100);

    const workout = await startWorkoutFromProgramDay(db, program.id, 0);
    await finishWorkout(db, workout.id);
    const result = await applyProgressionAndAdvance(db, workout.id);

    expect(result.wrapped).toBe(false);
    expect(result.bumpedTrainingMaxes).toHaveLength(0);

    const tm = await getTrainingMax(db, squat.id);
    expect(tm?.maxKg).toBe(100);
  });

  it('bumps every distinct %TM exercise exactly once by its upper/lower amount on the cycle-wrapping finish', async () => {
    const { program, squat, bench } = await setupTwoDayPercentTmProgram();
    await setTrainingMax(db, squat.id, 100); // lower, +5
    await setTrainingMax(db, bench.id, 80); // upper, +2.5

    const workoutA = await startWorkoutFromProgramDay(db, program.id, 0);
    await finishWorkout(db, workoutA.id);
    const resultA = await applyProgressionAndAdvance(db, workoutA.id);
    expect(resultA.wrapped).toBe(false);
    expect(resultA.bumpedTrainingMaxes).toHaveLength(0);

    const workoutB = await startWorkoutFromProgramDay(db, program.id, 1);
    await finishWorkout(db, workoutB.id);
    const resultB = await applyProgressionAndAdvance(db, workoutB.id);

    expect(resultB.wrapped).toBe(true);
    expect(resultB.bumpedTrainingMaxes).toHaveLength(2);

    const squatTm = await getTrainingMax(db, squat.id);
    const benchTm = await getTrainingMax(db, bench.id);
    expect(squatTm?.maxKg).toBe(105); // lower +5
    expect(benchTm?.maxKg).toBe(82.5); // upper +2.5
  });
});
