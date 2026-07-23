// PROG-02/PROG-03: progression resolver tests (D-06/D-08/D-10/D-12/D-13).
// Mirrors lib/estimate1RM.test.ts / lib/plateSolver.test.ts conventions:
// one describe block per exported function, plain input->output asserts.

import { describe, expect, it } from 'vitest';

import {
  bumpTrainingMax,
  computePercentTmWeight,
  computeTrainingMaxFromOneRepMax,
  DEFAULT_DELOAD_PCT,
  DEFAULT_FAIL_THRESHOLD,
  DEFAULT_LINEAR_INCREMENT_KG,
  DEFAULT_TM_BUMP_KG,
  DEFAULT_TM_PERCENT,
  DEFAULT_WAVE_SCHEME,
  evaluateLinearSuccess,
  nextDayPosition,
  resolveLinearProgression,
  type WorkingSetPerformance,
} from './progression';
import { solvePlates } from './plateSolver';

describe('evaluateLinearSuccess', () => {
  it('returns false for an all-warmup array (no working sets)', () => {
    const sets: WorkingSetPerformance[] = [
      { weightKg: 40, reps: 5, targetReps: 5, type: 'warmup' },
      { weightKg: 60, reps: 3, targetReps: 5, type: 'warmup' },
    ];
    expect(evaluateLinearSuccess(sets, 100)).toBe(false);
  });

  it('returns true when all non-warmup sets meet target reps at the prescribed weight', () => {
    const sets: WorkingSetPerformance[] = [
      { weightKg: 100, reps: 5, targetReps: 5, type: 'normal' },
      { weightKg: 100, reps: 6, targetReps: 5, type: 'normal' },
      { weightKg: 100, reps: 5, targetReps: 5, type: 'normal' },
    ];
    expect(evaluateLinearSuccess(sets, 100)).toBe(true);
  });

  it('returns false if any working set misses reps', () => {
    const sets: WorkingSetPerformance[] = [
      { weightKg: 100, reps: 5, targetReps: 5, type: 'normal' },
      { weightKg: 100, reps: 3, targetReps: 5, type: 'normal' },
    ];
    expect(evaluateLinearSuccess(sets, 100)).toBe(false);
  });

  it('returns false if any working set is under the prescribed weight', () => {
    const sets: WorkingSetPerformance[] = [
      { weightKg: 100, reps: 5, targetReps: 5, type: 'normal' },
      { weightKg: 95, reps: 5, targetReps: 5, type: 'normal' },
    ];
    expect(evaluateLinearSuccess(sets, 100)).toBe(false);
  });

  it('a warmup set with low reps does NOT fail an otherwise-successful day (Pitfall 2, mixed fixture)', () => {
    const sets: WorkingSetPerformance[] = [
      { weightKg: 40, reps: 2, targetReps: 8, type: 'warmup' }, // warmup "miss" - ignored
      { weightKg: 100, reps: 5, targetReps: 5, type: 'normal' },
      { weightKg: 100, reps: 5, targetReps: 5, type: 'normal' },
    ];
    expect(evaluateLinearSuccess(sets, 100)).toBe(true);
  });
});

describe('resolveLinearProgression', () => {
  const rule = { type: 'linear' as const, incrementKg: 2.5 };

  it('success increments weight and resets fail counter', () => {
    const result = resolveLinearProgression(100, rule, true, 0);
    expect(result.nextWeightKg).toBe(102.5);
    expect(result.nextConsecutiveFails).toBe(0);
    expect(result.deloaded).toBe(false);
  });

  it('a miss holds the weight and increments fails from 0 to 1', () => {
    const result = resolveLinearProgression(100, rule, false, 0);
    expect(result.nextWeightKg).toBe(100);
    expect(result.nextConsecutiveFails).toBe(1);
    expect(result.deloaded).toBe(false);
  });

  it('a miss holds the weight and increments fails from 1 to 2', () => {
    const result = resolveLinearProgression(100, rule, false, 1);
    expect(result.nextWeightKg).toBe(100);
    expect(result.nextConsecutiveFails).toBe(2);
    expect(result.deloaded).toBe(false);
  });

  it('a miss at fails=2 (reaching threshold 3) deloads by 10% and resets fails to 0', () => {
    const result = resolveLinearProgression(100, rule, false, 2);
    expect(result.nextWeightKg).toBe(90); // round-to-0.5(100 * 0.90)
    expect(result.nextConsecutiveFails).toBe(0);
    expect(result.deloaded).toBe(true);
  });

  it('a run of 4 consecutive misses produces exactly ONE deload event, not repeated deloads (Pitfall 8)', () => {
    let weight = 100;
    let fails = 0;
    const deloadEvents: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const result = resolveLinearProgression(weight, rule, false, fails);
      deloadEvents.push(result.deloaded);
      weight = result.nextWeightKg;
      fails = result.nextConsecutiveFails;
    }
    // misses 1,2,3 -> fails become 1,2,(deload+reset to 0); miss 4 -> fails becomes 1 again (no 2nd deload)
    expect(deloadEvents.filter(Boolean).length).toBe(1);
  });

  it('float-drift guard: 50 successive successes from 100 with increment 2.5 yields an exact multiple of 0.5', () => {
    let weight = 100;
    for (let i = 0; i < 50; i++) {
      const result = resolveLinearProgression(weight, rule, true, 0);
      weight = result.nextWeightKg;
    }
    expect(Math.round(weight * 2) / 2).toBe(weight);
  });

  it('honors custom failThreshold and deloadPct arguments', () => {
    const result = resolveLinearProgression(100, rule, false, 0, 1, 0.2);
    // failThreshold=1: a single miss (fails 0->1) already meets threshold -> deload
    expect(result.deloaded).toBe(true);
    expect(result.nextWeightKg).toBe(80); // 100 * (1 - 0.2)
    expect(result.nextConsecutiveFails).toBe(0);
  });
});

describe('computeTrainingMaxFromOneRepMax', () => {
  it('returns 90% of the supplied 1RM by default', () => {
    expect(computeTrainingMaxFromOneRepMax(100)).toBe(90);
  });

  it('honors an explicit tmPercent argument', () => {
    expect(computeTrainingMaxFromOneRepMax(100, 0.85)).toBe(85);
  });

  it('rounds to the nearest 0.5kg', () => {
    expect(computeTrainingMaxFromOneRepMax(101)).toBe(Math.round(101 * 0.9 * 2) / 2);
  });
});

describe('computePercentTmWeight', () => {
  it('equals solvePlates(TM * pct, barWeight, unit).achievableWeight for a concrete kg case', () => {
    const trainingMaxKg = 100;
    const pct = 0.85;
    const barWeightKg = 20;
    const expected = solvePlates(trainingMaxKg * pct, barWeightKg, 'kg').achievableWeight;
    const result = computePercentTmWeight(trainingMaxKg, pct, barWeightKg, 'kg');
    expect(result).toBe(expected);
    // Assumption A2: must NOT be the raw, unrounded TM*pct value.
    expect(result).not.toBe(trainingMaxKg * pct);
  });

  it('delegates to solvePlates for an lb case too', () => {
    const trainingMaxKg = 200;
    const pct = 0.7;
    const barWeightKg = 45;
    const expected = solvePlates(trainingMaxKg * pct, barWeightKg, 'lb').achievableWeight;
    expect(computePercentTmWeight(trainingMaxKg, pct, barWeightKg, 'lb')).toBe(expected);
  });
});

describe('bumpTrainingMax', () => {
  it("adds 2.5 for 'upper'", () => {
    expect(bumpTrainingMax(100, 'upper')).toBe(102.5);
  });

  it("adds 5 for 'lower'", () => {
    expect(bumpTrainingMax(100, 'lower')).toBe(105);
  });
});

describe('nextDayPosition', () => {
  it('advances to the next position mid-list, wrapped false', () => {
    expect(nextDayPosition(0, 3)).toEqual({ position: 1, wrapped: false });
  });

  it('wraps from the last day back to 0 and reports the wrap', () => {
    expect(nextDayPosition(2, 3)).toEqual({ position: 0, wrapped: true });
  });

  it('wraps correctly for a single-day program', () => {
    expect(nextDayPosition(0, 1)).toEqual({ position: 0, wrapped: true });
  });
});

describe('constants', () => {
  it('DEFAULT_LINEAR_INCREMENT_KG has 2.5 for upper lifts and 5 for deadlift', () => {
    expect(DEFAULT_LINEAR_INCREMENT_KG.squat).toBe(2.5);
    expect(DEFAULT_LINEAR_INCREMENT_KG.bench).toBe(2.5);
    expect(DEFAULT_LINEAR_INCREMENT_KG.overheadPress).toBe(2.5);
    expect(DEFAULT_LINEAR_INCREMENT_KG.row).toBe(2.5);
    expect(DEFAULT_LINEAR_INCREMENT_KG.deadlift).toBe(5);
  });

  it('DEFAULT_FAIL_THRESHOLD is 3 and DEFAULT_DELOAD_PCT is 0.10', () => {
    expect(DEFAULT_FAIL_THRESHOLD).toBe(3);
    expect(DEFAULT_DELOAD_PCT).toBe(0.1);
  });

  it('DEFAULT_TM_PERCENT is 0.90', () => {
    expect(DEFAULT_TM_PERCENT).toBe(0.9);
  });

  it('DEFAULT_TM_BUMP_KG has upper 2.5 / lower 5', () => {
    expect(DEFAULT_TM_BUMP_KG.upper).toBe(2.5);
    expect(DEFAULT_TM_BUMP_KG.lower).toBe(5);
  });

  it('DEFAULT_WAVE_SCHEME has 4 weeks of 3 sets each', () => {
    expect(DEFAULT_WAVE_SCHEME.length).toBe(4);
    for (const week of DEFAULT_WAVE_SCHEME) {
      expect(week.length).toBe(3);
    }
  });
});
