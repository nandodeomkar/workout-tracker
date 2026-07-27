// REDESIGN-02: findCurrentRowKey tests (mid-list pending, all-done, warmup-only, warmup-skip).

import { describe, expect, it } from 'vitest';

import { findCurrentRowKey, type RowLite } from './findCurrentRowKey';

function row(key: string, isWarmup: boolean, isCompleted: boolean): RowLite {
  return { key, isWarmup, isCompleted };
}

describe('findCurrentRowKey', () => {
  it('returns the key of the first pending non-warmup row mid-list', () => {
    const rows = [
      row('a', false, true),
      row('b', false, false),
      row('c', false, false),
    ];
    expect(findCurrentRowKey(rows)).toBe('b');
  });

  it('returns null when all rows are completed', () => {
    const rows = [row('a', false, true), row('b', false, true)];
    expect(findCurrentRowKey(rows)).toBeNull();
  });

  it('returns null for a warmup-only list (no working rows)', () => {
    const rows = [row('a', true, false), row('b', true, false)];
    expect(findCurrentRowKey(rows)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(findCurrentRowKey([])).toBeNull();
  });

  it('skips a pending warmup row before a pending working row', () => {
    const rows = [
      row('a', true, false), // pending warmup — skipped
      row('b', false, false), // pending working — this is current
    ];
    expect(findCurrentRowKey(rows)).toBe('b');
  });
});
