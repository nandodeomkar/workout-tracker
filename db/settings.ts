// Key-value settings read/write helper (D-07 default rest, D-14 units).
//
// `getSetting` returns `string | null` — a missing key is not an error, it's
// the expected state for an existing install upgrading into a Phase-2 key
// that never had a row seeded. Callers apply their own typed fallback, e.g.:
//
//   const units = (await getSetting(db, 'units')) ?? 'kg';
//   const defaultRestSeconds = Number((await getSetting(db, 'default_rest_seconds')) ?? 90);
//
// Per RESEARCH.md Assumptions Log A4, the typed fallbacks live in the
// callers, not here — this module only knows about raw string values.

import { eq } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';

import { settings } from './schema';

type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;

/**
 * Reads a setting's raw string value, or `null` if the key does not exist.
 */
export async function getSetting(db: AnyDrizzleDb, key: string): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}

/**
 * Upserts a setting's value: inserts if the key does not exist, otherwise
 * updates it in place. `settings.key` is the primary key, so this never
 * crashes on a duplicate-key insert.
 */
export async function setSetting(db: AnyDrizzleDb, key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}
