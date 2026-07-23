// D-04/D-05: cm<->display-unit conversion + rounding tests.

import { describe, expect, it } from 'vitest';

import { cmToDisplay, displayToCm } from './lengthUnits';

describe('cmToDisplay', () => {
  it('rounds cm to the nearest 0.1', () => {
    expect(cmToDisplay(40.36, 'cm')).toBe(40.4);
    expect(cmToDisplay(40.34, 'cm')).toBe(40.3);
  });

  it('converts cm to in, rounded to the nearest 0.25', () => {
    expect(cmToDisplay(101.6, 'in')).toBe(40); // 101.6cm == 40in exactly
    expect(cmToDisplay(100, 'in')).toBe(39.25); // 39.37in rounds to nearest 0.25
  });

  it('handles zero without crashing', () => {
    expect(cmToDisplay(0, 'cm')).toBe(0);
    expect(cmToDisplay(0, 'in')).toBe(0);
  });

  it('guards non-finite input to 0', () => {
    expect(cmToDisplay(NaN, 'cm')).toBe(0);
    expect(cmToDisplay(Infinity, 'in')).toBe(0);
  });
});

describe('displayToCm', () => {
  it('passes through cm unchanged', () => {
    expect(displayToCm(40.5, 'cm')).toBe(40.5);
  });

  it('converts in back to cm', () => {
    expect(displayToCm(40, 'in')).toBeCloseTo(101.6, 1);
  });

  it('guards non-finite input to 0', () => {
    expect(displayToCm(NaN, 'cm')).toBe(0);
    expect(displayToCm(Infinity, 'in')).toBe(0);
  });

  it('round-trips cm -> in -> cm within tape-measure tolerance', () => {
    const original = 90;
    const displayIn = cmToDisplay(original, 'in');
    const roundTripped = displayToCm(displayIn, 'in');
    expect(Math.abs(roundTripped - original)).toBeLessThanOrEqual(0.5);
  });
});
