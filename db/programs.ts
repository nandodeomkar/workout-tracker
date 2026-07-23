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
  programDays,
  programs,
  programState,
  templateExercises,
  trainingMaxes,
  workouts,
  type Program,
  type ProgramDay,
  type ProgramState,
  type TrainingMax,
  type Workout,
} from './schema';
import {
  createTemplate,
  loadTemplateDetail,
  setTemplateExercises,
  startWorkoutFromTemplate,
  type TemplateDetail,
  type TemplateExerciseInput,
} from './templates';
import type { LinearProgressionRule, PercentTmRule } from '../lib/progression';

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
 * D-04/D-05: starts a workout from a specific program day (tapping ANY day,
 * not only the pointed-to one) — resolves the program_days row at
 * `dayPosition`, delegates to startWorkoutFromTemplate (db/templates.ts) for
 * the actual workout/exercise creation, then writes the origin marker
 * (workouts.program_id + program_day_position) via a follow-up update, and
 * moves the active-program pointer to follow whatever day was started
 * (D-04). Throws if the program has no day at that position.
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

  const workout = await startWorkoutFromTemplate(db, day.templateId);

  const [updated] = await db
    .update(workouts)
    .set({ programId, programDayPosition: position })
    .where(eq(workouts.id, workout.id))
    .returning();

  await setActiveProgram(db, programId, position);

  return updated;
}

/** Reads the current training max row for an exercise, or `undefined` if unset. */
export async function getTrainingMax(db: AnyDrizzleDb, exerciseId: number): Promise<TrainingMax | undefined> {
  const [row] = await db.select().from(trainingMaxes).where(eq(trainingMaxes.exerciseId, exerciseId));
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
