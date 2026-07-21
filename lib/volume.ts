// Working-set volume — excludes warmups (D-03 / D-10).
//
// Session volume shown on the finish/summary screen must exclude warmup
// sets so it reflects actual working load. Pure, zero React Native /
// Drizzle imports (mirrors lib/exerciseName.ts convention).

interface VolumeSet {
  weightKg: number;
  reps: number;
  type: string;
}

/**
 * Sums weightKg * reps over all non-warmup ("working") sets.
 * Sets with type === 'warmup' are excluded from the total (D-03).
 */
export function workingSetVolume(completedSets: VolumeSet[]): number {
  return completedSets
    .filter((s) => s.type !== 'warmup')
    .reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}
