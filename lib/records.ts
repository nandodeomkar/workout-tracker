// All-history rep-max + best-e1RM record computation (D-08/D-09/D-11,
// STAT-03). Single chronological pass (input MUST be pre-sorted ascending
// by startedAt — db/stats.ts#loadAllHistorySets guarantees this) over every
// non-warmup set ever logged. Models lib/prDetection.ts's pure-function
// running-best convention, extended across all history rather than one
// session. Never persisted — recomputed on every Stats-tab focus (D-11).
// Zero React Native / Drizzle imports.

import { estimate1RM } from './estimate1RM';

/** Curated canonical rep-max board display list (UI-SPEC §3 / RESEARCH.md Open Question 1). */
export const CURATED_REP_MAXES = [1, 3, 5, 8, 10, 12] as const;

export interface HistoricalSet {
  exerciseId: number;
  workoutId: number;
  startedAt: string; // ISO, workouts.started_at
  weightKg: number;
  reps: number;
  type: string;
}

export interface RecordBoardEntry {
  reps: number; // rep count this is the record for (e.g. 1RM, 3RM, 5RM...)
  weightKg: number;
  workoutId: number;
  date: string;
}

export interface ExerciseRecordBoard {
  exerciseId: number;
  repMaxes: RecordBoardEntry[]; // curated rep counts (CURATED_REP_MAXES) actually logged, ascending by reps
  bestE1RM: (RecordBoardEntry & { e1rm: number }) | null;
}

export interface PREvent {
  exerciseId: number;
  workoutId: number;
  date: string;
  kind: 'rep-max' | 'e1rm';
  reps: number;
  weightKg: number;
}

interface RunningRepBest {
  weightKg: number;
  workoutId: number;
  date: string;
}

interface RunningE1RMBest {
  e1rm: number;
  weightKg: number;
  reps: number;
  workoutId: number;
  date: string;
}

/**
 * Single chronological pass tracking a running best per (exerciseId, reps)
 * and per-exercise best e1RM, emitting a `PREvent` every time a non-warmup
 * set strictly beats the running best (exact ties never emit — parity with
 * lib/prDetection.ts#detectPRs). Returns the full event timeline (for the
 * recent PR feed, sliced to N by the caller) and the final per-exercise
 * record boards (curated to CURATED_REP_MAXES, omitting rep counts never
 * logged — no placeholder rows).
 *
 * Precondition: `sortedSets` MUST already be ordered ascending by
 * `startedAt` — this function performs no internal re-sort. Re-running this
 * scan after appending a new heavier historical set immediately reflects the
 * new PR with nothing to invalidate (STAT-03's live-compute guarantee).
 *
 * Empty input returns `{ events: [], boards: new Map() }` — never throws.
 */
export function computeAllTimeRecords(
  sortedSets: HistoricalSet[],
): { events: PREvent[]; boards: Map<number, ExerciseRecordBoard> } {
  const repBests = new Map<string, RunningRepBest>(); // `${exerciseId}:${reps}` -> best
  const e1rmBests = new Map<number, RunningE1RMBest>(); // exerciseId -> best
  const events: PREvent[] = [];

  for (const s of sortedSets) {
    if (s.type === 'warmup') {
      continue;
    }

    const repKey = `${s.exerciseId}:${s.reps}`;
    const priorRepBest = repBests.get(repKey);
    if (priorRepBest === undefined || s.weightKg > priorRepBest.weightKg) {
      repBests.set(repKey, { weightKg: s.weightKg, workoutId: s.workoutId, date: s.startedAt });
      events.push({
        exerciseId: s.exerciseId,
        workoutId: s.workoutId,
        date: s.startedAt,
        kind: 'rep-max',
        reps: s.reps,
        weightKg: s.weightKg,
      });
    }

    const e1rm = estimate1RM(s.weightKg, s.reps);
    const priorE1RM = e1rmBests.get(s.exerciseId);
    if (priorE1RM === undefined || e1rm > priorE1RM.e1rm) {
      e1rmBests.set(s.exerciseId, {
        e1rm,
        weightKg: s.weightKg,
        reps: s.reps,
        workoutId: s.workoutId,
        date: s.startedAt,
      });
      events.push({
        exerciseId: s.exerciseId,
        workoutId: s.workoutId,
        date: s.startedAt,
        kind: 'e1rm',
        reps: s.reps,
        weightKg: s.weightKg,
      });
    }
  }

  return { events, boards: assembleBoards(repBests, e1rmBests) };
}

/**
 * Same reduction as `computeAllTimeRecords`, scoped to one exercise's
 * pre-sorted (ascending by startedAt) sets — used by the per-exercise
 * record board (Plan 05). Empty input returns an empty board (no throw).
 */
export function computeExerciseRecordBoard(sortedSets: HistoricalSet[]): ExerciseRecordBoard {
  if (sortedSets.length === 0) {
    return { exerciseId: 0, repMaxes: [], bestE1RM: null };
  }

  const exerciseId = sortedSets[0].exerciseId;
  const { boards } = computeAllTimeRecords(sortedSets);
  return boards.get(exerciseId) ?? { exerciseId, repMaxes: [], bestE1RM: null };
}

function assembleBoards(
  repBests: Map<string, RunningRepBest>,
  e1rmBests: Map<number, RunningE1RMBest>,
): Map<number, ExerciseRecordBoard> {
  const boards = new Map<number, ExerciseRecordBoard>();
  const curated: readonly number[] = CURATED_REP_MAXES;

  for (const [repKey, best] of repBests) {
    const separatorIndex = repKey.lastIndexOf(':');
    const exerciseId = Number(repKey.slice(0, separatorIndex));
    const reps = Number(repKey.slice(separatorIndex + 1));
    if (!curated.includes(reps)) {
      continue;
    }

    const board = boards.get(exerciseId) ?? { exerciseId, repMaxes: [], bestE1RM: null };
    board.repMaxes.push({ reps, weightKg: best.weightKg, workoutId: best.workoutId, date: best.date });
    boards.set(exerciseId, board);
  }

  for (const [exerciseId, best] of e1rmBests) {
    const board = boards.get(exerciseId) ?? { exerciseId, repMaxes: [], bestE1RM: null };
    board.bestE1RM = {
      reps: best.reps,
      weightKg: best.weightKg,
      workoutId: best.workoutId,
      date: best.date,
      e1rm: best.e1rm,
    };
    boards.set(exerciseId, board);
  }

  for (const board of boards.values()) {
    board.repMaxes.sort((a, b) => a.reps - b.reps);
  }

  return boards;
}
