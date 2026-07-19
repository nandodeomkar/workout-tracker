# Phase 1: Scaffold & Data Foundation - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 20 (new — all files this phase creates)
**Analogs found:** 0 / 20 in-codebase (greenfield repo — no app source code exists yet)

## Greenfield Notice

This repo currently contains only `.planning/`, `docs/`, `.claude/`, `CLAUDE.md` — no `app/`, `db/`, `theme.ts`, or any source code. There are **no in-codebase analogs** for any file in this phase. All patterns below are sourced from `01-RESEARCH.md`'s cited/verified code examples (Drizzle+Expo official docs, Expo Router official docs) rather than existing project files. This is expected for Phase 1 — the files this phase creates **become** the analogs for Phase 2 onward.

Future phase pattern-mapping runs should treat the files below (once built) as the canonical in-codebase analogs for their respective roles (e.g., `db/schema.ts` for any new table, `app/(tabs)/exercises/index.tsx` for any new list screen).

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|-----------------|----------------|
| `babel.config.js` | config | — | RESEARCH.md Pattern 1 | reference-only (no analog) |
| `metro.config.js` | config | — | RESEARCH.md Pattern 1 | reference-only (no analog) |
| `drizzle.config.ts` | config | — | RESEARCH.md Pattern 1 | reference-only (no analog) |
| `db/schema.ts` | model | CRUD | RESEARCH.md Pattern 3 | reference-only (no analog) |
| `db/client.ts` | service | request-response | RESEARCH.md Pattern 2 + Pattern 5 | reference-only (no analog) |
| `db/seed/runSeed.ts` | service | batch | RESEARCH.md Pattern 4 | reference-only (no analog), `[ASSUMED]` per research |
| `db/seed/exercises.seed.json` | config (data) | batch | — | no analog — build output of curation script |
| `db/seed/seedVersion.ts` | config | — | — | no analog — trivial constant module |
| `scripts/curate-exercises.ts` | utility | transform/batch | — | no analog — one-time Node dev script |
| `app/_layout.tsx` | provider | request-response | RESEARCH.md "Expo Router root layout wrapping a migration gate" example | reference-only (no analog) |
| `app/(tabs)/_layout.tsx` | route | request-response | RESEARCH.md "5-tab layout" example | reference-only (no analog) |
| `app/(tabs)/index.tsx` (Workout, coming-soon) | component | request-response | none — trivial empty-state screen | no analog needed |
| `app/(tabs)/history.tsx` (coming-soon) | component | request-response | same pattern as above | no analog needed |
| `app/(tabs)/stats.tsx` (coming-soon) | component | request-response | same pattern as above | no analog needed |
| `app/(tabs)/settings.tsx` (coming-soon) | component | request-response | same pattern as above | no analog needed |
| `app/(tabs)/exercises/index.tsx` | component | CRUD (read) + transform | RESEARCH.md Architecture Diagram "In-memory filter pipeline" + Don't Hand-Roll (FlatList) | reference-only (no analog) |
| `app/(tabs)/exercises/[id].tsx` | component | CRUD (update) | none — first detail/edit screen in project | no analog — design per D-09/D-10/D-11 |
| `app/(tabs)/exercises/new.tsx` | component | CRUD (create) | none — first creation form in project | no analog — design per D-09/D-12 |
| `theme.ts` | config | — | none — first theme token file | no analog — dark-only per D-14 |
| `db/migrations.test.ts`, `db/exercises.query.test.ts`, `db/exercises.crud.test.ts` | test | integration | RESEARCH.md Pattern 3 (better-sqlite3 test driver) | reference-only (no analog) |
| `vitest.config.ts` | config | — | none | no analog — standard vitest setup |

## Pattern Assignments

### `db/schema.ts` (model, CRUD)

**No in-codebase analog — greenfield.** Authoritative pattern is `01-RESEARCH.md` Pattern 3 and the full data model in `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` (read this for the complete 13-table schema; D-15 requires it implemented verbatim).

**Driver-agnostic schema builder pattern** (RESEARCH.md Pattern 3, lines 298-312):
```typescript
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
Extend this same pattern (sqliteTable + int/text builders, snake_case DB column names via explicit string arg, camelCase TS field names) for all 13 tables: exercises, workouts, workout_exercises, sets, templates, template_exercises, programs, program_days, program_state, training_maxes, body_measurements, settings, backup_meta. This module must import only from `drizzle-orm/sqlite-core` (no expo-sqlite or better-sqlite3 imports) to stay driver-agnostic — that constraint is load-bearing for the vitest DB-layer tests.

**Testing pattern — same schema imported by two drivers** (RESEARCH.md Pattern 3, lines 314-322):
```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../db/schema';

const sqlite = new Database(':memory:');
export const testDb = drizzle(sqlite, { schema });
// then run the same generated migration SQL against testDb before each test
```

---

### `db/client.ts` (service, request-response)

**No in-codebase analog.** Authoritative pattern: RESEARCH.md Pattern 2 (migration gate) + Pattern 5 (crash-safe pragmas), combined:

```typescript
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite";

const expoDb = openDatabaseSync("workout.db");
await expoDb.execAsync('PRAGMA journal_mode = WAL');
await expoDb.execAsync('PRAGMA synchronous = NORMAL');
await expoDb.execAsync('PRAGMA busy_timeout = 2000');
export const db = drizzle(expoDb);
```
Pragmas must run immediately after `openDatabaseSync`, before any writes (RESEARCH.md Pattern 5). Note the caveat: `deleteDatabaseSync` doesn't clean up `-wal`/`-shm` sidecar files in some expo-sqlite versions — not relevant to Phase 1's scope but worth a code comment for the future backup/restore phase.

---

### `app/_layout.tsx` (provider, request-response)

**No in-codebase analog.** Authoritative pattern: RESEARCH.md "Expo Router root layout wrapping a migration gate + tab stack":

```typescript
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
After migrations succeed, this is also where the seed check runs (D-16: silent seed before rendering tabs) — call `runSeedIfNeeded(db)` from `db/seed/runSeed.ts` between the migration success branch and rendering `<Stack>`.

**Error/pending state handling:** RESEARCH.md Pattern 2 shows explicit `error`/`!success`/`success` branches — treat migration failure as a hard-stop screen (FNDN-02 requires migrations never silently lose data; an error screen, not a crash, is the correct failure mode).

---

### `app/(tabs)/_layout.tsx` (route, request-response)

**No in-codebase analog.** Authoritative pattern: RESEARCH.md "5-tab layout" example:

```typescript
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
D-13 requires all 5 tabs built now, non-Exercises tabs as "coming soon" empty states — a trivial centered-text component using `theme.ts` tokens, no per-file pattern needed beyond "import theme, render a centered `<Text>`".

---

### `app/(tabs)/exercises/index.tsx` (component, CRUD read + transform)

**No in-codebase analog.** Authoritative pattern: RESEARCH.md's Architecture Diagram "In-memory filter pipeline" + Don't Hand-Roll table entry on FlatList.

**Core pattern (load once, filter in memory):**
- On mount: `SELECT * FROM exercises WHERE archived=0` once via `db.select().from(exercises).where(eq(exercises.archived, false))`, hold in component state.
- Filter pipeline per D-06/D-07: substring match on `name` (case-insensitive) → muscle-group chip selection (OR within row) → equipment chip selection (OR within row) → AND across the two chip rows.
- Render with plain `FlatList` (RESEARCH.md: 400-500 rows does not need `@shopify/flash-list`; A3 assumption — flag `FlashList` as a documented fallback only if on-device jank is measured, don't add pre-emptively).
- **Anti-pattern warning (RESEARCH.md Anti-Patterns):** do NOT re-query SQLite per keystroke — this is explicitly called out as unnecessary overhead/risk at this row count.

Row rendering per D-08: exercise name + secondary line "muscle group · equipment", small "custom" badge if `isCustom`, mixed into the flat A–Z list (no section headers per D-05).

---

### `app/(tabs)/exercises/new.tsx` and `[id].tsx` (component, CRUD create/update)

**No in-codebase analog — first CRUD forms in the project.** No RESEARCH.md code example exists for these; build per CONTEXT.md decisions directly:
- `new.tsx`: form fields = name (required) + muscle group + equipment (pickers from the same fixed lists as `db/schema.ts` taxonomy constants) + optional notes (D-09). On submit, duplicate-name check against existing exercises — warn-but-allow with inline hint (D-12).
- `[id].tsx`: same field set, editable in place for both seeded and custom exercises (D-10). Includes archive/unarchive toggle (D-11) — a boolean flag update, not a delete.
- **Security (RESEARCH.md Security Domain V5):** use Drizzle's parameterized query builder for all inserts/updates — never raw string-concatenated SQL, even for the curation script's generated inserts.

---

### `db/seed/runSeed.ts` (service, batch)

**No in-codebase analog.** Authoritative pattern: RESEARCH.md Pattern 4 — explicitly marked `[ASSUMED]` in research (design synthesis from D-04, not copied from an official Drizzle example; verify `onConflictDoNothing`/`onConflictDoUpdate` signature against installed drizzle-orm 0.45.2 when implementing):

```typescript
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
Called from `app/_layout.tsx` after migration success, before rendering tabs, silently (D-16).

---

### `scripts/curate-exercises.ts` (utility, transform/batch)

**No in-codebase analog — one-time dev-time Node script, never bundled into the app.** No direct code example in RESEARCH.md; build per the "Don't Hand-Roll" guidance: an explicit, reviewable lookup table (old free-exercise-db value → one of the fixed 10 muscle groups / 8 equipment types from D-01/D-02), never a runtime heuristic. Must have an explicit fallback/default for every unmapped value (Pitfall 3) — log/report fallback counts for human spot-check before committing `exercises.seed.json`. Output is committed static JSON, consumed by `db/seed/runSeed.ts`.

---

### Config trio: `babel.config.js`, `metro.config.js`, `drizzle.config.ts`

**No in-codebase analog.** These three files are interdependent (RESEARCH.md Pattern 1 + Pitfall 2/4) and must be set up together, verified with a real `drizzle-kit generate` + app boot before writing schema beyond a smoke-test table:

```javascript
// babel.config.js
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [["inline-import", { "extensions": [".sql"] }]]
  };
};
```
```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
module.exports = config;
```
```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './db/schema.ts',
  out: './drizzle',
});
```

---

### `db/migrations.test.ts`, `db/exercises.query.test.ts`, `db/exercises.crud.test.ts` (test, integration)

**No in-codebase analog — Wave 0 gap per RESEARCH.md Validation Architecture.** All three share the better-sqlite3 in-memory test-driver pattern from `db/schema.ts`'s section above. Recommended shared fixture: a helper that opens a `:memory:` better-sqlite3 DB, applies all generated migration SQL, returns a Drizzle instance — used by all three test files (RESEARCH.md Wave 0 Gaps list).

- `db/migrations.test.ts` (FNDN-02): populate at migration N, apply N+1, assert data intact.
- `db/exercises.query.test.ts` (EXER-01): search substring, muscle-group filter, equipment filter, AND/OR combination per D-07.
- `db/exercises.crud.test.ts` (EXER-02): create, edit in place (including seeded rows per D-10), archive/unarchive per D-11, duplicate-name warning logic per D-12.

---

## Shared Patterns

### Migration gate (blocks all screens until DB ready)
**Source:** RESEARCH.md Pattern 2
**Apply to:** `app/_layout.tsx` only, but every screen depends on its success state existing before render.

### Crash-safe pragmas
**Source:** RESEARCH.md Pattern 5
**Apply to:** `db/client.ts`, run once at DB open — relevant to FNDN-01/FNDN-02 now, and to Phase 2's per-set writes later.

### Driver-agnostic schema import
**Source:** RESEARCH.md Pattern 3
**Apply to:** `db/schema.ts` (definition) and all three test files (consumption via better-sqlite3 driver) — the module must never import `expo-sqlite` or `better-sqlite3` directly.

### Parameterized queries only (no raw SQL string concatenation)
**Source:** RESEARCH.md Security Domain V5
**Apply to:** `db/seed/runSeed.ts`, `app/(tabs)/exercises/new.tsx`, `app/(tabs)/exercises/[id].tsx`, `scripts/curate-exercises.ts` — always use Drizzle's query builder.

### Theme tokens, no inline styling
**Source:** CONTEXT.md D-14 (no existing analog — first theme file in project)
**Apply to:** All components under `app/(tabs)/`. Every screen/component imports from `theme.ts` rather than hardcoding colors/spacing.

## No Analog Found

All 20 files in this phase have no in-codebase analog (greenfield repo). Files with no RESEARCH.md code example either (planner should design directly from CONTEXT.md decisions, marked below):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/(tabs)/exercises/new.tsx` | component | CRUD (create) | First creation form; no library/framework example in research, design from D-09/D-12 |
| `app/(tabs)/exercises/[id].tsx` | component | CRUD (update) | First edit/detail screen; design from D-10/D-11 |
| `theme.ts` | config | — | First theme token file; design from D-14 (dark-only tokens) |
| `db/seed/exercises.seed.json` | config (data) | batch | Build output of `scripts/curate-exercises.ts`, not hand-written |
| `db/seed/seedVersion.ts` | config | — | Trivial exported constant, no pattern needed |
| `vitest.config.ts` | config | — | Standard vitest bootstrap, no project-specific pattern yet |

## Metadata

**Analog search scope:** Entire working tree (`Glob "**/*"` excluding `.git`, `.planning`) — confirmed empty of app source code via `ls`/`find`.
**Files scanned:** Repo root, `.claude/`, `docs/superpowers/` (design spec referenced but not re-extracted here — canonical for the full 13-table schema, read directly during planning/execution).
**Pattern source:** `01-RESEARCH.md` Architecture Patterns section (Patterns 1-5) and Code Examples section — all marked `[CITED]` (official Drizzle/Expo docs) except Pattern 4 which is `[ASSUMED]` design synthesis.
**Pattern extraction date:** 2026-07-19
