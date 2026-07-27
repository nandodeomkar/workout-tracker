// REDESIGN-02: e1rmDeltaPct tests (empty/single/up/down/flat/divide-by-zero-guard).

import { describe, expect, it } from 'vitest';

import { e1rmDeltaPct } from './e1rmDelta';

describe('e1rmDeltaPct', () => {
  it('returns null for an empty array', () => {
    expect(e1rmDeltaPct([])).toBeNull();
  });

  it('returns null for a single point', () => {
    expect(e1rmDeltaPct([100])).toBeNull();
  });

  it('returns a positive signed percent for an ascending last-two', () => {
    // (110 - 100) / 100 * 100 = 10
    expect(e1rmDeltaPct([90, 100, 110])).toBe(10);
  });

  it('returns a negative signed percent for a descending last-two', () => {
    // (90 - 100) / 100 * 100 = -10
    expect(e1rmDeltaPct([110, 100, 90])).toBe(-10);
  });

  it('returns 0 when the last two points are equal', () => {
    expect(e1rmDeltaPct([100, 100])).toBe(0);
  });

  it('returns null (divide-by-zero guard) when the previous value is 0', () => {
    expect(e1rmDeltaPct([0, 100])).toBeNull();
  });
});
