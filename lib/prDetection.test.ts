// D-10: PR detection (heaviest weight + best e1RM vs prior history) tests.

import { describe, expect, it } from 'vitest';

import { estimate1RM } from './estimate1RM';
import { detectPRs } from './prDetection';

describe('detectPRs', () => {
  it('first-ever set (no prior history) yields both a weight and e1rm hit', () => {
    const hits = detectPRs(
      [{ exerciseId: 1, weightKg: 100, reps: 5, type: 'normal' }],
      []
    );
    expect(hits).toHaveLength(2);
    expect(hits).toEqual(
      expect.arrayContaining([
        { exerciseId: 1, kind: 'weight', weightKg: 100, reps: 5 },
        { exerciseId: 1, kind: 'e1rm', weightKg: 100, reps: 5 },
      ])
    );
  });

  it('a session exactly equalling prior bests yields no PRs (strict >)', () => {
    const hits = detectPRs(
      [{ exerciseId: 1, weightKg: 100, reps: 5, type: 'normal' }],
      [{ exerciseId: 1, bestWeightKg: 100, bestE1RM: estimate1RM(100, 5) }]
    );
    expect(hits).toEqual([]);
  });

  it('heavier weight but lower reps still counts as a weight PR even without an e1rm PR', () => {
    const hits = detectPRs(
      [{ exerciseId: 1, weightKg: 100, reps: 1, type: 'normal' }],
      [{ exerciseId: 1, bestWeightKg: 90, bestE1RM: estimate1RM(90, 10) }]
    );
    expect(hits).toEqual([{ exerciseId: 1, kind: 'weight', weightKg: 100, reps: 1 }]);
  });

  it('a warmup-only session yields no PRs', () => {
    const hits = detectPRs(
      [{ exerciseId: 1, weightKg: 100, reps: 5, type: 'warmup' }],
      []
    );
    expect(hits).toEqual([]);
  });
});
