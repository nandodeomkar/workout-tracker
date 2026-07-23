// Range-cutoff helper tests (extracted from app/stats/[exerciseId].tsx).

import { describe, expect, it } from 'vitest';

import { rangeCutoffISO } from './dateRange';

describe('rangeCutoffISO', () => {
  it('returns null for All (no filter)', () => {
    expect(rangeCutoffISO('All')).toBeNull();
  });

  it('returns a non-null ISO string for 3M', () => {
    const cutoff = rangeCutoffISO('3M');
    expect(cutoff).not.toBeNull();
    expect(() => new Date(cutoff as string)).not.toThrow();
  });

  it('returns a non-null ISO string for 1Y', () => {
    const cutoff = rangeCutoffISO('1Y');
    expect(cutoff).not.toBeNull();
    expect(() => new Date(cutoff as string)).not.toThrow();
  });

  it('the 3M cutoff is later (greater) than the 1Y cutoff', () => {
    const threeMonths = rangeCutoffISO('3M') as string;
    const oneYear = rangeCutoffISO('1Y') as string;
    expect(threeMonths > oneYear).toBe(true);
  });
});
