// REDESIGN-02: computeSessionVolumeKg tests (cross-exercise sum, warmup/pending exclusion, empty).

import { describe, expect, it } from 'vitest';

import { computeSessionVolumeKg, type VolRow } from './sessionVolume';

function row(weightKg: number, reps: number, isWarmup: boolean, isCompleted: boolean): VolRow {
  return { weightKg, reps, isWarmup, isCompleted };
}

describe('computeSessionVolumeKg', () => {
  it('sums weightKg * reps for logged working rows across ALL exercises', () => {
    const rowsByWE = {
      1: [row(100, 5, false, true), row(100, 5, false, true)],
      2: [row(60, 8, false, true)],
    };
    // (100*5) + (100*5) + (60*8) = 500 + 500 + 480 = 1480
    expect(computeSessionVolumeKg(rowsByWE)).toBe(1480);
  });

  it('excludes warmup rows even when completed', () => {
    const rowsByWE = {
      1: [row(20, 8, true, true), row(100, 5, false, true)],
    };
    expect(computeSessionVolumeKg(rowsByWE)).toBe(500);
  });

  it('excludes pending (not-completed) rows', () => {
    const rowsByWE = {
      1: [row(100, 5, false, false), row(100, 5, false, true)],
    };
    expect(computeSessionVolumeKg(rowsByWE)).toBe(500);
  });

  it('returns 0 for empty input', () => {
    expect(computeSessionVolumeKg({})).toBe(0);
  });

  it('returns 0 when every row is either pending or a warmup', () => {
    const rowsByWE = {
      1: [row(20, 8, true, true), row(100, 5, false, false)],
    };
    expect(computeSessionVolumeKg(rowsByWE)).toBe(0);
  });
});
