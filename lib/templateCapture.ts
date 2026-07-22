// Save-as-template capture — non-warmup working-set count + typical reps (D-02/TMPL-03).
//
// Lightweight, pure aggregation only: given a finished workout's exercises
// (already fetched by the caller — the finish/summary screen holds
// WorkoutDetail already), builds one CapturedTemplateExercise per exercise.
// targetWeightKg is ALWAYS null (D-02) — weights are never frozen at
// save-as-template time; they come from last-performance pre-fill the next
// time the template is started (see lib/templatePrefill.ts). This function
// does not query the DB itself and does not import Drizzle/RN types — the
// caller maps its own richer shape down to `{ exerciseId, sets }` first.
// Zero React Native / Drizzle imports.

interface CapturedSet {
  reps: number;
  type: string;
}

interface CapturedWorkoutExercise {
  exerciseId: number;
  sets: CapturedSet[];
}

export interface CapturedTemplateExercise {
  exerciseId: number;
  position: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg: null;
}

/**
 * Aggregates each finished workout exercise into a capturable template row.
 *
 * - targetSets = count of that exercise's non-warmup ("working") sets
 *   (warmups excluded — Pitfall 4/D-02, mirrors lib/volume.ts's filter idiom).
 * - targetReps = the reps of the LAST non-warmup set (A2 "typical reps" rule).
 * - targetWeightKg is always null.
 * - An exercise whose sets are ALL warmups still produces a row, with
 *   targetSets 0 and targetReps 0 — preserves exercise-slot structure rather
 *   than silently dropping the exercise from the captured template.
 * - position mirrors the input array index.
 */
export function buildTemplateExercisesFromWorkout(
  exercises: CapturedWorkoutExercise[]
): CapturedTemplateExercise[] {
  return exercises.map((exercise, index) => {
    const workingSets = exercise.sets.filter((s) => s.type !== 'warmup');
    return {
      exerciseId: exercise.exerciseId,
      position: index,
      targetSets: workingSets.length,
      targetReps: workingSets.at(-1)?.reps ?? 0,
      targetWeightKg: null,
    };
  });
}
