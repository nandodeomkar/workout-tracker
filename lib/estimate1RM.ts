// Estimated 1-rep-max via Epley's formula (D-10).
//
// This is the SINGLE shared formula used by both Phase 2 (finish-summary PR
// detection) and Phase 4 (per-exercise stats/trend charts) — do not
// reimplement this math anywhere else. Pure, zero React Native / Drizzle
// imports (mirrors lib/exerciseName.ts convention).
//
// [ASSUMED — Assumptions Log A3] reps<=1 short-circuits to return weightKg
// unchanged rather than weightKg*1.0333. This is a common convention but not
// independently verified against a single canonical source; flagged for
// reviewer confirmation per 02-RESEARCH.md.

/**
 * Epley estimated 1RM: weightKg * (1 + reps / 30).
 * For reps <= 1, returns weightKg unchanged (see module doc comment, A3).
 */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
