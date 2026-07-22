// TMPL-01/TMPL-02 query-layer tests (db/templates.ts read path).
//
// Subjects under test:
//   - loadTemplateDetail: ordered template/template_exercises read
//   - loadTemplatesGroupedByFolder: folder grouping, Uncategorized last (A3),
//     case-insensitive named-folder sort (A4), within-folder position order (A5)
//   - loadFolderNames: distinct non-null folder names for tap-suggestions (D-04)
//   - startWorkoutFromTemplate: copies template_exercises in position order
//     and sets workouts.template_id (TMPL-02)

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { exercises, workoutExercises, workouts } from './schema';
import { addTemplateExercise, createTemplate, loadFolderNames, loadTemplateDetail, loadTemplatesGroupedByFolder, startWorkoutFromTemplate } from './templates';

async function seedExercise(db: ReturnType<typeof createTestDb>['db'], name = 'Squat') {
  const [exercise] = await db
    .insert(exercises)
    .values({ name, muscleGroup: 'Legs', equipment: 'Barbell', isCustom: false, archived: false })
    .returning();
  return exercise;
}

describe('loadTemplateDetail', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns undefined for a non-existent template', async () => {
    const detail = await loadTemplateDetail(db, 999);
    expect(detail).toBeUndefined();
  });

  it('returns the template with exercises ordered by position', async () => {
    const bench = await seedExercise(db, 'Bench Press');
    const squat = await seedExercise(db, 'Squat');
    const template = await createTemplate(db, { name: 'Full Body', position: 0 });

    await addTemplateExercise(db, {
      templateId: template.id,
      exerciseId: squat.id,
      position: 1,
      targetSets: 5,
      targetReps: 5,
      targetWeightKg: 100,
    });
    await addTemplateExercise(db, {
      templateId: template.id,
      exerciseId: bench.id,
      position: 0,
      targetSets: 3,
      targetReps: 8,
      targetWeightKg: null,
    });

    const detail = await loadTemplateDetail(db, template.id);

    expect(detail?.template.id).toBe(template.id);
    expect(detail?.exercises.map((e) => e.templateExercise.exerciseId)).toEqual([bench.id, squat.id]);
  });
});

describe('loadTemplatesGroupedByFolder', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('sorts Uncategorized (folder null) LAST and named folders case-insensitively (A3/A4)', async () => {
    await createTemplate(db, { name: 'Zeta', folder: 'zeta folder', position: 0 });
    await createTemplate(db, { name: 'Alpha', folder: 'Alpha Folder', position: 0 });
    await createTemplate(db, { name: 'No Folder', folder: null, position: 0 });

    const groups = await loadTemplatesGroupedByFolder(db);

    expect(groups.map((g) => g.folder)).toEqual(['Alpha Folder', 'zeta folder', null]);
  });

  it('orders templates within a folder by position (A5)', async () => {
    const folder = 'Upper Body';
    const second = await createTemplate(db, { name: 'Second', folder, position: 1 });
    const first = await createTemplate(db, { name: 'First', folder, position: 0 });

    const groups = await loadTemplatesGroupedByFolder(db);
    const group = groups.find((g) => g.folder === folder);

    expect(group?.templates.map((t) => t.id)).toEqual([first.id, second.id]);
  });
});

describe('loadFolderNames', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns distinct non-null folder names, case-insensitively ordered', async () => {
    await createTemplate(db, { name: 'A', folder: 'Legs', position: 0 });
    await createTemplate(db, { name: 'B', folder: 'Legs', position: 1 });
    await createTemplate(db, { name: 'C', folder: 'arms', position: 2 });
    await createTemplate(db, { name: 'D', folder: null, position: 3 });

    const names = await loadFolderNames(db);

    expect(names).toEqual(['arms', 'Legs']);
  });
});

describe('startWorkoutFromTemplate', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('creates workout_exercises in template_exercises position order and sets workouts.template_id (TMPL-02)', async () => {
    const bench = await seedExercise(db, 'Bench Press');
    const squat = await seedExercise(db, 'Squat');
    const template = await createTemplate(db, { name: 'Full Body', position: 0 });

    await addTemplateExercise(db, {
      templateId: template.id,
      exerciseId: squat.id,
      position: 1,
      targetSets: 5,
      targetReps: 5,
      targetWeightKg: 100,
    });
    await addTemplateExercise(db, {
      templateId: template.id,
      exerciseId: bench.id,
      position: 0,
      targetSets: 3,
      targetReps: 8,
      targetWeightKg: null,
    });

    const workout = await startWorkoutFromTemplate(db, template.id);

    const [reloadedWorkout] = await db.select().from(workouts).where(eq(workouts.id, workout.id));
    expect(reloadedWorkout.templateId).toBe(template.id);

    const weRows = await db
      .select()
      .from(workoutExercises)
      .where(eq(workoutExercises.workoutId, workout.id))
      .orderBy(workoutExercises.position);

    expect(weRows.map((r) => r.exerciseId)).toEqual([bench.id, squat.id]);
    expect(weRows.map((r) => r.position)).toEqual([0, 1]);
  });
});
