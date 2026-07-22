// %-of-1RM -> reps programming table lookup (D-11, UTIL-02).
//
// Pure, zero React Native / Drizzle imports (mirrors lib/exerciseName.ts
// convention). Takes an already-computed 1RM as input — does NOT import or
// reimplement Epley (lib/estimate1RM.ts stays the single shared 1RM
// formula, unchanged by this module).

// NSCA Training Load Chart (nsca.com), adapted from Landers 1984.
const TABLE = [
  { percent: 100, reps: 1 },
  { percent: 95, reps: 2 },
  { percent: 93, reps: 3 },
  { percent: 90, reps: 4 },
  { percent: 87, reps: 5 },
  { percent: 85, reps: 6 },
  { percent: 83, reps: 7 },
  { percent: 80, reps: 8 },
  { percent: 77, reps: 9 },
  { percent: 75, reps: 10 },
  { percent: 70, reps: 12 },
] as const;

export interface PercentRow {
  percent: number;
  reps: number;
  weight: number;
}

/**
 * Maps a supplied 1RM (kg) to the NSCA %1RM->reps table, with each row's
 * weight computed as oneRepMaxKg * percent/100, rounded to 1 decimal for
 * display stability.
 */
export function percentOf1RM(oneRepMaxKg: number): PercentRow[] {
  return TABLE.map((row) => ({
    percent: row.percent,
    reps: row.reps,
    weight: Math.round(oneRepMaxKg * (row.percent / 100) * 10) / 10,
  }));
}
