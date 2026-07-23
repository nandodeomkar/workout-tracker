// FNDN-02: proves a simulated app upgrade (an additive schema migration)
// runs against an already-populated database without crashing or losing
// data. Populates a database at an older migration point, then applies the
// next migration in the journal and asserts every previously-inserted row
// survives unchanged, and that the new columns/indexes exist.
//
// This is the canonical migration-safety harness — later phases extend
// this pattern for their own N -> N+1 upgrades.
//
// Deliberately uses RAW sqlite statements (not the Drizzle query builder)
// to populate/read the "before" snapshot: db/schema.ts always describes the
// CURRENT (latest) full schema, so a Drizzle insert/select against a table
// that hasn't yet received a later migration's columns fails — Drizzle's
// insert always references every schema-declared column (writing NULL for
// omitted ones), which does not exist pre-migration. Raw SQL sidesteps that
// mismatch and keeps this harness valid at every point in migration history.

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { applyMigrationsUpTo } from './test/fixture';

const DRIZZLE_DIR = path.resolve(__dirname, '../drizzle');
const JOURNAL_PATH = path.join(DRIZZLE_DIR, 'meta', '_journal.json');

interface JournalEntry {
  idx: number;
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

function readJournal(): Journal {
  const raw = readFileSync(JOURNAL_PATH, 'utf-8');
  return JSON.parse(raw) as Journal;
}

/** Applies a single migration file (by journal entry) directly to the sqlite handle. */
function applyMigrationEntry(sqlite: Database.Database, entry: JournalEntry): void {
  const filePath = path.join(DRIZZLE_DIR, `${entry.tag}.sql`);
  const sql = readFileSync(filePath, 'utf-8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    sqlite.exec(statement);
  }
}

const EXPECTED_INDEXES = [
  'idx_exercises_name',
  'idx_exercises_muscle_group',
  'idx_exercises_equipment',
];

const SEED_EXERCISES = [
  { seed_id: 'upgrade-test-bench-press', name: 'Bench Press', muscle_group: 'Chest', equipment: 'Barbell' },
  { seed_id: 'upgrade-test-squat', name: 'Squat', muscle_group: 'Legs', equipment: 'Barbell' },
  { seed_id: 'upgrade-test-pull-up', name: 'Pull Up', muscle_group: 'Back', equipment: 'Bodyweight' },
];

function insertSeedExercises(sqlite: Database.Database): void {
  const stmt = sqlite.prepare(
    'INSERT INTO exercises (seed_id, name, muscle_group, equipment) VALUES (?, ?, ?, ?)',
  );
  for (const ex of SEED_EXERCISES) {
    stmt.run(ex.seed_id, ex.name, ex.muscle_group, ex.equipment);
  }
}

function selectAllExercises(sqlite: Database.Database): Record<string, unknown>[] {
  return sqlite.prepare('SELECT * FROM exercises ORDER BY id').all() as Record<string, unknown>[];
}

describe('FNDN-02: migration 0000 -> 0001 preserves data (simulated app upgrade)', () => {
  it('applies migration 0001 on top of a populated 0000 database without losing rows or the settings row', () => {
    // 1. Open a fresh in-memory DB and apply ONLY migration 0000.
    const sqlite = new Database(':memory:');
    applyMigrationsUpTo(sqlite, 1);

    // 2. Populate with a known, deterministic dataset via raw SQL (schema.ts
    //    describes the current full schema, which is ahead of this migration
    //    point — see file-header comment).
    insertSeedExercises(sqlite);
    sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('seed_version', '2');

    const beforeExercises = selectAllExercises(sqlite);
    const beforeSettings = sqlite
      .prepare('SELECT * FROM settings WHERE key = ?')
      .all('seed_version') as Record<string, unknown>[];
    expect(beforeExercises.length).toBe(SEED_EXERCISES.length);
    expect(beforeSettings[0]?.value).toBe('2');

    // 3. Apply the next migration in the journal (simulated app upgrade to 0001).
    const journal = readJournal();
    expect(journal.entries.length).toBeGreaterThanOrEqual(2);
    const nextEntry = journal.entries[1]!;
    applyMigrationEntry(sqlite, nextEntry);

    // 4. Assert every inserted exercise row is still present, unchanged.
    const afterExercises = selectAllExercises(sqlite);
    expect(afterExercises.length).toBe(beforeExercises.length);
    for (const before of beforeExercises) {
      const after = afterExercises.find((e) => e.id === before.id);
      expect(after).toEqual(before);
    }

    // 5. Assert the settings row is unchanged (zero data loss on upgrade).
    const afterSettings = sqlite
      .prepare('SELECT * FROM settings WHERE key = ?')
      .all('seed_version') as Record<string, unknown>[];
    expect(afterSettings).toEqual(beforeSettings);

    // 6. Assert the additive search/filter indexes exist after the upgrade.
    const indexRows = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index'")
      .all() as { name: string }[];
    const indexNames = indexRows.map((r) => r.name);
    for (const expected of EXPECTED_INDEXES) {
      expect(indexNames).toContain(expected);
    }

    sqlite.close();
  });
});

describe('D-08: migration 0001 -> 0002 (rest_seconds) preserves data (simulated app upgrade)', () => {
  it('applies migration 0002 on top of a populated 0001 database without losing rows, defaulting rest_seconds to null', () => {
    // 1. Open a fresh in-memory DB and apply only migrations 0000+0001.
    const sqlite = new Database(':memory:');
    applyMigrationsUpTo(sqlite, 2);

    // 2. Populate with a known, deterministic dataset via raw SQL (rest_seconds
    //    does not exist on the physical table yet at this migration point).
    insertSeedExercises(sqlite);

    const beforeExercises = selectAllExercises(sqlite);
    expect(beforeExercises.length).toBe(SEED_EXERCISES.length);
    expect(Object.keys(beforeExercises[0]!)).not.toContain('rest_seconds');

    // 3. Apply the idx-2 migration in the journal (simulated app upgrade to 0002).
    const journal = readJournal();
    expect(journal.entries.length).toBeGreaterThanOrEqual(3);
    const nextEntry = journal.entries[2]!;
    applyMigrationEntry(sqlite, nextEntry);

    // 4. Assert every inserted exercise row survives unchanged, with rest_seconds
    //    defaulting to null (additive, non-destructive).
    const afterExercises = selectAllExercises(sqlite);
    expect(afterExercises.length).toBe(beforeExercises.length);
    for (const before of beforeExercises) {
      const after = afterExercises.find((e) => e.id === before.id);
      expect(after).toEqual({ ...before, rest_seconds: null });
    }

    // 5. Assert the new column exists on the live table.
    const columns = sqlite.prepare('PRAGMA table_info(exercises)').all() as { name: string }[];
    expect(columns.map((c) => c.name)).toContain('rest_seconds');

    sqlite.close();
  });
});

describe('MEAS-01: migration 0002 -> 0003 (metric_definitions) preserves data (simulated app upgrade)', () => {
  it('applies migration 0003 on top of a populated 0002 database without losing body_measurements rows, adding metric_definitions', () => {
    // 1. Open a fresh in-memory DB and apply only migrations 0000+0001+0002.
    const sqlite = new Database(':memory:');
    applyMigrationsUpTo(sqlite, 3);

    // 2. Populate with a known, deterministic body_measurements dataset via
    //    raw SQL (metric_definitions does not exist on the physical DB yet
    //    at this migration point).
    sqlite
      .prepare('INSERT INTO body_measurements (metric, value, measured_at) VALUES (?, ?, ?)')
      .run('weight', 82.5, '2026-07-01');
    sqlite
      .prepare('INSERT INTO body_measurements (metric, value, measured_at) VALUES (?, ?, ?)')
      .run('waist', 88, '2026-07-01');

    const beforeMeasurements = sqlite
      .prepare('SELECT * FROM body_measurements ORDER BY id')
      .all() as Record<string, unknown>[];
    expect(beforeMeasurements.length).toBe(2);

    const tablesBefore = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    expect(tablesBefore.map((t) => t.name)).not.toContain('metric_definitions');

    // 3. Apply the idx-3 migration in the journal (simulated app upgrade to 0003).
    const journal = readJournal();
    expect(journal.entries.length).toBeGreaterThanOrEqual(4);
    const nextEntry = journal.entries[3]!;
    applyMigrationEntry(sqlite, nextEntry);

    // 4. Assert every inserted body_measurements row survives unchanged.
    const afterMeasurements = sqlite
      .prepare('SELECT * FROM body_measurements ORDER BY id')
      .all() as Record<string, unknown>[];
    expect(afterMeasurements).toEqual(beforeMeasurements);

    // 5. Assert the new metric_definitions table now exists (additive-only,
    //    no ALTER on any existing table).
    const columns = sqlite.prepare('PRAGMA table_info(metric_definitions)').all() as { name: string }[];
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain('metric_key');
    expect(columnNames).toContain('label');
    expect(columnNames).toContain('unit_type');
    expect(columnNames).toContain('is_custom');
    expect(columnNames).toContain('position');

    sqlite.close();
  });
});
