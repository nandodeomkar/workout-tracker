// Start-from-template pre-fill merge — structure+history+fallback (D-01/TMPL-02).
//
// Lightweight, pure merge only: the template supplies STRUCTURE (row count =
// targetSets); each row's weight/reps pre-fill from the exercise's own
// last-performance history, falling back to the template's own target once
// history is shorter than targetSets or absent entirely. This function does
// not query the DB itself — the caller (active-workout screen, Plan 03)
// supplies both the template target and the already-loaded, already-filtered
// (non-warmup, see Pitfall 4) history. Zero React Native / Drizzle imports.

export interface TemplateTarget {
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
}

export interface HistorySet {
  weightKg: number;
  reps: number;
}

export interface PrefillRow {
  weightKg: number;
  reps: number;
}

/**
 * Merges a template's target structure with the exercise's last-performance
 * history into exactly `target.targetSets` rows.
 *
 * - Row i pre-fills from history[i] when present.
 * - Once history is exhausted (or shorter than targetSets), remaining rows
 *   fall back to target.targetWeightKg / target.targetReps.
 * - target.targetWeightKg === null (always true for a save-as-template
 *   capture, D-02) means "no fallback weight" — falls through to 0, the same
 *   convention Phase 2 uses for a never-performed exercise (D-06).
 * - history longer than targetSets is truncated: only the first targetSets
 *   entries are used, and the returned array length always equals
 *   target.targetSets.
 *
 * Callers MUST pass history already filtered to exclude warmup sets
 * (type !== 'warmup') — this function does not re-filter (Pitfall 4).
 */
export function buildTemplatePrefillRows(target: TemplateTarget, history: HistorySet[]): PrefillRow[] {
  const rows: PrefillRow[] = [];
  for (let i = 0; i < target.targetSets; i += 1) {
    const historical = history[i];
    rows.push({
      weightKg: historical?.weightKg ?? target.targetWeightKg ?? 0,
      reps: historical?.reps ?? target.targetReps,
    });
  }
  return rows;
}
