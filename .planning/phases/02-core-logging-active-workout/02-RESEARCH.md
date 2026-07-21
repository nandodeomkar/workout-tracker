# Phase 2: Core Logging (Active Workout) - Research

**Researched:** 2026-07-21
**Domain:** Offline-first active-workout logging loop (React Native/Expo), crash-safe local writes, local scheduled notifications, gesture-driven reorder, pure-function progression math
**Confidence:** MEDIUM (core stack decisions HIGH — verified against npm registry and existing codebase; notification-reliability and drag-reorder specifics MEDIUM/LOW — WebSearch/WebFetch only, no Context7 MCP available this session)

## Summary

Phase 2 is almost entirely additive to an already-solid Phase 1 foundation: the driver-agnostic `db/schema.ts`, the `db/exercises.ts` query-layer pattern, the `theme.ts` tokens, and the Stack-per-tab-group routing fix are all directly reusable. The phase needs exactly three **new runtime dependencies** (`zustand`, `expo-notifications`, and an explicit `react-native-gesture-handler` entry in `package.json` — it is currently only a transitive dependency), one **additive migration** (a nullable `rest_seconds` column), and a set of **pure `lib/` functions** (kg↔lb conversion, Epley 1RM, volume, PR detection, last-performance selection query shape) that are the natural vitest surface for this phase.

The single most important architectural decision this research resolves is D-08 (rest-override storage): put it on `exercises` as a nullable `restSeconds` column, not on `workout_exercises`, because CONTEXT.md explicitly says the override "persist[s] per exercise across workouts" — that is a property of the exercise, not of a single workout session. This is a one-line additive migration following the exact FNDN-02 pattern already proven in `drizzle/0001_*.sql`.

The second load-bearing finding is that this project's crash-safety model (D-15) is **already solved by writing every set to SQLite immediately** — Zustand should NOT use `persist` middleware with AsyncStorage/MMKV. That would create a second, driftable persistence layer. Instead, Zustand holds only ephemeral UI/session state, and "resume on cold start" is a plain SQLite query (`workouts` row with `finished_at IS NULL`) run once at app boot / Workout-tab mount — not a rehydration of a persisted store. This distinction is easy to get wrong and should be called out explicitly in the plan.

**Primary recommendation:** Store the rest override as `exercises.restSeconds` (nullable int) via one additive drizzle-kit migration; use Epley's formula (`weight * (1 + reps/30)`, with `reps<=1` short-circuited to `weight`) as the single shared 1RM function in `lib/estimate1RM.ts` for both Phase 2 and Phase 4; do not add `zustand persist` — rehydrate the active session from SQLite on boot; hand-roll exercise-card drag-reorder with `react-native-gesture-handler` + `react-native-reanimated` (already-installed peers) rather than adding a third-party draggable-list package; build the History month calendar as a plain custom `View`/`FlatList` grid (zero new dependency, per UI-SPEC's explicit flag); and schedule the rest-timer notification via `expo-notifications` `TIME_INTERVAL` trigger gated behind the `SCHEDULE_EXACT_ALARM` Android permission, cancelling/rescheduling on skip/±15s/next-set.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Active-workout session state (elapsed time, current screen mode, in-memory set-row UI state) | Client (Zustand store) | — | Ephemeral, per-session UI concern; not persisted independently of SQLite |
| Set/exercise/workout persistence (crash-safe writes) | Database (SQLite via Drizzle) | Client (Zustand mirrors for render) | D-15: SQLite is sole source of truth; Zustand is a read-through cache for the current screen only |
| Rest-timer countdown display | Client (Zustand + local `setInterval`/Reanimated) | — | Pure UI ticking state; no persistence needed (timer target end-time can be recomputed, see Pitfalls) |
| Rest-timer notification delivery | OS (Android AlarmManager via expo-notifications) | Client (in-app countdown bar) | Must fire even if app is backgrounded/screen off — OS-level scheduling required, in-app state is a visual mirror only |
| Last-performance pre-fill | Database (SQLite query) | Client (Zustand caches result per exercise for the session) | D-06 requires a cross-history query; DB is authoritative, client just holds the answer for the active session |
| Est-1RM / volume / PR detection | Client (pure `lib/` function, computed at render/finish time) | — | Spec: "PRs and records are computed from `sets`, never stored" — no cache tier |
| kg/lb conversion & rounding | Client (pure `lib/` function) | — | Canonical storage is kg; conversion is a display-time concern only |
| Exercise picker (add/replace) | Client (reused Phase 1 screen + `db/exercises.ts` reads) | — | Read-only reuse of existing Exercises-tab query layer |
| Month-calendar grid (History) | Client (custom component, no new dependency) | Database (query workouts by month range) | Simple date-bucketing over a DB query result; no calendar library needed at this scale |

## User Constraints

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Set-logging loop**
- D-01: Tapping checkmark logs the set immediately using pre-filled last-time weight/reps — one tap to repeat a set. Numbers are only touched when they change (LOG-01 "≤2 taps" target).
- D-02: Number entry combines ±2.5 kg / ±1 rep steppers (small nudges) with tap-the-number → numeric keypad (big jumps, e.g. 20→100 kg).
- D-03: Phase 2 set metadata = weight + reps + a per-set warmup toggle (warmups excluded from volume and PR computation). Set-type dropset/failure and RPE are deferred — `sets.type`/`sets.rpe` columns exist but stay unused (default `type='normal'`).

**Starting a workout**
- D-04: Two start paths in Phase 2: blank, or from history (pick a past workout). Templates are Phase 3, out of scope.
- D-05: "From history" copies the exercise list of the chosen past workout; each exercise's set rows then pre-fill from that exercise's most recent performance (across all history, not necessarily the picked workout).
- D-06: Pre-fill source for any exercise = its last completed performance (most recent `sets` for that `exercise_id`). Empty when never logged.

**Rest timer**
- D-07: A global default rest duration (from `settings`) auto-starts on checkmark (set completion).
- D-08: Per-exercise custom rest override — an exercise may carry its own rest duration overriding the global default, persisting per exercise across workouts. Storage is a research/planner decision requiring an additive migration (FNDN-02 pattern).
- D-09: While resting: persistent on-screen countdown with skip and ±15s adjust, PLUS a local notification + vibrate when it finishes, firing reliably with screen off (expo-notifications). Completing the next set restarts the timer.

**Finish / discard / summary**
- D-10: Finish summary shows duration, working-set volume (Σ weight×reps over non-warmup sets), and "PRs hit" — a lightweight check: heaviest weight and best estimated-1RM per exercise vs prior history. Full records table + PR feed remain Phase 4 (reuse the same est-1RM formula).
- D-11: Discarding an active workout requires a confirmation dialog (reuse Phase 1 archive-confirm pattern). Both finish and discard end the active-workout session.

**History & editing**
- D-12: History = chronological list + month calendar (HIST-01), with a workout detail view.
- D-13: Editing a past workout reuses the active-workout logging screen, opened in an editable state (edit sets/reps/weights/exercises). One consistent UI — no separate lighter editor (HIST-02).

**Units**
- D-14: Unit (kg/lb) is a global setting; set entry is in the active unit, values stored canonically in kg (`sets.weight_kg`). No per-set unit toggle. kg↔lb conversion + display rounding live in a pure, vitest-tested converter.

**Active-workout state & crash safety**
- D-15: The active-workout session lives in Zustand; every completed set is written to SQLite immediately (crash-safe). Reopening the app while a workout is in progress resumes it. The active workout is full-screen over the tabs and survives navigation + app kill (LOG-02).
- D-16: Exercises can be added, reordered, replaced, and removed during an active workout (LOG-04). Interaction details are planner discretion.

### Claude's Discretion
- Active-workout screen layout, exercise-card anatomy, reorder gesture, empty states.
- Storage location for the per-exercise rest override (D-08) — resolved below: `exercises.restSeconds`.
- Estimated-1RM formula for the Phase-2 PR check — resolved below: Epley, `weight * (1 + reps/30)`.
- Numeric-keypad input component choice; how the on-screen rest countdown is presented visually.

### Deferred Ideas (OUT OF SCOPE)
- Dropset / failure set-types and RPE entry — schema-ready but deferred within Phase 2.
- Templates & folders, plate calculator, warm-up suggestions → Phase 3.
- Program pointer advance + auto-backup on workout finish → Phase 6/7.
- Full records table, PR feed, estimated-1RM & volume charts → Phase 4 (Phase 2 computes only a lightweight in-summary PR check).
- A dedicated per-exercise "rest settings" management UI — Phase 2 keeps the override to a simple field.

### Open Flags from UI-SPEC (resolved or flagged below)
- FLAG-1: Replace-exercise mid-session — preserve slot/position, sets stay attached (data-model decision, see Pitfalls).
- FLAG-2: Per-exercise rest override storage — resolved: `exercises.restSeconds`.
- FLAG-3: Numeric keypad is a custom in-app bottom-sheet/panel component, not the OS keyboard (locked by UI-SPEC).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOG-01 | Start a workout (empty or from history), log sets ≤2 taps, pre-filled from last performance | D-01/D-06 query shape (Code Examples); numeric keypad + stepper pattern |
| LOG-02 | Every completed set persisted immediately; in-progress workout survives app kill/crash/restart | Crash-safe write pattern + cold-start resume query (Architecture Patterns, Pitfalls) |
| LOG-03 | Rest timer auto-starts on set completion; notification fires reliably with screen off | expo-notifications TIME_INTERVAL trigger + SCHEDULE_EXACT_ALARM permission (Code Examples, Pitfalls) |
| LOG-04 | Add, reorder, replace, remove exercises during an active workout | Hand-rolled gesture-handler+reanimated drag pattern; FLAG-1 replace-semantics decision |
| LOG-05 | Finish or discard workout with summary (duration, volume, PRs hit) | Volume/PR lib functions; discard = hard-delete cascade (Pitfalls) |
| LOG-06 | Enter weights in kg or lb; canonical kg storage | kg↔lb pure converter pattern (Code Examples) |
| HIST-01 | View workout history as list and calendar | Custom month-grid component (no new dependency), DB query by date range |
| HIST-02 | View and edit any past workout | D-13 mode distinction: `logging` vs `editing` in Zustand store (Pitfalls) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zustand | 5.0.14 | Active-workout ephemeral session state | Already pinned in CLAUDE.md; peer deps (`react>=18`, `use-sync-external-store>=1.2.0`) satisfied by installed React 19.2.3. Confirmed current on npm registry `[VERIFIED: npm registry]`. Not yet in `package.json` — needs adding this phase. |
| expo-notifications | 57.0.6 | Local rest-timer notification + vibrate | Matches Expo SDK 57 train exactly; confirmed current on npm registry `[VERIFIED: npm registry]`. Not yet in `package.json` — needs adding this phase via `npx expo install expo-notifications`. |
| react-native-gesture-handler | 3.1.0 | Drag-to-reorder exercise cards; long-press activation | Already present transitively in `node_modules` (pulled in by expo-router/reanimated peers) at exactly the pinned version, but **absent from `package.json`** as a direct dependency — must be added explicitly since Phase 2 code imports `Gesture.Pan`/`Gesture.LongPress` directly. Confirmed current on npm registry `[VERIFIED: npm registry]`. |
| react-native-reanimated | 4.5.2 (installed: 4.5.0) | Drives the drag-reorder shared values and rest-timer progress bar animation | Already a direct dependency; installed 4.5.0 vs current 4.5.2 — minor point bump, let `expo install` resolve during the phase's dependency-add step rather than hand-pinning. |
| drizzle-orm / drizzle-kit | 0.45.2 / 0.31.10 | Additive migration for `exercises.restSeconds` | Already the project's ORM/migration tool; no new package, just a new `drizzle-kit generate` run. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-file-system | not needed this phase | — | Deferred to Phase 7 (backup) — do not add now. |
| (none — numeric keypad) | — | Custom `NumericKeypad` component built from `Pressable` + `theme.ts` tokens | UI-SPEC FLAG-3 explicitly locks this to a hand-rolled component, not a third-party keypad package (`react-native-numeric-pad` etc. exist but add an unneeded dependency for a simple 3x4 grid). |
| (none — month calendar) | — | Custom grid `View`/`FlatList` component | UI-SPEC explicitly flags "no external calendar package" — build the 7-column grid by hand; this app's calendar need (a dot-marker month view) is far simpler than what calendar libraries solve for. |
| (none — draggable list) | — | Hand-rolled via existing gesture-handler + reanimated | UI-SPEC exercise-card note explicitly says "no new dependency; implement via react-native-gesture-handler+reanimated, both already in the stack." Third-party options exist (`react-native-draggable-flatlist`, `react-native-reorderable-list`) but are unnecessary given the primitives are already installed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand (no persist) rehydrated from SQLite | `zustand/middleware persist` + AsyncStorage/MMKV | Would create a second persistence layer that can drift from the SQLite source of truth (D-15 already solves crash-safety at the DB layer); only worth it if the app ever needs offline session state that isn't DB-backed, which it doesn't. |
| Hand-rolled drag-reorder | `react-native-draggable-flatlist` or `react-native-reorderable-list` | Both are legitimate, actively maintained libraries built on the exact same gesture-handler+reanimated primitives already in this stack — reasonable fallback if the hand-rolled implementation proves fragile in device testing, but adds a dependency for functionality the stack can already provide. |
| `exercises.restSeconds` nullable column | `workout_exercises.restSeconds` (per-session) | Rejected — CONTEXT.md D-08 explicitly requires the override to persist "per exercise across workouts," which is a property of the exercise, not a single session's join row. |
| Epley formula | Brzycki formula (`weight * 36 / (37 - reps)`) | Epley is the more commonly cited estimator in strength literature and is what StrengthLog's own public calculator uses (this app clones StrengthLog's feature set) `[CITED: strengthlog.com/1rm-calculator]`; Brzycki degrades faster outside the 1-10 rep range. Both are valid choices — Epley is recommended for consistency with the app's reference product, not because Brzycki is wrong. |

**Installation:**
```bash
npx expo install zustand expo-notifications
npm install --save-exact react-native-gesture-handler@3.1.0
npx expo install react-native-reanimated
npx drizzle-kit generate
```

**Version verification:** Verified via `npm view <pkg> version` against the npm registry on 2026-07-21:
- `zustand` → 5.0.14 (matches CLAUDE.md)
- `expo-notifications` → 57.0.6 (matches CLAUDE.md)
- `react-native-gesture-handler` → 3.1.0 (matches CLAUDE.md; also confirmed present in `node_modules` transitively at this exact version)
- `react-native-reanimated` → 4.5.2 registry-current vs 4.5.0 installed (both within CLAUDE.md's pinned major; let `expo install` reconcile)

## Package Legitimacy Audit

| Package | Registry | Age (last publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|-----------|--------------|---------|-------------|
| zustand | npm | published 2026-05-28 | ~45.8M/wk | github.com/pmndrs/zustand | OK | Approved |
| expo-notifications | npm | published 2026-07-17 (4 days before this research) | ~3.3M/wk | github.com/expo/expo | SUS (`too-new`) | Approved — see note below |
| react-native-gesture-handler | npm | published 2026-07-17 (4 days before this research) | ~5.7M/wk | github.com/software-mansion/react-native-gesture-handler | SUS (`too-new`) | Approved — see note below |

**Note on the two `SUS` verdicts:** both flags fired solely on the `too-new` signal (days since last publish), not on download count, repo absence, or postinstall scripts (`postinstall: null` for both). Both packages are official, high-download (millions/week), actively-maintained packages from well-known maintainers (Expo org, Software Mansion) that release in lockstep with the Expo SDK train — a 4-day-old publish is expected and healthy for this ecosystem, not a slopsquatting signal. `[VERIFIED: npm registry]` for existence/version; the package **names** themselves are `[ASSUMED]` in the sense that they were sourced from CLAUDE.md's pre-existing stack table (training-data-informed), not freshly discovered via search this session — the planner should still gate the first `npm install`/`expo install` of these two packages behind a `checkpoint:human-verify` task per the legitimacy protocol, purely as a mechanical gate, not because there is genuine suspicion here.

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious [SUS]:** `expo-notifications`, `react-native-gesture-handler` — planner must add a `checkpoint:human-verify` task before the install step for these two (mechanical gate; both are almost certainly legitimate per the analysis above).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Workout tab (app/(tabs)/index.tsx)                                  │
│  On mount: query SQLite for workouts WHERE finished_at IS NULL       │
│  ┌─────────────┐   ┌────────────────┐   ┌─────────────────────┐     │
│  │ No session  │   │ No session,    │   │ Active session found │     │
│  │ + history   │   │ zero history   │   │ → "Resume workout"   │     │
│  └──────┬──────┘   └───────┬────────┘   └──────────┬───────────┘     │
│         │ tap "Start empty"/"Start from history"    │ tap card       │
└─────────┼──────────────────────────────────────────┼─────────────────┘
          ▼                                            ▼
   ┌────────────────────────────────────────────────────────────┐
   │  INSERT workouts row (started_at=now)                       │
   │  [from-history] copy exercise list → INSERT workout_exercises│
   │  Zustand: setActiveWorkoutId(id) — session state only        │
   └───────────────────────────┬───────────────────────────────┘
                                ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Active-workout screen (sibling Stack.Screen, full-screen)   │
   │                                                                │
   │  For each exercise card:                                     │
   │    query last-performance sets (D-06) → pre-fill weight/reps │
   │    render set rows: [-][number][+]  [-][number][+]  [✓]       │
   │                                                                │
   │  Tap ✓  ──► INSERT sets row (weight_kg, reps, completed_at)  │
   │             │         (SQLite write — crash-safe, D-15)       │
   │             ▼                                                 │
   │        Zustand mirrors: mark set row completed (render only) │
   │             │                                                 │
   │             ▼                                                 │
   │        Start/restart rest timer:                              │
   │          - Zustand: restEndsAt = now + (override ?? default)  │
   │          - expo-notifications: scheduleNotificationAsync       │
   │            (cancel previous scheduled id first)                │
   │             │                                                 │
   │             ▼                                                 │
   │        On-screen countdown ticks from restEndsAt (recomputed  │
   │        from wall-clock, not a decrementing counter — survives │
   │        backgrounding without drift)                            │
   │                                                                │
   │  Skip / ±15s ──► cancel + reschedule notification, update     │
   │                   restEndsAt in Zustand                        │
   │                                                                │
   │  Add/Replace/Remove exercise ──► INSERT/UPDATE/DELETE          │
   │    workout_exercises (+ cascade sets on remove-with-sets)       │
   │                                                                │
   │  Reorder (drag) ──► UPDATE workout_exercises.position (batch)  │
   └───────────────────────────┬────────────────┬─────────────────┘
                    tap Finish  │                │  tap Discard
                                ▼                ▼
                 ┌───────────────────┐  ┌───────────────────────┐
                 │ UPDATE workouts    │  │ Confirm dialog, then:  │
                 │  SET finished_at   │  │ DELETE sets, THEN      │
                 │ Compute duration,  │  │ workout_exercises,     │
                 │ volume, PRs (pure  │  │ THEN workouts row      │
                 │ lib/ functions)    │  │ (transaction, cascade) │
                 └─────────┬─────────┘  └───────────┬────────────┘
                            ▼                        ▼
                   Finish/summary screen      Workout tab (no session)
                            │
                            ▼
                   Zustand: clearActiveWorkout()
                            │
                            ▼
                   Workout tab (no session)

┌─────────────────────────────────────────────────────────────────────┐
│  History tab: List | Calendar toggle                                  │
│  query workouts WHERE finished_at IS NOT NULL ORDER BY started_at DESC│
│  tap row → workout detail (read-only) → "Edit" reopens active-workout │
│  screen with mode='editing', workoutId=<past id> (D-13)               │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
app/
├── active-workout/          # new sibling route group (outside (tabs))
│   ├── _layout.tsx           # Stack, headerShown: false
│   └── [workoutId].tsx       # single screen, mode inferred from Zustand/route param
├── (tabs)/
│   ├── index.tsx              # replaced: Workout tab start/resume screen
│   ├── history/
│   │   ├── _layout.tsx        # Stack (list/calendar + detail, mirrors exercises/_layout.tsx)
│   │   ├── index.tsx          # List | Calendar toggle screen
│   │   └── [workoutId].tsx    # read-only detail + "Edit" CTA
│   └── settings.tsx           # add Units + Default rest rows
db/
├── workouts.ts                # new data layer, mirrors db/exercises.ts conventions
├── workouts.query.test.ts     # DB-layer tests (better-sqlite3 in-memory, mirrors exercises.query.test.ts)
├── workouts.crud.test.ts
lib/
├── estimate1RM.ts             # Epley formula, pure, vitest-tested — reused by Phase 4
├── estimate1RM.test.ts
├── weightUnits.ts             # kg<->lb conversion + rounding, pure, vitest-tested
├── weightUnits.test.ts
├── volume.ts                  # Σ weight×reps over non-warmup sets, pure
├── volume.test.ts
├── prDetection.ts             # heaviest weight + best est-1RM vs prior history, pure
├── prDetection.test.ts
store/
└── activeWorkout.ts            # Zustand store — session state only, NOT persisted
components/
├── SetRow.tsx                  # weight/reps steppers + ✓ button
├── NumericKeypad.tsx            # custom bottom-panel keypad (FLAG-3)
├── ExerciseCard.tsx              # drag handle, header, set rows, add-set ghost row
├── RestTimerBar.tsx              # sticky bottom bar, countdown, skip/±15s
├── WorkoutRow.tsx                 # History list row (mirrors ExerciseRow.tsx)
└── MonthCalendar.tsx               # custom 7-column grid (no new dependency)
```

### Pattern 1: Cold-start resume detection (LOG-02)
**What:** On Workout-tab mount (and nowhere else), query SQLite for an unfinished workout.
**When to use:** App boot / Workout-tab focus — not on every navigation, since Zustand already holds `activeWorkoutId` once the session is loaded once per app lifetime.
**Example:**
```typescript
// db/workouts.ts
import { and, desc, isNull } from 'drizzle-orm';

export async function findResumableWorkout(db: AnyDrizzleDb) {
  const [row] = await db
    .select()
    .from(workouts)
    .where(isNull(workouts.finishedAt))
    .orderBy(desc(workouts.startedAt))
    .limit(1);
  return row; // undefined if none in progress
}
```
```typescript
// app/(tabs)/index.tsx — run once, mirrors the Phase 1 useFocusEffect reload pattern
useEffect(() => {
  if (activeWorkoutId != null) return; // Zustand already has it this session
  findResumableWorkout(db).then((row) => {
    if (row) setActiveWorkoutId(row.id);
  });
}, [activeWorkoutId]);
```
`[ASSUMED — pattern synthesized from D-15's requirement + existing db/exercises.ts query conventions, not from an external source]`

### Pattern 2: Last-performance pre-fill query (D-06)
**What:** Find the most recent workout_exercise instance of a given exercise (across all history), then load its sets.
**When to use:** Rendering any exercise card that doesn't yet have a completed set this session — both fresh "blank" starts and "from history" starts (D-05).
**Example:**
```typescript
// db/workouts.ts
import { asc, desc, eq } from 'drizzle-orm';

export async function loadLastPerformance(db: AnyDrizzleDb, exerciseId: number) {
  const [latest] = await db
    .select({ weId: workoutExercises.id })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workoutExercises.workoutId, workouts.id))
    .where(eq(workoutExercises.exerciseId, exerciseId))
    .orderBy(desc(workouts.startedAt), desc(workoutExercises.id))
    .limit(1);

  if (!latest) return [];

  return db
    .select()
    .from(sets)
    .where(eq(sets.workoutExerciseId, latest.weId))
    .orderBy(asc(sets.setNumber));
}
```
`[ASSUMED — synthesized query shape following db/exercises.ts's parameterized Drizzle conventions; not verified against Context7 (unavailable this session)]`. Note: only `workout_exercises` rows belonging to *finished* workouts should be eligible — join-filter on `workouts.finishedAt IS NOT NULL` if the active/unfinished workout itself already has this exercise added with no sets yet (avoids pre-filling from an empty in-progress row).

### Pattern 3: Rest-timer scheduling with cancel/reschedule (D-09, LOG-03)
**What:** A single "active rest" notification id tracked in Zustand; every skip/±15s/next-set-completion cancels the outstanding scheduled notification and reschedules a new one against the updated end time.
**When to use:** Any time the rest end-time changes.
**Example:**
```typescript
// lib/restTimer.ts (thin wrapper — not pure, calls expo-notifications)
import * as Notifications from 'expo-notifications';

export async function scheduleRestNotification(seconds: number): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Rest complete', body: 'Time for your next set.', sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

export async function cancelRestNotification(id: string | null): Promise<void> {
  if (id) await Notifications.cancelScheduledNotificationAsync(id);
}
```
`[CITED: docs.expo.dev/versions/latest/sdk/notifications]` for the `scheduleNotificationAsync`/`TIME_INTERVAL` trigger shape and `cancelScheduledNotificationAsync` API surface.

Store `restEndsAt` (a timestamp, not a countdown integer) in Zustand so the on-screen bar recomputes remaining seconds from `restEndsAt - Date.now()` on every render tick — this avoids drift if the JS timer is throttled while backgrounded, since the notification (OS-scheduled) and the on-screen bar (wall-clock-derived) are both anchored to the same absolute time rather than a decrementing counter that can desync.

### Pattern 4: Additive migration for D-08 (rest override)
**What:** One nullable column on `exercises`, following the exact FNDN-02 precedent.
**When to use:** First task of the phase — this unblocks every screen that reads/writes the rest-override pill.
**Example:**
```typescript
// db/schema.ts — add to the existing exercises table definition
restSeconds: int('rest_seconds'), // nullable; null = use settings.default_rest_seconds
```
Then: `npx drizzle-kit generate` produces the next-numbered migration (e.g. `0002_*.sql`, following the `0000`/`0001` precedent already in `drizzle/`) containing `ALTER TABLE exercises ADD COLUMN rest_seconds integer;`. No data migration needed (new column defaults to `NULL` for all existing rows — exactly the "additive, non-destructive" pattern `db/migrations.test.ts` already proves for the Phase 1 index migration). Extend `db/migrations.test.ts`'s upgrade-test pattern (`applyMigrationsUpTo`) to cover this new migration if the plan wants an explicit FNDN-02-style regression test for it.

### Pattern 5: Settings read-with-fallback (units, default rest)
**What:** `settings` is a bare key-value table with only `seed_version` populated today; Phase 2 needs `units` and `default_rest_seconds` keys that may not exist yet for existing installs.
**Example:**
```typescript
// db/settings.ts
export async function getSetting(db: AnyDrizzleDb, key: string): Promise<string | null> {
  const [row] = await db.select().from(settings).where(eq(settings.key, key));
  return row?.value ?? null;
}

// callers apply their own typed fallback, e.g.:
const units = (await getSetting(db, 'units')) ?? 'kg';
const defaultRestSeconds = Number((await getSetting(db, 'default_rest_seconds')) ?? 90);
```
`[ASSUMED — synthesized from the existing db/seed/runSeed.ts key-value pattern for seed_version]`

### Anti-Patterns to Avoid
- **Zustand `persist` + AsyncStorage/MMKV for the active session:** redundant with D-15's SQLite-first crash safety; creates a second source of truth that can drift. Use plain Zustand + SQLite rehydration on boot instead.
- **Countdown as a decrementing integer in state:** drifts under JS timer throttling when backgrounded. Store an absolute `restEndsAt` timestamp and derive remaining time by subtraction on each render/tick.
- **Adding a third-party draggable-list or calendar package:** both UI-SPEC and this project's established pattern explicitly reject new dependencies where the existing stack (gesture-handler + reanimated for drag; plain `View`/`FlatList` for calendar) already covers the need.
- **Per-keystroke SQL on the numeric keypad:** mirror the Phase 1 `lib/exerciseFilter.ts` precedent — keypad input updates in-memory component state; only the final ✓ tap (or edit-mode blur) writes to SQLite.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Local scheduled notification delivery | A custom AlarmManager bridge or setTimeout-based "notification" | `expo-notifications` `scheduleNotificationAsync` + `TIME_INTERVAL` trigger | OS-level exact-alarm scheduling requires native permission handling (`SCHEDULE_EXACT_ALARM`) that a JS-only timer cannot replicate while backgrounded/killed. |
| kg↔lb conversion + plate-loadable rounding | Ad-hoc inline `* 2.20462` scattered across screens | One pure `lib/weightUnits.ts` function, vitest-tested | D-14 requires canonical kg storage with consistent display rounding everywhere (set rows, summary, PR copy, history) — a single function is the only way to guarantee consistency and testability. |
| Estimated 1RM | A bespoke formula invented for this app | Epley's formula (`weight * (1 + reps/30)`), the same one Phase 4 will use | CONTEXT.md explicitly requires Phase 2 and Phase 4 to share the identical formula; a single `lib/estimate1RM.ts` module is the only way to enforce that structurally rather than by convention. |
| Migration file authoring | Hand-written `ALTER TABLE` SQL files | `drizzle-kit generate` against the updated `db/schema.ts` | Matches the exact FNDN-02 precedent already established in Phase 1; hand-written SQL would drift from the `meta/_journal.json` snapshot Drizzle's migrator depends on. |

**Key insight:** every "don't hand-roll" here is really the same principle applied three times — this app already has a working pattern (pure `lib/` functions with vitest, drizzle-kit-generated migrations, parameterized Drizzle queries) from Phase 1, and Phase 2's job is to extend that pattern to new tables/columns, not invent parallel mechanisms.

## Runtime State Inventory

Not applicable — Phase 2 is purely additive (new tables/columns/routes), not a rename/refactor/migration of existing identifiers. No OS-registered state, stored external-service config, or secrets are touched. **None found** — verified by reviewing `db/schema.ts` (only new columns/usage, no renames) and `app.json`/`CLAUDE.md` (no naming changes this phase).

## Common Pitfalls

### Pitfall 1: Confusing "resume in-progress workout" with "edit a finished workout"
**What goes wrong:** Both flows reopen the same active-workout screen (D-13), but they have different write semantics — logging mode inserts new `sets` rows on ✓ tap; editing mode updates already-completed rows. If the screen doesn't carry an explicit `mode: 'logging' | 'editing'` flag, a stray ✓ tap during an edit session could insert a duplicate set instead of updating the existing one.
**Why it happens:** The cold-start resume query (`finished_at IS NULL`) only detects genuinely in-progress workouts. A user editing a *finished* workout who kills the app mid-edit will NOT be auto-resumed on relaunch (the workout already has `finished_at` set), so any unsaved-in-memory edit state is lost — but since D-15's crash-safety guarantee only explicitly covers "in-progress workout survives app kill," this is arguably in-spec as long as each field edit writes to SQLite as it happens (not batched), matching D-15's "every completed set written immediately" principle extended to edits.
**How to avoid:** Pass `workoutId` + an explicit `mode` into the active-workout route (`/active-workout/[workoutId]?mode=edit` vs a fresh insert for logging mode); write edit-mode field changes on change/blur (not on a single "save" tap) so a kill mid-edit only loses the last unsaved keystroke, not the whole edit session.
**Warning signs:** Duplicate `sets` rows for the same `(workout_exercise_id, set_number)` after an edit session; UAT report of "editing a past set and it added a new set instead."

### Pitfall 2: Discard must actually delete, not soft-archive
**What goes wrong:** The exercises-table precedent (D-11) is soft-archive-only, no hard delete. It would be easy to copy that pattern for "discard workout." But the UI-SPEC's copy contract is explicit: *"All sets logged in this session will be deleted. This can't be undone."* That's a hard delete, not a status flag.
**Why it happens:** Pattern-matching the more recently-touched exercises code (archive/unarchive) instead of re-reading the discard copy contract.
**How to avoid:** `discardWorkout(db, workoutId)` must run a transaction that deletes `sets` → `workout_exercises` → `workouts` in FK-safe order (children before parent), matching the copy's "can't be undone" promise exactly.
**Warning signs:** Discarded workouts still appearing in History; orphaned `sets`/`workout_exercises` rows after a discard.

### Pitfall 3: Replace-exercise mid-session and existing logged sets (FLAG-1)
**What goes wrong:** UI-SPEC assumes "preserves the slot, sets stay attached to the position," but a naive `UPDATE workout_exercises SET exercise_id = ?` on an already-partially-logged card would silently reattach *already-completed sets for the old exercise* to the new exercise — corrupting history for both exercises' PR/volume computations.
**Why it happens:** "Replace" sounds like a simple in-place swap, but `sets` rows reference `workout_exercise_id`, and `workout_exercises` rows reference `exercise_id` — swapping the parent's `exercise_id` retroactively reattributes all child `sets` to the new exercise.
**How to avoid:** Recommend: replacing an exercise with **zero completed sets** on that card is a safe in-place `UPDATE exercise_id`; replacing an exercise **with completed sets already logged** should either (a) be disallowed (remove + re-add as a new card instead), or (b) explicitly warn the user their logged sets on that slot will now count toward the new exercise's history — this needs a planner decision, not just an engineering default. Flag as an Open Question below.
**Warning signs:** An exercise's PR/history/volume shows values that don't match its actual training log after a mid-session replace.

### Pitfall 4: Rest-timer countdown drift when backgrounded
**What goes wrong:** If the on-screen countdown is implemented as `setInterval(() => setSeconds(s => s - 1), 1000)`, RN's JS timers are throttled/paused when the app backgrounds, so the on-screen number can be badly wrong (or frozen) when the user returns, even though the OS-scheduled notification fired correctly on time.
**Why it happens:** JS-thread timers are not wall-clock-anchored by default.
**How to avoid:** Anchor to an absolute `restEndsAt` timestamp (Pattern 3 above); recompute `Math.max(0, restEndsAt - Date.now())` every tick and on `AppState` foreground transitions, never decrement a counter.
**Warning signs:** Countdown showing a stale/negative/frozen value after backgrounding and returning to the app.

### Pitfall 5: Android 13+ notification permission prompt never appears
**What goes wrong:** Calling `requestPermissionsAsync()` before creating a notification channel silently fails to show the system permission dialog on Android 13+, so the app appears to have "asked" but the user never saw a prompt — LOG-03's "notification fires reliably" then silently can't work at all.
**Why it happens:** Documented ordering requirement: the notification channel must exist before the permission request is made on Android 13+ `[CITED: GitHub expo/expo#19043, community reports]`.
**How to avoid:** Call `Notifications.setNotificationChannelAsync(...)` once at app startup (or lazily before the first scheduled rest notification), before ever calling `requestPermissionsAsync()`.
**Warning signs:** `requestPermissionsAsync()` resolves with `granted: false` and no dialog was ever visibly shown during manual testing.

### Pitfall 6: SCHEDULE_EXACT_ALARM denied by default on Android 14+
**What goes wrong:** Even with the permission declared in `app.json`, Android 14+ denies `SCHEDULE_EXACT_ALARM` by default unless the app is a clock/calendar app category, silently downgrading to an inexact alarm that can drift by minutes — directly undermining "fires reliably."
**Why it happens:** Platform policy change in Android 14, not an app bug `[MEDIUM confidence, WebSearch-sourced, not cross-verified against a primary Android source this session]`.
**How to avoid:** The UI-SPEC already anticipates this with its "Notifications are off" inline banner copy — extend that same non-blocking-banner pattern to also detect (via `Notifications.getPermissionsAsync()` combined with, if determinable, the exact-alarm grant state) and surface "the timer still counts down on screen, but won't alert precisely" rather than assuming the permission grant is permanent once obtained. **This must be device-tested with the screen off per CLAUDE.md's existing gotcha note** — do not trust an emulator or a granted-permission check alone.
**Warning signs:** Rest notification firing several minutes late on a real Android 14 device despite the permission being "granted" at install time.

## Code Examples

### kg to lb conversion with plate-loadable rounding (D-14)
```typescript
// lib/weightUnits.ts — pure, zero RN imports (mirrors lib/exerciseName.ts convention)
const KG_TO_LB = 2.20462;

export function kgToDisplay(weightKg: number, unit: 'kg' | 'lb'): number {
  if (unit === 'kg') {
    return Math.round(weightKg * 2) / 2; // nearest 0.5 kg
  }
  return Math.round(weightKg * KG_TO_LB); // nearest whole lb
}

export function displayToKg(displayValue: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? displayValue : displayValue / KG_TO_LB;
}
```
`[ASSUMED — rounding convention synthesized from UI-SPEC's "nearest 0.5 kg or nearest whole lb (standard plate-loadable increments)" instruction, not independently sourced]`

### Estimated 1RM (D-10, shared with Phase 4)
```typescript
// lib/estimate1RM.ts
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}
```
`[CITED: strengthlog.com/1rm-calculator + multiple cross-referenced strength-training sources]` for the formula itself; the `reps<=1` short-circuit is `[ASSUMED]` — a common convention, not verified against a single canonical source, and should be confirmed as acceptable during plan review since it slightly changes behavior at the boundary (a true 1-rep set at weight W returns exactly W instead of W×1.033).

### Volume (working sets only, D-10)
```typescript
// lib/volume.ts
export function workingSetVolume(completedSets: { weightKg: number; reps: number; type: string }[]): number {
  return completedSets
    .filter((s) => s.type !== 'warmup')
    .reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Victory Native v36 web-style API | Victory Native XL (Skia/Reanimated rewrite) | n/a this phase | Not used in Phase 2 (charts are Phase 4) — noted only to avoid confusion if any Phase 2 code accidentally reaches for chart imports. |
| Expo Go for all development | `expo-dev-client` custom dev client, mandatory once `expo-sqlite`+Drizzle is wired (already true since Phase 1) | Already in effect | `expo-notifications` and `react-native-gesture-handler` native modules added this phase reinforce the existing constraint — continue building/testing via the dev client, never Expo Go. |

**Deprecated/outdated:** none newly identified this phase beyond what CLAUDE.md already documents (legacy Victory Native v36, Expo Go post-Drizzle).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | Cold-start resume query pattern (`workouts` row with `finished_at IS NULL`, ordered by `started_at DESC LIMIT 1`) | Architecture Patterns, Pattern 1 | Low — straightforward SQL, easily testable in a DB-layer vitest; wrong ordering would only matter if two workouts were ever unfinished simultaneously, which the UI-SPEC's single-session model prevents. |
| A2 | Last-performance query shape (join through `workout_exercises` → `workouts`, order by `started_at DESC`) | Architecture Patterns, Pattern 2 | Medium — if wrong, pre-fill could pull from the wrong session or double-count an in-progress workout's own just-logged sets; must be covered by a DB-layer test with multiple historical sessions. |
| A3 | `reps<=1` short-circuit in `estimate1RM` returns `weight` unchanged instead of `weight*1.0333` | Code Examples | Low-medium — a defensible convention but not independently verified; if the planner/user wants Epley applied uniformly including at reps=1, this line should be removed. Flag for confirmation. |
| A4 | Settings key-value fallback defaults (`units='kg'`, `default_rest_seconds=90`) when the `settings` table has no matching row for an existing install | Architecture Patterns, Pattern 5 | Low — reasonable UX defaults, but the exact default rest seconds value (90) is not specified anywhere in CONTEXT.md/UI-SPEC and should be confirmed as a real default, not just a placeholder. |
| A5 | Doze-mode risk assessment: locally-scheduled exact alarms are materially more reliable than the FCM-push Doze issues found in expo GitHub issues | Common Pitfalls, Pitfall 6 | Medium — if wrong, the "fires reliably with screen off" requirement (LOG-03) could fail in the field despite passing casual testing; this is exactly why CLAUDE.md and this research both insist on real-device screen-off testing before shipping, not just code review. |
| A6 | Replace-exercise-with-logged-sets handling (Pitfall 3) is left as an open planner decision rather than a fixed recommendation | Common Pitfalls, Pitfall 3 | Medium — if the planner picks silently-reattribute-history without flagging it, PR/volume data could be silently wrong for two exercises after any mid-session replace with prior sets. |

## Open Questions

1. **Replace-exercise-with-already-logged-sets semantics (FLAG-1 / Pitfall 3)**
   - What we know: UI-SPEC assumes slot-position preservation; the DB schema makes a naive `UPDATE exercise_id` retroactively reattribute already-completed sets to the new exercise.
   - What's unclear: whether the product intent is (a) disallow replace once sets exist on that card (force remove+re-add), or (b) allow it with an explicit warning that logged sets will count toward the new exercise.
   - Recommendation: planner should pick (a) — disallow/require a confirm-with-explanation dialog — as the safer default; consistent with this app's existing "confirm only when data is actually at risk" pattern from the UI-SPEC's copywriting contract.

2. **Default rest-seconds value**
   - What we know: `settings.default_rest_seconds` needs a fallback when absent; UI-SPEC's Settings-row example shows "Default rest: 90s" as illustrative copy.
   - What's unclear: whether 90s is a locked default or just placeholder UI-SPEC copy.
   - Recommendation: treat 90 as the default (matches the UI-SPEC's own example number) unless the user says otherwise during plan review.

3. **Notification permission denial UX beyond the inline banner**
   - What we know: UI-SPEC already specifies a non-blocking inline banner for denied notification permission.
   - What's unclear: whether the app should also detect/surface the Android 14+ exact-alarm-specific denial (separate from the general POST_NOTIFICATIONS permission) with different copy, since the on-screen effect (late/imprecise firing) differs from a fully-denied notification (no firing at all).
   - Recommendation: out of scope to fully resolve in Phase 2 given expo-notifications' JS API does not cleanly expose exact-alarm-grant state separately from general notification permission; flag as a known limitation, rely on the general banner, and note in the finish-summary/pitfall list for future hardening (matches the design spec's Phase 7 "notification hardening" polish phase).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Build tooling, vitest, drizzle-kit | ✓ | v24.18.0 | — |
| npm | Package installs | ✓ | (bundled with Node 24) | — |
| zustand (npm registry) | Session state (D-15) | ✓ (registry-verified, not yet installed locally) | 5.0.14 | — |
| expo-notifications (npm registry) | Rest-timer notification (LOG-03) | ✓ (registry-verified, not yet installed locally) | 57.0.6 | — |
| react-native-gesture-handler | Drag-reorder (LOG-04) | ✓ (present in `node_modules` transitively at 3.1.0; not yet a direct dependency) | 3.1.0 | — |
| Physical Android device with screen-off testing capability | LOG-03 reliability verification (CLAUDE.md gotcha) | Not verifiable from this research session | — | Emulator testing is an explicitly documented non-substitute per CLAUDE.md; flag as a required manual step before phase close, not a coding task. |

**Missing dependencies with no fallback:** none — all required packages exist on the npm registry and are installable.
**Missing dependencies with fallback:** none blocking; the only genuine gap is the manual screen-off device test, which has no code fallback and must be performed by a human (matches existing CLAUDE.md guidance).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 (already configured, `vitest.config.ts`) |
| Config file | `vitest.config.ts` — Node environment, `**/*.test.ts`, no watch by default |
| Quick run command | `npx vitest run db/workouts.query.test.ts lib/estimate1RM.test.ts lib/weightUnits.test.ts` (or any single new test file) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| LOG-01 | Set logging is ≤2 taps, pre-fills from last performance | unit (pure) + DB-layer | `npx vitest run db/workouts.query.test.ts -t "loadLastPerformance"` | ❌ Wave 0 |
| LOG-02 | In-progress workout resumable after "crash" (fresh DB connection) | DB-layer | `npx vitest run db/workouts.query.test.ts -t "findResumableWorkout"` | ❌ Wave 0 |
| LOG-03 | Rest notification scheduling/cancel logic (not device delivery — that's manual) | unit (mocked expo-notifications) | `npx vitest run lib/restTimer.test.ts` | ❌ Wave 0 |
| LOG-03 (device) | Notification fires reliably with screen off | manual-only | N/A — physical device test, screen off, per CLAUDE.md gotcha | manual |
| LOG-04 | Add/reorder/replace/remove exercise mutates `workout_exercises` correctly | DB-layer | `npx vitest run db/workouts.crud.test.ts` | ❌ Wave 0 |
| LOG-05 | Discard hard-deletes cascade; finish computes duration/volume/PRs correctly | DB-layer + unit (pure) | `npx vitest run db/workouts.crud.test.ts lib/volume.test.ts lib/prDetection.test.ts` | ❌ Wave 0 |
| LOG-06 | kg↔lb conversion round-trips correctly with plate-loadable rounding | unit (pure) | `npx vitest run lib/weightUnits.test.ts` | ❌ Wave 0 |
| HIST-01 | History list + month-range query returns correct workouts | DB-layer | `npx vitest run db/workouts.query.test.ts -t "history"` | ❌ Wave 0 |
| HIST-02 | Editing a past workout updates existing rows, not duplicate inserts | DB-layer | `npx vitest run db/workouts.crud.test.ts -t "edit"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** run the single new/changed test file (`npx vitest run <file>`)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** full suite green + `tsc` clean before `/gsd-verify-work`, plus the manual device screen-off rest-timer pass before phase close (mirrors Phase 1's device re-UAT precedent)

### Wave 0 Gaps
- [ ] `db/workouts.ts` — new data layer (mirrors `db/exercises.ts`)
- [ ] `db/workouts.query.test.ts` — `findResumableWorkout`, `loadLastPerformance`, history list/range queries
- [ ] `db/workouts.crud.test.ts` — set insert/update, exercise add/reorder/replace/remove, discard cascade, finish
- [ ] `lib/estimate1RM.ts` + `.test.ts`
- [ ] `lib/weightUnits.ts` + `.test.ts`
- [ ] `lib/volume.ts` + `.test.ts`
- [ ] `lib/prDetection.ts` + `.test.ts`
- [ ] `lib/restTimer.ts` + `.test.ts` (mock `expo-notifications` — no device needed for the scheduling-logic unit test)
- [ ] `store/activeWorkout.ts` — Zustand store (state shape, no persistence)
- [ ] `drizzle/000X_*.sql` — new migration for `exercises.restSeconds`, plus extend `db/migrations.test.ts`'s upgrade harness to cover it

*(No existing test infrastructure gaps beyond new files — `vitest.config.ts` and `db/test/fixture.ts` already cover the DB-layer testing mechanism this phase reuses as-is.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|---------------------|
| V2 Authentication | No | No auth in this phase (Google Sign-In is Phase 7) |
| V3 Session Management | No | No server session; local app-state only |
| V4 Access Control | No | Single-user local app, no multi-tenant access boundaries |
| V5 Input Validation | Yes | Numeric keypad and free-text fields (workout notes, if any) must bound/validate input before writing to SQLite — mirror `db/exercises.ts`'s `assertValidName`/`assertValidNotes` length-bound pattern for any new free-text fields (e.g., workout name); numeric weight/reps entry should reject negative values and cap at a sane upper bound before insert. |
| V6 Cryptography | No | No secrets/crypto touched this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| SQL injection via raw string-built queries | Tampering | Already mitigated project-wide: Drizzle's parameterized query builder only, no string concatenation — continue that convention in `db/workouts.ts` exactly as `db/exercises.ts` demonstrates. |
| Unbounded free-text writes (workout name/notes) filling storage or breaking UI | Denial of Service (local) | Apply the same `MAX_NAME_LENGTH`/`MAX_NOTES_LENGTH` bound pattern from `db/exercises.ts` to any new free-text field in `db/workouts.ts`. |
| Overly-broad local notification permission requests | (not a STRIDE-classic threat, but a platform-trust concern) | Request only `POST_NOTIFICATIONS` + `SCHEDULE_EXACT_ALARM`, scoped to the rest-timer use case; do not request unrelated notification categories. |

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view <pkg> version`) — direct version verification for `zustand`, `expo-notifications`, `react-native-gesture-handler`, `react-native-reanimated`. `[VERIFIED: npm registry]`
- `gsd-tools query package-legitimacy check` — legitimacy signals (downloads, repo, postinstall, publish date) for `zustand`, `expo-notifications`, `react-native-gesture-handler`.
- This project's own codebase (`db/schema.ts`, `db/exercises.ts`, `db/test/fixture.ts`, `db/migrations.test.ts`, `db/seed/runSeed.ts`, `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/exercises/_layout.tsx`, `app/(tabs)/exercises/[id].tsx`, `app/(tabs)/exercises/index.tsx`, `components/ExerciseRow.tsx`, `theme.ts`, `vitest.config.ts`, `drizzle.config.ts`, `app.json`, `package.json`) — direct read of existing patterns this phase must extend.

### Secondary (MEDIUM confidence)
- `[CITED: docs.expo.dev/versions/latest/sdk/notifications]` (WebFetch, 2026-07-21) — `scheduleNotificationAsync`/`TIME_INTERVAL` trigger shape, notification channel setup, vibration pattern config, SCHEDULE_EXACT_ALARM declaration.
- `[CITED: strengthlog.com/1rm-calculator]` and cross-referenced strength-training sources (WebSearch) — Epley formula and its accuracy range.
- `[CITED: docs.expo.dev/router/basics/common-navigation-patterns]` and `docs.expo.dev/router/advanced/modals` (WebSearch summary) — sibling Stack.Screen full-screen-over-tabs pattern.
- GitHub `expo/expo#19043` and related discussion threads (WebSearch) — Android 13+ notification-channel-before-permission-request ordering requirement.

### Tertiary (LOW confidence)
- WebSearch summaries (not independently cross-checked against a primary source) for: Doze-mode reliability distinction between push and locally-scheduled exact alarms; drag-reorder gesture composition pattern; zustand+AsyncStorage persistence pattern (used here only to justify NOT using it); custom numeric-keypad component precedent. All flagged inline with `[ASSUMED]`/`[LOW confidence]` markers above — no Context7 MCP was available this session, so all "docs" kind questions in the research plan fell back to WebSearch/WebFetch rather than an authoritative library-docs provider.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every new package version cross-checked against the live npm registry and matches CLAUDE.md's existing pinned-stack table exactly.
- Architecture: MEDIUM — the crash-safety/resume/pre-fill query patterns are synthesized from the existing `db/exercises.ts` conventions and CONTEXT.md's explicit decisions (high confidence in the *shape*), but the exact Drizzle query text is `[ASSUMED]`, not verified against Context7 (unavailable this session) — the planner/executor should validate the exact query against a running DB-layer test before relying on it verbatim.
- Pitfalls: MEDIUM — the notification-permission-ordering and Doze-mode findings are WebSearch-sourced and cross-referenced across multiple results, but not verified against a single primary Android/Expo source in this session.

**Research date:** 2026-07-21
**Valid until:** ~30 days for the architecture/pitfall guidance (stable domain knowledge); ~7 days for exact `expo-notifications`/`react-native-gesture-handler` version numbers given Expo's frequent SDK-train release cadence — re-verify versions with `npm view` immediately before the install step if execution starts more than a week after this research date.
