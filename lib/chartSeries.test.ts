// D-07: one-point-per-workout chart series reduction tests.

import { describe, expect, it } from 'vitest';

import { estimate1RM } from './estimate1RM';
import { workingSetVolume } from './volume';
import { buildChartSeries, type ChartSet } from './chartSeries';

describe('buildChartSeries', () => {
  it('returns an empty array for empty input (no throw)', () => {
    expect(buildChartSeries([], 'e1rm')).toEqual([]);
  });

  it('excludes warmup sets before reduction', () => {
    const sets: ChartSet[] = [
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 20, reps: 10, type: 'warmup' },
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 100, reps: 5, type: 'normal' },
    ];
    const points = buildChartSeries(sets, 'topSet');
    expect(points).toHaveLength(1);
    expect(points[0].value).toBe(100);
  });

  it('a workout with only warmup sets contributes no point', () => {
    const sets: ChartSet[] = [
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 20, reps: 10, type: 'warmup' },
    ];
    expect(buildChartSeries(sets, 'e1rm')).toEqual([]);
  });

  it('collapses multiple sets from the same workoutId into exactly one ChartPoint', () => {
    const sets: ChartSet[] = [
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 90, reps: 5, type: 'normal' },
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 100, reps: 3, type: 'normal' },
    ];
    const points = buildChartSeries(sets, 'topSet');
    expect(points).toHaveLength(1);
    expect(points[0].workoutId).toBe(1);
  });

  it('metric e1rm: point value is the max estimate1RM across the workout\'s working sets', () => {
    const sets: ChartSet[] = [
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 90, reps: 5, type: 'normal' },
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 100, reps: 3, type: 'normal' },
    ];
    const points = buildChartSeries(sets, 'e1rm');
    const expected = Math.max(estimate1RM(90, 5), estimate1RM(100, 3));
    expect(points[0].value).toBe(expected);
  });

  it('metric topSet: point value is the max weightKg across the workout\'s working sets', () => {
    const sets: ChartSet[] = [
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 90, reps: 5, type: 'normal' },
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 100, reps: 3, type: 'normal' },
    ];
    const points = buildChartSeries(sets, 'topSet');
    expect(points[0].value).toBe(100);
  });

  it('metric volume: point value equals workingSetVolume of the bucket (D-17 reuse)', () => {
    const sets: ChartSet[] = [
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 90, reps: 5, type: 'normal' },
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 20, reps: 10, type: 'warmup' },
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 100, reps: 3, type: 'normal' },
    ];
    const points = buildChartSeries(sets, 'volume');
    const expected = workingSetVolume(sets);
    expect(points[0].value).toBe(expected);
  });

  it('output is sorted ascending by date', () => {
    const sets: ChartSet[] = [
      { workoutId: 2, startedAt: '2026-07-10T10:00:00.000Z', weightKg: 100, reps: 5, type: 'normal' },
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 90, reps: 5, type: 'normal' },
      { workoutId: 3, startedAt: '2026-07-20T10:00:00.000Z', weightKg: 110, reps: 5, type: 'normal' },
    ];
    const points = buildChartSeries(sets, 'topSet');
    expect(points.map((p) => p.workoutId)).toEqual([1, 2, 3]);
  });

  it('a two-set single-workout fixture yields exactly one ChartPoint', () => {
    const sets: ChartSet[] = [
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 90, reps: 5, type: 'normal' },
      { workoutId: 1, startedAt: '2026-07-01T10:00:00.000Z', weightKg: 95, reps: 5, type: 'normal' },
    ];
    expect(buildChartSeries(sets, 'e1rm')).toHaveLength(1);
  });
});
