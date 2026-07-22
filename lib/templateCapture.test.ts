// D-02: save-as-template capture (working-set count + typical reps, null weight) tests.

import { describe, expect, it } from 'vitest';

import { buildTemplateExercisesFromWorkout } from './templateCapture';

describe('buildTemplateExercisesFromWorkout', () => {
  it('straight sets: targetSets counts all sets, targetReps is the last set reps', () => {
    const result = buildTemplateExercisesFromWorkout([
      {
        exerciseId: 1,
        sets: [
          { reps: 8, type: 'normal' },
          { reps: 8, type: 'normal' },
          { reps: 8, type: 'normal' },
        ],
      },
    ]);
    expect(result).toEqual([
      { exerciseId: 1, position: 0, targetSets: 3, targetReps: 8, targetWeightKg: null },
    ]);
  });

  it('warmups are excluded from the targetSets count', () => {
    const result = buildTemplateExercisesFromWorkout([
      {
        exerciseId: 1,
        sets: [
          { reps: 10, type: 'warmup' },
          { reps: 8, type: 'normal' },
          { reps: 8, type: 'normal' },
        ],
      },
    ]);
    expect(result[0].targetSets).toBe(2);
  });

  it('targetReps is the LAST non-warmup set reps (A2), not the first or a warmup', () => {
    const result = buildTemplateExercisesFromWorkout([
      {
        exerciseId: 1,
        sets: [
          { reps: 12, type: 'warmup' },
          { reps: 10, type: 'normal' },
          { reps: 6, type: 'normal' },
        ],
      },
    ]);
    expect(result[0].targetReps).toBe(6);
  });

  it('targetWeightKg is always null', () => {
    const result = buildTemplateExercisesFromWorkout([
      { exerciseId: 1, sets: [{ reps: 8, type: 'normal' }] },
    ]);
    expect(result[0].targetWeightKg).toBeNull();
  });

  it('position matches input index across multiple exercises', () => {
    const result = buildTemplateExercisesFromWorkout([
      { exerciseId: 5, sets: [{ reps: 8, type: 'normal' }] },
      { exerciseId: 9, sets: [{ reps: 10, type: 'normal' }] },
    ]);
    expect(result[0]).toMatchObject({ exerciseId: 5, position: 0 });
    expect(result[1]).toMatchObject({ exerciseId: 9, position: 1 });
  });

  it('all-warmup edge case: targetSets 0, targetReps 0, exercise still included', () => {
    const result = buildTemplateExercisesFromWorkout([
      {
        exerciseId: 1,
        sets: [
          { reps: 8, type: 'warmup' },
          { reps: 8, type: 'warmup' },
        ],
      },
    ]);
    expect(result).toEqual([
      { exerciseId: 1, position: 0, targetSets: 0, targetReps: 0, targetWeightKg: null },
    ]);
  });
});
