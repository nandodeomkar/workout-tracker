// Weekly-volume stacked-bar categorical palette (STAT-02/D-14, UI-SPEC §Color
// chart categorical palette). Deliberately distinct from the reserved chrome
// colors (theme.colors.accent/danger/badge) so chart data-viz meaning never
// collides with UI chrome meaning.
//
// 'Other' (RESEARCH.md Pitfall 5 — a 37/517-exercise catch-all, not a real
// anatomical group) is always LAST and muted grey, never a peer hue. Both
// arrays are index-aligned (same length/order) — victory-native's
// StackedBar `points`/`colors` props depend on this alignment.

import { MUSCLE_GROUPS, type MuscleGroup } from './taxonomy';

// MUSCLE_GROUPS is already Chest..Core, Other-last (constants/taxonomy.ts) —
// reuse verbatim rather than re-declaring the order.
export const MUSCLE_GROUP_KEYS: readonly MuscleGroup[] = MUSCLE_GROUPS;

export const MUSCLE_GROUP_COLORS: readonly string[] = [
  '#5B8DEF', // Chest
  '#34D399', // Back
  '#FBBF24', // Shoulders
  '#A78BFA', // Biceps
  '#F472B6', // Triceps
  '#FB923C', // Quads
  '#2DD4BF', // Hamstrings
  '#818CF8', // Glutes
  '#E879F9', // Core
  '#6B7280', // Other — muted grey, always last (Pitfall 5)
];
