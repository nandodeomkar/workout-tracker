// FNDN-02: proves a simulated app upgrade (an additive schema migration)
// runs against an already-populated database without crashing or losing
// data. Populates a database at migration 0001, then applies the next
// migration in the journal (0002) and asserts every previously-inserted
// row survives unchanged, and that the new search/filter indexes exist.
//
// This is the canonical migration-safety harness — later phases extend
// this pattern for their own N -> N+1 upgrades.

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { exercises, settings } from './schema';
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
  { seedId: 'upgrade-test-bench-press', name: 'Bench Press', muscleGroup: 'Chest', equipment: 'Barbell' },
  { seedId: 'upgrade-test-squat', name: 'Squat', muscleGroup: 'Legs', equipment: 'Barbell' },
  { seedId: 'upgrade-test-pull-up', name: 'Pull Up', muscleGroup: 'Back', equipment: 'Bodyweight' },
];

describe('FNDN-02: migration 0001 -> next migration preserves data (simulated app upgrade)', () => {
  it('applies the next migration on top of a populated 0001 database without losing rows or the settings row', () => {
    // 1. Open a fresh in-memory DB and apply ONLY migration 0001.
    const sqlite = new Database(':memory:');
    applyMigrationsUpTo(sqlite, 1);
    const db = drizzle(sqlite, { schema: { exercises, settings } });

    // 2. Populate with a known, deterministic dataset through the query builder.
    for (const ex of SEED_EXERCISES) {
      db.insert(exercises).values(ex).run();
    }
    db.insert(settings).values({ key: 'seed_version', value: '2' }).run();

    const beforeExercises = db.select().from(exercises).all();
    const beforeSettings = db.select().from(settings).where(eq(settings.key, 'seed_version')).all();
    expect(beforeExercises.length).toBe(SEED_EXERCISES.length);
    expect(beforeSettings[0]?.value).toBe('2');

    // 3. Apply the next migration in the journal (simulated app upgrade to 0002).
    const journal = readJournal();
    expect(journal.entries.length).toBeGreaterThanOrEqual(2);
    const nextEntry = journal.entries[1]!;
    applyMigrationEntry(sqlite, nextEntry);

    // 4. Assert every inserted exercise row is still present, unchanged.
    const afterExercises = db.select().from(exercises).all();
    expect(afterExercises.length).toBe(beforeExercises.length);
    for (const before of beforeExercises) {
      const after = afterExercises.find((e) => e.id === before.id);
      expect(after).toEqual(before);
    }

    // 5. Assert the settings row is unchanged (zero data loss on upgrade).
    const afterSettings = db.select().from(settings).where(eq(settings.key, 'seed_version')).all();
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
