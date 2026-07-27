// Session-volume strip cumulative sum (REDESIGN-02).
//
// Pure, zero React Native / Drizzle imports (mirrors lib/volume.ts
// convention). Sums weightKg * reps over logged WORKING (isCompleted &&
// !isWarmup) rows across ALL exercises in the active-workout screen's live
// in-memory state — the caller supplies rowsByWE, this function never reads
// the DB or Zustand store itself.

import { workingSetVolume } from './volume';

export interface VolRow {
  weightKg: number;
  reps: number;
  isWarmup: boolean;
  isCompleted: boolean;
}

/**
 * Flattens rowsByWE (one row array per workout_exercise id) and sums
 * weightKg * reps over rows where isCompleted && !isWarmup. Ignores pending
 * rows and warmups. Empty input returns 0.
 */
export function computeSessionVolumeKg(rowsByWE: Record<number, VolRow[]>): number {
  const workingRows = Object.values(rowsByWE)
    .flat()
    .filter((r) => r.isCompleted && !r.isWarmup);

  // Delegate to lib/volume.ts#workingSetVolume — its input shape
  // ({weightKg, reps, type}) differs only in the warmup discriminant
  // (`type !== 'warmup'` vs. `!isWarmup`), already filtered out above, so
  // passing `type: 'working'` here is safe and keeps one formula source.
  return workingSetVolume(workingRows.map((r) => ({ weightKg: r.weightKg, reps: r.reps, type: 'working' })));
}
