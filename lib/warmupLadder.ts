// Warm-up ladder builder (D-09, UTIL-03).
//
// Pure, zero React Native / Drizzle imports (mirrors lib/exerciseName.ts
// convention). This function does not persist anything and does not query
// the DB itself; workingWeight/barWeight are supplied by the caller, keeping
// this function pure (mirrors lib/prDetection.ts's "caller supplies data"
// framing).
//
// [ASSUMED — Assumptions Log A1] Ladder values (Bar x8, 40% x5, 60% x3,
// 80% x2) are a reasonable, widely-used generic strength-training
// convention, not tied to any single proprietary program. Locked concrete
// per CONTEXT.md D-09 discretion.

import { solvePlates } from './plateSolver';

export interface WarmupStep {
  label: string;
  weight: number;
  reps: number;
}

const LADDER = [
  { label: 'Bar', percent: 0, reps: 8 }, // empty-bar step: weight = barWeight itself
  { label: '40%', percent: 0.4, reps: 5 },
  { label: '60%', percent: 0.6, reps: 3 },
  { label: '80%', percent: 0.8, reps: 2 },
] as const;

/**
 * Builds the fixed 4-step %-of-working-weight warm-up ladder (D-09), each
 * step's weight rounded through solvePlates so every suggested warm-up is
 * actually loadable. unit is passed straight through to solvePlates — never
 * cross-unit converted (mirrors lib/plateSolver.ts's native-per-unit
 * convention).
 */
export function buildWarmupSets(workingWeight: number, barWeight: number, unit: 'kg' | 'lb'): WarmupStep[] {
  return LADDER.map((step) => {
    const rawTarget = step.percent === 0 ? barWeight : workingWeight * step.percent;
    const { achievableWeight } = solvePlates(rawTarget, barWeight, unit);
    return { label: step.label, weight: achievableWeight, reps: step.reps };
  });
}
