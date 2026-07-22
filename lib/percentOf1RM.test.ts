// UTIL-02: %-of-1RM table lookup tests (row count/percents, weight computation, 100%-row).

import { describe, expect, it } from 'vitest';

import { percentOf1RM } from './percentOf1RM';

describe('percentOf1RM', () => {
  it('returns the 11-row NSCA table with the exact percents/reps', () => {
    const rows = percentOf1RM(100);
    expect(rows).toHaveLength(11);
    expect(rows.map((r) => r.percent)).toEqual([100, 95, 93, 90, 87, 85, 83, 80, 77, 75, 70]);
    expect(rows.map((r) => r.reps)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12]);
  });

  it('computes each row weight as oneRepMaxKg * percent/100, rounded to 1 decimal', () => {
    const rows = percentOf1RM(163.33);
    expect(rows[0]).toEqual({ percent: 100, reps: 1, weight: 163.3 });
    expect(rows[7]).toEqual({ percent: 80, reps: 8, weight: 130.7 });
  });

  it('the 100%-row weight equals the input 1RM (rounded to 1 decimal)', () => {
    const rows = percentOf1RM(120);
    expect(rows[0].weight).toBe(120);
  });
});
