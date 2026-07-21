// Shared vitest fixture: opens an in-memory better-sqlite3 database and
// applies the generated Drizzle migration .sql files, driven by the same
// driver-agnostic schema module used on-device (db/schema.ts).
//
// Reads the migration file list from drizzle/meta/_journal.json so
// ordering is authoritative (matches what drizzle-orm/expo-sqlite/migrator
// applies on-device via useMigrations).

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import * as schema from '../schema';

const DRIZZLE_DIR = path.resolve(__dirname, '../../drizzle');
const JOURNAL_PATH = path.join(DRIZZLE_DIR, 'meta', '_journal.json');

interface JournalEntry {
  idx: number;
  tag: string;
}

interface Journal {
  entries: JournalEntry[];
}

function readJournal(): Journal {
  if (!existsSync(JOURNAL_PATH)) {
    return { entries: [] };
  }
  const raw = readFileSync(JOURNAL_PATH, 'utf-8');
  return JSON.parse(raw) as Journal;
}

function migrationFilePath(tag: string): string {
  return path.join(DRIZZLE_DIR, `${tag}.sql`);
}

/**
 * Applies every generated migration (in journal order) to the given
 * in-memory database instance.
 */
function applyAllMigrations(sqlite: Database.Database): void {
  const journal = readJournal();
  for (const entry of journal.entries) {
    applyMigrationFile(sqlite, entry.tag);
  }
}

/**
 * Applies only the first `n` migrations (in journal order) — used by the
 * FNDN-02 upgrade test (Plan 03) to simulate an app opening an
 * older-schema database before the next migration runs.
 */
export function applyMigrationsUpTo(sqlite: Database.Database, n: number): void {
  const journal = readJournal();
  for (const entry of journal.entries.slice(0, n)) {
    applyMigrationFile(sqlite, entry.tag);
  }
}

function applyMigrationFile(sqlite: Database.Database, tag: string): void {
  const filePath = migrationFilePath(tag);
  const sql = readFileSync(filePath, 'utf-8');
  // Generated Drizzle SQL files separate statements with a
  // `--> statement-breakpoint` marker.
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) {
    sqlite.exec(statement);
  }
}

/**
 * Opens a fresh `:memory:` better-sqlite3 database, applies every
 * generated migration, and returns a Drizzle instance bound to the
 * driver-agnostic schema.
 */
export function createTestDb(): {
  sqlite: Database.Database;
  db: BetterSQLite3Database<typeof schema>;
} {
  const sqlite = new Database(':memory:');
  applyAllMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}
