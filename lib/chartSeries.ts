// One-point-per-workout chart series reduction (D-07, STAT-01).
//
// For a given exercise's non-warmup sets, groups by workoutId and reduces
// each workout to a single point representing that session's best for the
// selected metric (est-1RM / top set / volume). Models
// lib/prDetection.ts's pure-function, group-by-Map convention. Zero React
// Native / Drizzle imports.
//
// D-17: estimate1RM and workingSetVolume are the single formula sources —
// this module imports them and never reimplements the math inline.

import { estimate1RM } from './estimate1RM';
import { workingSetVolume } from './volume';

export interface ChartSet {
  workoutId: number;
  startedAt: string; // workouts.started_at (ISO)
  weightKg: number;
  reps: number;
  type: string;
}

export interface ChartPoint {
  workoutId: number;
  date: string;
  value: number; // kg for top-set/volume metrics, kg-equivalent for e1rm
}

export type ChartMetric = 'e1rm' | 'topSet' | 'volume';

/**
 * Groups non-warmup sets by workoutId and reduces each workout to a single
 * best-of-session point for the given metric (D-07). Empty/malformed input
 * returns `[]` (no throw, mirrors lib/prDetection.ts's sentinel convention).
 * Output is sorted ascending by ISO date.
 */
export function buildChartSeries(sets: ChartSet[], metric: ChartMetric): ChartPoint[] {
  const workingSets = sets.filter((s) => s.type !== 'warmup');

  const byWorkout = new Map<number, ChartSet[]>();
  for (const s of workingSets) {
    const existing = byWorkout.get(s.workoutId);
    if (existing) {
      existing.push(s);
    } else {
      byWorkout.set(s.workoutId, [s]);
    }
  }

  const points: ChartPoint[] = [];
  for (const [workoutId, workoutSets] of byWorkout) {
    const date = workoutSets[0].startedAt;
    let value: number;
    if (metric === 'volume') {
      value = workingSetVolume(workoutSets);
    } else if (metric === 'topSet') {
      value = Math.max(...workoutSets.map((s) => s.weightKg));
    } else {
      value = Math.max(...workoutSets.map((s) => estimate1RM(s.weightKg, s.reps)));
    }
    points.push({ workoutId, date, value });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}
