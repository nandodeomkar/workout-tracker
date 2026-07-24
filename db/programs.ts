// Parameterized, transaction-safe program data layer (PROG-01/PROG-02/PROG-03/PROG-04).
//
// Mirrors db/templates.ts exactly: driver-agnostic sqlite-core schema imports
// only (works unchanged against the on-device Drizzle driver and the vitest
// in-memory Drizzle driver), assertValid* guards before every write, and
// synchronous db.transaction((tx) => { tx.X().run() }) callbacks (both
// drivers construct BaseSQLiteDatabase with resultKind: 'sync' — an async
// transaction callback would return before its awaited queries ran).
//
// Security (T-06-02/T-06-03/T-06-04): every predicate below is built via
// Drizzle's parameterized query-builder helpers, never a string concatenated
// from user input.
//
// D-05 (Pitfall 1): program advancement/progression MUST be gated on
// workouts.program_id !== null, never on workouts.template_id alone — an
// ad-hoc reuse of a program's template must never advance/progress it. This
// module writes that origin marker at startWorkoutFromProgramDay time only;
// startWorkoutFromTemplate (db/templates.ts) never touches it.
//
// D-15 (Pitfall 4): bundled program JSON definitions are typed distinctly
// (BundledProgramDefinition) from Program/Template DB rows so materializing
// one ALWAYS clones fresh rows via createTemplate/createProgram/
// setTemplateExercises — the bundle object itself is never mutated, and two
// materializations of the same bundle produce two fully independent programs
// (clone independence).

import { and, eq, inArray } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  exercises,
  programDays,
  programExerciseProgress,
  programs,
  programState,
  templateExercises,
  trainingMaxes,
  workoutExercises,
  workouts,
  type Program,
  type ProgramDay,
  type ProgramExerciseProgress,
  type ProgramState,
  type TrainingMax,
  type Workout,
} from './schema';
import { getSetting } from './settings';
import {
  createTemplate,
  loadTemplateDetail,
  setTemplateExercises,
  startWorkoutFromTemplate,
  type TemplateDetail,
  type TemplateExerciseInput,
} from './templates';
import { insertSet, loadWorkoutDetail } from './workouts';
import {
  bumpTrainingMax,
  computePercentTmWeight,
  DEFAULT_DELOAD_PCT,
  DEFAULT_FAIL_THRESHOLD,
  evaluateLinearSuccess,
  nextDayPosition,
  resolveLinearProgression,
  type LinearProgressionRule,
  type PercentTmRule,
  type WorkingSetPerformance,
} from '../lib/progression';
import { displayToKg, kgToDisplay } from '../lib/weightUnits';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

/** Reasonable upper bound on free-text input (ASVS V5) before writing to SQLite. */
const MAX_NAME_LENGTH = 200;
/** Sane upper bound on any weight-ish numeric input (kg) — well above any real lift. */
const MAX_WEIGHT_KG = 1000;
/** Sane upper bound on a per-exercise linear increment (kg) — no real program jumps this much per session. */
const MAX_INCREMENT_KG = 100;
/** Sane upper bound on a consecutive-fail streak — a runaway counter signals a bug, not real training history. */
const MAX_CONSECUTIVE_FAILS = 1000;
/** Sane upper bound on a program's day-list length. */
const MAX_DAY_POSITION = 1000;

/** Default barbell weight (kg/lb) when settings.bar_weight_kg/lb is unset (mirrors app/(tabs)/settings.tsx's fallback). */
const DEFAULT_BAR_WEIGHT_KG = 20;
const DEFAULT_BAR_WEIGHT_LB = 45;

/**
 * D-12: maps a %TM exercise's stable seed_id (data/bundledPrograms/index.ts#
 * LIFT_SEED_IDS) to its training-max-bump category (5/3/1 convention:
 * bench/overhead-press bump +2.5kg "upper"; squat/deadlift bump +5kg
 * "lower"). An exercise with no entry (e.g. a custom-authored %TM program on
 * a lift outside the bundled five) defaults to "upper" — the smaller, more
 * conservative bump.
 */
const TM_BUMP_CATEGORY_BY_SEED_ID: Record<string, 'upper' | 'lower'> = {
  'barbell-squat': 'lower',
  'barbell-deadlift': 'lower',
  'barbell-bench-press-medium-grip': 'upper',
  'standing-military-press': 'upper',
  'bent-over-barbell-row': 'upper',
};

function assertValidName(name: string | null | undefined): string | null {
  if (name == null) {
    return null;
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
  return trimmed;
}

/**
 * Rejects negative/NaN/non-finite/zero per-exercise linear increments and
 * caps at a sane upper bound (T-06-03/ASVS V5) before any progression write.
 */
function assertValidIncrementKg(incrementKg: number): number {
  if (!Number.isFinite(incrementKg) || incrementKg <= 0) {
    throw new Error('Increment must be a positive number');
  }
  if (incrementKg > MAX_INCREMENT_KG) {
    throw new Error(`Increment must be ${MAX_INCREMENT_KG}kg or less`);
  }
  return incrementKg;
}

/**
 * Rejects negative/NaN/non-finite/zero training maxes and caps at a sane
 * upper bound (T-06-03/ASVS V5) before any training_maxes write.
 */
function assertValidTrainingMaxKg(maxKg: number): number {
  if (!Number.isFinite(maxKg) || maxKg <= 0) {
    throw new Error('Training max must be a positive number');
  }
  if (maxKg > MAX_WEIGHT_KG) {
    throw new Error(`Training max must be ${MAX_WEIGHT_KG}kg or less`);
  }
  return maxKg;
}

/**
 * Rejects negative/NaN/non-finite/zero per-lift working weights and caps at
 * a sane upper bound (T-08-01/ASVS V5) before any program_exercise_progress
 * write — mirrors assertValidTrainingMaxKg's invariant.
 */
function assertValidWorkingWeightKg(weightKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    throw new Error('Working weight must be a positive number');
  }
  if (weightKg > MAX_WEIGHT_KG) {
    throw new Error(`Working weight must be ${MAX_WEIGHT_KG}kg or less`);
  }
  return weightKg;
}

/**
 * Rejects negative/NaN/non-integer consecutive-fail counts and caps at a
 * sane upper bound (T-06-03/ASVS V5).
 */
function assertValidConsecutiveFails(fails: number): number {
  if (!Number.isInteger(fails) || fails < 0) {
    throw new Error('Consecutive fails must be a non-negative integer');
  }
  if (fails > MAX_CONSECUTIVE_FAILS) {
    throw new Error(`Consecutive fails must be ${MAX_CONSECUTIVE_FAILS} or fewer`);
  }
  return fails;
}

/**
 * Rejects negative/NaN/non-integer day positions and caps at a sane upper
 * bound (T-06-02/ASVS V5) — the actual advance/wrap math always derives the
 * next position via `(position + 1) % dayCount` (lib/progression.ts#nextDayPosition),
 * never trusting a stored position blindly against a stale day count.
 */
function assertValidDayPosition(position: number): number {
  if (!Number.isInteger(position) || position < 0) {
    throw new Error('Day position must be a non-negative integer');
  }
  if (position > MAX_DAY_POSITION) {
    throw new Error(`Day position must be ${MAX_DAY_POSITION} or fewer`);
  }
  return position;
}

export interface CreateProgramInput {
  name: string;
  notes?: string | null;
}

/** Creates a program (PROG-01). Name is required and validated. */
export async function createProgram(db: AnyDrizzleDb, input: CreateProgramInput): Promise<Program> {
  const name = assertValidName(input.name);
  if (name == null) {
    throw new Error('Program name is required');
  }
  const notes = input.notes ?? null;

  const [created] = await db.insert(programs).values({ name, notes }).returning();

  return created;
}

export interface AddProgramDayInput {
  programId: number;
  position: number;
  templateId: number;
}

/**
 * Adds an ordered day to a program (PROG-01), pointing at an existing
 * (already-created) template. `position` is validated (non-negative integer).
 */
export async function addProgramDay(db: AnyDrizzleDb, input: AddProgramDayInput): Promise<ProgramDay> {
  const position = assertValidDayPosition(input.position);

  const [created] = await db
    .insert(programDays)
    .values({ programId: input.programId, position, templateId: input.templateId })
    .returning();

  return created;
}

export interface ProgramDayDetail {
  day: ProgramDay;
  template: TemplateDetail;
}

export interface ProgramDetail {
  program: Program;
  days: ProgramDayDetail[];
}

/**
 * Reads one program with its ordered days (by position) and each day's full
 * template detail — mirrors db/templates.ts#loadTemplateDetail's shape.
 * Returns `undefined` if the program does not exist.
 */
export async function loadProgramDetail(db: AnyDrizzleDb, programId: number): Promise<ProgramDetail | undefined> {
  const [program] = await db.select().from(programs).where(eq(programs.id, programId));
  if (!program) {
    return undefined;
  }

  const dayRows = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .orderBy(programDays.position);

  const days: ProgramDayDetail[] = [];
  for (const day of dayRows) {
    const template = await loadTemplateDetail(db, day.templateId);
    if (template) {
      days.push({ day, template });
    }
  }

  return { program, days };
}

export interface ProgramSummary {
  program: Program;
  dayCount: number;
  /** "Linear" | "Percent-TM" | "Mixed" | "Custom" — derived from each day's template_exercises.progression (06-03 programs-manager list caption). */
  origin: string;
}

/**
 * Every user-owned program (bundled-materialized or custom-built), each
 * paired with its day count and a derived progression-origin summary for the
 * programs-manager list caption ("{N} days · {origin}"). Origin is "Linear"
 * or "Percent-TM" when every day's exercises share one progression type,
 * "Mixed" when a program combines both, and "Custom" when no day carries a
 * progression rule yet. Malformed/unparseable `progression` JSON is skipped
 * rather than thrown (same Tampering guard as listProgramTrainingMaxes).
 */
export async function loadAllPrograms(db: AnyDrizzleDb): Promise<ProgramSummary[]> {
  const programRows = await db.select().from(programs).orderBy(programs.id);

  const summaries: ProgramSummary[] = [];
  for (const program of programRows) {
    const dayRows = await db.select().from(programDays).where(eq(programDays.programId, program.id));
    const templateIds = dayRows.map((day) => day.templateId);

    const types = new Set<string>();
    if (templateIds.length > 0) {
      const teRows = await db
        .select()
        .from(templateExercises)
        .where(inArray(templateExercises.templateId, templateIds));
      for (const te of teRows) {
        if (!te.progression) {
          continue;
        }
        try {
          const parsed = JSON.parse(te.progression) as { type?: string };
          if (parsed?.type === 'linear' || parsed?.type === 'percent_tm') {
            types.add(parsed.type);
          }
        } catch {
          // Malformed progression JSON — skip rather than crash (ASVS V5).
        }
      }
    }

    let origin = 'Custom';
    if (types.size === 1) {
      origin = types.has('linear') ? 'Linear' : 'Percent-TM';
    } else if (types.size > 1) {
      origin = 'Mixed';
    }

    summaries.push({ program, dayCount: dayRows.length, origin });
  }

  return summaries;
}

export interface ActiveProgramDetail {
  state: ProgramState;
  program: Program;
  currentDay: ProgramDayDetail | undefined;
}

/**
 * D-01: reads the single active program (the sole program_state row) joined
 * to its program row + the day detail at its current pointer. Returns
 * `undefined` when no program is active.
 */
export async function loadActiveProgram(db: AnyDrizzleDb): Promise<ActiveProgramDetail | undefined> {
  const [state] = await db.select().from(programState).limit(1);
  if (!state) {
    return undefined;
  }

  const [program] = await db.select().from(programs).where(eq(programs.id, state.programId));
  if (!program) {
    return undefined;
  }

  const [dayRow] = await db
    .select()
    .from(programDays)
    .where(and(eq(programDays.programId, state.programId), eq(programDays.position, state.currentDayPosition)));

  let currentDay: ProgramDayDetail | undefined;
  if (dayRow) {
    const template = await loadTemplateDetail(db, dayRow.templateId);
    if (template) {
      currentDay = { day: dayRow, template };
    }
  }

  return { state, program, currentDay };
}

/**
 * D-01: makes exactly one program active — deletes any existing
 * program_state row(s) then inserts one pointing at `programId` +
 * `currentDayPosition` (default 0). Single synchronous transaction so a
 * partial pointer switch is never observable.
 */
export async function setActiveProgram(db: AnyDrizzleDb, programId: number, currentDayPosition = 0): Promise<void> {
  const position = assertValidDayPosition(currentDayPosition);

  db.transaction((tx) => {
    tx.delete(programState).run();
    tx.insert(programState).values({ programId, currentDayPosition: position }).run();
  });
}

/**
 * Detach-before-delete (mirrors db/templates.ts#deleteTemplate's Pitfall-3
 * discipline): nulls out any workouts.program_id/program_day_position
 * referencing this program, deletes its program_state row (if active), its
 * program_days, then the program itself — one synchronous transaction. Never
 * cascade-deletes the cloned templates (they remain user-owned, editable
 * standalone templates, matching deleteTemplate's own "never cascade" stance).
 */
export async function deleteProgram(db: AnyDrizzleDb, programId: number): Promise<void> {
  db.transaction((tx) => {
    tx.update(workouts)
      .set({ programId: null, programDayPosition: null })
      .where(eq(workouts.programId, programId))
      .run();
    tx.delete(programState).where(eq(programState.programId, programId)).run();
    // Plan 06-08: also detach the per-lift linear progression state
    // (program_exercise_progress, Plan 06-07) — leaving no orphan rows
    // behind for a deleted program.
    tx.delete(programExerciseProgress).where(eq(programExerciseProgress.programId, programId)).run();
    tx.delete(programDays).where(eq(programDays.programId, programId)).run();
    tx.delete(programs).where(eq(programs.id, programId)).run();
  });
}

export interface BundledProgramExerciseDefinition {
  seedId: string;
  targetSets: number;
  targetReps: number;
  progression: LinearProgressionRule | PercentTmRule | null;
}

export interface BundledProgramDayDefinition {
  name: string;
  exercises: BundledProgramExerciseDefinition[];
}

/**
 * A bundled program is static, read-only app data (D-15) — typed distinctly
 * from Program/Template DB rows so the type system forces a translation
 * through materializeBundledProgram's fresh inserts (Pitfall 4). Never
 * mutate an instance of this type; only cloned copies are ever written to.
 */
export interface BundledProgramDefinition {
  name: string;
  notes?: string | null;
  days: BundledProgramDayDefinition[];
}

/**
 * D-15/Pattern 2: clones a bundled program's templates + days into fresh,
 * user-owned rows and activates it at day 0. Every exercise's seedId is
 * resolved via `exerciseSeedIdToId` UP FRONT, before any DB write (Pitfall
 * 6) — a missing seed_id throws a clear error naming it, rather than ever
 * inserting a dangling/null exercise reference or leaving a
 * partially-materialized program behind. Reuses createTemplate +
 * setTemplateExercises (db/templates.ts) per day, then createProgram +
 * addProgramDay, then setActiveProgram(..., 0). Never mutates `bundle`
 * itself (Pitfall 4) — two materializations of the same bundle produce two
 * fully independent programs with distinct cloned template ids (clone
 * independence).
 */
export async function materializeBundledProgram(
  db: AnyDrizzleDb,
  bundle: BundledProgramDefinition,
  exerciseSeedIdToId: Map<string, number>,
): Promise<Program> {
  // Pitfall 6: resolve every seed_id across every day BEFORE any write.
  const resolvedDays = bundle.days.map((day) => ({
    name: day.name,
    exercises: day.exercises.map((exercise) => {
      const exerciseId = exerciseSeedIdToId.get(exercise.seedId);
      if (exerciseId == null) {
        throw new Error(
          `Bundled program "${bundle.name}" references unknown exercise seed_id "${exercise.seedId}"`,
        );
      }
      return { ...exercise, exerciseId };
    }),
  }));

  // Pitfall 4: `bundle` is never mutated — every write below is a fresh
  // insert into user-owned rows via createProgram/createTemplate/
  // setTemplateExercises/addProgramDay.
  const program = await createProgram(db, { name: bundle.name, notes: bundle.notes ?? null });

  for (const [position, day] of resolvedDays.entries()) {
    const template = await createTemplate(db, { name: day.name, position });

    const rows: TemplateExerciseInput[] = day.exercises.map((exercise, exerciseIndex) => ({
      exerciseId: exercise.exerciseId,
      position: exerciseIndex,
      targetSets: exercise.targetSets,
      targetReps: exercise.targetReps,
      targetWeightKg: null,
      progression: exercise.progression ? JSON.stringify(exercise.progression) : null,
    }));

    await setTemplateExercises(db, template.id, rows);
    await addProgramDay(db, { programId: program.id, position, templateId: template.id });
  }

  await setActiveProgram(db, program.id, 0);

  return program;
}

/**
 * D-13: computes a single %TM prescribed weight in kg for storage, delegating
 * plate-loadable rounding to lib/progression.ts#computePercentTmWeight in the
 * ACTIVE display unit (never the raw, unrounded TM*pct — Assumption A2). The
 * canonical-kg training max is converted to the display unit via
 * lib/weightUnits.ts#kgToDisplay when unit is 'lb' (never an inline `*
 * 2.20462`, per that module's own contract) — bar weight is already stored
 * natively per unit (Pitfall 1, never cross-converted) — then the
 * plate-loadable result is converted back to canonical kg via displayToKg for
 * the `sets.weight_kg` write.
 */
function computePrescribedWeightKg(
  trainingMaxKg: number,
  pct: number,
  barWeightKg: number,
  barWeightLb: number,
  unit: 'kg' | 'lb',
): number {
  if (unit === 'kg') {
    return computePercentTmWeight(trainingMaxKg, pct, barWeightKg, 'kg');
  }
  const trainingMaxLb = kgToDisplay(trainingMaxKg, 'lb');
  const weightLb = computePercentTmWeight(trainingMaxLb, pct, barWeightLb, 'lb');
  return displayToKg(weightLb, 'lb');
}

/**
 * D-13: after a %TM day's workout_exercises rows exist (same order as
 * `templateDetail.exercises`, per startWorkoutFromTemplate's 1:1 index
 * mapping), inserts plate-loadable prescribed sets for every `percent_tm`
 * exercise that has a training max set. A missing/unset training max (T-06-03
 * — never a garbage 0-weight prescription) leaves that exercise's card with
 * NO inserted sets, falling back to the existing last-performance/target
 * pre-fill already used by the active-workout screen. Malformed progression
 * JSON is skipped (T-06-01), mirroring applyProgressionAndAdvance's guard.
 */
async function prefillPercentTmSets(db: AnyDrizzleDb, workoutId: number, templateDetail: TemplateDetail): Promise<void> {
  const hasPercentTm = templateDetail.exercises.some(({ templateExercise }) => {
    if (!templateExercise.progression) {
      return false;
    }
    try {
      const parsed = JSON.parse(templateExercise.progression) as { type?: string };
      return parsed?.type === 'percent_tm';
    } catch {
      return false;
    }
  });
  if (!hasPercentTm) {
    return;
  }

  const workoutExerciseRows = await db
    .select()
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId))
    .orderBy(workoutExercises.position);

  const [unitSetting, barKgSetting, barLbSetting] = await Promise.all([
    getSetting(db, 'units'),
    getSetting(db, 'bar_weight_kg'),
    getSetting(db, 'bar_weight_lb'),
  ]);
  const unit: 'kg' | 'lb' = unitSetting === 'lb' ? 'lb' : 'kg';
  const parsedBarKg = Number(barKgSetting ?? DEFAULT_BAR_WEIGHT_KG);
  const parsedBarLb = Number(barLbSetting ?? DEFAULT_BAR_WEIGHT_LB);
  const barWeightKg = Number.isFinite(parsedBarKg) && parsedBarKg >= 0 ? parsedBarKg : DEFAULT_BAR_WEIGHT_KG;
  const barWeightLb = Number.isFinite(parsedBarLb) && parsedBarLb >= 0 ? parsedBarLb : DEFAULT_BAR_WEIGHT_LB;

  for (const [index, { templateExercise }] of templateDetail.exercises.entries()) {
    if (!templateExercise.progression) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(templateExercise.progression);
    } catch {
      continue; // Malformed progression JSON — skip (T-06-01).
    }
    if (!parsed || typeof parsed !== 'object' || (parsed as { type?: unknown }).type !== 'percent_tm') {
      continue;
    }
    const validSets = parseValidPercentTmSets(parsed as { sets?: unknown });
    if (!validSets) {
      continue; // Missing/out-of-range pct or reps — skip (T-06-01).
    }

    const tm = await getTrainingMax(db, templateExercise.exerciseId);
    if (!tm) {
      continue; // T-06-03: no TM set yet — leave unprescribed, never insert a garbage 0-weight set.
    }

    const workoutExercise = workoutExerciseRows[index];
    if (!workoutExercise) {
      continue;
    }

    for (const [setIndex, schemeSet] of validSets.entries()) {
      const weightKg = computePrescribedWeightKg(tm.maxKg, schemeSet.pct, barWeightKg, barWeightLb, unit);
      await insertSet(db, {
        workoutExerciseId: workoutExercise.id,
        setNumber: setIndex + 1,
        weightKg,
        reps: schemeSet.reps,
        type: 'normal',
      });
    }
  }
}

/**
 * D-04/D-05: starts a workout from a specific program day (tapping ANY day,
 * not only the pointed-to one) — resolves the program_days row at
 * `dayPosition`, delegates to startWorkoutFromTemplate (db/templates.ts) for
 * the actual workout/exercise creation, then writes the origin marker
 * (workouts.program_id + program_day_position) via a follow-up update, and
 * moves the active-program pointer to follow whatever day was started
 * (D-04). Throws if the program has no day at that position.
 *
 * D-13: after the workout/exercises exist, prefills plate-loadable %TM
 * prescribed weights for every percent_tm exercise on this day that already
 * has a training max set (prefillPercentTmSets) — a missing TM leaves that
 * card unprescribed rather than inserting a garbage 0-weight set.
 */
export async function startWorkoutFromProgramDay(
  db: AnyDrizzleDb,
  programId: number,
  dayPosition: number,
): Promise<Workout> {
  const position = assertValidDayPosition(dayPosition);

  const [day] = await db
    .select()
    .from(programDays)
    .where(and(eq(programDays.programId, programId), eq(programDays.position, position)));

  if (!day) {
    throw new Error(`Program ${programId} has no day at position ${position}`);
  }

  const templateDetail = await loadTemplateDetail(db, day.templateId);

  const workout = await startWorkoutFromTemplate(db, day.templateId);

  const [updated] = await db
    .update(workouts)
    .set({ programId, programDayPosition: position })
    .where(eq(workouts.id, workout.id))
    .returning();

  await setActiveProgram(db, programId, position);

  if (templateDetail) {
    await prefillPercentTmSets(db, workout.id, templateDetail);
  }

  return updated;
}

/** Reads the current training max row for an exercise, or `undefined` if unset. */
export async function getTrainingMax(db: AnyDrizzleDb, exerciseId: number): Promise<TrainingMax | undefined> {
  const [row] = await db.select().from(trainingMaxes).where(eq(trainingMaxes.exerciseId, exerciseId));
  return row;
}

/**
 * Plan 06-08: reads the per-LIFT-per-PROGRAM shared linear progression state
 * (composite key program_id+exercise_id, added in Plan 06-07), or `undefined`
 * if the lift has never had a finish anchor it (first run). Mirrors
 * getTrainingMax's single-row-select shape.
 */
export async function getProgramExerciseProgress(
  db: AnyDrizzleDb,
  programId: number,
  exerciseId: number,
): Promise<ProgramExerciseProgress | undefined> {
  const [row] = await db
    .select()
    .from(programExerciseProgress)
    .where(and(eq(programExerciseProgress.programId, programId), eq(programExerciseProgress.exerciseId, exerciseId)));
  return row;
}

/**
 * D-10/D-12: validated upsert of an exercise's training max, stamping
 * `updatedAt`. `training_maxes.exercise_id` is the primary key, so this never
 * crashes on a duplicate-key insert (mirrors db/settings.ts#setSetting's
 * onConflictDoUpdate convention).
 */
export async function setTrainingMax(db: AnyDrizzleDb, exerciseId: number, maxKg: number): Promise<TrainingMax> {
  const validMaxKg = assertValidTrainingMaxKg(maxKg);
  const updatedAt = new Date().toISOString();

  const [row] = await db
    .insert(trainingMaxes)
    .values({ exerciseId, maxKg: validMaxKg, updatedAt })
    .onConflictDoUpdate({ target: trainingMaxes.exerciseId, set: { maxKg: validMaxKg, updatedAt } })
    .returning();

  return row;
}

export interface ProgramTrainingMaxEntry {
  exerciseId: number;
  maxKg: number | null;
}

/**
 * Distinct exercises across the program's days whose template_exercises row
 * carries a `{type:"percent_tm"}` progression rule, each paired with its
 * current training_maxes.max_kg (`null` if not yet set — feeds the D-16
 * TM-setup-prompt UI). Malformed/unparseable `progression` JSON is skipped
 * rather than thrown (Tampering guard, ASVS V5) — a corrupted free-text
 * column must never crash this read path.
 */
export async function listProgramTrainingMaxes(db: AnyDrizzleDb, programId: number): Promise<ProgramTrainingMaxEntry[]> {
  const dayRows = await db.select().from(programDays).where(eq(programDays.programId, programId));
  const templateIds = dayRows.map((day) => day.templateId);
  if (templateIds.length === 0) {
    return [];
  }

  const teRows = await db
    .select()
    .from(templateExercises)
    .where(inArray(templateExercises.templateId, templateIds));

  const exerciseIds = new Set<number>();
  for (const te of teRows) {
    if (!te.progression) {
      continue;
    }
    try {
      const parsed = JSON.parse(te.progression) as { type?: string };
      if (parsed?.type === 'percent_tm') {
        exerciseIds.add(te.exerciseId);
      }
    } catch {
      // Malformed progression JSON — skip rather than crash (ASVS V5).
    }
  }

  const entries: ProgramTrainingMaxEntry[] = [];
  for (const exerciseId of exerciseIds) {
    const tm = await getTrainingMax(db, exerciseId);
    entries.push({ exerciseId, maxKg: tm?.maxKg ?? null });
  }

  return entries;
}

/** One linear-progression exercise's finish-time outcome (D-06/D-08/D-09). */
export interface LinearProgressionOutcome {
  type: 'linear';
  exerciseId: number;
  outcome: 'success' | 'hold' | 'deload';
  /** Rule increment (kg) — feeds the success badge "+{N}{unit}". */
  incrementKg: number;
  /** Deload percentage (0-1) — feeds the deload badge "-{pct}%". */
  deloadPct: number;
  /** Consecutive-miss count: post-write value for hold, the threshold that fired for deload. */
  consecutiveFails: number;
  failThreshold: number;
  nextWeightKg: number;
}

/**
 * One percent-of-TM exercise's finish-time outcome — informational only (the
 * TM-bump-on-wrap write itself is reported separately via
 * ProgramProgressResult.bumpedTrainingMaxes, not on this per-day outcome).
 * Reports the top/main set of this day's scheme (the highest-pct set,
 * typically the AMRAP/work set) as the single representative prescribed
 * pct/reps pair.
 */
export interface PercentTmProgressionOutcome {
  type: 'percent_tm';
  exerciseId: number;
  pct: number;
  reps: number;
}

export type ProgressionOutcome = LinearProgressionOutcome | PercentTmProgressionOutcome;

/** D-12: one %TM exercise's training-max bump, fired exactly on a cycle-wrapping finish. */
export interface BumpedTrainingMax {
  exerciseId: number;
  previousTmKg: number;
  newTmKg: number;
}

/**
 * Result of applyProgressionAndAdvance. `applied` is false for an ad-hoc/
 * template-only/empty finish (workout.programId == null, Pitfall 1/7) — in
 * that case NO further fields are meaningful and NO writes occurred.
 */
export interface ProgramProgressResult {
  applied: boolean;
  outcomes: ProgressionOutcome[];
  nextPosition: number;
  wrapped: boolean;
  totalDays: number;
  /** D-12: every %TM exercise bumped this finish — always empty unless `wrapped` is true. */
  bumpedTrainingMaxes: BumpedTrainingMax[];
}

const EMPTY_PROGRESS_RESULT: ProgramProgressResult = {
  applied: false,
  outcomes: [],
  nextPosition: 0,
  wrapped: false,
  totalDays: 0,
  bumpedTrainingMaxes: [],
};

/**
 * Type-guards + numeric-range validates a parsed `template_exercises.progression`
 * linear rule before ANY progression math runs (T-06-01 Tampering mitigation).
 * Rejects a missing/non-finite/non-positive incrementKg. Mirrors
 * assertValidIncrementKg's positive-only invariant used at authoring time.
 */
function parseValidLinearRule(parsed: { incrementKg?: unknown }): LinearProgressionRule | null {
  const incrementKg = parsed.incrementKg;
  if (typeof incrementKg !== 'number' || !Number.isFinite(incrementKg) || incrementKg <= 0) {
    return null;
  }
  return { type: 'linear', incrementKg };
}

/**
 * Type-guards + numeric-range validates a parsed `template_exercises.progression`
 * percent_tm rule before it is ever read for display (T-06-01). Rejects a
 * missing/empty `sets` array or any set whose pct is outside (0,1] or whose
 * reps is not a positive integer.
 */
function parseValidPercentTmSets(parsed: { sets?: unknown }): Array<{ pct: number; reps: number; amrap?: boolean }> | null {
  if (!Array.isArray(parsed.sets) || parsed.sets.length === 0) {
    return null;
  }
  const validated: Array<{ pct: number; reps: number; amrap?: boolean }> = [];
  for (const raw of parsed.sets) {
    if (typeof raw !== 'object' || raw === null) {
      return null;
    }
    const { pct, reps, amrap } = raw as { pct?: unknown; reps?: unknown; amrap?: unknown };
    if (typeof pct !== 'number' || !Number.isFinite(pct) || pct <= 0 || pct > 1) {
      return null;
    }
    if (typeof reps !== 'number' || !Number.isInteger(reps) || reps <= 0) {
      return null;
    }
    validated.push({ pct, reps, amrap: typeof amrap === 'boolean' ? amrap : undefined });
  }
  return validated;
}

/**
 * D-02/D-09: the finish-time orchestration. Evaluates every progression-rule
 * exercise on the just-finished program day (linear success/hold/deload via
 * lib/progression.ts, percent_tm informational-only per Task 1), writes the
 * next weight + fail counter in place on the user-owned template_exercises
 * rows, and advances/wraps the active-program pointer — all in ONE
 * synchronous transaction (mirrors setTemplateExercises's convention).
 *
 * Guards on `workout.programId == null` as the VERY FIRST check, before any
 * further query (Pitfall 1/7) — an ad-hoc/template-only/empty finish does
 * zero program work and returns EMPTY_PROGRESS_RESULT.
 *
 * Malformed/negative/out-of-range progression JSON is validated and skipped
 * per-exercise (T-06-01) — a single bad rule never aborts the whole finish.
 */
export async function applyProgressionAndAdvance(db: AnyDrizzleDb, workoutId: number): Promise<ProgramProgressResult> {
  const [workout] = await db.select().from(workouts).where(eq(workouts.id, workoutId));
  if (!workout || workout.programId == null || workout.programDayPosition == null) {
    return EMPTY_PROGRESS_RESULT;
  }

  const programId = workout.programId;
  const dayPosition = workout.programDayPosition;

  const detail = await loadProgramDetail(db, programId);
  if (!detail || detail.days.length === 0) {
    return EMPTY_PROGRESS_RESULT;
  }

  const day = detail.days.find((d) => d.day.position === dayPosition);
  if (!day) {
    return EMPTY_PROGRESS_RESULT;
  }

  const workoutDetail = await loadWorkoutDetail(db, workoutId);
  const setsByExerciseId = new Map<number, Array<{ weightKg: number; reps: number; type: WorkingSetPerformance['type'] }>>();
  if (workoutDetail) {
    for (const { workoutExercise, sets: setRows } of workoutDetail.exercises) {
      const list = setsByExerciseId.get(workoutExercise.exerciseId) ?? [];
      for (const setRow of setRows) {
        list.push({ weightKg: setRow.weightKg, reps: setRow.reps, type: setRow.type });
      }
      setsByExerciseId.set(workoutExercise.exerciseId, list);
    }
  }

  const outcomes: ProgressionOutcome[] = [];
  // Plan 06-08: linear writes now go to program_exercise_progress, keyed
  // per-LIFT (program_id, exercise_id) — never the per-row template_exercises
  // columns (defect B: two program days sharing one lift must share one
  // write, not progress independently).
  const linearWrites: Array<{ exerciseId: number; workingWeightKg: number; consecutiveFails: number }> = [];

  for (const { templateExercise } of day.template.exercises) {
    if (!templateExercise.progression) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(templateExercise.progression);
    } catch {
      continue; // Malformed progression JSON — skip, never crash the finish (T-06-01).
    }
    if (!parsed || typeof parsed !== 'object') {
      continue;
    }
    const rule = parsed as { type?: unknown; incrementKg?: unknown; sets?: unknown };

    if (rule.type === 'linear') {
      const linearRule = parseValidLinearRule(rule);
      if (!linearRule) {
        continue; // Negative/non-finite/missing incrementKg — skip (T-06-01).
      }

      const rawSets = setsByExerciseId.get(templateExercise.exerciseId) ?? [];
      const setsForEval: WorkingSetPerformance[] = rawSets.map((s) => ({
        weightKg: s.weightKg,
        reps: s.reps,
        targetReps: templateExercise.targetReps,
        type: s.type,
      }));

      // Plan 06-08: read the per-lift shared state (may be undefined on the
      // very first finish for this lift in this program).
      const prior = await getProgramExerciseProgress(db, programId, templateExercise.exerciseId);

      // CR-01: anchor the linear "current weight" on the weight actually
      // logged this session (the lightest working set), falling back to the
      // per-lift prior working weight, then the template's own target, only
      // when there are no working sets. Bundled AND custom programs seed
      // target_weight_kg = null, so keying off a stale/absent anchor alone
      // progressed from 0 kg on the first finish — prescribing 2.5 kg
      // regardless of the real lift. Success is evaluated against the prior
      // per-lift working weight when present (subsequent finishes), else the
      // template's stored target, else the logged anchor so reps alone
      // decide the first session.
      const workingSets = setsForEval.filter((s) => s.type !== 'warmup');
      const loggedWeightKg =
        workingSets.length > 0
          ? Math.min(...workingSets.map((s) => s.weightKg))
          : (prior?.workingWeightKg ?? templateExercise.targetWeightKg ?? 0);
      const successTarget = prior?.workingWeightKg ?? templateExercise.targetWeightKg ?? loggedWeightKg;
      const success = evaluateLinearSuccess(setsForEval, successTarget);
      const priorFails = prior?.consecutiveFails ?? 0;
      const result = resolveLinearProgression(loggedWeightKg, linearRule, success, priorFails);

      linearWrites.push({
        exerciseId: templateExercise.exerciseId,
        workingWeightKg: result.nextWeightKg,
        consecutiveFails: result.nextConsecutiveFails,
      });

      outcomes.push({
        type: 'linear',
        exerciseId: templateExercise.exerciseId,
        outcome: result.deloaded ? 'deload' : success ? 'success' : 'hold',
        incrementKg: linearRule.incrementKg,
        deloadPct: DEFAULT_DELOAD_PCT,
        consecutiveFails: result.deloaded ? DEFAULT_FAIL_THRESHOLD : result.nextConsecutiveFails,
        failThreshold: DEFAULT_FAIL_THRESHOLD,
        nextWeightKg: result.nextWeightKg,
      });
    } else if (rule.type === 'percent_tm') {
      const validSets = parseValidPercentTmSets(rule);
      if (!validSets) {
        continue; // Missing/out-of-range pct or reps — skip (T-06-01).
      }
      const topSet = validSets[validSets.length - 1]!;
      outcomes.push({
        type: 'percent_tm',
        exerciseId: templateExercise.exerciseId,
        pct: topSet.pct,
        reps: topSet.reps,
      });
    }
    // Unrecognized/none `rule.type` — skip silently (no progression to apply).
  }

  // WR-02: base the cycle-wrap boundary on the TRUE program_days count, not
  // the post-filter detail.days.length. loadProgramDetail silently drops any
  // day whose template fails to load, which would otherwise shift the modulo
  // boundary and mistime the wrap (and its %TM training-max bump). deleteTemplate
  // now refuses to remove a program-referenced template, so this is
  // defense-in-depth against a transiently unloadable day.
  const allProgramDayRows = await db
    .select({ id: programDays.id })
    .from(programDays)
    .where(eq(programDays.programId, programId));
  const totalDays = allProgramDayRows.length > 0 ? allProgramDayRows.length : detail.days.length;

  const { position: nextPosition, wrapped } = nextDayPosition(dayPosition, totalDays);

  // D-12/Pitfall 3: TM bump fires ONLY on a cycle-wrapping finish (pointer
  // wraps from the last day back to 0) — never per lift-week. Every DISTINCT
  // percent_tm exercise across the WHOLE program's days (not only today's
  // day) is bumped exactly once per cycle wrap.
  const bumpedTrainingMaxes: BumpedTrainingMax[] = [];
  if (wrapped) {
    const percentTmExerciseIds = new Set<number>();
    for (const { template } of detail.days) {
      for (const { templateExercise } of template.exercises) {
        if (!templateExercise.progression) {
          continue;
        }
        try {
          const parsed = JSON.parse(templateExercise.progression) as { type?: string };
          if (parsed?.type === 'percent_tm') {
            percentTmExerciseIds.add(templateExercise.exerciseId);
          }
        } catch {
          // Malformed progression JSON — skip (T-06-01).
        }
      }
    }

    for (const exerciseId of percentTmExerciseIds) {
      const tm = await getTrainingMax(db, exerciseId);
      if (!tm) {
        continue; // No TM set yet — nothing to bump.
      }
      const [exerciseRow] = await db.select().from(exercises).where(eq(exercises.id, exerciseId));
      const category = (exerciseRow?.seedId ? TM_BUMP_CATEGORY_BY_SEED_ID[exerciseRow.seedId] : undefined) ?? 'upper';
      const newTmKg = bumpTrainingMax(tm.maxKg, category);
      bumpedTrainingMaxes.push({ exerciseId, previousTmKg: tm.maxKg, newTmKg });
    }
  }

  const tmUpdatedAt = new Date().toISOString();

  db.transaction((tx) => {
    for (const write of linearWrites) {
      // T-08-01: validate before writing — reject a non-finite/non-positive
      // working weight and cap it, same discipline as assertValidTrainingMaxKg.
      const validatedWorkingWeightKg = assertValidWorkingWeightKg(write.workingWeightKg);
      const validatedConsecutiveFails = assertValidConsecutiveFails(write.consecutiveFails);
      tx.insert(programExerciseProgress)
        .values({
          programId,
          exerciseId: write.exerciseId,
          workingWeightKg: validatedWorkingWeightKg,
          consecutiveFails: validatedConsecutiveFails,
        })
        .onConflictDoUpdate({
          target: [programExerciseProgress.programId, programExerciseProgress.exerciseId],
          set: { workingWeightKg: validatedWorkingWeightKg, consecutiveFails: validatedConsecutiveFails },
        })
        .run();
    }
    for (const bump of bumpedTrainingMaxes) {
      const validatedTmKg = assertValidTrainingMaxKg(bump.newTmKg);
      tx.insert(trainingMaxes)
        .values({ exerciseId: bump.exerciseId, maxKg: validatedTmKg, updatedAt: tmUpdatedAt })
        .onConflictDoUpdate({ target: trainingMaxes.exerciseId, set: { maxKg: validatedTmKg, updatedAt: tmUpdatedAt } })
        .run();
    }
    tx.delete(programState).run();
    tx.insert(programState).values({ programId, currentDayPosition: nextPosition }).run();
    // WR-01: make this operation idempotent. Clearing this workout's
    // program-origin marker in the SAME transaction means a summary remount
    // (React StrictMode double-invoke, fast-refresh, or any re-navigation to
    // the summary screen for the same workoutId) re-enters
    // applyProgressionAndAdvance and early-returns at the top guard
    // (workout.programId == null) instead of advancing the pointer a second
    // time and re-bumping every %TM training max. The first-render banner is
    // unaffected — summary.tsx reads its program detail from a snapshot loaded
    // BEFORE this call.
    tx.update(workouts).set({ programId: null, programDayPosition: null }).where(eq(workouts.id, workoutId)).run();
  });

  return {
    applied: true,
    outcomes,
    nextPosition,
    wrapped,
    totalDays,
    bumpedTrainingMaxes,
  };
}
