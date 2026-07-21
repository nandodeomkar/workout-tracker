// EXER-02 mutation-layer tests (D-09/D-10/D-11/D-12).
//
// Subjects under test (db/exercises.ts):
//   - createExercise: insert a custom exercise, name-required validation
//   - updateExercise: edit-in-place, including seeded rows (D-10)
//   - setArchived: reversible archive/unarchive, no hard delete (D-11)
//   - findByName: case-insensitive name lookup, used for the D-12 duplicate warning

import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { exercises } from './schema';
import { createExercise, findByName, setArchived, updateExercise } from './exercises';

describe('createExercise', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('inserts a custom exercise with is_custom=true, archived=false, seed_id=null', async () => {
    const created = await createExercise(db, {
      name: 'Cable Pullover',
      muscleGroup: 'Back',
      equipment: 'Cable',
    });

    expect(created.isCustom).toBe(true);
    expect(created.archived).toBe(false);
    expect(created.seedId).toBeNull();
    expect(created.name).toBe('Cable Pullover');
  });

  it('persists notes when provided', async () => {
    const created = await createExercise(db, {
      name: 'Reverse Curl',
      muscleGroup: 'Biceps',
      equipment: 'Barbell',
      notes: 'Wide grip, focus on forearms',
    });

    expect(created.notes).toBe('Wide grip, focus on forearms');
  });

  it('rejects an empty or whitespace-only name', async () => {
    await expect(
      createExercise(db, { name: '', muscleGroup: 'Chest', equipment: 'Barbell' }),
    ).rejects.toThrow();

    await expect(
      createExercise(db, { name: '   ', muscleGroup: 'Chest', equipment: 'Barbell' }),
    ).rejects.toThrow();
  });

  it('allows creating a duplicate name (warn-but-allow is a UI concern, D-12)', async () => {
    await createExercise(db, { name: 'Push-up', muscleGroup: 'Chest', equipment: 'Bodyweight' });
    const second = await createExercise(db, {
      name: 'Push-up',
      muscleGroup: 'Chest',
      equipment: 'Bodyweight',
    });

    expect(second.name).toBe('Push-up');

    const matches = await findByName(db, 'Push-up');
    expect(matches).toHaveLength(2);
  });
});

describe('findByName', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('matches case-insensitively', async () => {
    await db.insert(exercises).values({
      name: 'Barbell Row',
      muscleGroup: 'Back',
      equipment: 'Barbell',
      isCustom: false,
      archived: false,
    });

    const matches = await findByName(db, 'barbell row');
    expect(matches).toHaveLength(1);
    expect(matches[0].name).toBe('Barbell Row');
  });

  it('returns an empty array when no exercise matches', async () => {
    const matches = await findByName(db, 'Nonexistent Exercise');
    expect(matches).toEqual([]);
  });
});

describe('updateExercise', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('edits a SEEDED row in place while preserving seed_id and is_custom (D-10)', async () => {
    const [seeded] = await db
      .insert(exercises)
      .values({
        name: 'Barbell Bench Press',
        muscleGroup: 'Chest',
        equipment: 'Barbell',
        isCustom: false,
        archived: false,
        seedId: 'barbell-bench-press',
      })
      .returning();

    const updated = await updateExercise(db, seeded.id, {
      name: 'Flat Barbell Bench Press',
      muscleGroup: 'Chest',
      equipment: 'Barbell',
      notes: 'Pause at chest',
    });

    expect(updated.name).toBe('Flat Barbell Bench Press');
    expect(updated.notes).toBe('Pause at chest');
    // The load-bearing D-10 assertions: seed lineage is never disturbed by an edit.
    expect(updated.seedId).toBe('barbell-bench-press');
    expect(updated.isCustom).toBe(false);
  });

  it('edits a custom row in place', async () => {
    const created = await createExercise(db, {
      name: 'Old Name',
      muscleGroup: 'Core',
      equipment: 'Other',
    });

    const updated = await updateExercise(db, created.id, {
      name: 'New Name',
      muscleGroup: 'Core',
      equipment: 'Other',
    });

    expect(updated.name).toBe('New Name');
    expect(updated.isCustom).toBe(true);
    expect(updated.seedId).toBeNull();
  });
});

describe('setArchived', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('toggles archived both directions and preserves all other columns (D-11)', async () => {
    const created = await createExercise(db, {
      name: 'Leg Press',
      muscleGroup: 'Quads',
      equipment: 'Machine',
      notes: 'Feet high on platform',
    });

    const archived = await setArchived(db, created.id, true);
    expect(archived.archived).toBe(true);
    expect(archived.name).toBe('Leg Press');
    expect(archived.muscleGroup).toBe('Quads');
    expect(archived.equipment).toBe('Machine');
    expect(archived.notes).toBe('Feet high on platform');

    const unarchived = await setArchived(db, created.id, false);
    expect(unarchived.archived).toBe(false);
    expect(unarchived.name).toBe('Leg Press');
  });

  it('is reversible for a seeded row and never deletes it', async () => {
    const [seeded] = await db
      .insert(exercises)
      .values({
        name: 'Seeded Squat',
        muscleGroup: 'Quads',
        equipment: 'Barbell',
        isCustom: false,
        archived: false,
        seedId: 'seeded-squat',
      })
      .returning();

    await setArchived(db, seeded.id, true);
    const row = await findByName(db, 'Seeded Squat');
    expect(row).toHaveLength(1);
    expect(row[0].archived).toBe(true);
    expect(row[0].seedId).toBe('seeded-squat');
  });
});
