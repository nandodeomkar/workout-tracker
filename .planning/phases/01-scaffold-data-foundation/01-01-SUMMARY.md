---
phase: 01-scaffold-data-foundation
plan: 01
subsystem: database
tags: [expo, expo-router, drizzle-orm, expo-sqlite, vitest, better-sqlite3, theme]

# Dependency graph
requires: []
provides:
  - Expo SDK 57 app scaffold at repo root (expo-router, TypeScript, New Architecture)
  - Three-file Drizzle+Expo config (babel.config.js, metro.config.js, drizzle.config.ts)
  - Driver-agnostic 13-table Drizzle schema (db/schema.ts) shared by expo-sqlite (device) and better-sqlite3 (vitest)
  - Generated migration (drizzle/0000_cloudy_pet_avengers.sql) creating all 13 design-spec tables
  - Crash-safe DB client (db/client.ts) with WAL/NORMAL/busy_timeout pragmas
  - Boot-time migration gate + silent stub seed pipeline (app/_layout.tsx, db/seed/)
  - 5-tab expo-router shell with a DB-backed Exercises list (minimal, read-only)
  - Dark-only theme token module (theme.ts)
  - vitest harness + shared in-memory test fixture (db/test/fixture.ts)
affects: [01-02-exercise-library, 01-03-fndn-02-upgrade-test, 02-core-logging]

# Tech tracking
tech-stack:
  added:
    - expo@57.0.7 (RN 0.86, React 19.2, expo-router 57.0.7)
    - expo-dev-client, expo-sqlite@57.0.1, "@expo/vector-icons"
    - drizzle-orm@0.45.2, drizzle-kit@0.31.10 (dev)
    - babel-plugin-inline-import@3.0.0
    - better-sqlite3@12.11.1, "@types/better-sqlite3@7.6.13" (dev)
    - vitest@4.1.10
  patterns:
    - Driver-agnostic schema module (drizzle-orm/sqlite-core only) shared by device + test drivers
    - Boot-time migration gate rendering null while pending, hard-stop error screen on failure
    - Silent first-launch seed gated by a settings.seed_version row, additive via onConflictDoNothing(seedId)
    - theme.ts token module — no inline color/spacing literals in screens

key-files:
  created:
    - db/schema.ts
    - db/client.ts
    - db/seed/seedVersion.ts
    - db/seed/runSeed.ts
    - db/seed/runSeed.test.ts
    - db/test/fixture.ts
    - db/schema.test.ts
    - drizzle/0000_cloudy_pet_avengers.sql
    - theme.ts
    - app/_layout.tsx
    - app/(tabs)/_layout.tsx
    - app/(tabs)/exercises/index.tsx
  modified:
    - package.json
    - app.json
    - babel.config.js
    - metro.config.js
    - drizzle.config.ts
    - vitest.config.ts

key-decisions:
  - "Scaffolded via create-expo-app into a scratch dir then merged into repo root, since the repo's display name ('Workout Tracker') isn't a URL-friendly project-name path"
  - "Removed the expo-router tabs template's default boilerplate (Themed.tsx, EditScreenInfo.tsx, useColorScheme.*, constants/Colors.ts, modal.tsx, two.tsx) in favor of the project's own theme.ts and 5-tab shell"
  - "Set app.json userInterfaceStyle to 'dark' and splash backgroundColor to the theme background, matching the dark-only D-14 decision"
  - "Kept drizzle-kit's standard 0000-indexed migration filename instead of renaming to 0001 (see deviations) to preserve safe forward migration-numbering for later phases"
  - "Added @types/better-sqlite3 as a dev dependency (not explicitly pinned in CLAUDE.md/RESEARCH) to unblock tsc against the fixture"
  - "Added a runSeed.test.ts beyond the plan's explicit task scope to prove the must-have truth that a second seed run never duplicates or overwrites edited rows"

patterns-established:
  - "db/schema.ts is the canonical analog for any new Drizzle table: drizzle-orm/sqlite-core only, camelCase TS fields, snake_case DB columns via explicit string args"
  - "app/_layout.tsx is the canonical analog for the migration-gate + boot pipeline pattern"
  - "app/(tabs)/exercises/index.tsx is the canonical analog for a DB-backed list screen (load once into state, FlatList render, theme tokens)"

requirements-completed: [FNDN-01]

# Metrics
duration: 25min
completed: 2026-07-21
---

# Phase 1 Plan 1: Scaffold & Walking Skeleton Summary

**Expo SDK 57 app with a driver-agnostic 13-table Drizzle schema, a generated migration proven against an in-memory SQLite database, a crash-safe boot pipeline (migrate → silent-seed → render), and a 5-tab shell whose Exercises tab reads live rows from SQLite.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-21T16:43:00+05:30 (approx, scaffold command)
- **Completed:** 2026-07-21T17:04:24+05:30
- **Tasks:** 3 (Task 2 executed as TDD: RED then GREEN)
- **Files created/modified:** 37

## Accomplishments
- Stood up the Expo SDK 57 + expo-router + TypeScript scaffold at the repo root, with the exact locked stack from CLAUDE.md (no `-rc`/`-next` tags, no `expo-drizzle-studio-plugin`)
- Wired the three-file Drizzle+Expo config (babel/metro/drizzle.config) and proved it end-to-end: `drizzle-kit generate` produces real migration SQL that a vitest+better-sqlite3 fixture applies successfully
- Defined the full 13-table design-spec schema in a driver-agnostic module, with the Phase-1 `exercises` additions (`seed_id`, `is_custom`, `archived`)
- Proved the entire `migrate → seed → read → render` pipeline: boot-time migration gate, silent stub seed (5 exercises) gated on `seed_version`, and a FlatList screen reading live rows from SQLite
- Proved seed idempotency and the D-04/D-10 "never overwrite user edits" guarantee with an automated test

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold + three-file config + theme + 5-tab shell** - `8b5d629` (feat)
2. **Task 2 [BLOCKING/TDD]: 13-table schema + migration — RED** - `d819af4` (test)
2b. **Task 2 [BLOCKING/TDD]: 13-table schema + migration — GREEN** - `4a82079` (feat)
3. **Task 3: DB client + migration gate + stub seed + Exercises tab** - `d066cfb` (feat)
4. **Style fix: double-quote schema.ts to match must-have grep pattern** - `fbf7f7e` (style)

**Plan metadata commit:** pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified

- `package.json`, `package-lock.json` - locked dependency versions (see tech-stack)
- `app.json` - Expo config; `userInterfaceStyle: "dark"`, dark splash background, `expo-sqlite` plugin auto-registered
- `babel.config.js` - `inline-import` plugin for `.sql` migrations
- `metro.config.js` - `sql` pushed onto `resolver.sourceExts`
- `drizzle.config.ts` - `dialect: 'sqlite'`, `driver: 'expo'`, schema/out paths
- `vitest.config.ts` - Node environment, one-shot `run` (no default watch)
- `theme.ts` - dark-only tokens: `colors`, `spacing`, `typography`, `radius`
- `app/_layout.tsx` - migration gate (`useMigrations`) + silent seed call before rendering `(tabs)`
- `app/(tabs)/_layout.tsx` - 5 `Tabs.Screen` entries (Workout, History, Exercises, Stats, More)
- `app/(tabs)/index.tsx`, `history.tsx`, `stats.tsx`, `settings.tsx` - coming-soon empty states
- `app/(tabs)/exercises/index.tsx` - minimal FlatList reading `exercises` where `archived=false`
- `db/schema.ts` - 13-table driver-agnostic Drizzle schema
- `db/client.ts` - `openDatabaseSync` + WAL/NORMAL/busy_timeout pragmas + `drizzle(expoDb)`
- `db/seed/seedVersion.ts` - `CURRENT_SEED_VERSION = 1`
- `db/seed/runSeed.ts` - stub 5-exercise seed, gated + additive
- `db/seed/runSeed.test.ts` - idempotency + no-overwrite-on-edit proof
- `db/test/fixture.ts` - shared in-memory better-sqlite3 fixture (`createTestDb`, `applyMigrationsUpTo`)
- `db/schema.test.ts` - all-13-tables + exercises-Phase-1-columns assertion
- `drizzle/0000_cloudy_pet_avengers.sql`, `drizzle/migrations.js`, `drizzle/meta/` - generated migration artifacts

## Decisions Made

- Scaffolded into a scratch temp directory (`create-expo-app` rejects the repo's display name "Workout Tracker" as a non-URL-friendly path) then merged the output into the repo root, preserving `.git`, `.planning/`, `docs/`, `CLAUDE.md`, and the project's own `.claude/`.
- Removed the tabs template's default boilerplate (`components/Themed.tsx`, `EditScreenInfo.tsx`, `useColorScheme.*`, `constants/Colors.ts`, `app/modal.tsx`, `app/(tabs)/two.tsx`) since the project uses its own `theme.ts` and a purpose-built 5-tab shell — avoids unused dead code per CLAUDE.md's no-clutter guidance.
- Set `app.json` `userInterfaceStyle: "dark"` and the splash screen background to the theme's dark background color, aligning native chrome with the D-14 dark-only decision.
- Used `execSync` (not `execAsync`) for the three boot-time pragmas in `db/client.ts` so they are guaranteed to run before the module finishes evaluating and `db` is exported — avoids a race where a consumer could import `db` before pragmas are applied.
- Added `db/seed/runSeed.test.ts` beyond the plan's literal task-3 scope: the plan's `must_haves.truths` explicitly requires proving "a second run does not duplicate or overwrite" seeded rows, so an automated test was added to verify this rather than leaving it unverified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing @types/better-sqlite3 dev dependency**
- **Found during:** Task 2 (writing db/test/fixture.ts)
- **Issue:** `npx tsc --noEmit` failed with TS7016 — `better-sqlite3` has no bundled type declarations, blocking compilation of the fixture and test files.
- **Fix:** Installed `@types/better-sqlite3@7.6.13` as a dev dependency (current published version at install time; not `-rc`/`-next`).
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `d819af4` (Task 2 RED commit)

**2. [Rule 2 - Missing critical] Added foreign-key references across all relational tables**
- **Found during:** Task 2 (writing db/schema.ts)
- **Issue:** The design spec's Data model listing implies relationships (e.g. `workout_exercises.workout_id` → `workouts.id`) but doesn't spell out FK enforcement; leaving them un-enforced would allow orphaned rows.
- **Fix:** Added `.references(() => table.column)` on every foreign-key-shaped column (workouts.templateId, workoutExercises.workoutId/exerciseId, sets.workoutExerciseId, templateExercises.templateId/exerciseId, programDays.programId/templateId, programState.programId, trainingMaxes.exerciseId).
- **Files modified:** `db/schema.ts`
- **Verification:** Migration SQL includes `FOREIGN KEY` clauses for every reference; `npx vitest run db/schema.test.ts` still green.
- **Committed in:** `d819af4` / `4a82079`

### Issues Encountered (documented, not auto-fixed)

**3. Migration filename numbering: plan expected `0001_*.sql`, drizzle-kit generates `0000_*.sql`**
- **Found during:** Task 2, after running `npx drizzle-kit generate`
- **Issue:** The plan's acceptance criteria and D-15 both refer to "migration 0001", but `drizzle-kit@0.31.10`'s default `--prefix index` scheme is zero-indexed, so the first generated migration is `0000_cloudy_pet_avengers.sql`, not `0001_*.sql`.
- **Why not renamed:** The Drizzle Expo migrator (`useMigrations`) keys migrations by `journal.entries[i].idx` (zero-based), not by the file's text prefix, so renaming the file/tag to `0001_` would not change runtime behavior — but it WOULD collide with drizzle-kit's own next-migration prefix computation (idx=1 → also prefixed `0001_`) for any future migration generated in Plan 03 (FNDN-02 upgrade test) or later phases, producing two differently-tagged migrations both prefixed `0001_`. Kept the tool-standard `0000_` naming to preserve safe, unambiguous forward migration numbering.
- **Impact:** Cosmetic only. Substance of the requirement — a generated migration exists, is listed in `drizzle/meta/_journal.json`, and creates all 13 tables — is fully met and proven by `db/schema.test.ts`.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical), 1 documented issue (cosmetic naming, not fixed by design).
**Impact on plan:** No scope creep — both auto-fixes were necessary for correctness (compilation, referential integrity). The migration-numbering issue is a tooling-convention mismatch with no functional impact; renaming would have introduced real risk to future migration generation.

## Issues Encountered

See "Issues Encountered" under Deviations above (migration filename numbering). No other issues — `npx tsc --noEmit`, `npx expo-doctor` (20/20 checks), and `npx vitest run` (5/5 tests) all pass cleanly on the final state.

## User Setup Required

None — no external service configuration required. This phase is fully offline (no network, auth, or backend).

## Known Stubs

- **`db/seed/runSeed.ts`** (lines: `STUB_EXERCISES` array) — 5 hardcoded exercises, explicitly documented in the plan as a stub to be replaced by the curated ~400-500-row `free-exercise-db` JSON in Plan 02. Intentional, not a gap in this plan's goal (the Walking Skeleton only needs to prove the seed pipeline works, not ship the full library).
- **`app/(tabs)/index.tsx`, `history.tsx`, `stats.tsx`, `settings.tsx`** — "Coming soon" empty states. Intentional per D-13 (full 5-tab shell now, other tabs filled in later phases) — not stubs blocking this plan's goal.

## Next Phase Readiness

- The `migrate → seed → read → render` pipeline is proven end-to-end (automated) and ready for Plan 02 to swap the stub seed for the curated exercise library.
- `db/test/fixture.ts`'s `applyMigrationsUpTo(n)` is in place and ready for Plan 03's FNDN-02 upgrade test (populate at migration N, apply N+1, assert data intact).
- On-device verification (real Android dev-client build, `npx expo run:android`) has NOT been performed in this plan — Phase 1's plan sequence defers that to the Plan 06 device checkpoint per the phase's `human_verify_mode: end-of-phase` setting. All verification here is automated (`tsc`, `expo-doctor`, `vitest`).
- No blockers for Plan 02.

---
*Phase: 01-scaffold-data-foundation*
*Completed: 2026-07-21*

## Self-Check: PASSED

- All key files verified present on disk (`db/schema.ts`, `db/client.ts`, `db/seed/seedVersion.ts`, `db/seed/runSeed.ts`, `db/test/fixture.ts`, `db/schema.test.ts`, `drizzle/0000_cloudy_pet_avengers.sql`, `theme.ts`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/exercises/index.tsx`).
- All commit hashes verified present in `git log` (`8b5d629`, `d819af4`, `4a82079`, `d066cfb`, `fbf7f7e`, `e292cc5`).
- Plan-level verification re-run clean: `npx tsc --noEmit` (0 errors), `npx expo-doctor` (20/20 checks passed), `npx vitest run` (5/5 tests passed).
