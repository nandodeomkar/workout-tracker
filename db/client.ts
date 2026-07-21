// On-device DB client: opens the SQLite database, sets crash-safe pragmas,
// and exports the Drizzle instance used throughout the app.
//
// NOTE: `deleteDatabaseSync` does not clean up the `-wal`/`-shm` sidecar
// files in some expo-sqlite versions (github.com/expo/expo/issues/43441).
// Not relevant to Phase 1 (no delete-and-recreate flow), but worth knowing
// for the Phase 7 restore-from-backup flow, which will need to clean up
// those sidecars explicitly when replacing the local DB file.

import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

const expoDb = openDatabaseSync('workout.db');

// Crash-safe pragmas — durability without full-fsync latency. Must run
// immediately after opening, before any writes (critical for Phase 2's
// per-set crash-safe writes).
expoDb.execSync('PRAGMA journal_mode = WAL');
expoDb.execSync('PRAGMA synchronous = NORMAL');
expoDb.execSync('PRAGMA busy_timeout = 2000');

export const db = drizzle(expoDb);
