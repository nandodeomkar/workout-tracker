// REDESIGN-03/D-06: advanceFocus tests — five behavior branches per PLAN.md.

import { describe, expect, it } from 'vitest';

import { advanceFocus, type FocusRow } from './focusAdvance';

function row(key: string, isCompleted: boolean): FocusRow {
  return { key, isCompleted };
}

describe('advanceFocus', () => {
  it('returns the next pending row within the current exercise', () => {
    const result = advanceFocus({
      exerciseOrder: [1, 2],
      rowsByWE: {
        1: [row('a', true), row('b', false), row('c', false)],
        2: [row('d', false)],
      },
      currentWeId: 1,
    });
    expect(result).toEqual({ weId: 1, rowKey: 'b' });
  });

  it('advances to the next exercise (in order) when current has no pending rows', () => {
    const result = advanceFocus({
      exerciseOrder: [1, 2, 3],
      rowsByWE: {
        1: [row('a', true), row('b', true)],
        2: [row('c', false)],
        3: [row('d', false)],
      },
      currentWeId: 1,
    });
    expect(result).toEqual({ weId: 2, rowKey: 'c' });
  });

  it('wraps to a skipped-earlier exercise when no later exercise has pending rows', () => {
    const result = advanceFocus({
      exerciseOrder: [1, 2, 3],
      rowsByWE: {
        1: [row('a', false)], // skipped earlier, still pending
        2: [row('b', true)],
        3: [row('c', true), row('d', true)], // current, now fully logged
      },
      currentWeId: 3,
    });
    expect(result).toEqual({ weId: 1, rowKey: 'a' });
  });

  it('returns null when the whole workout is logged (no exercise has pending rows)', () => {
    const result = advanceFocus({
      exerciseOrder: [1, 2],
      rowsByWE: {
        1: [row('a', true), row('b', true)],
        2: [row('c', true)],
      },
      currentWeId: 2,
    });
    expect(result).toBeNull();
  });

  it('counts a pending warmup row as pending (unlike findCurrentRowKey)', () => {
    const result = advanceFocus({
      exerciseOrder: [1],
      rowsByWE: {
        1: [row('warmup-1', false)],
      },
      currentWeId: 1,
    });
    expect(result).toEqual({ weId: 1, rowKey: 'warmup-1' });
  });

  it('treats a currentWeId not present in exerciseOrder as "start scan from beginning"', () => {
    const result = advanceFocus({
      exerciseOrder: [1, 2],
      rowsByWE: {
        1: [row('a', false)],
        2: [row('b', true)],
      },
      currentWeId: 999,
    });
    expect(result).toEqual({ weId: 1, rowKey: 'a' });
  });
});
