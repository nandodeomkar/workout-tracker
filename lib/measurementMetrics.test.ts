// D-01/D-03: built-in metric registry shape + icon lookup tests.

import { describe, expect, it } from 'vitest';

import { BUILT_IN_METRICS, CUSTOM_METRIC_ICON, getMetricIcon, type UnitType } from './measurementMetrics';

const VALID_UNIT_TYPES: UnitType[] = ['weight', 'length', 'percent'];

describe('BUILT_IN_METRICS', () => {
  it('has exactly 15 entries', () => {
    expect(BUILT_IN_METRICS).toHaveLength(15);
  });

  it('has unique metricKeys', () => {
    const keys = BUILT_IN_METRICS.map((m) => m.metricKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has positions that are the contiguous integers 0..14 with no gaps or duplicates', () => {
    const positions = BUILT_IN_METRICS.map((m) => m.position).sort((a, b) => a - b);
    expect(positions).toEqual(Array.from({ length: 15 }, (_, i) => i));
  });

  it('has a valid unitType for every entry', () => {
    for (const metric of BUILT_IN_METRICS) {
      expect(VALID_UNIT_TYPES).toContain(metric.unitType);
    }
  });

  it('assigns weight -> "weight" unitType', () => {
    const weight = BUILT_IN_METRICS.find((m) => m.metricKey === 'weight');
    expect(weight?.unitType).toBe('weight');
  });

  it('assigns body_fat_pct -> "percent" unitType', () => {
    const bodyFat = BUILT_IN_METRICS.find((m) => m.metricKey === 'body_fat_pct');
    expect(bodyFat?.unitType).toBe('percent');
  });

  it('assigns every body-part metric -> "length" unitType', () => {
    const bodyParts = BUILT_IN_METRICS.filter((m) => m.metricKey !== 'weight' && m.metricKey !== 'body_fat_pct');
    expect(bodyParts.length).toBeGreaterThan(0);
    for (const metric of bodyParts) {
      expect(metric.unitType).toBe('length');
    }
  });
});

describe('getMetricIcon', () => {
  it('returns the registry emoji for a built-in key', () => {
    expect(getMetricIcon('weight')).toBe('⚖️');
    expect(getMetricIcon('chest')).toBe('🫁');
  });

  it('returns CUSTOM_METRIC_ICON for an unknown key', () => {
    expect(getMetricIcon('my_custom_metric')).toBe(CUSTOM_METRIC_ICON);
  });
});
