// D-01: start-from-template pre-fill merge (structure+history+fallback) tests.

import { describe, expect, it } from 'vitest';

import { buildTemplatePrefillRows } from './templatePrefill';

describe('buildTemplatePrefillRows', () => {
  it('exact-length history: every row pre-fills from history', () => {
    const rows = buildTemplatePrefillRows(
      { targetSets: 3, targetReps: 10, targetWeightKg: 50 },
      [
        { weightKg: 60, reps: 8 },
        { weightKg: 62.5, reps: 8 },
        { weightKg: 65, reps: 6 },
      ]
    );
    expect(rows).toEqual([
      { weightKg: 60, reps: 8 },
      { weightKg: 62.5, reps: 8 },
      { weightKg: 65, reps: 6 },
    ]);
  });

  it('short history: rows beyond history length fall back to template target', () => {
    const rows = buildTemplatePrefillRows(
      { targetSets: 3, targetReps: 10, targetWeightKg: 50 },
      [{ weightKg: 60, reps: 8 }]
    );
    expect(rows).toEqual([
      { weightKg: 60, reps: 8 },
      { weightKg: 50, reps: 10 },
      { weightKg: 50, reps: 10 },
    ]);
  });

  it('long history: extra history entries beyond targetSets are ignored', () => {
    const rows = buildTemplatePrefillRows(
      { targetSets: 2, targetReps: 10, targetWeightKg: 50 },
      [
        { weightKg: 60, reps: 8 },
        { weightKg: 62.5, reps: 8 },
        { weightKg: 65, reps: 6 },
      ]
    );
    expect(rows).toHaveLength(2);
    expect(rows).toEqual([
      { weightKg: 60, reps: 8 },
      { weightKg: 62.5, reps: 8 },
    ]);
  });

  it('targetWeightKg null with no history falls back to 0 (never-performed convention)', () => {
    const rows = buildTemplatePrefillRows(
      { targetSets: 2, targetReps: 12, targetWeightKg: null },
      []
    );
    expect(rows).toEqual([
      { weightKg: 0, reps: 12 },
      { weightKg: 0, reps: 12 },
    ]);
  });

  it('no history at all: every row falls back to template target', () => {
    const rows = buildTemplatePrefillRows({ targetSets: 4, targetReps: 5, targetWeightKg: 100 }, []);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.weightKg === 100 && r.reps === 5)).toBe(true);
  });
});
