# Phase 1: Scaffold & Data Foundation - Research

**Researched:** 2026-07-19
**Domain:** Expo/React Native scaffold, expo-sqlite + Drizzle ORM local data layer with versioned migrations, seeded exercise library with search/filter UI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Exercise taxonomy & curation**
- **D-01:** Each exercise gets exactly **one primary muscle group** from a fixed ~10-item list (Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings, Glutes, Core, Other). No secondary muscles. This is load-bearing for Phase 4 weekly-volume-by-muscle-group stats — each set counts once.
- **D-02:** Equipment is a fixed short list: Barbell, Dumbbell, Machine, Cable, Bodyweight, Kettlebell, Band, Other. free-exercise-db values re-mapped to these during curation.
- **D-03:** Library size target **~400–500 exercises** (not the spec's ~250): trim only clear junk/obscure duplicates from free-exercise-db's ~870. Bigger library preferred over aggressive curation risk. (Supersedes the "~250" figure in EXER-01/spec — refinement, not scope change.)
- **D-04:** Seed ships as **bundled JSON**, inserted on first launch, with a **seed-version row**. Future app updates may add exercises additively; updates **never overwrite user-edited rows**.

**Library browse & search UX**
- **D-05:** Exercises tab default view: **flat A–Z list** with sticky search bar and filter chips on top. No muscle-group section headers.
- **D-06:** Search is **live substring filter-as-you-type on name only**, case-insensitive, matches anywhere in the name. No fuzzy matching, no tag-text search (chips cover tags).
- **D-07:** Filters: two chip rows (muscle group, equipment), **multi-select**; chips within a row combine as OR, across rows as AND. Active filters visible at a glance, one-tap clear.
- **D-08:** List row = exercise name + secondary line "muscle group · equipment". Custom exercises **mixed into the A–Z list** with a small "custom" badge — no separate section.

**Custom exercise lifecycle**
- **D-09:** Creation form: **name (required) + muscle group + equipment** (picked from the same fixed lists as seeded exercises) + optional notes. Nothing else.
- **D-10:** **Seeded exercises are user-editable** (rename/re-tag) in place. Combined with D-04: seed updates never clobber edited rows.
- **D-11:** **Archive** (custom and seeded alike): hidden from library list and future pickers, a toggle reveals archived; logged history and stats remain intact; reversible. **No hard delete in v1.**
- **D-12:** Duplicate names: **warn but allow** — inline hint "X already exists — open it?" with a proceed-anyway option.

**Scaffold breadth**
- **D-13:** Build the **full 5-tab expo-router shell** now (Workout, History, Exercises, Stats, Settings/More). Exercises fully functional; other tabs show clean "coming soon" empty states. Later phases fill existing slots — no nav rework.
- **D-14:** **Theme token file (`theme.ts`)** — colors/spacing/typography tokens consumed by all components. **Dark-only in Phase 1**; light theme is a later token swap. No ad-hoc inline styling.
- **D-15:** **Migration 0001 creates the full schema from the design spec** (exercises, workouts, workout_exercises, sets, templates, template_exercises, programs, program_days, program_state, training_maxes, body_measurements, settings, backup_meta). Phase 1 populates only exercises + settings. FNDN-02 migration testing runs against the real schema.
- **D-16:** First launch: **silent seed, land directly on tabs**. No onboarding flow, no unit picker (default kg; settings toggle arrives later), no seed progress screen.

### Claude's Discretion
- Drizzle migration ergonomics, exact seed-JSON shape, seed-version bookkeeping mechanics, chip/list component structure, and curation script details — researcher/planner decide within the decisions above.
- Exercise detail screen depth in Phase 1 (spec describes history/records/1RM chart, but those need logged data — a minimal detail/edit view is acceptable this phase).

### Deferred Ideas (OUT OF SCOPE)
- **Recent/frequent-first exercise ordering** in the exercise picker — belongs in Phase 2+ (active-workout picker context), not the library tab.
- **Light theme** — token swap in a later phase (Phase 8 polish per spec's "light available").
- **Functional Settings screen** (units, rest defaults, plates) — settings table exists from migration 0001, but the UI belongs to later phases.

### Canonical References (downstream agents must read before planning/implementing)
- `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — Approved design spec: full data model (Drizzle schema for all tables), screen layout (5-tab), architecture decisions (kg canonical, PRs computed not stored, crash-safe writes). Migration 0001 (D-15) implements its data-model section verbatim.
- `.planning/REQUIREMENTS.md` — FNDN-01, FNDN-02, EXER-01, EXER-02 definitions and traceability.
- `CLAUDE.md` — Locked tech stack with exact versions and known gotchas (Expo Go incompatible once Drizzle wired in).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FNDN-01 | App runs offline-first on Android with local SQLite as the sole source of truth (no server) | See Architecture Patterns (crash-safe pragmas, migration gate) and Security Domain — no network calls anywhere in Phase 1's scope; Validation Architecture marks this manual-only (device airplane-mode check) |
| FNDN-02 | Database migrations run safely on app upgrade without losing existing user data | See Pattern 2 (migration gate), Pattern 5 (crash-safe pragmas), Common Pitfalls #2/#4, and Validation Architecture (`db/migrations.test.ts` — populate at migration N, apply N+1, assert data intact) |
| EXER-01 | User can browse and search a seeded exercise library (tagged by muscle group and equipment) | See Standard Stack, Architecture Patterns (seed-on-first-launch Pattern 4), Don't Hand-Roll (taxonomy curation), Open Question 1 (mapping table), Validation Architecture (`db/exercises.query.test.ts`) |
| EXER-02 | User can create, edit, and archive custom exercises | See Pattern 4 (seed never clobbers edits), Security Domain (V5 input validation on name/notes), Validation Architecture (`db/exercises.crud.test.ts`) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Locked tech stack, do not re-litigate:** Expo SDK 57 (`expo@57.0.7`), TypeScript, expo-router 57.0.7, expo-sqlite 57.0.1, drizzle-orm 0.45.2, drizzle-kit 0.31.10 (dev), Zustand 5.0.14, victory-native 41.26.0 (not this phase), Reanimated 4.5.2 / Gesture Handler 3.1.0 (peers, not directly used this phase). This research re-verified the Phase-1-relevant subset against the npm registry and found no drift.
- **expo-dev-client required from day one** — expo-sqlite with Drizzle wired in does not run in Expo Go; scaffold must include `expo-dev-client` in the first setup task, not added later.
- **Drizzle schema must be driver-agnostic**, living in a module importable by both `drizzle-orm/expo-sqlite` (device) and `drizzle-orm/better-sqlite3` (vitest, per CLAUDE.md's testing strategy) — no device/emulator required for DB-layer tests.
- **babel-plugin-inline-import required** for `.sql` migration files to bundle correctly — must be wired into `babel.config.js` and `metro.config.js` together (see Pitfall #2).
- **victory-native XL is the charts library** — irrelevant to Phase 1's scope (no charts yet) but noted so the planner doesn't introduce a competing charting dependency prematurely.
- **What NOT to use (explicit CLAUDE.md prohibitions relevant to this phase):** legacy `victory-native` v36 API (N/A this phase); Expo Go for any post-scaffold development; forcing Vitest to render React Native components (Phase 1's tests are DB-layer/pure-logic only, so this doesn't arise, but any screen-level testing added later should use `jest-expo` instead, not Vitest).
- **GSD workflow enforcement (user's global CLAUDE.md):** file-changing work must go through a GSD command (`/gsd-execute-phase`, etc.) — not a Phase 1 research constraint per se, but the planner should structure tasks assuming execution happens under `/gsd-execute-phase`.

## Summary

Phase 1 builds the foundation every later phase depends on: an Expo SDK 57 app with a 5-tab expo-router shell, a Drizzle-managed SQLite database that survives schema upgrades, and a searchable exercise library seeded from free-exercise-db. All core package versions are already locked and registry-verified in `CLAUDE.md` (Expo 57.0.7, drizzle-orm 0.45.2, drizzle-kit 0.31.10, expo-sqlite 57.0.1, babel-plugin-inline-import 3.0.0) — this research re-verified those four against the npm registry today and they are unchanged and current. This research does not re-litigate stack choices; it fills in the setup mechanics, data/seed pipeline, and pitfalls the planner needs.

The Drizzle+Expo integration has three interlocking config pieces that must all be present or migrations fail silently: `babel.config.js` (inline-import plugin for `.sql`), `metro.config.js` (`sql` in `sourceExts`), and `drizzle.config.ts` (`dialect: 'sqlite'`, `driver: 'expo'`). The schema module (`db/schema.ts`) is driver-agnostic — the same file is imported by both `drizzle-orm/expo-sqlite` (device, via `useMigrations`) and `drizzle-orm/better-sqlite3` (Node/vitest), which is what makes the CLAUDE.md-mandated "SQLite in-memory for DB layer tests" strategy work without a device.

The exercise library's hard part is not the UI (a flat sectionless list with two chip-row filters is a straightforward `FlatList`/`FlashList` + `useState` filter reducer) — it's the **curation pipeline**: free-exercise-db's ~873 exercises use inconsistent, partially-missing `equipment`/`primaryMuscles` values that must be deterministically re-mapped to the fixed 10-muscle-group / 8-equipment lists from CONTEXT.md D-01/D-02 *before* the seed JSON is bundled, not at runtime. This is a one-time offline curation script (Node, run during Phase 1 development, output committed as static JSON), not app code.

**Primary recommendation:** Scaffold with `create-expo-app` (expo-router template) + `expo-dev-client`, wire Drizzle exactly per the three-file config pattern below, write a standalone Node curation script that transforms `free-exercise-db`'s `dist/exercises.json` into the app's bundled seed JSON (with the fixed taxonomies and a `seed_version` constant), and build the Exercises tab as a flat `FlatList` (400-500 rows does not need `FlashList`'s recycling, but see Don't Hand-Roll) with a live substring filter over an in-memory array — no query-per-keystroke needed at this data volume.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Exercise data persistence | Database (on-device SQLite) | — | Sole source of truth per FNDN-01; no server tier exists in this app |
| Schema migrations | Database / Client (Drizzle in-app) | — | Drizzle migrations run inside the RN app process via `useMigrations`; there is no separate migration server |
| Exercise seed curation | Build-time tooling (Node script, dev machine) | — | One-time data transform, never runs on-device; output is a static asset bundled into the app |
| Exercise search/filter | Client (React Native component state) | — | In-memory filter over ~500 rows already loaded from SQLite; no need to push filtering into SQL for this volume |
| Tab navigation shell | Client (expo-router) | — | File-based routing owns screen composition; no SSR tier in a mobile app |
| Theme tokens | Client (shared TS module) | — | Consumed by all components; no build-time CSS pipeline needed (no NativeWind/Tailwind in this stack) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| expo | 57.0.7 | App framework/runtime | Locked in CLAUDE.md; re-verified current on npm registry today `[VERIFIED: npm registry]` |
| expo-router | 57.0.7 | File-based navigation, 5-tab shell | Locked in CLAUDE.md, version-locked to Expo SDK `[VERIFIED: npm registry — matches CLAUDE.md pin]` |
| expo-sqlite | 57.0.1 | On-device SQLite | Locked in CLAUDE.md; re-verified current `[VERIFIED: npm registry]` |
| drizzle-orm | 0.45.2 | ORM/schema/query builder | Locked in CLAUDE.md; re-verified current `[VERIFIED: npm registry]` |
| drizzle-kit | 0.31.10 (devDependency) | Migration generation CLI | Locked in CLAUDE.md; re-verified current `[VERIFIED: npm registry]` |
| babel-plugin-inline-import | 3.0.0 | Bundles `.sql` migration files as strings | Locked in CLAUDE.md; re-verified current `[VERIFIED: npm registry]` |
| expo-dev-client | 57.0.7 | Custom dev client (required — expo-sqlite+Drizzle do not run in Expo Go) | Locked in CLAUDE.md `[ASSUMED — version not independently re-checked this session, but pinned to SDK train per CLAUDE.md pattern]` |
| better-sqlite3 | 12.11.1 (devDependency) | In-memory SQLite driver for vitest DB tests | Locked in CLAUDE.md; same `sqlite-core` schema module as device driver `[CITED: orm.drizzle.team/docs/get-started/expo-new]` |
| vitest | 4.1.10 | Pure-logic + DB-layer unit tests | Locked in CLAUDE.md |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @expo/vector-icons | 15.1.1 | Tab bar icons | Bundled with Expo; use `FontAwesome`/`Ionicons` sets for the 5 tab icons — zero extra config |
| expo-drizzle-studio-plugin | 0.2.1 | Inspect on-device DB during development | `[WARNING: flagged SUS by package-legitimacy check — no repository field in registry metadata, though a GitHub repo (drizzle-team/drizzle-studio-expo) exists publicly. Dev-only tool, never ships to users. Planner should add a checkpoint:human-verify before installing, or skip entirely — it is a convenience, not a requirement.]` Note: CLAUDE.md's stack table names this package `drizzle-studio-expo`, which **does not exist on npm** (404) — the correct package name is `expo-drizzle-studio-plugin`. `[VERIFIED: npm registry — corrects a CLAUDE.md package-name error]` |
| @shopify/flash-list | 2.3.2 | High-performance recycling list | Only needed if the flat A-Z exercise list (400-500 rows) shows measured jank on real Android hardware — plain `FlatList` is very likely sufficient at this row count (FlashList's advantage shows at 1000s of rows / complex row components). Do not add pre-emptively; keep as a documented fallback. `[VERIFIED: npm registry + package-legitimacy OK — official Shopify repo, 1.57M weekly downloads]` FlashList v2 is JS-only (no native module), so adding it later requires no dev-client rebuild. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `FlatList` for exercise list | `@shopify/flash-list` | Only worth the extra dependency if scroll jank is measured on-device at 400-500 rows; premature optimization otherwise |
| In-memory JS filter for search | SQLite `LIKE` query per keystroke | In-memory filter over a ~500-row array already held in state is faster and simpler than round-tripping SQLite on every keystroke; reserve SQL-side filtering for a future phase if the library grows to thousands of rows |
| Node curation script (offline) | Runtime re-tagging on first launch | Doing the free-exercise-db → fixed-taxonomy remap at runtime would require bundling raw free-exercise-db data (with its inconsistent tags) and adds startup complexity for zero benefit — curate once, ship clean JSON |

**Installation:**
```bash
npx create-expo-app@latest --template tabs@57
cd <project>
npx expo install expo-dev-client expo-sqlite
npm install drizzle-orm
npm install -D drizzle-kit babel-plugin-inline-import
npm install -D better-sqlite3 vitest
# dev-tool, optional, flag with checkpoint:human-verify per package-legitimacy audit below:
npm install -D expo-drizzle-studio-plugin
```

**Version verification:** `npm view <package> version` run today for expo, drizzle-orm, drizzle-kit, expo-sqlite, babel-plugin-inline-import — all match CLAUDE.md's pinned versions exactly (no drift). `expo-dev-client` was not independently re-verified this session; treat its exact patch version as `[ASSUMED]` consistent with the SDK 57 train, confirm with `npx expo install expo-dev-client` (which resolves the SDK-compatible version automatically).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @shopify/flash-list | npm | published 2026-06-10 (this release) | 1.57M/wk | github.com/Shopify/flash-list | OK | Approved (optional, fallback only) |
| expo-drizzle-studio-plugin | npm | published 2025-10-13 | 25.6K/wk | none listed in registry metadata (GitHub repo exists: drizzle-team/drizzle-studio-expo) | SUS | Flagged — planner must add `checkpoint:human-verify` before installing, or descope as optional/skippable dev tool |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `expo-drizzle-studio-plugin` — reason: registry metadata has no `repository` field even though a public GitHub repo exists under the `drizzle-team` org; this is a metadata gap, not evidence of malicious intent, but the automated check cannot distinguish the two. It is a **devDependency only** (never bundled into the shipped app), which lowers risk. Recommend either a human-verify checkpoint or simply skipping it in Phase 1 (drizzle-kit's own migration output + manual SQLite inspection tools are sufficient for Phase 1's needs).

All other packages in this phase (expo, expo-router, expo-sqlite, expo-dev-client, drizzle-orm, drizzle-kit, babel-plugin-inline-import, better-sqlite3, vitest, @expo/vector-icons) are the same packages already registry-verified in CLAUDE.md's stack research and were re-confirmed present/current on npm during this session — no new legitimacy risk introduced.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  App boot (App.tsx / app/_layout.tsx)                        │
│    openDatabaseSync("workout.db")                             │
│    drizzle(expoDb) ──► useMigrations(db, migrations)          │
│         │                                                      │
│         ├─ error   ──► render migration-error screen          │
│         ├─ pending ──► render "Migration in progress" screen  │
│         └─ success ──► proceed                                │
└───────────────────────────┬────────────────────────────────────┘
                             ▼
              ┌───────────────────────────┐
              │ First-launch seed check    │
              │ SELECT * FROM settings     │
              │  WHERE key='seed_version'  │
              └─────────────┬─────────────┘
                   no row / older version
                             ▼
              ┌───────────────────────────┐
              │ Bulk INSERT seed exercises │
              │ (bundled JSON, additive,   │
              │  never overwrites edited   │
              │  rows — checked by id)     │
              │ UPSERT settings.seed_ver   │
              └─────────────┬─────────────┘
                             ▼
                 ┌─────────────────────┐
                 │  expo-router (tabs)  │
                 │  Stack → (tabs)      │
                 └──────────┬──────────┘
        ┌──────────┬────────┼────────┬───────────┐
        ▼          ▼        ▼        ▼           ▼
   [Workout]   [History] [Exercises] [Stats]  [Settings]
   coming-soon coming-soon   ▼      coming-soon coming-soon
                        ┌─────────────────┐
                        │ Exercises screen │
                        │ SELECT * FROM    │
                        │ exercises WHERE  │
                        │ archived=0       │
                        │  (loaded once,   │
                        │   held in state) │
                        └────────┬────────┘
                                 ▼
                   ┌───────────────────────────┐
                   │ In-memory filter pipeline  │
                   │ search text (substring) →  │
                   │ muscle chips (OR within) → │
                   │ equipment chips (OR within)│
                   │ → AND across the two rows  │
                   └────────────┬───────────────┘
                                 ▼
                        FlatList render (A-Z)
                                 │
                    tap row ──► Exercise detail/edit
                                 │
                    Create/Edit/Archive ──► UPDATE/INSERT
                                            exercises table
```

### Recommended Project Structure
```
app/
├── _layout.tsx              # Root Stack, hosts DB init + useMigrations gate
├── (tabs)/
│   ├── _layout.tsx           # Tabs.Screen x5, icons via @expo/vector-icons
│   ├── index.tsx              # Workout tab — "coming soon" empty state
│   ├── history.tsx            # coming soon
│   ├── exercises/
│   │   ├── index.tsx          # flat A-Z list, search bar, filter chips
│   │   ├── [id].tsx           # exercise detail/edit
│   │   └── new.tsx            # custom exercise creation form
│   ├── stats.tsx               # coming soon
│   └── settings.tsx            # coming soon
db/
├── schema.ts                  # driver-agnostic Drizzle schema (all 13 tables)
├── client.ts                  # openDatabaseSync + drizzle() wiring (device)
└── seed/
    ├── exercises.seed.json     # curated, bundled seed data (~400-500 rows)
    └── seedVersion.ts           # exported constant, bumped when seed data changes
drizzle/                        # generated migration SQL + migrations.js (drizzle-kit output)
theme.ts                        # dark-only color/spacing/typography tokens
scripts/
└── curate-exercises.ts         # one-time Node script: free-exercise-db → seed JSON (dev-time only, not bundled)
drizzle.config.ts
babel.config.js
metro.config.js
```

### Pattern 1: Three-file Drizzle+Expo wiring
**What:** `babel.config.js`, `metro.config.js`, and `drizzle.config.ts` must all be configured together for generated `.sql` migrations to load at runtime.
**When to use:** Set up once during scaffold, before writing schema.
**Example:**
```javascript
// babel.config.js — Source: orm.drizzle.team/docs/sqlite/connect-expo-sqlite [CITED]
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [["inline-import", { "extensions": [".sql"] }]]
  };
};
```
```javascript
// metro.config.js — Source: orm.drizzle.team/docs/sqlite/connect-expo-sqlite [CITED]
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
module.exports = config;
```
```typescript
// drizzle.config.ts — Source: orm.drizzle.team/docs/get-started/expo-new [CITED]
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './db/schema.ts',
  out: './drizzle',
});
```

### Pattern 2: Migration gate at app boot
**What:** `useMigrations` hook blocks rendering the app shell until migrations resolve, with explicit error/pending/success states.
**When to use:** Root layout, before any screen that touches the database.
**Example:**
```typescript
// Source: orm.drizzle.team/docs/sqlite/connect-expo-sqlite [CITED]
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';

const expoDb = openDatabaseSync("workout.db");
export const db = drizzle(expoDb);

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  if (error) return <MigrationErrorScreen error={error} />;
  if (!success) return <MigrationPendingScreen />;
  return <AppShell />; // renders (tabs) stack
}
```

### Pattern 3: Driver-agnostic schema module (device + test)
**What:** One `db/schema.ts` using `drizzle-orm/sqlite-core` builders, imported by two different drivers.
**When to use:** Always — this is what lets vitest test DB logic without a device/emulator (CLAUDE.md testing requirement).
**Example:**
```typescript
// db/schema.ts — driver-agnostic, imported by both device and test code
// Source: orm.drizzle.team/docs/get-started/expo-new [CITED]
import { int, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const exercises = sqliteTable("exercises", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  muscleGroup: text("muscle_group").notNull(),
  equipment: text().notNull(),
  isCustom: int("is_custom", { mode: "boolean" }).notNull().default(false),
  archived: int({ mode: "boolean" }).notNull().default(false),
  notes: text(),
});
```
```typescript
// test setup — drizzle-orm/better-sqlite3 driver, same schema import
// Source: WebSearch synthesis of Drizzle testing discussions [CITED: github.com/drizzle-team/drizzle-orm/discussions/784]
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

const sqlite = new Database(':memory:');
export const testDb = drizzle(sqlite, { schema });
// then run the same generated migration SQL against testDb before each test
```

### Pattern 4: Seed-on-first-launch with version bookkeeping (D-04)
**What:** A `settings` row (`key='seed_version'`) gates seeding; bulk insert is additive and keyed by a stable `id` so re-runs never clobber user edits.
**When to use:** App boot, after migrations succeed, before rendering tabs (D-16: silent, no progress UI).
**Example:**
```typescript
// db/seed/runSeed.ts — pattern, not a verified library API
import seedData from './exercises.seed.json';
import { CURRENT_SEED_VERSION } from './seedVersion';

async function runSeedIfNeeded(db) {
  const row = await db.select().from(settings).where(eq(settings.key, 'seed_version')).get();
  const installedVersion = row ? Number(row.value) : 0;
  if (installedVersion >= CURRENT_SEED_VERSION) return;

  for (const ex of seedData) {
    // INSERT OR IGNORE on the stable seed id — never overwrites an edited row (D-10)
    await db.insert(exercises).values(ex).onConflictDoNothing({ target: exercises.seedId });
  }
  await db.insert(settings).values({ key: 'seed_version', value: String(CURRENT_SEED_VERSION) })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(CURRENT_SEED_VERSION) } });
}
```
`[ASSUMED — this is a design pattern derived from the D-04 requirement, not copied from an official Drizzle example; the planner should verify Drizzle's exact onConflictDoNothing/onConflictDoUpdate SQLite API signature against the installed 0.45.2 docs when implementing.]`

### Pattern 5: Crash-safe SQLite pragmas
**What:** Set WAL journal mode + `synchronous=NORMAL` once at DB open, for durability without full-fsync latency.
**When to use:** Immediately after `openDatabaseSync`, before any writes — relevant now for FNDN-01/FNDN-02 durability, and critical later for Phase 2's per-set crash-safe writes.
**Example:**
```typescript
// Source: WebSearch synthesis (sqlite.org/wal.html + community guides) [CITED: sqlite.org/wal.html]
const expoDb = openDatabaseSync("workout.db");
await expoDb.execAsync('PRAGMA journal_mode = WAL');
await expoDb.execAsync('PRAGMA synchronous = NORMAL');
await expoDb.execAsync('PRAGMA busy_timeout = 2000');
```
Note: `deleteDatabaseSync` does not clean up `-wal`/`-shm` sidecar files in some expo-sqlite versions `[CITED: github.com/expo/expo/issues/43441]` — irrelevant for Phase 1 (no delete-and-recreate flow), but worth a comment in code for whoever writes the Phase 7 restore-from-backup flow later.

### Anti-Patterns to Avoid
- **Re-tagging free-exercise-db data at runtime:** Don't bundle the raw ~870-exercise dataset and remap muscle groups/equipment on first launch — do it once in a dev-time Node script and commit clean, fixed-taxonomy JSON. Runtime remapping adds startup cost and hides curation bugs until a user hits them.
- **Per-keystroke SQL queries for search:** At ~500 rows, querying SQLite on every keystroke is unnecessary overhead and risk (query cancellation races). Load once, filter in memory.
- **Skipping the three-file Drizzle config as one step:** If `babel.config.js`, `metro.config.js`, or `drizzle.config.ts` is set up in isolation without the other two, migrations fail confusingly (either at bundle time with "unknown file extension .sql" or at runtime with an empty migrations array). Wire and verify all three together, then confirm with a real `npx drizzle-kit generate` + app boot before writing any schema tables beyond a smoke-test one.
- **Building the exercise list/detail screens before the seed pipeline is proven:** Since D-04/D-10 (seed never overwrites edits) and D-15 (full 13-table schema now) are both load-bearing for every later phase, the Walking Skeleton order should prove `migrate → seed → read one row → render` before building the full filter/chip UI.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL migration generation/diffing | A custom schema-diff-to-SQL tool | `drizzle-kit generate` | This is exactly what drizzle-kit exists for; hand-rolling schema diffing is high-risk and unnecessary |
| Recycling list rendering (if ever needed) | Custom `onScroll` + windowing logic | `@shopify/flash-list` (only if FlatList proves insufficient) | View recycling is a solved, hard problem; FlashList v2 needs zero native setup in this stack |
| Free-exercise-db → fixed taxonomy mapping | An in-app runtime classifier/heuristic | A one-time, reviewable Node script with an explicit lookup table (old value → one of the 10/8 fixed values) | D-01/D-02 require deterministic, auditable mapping — a script with an explicit table is reviewable by a human before shipping; a runtime heuristic is not |
| Tab bar icons | Custom SVG icon set | `@expo/vector-icons` | Already bundled with Expo, zero extra native config, proven in RN |
| Migration durability | Custom transaction/rollback wrapper around raw SQL | Drizzle's generated migrations + expo-sqlite's `execAsync` transactions, plus WAL+NORMAL pragmas | SQLite's own WAL mode already gives the durability guarantee the app needs; a hand-rolled wrapper adds risk for no additional safety |

**Key insight:** The two genuinely hard problems in this phase — safe schema migration and correct taxonomy curation — both have a "do it once, offline, and commit the reviewable output" solution rather than a "solve it cleverly at runtime" solution. That pattern (build-time script → static committed artifact → simple runtime consumer) should guide the Walking Skeleton task breakdown.

## Common Pitfalls

### Pitfall 1: Expo Go incompatibility surprise
**What goes wrong:** A developer runs `npx expo start` and opens the app in Expo Go (the default QR-scan flow); it crashes or shows "native module not found" for `expo-sqlite`.
**Why it happens:** Once Drizzle is wired to expo-sqlite, the app requires native code that Expo Go doesn't ship.
**How to avoid:** Install `expo-dev-client` in the very first scaffold task, and always test via a dev-client build (`npx expo run:android` or an EAS development build), never Expo Go, from this phase onward.
**Warning signs:** Confusing "module not found" or "native module cannot be null" errors that look like a config bug.

### Pitfall 2: Migration files never bundled (silent empty-migrations)
**What goes wrong:** `useMigrations` runs with an empty migration set, so the schema never gets created, and the app either crashes on first query or the migration hook reports `success: true` with zero tables.
**Why it happens:** `.sql` files generated by `drizzle-kit generate` are not text-importable by Metro without the inline-import babel plugin + `sourceExts` config; if either half is missing, the generated `./drizzle/migrations.js` barrel file silently fails to inline the SQL.
**How to avoid:** After first `drizzle-kit generate`, actually run the app and confirm a table exists (e.g., query `sqlite_master`) before writing more schema. Treat this as an early Walking Skeleton checkpoint, not something to verify at the end.
**Warning signs:** `useMigrations` resolves `success: true` but subsequent `SELECT` queries return "no such table."

### Pitfall 3: free-exercise-db tag inconsistency silently breaking the fixed taxonomy
**What goes wrong:** free-exercise-db's `equipment`/`primaryMuscles` fields are documented as "incomplete in some JSON files" `[CITED: github.com/yuhonas/free-exercise-db]`; a naive 1:1 remap leaves some seeded exercises with a null/unmapped muscle group, which breaks Phase 4's weekly-volume-by-muscle-group stats (STATE.md flags this exact risk).
**Why it happens:** The upstream dataset was hand-compiled over years and not all fields were consistently filled in for every exercise.
**How to avoid:** The curation script must have an explicit fallback/default for every unmapped value (never leave `muscleGroup` or `equipment` null), and should log/report how many exercises fell back to a default so a human can spot-check the curated output before committing it as the seed JSON.
**Warning signs:** Curation script silently produces rows with empty-string or null taxonomy fields.

### Pitfall 4: `drizzle.config.ts` `driver: 'expo'` typo or omission
**What goes wrong:** Without `driver: 'expo'`, `drizzle-kit generate` produces migrations in a format not consumable by the expo-sqlite migrator, or `drizzle-kit` commands (studio, push) target the wrong dialect assumptions.
**Why it happens:** It's an easy field to omit when copy-pasting a generic SQLite Drizzle config from non-Expo tutorials.
**How to avoid:** Always include both `dialect: 'sqlite'` AND `driver: 'expo'` together — copy the exact config from Pattern 1 above, don't compose it from a generic SQLite guide.
**Warning signs:** `drizzle-kit generate` runs without error but the app's migration hook never resolves `success: true`.

### Pitfall 5: WebSearch-sourced install commands showing `@rc`/`@next` tags
**What goes wrong:** Some fetched Drizzle+Expo documentation examples show `npm i drizzle-orm@rc expo-sqlite@next` — these are stale doc snapshots from when Expo SQLite support was pre-release.
**Why it happens:** Documentation pages get cached/indexed at different points in a library's release history; search results don't always surface the current stable-tag version of a code sample.
**How to avoid:** Always install the exact pinned versions from CLAUDE.md (`drizzle-orm@0.45.2`, `expo-sqlite@57.0.1`), never `@rc`/`@next`/`@latest` tags, regardless of what a fetched doc snippet shows.
**Warning signs:** `package.json` ends up with a `-rc` or prerelease version string after following a copy-pasted install command.

## Code Examples

See Architecture Patterns section above for the primary verified code (Drizzle config wiring, migration gate, driver-agnostic schema). Additional operation:

### Expo Router root layout wrapping a migration gate + tab stack
```typescript
// Source: docs.expo.dev/router/advanced/tabs/ pattern [CITED] + drizzle useMigrations pattern [CITED]
// app/_layout.tsx
import { Stack } from 'expo-router';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from '../drizzle/migrations';
import { db } from '../db/client';

export default function RootLayout() {
  const { success, error } = useMigrations(db, migrations);
  if (error) return <MigrationErrorScreen error={error} />;
  if (!success) return null; // brief, silent per D-16 — no progress screen
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
```

### 5-tab layout
```typescript
// Source: docs.expo.dev/router/advanced/tabs/ [CITED]
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.colors.accent, headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Workout', tabBarIcon: ({ color }) => <Ionicons name="barbell" size={24} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color }) => <Ionicons name="calendar" size={24} color={color} /> }} />
      <Tabs.Screen name="exercises" options={{ title: 'Exercises', tabBarIcon: ({ color }) => <Ionicons name="list" size={24} color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={24} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'More', tabBarIcon: ({ color }) => <Ionicons name="settings" size={24} color={color} /> }} />
    </Tabs>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Legacy `expo-sqlite` callback/transaction API | `openDatabaseSync` + Drizzle's async query builder | Prior Expo SDKs (pre-50) used a different SQLite API | Any tutorial referencing `db.transaction(tx => ...)` callback style is targeting the old API — ignore it |
| Old Architecture / bridge-based RN modules | New Architecture mandatory (Fabric/TurboModules) | Mandatory since Expo SDK 55 | No "disable new arch" fallback exists on SDK 57 — libraries incompatible with New Architecture cannot be used at all, not just discouraged |
| `drizzle-orm@rc` / `expo-sqlite@next` prerelease tags (seen in some cached docs) | Stable `drizzle-orm@0.45.2` / `expo-sqlite@57.0.1` | Drizzle's Expo SQLite driver graduated from RC to stable prior to this project's start | Ignore `@rc`/`@next` in any fetched doc snippet; use CLAUDE.md's pinned stable versions |

**Deprecated/outdated:**
- Package name `drizzle-studio-expo` (as written in CLAUDE.md's supporting-tools row): does not exist on the npm registry. The correct, currently-published package is `expo-drizzle-studio-plugin`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `expo-dev-client` exact patch version (57.0.7) was not independently re-verified against the npm registry this session (only cross-checked against CLAUDE.md's own pin) | Standard Stack | Low — `npx expo install expo-dev-client` self-resolves the SDK-compatible version regardless, so a stale pin in docs doesn't block execution |
| A2 | The seed-on-first-launch code pattern (Pattern 4) is a design synthesis from the D-04 requirement, not copied from an official Drizzle example | Architecture Patterns | Medium — planner/implementer must verify the exact `onConflictDoNothing`/`onConflictDoUpdate` SQLite API shape against installed drizzle-orm 0.45.2, field/argument names may differ slightly |
| A3 | Plain `FlatList` (not FlashList) is assumed sufficient for a 400-500 row exercise list without measured on-device profiling | Standard Stack / Anti-Patterns | Low — if wrong, FlashList is a documented, low-friction drop-in swap (same API surface) already vetted in the Package Legitimacy Audit |
| A4 | `expo-drizzle-studio-plugin`'s missing `repository` registry field is metadata incompleteness rather than a real risk signal (a public GitHub repo does exist) | Package Legitimacy Audit | Low — package is devDependency-only, never ships to end users; worst case is wasted install time if truly problematic |

## Open Questions

1. **Exact free-exercise-db → fixed-taxonomy mapping table**
   - What we know: free-exercise-db has `equipment` and `primaryMuscles` fields with documented gaps; the target taxonomy is fixed (10 muscle groups, 8 equipment types per D-01/D-02).
   - What's unclear: The literal value-by-value mapping (e.g., does free-exercise-db's `"cable"` equipment map 1:1, does `"forearms"` primaryMuscle fold into "Other" or "Biceps"?) requires inspecting the actual dataset content, which this research pass did not download/enumerate.
   - Recommendation: The planner should schedule a dedicated task to download `dist/exercises.json`, enumerate all distinct `equipment`/`primaryMuscles` values actually present, and build the mapping table as a reviewable artifact (a task deliverable, not something to leave to runtime guessing). This directly addresses the STATE.md-flagged risk about muscle-group tagging consistency.

2. **Exact row count after curation (D-03 target ~400-500)**
   - What we know: free-exercise-db has "800+" exercises per its README; CONTEXT.md targets trimming to ~400-500 by removing "clear junk/obscure duplicates."
   - What's unclear: What counts as "junk" is a judgment call not yet specified by rule.
   - Recommendation: Planner/implementer should define simple, auditable exclusion rules (e.g., drop exercises with no `equipment` AND no `primaryMuscles` at all, drop stretches/cardio-only categories if `category` field allows filtering) rather than manual one-by-one curation of 870 rows.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | All tooling (scaffold, drizzle-kit, curation script, vitest) | Confirmed available (registry lookups succeeded during this research session via `npm view`) | not independently checked this session | — |
| Android device/emulator for dev-client builds | Testing the scaffold end-to-end (expo-sqlite requires dev client, not Expo Go) | Not checked this session — environment audit was limited to npm registry reachability | — | If unavailable, `npx expo run:android` / EAS development build cannot be tested locally; flag as a blocking gap for the execution phase, not this research phase |
| EAS CLI / EAS account | Building the dev-client APK (mentioned as day-one requirement in CLAUDE.md) | Not checked this session | — | `eas build:configure` will surface auth requirements when first run; not a Phase 1 research blocker but should be confirmed early in execution |

**Missing dependencies with no fallback:**
- None identified as strictly blocking from this research session — all core npm packages resolve on the registry.

**Missing dependencies with fallback:**
- Android device/emulator availability should be confirmed by the planner/executor at the start of Phase 1 execution; if no device/emulator is available, `expo start --tunnel` combined with a previously-built dev client APK is the fallback, but a first dev-client build still requires either a local Android SDK or an EAS cloud build.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (pure logic + DB layer), no jest-expo needed in Phase 1 (no component/screen tests required per CLAUDE.md's testing split) |
| Config file | none yet — Wave 0 must create `vitest.config.ts` |
| Quick run command | `npx vitest run --project db` (or equivalent single-file: `npx vitest run db/schema.test.ts`) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FNDN-01 | App boots offline, SQLite is sole source of truth | manual-only (device boot with network disabled) — justification: verifying "no network calls" is an integration/device-level assertion, not unit-testable in-memory | manual device check: airplane mode + app launch | N/A |
| FNDN-02 | Migrations run safely on upgrade without data loss | integration (in-memory SQLite via better-sqlite3) | `npx vitest run db/migrations.test.ts` | ❌ Wave 0 |
| EXER-01 | Browse/search seeded library by name, muscle group, equipment | integration (DB query layer) + manual (UI interaction) | `npx vitest run db/exercises.query.test.ts` | ❌ Wave 0 |
| EXER-02 | Create, edit, archive custom exercise | integration (DB layer: insert/update/soft-delete) | `npx vitest run db/exercises.crud.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (fast — in-memory SQLite, no device needed)
- **Per wave merge:** `npx vitest run` (full suite) + one manual device smoke pass (app boots, seed populates, one exercise created/archived)
- **Phase gate:** Full suite green + FNDN-02's simulated-upgrade test (populate DB at migration N, apply migration N+1, assert data intact) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` — framework install/config, none exists yet (greenfield repo)
- [ ] `db/migrations.test.ts` — covers FNDN-02 (seed a populated in-memory DB at an early migration state, run the next migration, assert rows survive)
- [ ] `db/exercises.query.test.ts` — covers EXER-01 (search substring, muscle-group filter, equipment filter, AND/OR combination per D-07)
- [ ] `db/exercises.crud.test.ts` — covers EXER-02 (create, edit in place including seeded rows per D-10, archive/unarchive per D-11, duplicate-name warning per D-12 logic)
- [ ] `scripts/curate-exercises.test.ts` (optional but recommended) — covers the taxonomy-mapping fallback logic from Open Question 1, so a bad mapping rule is caught before the seed JSON is committed
- [ ] Shared test setup fixture: a helper that opens a `:memory:` better-sqlite3 DB, applies all generated migrations, and returns a Drizzle instance — needed by all four test files above

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in Phase 1 (Google Sign-In arrives in Phase 7) |
| V3 Session Management | No | No sessions — local-only app |
| V4 Access Control | No | Single-user local device, no multi-tenant access boundaries |
| V5 Input Validation | Yes | Drizzle's parameterized query builder (never raw string-concatenated SQL) for all inserts/updates, including custom exercise name/notes fields; enforce `name` required + reasonable length client-side before insert |
| V6 Cryptography | No | No secrets, no encryption requirement for local exercise/settings data in Phase 1 (backup encryption, if any, is a Phase 7 concern) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via custom exercise name/notes free-text fields | Tampering | Drizzle ORM's query builder parameterizes all values by default — never construct raw SQL strings by concatenating user input, even for the curation script's generated INSERTs |
| Malicious/oversized seed JSON tampering (low risk, bundled asset) | Tampering | Seed JSON is a build-time bundled asset (not user-writable at runtime), so this is a supply-chain concern for the curation script's source data (free-exercise-db, Unlicense/public-domain, low risk) rather than a runtime attack surface |
| Local DB file exposure on a rooted/compromised device | Information Disclosure | Out of scope for Phase 1 (no PII beyond user's own workout data on their own device); revisit if a future phase adds sensitive health data requiring at-rest encryption |

## Sources

### Primary (HIGH confidence)
- `npm view <package> version` for expo, drizzle-orm, drizzle-kit, expo-sqlite, babel-plugin-inline-import, @shopify/flash-list, expo-drizzle-studio-plugin, drizzle-studio-expo (404) — direct registry queries run this session
- `gsd-tools query package-legitimacy check` — @shopify/flash-list (OK), expo-drizzle-studio-plugin (SUS)

### Secondary (MEDIUM confidence / CITED — official docs, fetched via WebFetch this session)
- [orm.drizzle.team/docs/sqlite/connect-expo-sqlite](https://orm.drizzle.team/docs/sqlite/connect-expo-sqlite) — Drizzle+Expo SQLite babel/metro/drizzle.config setup, useMigrations hook usage
- [orm.drizzle.team/docs/get-started/expo-new](https://orm.drizzle.team/docs/get-started/expo-new) — schema.ts pattern, driver-agnostic schema sharing with better-sqlite3
- [docs.expo.dev/router/advanced/tabs/](https://docs.expo.dev/router/advanced/tabs/) — (tabs) directory convention, Tabs.Screen setup
- [github.com/yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db) — dataset schema, Unlicense, field completeness caveats
- [docs.expo.dev/versions/latest/sdk/flash-list/](https://docs.expo.dev/versions/latest/sdk/flash-list/) — official Expo SDK page listing FlashList as supported
- [github.com/drizzle-team/drizzle-orm discussion #784](https://github.com/drizzle-team/drizzle-orm/discussions/784) — better-sqlite3 test pattern synthesis

### Tertiary (LOW confidence — WebSearch synthesis, not independently fetched)
- FlashList vs FlatList performance characteristics (multiple blog posts, cross-checked directionally consistent)
- SQLite WAL + synchronous=NORMAL crash-safety guidance (sqlite.org + community sources, directionally consistent, not fetched from sqlite.org directly)
- Drizzle migration testing "no built-in simulate flag" finding — general web synthesis, not an official statement

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all core versions independently re-verified against npm registry this session and match CLAUDE.md exactly
- Architecture: MEDIUM-HIGH — Drizzle+Expo wiring patterns fetched from official docs; seed-bookkeeping and crash-safety patterns are design synthesis grounded in cited sources but not copy-pasted from an official "seed on first launch" example
- Pitfalls: MEDIUM — Expo Go incompatibility and migration-bundling pitfalls are well-documented and repeatedly confirmed across sources; taxonomy-mapping pitfall is project-specific reasoning validated against the actual free-exercise-db README caveat

**Research date:** 2026-07-19
**Valid until:** 2026-08-18 (30 days — stack is on a slow-moving stable SDK train, but re-verify package versions if planning is delayed past this window)
