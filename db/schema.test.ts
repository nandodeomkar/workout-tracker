import { describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';

const EXPECTED_TABLES = [
  'exercises',
  'workouts',
  'workout_exercises',
  'sets',
  'templates',
  'template_exercises',
  'programs',
  'program_days',
  'program_state',
  'training_maxes',
  'body_measurements',
  'settings',
  'backup_meta',
  'metric_definitions',
];

describe('migration 0001', () => {
  it('creates all 14 design-spec tables against a fresh database', () => {
    const { sqlite } = createTestDb();

    const rows = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const tableNames = rows.map((r) => r.name);

    for (const table of EXPECTED_TABLES) {
      expect(tableNames).toContain(table);
    }
  });

  it('gives the exercises table the Phase-1 columns seed_id, is_custom, and archived', () => {
    const { sqlite } = createTestDb();

    const columns = sqlite.prepare('PRAGMA table_info(exercises)').all() as { name: string }[];
    const columnNames = columns.map((c) => c.name);

    expect(columnNames).toContain('seed_id');
    expect(columnNames).toContain('is_custom');
    expect(columnNames).toContain('archived');
  });
});
