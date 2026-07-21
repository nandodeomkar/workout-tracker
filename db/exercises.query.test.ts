// EXER-01 filter pipeline + query-layer tests (D-06/D-07/D-11).
//
// Two subjects under test:
//   - filterExercises (lib/exerciseFilter.ts): pure, in-memory filter pipeline
//   - loadActiveExercises (db/exercises.ts): archived-visible A-Z query layer
//     proven against an in-memory better-sqlite3 database (createTestDb()).

import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { exercises, type Exercise } from './schema';
import { filterExercises } from '../lib/exerciseFilter';
import { loadActiveExercises } from './exercises';

function makeRow(overrides: Partial<Exercise> & Pick<Exercise, 'id' | 'name'>): Exercise {
  return {
    muscleGroup: 'Chest',
    equipment: 'Barbell',
    isCustom: false,
    notes: null,
    seedId: null,
    archived: false,
    ...overrides,
  };
}

describe('filterExercises', () => {
  const rows: Exercise[] = [
    makeRow({ id: 1, name: 'Barbell Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' }),
    makeRow({ id: 2, name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Dumbbell' }),
    makeRow({ id: 3, name: 'Cable Fly', muscleGroup: 'Chest', equipment: 'Cable' }),
    makeRow({ id: 4, name: 'Barbell Back Squat', muscleGroup: 'Quads', equipment: 'Barbell' }),
    makeRow({ id: 5, name: 'Bodyweight Pull-up', muscleGroup: 'Back', equipment: 'Bodyweight' }),
  ];

  it('empty filter returns all input rows unchanged (order preserved)', () => {
    const result = filterExercises(rows, { search: '', muscleGroups: [], equipment: [] });
    expect(result).toEqual(rows);
  });

  it('search matches case-insensitively as a substring anywhere in the name', () => {
    const result = filterExercises(rows, { search: 'bench', muscleGroups: [], equipment: [] });
    expect(result.map((r) => r.id)).toEqual([1]);

    const midWord = filterExercises(rows, { search: 'ELL BAC', muscleGroups: [], equipment: [] });
    expect(midWord.map((r) => r.id)).toEqual([4]);
  });

  it('search matches only name, never muscle group or equipment text', () => {
    // "Chest" is a muscleGroup value on rows 1 and 3, but appears in no name.
    const result = filterExercises(rows, { search: 'Chest', muscleGroups: [], equipment: [] });
    expect(result).toEqual([]);
  });

  it('muscleGroups filter is OR within the row; empty array = no constraint', () => {
    const result = filterExercises(rows, { search: '', muscleGroups: ['Chest', 'Back'], equipment: [] });
    expect(result.map((r) => r.id).sort()).toEqual([1, 3, 5]);
  });

  it('equipment filter is OR within the row; empty array = no constraint', () => {
    const result = filterExercises(rows, { search: '', muscleGroups: [], equipment: ['Barbell', 'Cable'] });
    expect(result.map((r) => r.id).sort()).toEqual([1, 3, 4]);
  });

  it('muscle and equipment filters AND together across rows', () => {
    // Chest OR Quads muscle AND Barbell equipment -> only rows matching both.
    const result = filterExercises(rows, {
      search: '',
      muscleGroups: ['Chest', 'Quads'],
      equipment: ['Barbell'],
    });
    expect(result.map((r) => r.id).sort()).toEqual([1, 4]);
  });

  it('search AND chip filters all combine together', () => {
    const result = filterExercises(rows, {
      search: 'press',
      muscleGroups: ['Chest'],
      equipment: ['Barbell'],
    });
    expect(result.map((r) => r.id)).toEqual([1]);
  });
});

describe('loadActiveExercises', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('excludes archived rows and returns results ordered A-Z (case-insensitive)', async () => {
    await db.insert(exercises).values([
      { name: 'zebra kick', muscleGroup: 'Quads', equipment: 'Bodyweight', isCustom: false, archived: false },
      { name: 'Apple Press', muscleGroup: 'Chest', equipment: 'Barbell', isCustom: false, archived: false },
      { name: 'mango Curl', muscleGroup: 'Biceps', equipment: 'Dumbbell', isCustom: false, archived: false },
      { name: 'Banned Row', muscleGroup: 'Back', equipment: 'Cable', isCustom: false, archived: true },
    ]);

    const result = await loadActiveExercises(db);

    expect(result.map((r) => r.name)).toEqual(['Apple Press', 'mango Curl', 'zebra kick']);
    expect(result.every((r) => r.archived === false)).toBe(true);
  });

  it('returns an empty array when no active exercises exist', async () => {
    await db.insert(exercises).values([
      { name: 'Only Archived', muscleGroup: 'Core', equipment: 'Other', isCustom: false, archived: true },
    ]);

    const result = await loadActiveExercises(db);
    expect(result).toEqual([]);
  });
});
