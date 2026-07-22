// Week-bucketing + weekly-volume reduction tests (STAT-02/D-15).
//
// Subject under test:
//   - getWeekStart: UTC Monday-anchored ISO week-start date (Mon-Sun, D-15)
//   - buildWeeklyVolume: per-week per-muscle-group tonnage (D-12), reusing
//     workingSetVolume, zero-filled across the requested weeksBack window

import { describe, expect, it } from 'vitest';

import { MUSCLE_GROUP_KEYS } from '../constants/statsChart';
import { buildWeeklyVolume, getWeekStart, type WeeklyVolumeSet } from './weeklyVolume';

describe('getWeekStart', () => {
  it('returns the same date for a Monday (already the week start)', () => {
    // 2026-07-20 is a Monday.
    expect(getWeekStart('2026-07-20T10:00:00.000Z')).toBe('2026-07-20');
  });

  it('maps a Sunday to the SAME Monday as the preceding Monday (Mon-Sun grouping)', () => {
    // 2026-07-26 is a Sunday; the week's Monday is 2026-07-20.
    const mondayResult = getWeekStart('2026-07-20T23:59:59.000Z');
    const sundayResult = getWeekStart('2026-07-26T23:59:59.000Z');
    expect(sundayResult).toBe(mondayResult);
    expect(sundayResult).toBe('2026-07-20');
  });

  it('maps a mid-week Wednesday to that week\'s Monday', () => {
    // 2026-07-22 is a Wednesday, week Monday is 2026-07-20.
    expect(getWeekStart('2026-07-22T10:00:00.000Z')).toBe('2026-07-20');
  });

  it('accepts a Date object as well as an ISO string', () => {
    const d = new Date('2026-07-22T10:00:00.000Z');
    expect(getWeekStart(d)).toBe('2026-07-20');
  });

  it('is computed in UTC, unaffected by local-offset drift', () => {
    // Near-midnight UTC boundary: 2026-07-20T00:00:00.000Z is still Monday in UTC.
    expect(getWeekStart('2026-07-20T00:00:00.000Z')).toBe('2026-07-20');
  });
});

describe('buildWeeklyVolume', () => {
  it('returns [] for empty input', () => {
    expect(buildWeeklyVolume([], 12)).toEqual([]);
  });

  it('sums tonnage per muscle group for a single week, excluding warmups', () => {
    const now = new Date();
    const thisMonday = getWeekStart(now);

    const sets: WeeklyVolumeSet[] = [
      { startedAt: `${thisMonday}T10:00:00.000Z`, weightKg: 100, reps: 5, type: 'normal', muscleGroup: 'Quads' },
      { startedAt: `${thisMonday}T10:05:00.000Z`, weightKg: 20, reps: 10, type: 'warmup', muscleGroup: 'Quads' },
      { startedAt: `${thisMonday}T10:10:00.000Z`, weightKg: 60, reps: 8, type: 'normal', muscleGroup: 'Chest' },
    ];

    const rows = buildWeeklyVolume(sets, 1);

    expect(rows).toHaveLength(1);
    expect(rows[0].weekStart).toBe(thisMonday);
    expect(rows[0].Quads).toBe(500); // 100*5, warmup excluded
    expect(rows[0].Chest).toBe(480); // 60*8
  });

  it('every row carries every muscle-group key, zero when absent', () => {
    const now = new Date();
    const thisMonday = getWeekStart(now);
    const sets: WeeklyVolumeSet[] = [
      { startedAt: `${thisMonday}T10:00:00.000Z`, weightKg: 100, reps: 5, type: 'normal', muscleGroup: 'Quads' },
    ];

    const rows = buildWeeklyVolume(sets, 1);

    for (const key of MUSCLE_GROUP_KEYS) {
      expect(typeof rows[0][key]).toBe('number');
    }
    expect(rows[0].Back).toBe(0);
  });

  it('zero-fills weeks with no sets across the requested weeksBack window, oldest first / newest last', () => {
    const now = new Date();
    const thisMonday = getWeekStart(now);
    const sets: WeeklyVolumeSet[] = [
      { startedAt: `${thisMonday}T10:00:00.000Z`, weightKg: 100, reps: 5, type: 'normal', muscleGroup: 'Quads' },
    ];

    const rows = buildWeeklyVolume(sets, 4);

    expect(rows).toHaveLength(4);
    // Ascending: oldest first, current week (with data) last.
    expect(rows[rows.length - 1].weekStart).toBe(thisMonday);
    expect(rows[rows.length - 1].Quads).toBe(500);
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].Quads).toBe(0);
    }
    // weekStart values strictly ascending.
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].weekStart > rows[i - 1].weekStart).toBe(true);
    }
  });

  it('buckets "Other" like any other group', () => {
    const now = new Date();
    const thisMonday = getWeekStart(now);
    const sets: WeeklyVolumeSet[] = [
      { startedAt: `${thisMonday}T10:00:00.000Z`, weightKg: 50, reps: 10, type: 'normal', muscleGroup: 'Other' },
    ];

    const rows = buildWeeklyVolume(sets, 1);

    expect(rows[0].Other).toBe(500);
  });
});
