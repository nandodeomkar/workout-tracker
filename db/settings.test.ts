// D-07/D-14 settings key-value helper tests (db/settings.ts).

import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { createTestDb } from './test/fixture';
import { settings } from './schema';
import { getSetting, setSetting } from './settings';

describe('getSetting', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('returns null for an absent key', async () => {
    const value = await getSetting(db, 'units');
    expect(value).toBeNull();
  });
});

describe('setSetting', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    ({ db } = createTestDb());
  });

  it('round-trips a value through setSetting then getSetting', async () => {
    await setSetting(db, 'units', 'lb');
    const value = await getSetting(db, 'units');
    expect(value).toBe('lb');
  });

  it('is idempotent: writing the same key twice updates rather than duplicates', async () => {
    await setSetting(db, 'default_rest_seconds', '90');
    await setSetting(db, 'default_rest_seconds', '120');

    const value = await getSetting(db, 'default_rest_seconds');
    expect(value).toBe('120');

    const rows = await db.select().from(settings).where(eq(settings.key, 'default_rest_seconds'));
    expect(rows).toHaveLength(1);
  });
});
