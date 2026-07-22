// UTIL-03: warm-up ladder tests (step count, Bar==barWeight, plate-rounded steps, unit passthrough).

import { describe, expect, it } from 'vitest';

import { solvePlates } from './plateSolver';
import { buildWarmupSets } from './warmupLadder';

describe('buildWarmupSets', () => {
  it('returns 4 steps labelled Bar / 40% / 60% / 80% with reps 8/5/3/2', () => {
    const steps = buildWarmupSets(100, 20, 'kg');
    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.label)).toEqual(['Bar', '40%', '60%', '80%']);
    expect(steps.map((s) => s.reps)).toEqual([8, 5, 3, 2]);
  });

  it('the Bar step weight equals barWeight (percent 0 uses the bar itself, not 0)', () => {
    const steps = buildWarmupSets(100, 20, 'kg');
    expect(steps[0].weight).toBe(20);
  });

  it('every non-bar step weight is the plate-rounded achievableWeight from solvePlates', () => {
    const workingWeight = 100;
    const barWeight = 20;
    const steps = buildWarmupSets(workingWeight, barWeight, 'kg');
    const percents = [0.4, 0.6, 0.8];
    for (let i = 0; i < percents.length; i += 1) {
      const expected = solvePlates(workingWeight * percents[i], barWeight, 'kg').achievableWeight;
      expect(steps[i + 1].weight).toBe(expected);
    }
  });

  it('passes the unit straight through to solvePlates with no cross-unit conversion (lb)', () => {
    const workingWeight = 225;
    const barWeight = 45;
    const steps = buildWarmupSets(workingWeight, barWeight, 'lb');
    expect(steps[0].weight).toBe(45);
    const expected80 = solvePlates(workingWeight * 0.8, barWeight, 'lb').achievableWeight;
    expect(steps[3].weight).toBe(expected80);
  });
});
