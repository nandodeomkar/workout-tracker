# Architecture Research

**Domain:** Offline-first local-first mobile fitness/workout tracker (React Native + Expo, SQLite-only, no backend)
**Researched:** 2026-07-19
**Confidence:** HIGH (stack and patterns are well-documented and already decided in the approved design spec; MEDIUM on Google Drive appDataFolder specifics since Expo/Google library churn is frequent)

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                              UI Layer (expo-router)                    │
├───────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────────┐ ┌─────────┐ ┌────────┐ ┌─────────────┐  │
│ │ Workout  │ │ Active       │ │ History │ │Exercise│ │ Stats /     │  │
│ │ (home)   │ │ Workout      │ │         │ │Library │ │ Settings    │  │
│ │ tab      │ │ (modal/stack)│ │ tab     │ │ tab    │ │ tabs        │  │
│ └────┬─────┘ └──────┬───────┘ └────┬────┘ └───┬────┘ └──────┬──────┘  │
│      │              │              │           │            │        │
├──────┴──────────────┴──────────────┴───────────┴────────────┴────────┤
│                      Domain / Service Layer (plain TS)                │
│  ┌────────────────┐ ┌────────────────┐ ┌───────────────────────────┐  │
│  │ progression.ts │ │ stats.ts (PR,  │ │ backup.ts (Drive upload/  │  │
│  │ (linear, %TM)  │ │ 1RM, volume)   │ │ download, snapshot mgmt)  │  │
│  └────────────────┘ └────────────────┘ └───────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────── ┤
│                    Active-Session State (Zustand)                     │
│         (in-memory mirror of the in-progress workout, rest timer)     │
├─────────────────────────────────────────────────────────────────────── ┤
│                 Data Access Layer (Drizzle ORM queries)                │
├─────────────────────────────────────────────────────────────────────── ┤
│               Persistence (expo-sqlite, single .db file)               │
│   exercises · workouts · sets · templates · programs · settings ·     │
│   training_maxes · body_measurements · backup_meta                    │
└───────────────────────────────────────────────────────────────────────┘
                                    │
                     ┌──────────────┴───────────────┐
                     │  Google Drive appDataFolder    │
                     │  (opaque snapshot upload/list/  │
                     │   download — no schema access)  │
                     └────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| expo-router routes (`app/`) | Screen composition, navigation, params; call domain/data hooks, render only | File-based routes; `(tabs)` group for the 5 tabs, a route group for the active-workout stack that renders above tabs |
| Domain/service modules (`lib/domain/`) | Pure business logic: progression rules, PR/1RM math, plate math, warm-up suggestions, kg↔lb conversion | Plain TypeScript functions, no React/DB imports — unit-testable with vitest in isolation |
| Zustand active-workout store | Holds the *in-flight* workout's UI state (which set is being edited, rest-timer countdown, keyboard focus) so screens re-render fast without hitting SQLite on every keystroke | One store (`useActiveWorkoutStore`), hydrated from SQLite on app start if a workout is `finished_at IS NULL`, written through to SQLite on every completed set |
| Data access layer (`db/queries/`) | All Drizzle queries/mutations, one file per aggregate (workouts, templates, programs, exercises, stats, backup) | Drizzle ORM over expo-sqlite; `useLiveQuery` (drizzle's live-query hook) for screens that must reflect DB changes reactively (history list, stats) |
| SQLite database (single file) | Single source of truth for all persisted data; crash-safety boundary | expo-sqlite, WAL mode enabled, versioned Drizzle migrations bundled at build time |
| Backup module (`lib/backup/`) | Auth (Google Sign-In, `drive.appdata` scope), snapshot upload/list/download, retention (keep last 5), restore-with-confirmation flow | expo-file-system to checkpoint + copy the .db file; Drive REST v3 `files` API scoped to `appDataFolder`; no custom server |
| Notifications module | Local rest-timer notification/vibration, scheduled and cancelled per set | expo-notifications, foreground + background handling |

## Recommended Project Structure

```
src/
├── app/                        # expo-router routes ONLY — no business logic here
│   ├── (tabs)/
│   │   ├── index.tsx           # Workout home tab
│   │   ├── history.tsx
│   │   ├── exercises.tsx
│   │   ├── stats.tsx
│   │   └── settings/           # settings stack (programs, measurements, backup, export)
│   ├── workout/
│   │   ├── active.tsx          # full-screen active workout (survives nav/kill)
│   │   └── finish.tsx
│   └── _layout.tsx              # root layout: DB init, migrations gate, active-workout rehydrate
├── db/
│   ├── schema/                  # one file per table group (workouts.ts, templates.ts, programs.ts, ...)
│   ├── migrations/               # drizzle-kit generated SQL, bundled via metro .sql loader
│   ├── client.ts                 # openDatabaseSync + drizzle() singleton
│   └── seed/                     # exercise-library seed data + first-run seeding logic
├── domain/                       # pure, framework-free business logic (unit-tested)
│   ├── progression.ts            # linear / percent-of-TM progression
│   ├── stats.ts                  # est-1RM (Epley), PR detection, volume/weekly-volume aggregation
│   ├── plates.ts                 # plate calculator
│   ├── warmup.ts                 # warm-up set suggestions
│   └── units.ts                  # kg <-> lb conversion
├── store/
│   └── activeWorkout.ts          # Zustand store: current workout/session UI state, rest timer
├── backup/
│   ├── auth.ts                   # Google Sign-In wrapper (drive.appdata scope only)
│   ├── drive.ts                  # Drive REST calls: upload/list/download/delete snapshot
│   └── snapshot.ts               # checkpoint DB, copy aside, restore-with-confirmation orchestration
├── components/                   # shared presentational components (SetRow, ExerciseCard, Chart wrappers)
├── hooks/                        # useLiveQuery wrappers, useRestTimer, useMigrationsGate
└── constants/                    # theme tokens, default settings
```

### Structure Rationale

- **`app/` stays thin.** expo-router conventions punish putting logic in route files (harder to test, route files re-execute on every navigation). Routes call into `domain/`, `db/queries` (via hooks), and `store/` — never contain SQL or progression math directly.
- **`domain/` is framework-free on purpose.** Progression rules, 1RM/PR math, plate math are exactly the logic called out in the spec's testing section as pure and vitest-covered — keeping them import-free of React/Drizzle makes that trivial and keeps them reusable if a web/iOS client is ever added.
- **`db/schema/` split per aggregate**, not one giant file — matches Drizzle+Expo community convention and keeps migrations reviewable as the schema grows (programs/progression JSON columns will evolve).
- **`store/` holds exactly one thing**: the active-workout session. Everything else (history, stats, exercise library) is read live from SQLite via Drizzle's live-query hook — resist the urge to mirror more state into Zustand; it becomes a second source of truth and a sync-bug generator.
- **`backup/` is isolated and one-directional dependency**: it reads the DB file and settings, but nothing else in the app depends on it. This lets backup fail entirely (no Google account, offline, API error) without touching core logging.

## Architectural Patterns

### Pattern 1: Single source of truth, write-through active session

**What:** The active workout lives in Zustand for responsive UI, but every completed set is written to SQLite immediately (not batched, not on "finish workout"). Zustand state is a *cache*, SQLite is the truth.
**When to use:** Any screen where data loss on crash/kill is unacceptable — this is the core "never lose data" requirement.
**Trade-offs:** Slightly more DB writes than a batch-on-finish approach, but expo-sqlite writes are fast (single-row inserts, tens of ms) and this is what makes app-kill recovery trivial: on relaunch, query `workouts WHERE finished_at IS NULL` and rehydrate the store from SQLite rather than needing any separate persistence layer for the draft.

**Example:**
```typescript
// store/activeWorkout.ts
const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => ({
  workoutId: null,
  async completeSet(setDraft) {
    const row = await db.insert(sets).values(setDraft).returning(); // SQLite write-through, immediate
    set((s) => ({ sets: [...s.sets, row[0]] }));                     // UI updates from the same data
    startRestTimer(row[0]);
  },
}));

// app/_layout.tsx — on cold start
const inProgress = await db.query.workouts.findFirst({ where: isNull(workouts.finishedAt) });
if (inProgress) useActiveWorkoutStore.getState().rehydrate(inProgress.id);
```

### Pattern 2: Pure domain functions for anything computed

**What:** PRs, est-1RM, volume, plate breakdowns, warm-up sets, progression decisions are all pure functions of `sets`/`training_maxes` rows — never stored, always derived at query time.
**When to use:** Any "statistics" or "suggestion" feature. This matches the spec's explicit decision (no PR cache table) and avoids the classic fitness-app bug class: stale computed values after editing a past workout.
**Trade-offs:** Recomputing on read costs a little CPU; for a single-user local DB with thousands (not millions) of sets this is negligible. Only add a cache table if profiling shows it's needed — don't pre-optimize.

**Example:**
```typescript
// domain/stats.ts — no DB import, no React import
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30); // Epley
}
export function detectPRs(history: SetRow[], newSet: SetRow): PR[] { /* pure comparison */ }
```

### Pattern 3: Live queries for everything that isn't the active session

**What:** History, exercise detail, stats, program state all read directly from SQLite via a live-query hook that re-renders on table change, instead of manual refetch-on-focus logic.
**When to use:** Any list/detail screen driven by persisted data with no need for sub-100ms optimistic UI (i.e., everything except the active-workout set-logging loop).
**Trade-offs:** Slightly more "magic" than manual fetches, but eliminates an entire class of stale-list bugs (e.g., finishing a workout not showing up in History without a manual refresh).

## Data Flow

### Request Flow (logging a set)

```
[User taps ✓ on a set row]
    ↓
[Active Workout screen] → [useActiveWorkoutStore.completeSet()] → [Drizzle insert into `sets`] → [SQLite]
    ↓                              ↓                                        ↓
[optimistic UI update]      [rest timer starts]                 [row committed, crash-safe]
    ↓
[expo-notifications scheduled for rest-timer end]
```

### Request Flow (finishing a workout → backup)

```
[Finish button] → [set workouts.finished_at] → [advance program_state if from a program]
    ↓
[Finish screen: volume/duration/PRs computed from domain/stats.ts over this workout's sets]
    ↓ (if signed in + online)
[backup/snapshot.ts: checkpoint WAL → copy .db file → drive.ts uploads to appDataFolder]
    ↓
[backup_meta.last_backup_at updated; failure is silent-retry, not blocking]
```

### State Management

```
SQLite (source of truth)
    ↓ (live query, on table change)                     ↓ (cold-start rehydrate only)
[History / Exercises / Stats screens]          [Zustand: active-workout session]
    ↑ (read-only, no local mutation)                     ↑↓ (read + write-through)
                                              [Active Workout screen — fast local updates]
```

### Key Data Flows

1. **Set logging (hot path):** UI → Zustand (optimistic) → Drizzle insert → SQLite, immediately, every set. This is the path that must never lose data and must never block on network.
2. **Template pre-fill:** Starting a template queries the most recent `workout_exercises`/`sets` for each exercise ID and seeds the active-workout store's initial values — a read-only join, no writes until the user logs a set.
3. **Program advancement:** Finishing a workout that has a `template_id` belonging to a program day increments `program_state.current_day_position`; the Workout-home tab's "next in program" card is a live query against `program_state` + `program_days` + `templates`.
4. **Progression evaluation:** When starting a template exercise that has a `progression` JSON rule, `domain/progression.ts` reads the exercise's history (or `training_maxes` for %TM schemes) and computes the suggested target weight/reps — pure function, called at render time, not stored.
5. **Backup (cold path):** Only triggered after `finished_at` is set and only if signed in + online; reads the DB file from disk (via expo-file-system after a WAL checkpoint), uploads via Drive REST to `appDataFolder`, prunes to last 5. Failure never touches the SQLite file or blocks any other flow.
6. **Restore:** User picks a snapshot in Settings → local DB is copied aside → downloaded snapshot overwrites the live DB file → app reloads/re-runs migrations gate. This is the one flow allowed to be disruptive, and it's gated by an explicit confirmation dialog per the spec's error-handling section.

## Scaling Considerations

This is a single-user (or single-user-per-device) local database, not a scaling problem in the traditional sense — "scale" here means data volume over years of use and friends-beta fleet size, not concurrent load.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user, first months (10s–100s of workouts) | Current design as-is; no indices needed beyond what Drizzle/SQLite defaults provide |
| Single user, years of history (1000s of workouts, 10k+ sets) | Add indices on `sets.workout_exercise_id`, `workout_exercises.workout_id`, `sets.completed_at` for stats/history queries; still fine on-device |
| Friends-beta fleet (10–30 independent devices/DBs) | No shared-state concern — each device is fully independent; only shared surface is the Drive backup format, so schema-version compatibility checks (already in spec) matter more than query performance |
| Hypothetical public release (thousands of installs) | No architecture change needed — this is N independent local databases; the only thing that scales is code maintenance (crash reporting, in-app feedback triage), not the data layer |

### Scaling Priorities

1. **First bottleneck:** Unindexed queries on `sets`/`workout_exercises` once a user has years of history — fix by adding the indices above during the Stats phase, not before (avoid premature optimization; Drizzle migrations make this cheap to add later).
2. **Second bottleneck (only if it appears):** Recomputing PRs/1RM over the full history on every exercise-detail view if a user logs an exercise hundreds of times — mitigate by scoping the query to a bounded window (e.g., last 12 months + all-time best via a single indexed MAX query) rather than adding a cache table preemptively.

## Anti-Patterns

### Anti-Pattern 1: Mirroring all DB state into Zustand

**What people do:** Load workouts/templates/programs/exercises into global Zustand stores "for performance" or habit from web SPA patterns.
**Why it's wrong:** Creates two sources of truth; every mutation now needs to update both SQLite and the store, and they drift the moment a query changes shape or a migration adds a column. This is the single most common cause of "history doesn't show my just-finished workout" bugs in this class of app.
**Do this instead:** Keep Zustand scoped to the one thing that needs sub-frame responsiveness (the active workout session). Everything else reads live from SQLite via query hooks.

### Anti-Pattern 2: Storing computed/derived values (PRs, streaks, cached 1RM) as columns

**What people do:** Add a `is_pr` boolean or `best_1rm` cached column to speed up list rendering, updated by app logic on write.
**Why it's wrong:** Every edit-past-workout, delete, or unit-conversion path now has to remember to recompute and rewrite the cache, and inevitably one path is missed — the classic stale-PR bug that plagues fitness-tracker rewrites. The spec already made the right call here (compute from `sets`, never store).
**Do this instead:** Compute PRs/1RM/volume from `sets` at query time in `domain/stats.ts`; only add a cache table after profiling shows a real, measured slowdown, and even then keep `sets` as the recomputation source.

### Anti-Pattern 3: Auth/backup logic reaching into core logging flows

**What people do:** Gate "finish workout" or set-logging behind a signed-in check, or let a failed Drive upload throw an error that surfaces in the active-workout screen.
**Why it's wrong:** Violates the "offline always works, backup is optional" requirement and turns a network hiccup at the gym into a lost workout or a scary error dialog mid-set.
**Do this instead:** Backup is a fire-and-forget side effect triggered only after a workout is already durably saved locally; failures are logged to `backup_meta` and surfaced only as a small settings-screen banner after repeated failures, never as a blocking dialog during logging.

### Anti-Pattern 4: Editing the SQLite file directly while it's open elsewhere (no WAL checkpoint before backup)

**What people do:** Copy the `.db` file for backup while the app still has it open in WAL mode, without checkpointing first.
**Why it's wrong:** WAL mode keeps recent writes in a separate `-wal` file; copying only the main `.db` file can silently drop the most recent sets from the backup snapshot.
**Do this instead:** Run `PRAGMA wal_checkpoint(FULL)` (or Drizzle's equivalent) immediately before copying the file for upload, every time.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Sign-In | `@react-native-google-signin/google-signin` (or Expo's supported equivalent), request only the `drive.appdata` scope | Scope choice means the app literally cannot see the rest of the user's Drive — good for the "clean, no creepy permissions" positioning; sign-in is fully optional and gated behind Settings |
| Google Drive API v3 (`files` resource, `appDataFolder` space) | REST calls (list/create/update/delete) scoped with `spaces=appDataFolder` | No SDK is required for appDataFolder access — plain authenticated `fetch` calls work; keep this in `backup/drive.ts` as the only module that knows about Drive's REST shape |
| expo-notifications | Local-only scheduling for rest timer; no push service needed | Foreground presentation + background delivery both need explicit handling per Expo's current notification behavior APIs |
| expo-file-system | Read/copy/write the SQLite `.db` file for backup and restore | Database file lives under the app's document directory (`SQLite/` subfolder, or `SQLite.defaultDatabaseDirectory`) — path is stable across app runs on a given device but differs by platform |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `app/` routes ↔ `domain/` | Direct function calls, no events | Routes call pure functions synchronously for calculators (plates, 1RM) and awaited async functions for DB-backed decisions (progression suggestion needs a query first) |
| `app/` routes ↔ `store/activeWorkout` | Zustand hook subscription | Only the active-workout route tree subscribes; other tabs never import this store |
| `app/` routes ↔ `db/queries` | Live-query hooks (Drizzle `useLiveQuery` or equivalent wrapper) | Read paths; write paths go through named mutation functions in `db/queries`, not ad-hoc inline Drizzle calls in components |
| `store/activeWorkout` ↔ `db/queries` | Store's write-through actions call `db/queries` mutation functions | Keeps SQL out of the store file itself; store stays about UI state + orchestration |
| `backup/` ↔ `db/client` | One-directional: backup reads the file path and settings, never imports Drizzle schema/queries | Backup treats the DB as an opaque file, which is also why the spec's schema-version-in-snapshot check matters (restoring a newer schema into an older app must be refused, not partially applied) |

## Sources

- [Drizzle ORM - Expo SQLite (official docs)](https://orm.drizzle.team/docs/sqlite/connect-expo-sqlite) — HIGH confidence, official
- [Drizzle ORM - Native SQLite / Expo new project guide](https://orm.drizzle.team/docs/get-started/expo-new) — HIGH confidence, official
- [Drizzle and React Native (Expo): Local SQLite setup - LogRocket Blog](https://blog.logrocket.com/drizzle-react-native-expo-sqlite/) — MEDIUM confidence, third-party tutorial, corroborates official docs
- [How to organize Expo app folder structure for clarity and scalability - Expo blog](https://expo.dev/blog/expo-app-folder-structure-best-practices) — HIGH confidence, official
- [Core concepts of file-based routing in Expo Router - Expo Documentation](https://docs.expo.dev/router/basics/core-concepts/) — HIGH confidence, official
- [Top-level src directory - Expo Documentation](https://docs.expo.dev/router/reference/src-directory/) — HIGH confidence, official
- [Designing a Scalable React Native + Expo Router Folder Structure - DEV Community](https://dev.to/sachinrupani/designing-a-scalable-react-native-expo-router-folder-structure-3dnj) — MEDIUM confidence, community, consistent with official guidance
- [SQLite - Expo Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/) — HIGH confidence, official (database file location, WAL)
- [Accessing your Expo-SQLite Database File on iOS and Android - David Barth](https://davidbarth.dev/posts/expo-sqlite-database-access/) — MEDIUM confidence, third-party, corroborates file-location details
- [Import and Export SQLite Database in Expo Native and Web](https://www.amarjanica.com/import-and-export-sqlite-database-in-expo-native-and-web/) — MEDIUM confidence, third-party, corroborates checkpoint-before-copy pattern
- [Google Drive auto-backup for React Native on Android - DEV Community](https://dev.to/retyui/google-drive-auto-backup-for-react-native-on-android-254a) — MEDIUM confidence, community, corroborates appDataFolder + Drive REST approach
- [@robinbobin/react-native-google-drive-api-wrapper - npm](https://www.npmjs.com/package/@robinbobin/react-native-google-drive-api-wrapper) — MEDIUM confidence, community package, illustrates appDataFolder usage pattern
- [React Native offline-first: conflict-safe SQLite sync - DEV Community](https://dev.to/sathish_daggula/react-native-offline-first-conflict-safe-sqlite-sync-549a) — MEDIUM confidence, community, corroborates write-through/outbox and WAL guidance
- Approved project design spec: `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — HIGH confidence, project-internal source of truth for stack/data-model decisions

---
*Architecture research for: Offline-first local-first mobile workout tracker (React Native + Expo, SQLite, Drizzle, Zustand, expo-router, Google Drive appDataFolder backup)*
*Researched: 2026-07-19*
