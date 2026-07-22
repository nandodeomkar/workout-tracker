// D-08/D-09/D-11 (STAT-03): all-history rep-max + best-e1RM record
// computation tests. Mirrors lib/prDetection.test.ts's literal-fixture
// style, extended to a chronological all-history scan.

import { describe, expect, it } from 'vitest';

import { estimate1RM } from './estimate1RM';
import { CURATED_REP_MAXES, computeAllTimeRecords, computeExerciseRecordBoard } from './records';
import type { HistoricalSet } from './records';

function set(overrides: Partial<HistoricalSet> = {}): HistoricalSet {
  return {
    exerciseId: 1,
    workoutId: 1,
    startedAt: '2026-01-01T00:00:00.000Z',
    weightKg: 100,
    reps: 5,
    type: 'normal',
    ...overrides,
  };
}

describe('computeAllTimeRecords', () => {
  it('empty input yields empty events and empty boards, no throw', () => {
    const result = computeAllTimeRecords([]);
    expect(result.events).toEqual([]);
    expect(result.boards.size).toBe(0);
  });

  it('the very first set ever logged emits both a rep-max and an e1rm PR event', () => {
    const { events } = computeAllTimeRecords([set()]);

    expect(events).toHaveLength(2);
    expect(events).toEqual(
      expect.arrayContaining([
        { exerciseId: 1, workoutId: 1, date: '2026-01-01T00:00:00.000Z', kind: 'rep-max', reps: 5, weightKg: 100 },
        { exerciseId: 1, workoutId: 1, date: '2026-01-01T00:00:00.000Z', kind: 'e1rm', reps: 5, weightKg: 100 },
      ]),
    );
  });

  it('a warmup-only history yields no events and no boards', () => {
    const { events, boards } = computeAllTimeRecords([set({ type: 'warmup' })]);

    expect(events).toEqual([]);
    expect(boards.size).toBe(0);
  });

  it('an exact tie (same weight, same reps) does not emit a duplicate event (strict >)', () => {
    const { events } = computeAllTimeRecords([
      set({ workoutId: 1, startedAt: '2026-01-01T00:00:00.000Z' }),
      set({ workoutId: 2, startedAt: '2026-01-08T00:00:00.000Z' }),
    ]);

    // Only the first set's rep-max + e1rm events fire; the repeat tie is silent.
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.workoutId === 1)).toBe(true);
  });

  it('a heavier set at the same rep count later emits a new rep-max PR and updates the running best', () => {
    const { events } = computeAllTimeRecords([
      set({ workoutId: 1, startedAt: '2026-01-01T00:00:00.000Z', weightKg: 100, reps: 5 }),
      set({ workoutId: 2, startedAt: '2026-01-08T00:00:00.000Z', weightKg: 105, reps: 5 }),
    ]);

    const repMaxEvents = events.filter((e) => e.kind === 'rep-max');
    expect(repMaxEvents).toHaveLength(2);
    expect(repMaxEvents[1]).toEqual({
      exerciseId: 1,
      workoutId: 2,
      date: '2026-01-08T00:00:00.000Z',
      kind: 'rep-max',
      reps: 5,
      weightKg: 105,
    });
  });

  it('re-running the scan after appending a new heavier set immediately reflects the new PR (STAT-03 live-compute proof, no cache)', () => {
    const before: HistoricalSet[] = [set({ workoutId: 1, startedAt: '2026-01-01T00:00:00.000Z', weightKg: 100, reps: 5 })];
    const firstScan = computeAllTimeRecords(before);
    expect(firstScan.boards.get(1)?.bestE1RM?.weightKg).toBe(100);

    const after: HistoricalSet[] = [
      ...before,
      set({ workoutId: 2, startedAt: '2026-01-08T00:00:00.000Z', weightKg: 110, reps: 5 }),
    ];
    const secondScan = computeAllTimeRecords(after);

    expect(secondScan.boards.get(1)?.bestE1RM?.weightKg).toBe(110);
    expect(secondScan.events.some((e) => e.workoutId === 2 && e.kind === 'e1rm')).toBe(true);
  });

  it('tracks best e1RM per exercise, independent from rep-max tracking', () => {
    const { boards } = computeAllTimeRecords([
      set({ workoutId: 1, startedAt: '2026-01-01T00:00:00.000Z', weightKg: 100, reps: 1 }),
      // Lower weight, higher reps -> higher e1RM than the 1-rep set above.
      set({ workoutId: 2, startedAt: '2026-01-08T00:00:00.000Z', weightKg: 90, reps: 10 }),
    ]);

    const board = boards.get(1);
    expect(board?.bestE1RM?.weightKg).toBe(90);
    expect(board?.bestE1RM?.reps).toBe(10);
    expect(board?.bestE1RM?.e1rm).toBeCloseTo(estimate1RM(90, 10));
  });

  it('board repMaxes includes only curated rep counts that were actually logged, omitting the rest', () => {
    const { boards } = computeAllTimeRecords([
      set({ workoutId: 1, startedAt: '2026-01-01T00:00:00.000Z', weightKg: 100, reps: 5 }),
      // 7 reps is NOT in CURATED_REP_MAXES ([1,3,5,8,10,12]) — must be omitted from the board.
      set({ workoutId: 2, startedAt: '2026-01-02T00:00:00.000Z', weightKg: 80, reps: 7 }),
      set({ workoutId: 3, startedAt: '2026-01-03T00:00:00.000Z', weightKg: 60, reps: 10 }),
    ]);

    const board = boards.get(1);
    expect(board?.repMaxes.map((r) => r.reps)).toEqual([5, 10]);
    expect(board?.repMaxes.some((r) => r.reps === 7)).toBe(false);
    // Every rep count actually shown must be one of the curated values.
    for (const entry of board?.repMaxes ?? []) {
      expect((CURATED_REP_MAXES as readonly number[]).includes(entry.reps)).toBe(true);
    }
  });

  it('keeps separate running bests per exercise', () => {
    const { boards } = computeAllTimeRecords([
      set({ exerciseId: 1, workoutId: 1, startedAt: '2026-01-01T00:00:00.000Z', weightKg: 100, reps: 5 }),
      set({ exerciseId: 2, workoutId: 2, startedAt: '2026-01-01T00:00:00.000Z', weightKg: 40, reps: 5 }),
    ]);

    expect(boards.get(1)?.repMaxes[0].weightKg).toBe(100);
    expect(boards.get(2)?.repMaxes[0].weightKg).toBe(40);
  });
});

describe('computeExerciseRecordBoard', () => {
  it('returns the same board computeAllTimeRecords would produce, scoped to one exercise', () => {
    const sets: HistoricalSet[] = [
      set({ exerciseId: 7, workoutId: 1, startedAt: '2026-01-01T00:00:00.000Z', weightKg: 100, reps: 5 }),
      set({ exerciseId: 7, workoutId: 2, startedAt: '2026-01-08T00:00:00.000Z', weightKg: 110, reps: 5 }),
    ];

    const board = computeExerciseRecordBoard(sets);
    const { boards } = computeAllTimeRecords(sets);

    expect(board).toEqual(boards.get(7));
  });

  it('empty input returns an empty board without throwing', () => {
    const board = computeExerciseRecordBoard([]);
    expect(board.repMaxes).toEqual([]);
    expect(board.bestE1RM).toBeNull();
  });
});
