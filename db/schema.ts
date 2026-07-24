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

import { index, int, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const exercises = sqliteTable(
  "exercises",
  {
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    muscleGroup: text("muscle_group").notNull(),
    equipment: text().notNull(),
    isCustom: int("is_custom", { mode: "boolean" }).notNull().default(false),
    notes: text(),
    // Phase-1 additions (D-04/D-10/D-11):
    seedId: text("seed_id").unique(),
    archived: int({ mode: "boolean" }).notNull().default(false),
    // Phase-2 addition (D-08): nullable per-exercise rest override.
    // null means "use settings.default_rest_seconds" (Pattern 5 fallback).
    restSeconds: int("rest_seconds"),
  },
  (table) => [
    // FNDN-02 migration 0002 (Plan 03): additive search/filter indexes
    // backing the Exercises tab's substring search and chip filtering
    // (EXER-01) as the library grows.
    index("idx_exercises_name").on(table.name),
    index("idx_exercises_muscle_group").on(table.muscleGroup),
    index("idx_exercises_equipment").on(table.equipment),
  ],
);

export const workouts = sqliteTable("workouts", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text(),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  notes: text(),
  templateId: int("template_id").references(() => templates.id),
  // Phase-6 addition (D-05, migration 0004): program-origin marker. Both
  // null for empty/template-only/ad-hoc-history-repeat starts. Set together
  // ONLY when a workout is started from an active program's day
  // (startWorkoutFromProgramDay) — an ad-hoc reuse of the same template
  // (templateId set, programId null) must never advance/progress a program.
  programId: int("program_id").references(() => programs.id),
  programDayPosition: int("program_day_position"),
});

export const workoutExercises = sqliteTable("workout_exercises", {
  id: int().primaryKey({ autoIncrement: true }),
  workoutId: int("workout_id")
    .notNull()
    .references(() => workouts.id),
  exerciseId: int("exercise_id")
    .notNull()
    .references(() => exercises.id),
  position: int().notNull(),
  notes: text(),
});

export const sets = sqliteTable("sets", {
  id: int().primaryKey({ autoIncrement: true }),
  workoutExerciseId: int("workout_exercise_id")
    .notNull()
    .references(() => workoutExercises.id),
  setNumber: int("set_number").notNull(),
  weightKg: real("weight_kg").notNull(),
  reps: int().notNull(),
  type: text().$type<"normal" | "warmup" | "dropset" | "failure">().notNull().default("normal"),
  rpe: real(),
  completedAt: text("completed_at").notNull(),
});

export const templates = sqliteTable("templates", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  folder: text(),
  position: int().notNull(),
  notes: text(),
});

export const templateExercises = sqliteTable("template_exercises", {
  id: int().primaryKey({ autoIncrement: true }),
  templateId: int("template_id")
    .notNull()
    .references(() => templates.id),
  exerciseId: int("exercise_id")
    .notNull()
    .references(() => exercises.id),
  position: int().notNull(),
  targetSets: int("target_sets").notNull(),
  targetReps: int("target_reps").notNull(),
  targetWeightKg: real("target_weight_kg"),
  // JSON: {type:"linear", increment_kg:2.5} or {type:"percent_tm", scheme:[...]}
  progression: text(),
  // Phase-6 addition (D-08, migration 0004): consecutive linear-progression
  // misses on this exercise. Reset to 0 on any success AND on a deload firing
  // (Pitfall 8); incremented on a miss under the fail threshold.
  consecutiveFails: int("consecutive_fails").notNull().default(0),
});

export const programs = sqliteTable("programs", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  notes: text(),
});

export const programDays = sqliteTable("program_days", {
  id: int().primaryKey({ autoIncrement: true }),
  programId: int("program_id")
    .notNull()
    .references(() => programs.id),
  position: int().notNull(),
  templateId: int("template_id")
    .notNull()
    .references(() => templates.id),
});

export const programState = sqliteTable("program_state", {
  programId: int("program_id")
    .primaryKey()
    .references(() => programs.id),
  currentDayPosition: int("current_day_position").notNull(),
});

export const trainingMaxes = sqliteTable("training_maxes", {
  exerciseId: int("exercise_id")
    .primaryKey()
    .references(() => exercises.id),
  maxKg: real("max_kg").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const bodyMeasurements = sqliteTable("body_measurements", {
  id: int().primaryKey({ autoIncrement: true }),
  metric: text().notNull(),
  value: real().notNull(),
  measuredAt: text("measured_at").notNull(),
});

// Phase-5 addition (MEAS-01/D-06): single runtime source of truth for
// built-in + custom body-measurement metric identity, mirroring the
// exercises table's seedId/isCustom pattern (metricKey plays seedId's role
// as the stable unique conflict target for additive seeding).
export const metricDefinitions = sqliteTable("metric_definitions", {
  metricKey: text("metric_key").primaryKey(),
  label: text().notNull(),
  unitType: text("unit_type").$type<"weight" | "length" | "percent">().notNull(),
  isCustom: int("is_custom", { mode: "boolean" }).notNull().default(false),
  position: int().notNull(),
});

// Phase-6 gap-closure addition (migration 0005, Test-3 approved resolution
// in 06-UAT.md): per-LIFT-per-PROGRAM linear progression state. Keyed by
// (program_id, exercise_id) rather than per-template-exercise-row, so a lift
// that appears on multiple program days (e.g. StrongLifts A/B Squat) shares
// one working weight + fail streak instead of two independent ones. Plan
// 06-08 makes this table the single source of truth for linear progression,
// replacing template_exercises.target_weight_kg/consecutive_fails for that
// purpose.
export const programExerciseProgress = sqliteTable(
  "program_exercise_progress",
  {
    programId: int("program_id")
      .notNull()
      .references(() => programs.id),
    exerciseId: int("exercise_id")
      .notNull()
      .references(() => exercises.id),
    // Nullable: null means "unset" (before any finish has anchored the
    // lift). Canonical kg (never display-unit), matching sets.weight_kg and
    // lib/progression.ts, which round to nearest 0.5 kg.
    workingWeightKg: real("working_weight_kg"),
    consecutiveFails: int("consecutive_fails").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.programId, table.exerciseId] })],
);

export const settings = sqliteTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
});

export const backupMeta = sqliteTable("backup_meta", {
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
export type MetricDefinition = typeof metricDefinitions.$inferSelect;
export type NewMetricDefinition = typeof metricDefinitions.$inferInsert;
export type ProgramExerciseProgress = typeof programExerciseProgress.$inferSelect;
export type NewProgramExerciseProgress = typeof programExerciseProgress.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type BackupMeta = typeof backupMeta.$inferSelect;
export type NewBackupMeta = typeof backupMeta.$inferInsert;
