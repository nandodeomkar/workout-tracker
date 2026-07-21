// Driver-agnostic Drizzle schema — imports ONLY from drizzle-orm/sqlite-core.
// This module is shared verbatim by two drivers:
//   - drizzle-orm/expo-sqlite (device, via db/client.ts)
//   - drizzle-orm/better-sqlite3 (vitest, via db/test/fixture.ts)
// Do NOT import expo-sqlite or better-sqlite3 here — that constraint is
// load-bearing for DB-layer tests running without a device/emulator.
//
// Implements the design spec's Data model section verbatim
// (docs/superpowers/specs/2026-07-19-workout-tracker-design.md), plus the
// Phase-1 exercises-table additions required by D-04/D-10/D-11: seed_id,
// is_custom, archived.

import { int, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const exercises = sqliteTable('exercises', {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  muscleGroup: text('muscle_group').notNull(),
  equipment: text().notNull(),
  isCustom: int('is_custom', { mode: 'boolean' }).notNull().default(false),
  notes: text(),
  // Phase-1 additions (D-04/D-10/D-11):
  seedId: text('seed_id').unique(),
  archived: int({ mode: 'boolean' }).notNull().default(false),
});

export const workouts = sqliteTable('workouts', {
  id: int().primaryKey({ autoIncrement: true }),
  name: text(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  notes: text(),
  templateId: int('template_id').references(() => templates.id),
});

export const workoutExercises = sqliteTable('workout_exercises', {
  id: int().primaryKey({ autoIncrement: true }),
  workoutId: int('workout_id')
    .notNull()
    .references(() => workouts.id),
  exerciseId: int('exercise_id')
    .notNull()
    .references(() => exercises.id),
  position: int().notNull(),
  notes: text(),
});

export const sets = sqliteTable('sets', {
  id: int().primaryKey({ autoIncrement: true }),
  workoutExerciseId: int('workout_exercise_id')
    .notNull()
    .references(() => workoutExercises.id),
  setNumber: int('set_number').notNull(),
  weightKg: real('weight_kg').notNull(),
  reps: int().notNull(),
  type: text().$type<'normal' | 'warmup' | 'dropset' | 'failure'>().notNull().default('normal'),
  rpe: real(),
  completedAt: text('completed_at').notNull(),
});

export const templates = sqliteTable('templates', {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  folder: text(),
  position: int().notNull(),
  notes: text(),
});

export const templateExercises = sqliteTable('template_exercises', {
  id: int().primaryKey({ autoIncrement: true }),
  templateId: int('template_id')
    .notNull()
    .references(() => templates.id),
  exerciseId: int('exercise_id')
    .notNull()
    .references(() => exercises.id),
  position: int().notNull(),
  targetSets: int('target_sets').notNull(),
  targetReps: int('target_reps').notNull(),
  targetWeightKg: real('target_weight_kg'),
  // JSON: {type:"linear", increment_kg:2.5} or {type:"percent_tm", scheme:[...]}
  progression: text(),
});

export const programs = sqliteTable('programs', {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  notes: text(),
});

export const programDays = sqliteTable('program_days', {
  id: int().primaryKey({ autoIncrement: true }),
  programId: int('program_id')
    .notNull()
    .references(() => programs.id),
  position: int().notNull(),
  templateId: int('template_id')
    .notNull()
    .references(() => templates.id),
});

export const programState = sqliteTable('program_state', {
  programId: int('program_id')
    .primaryKey()
    .references(() => programs.id),
  currentDayPosition: int('current_day_position').notNull(),
});

export const trainingMaxes = sqliteTable('training_maxes', {
  exerciseId: int('exercise_id')
    .primaryKey()
    .references(() => exercises.id),
  maxKg: real('max_kg').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const bodyMeasurements = sqliteTable('body_measurements', {
  id: int().primaryKey({ autoIncrement: true }),
  metric: text().notNull(),
  value: real().notNull(),
  measuredAt: text('measured_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
});

export const backupMeta = sqliteTable('backup_meta', {
  key: text().primaryKey(),
  value: text().notNull(),
});

// Inferred row types for downstream consumers.
export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert;
export type Set = typeof sets.$inferSelect;
export type NewSet = typeof sets.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type TemplateExercise = typeof templateExercises.$inferSelect;
export type NewTemplateExercise = typeof templateExercises.$inferInsert;
export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;
export type ProgramDay = typeof programDays.$inferSelect;
export type NewProgramDay = typeof programDays.$inferInsert;
export type ProgramState = typeof programState.$inferSelect;
export type NewProgramState = typeof programState.$inferInsert;
export type TrainingMax = typeof trainingMaxes.$inferSelect;
export type NewTrainingMax = typeof trainingMaxes.$inferInsert;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type NewBodyMeasurement = typeof bodyMeasurements.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type BackupMeta = typeof backupMeta.$inferSelect;
export type NewBackupMeta = typeof backupMeta.$inferInsert;
