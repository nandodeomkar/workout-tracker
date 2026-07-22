// Week-bucketing + weekly-volume-by-muscle-group reduction (STAT-02, D-12,
// D-13, D-14, D-15). Pure, zero React Native / Drizzle imports (mirrors
// lib/duration.ts's single-purpose shared-helper convention).
//
// Reuses lib/volume.ts#workingSetVolume (warmup exclusion, D-12's tonnage
// formula) rather than reinlining `weightKg * reps` — see RESEARCH.md "Don't
// Hand-Roll" table.

import { MUSCLE_GROUP_KEYS } from '../constants/statsChart';
import type { MuscleGroup } from '../constants/taxonomy';
import { workingSetVolume } from './volume';

export interface WeeklyVolumeSet {
  startedAt: string; // workouts.started_at (ISO)
  weightKg: number;
  reps: number;
  type: string;
  muscleGroup: string;
}

export type WeeklyVolumeRow = { weekStart: string } & Record<MuscleGroup, number>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the ISO date (YYYY-MM-DD) of the Monday of the week containing
 * `date`, computed in UTC (avoids the DST/local-offset drift the History
 * tab already learned — see STATE.md UTC-month lesson). Mon-Sun grouping
 * (D-15): a Sunday maps to the SAME Monday as the preceding Monday, i.e. the
 * Monday 6 days earlier.
 */
export function getWeekStart(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const utcMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dayOfWeek = new Date(utcMidnight).getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayMs = utcMidnight - daysSinceMonday * MS_PER_DAY;
  return new Date(mondayMs).toISOString().slice(0, 10);
}

function zeroGroupTotals(): Record<MuscleGroup, number> {
  const totals = {} as Record<MuscleGroup, number>;
  for (const key of MUSCLE_GROUP_KEYS) {
    totals[key] = 0;
  }
  return totals;
}

/**
 * Groups non-warmup sets by `getWeekStart(startedAt)` then by muscle group,
 * summing tonnage via `workingSetVolume` (D-12). Returns one row per week
 * across the most recent `weeksBack` weeks (anchored to "now"), ascending by
 * weekStart (oldest first / newest last) — weeks with no sets are still
 * zero-filled so the stacked-bar x-axis stays continuous (STAT-02). Every
 * row carries EVERY muscle-group key (0 when absent), 'Other' bucketed like
 * any other group (D-13; ordering/coloring is the chart's concern via
 * constants/statsChart.ts). Empty input returns `[]`.
 */
export function buildWeeklyVolume(sets: WeeklyVolumeSet[], weeksBack: number): WeeklyVolumeRow[] {
  if (sets.length === 0) {
    return [];
  }

  const currentWeekStart = getWeekStart(new Date());
  const currentWeekStartMs = Date.parse(`${currentWeekStart}T00:00:00.000Z`);

  const weekStarts: string[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    weekStarts.push(new Date(currentWeekStartMs - i * 7 * MS_PER_DAY).toISOString().slice(0, 10));
  }

  const totalsByWeek = new Map<string, Record<MuscleGroup, number>>();
  for (const weekStart of weekStarts) {
    totalsByWeek.set(weekStart, zeroGroupTotals());
  }

  for (const s of sets) {
    const weekStart = getWeekStart(s.startedAt);
    const bucket = totalsByWeek.get(weekStart);
    if (!bucket) {
      continue; // outside the requested weeksBack window
    }
    const group: MuscleGroup = (MUSCLE_GROUP_KEYS as readonly string[]).includes(s.muscleGroup)
      ? (s.muscleGroup as MuscleGroup)
      : 'Other';
    bucket[group] += workingSetVolume([s]);
  }

  return weekStarts.map((weekStart) => ({ weekStart, ...totalsByWeek.get(weekStart)! }));
}
