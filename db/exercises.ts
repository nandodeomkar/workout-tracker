// Query + mutation layer for the exercises table (D-09/D-10/D-11/D-12).
//
// Security (T-1-04/T-1-05): Drizzle's parameterized query builder only —
// every predicate below is built via Drizzle's query-builder helpers
// (eq/sql-template-with-bound-values), never a string concatenated from
// user input. The live search string never reaches SQL at all (it is
// filtered in memory by lib/exerciseFilter.ts).
//
// T-1-09: there is intentionally NO delete/drop function in this module —
// `setArchived` is the only way to remove an exercise from view, and it is
// always reversible (D-11).

import { asc, eq, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { exercises, type Exercise } from './schema';
import type { EquipmentType, MuscleGroup } from '../constants/taxonomy';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

/** Reasonable upper bound on free-text length (ASVS V5) before writing to SQLite. */
const MAX_NAME_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;

function assertValidName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error('Exercise name is required');
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new Error(`Exercise name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
  return trimmed;
}

function assertValidNotes(notes: string | null | undefined): string | null {
  if (notes == null) {
    return null;
  }
  if (notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes must be ${MAX_NOTES_LENGTH} characters or fewer`);
  }
  return notes;
}

/**
 * Returns all non-archived exercises, ordered A-Z by name (case-insensitive).
 */
export async function loadActiveExercises(db: AnyDrizzleDb): Promise<Exercise[]> {
  return db
    .select()
    .from(exercises)
    .where(eq(exercises.archived, false))
    .orderBy(asc(sql`lower(${exercises.name})`));
}

/**
 * Returns every exercise (including archived), ordered A-Z by name
 * (case-insensitive) — powers the D-11 "show archived" reveal toggle,
 * reusing the same ordering as loadActiveExercises.
 */
export async function loadAllExercises(db: AnyDrizzleDb): Promise<Exercise[]> {
  return db.select().from(exercises).orderBy(asc(sql`lower(${exercises.name})`));
}

/**
 * Returns a single exercise by id, or undefined if it does not exist —
 * used by the [id] edit/detail screen.
 */
export async function loadExerciseById(db: AnyDrizzleDb, id: number): Promise<Exercise | undefined> {
  const [row] = await db.select().from(exercises).where(eq(exercises.id, id));
  return row;
}

/**
 * Returns all exercises whose name matches `name` case-insensitively
 * (exact match, not substring) — used to power the D-12 duplicate-name
 * warn-but-allow hint. Includes archived rows so a duplicate against an
 * archived exercise is still surfaced.
 */
export async function findByName(db: AnyDrizzleDb, name: string): Promise<Exercise[]> {
  return db
    .select()
    .from(exercises)
    .where(sql`lower(${exercises.name}) = lower(${name})`);
}

export interface CreateExerciseInput {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: EquipmentType;
  notes?: string | null;
}

/**
 * Inserts a new custom exercise. Always `is_custom=true`, `archived=false`,
 * `seed_id=null` (D-09). Duplicate names are allowed — the warn-but-allow
 * UX (D-12) is a UI concern, not a mutation-layer constraint.
 */
export async function createExercise(db: AnyDrizzleDb, input: CreateExerciseInput): Promise<Exercise> {
  const name = assertValidName(input.name);
  const notes = assertValidNotes(input.notes);

  const [created] = await db
    .insert(exercises)
    .values({
      name,
      muscleGroup: input.muscleGroup,
      equipment: input.equipment,
      isCustom: true,
      archived: false,
      seedId: null,
      notes,
    })
    .returning();

  return created;
}

export interface UpdateExerciseInput {
  name: string;
  muscleGroup: MuscleGroup;
  equipment: EquipmentType;
  notes?: string | null;
}

/**
 * Updates name/muscleGroup/equipment/notes for ANY exercise row, including
 * seeded ones (D-10). Never touches `seed_id` or `is_custom` — an edit to a
 * seeded exercise stays linked to its seed lineage and stays non-custom.
 */
export async function updateExercise(
  db: AnyDrizzleDb,
  id: number,
  patch: UpdateExerciseInput,
): Promise<Exercise> {
  const name = assertValidName(patch.name);
  const notes = assertValidNotes(patch.notes);

  const [updated] = await db
    .update(exercises)
    .set({
      name,
      muscleGroup: patch.muscleGroup,
      equipment: patch.equipment,
      notes,
    })
    .where(eq(exercises.id, id))
    .returning();

  return updated;
}

/**
 * Flips the `archived` flag only (D-11). Reversible in both directions;
 * never deletes the row or touches any other column. There is no
 * hard-delete function in this module — this is the only removal path.
 */
export async function setArchived(db: AnyDrizzleDb, id: number, archived: boolean): Promise<Exercise> {
  const [updated] = await db
    .update(exercises)
    .set({ archived })
    .where(eq(exercises.id, id))
    .returning();

  return updated;
}
