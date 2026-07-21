import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { exercises, settings } from '../schema';
import { createTestDb } from '../test/fixture';
import curatedSeedData from './exercises.seed.json';
import { runSeedIfNeeded } from './runSeed';
import { CURRENT_SEED_VERSION } from './seedVersion';

describe('runSeedIfNeeded', () => {
  it('populates the full curated library and records seed_version on a fresh database', async () => {
    const { db } = createTestDb();

    await runSeedIfNeeded(db);

    const rows = await db.select().from(exercises);
    expect(rows.length).toBe(curatedSeedData.length);
    expect(rows.every((r) => typeof r.seedId === 'string' && r.seedId.length > 0)).toBe(true);

    const versionRows = await db.select().from(settings).where(eq(settings.key, 'seed_version'));
    expect(versionRows[0]?.value).toBe(String(CURRENT_SEED_VERSION));
  });

  it('does not duplicate rows when run a second time (idempotent)', async () => {
    const { db } = createTestDb();

    await runSeedIfNeeded(db);
    const firstCount = (await db.select().from(exercises)).length;

    await runSeedIfNeeded(db);
    const secondCount = (await db.select().from(exercises)).length;

    expect(secondCount).toBe(firstCount);
    expect(secondCount).toBe(curatedSeedData.length);
  });

  it('never overwrites a user-edited seeded row when re-seeding after a version bump (D-04/D-10)', async () => {
    const { db } = createTestDb();

    await runSeedIfNeeded(db);
    const [firstRow] = await db.select().from(exercises).limit(1);
    expect(firstRow).toBeDefined();

    // Simulate a user editing a seeded exercise's name in place.
    const editedName = 'User Edited Name';
    await db.update(exercises).set({ name: editedName }).where(eq(exercises.id, firstRow!.id));

    // Simulate an app update that bumps the seed version, which would
    // trigger runSeedIfNeeded to re-run its (additive) insert pass.
    await db.update(settings).set({ value: '0' }).where(eq(settings.key, 'seed_version'));

    await runSeedIfNeeded(db);

    const [reloaded] = await db.select().from(exercises).where(eq(exercises.id, firstRow!.id));
    expect(reloaded?.name).toBe(editedName);

    const allRows = await db.select().from(exercises);
    expect(allRows.length).toBe(curatedSeedData.length);
    const seedIds = allRows.map((r) => r.seedId).filter(Boolean);
    expect(new Set(seedIds).size).toBe(seedIds.length);
  });
});
