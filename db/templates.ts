// Parameterized, transaction-safe template data layer (TMPL-01/TMPL-02).
//
// Mirrors db/workouts.ts exactly: driver-agnostic sqlite-core schema imports
// only (works unchanged against the on-device Drizzle driver and the vitest
// in-memory Drizzle driver), assertValid* guards before every write, and
// synchronous db.transaction((tx) => { tx.X().run() }) callbacks (both
// drivers construct BaseSQLiteDatabase with resultKind: 'sync' — an async
// transaction callback would return before its awaited queries ran).
//
// Security (T-03-06/T-03-07/T-03-08): every predicate below is built via
// Drizzle's parameterized query-builder helpers, never a string concatenated
// from user input.
//
// Pitfall 3 (data integrity): deleting a template must never leave a
// dangling workouts.template_id — deleteTemplate nulls out any referencing
// workouts BEFORE deleting template_exercises/templates, all inside one
// transaction.

import { and, asc, eq, isNotNull } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import {
  programDays,
  templateExercises,
  templates,
  workouts,
  type NewTemplate,
  type NewTemplateExercise,
  type Template,
  type TemplateExercise,
} from './schema';
import { addWorkoutExercise, startWorkout } from './workouts';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

/** Reasonable upper bound on free-text input (ASVS V5) before writing to SQLite. */
const MAX_NAME_LENGTH = 200;
/** Sane upper bound on a template exercise's target weight (kg) — well above any real lift. */
const MAX_WEIGHT_KG = 1000;
/** Sane upper bound on a template exercise's target reps/sets. */
const MAX_REPS = 1000;

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
 * Rejects negative/NaN/non-finite weights and caps at a sane upper bound
 * (T-03-07/ASVS V5) before any template_exercises insert or update. Returns
 * `null` unchanged (D-02 save-as-template always leaves target_weight_kg
 * null so weights come from last-performance pre-fill).
 */
function assertValidTargetWeightKg(weightKg: number | null | undefined): number | null {
  if (weightKg == null) {
    return null;
  }
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new Error('Target weight must be a non-negative number');
  }
  if (weightKg > MAX_WEIGHT_KG) {
    throw new Error(`Target weight must be ${MAX_WEIGHT_KG}kg or less`);
  }
  return weightKg;
}

/**
 * Rejects negative/NaN/non-integer reps and caps at a sane upper bound
 * (T-03-07/ASVS V5) before any template_exercises insert or update.
 */
function assertValidTargetReps(reps: number): number {
  if (!Number.isInteger(reps) || reps < 0) {
    throw new Error('Target reps must be a non-negative integer');
  }
  if (reps > MAX_REPS) {
    throw new Error(`Target reps must be ${MAX_REPS} or fewer`);
  }
  return reps;
}

/**
 * Rejects negative/NaN/non-integer set counts and caps at a sane upper bound
 * (T-03-07/ASVS V5) before any template_exercises insert or update.
 */
function assertValidTargetSets(sets: number): number {
  if (!Number.isInteger(sets) || sets < 0) {
    throw new Error('Target sets must be a non-negative integer');
  }
  if (sets > MAX_REPS) {
    throw new Error(`Target sets must be ${MAX_REPS} or fewer`);
  }
  return sets;
}

export interface CreateTemplateInput {
  name: string;
  folder?: string | null;
  notes?: string | null;
  position: number;
}

export interface UpdateTemplatePatch {
  name?: string;
  folder?: string | null;
  notes?: string | null;
  position?: number;
}

export interface AddTemplateExerciseInput {
  templateId: number;
  exerciseId: number;
  position: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
  /**
   * Phase-6 addition (D-17): serialized progression rule JSON
   * (`{type:"linear",incrementKg:N}` | `{type:"percent_tm",sets:[...]}`),
   * authored by the template builder or set during bundled-program
   * materialization (db/programs.ts). Defaults to null (no progression)
   * when omitted.
   */
  progression?: string | null;
}

export interface TemplateExerciseInput {
  exerciseId: number;
  position: number;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
  /** Phase-6 addition (D-17) — see AddTemplateExerciseInput's doc comment. */
  progression?: string | null;
}

/**
 * Creates a template (TMPL-01). Name is required and validated (trim +
 * MAX_NAME_LENGTH); folder is trimmed and normalized to null when blank
 * (D-04 — null means Uncategorized).
 */
export async function createTemplate(db: AnyDrizzleDb, input: CreateTemplateInput): Promise<Template> {
  const name = assertValidName(input.name);
  if (name == null) {
    throw new Error('Template name is required');
  }
  const folder = assertValidName(input.folder);
  const notes = input.notes ?? null;

  const [created] = await db
    .insert(templates)
    .values({ name, folder, notes, position: input.position })
    .returning();

  return created;
}

/**
 * Applies only the supplied fields through the same guards as createTemplate
 * (partial patch semantics — matches db/workouts.ts#updateSet convention).
 */
export async function updateTemplate(
  db: AnyDrizzleDb,
  templateId: number,
  patch: UpdateTemplatePatch,
): Promise<Template> {
  const values: Partial<NewTemplate> = {};
  if (patch.name !== undefined) {
    const name = assertValidName(patch.name);
    if (name == null) {
      throw new Error('Template name is required');
    }
    values.name = name;
  }
  if (patch.folder !== undefined) {
    values.folder = assertValidName(patch.folder);
  }
  if (patch.notes !== undefined) {
    values.notes = patch.notes;
  }
  if (patch.position !== undefined) {
    values.position = patch.position;
  }

  const [updated] = await db.update(templates).set(values).where(eq(templates.id, templateId)).returning();

  return updated;
}

/**
 * Adds a single exercise to a template at the given position (template
 * builder's incremental add path). `progression` is left untouched here —
 * that column belongs to Phase 6.
 */
export async function addTemplateExercise(
  db: AnyDrizzleDb,
  input: AddTemplateExerciseInput,
): Promise<TemplateExercise> {
  const targetSets = assertValidTargetSets(input.targetSets);
  const targetReps = assertValidTargetReps(input.targetReps);
  const targetWeightKg = assertValidTargetWeightKg(input.targetWeightKg);

  const [created] = await db
    .insert(templateExercises)
    .values({
      templateId: input.templateId,
      exerciseId: input.exerciseId,
      position: input.position,
      targetSets,
      targetReps,
      targetWeightKg,
      progression: input.progression ?? null,
    })
    .returning();

  return created;
}

/**
 * The builder's bulk-save path: transactionally deletes all existing
 * template_exercises for the template then inserts the supplied rows
 * (position-ordered). Runs as a single synchronous transaction so a partial
 * replace is never observable (mirrors db/workouts.ts#reorderWorkoutExercises
 * doc comment on why the callback is non-async).
 */
export async function setTemplateExercises(
  db: AnyDrizzleDb,
  templateId: number,
  rows: TemplateExerciseInput[],
): Promise<void> {
  const validatedRows = rows.map((row) => ({
    templateId,
    exerciseId: row.exerciseId,
    position: row.position,
    targetSets: assertValidTargetSets(row.targetSets),
    targetReps: assertValidTargetReps(row.targetReps),
    targetWeightKg: assertValidTargetWeightKg(row.targetWeightKg),
    progression: row.progression ?? null,
  }));

  db.transaction((tx) => {
    tx.delete(templateExercises).where(eq(templateExercises.templateId, templateId)).run();
    for (const row of validatedRows) {
      tx.insert(templateExercises).values(row).run();
    }
  });
}

/**
 * Hard-deletes a template and its template_exercises — but FIRST detaches
 * (nulls) any workouts.template_id that referenced it, in the SAME
 * transaction (Pitfall 3). SQLite in this project does not enforce FK
 * constraints at write time, so a naive delete-templates-first would leave
 * workouts pointing at a nonexistent row.
 */
export async function deleteTemplate(db: AnyDrizzleDb, templateId: number): Promise<void> {
  // WR-02 (Pitfall 3, program edge): a template used as a program day must
  // never be hard-deleted. program_days.template_id has no write-time FK
  // enforcement here, so a naive delete would leave a dangling program_days
  // row — desyncing the program pointer and mistiming the cycle-wrap /
  // %TM-bump math. Refuse with a clear error and let the caller remove the
  // day (or the whole program) first.
  const programDayRefs = await db
    .select({ id: programDays.id })
    .from(programDays)
    .where(eq(programDays.templateId, templateId));
  if (programDayRefs.length > 0) {
    throw new Error('Cannot delete template: it is used by a program. Remove it from the program first.');
  }

  const teRows = await db
    .select({ id: templateExercises.id })
    .from(templateExercises)
    .where(eq(templateExercises.templateId, templateId));

  db.transaction((tx) => {
    // Detach (never cascade-delete) any workouts that reference this
    // template — a deleted template must not corrupt workout history.
    tx.update(workouts).set({ templateId: null }).where(eq(workouts.templateId, templateId)).run();
    if (teRows.length > 0) {
      tx.delete(templateExercises).where(eq(templateExercises.templateId, templateId)).run();
    }
    tx.delete(templates).where(eq(templates.id, templateId)).run();
  });
}

export interface TemplateExerciseDetail {
  templateExercise: TemplateExercise;
}

export interface TemplateDetail {
  template: Template;
  exercises: TemplateExerciseDetail[];
}

/**
 * Reads one template with its ordered template_exercises (by position) —
 * mirrors db/workouts.ts#loadWorkoutDetail's loop-per-child shape. Returns
 * `undefined` if the template does not exist.
 */
export async function loadTemplateDetail(db: AnyDrizzleDb, templateId: number): Promise<TemplateDetail | undefined> {
  const [template] = await db.select().from(templates).where(eq(templates.id, templateId));
  if (!template) {
    return undefined;
  }

  const teRows = await db
    .select()
    .from(templateExercises)
    .where(eq(templateExercises.templateId, templateId))
    .orderBy(asc(templateExercises.position));

  const exerciseDetails: TemplateExerciseDetail[] = teRows.map((templateExercise) => ({ templateExercise }));

  return { template, exercises: exerciseDetails };
}

export interface TemplateFolderGroup {
  folder: string | null; // null = Uncategorized
  templates: Template[];
}

/**
 * Groups templates by folder for the Workout home list (D-05) — aggregation
 * happens in the query layer, the screen only renders (mirrors
 * db/workouts.ts#loadWorkoutHistory's convention). Named folders sort
 * case-insensitively (A4); Uncategorized (folder === null) sorts LAST (A3).
 * Templates within a folder order by templates.position (A5).
 */
export async function loadTemplatesGroupedByFolder(db: AnyDrizzleDb): Promise<TemplateFolderGroup[]> {
  const rows = await db.select().from(templates).orderBy(asc(templates.position));

  const byFolder = new Map<string | null, Template[]>();
  for (const row of rows) {
    const key = row.folder ?? null;
    const list = byFolder.get(key) ?? [];
    list.push(row);
    byFolder.set(key, list);
  }

  const namedFolders = [...byFolder.keys()]
    .filter((k): k is string => k !== null)
    .sort((a, b) => a.localeCompare(b));

  const groups: TemplateFolderGroup[] = namedFolders.map((folder) => ({
    folder,
    templates: byFolder.get(folder)!,
  }));

  if (byFolder.has(null)) {
    groups.push({ folder: null, templates: byFolder.get(null)! }); // Uncategorized last
  }

  return groups;
}

/**
 * Distinct non-null folder names for tap-suggestions (D-04), ordered
 * case-insensitively. Sorted in JS (rather than a SQL COLLATE clause) to
 * stay driver-agnostic across both Drizzle drivers this module supports.
 */
export async function loadFolderNames(db: AnyDrizzleDb): Promise<string[]> {
  const rows = await db
    .selectDistinct({ folder: templates.folder })
    .from(templates)
    .where(isNotNull(templates.folder));

  return rows
    .map((row) => row.folder)
    .filter((folder): folder is string => folder !== null)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Starts a workout from a template (TMPL-02): creates the workout with
 * templateId set, then copies the template's template_exercises into
 * workout_exercises in position order via db/workouts.ts#addWorkoutExercise.
 * Returns the created Workout.
 */
export async function startWorkoutFromTemplate(db: AnyDrizzleDb, templateId: number) {
  const detail = await loadTemplateDetail(db, templateId);
  const workout = await startWorkout(db, { templateId });

  if (detail) {
    for (const [index, { templateExercise }] of detail.exercises.entries()) {
      await addWorkoutExercise(db, workout.id, templateExercise.exerciseId, index);
    }
  }

  return workout;
}
