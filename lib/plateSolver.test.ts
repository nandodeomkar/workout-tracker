// UTIL-01: plate solver tests (exact, nearest-achievable, below-bar, per-unit, fp-drift).

import { describe, expect, it } from 'vitest';

import { PLATE_SET_KG, PLATE_SET_LB, solvePlates } from './plateSolver';

describe('solvePlates', () => {
  it('resolves an exact-loadable target to zero delta and minimal greedy plates', () => {
    // 100 kg, 20 kg bar -> per-side remaining (100-20)/2 = 40 -> greedy: 25+15
    const result = solvePlates(100, 20, 'kg');
    expect(result.deltaFromTarget).toBe(0);
    expect(result.achievableWeight).toBe(100);
    expect(result.perSidePlates).toEqual([25, 15]);
  });

  it('returns the nearest achievable weight + non-zero delta for a not-exactly-loadable target', () => {
    // 101 kg, 20 kg bar -> per-side remaining (101-20)/2 = 40.5 -> rounds to
    // nearest 1.25 multiple = 40 (40.5/1.25=32.4 -> rounds to 32*1.25=40)
    // -> achievable = 20 + 40*2 = 100
    const result = solvePlates(101, 20, 'kg');
    expect(result.achievableWeight).toBe(100);
    expect(result.deltaFromTarget).toBeCloseTo(-1, 5);
    expect(result.deltaFromTarget).not.toBe(0);
  });

  it('returns perSidePlates in descending order and achievableWeight === barWeight + roundedPerSide*2', () => {
    const result = solvePlates(102, 20, 'kg');
    const sorted = [...result.perSidePlates].sort((a, b) => b - a);
    expect(result.perSidePlates).toEqual(sorted);
    const perSide = (result.achievableWeight - 20) / 2;
    expect(result.achievableWeight).toBe(20 + perSide * 2);
  });

  it('treats a below-bar target as the bar itself, with an empty plate list', () => {
    const result = solvePlates(15, 20, 'kg');
    expect(result.perSidePlates).toEqual([]);
    expect(result.achievableWeight).toBe(20);
    expect(result.deltaFromTarget).toBe(5);
  });

  it('treats a target exactly at the bar weight as below-bar (nothing to load)', () => {
    const result = solvePlates(20, 20, 'kg');
    expect(result.perSidePlates).toEqual([]);
    expect(result.achievableWeight).toBe(20);
    expect(result.deltaFromTarget).toBe(0);
  });

  it('uses PLATE_SET_KG denominations for kg unit, never converting from lb', () => {
    const result = solvePlates(140, 20, 'kg');
    for (const plate of result.perSidePlates) {
      expect(PLATE_SET_KG).toContain(plate);
    }
  });

  it('uses PLATE_SET_LB denominations for lb unit, never converting from kg', () => {
    // 225 lb, 45 lb bar -> per-side remaining (225-45)/2 = 90 -> 45+35+10
    const result = solvePlates(225, 45, 'lb');
    expect(result.achievableWeight).toBe(225);
    expect(result.deltaFromTarget).toBe(0);
    for (const plate of result.perSidePlates) {
      expect(PLATE_SET_LB).toContain(plate);
    }
  });

  it('does not infinite-loop or drop a plate on an odd fp-drift-prone per-side remainder', () => {
    // 20 kg bar + per-side 17.5 -> target = 20 + 17.5*2 = 55
    const result = solvePlates(55, 20, 'kg');
    expect(result.achievableWeight).toBe(55);
    expect(result.deltaFromTarget).toBe(0);
    const perSideSum = result.perSidePlates.reduce((sum, p) => sum + p, 0);
    expect(perSideSum).toBeCloseTo(17.5, 5);
  });
});
