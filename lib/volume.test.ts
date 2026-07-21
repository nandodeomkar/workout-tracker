// D-03 / D-10: working-set volume (warmup-excluding) tests.

import { describe, expect, it } from 'vitest';

import { workingSetVolume } from './volume';

describe('workingSetVolume', () => {
  it('sums only non-warmup sets, excluding warmups', () => {
    const sets = [
      { weightKg: 100, reps: 5, type: 'normal' },
      { weightKg: 100, reps: 5, type: 'normal' },
      { weightKg: 40, reps: 10, type: 'warmup' },
    ];
    expect(workingSetVolume(sets)).toBe(1000);
  });

  it('returns 0 for an empty array', () => {
    expect(workingSetVolume([])).toBe(0);
  });

  it('returns 0 for an all-warmup session', () => {
    const sets = [
      { weightKg: 40, reps: 10, type: 'warmup' },
      { weightKg: 60, reps: 5, type: 'warmup' },
    ];
    expect(workingSetVolume(sets)).toBe(0);
  });
});
