// D-14 / LOG-06: kg<->display-unit conversion + rounding tests.

import { describe, expect, it } from 'vitest';

import { displayToKg, kgToDisplay } from './weightUnits';

describe('kgToDisplay', () => {
  it('rounds kg to the nearest 0.5 (round up case)', () => {
    expect(kgToDisplay(62.4, 'kg')).toBe(62.5);
  });

  it('rounds kg to the nearest 0.5 (round down case)', () => {
    expect(kgToDisplay(62.24, 'kg')).toBe(62.0);
  });

  it('passes through an already-plate-loadable kg value unchanged', () => {
    expect(kgToDisplay(100, 'kg')).toBe(100);
  });

  it('converts kg to the nearest whole lb', () => {
    expect(kgToDisplay(100, 'lb')).toBe(220);
  });

  it('handles zero without crashing', () => {
    expect(kgToDisplay(0, 'kg')).toBe(0);
    expect(kgToDisplay(0, 'lb')).toBe(0);
  });
});

describe('displayToKg', () => {
  it('passes through kg unchanged', () => {
    expect(displayToKg(62.5, 'kg')).toBe(62.5);
  });

  it('converts lb back to kg', () => {
    expect(displayToKg(220, 'lb')).toBeCloseTo(99.79, 1);
  });

  it('round-trips kg -> lb -> kg within 0.5 kg', () => {
    const original = 100;
    const displayLb = kgToDisplay(original, 'lb');
    const roundTripped = displayToKg(displayLb, 'lb');
    expect(Math.abs(roundTripped - original)).toBeLessThanOrEqual(0.5);
  });
});
