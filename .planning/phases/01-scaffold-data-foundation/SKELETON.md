# Walking Skeleton — Workout Tracker

**Phase:** 1
**Generated:** 2026-07-19

## Capability Proven End-to-End

> One sentence: the smallest user-visible capability that exercises the full stack.

The app boots on-device fully offline, applies its versioned Drizzle SQLite migration (full 13-table schema), silently seeds the exercise library, lands on a 5-tab shell, and renders seeded exercises in a searchable Exercises tab — proving the `migrate → seed → read → render` pipeline the entire app is built on.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Expo SDK 57 (`expo@57.0.7`) + React Native 0.86 + React 19.2, TypeScript, expo-router 57.0.7 (file-based, tabs) | Locked in CLAUDE.md; New Architecture mandatory since SDK 55 (no old-arch fallback to support) |
| Data layer | expo-sqlite 57.0.1 + drizzle-orm 0.45.2 (device) with drizzle-kit 0.31.10 generating versioned `.sql` migrations; single on-device SQLite DB (`workout.db`) as sole source of truth | Local-first, zero server (FNDN-01); Drizzle's `useMigrations` gives versioned upgrade safety (FNDN-02) |
| Schema module | Driver-agnostic `db/schema.ts` importing only `drizzle-orm/sqlite-core` | Same schema file drives `drizzle-orm/expo-sqlite` (device) and `drizzle-orm/better-sqlite3` (vitest) — DB-layer tests run with no device/emulator |
| Migration wiring | Three-file config: `babel.config.js` (babel-plugin-inline-import for `.sql`), `metro.config.js` (`sql` in `sourceExts`), `drizzle.config.ts` (`dialect:'sqlite'`, `driver:'expo'`) | All three required together or migrations silently fail to bundle (RESEARCH Pitfall 2/4) |
| Migration gate | `useMigrations(db, migrations)` in `app/_layout.tsx` blocks the shell until migrations resolve; hard-stop error screen on failure, silent on success (D-16) | Migrations must never silently lose data (FNDN-02); an error screen, not a crash, is the correct failure mode |
| Crash-safe writes | `PRAGMA journal_mode=WAL`, `PRAGMA synchronous=NORMAL`, `PRAGMA busy_timeout=2000` set once at DB open in `db/client.ts` | Durability without full-fsync latency; critical for Phase 2's per-set writes |
| Seed strategy | Bundled curated `db/seed/exercises.seed.json` (~400–500 rows from free-exercise-db), inserted on first launch gated by a `settings` `seed_version` row; `onConflictDoNothing` on a stable `seed_id` so app updates never overwrite user-edited rows (D-04/D-10) | Deterministic offline seed; curation is a build-time Node script → committed static JSON, never runtime remapping |
| State | Zustand reserved for the future active-workout session; Phase 1 uses component state + DB queries only | No ephemeral session state exists yet in Phase 1 |
| Theme | `theme.ts` dark-only design tokens (colors/spacing/typography); every component imports tokens, no inline styling (D-14) | Light theme is a later token swap (deferred); consistent gym-readable dark UI |
| Deployment target | Custom dev client via `npx expo run:android` (or EAS development build); Expo Go is incompatible once Drizzle+expo-sqlite are wired | expo-sqlite native module cannot load in Expo Go (RESEARCH Pitfall 1) |
| Directory layout | `app/(tabs)/*` routes, `db/` (schema/client/seed/test), `drizzle/` (generated migrations), `lib/` (pure logic), `components/`, `constants/`, `scripts/` (dev-only curation), `theme.ts` | Matches RESEARCH recommended structure; becomes the canonical analog set for Phases 2–8 |

## Stack Touched in Phase 1

- [x] Project scaffold — Expo SDK 57 + expo-router tabs template, TypeScript, vitest test runner, babel/metro/drizzle config
- [x] Routing — full 5-tab shell (Workout, History, Exercises, Stats, More) with root migration-gate `Stack`
- [x] Database — real write (first-launch seed insert) AND real read (`SELECT` archived-visible exercises), both covered by in-memory DB tests
- [x] UI — interactive Exercises tab (search box + filter chips + tappable rows) wired to the DB query layer; custom-exercise create/edit/archive forms
- [x] Deployment — documented full-stack local run: `npx expo run:android` against a dev-client build; exercised at the Phase 1 device checkpoint (Plan 06)

## Out of Scope (Deferred to Later Slices)

> Explicit so later phases do not re-litigate Phase 1's minimalism.

- Workout logging / active-workout session, sets, rest timer (Phase 2) — tables exist in migration 0001 but are unpopulated and have no UI
- Templates, folders, calculators (Phase 3); Stats & charts / victory-native (Phase 4); Body measurements UI (Phase 5); Programs & progression (Phase 6); Google Drive backup / export / auth (Phase 7); light theme, notification hardening, APK distribution polish (Phase 8)
- Functional Settings screen (units/rest/plates) — `settings` table exists but only `seed_version` is used in Phase 1 (deferred)
- Recent/frequent-first exercise ordering in the picker (Phase 2 active-workout context, deferred)
- Exercise detail history/records/1RM chart — needs logged data; Phase 1 ships a minimal detail/edit view only (Claude's Discretion)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Core logging — active workout, crash-safe set writes, rest timer, history (list + calendar)
- Phase 3: Templates, folders, plate/1RM/warm-up calculators
- Phase 4: Stats & charts (est-1RM, top set, volume, weekly-volume-by-muscle-group, live PR feed) via victory-native
- Phase 5: Body measurement logging + trend graphs
- Phase 6: Programs & progression (linear + percent-of-training-max waves, bundled generic programs)
- Phase 7: Google Drive appDataFolder backup/restore + CSV/JSON export
- Phase 8: Zero-paywall UI audit, notification hardening, friend APK distribution
