// TMPL-01 mutation-layer tests (db/templates.ts write path).
//
// Subjects under test:
//   - createTemplate / updateTemplate: validated create + partial-patch update
//   - addTemplateExercise / setTemplateExercises: template exercise writes
//   - deleteTemplate: detach-before-delete (Pitfall 3) — a workout referencing
//     a deleted template must have its template_id nulled, never dangling

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { exercises, templateExercises, templates, workouts } from './schema';
import { addWorkoutExercise, startWorkout } from './workouts';
import {
  addTemplateExercise,
  createTemplate,
  deleteTemplate,
  setTemplateExercises,
  updateTemplate,
} from './templates';

async function seedExercise(db: ReturnType<typeof createTestDb>['db'], name = 'Bench Press') {
  const [exercise] = await db
    .insert(exercises)
    .values({ name, muscleGroup: 'Chest', equipment: 'Barbell', isCustom: false, archived: false })
    .returning();
  return exercise;
}

describe('createTemplate', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('trims name/folder and inserts a template row', async () => {
    const template = await createTemplate(db, { name: '  Push Day  ', folder: '  Upper Body  ', position: 0 });

    expect(template.name).toBe('Push Day');
    expect(template.folder).toBe('Upper Body');
    expect(template.position).toBe(0);
  });

  it('normalizes an empty/blank folder to null', async () => {
    const template = await createTemplate(db, { name: 'Leg Day', folder: '   ', position: 0 });
    expect(template.folder).toBeNull();

    const noFolder = await createTemplate(db, { name: 'Arm Day', position: 1 });
    expect(noFolder.folder).toBeNull();
  });

  it('rejects an over-cap name before insert', async () => {
    const tooLong = 'x'.repeat(201);
    await expect(createTemplate(db, { name: tooLong, position: 0 })).rejects.toThrow();

    const rows = await db.select().from(templates);
    expect(rows).toHaveLength(0);
  });
});

describe('updateTemplate', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('applies only the supplied fields', async () => {
    const template = await createTemplate(db, { name: 'Push Day', folder: 'Upper', position: 0, notes: 'v1' });

    const updated = await updateTemplate(db, template.id, { name: 'Push Day A' });

    expect(updated.name).toBe('Push Day A');
    expect(updated.folder).toBe('Upper');
    expect(updated.notes).toBe('v1');
  });

  it('rejects an invalid patch (over-cap name)', async () => {
    const template = await createTemplate(db, { name: 'Push Day', position: 0 });

    await expect(updateTemplate(db, template.id, { name: 'x'.repeat(201) })).rejects.toThrow();
  });
});

describe('addTemplateExercise / setTemplateExercises', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('inserts a template exercise with target sets/reps/weight', async () => {
    const exercise = await seedExercise(db);
    const template = await createTemplate(db, { name: 'Push Day', position: 0 });

    const te = await addTemplateExercise(db, {
      templateId: template.id,
      exerciseId: exercise.id,
      position: 0,
      targetSets: 3,
      targetReps: 8,
      targetWeightKg: 60,
    });

    expect(te.targetSets).toBe(3);
    expect(te.targetReps).toBe(8);
    expect(te.targetWeightKg).toBe(60);
  });

  it('accepts a null targetWeightKg (D-02 save-as-template convention)', async () => {
    const exercise = await seedExercise(db);
    const template = await createTemplate(db, { name: 'Push Day', position: 0 });

    const te = await addTemplateExercise(db, {
      templateId: template.id,
      exerciseId: exercise.id,
      position: 0,
      targetSets: 3,
      targetReps: 8,
      targetWeightKg: null,
    });

    expect(te.targetWeightKg).toBeNull();
  });

  it('rejects a negative targetReps before insert', async () => {
    const exercise = await seedExercise(db);
    const template = await createTemplate(db, { name: 'Push Day', position: 0 });

    await expect(
      addTemplateExercise(db, {
        templateId: template.id,
        exerciseId: exercise.id,
        position: 0,
        targetSets: 3,
        targetReps: -1,
        targetWeightKg: null,
      }),
    ).rejects.toThrow();
  });

  it('setTemplateExercises replaces existing rows transactionally, position-ordered', async () => {
    const benchEx = await seedExercise(db, 'Bench Press');
    const squatEx = await seedExercise(db, 'Squat');
    const template = await createTemplate(db, { name: 'Full Body', position: 0 });

    await addTemplateExercise(db, {
      templateId: template.id,
      exerciseId: benchEx.id,
      position: 0,
      targetSets: 3,
      targetReps: 8,
      targetWeightKg: null,
    });

    await setTemplateExercises(db, template.id, [
      { exerciseId: squatEx.id, position: 0, targetSets: 5, targetReps: 5, targetWeightKg: 100 },
      { exerciseId: benchEx.id, position: 1, targetSets: 3, targetReps: 8, targetWeightKg: 60 },
    ]);

    const rows = await db
      .select()
      .from(templateExercises)
      .where(eq(templateExercises.templateId, template.id))
      .orderBy(templateExercises.position);

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.exerciseId)).toEqual([squatEx.id, benchEx.id]);
    expect(rows[0].targetSets).toBe(5);
  });
});

describe('deleteTemplate', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('deletes the template and its template_exercises rows', async () => {
    const exercise = await seedExercise(db);
    const template = await createTemplate(db, { name: 'Push Day', position: 0 });
    await addTemplateExercise(db, {
      templateId: template.id,
      exerciseId: exercise.id,
      position: 0,
      targetSets: 3,
      targetReps: 8,
      targetWeightKg: null,
    });

    await deleteTemplate(db, template.id);

    const remainingTemplates = await db.select().from(templates).where(eq(templates.id, template.id));
    const remainingTe = await db
      .select()
      .from(templateExercises)
      .where(eq(templateExercises.templateId, template.id));

    expect(remainingTemplates).toHaveLength(0);
    expect(remainingTe).toHaveLength(0);
  });

  it('detaches (nulls) any workouts.template_id that referenced it, never dangling (Pitfall 3)', async () => {
    const exercise = await seedExercise(db);
    const template = await createTemplate(db, { name: 'Push Day', position: 0 });
    await addTemplateExercise(db, {
      templateId: template.id,
      exerciseId: exercise.id,
      position: 0,
      targetSets: 3,
      targetReps: 8,
      targetWeightKg: null,
    });

    const workout = await startWorkout(db, { templateId: template.id });
    await addWorkoutExercise(db, workout.id, exercise.id, 0);

    await deleteTemplate(db, template.id);

    const [reloadedWorkout] = await db.select().from(workouts).where(eq(workouts.id, workout.id));
    expect(reloadedWorkout.templateId).toBeNull();
  });

  it('does not affect an unrelated template', async () => {
    const templateA = await createTemplate(db, { name: 'Delete me', position: 0 });
    const templateB = await createTemplate(db, { name: 'Keep me', position: 1 });

    await deleteTemplate(db, templateA.id);

    const remaining = await db.select().from(templates);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(templateB.id);
  });
});
