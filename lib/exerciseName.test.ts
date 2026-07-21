// GAP-2: near-duplicate name normalization tests.

import { describe, expect, it } from 'vitest';

import { normalizeExerciseName } from './exerciseName';

describe('normalizeExerciseName', () => {
  it('is case-insensitive', () => {
    expect(normalizeExerciseName('Barbell Row')).toBe(normalizeExerciseName('barbell row'));
  });

  it('collapses surrounding and internal whitespace', () => {
    expect(normalizeExerciseName('  Seated   Cable  Row ')).toBe('seated cable row');
  });

  it('treats a trailing plural "s" as equal to the singular (the reported GAP-2 case)', () => {
    expect(normalizeExerciseName('Seated Cable Rows')).toBe(normalizeExerciseName('Seated cable row'));
  });

  it('does NOT strip a legitimate "ss" ending', () => {
    expect(normalizeExerciseName('Bench Press')).toBe('bench press');
    expect(normalizeExerciseName('Leg Press')).toBe('leg press');
  });

  it('normalizes punctuation/hyphens to spaces', () => {
    expect(normalizeExerciseName('Sit-Up')).toBe(normalizeExerciseName('Sit Up'));
  });

  it('distinguishes genuinely different names', () => {
    expect(normalizeExerciseName('Cable Row')).not.toBe(normalizeExerciseName('Cable Fly'));
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeExerciseName('   ')).toBe('');
  });
});
