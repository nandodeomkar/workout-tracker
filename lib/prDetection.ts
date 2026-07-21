// PR detection — heaviest weight + best estimated 1RM vs prior history (D-10).
//
// Lightweight finish-summary check only: heaviest weight and best
// estimated-1RM per exercise for THIS session vs that exercise's prior
// history maxima. The full records table + PR feed are Phase 4 — this
// function does not persist anything and does not query the DB itself;
// prior-history maxima are supplied by the caller (DB layer, Plan 03/06),
// keeping this function pure. Zero React Native / Drizzle imports.

import { estimate1RM } from './estimate1RM';

interface CurrentSet {
  exerciseId: number;
  weightKg: number;
  reps: number;
  type: string;
}

interface PriorBest {
  exerciseId: number;
  bestWeightKg: number | null;
  bestE1RM: number | null;
}

interface PRHit {
  exerciseId: number;
  kind: 'weight' | 'e1rm';
  weightKg: number;
  reps: number;
}

/**
 * Compares this session's non-warmup sets against each exercise's prior
 * history maxima and returns one PR hit per exercise per kind that was
 * strictly exceeded (weight and/or estimated 1RM). null in priorBests means
 * the exercise has never been logged before, so any set is a PR.
 */
export function detectPRs(currentSets: CurrentSet[], priorBests: PriorBest[]): PRHit[] {
  const workingSets = currentSets.filter((s) => s.type !== 'warmup');
  const priorByExercise = new Map(priorBests.map((p) => [p.exerciseId, p]));

  // Group working sets by exercise so we can find each exercise's session-best
  // weight set and session-best e1RM set independently.
  const setsByExercise = new Map<number, CurrentSet[]>();
  for (const set of workingSets) {
    const existing = setsByExercise.get(set.exerciseId);
    if (existing) {
      existing.push(set);
    } else {
      setsByExercise.set(set.exerciseId, [set]);
    }
  }

  const hits: PRHit[] = [];

  for (const [exerciseId, sets] of setsByExercise) {
    const prior = priorByExercise.get(exerciseId);
    const bestWeightKg = prior?.bestWeightKg ?? null;
    const bestE1RM = prior?.bestE1RM ?? null;

    const topWeightSet = sets.reduce((best, s) => (s.weightKg > best.weightKg ? s : best));
    if (bestWeightKg === null || topWeightSet.weightKg > bestWeightKg) {
      hits.push({
        exerciseId,
        kind: 'weight',
        weightKg: topWeightSet.weightKg,
        reps: topWeightSet.reps,
      });
    }

    const topE1RMSet = sets.reduce((best, s) =>
      estimate1RM(s.weightKg, s.reps) > estimate1RM(best.weightKg, best.reps) ? s : best
    );
    const topE1RM = estimate1RM(topE1RMSet.weightKg, topE1RMSet.reps);
    if (bestE1RM === null || topE1RM > bestE1RM) {
      hits.push({
        exerciseId,
        kind: 'e1rm',
        weightKg: topE1RMSet.weightKg,
        reps: topE1RMSet.reps,
      });
    }
  }

  return hits;
}
