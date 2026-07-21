// Single source of truth for the app's fixed exercise taxonomy (D-01/D-02).
// Every exercise (seeded or custom) carries exactly one MuscleGroup and one
// EquipmentType from these lists — no secondary muscles, no free-text tags.
// This is load-bearing for Phase 4's weekly-volume-by-muscle-group stats
// (each set must count toward exactly one group) and is consumed by both
// the curation script (scripts/curate-exercises.ts) and, in later phases,
// the exercise library UI (filter chips, create/edit forms).

export const MUSCLE_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Core',
  'Other',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'Barbell',
  'Dumbbell',
  'Machine',
  'Cable',
  'Bodyweight',
  'Kettlebell',
  'Band',
  'Other',
] as const;

export type EquipmentType = (typeof EQUIPMENT)[number];
