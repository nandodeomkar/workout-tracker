import { describe, expect, it } from 'vitest';

import { EQUIPMENT, MUSCLE_GROUPS } from '../constants/taxonomy';
import { curate, type RawExercise } from './curate-exercises';

// Inline fixture shaped like free-exercise-db records — deliberately does
// NOT depend on the full ~873-row dataset (Pitfall 3 / D-01 / D-02).
const FIXTURE: RawExercise[] = [
  {
    id: 'barbell-bench-press',
    name: 'Barbell Bench Press',
    equipment: 'barbell',
    primaryMuscles: ['chest'],
    category: 'strength',
    level: 'intermediate',
  },
  {
    // Missing/blank equipment — must NOT be dropped, falls back to "Other".
    id: 'sit-up',
    name: 'Sit-Up',
    equipment: null,
    primaryMuscles: ['abdominals'],
    category: 'strength',
    level: 'beginner',
  },
  {
    // Unmapped primaryMuscles value — must NOT be dropped, falls back to "Other".
    id: 'weird-neck-thing',
    name: 'Weird Neck Thing',
    equipment: 'cable',
    primaryMuscles: ['some-totally-unmapped-muscle'],
    category: 'strength',
    level: 'beginner',
  },
  {
    // Neither equipment nor primaryMuscles present — junk, must be dropped.
    id: 'junk-record',
    name: 'Junk Record',
    equipment: null,
    primaryMuscles: [],
    category: 'strength',
    level: 'beginner',
  },
];

describe('curate', () => {
  it('never emits a null/empty muscleGroup or equipment on any row', () => {
    const { rows } = curate(FIXTURE);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(MUSCLE_GROUPS).toContain(row.muscleGroup);
      expect(EQUIPMENT).toContain(row.equipment);
      expect(row.muscleGroup).toBeTruthy();
      expect(row.equipment).toBeTruthy();
    }
  });

  it('excludes the junk record with neither equipment nor primaryMuscles', () => {
    const { rows } = curate(FIXTURE);
    const names = rows.map((r) => r.name);
    expect(names).not.toContain('Junk Record');
  });

  it('falls back unmapped/missing values to "Other" and reports non-zero fallback counts', () => {
    const { rows, report } = curate(FIXTURE);

    const sitUp = rows.find((r) => r.name === 'Sit-Up');
    expect(sitUp?.equipment).toBe('Other');

    const weirdNeck = rows.find((r) => r.name === 'Weird Neck Thing');
    expect(weirdNeck?.muscleGroup).toBe('Other');

    expect(report.equipmentFallbacks).toBeGreaterThan(0);
    expect(report.muscleGroupFallbacks).toBeGreaterThan(0);
  });

  it('gives every output row a stable, non-empty seedId', () => {
    const { rows } = curate(FIXTURE);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(typeof row.seedId).toBe('string');
      expect(row.seedId.length).toBeGreaterThan(0);
    }
    const seedIds = rows.map((r) => r.seedId);
    expect(new Set(seedIds).size).toBe(seedIds.length);
  });

  it('correctly maps a fully-specified record to its known taxonomy values', () => {
    const { rows } = curate(FIXTURE);
    const bench = rows.find((r) => r.name === 'Barbell Bench Press');
    expect(bench?.muscleGroup).toBe('Chest');
    expect(bench?.equipment).toBe('Barbell');
  });

  it('reports accurate input/output/excluded counts', () => {
    const { rows, report } = curate(FIXTURE);
    expect(report.input).toBe(FIXTURE.length);
    expect(report.output).toBe(rows.length);
    expect(report.excluded).toBe(FIXTURE.length - rows.length);
  });
});
