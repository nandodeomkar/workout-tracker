// Programs & Progression: pure linear + percent-of-training-max progression
// resolvers (PROG-02/PROG-03; D-06/D-08/D-10/D-12/D-13).
//
// Pure, zero React Native / Drizzle imports (mirrors lib/warmupLadder.ts /
// lib/estimate1RM.ts convention). Every function is a total function over
// caller-supplied numbers — no DB/settings access, no NaN propagation path.
// Callers (db/programs.ts, Plan 02) validate the parsed
// `template_exercises.progression` JSON shape before invoking these
// resolvers (see this plan's threat_model T-06-01).
//
// This is the SINGLE shared source of the phase's progression math — do not
// reimplement any of this logic elsewhere (mirrors lib/estimate1RM.ts's
// "do not reimplement" framing).

import { solvePlates } from './plateSolver';

/** A single logged set's performance, used by evaluateLinearSuccess (D-06). */
export interface WorkingSetPerformance {
  weightKg: number;
  reps: number;
  targetReps: number;
  type: 'normal' | 'warmup' | 'dropset' | 'failure';
}

export interface LinearProgressionRule {
  type: 'linear';
  incrementKg: number;
}

export interface LinearProgressionResult {
  nextWeightKg: number;
  nextConsecutiveFails: number;
  deloaded: boolean;
}

export interface PercentTmSetScheme {
  pct: number; // e.g. 0.85
  reps: number; // e.g. 5
  amrap?: boolean;
}

export interface PercentTmRule {
  type: 'percent_tm';
  sets: PercentTmSetScheme[];
}

/** D-07: per-exercise linear increment defaults (2.5kg main lifts, 5kg deadlift). */
export const DEFAULT_LINEAR_INCREMENT_KG = {
  squat: 2.5,
  bench: 2.5,
  overheadPress: 2.5,
  row: 2.5,
  deadlift: 5,
} as const;

/** D-08: consecutive misses before an auto-deload fires. */
export const DEFAULT_FAIL_THRESHOLD = 3;

/** D-08: deload percentage applied to the current weight. */
export const DEFAULT_DELOAD_PCT = 0.1;

/** D-10: training max defaults to 90% of a supplied 1RM. */
export const DEFAULT_TM_PERCENT = 0.9;

/**
 * D-11/D-12: 4-week percent-of-TM wave scheme (3 sets/week), mirroring
 * lib/warmupLadder.ts's fixed-scheme `as const` LADDER shape. Week 4 is the
 * deload week; wrapping past week 4 back to week 1 (nextDayPosition) is one
 * full cycle and triggers a training-max bump (bumpTrainingMax).
 */
export const DEFAULT_WAVE_SCHEME = [
  // Week 1
  [
    { pct: 0.65, reps: 5 },
    { pct: 0.75, reps: 5 },
    { pct: 0.85, reps: 5, amrap: true },
  ],
  // Week 2
  [
    { pct: 0.7, reps: 3 },
    { pct: 0.8, reps: 3 },
    { pct: 0.9, reps: 3, amrap: true },
  ],
  // Week 3
  [
    { pct: 0.75, reps: 5 },
    { pct: 0.85, reps: 3 },
    { pct: 0.95, reps: 1, amrap: true },
  ],
  // Week 4 (deload)
  [
    { pct: 0.4, reps: 5 },
    { pct: 0.5, reps: 5 },
    { pct: 0.6, reps: 5 },
  ],
] as const;

/** D-12: per-cycle training-max bump amounts (5/3/1 convention). */
export const DEFAULT_TM_BUMP_KG = { upper: 2.5, lower: 5 } as const;

/** Rounds a weight to the nearest 0.5kg (float-drift guard, Pitfall 5). */
function roundToHalf(weightKg: number): number {
  return Math.round(weightKg * 2) / 2;
}

/**
 * D-06: success = every non-warmup ("working") set hit its target reps at
 * the prescribed weight. An all-warmup array (no working sets) is never a
 * success. Warmup sets are excluded entirely (Pitfall 2) — a warmup miss
 * must never fail an otherwise-successful day.
 */
export function evaluateLinearSuccess(sets: WorkingSetPerformance[], targetWeightKg: number): boolean {
  const workingSets = sets.filter((s) => s.type !== 'warmup');
  if (workingSets.length === 0) return false;
  return workingSets.every((s) => s.weightKg >= targetWeightKg && s.reps >= s.targetReps);
}

/**
 * D-08/D-09: on success, increment the weight and reset the fail counter. On
 * a miss under failThreshold, hold the weight and increment the fail
 * counter. On a miss that reaches failThreshold, deload by deloadPct AND
 * reset the fail counter to 0 (Pitfall 8 — the reset must happen in BOTH the
 * success and deload branches, or the very next miss re-triggers a deload
 * immediately). Every returned weight is rounded to the nearest 0.5kg
 * (Pitfall 5).
 */
export function resolveLinearProgression(
  currentWeightKg: number,
  rule: LinearProgressionRule,
  success: boolean,
  consecutiveFails: number,
  failThreshold: number = DEFAULT_FAIL_THRESHOLD,
  deloadPct: number = DEFAULT_DELOAD_PCT,
): LinearProgressionResult {
  if (success) {
    return {
      nextWeightKg: roundToHalf(currentWeightKg + rule.incrementKg),
      nextConsecutiveFails: 0,
      deloaded: false,
    };
  }

  const nextFails = consecutiveFails + 1;
  if (nextFails >= failThreshold) {
    return {
      nextWeightKg: roundToHalf(currentWeightKg * (1 - deloadPct)),
      nextConsecutiveFails: 0,
      deloaded: true,
    };
  }

  return {
    nextWeightKg: currentWeightKg,
    nextConsecutiveFails: nextFails,
    deloaded: false,
  };
}

/**
 * D-10: training max = a fixed percent (default 90%) of a caller-supplied
 * 1RM (e.g. from lib/estimate1RM.ts#estimate1RM — reused as-is, not
 * reimplemented here). Rounded to the nearest 0.5kg.
 */
export function computeTrainingMaxFromOneRepMax(oneRepMaxKg: number, tmPercent: number = DEFAULT_TM_PERCENT): number {
  return roundToHalf(oneRepMaxKg * tmPercent);
}

/**
 * D-13: prescribed %TM weight = plate-loadable round(TM * pct), delegating
 * to lib/plateSolver.ts#solvePlates exactly like lib/warmupLadder.ts's
 * buildWarmupSets does per-step (Assumption A2 / Open Question 1 —
 * plate-loadable rounding, never lib/weightUnits.ts's coarser display
 * rounding). barWeightKg/unit are caller-supplied parameters; this function
 * never reads settings itself (Open Question 2).
 */
export function computePercentTmWeight(trainingMaxKg: number, pct: number, barWeightKg: number, unit: 'kg' | 'lb'): number {
  return solvePlates(trainingMaxKg * pct, barWeightKg, unit).achievableWeight;
}

/**
 * D-12: bumps a training max by the per-lift-category amount after a full
 * wave cycle completes (pointer wraps past the last day, see
 * nextDayPosition). Rounded to the nearest 0.5kg.
 */
export function bumpTrainingMax(currentTmKg: number, lift: 'upper' | 'lower'): number {
  return roundToHalf(currentTmKg + DEFAULT_TM_BUMP_KG[lift]);
}

export interface NextDayPositionResult {
  position: number;
  wrapped: boolean;
}

/**
 * D-03: advances a program's day pointer by one, wrapping from the last day
 * back to 0. `wrapped` is true exactly when advancing off the end of the
 * day list (the trigger for a %TM cycle's training-max bump, D-12).
 */
export function nextDayPosition(currentPosition: number, dayCount: number): NextDayPositionResult {
  const nextPosition = currentPosition + 1;
  return {
    position: nextPosition % dayCount,
    wrapped: nextPosition >= dayCount,
  };
}
