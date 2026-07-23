// D-12: one-point-per-date latest-id-wins series reduction tests.

import { describe, expect, it } from 'vitest';

import { buildMeasurementSeries, type MeasurementReading } from './measurementSeries';

describe('buildMeasurementSeries', () => {
  it('returns [] for empty input', () => {
    expect(buildMeasurementSeries([])).toEqual([]);
  });

  it('emits one point per distinct date, sorted ascending', () => {
    const readings: MeasurementReading[] = [
      { id: 1, metric: 'weight', value: 80, measuredAt: '2026-07-20' },
      { id: 2, metric: 'weight', value: 79.5, measuredAt: '2026-07-18' },
      { id: 3, metric: 'weight', value: 79, measuredAt: '2026-07-19' },
    ];
    expect(buildMeasurementSeries(readings)).toEqual([
      { date: '2026-07-18', value: 79.5 },
      { date: '2026-07-19', value: 79 },
      { date: '2026-07-20', value: 80 },
    ]);
  });

  it('keeps the highest-id reading on same-date duplicates (latest-wins, not min/max)', () => {
    const readings: MeasurementReading[] = [
      { id: 5, metric: 'weight', value: 81, measuredAt: '2026-07-20' },
      { id: 9, metric: 'weight', value: 80.5, measuredAt: '2026-07-20' },
      { id: 7, metric: 'weight', value: 82, measuredAt: '2026-07-20' },
    ];
    expect(buildMeasurementSeries(readings)).toEqual([{ date: '2026-07-20', value: 80.5 }]);
  });

  it('does not reduce via Math.max/min of value across dates', () => {
    const readings: MeasurementReading[] = [
      { id: 1, metric: 'weight', value: 100, measuredAt: '2026-07-01' },
      { id: 2, metric: 'weight', value: 50, measuredAt: '2026-07-02' },
    ];
    // Both distinct points preserved -- a max/min reduction would collapse
    // this to a single point.
    expect(buildMeasurementSeries(readings)).toHaveLength(2);
  });
});
