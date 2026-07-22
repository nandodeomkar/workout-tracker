// Synthetic-history seed generator (STAT-04, Plan 04-06). Bulk-inserts a
// deterministic ~5-year / ~780-workout / ~15,600-set fixture into the
// in-memory better-sqlite3 DB created by db/test/fixture.ts#createTestDb, so
// db/stats.performance.test.ts can time the three stat query paths against a
// "years of history" magnitude dataset.
//
// Test-only (lives under db/test/, like fixture.ts) — imports ONLY the
// driver-agnostic schema module, no RN modules.
//
// Deterministic: a fixed-seed mulberry32 PRNG drives weight/rep noise, never
// bare unseeded Math.random (Task 1 acceptance criteria) — the fixture's
// shape (row counts, weight progression) is identical across every run so
// the timing test is never flaky on data shape.
//
// Batched/transactional inserts (RESEARCH.md STAT-04 + Pitfall on sync
// drivers): db.transaction() callbacks in this codebase must be plain
// synchronous functions using .run() (both better-sqlite3 and expo-sqlite
// Drizzle drivers are resultKind: "sync" — see db/workouts.ts's
// reorderWorkoutExercises doc comment). Rows are chunked to stay well under
// SQLite's bound-parameter limit while keeping seeding fast.

import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { exercises, sets, workoutExercises, workouts } from '../schema';
import { MUSCLE_GROUPS } from '../../constants/taxonomy';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

export interface SeedSyntheticHistoryOptions {
  years?: number;
  sessionsPerWeek?: number;
}

export interface SyntheticHistorySummary {
  workoutCount: number;
  setCount: number;
  sampleExerciseId: number;
}

const SEED = 20260722;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const EXERCISES_PER_SESSION = 5;
const SETS_PER_EXERCISE = 4;
const INSERT_CHUNK_SIZE = 300;

/**
 * mulberry32 — a tiny, fully deterministic PRNG (fixed seed in, fixed
 * sequence out). Used instead of Math.random so this fixture's exact shape
 * never varies between test runs.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One synthetic exercise per taxonomy muscle group (constants/taxonomy.ts),
 * so the weekly-volume path exercises real cross-group attribution (D-13). */
const EXERCISE_POOL = MUSCLE_GROUPS.map((group) => ({
  name: `Synthetic ${group} Compound`,
  muscleGroup: group,
}));

function chunkedInsert<T extends Record<string, unknown>>(
  tx: AnyDrizzleDb,
  table: Parameters<AnyDrizzleDb['insert']>[0],
  rows: T[],
): void {
  for (let i = 0; i < rows.length; i += INSERT_CHUNK_SIZE) {
    tx.insert(table).values(rows.slice(i, i + INSERT_CHUNK_SIZE)).run();
  }
}

/**
 * Inserts a deterministic ~5-year synthetic workout history: ~3
 * sessions/week, ~5 exercises/session, ~4 sets/exercise (≈780 workouts /
 * ≈15,600 sets by default — RESEARCH.md's STAT-04 "years of history"
 * stand-in). Exercise index 0 (first taxonomy muscle group) is trained in
 * EVERY session, guaranteeing at least one exercise has deep chronological
 * history for the per-exercise chart path; the remaining 4 session slots
 * rotate deterministically through the rest of the pool so every muscle
 * group accumulates volume for the weekly-volume path. Weight follows a
 * slow linear progression (40kg -> 80kg) plus small seeded noise, and reps
 * vary 5-10, so PR events and per-week volume are non-degenerate.
 *
 * All rows use explicit integer IDs (not autoincrement) so the whole
 * dataset can be pre-computed in JS and inserted in one transaction of
 * chunked multi-row `.values([...])` calls — never 15,600 separate awaited
 * single inserts (Task 1 acceptance criteria).
 */
export function seedSyntheticHistory(
  db: AnyDrizzleDb,
  opts?: SeedSyntheticHistoryOptions,
): SyntheticHistorySummary {
  const years = opts?.years ?? 5;
  const sessionsPerWeek = opts?.sessionsPerWeek ?? 3;

  const rand = mulberry32(SEED);

  const workoutCount = Math.round(years * 52 * sessionsPerWeek);
  const totalSpanMs = years * 365 * MS_PER_DAY;
  const stepMs = workoutCount > 0 ? totalSpanMs / workoutCount : 0;
  const startMs = Date.now() - totalSpanMs;

  const exerciseRows = EXERCISE_POOL.map((ex, i) => ({
    id: i + 1,
    name: ex.name,
    muscleGroup: ex.muscleGroup as string,
    equipment: 'Barbell',
    isCustom: false,
    notes: null as string | null,
    seedId: null as string | null,
    archived: false,
    restSeconds: null as number | null,
  }));
  const sampleExerciseId = exerciseRows[0].id;
  const rotationPoolSize = exerciseRows.length - 1;

  const workoutRows: (typeof workouts.$inferInsert)[] = [];
  const workoutExerciseRows: (typeof workoutExercises.$inferInsert)[] = [];
  const setRows: (typeof sets.$inferInsert)[] = [];

  let workoutExerciseId = 1;
  let setId = 1;

  for (let w = 0; w < workoutCount; w++) {
    const workoutId = w + 1;
    const startedAtMs = Math.round(startMs + w * stepMs);
    const startedAt = new Date(startedAtMs).toISOString();
    const finishedAt = new Date(startedAtMs + 45 * 60 * 1000).toISOString();

    workoutRows.push({
      id: workoutId,
      name: null,
      startedAt,
      finishedAt,
      notes: null,
      templateId: null,
    });

    // Slot 0 is always the sample exercise; remaining slots rotate
    // deterministically through the rest of the pool.
    const sessionExerciseIds = [exerciseRows[0].id];
    for (let slot = 1; slot < EXERCISES_PER_SESSION; slot++) {
      const poolIndex = 1 + ((w + slot) % rotationPoolSize);
      sessionExerciseIds.push(exerciseRows[poolIndex].id);
    }

    const progressFrac = workoutCount > 1 ? w / (workoutCount - 1) : 0;
    const baseWeight = 40 + progressFrac * 40; // slow 40kg -> 80kg progression

    sessionExerciseIds.forEach((exerciseId, position) => {
      const weId = workoutExerciseId++;
      workoutExerciseRows.push({
        id: weId,
        workoutId,
        exerciseId,
        position,
        notes: null,
      });

      for (let s = 0; s < SETS_PER_EXERCISE; s++) {
        const noise = (rand() - 0.5) * 5; // +/- 2.5kg seeded noise
        const weightKg = Math.max(5, Math.round((baseWeight + noise) * 2) / 2);
        const reps = 5 + Math.floor(rand() * 6); // 5-10
        setRows.push({
          id: setId++,
          workoutExerciseId: weId,
          setNumber: s + 1,
          weightKg,
          reps,
          type: 'normal',
          rpe: null,
          completedAt: startedAt,
        });
      }
    });
  }

  db.transaction((tx: AnyDrizzleDb) => {
    chunkedInsert(tx, exercises, exerciseRows);
    chunkedInsert(tx, workouts, workoutRows);
    chunkedInsert(tx, workoutExercises, workoutExerciseRows);
    chunkedInsert(tx, sets, setRows);
  });

  return {
    workoutCount: workoutRows.length,
    setCount: setRows.length,
    sampleExerciseId,
  };
}
