// Muscle-group glyphs for the exercise library rows and pills (GAP-4 UX
// rework, sketch 001-C). Emoji keep zero extra asset/native config while
// giving each row a fast visual anchor for one-handed gym scanning. Keyed by
// the fixed MuscleGroup taxonomy (constants/taxonomy.ts) — one glyph per group.

import type { MuscleGroup } from './taxonomy';

export const MUSCLE_ICONS: Record<MuscleGroup, string> = {
  Chest: '🫁',
  Back: '🔙',
  Shoulders: '🙆',
  Biceps: '💪',
  Triceps: '🦾',
  Quads: '🦵',
  Hamstrings: '🐐',
  Glutes: '🍑',
  Core: '🧱',
  Other: '🎯',
};

export function muscleIcon(group: string): string {
  return MUSCLE_ICONS[group as MuscleGroup] ?? MUSCLE_ICONS.Other;
}
