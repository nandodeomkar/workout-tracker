// D-10: Epley estimated 1RM tests.

import { describe, expect, it } from 'vitest';

import { estimate1RM } from './estimate1RM';

describe('estimate1RM', () => {
  it('applies Epley\'s formula for reps > 1', () => {
    expect(estimate1RM(100, 5)).toBeCloseTo(116.667, 2);
  });

  it('short-circuits to weightKg unchanged at reps === 1', () => {
    expect(estimate1RM(100, 1)).toBe(100);
  });

  it('short-circuits to weightKg unchanged at reps === 0', () => {
    expect(estimate1RM(100, 0)).toBe(100);
  });

  it('handles a high-rep set', () => {
    expect(estimate1RM(60, 12)).toBeCloseTo(84, 2);
  });
});
