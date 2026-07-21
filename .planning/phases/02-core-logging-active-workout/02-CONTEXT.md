# Phase 2: Core Logging (Active Workout) - Context

**Gathered:** 2026-07-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the in-gym logging loop that is the app's entire reason to exist: start a
workout (blank or from history) → log sets fast (≤2 taps, pre-filled from last
performance) → rest timer → add/reorder/replace/remove exercises → finish or
discard with a summary. Plus kg/lb entry (stored canonically in kg) and workout
history (chronological list + month calendar) with full edit of past workouts.

Every completed set is persisted to SQLite immediately so an in-progress workout
survives an app kill, crash, or phone restart. Requirements: LOG-01..06, HIST-01, HIST-02.

**Out of scope (later phases):** templates & folders, plate calculator, warm-up
suggestions (Phase 3); program pointer advance + auto-backup on finish (Phase 6/7);
full records table, PR feed, estimated-1RM charts (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Set-logging loop
- **D-01:** Tapping ✓ logs the set immediately using the pre-filled last-time weight/reps — one tap to repeat a set. Numbers are only touched when they change. This is the core speed target (LOG-01 "≤2 taps").
- **D-02:** Number entry combines ±2.5 kg / ±1 rep **steppers** (small nudges) with **tap-the-number → numeric keypad** (big jumps, e.g. 20→100 kg).
- **D-03:** Phase 2 set metadata = weight + reps + a per-set **warmup toggle** (warmups are excluded from volume and PR computation). Set-type `dropset`/`failure` and RPE are **deferred** — the `sets.type` and `sets.rpe` columns already exist but stay unused (default `type='normal'`) to keep the loop clean.

### Starting a workout
- **D-04:** Two start paths in Phase 2: **blank**, or **from history** (pick a past workout). Templates are Phase 3 and explicitly out of scope.
- **D-05:** "From history" copies the **exercise list** of the chosen past workout; each exercise's set rows then **pre-fill from that exercise's most recent performance** (across all history, not necessarily the picked workout) — consistent with the per-exercise pre-fill model.
- **D-06:** Pre-fill source for any exercise = its last completed performance (most recent `sets` for that `exercise_id`). Empty when the exercise has never been logged.

### Rest timer
- **D-07:** A **global default** rest duration (from `settings`) **auto-starts on ✓** (set completion).
- **D-08:** **Per-exercise custom rest override** — an exercise may carry its own rest duration that overrides the global default (some lifts need more rest), persisting per exercise across workouts. *Storage is a research/planner decision:* it needs an **additive migration** (likely a nullable rest-seconds column on `exercises`, or on `workout_exercises` if per-session) following the Phase 1 migration-safety pattern (FNDN-02).
- **D-09:** While resting: a **persistent on-screen countdown** in the active workout with **skip** and **±15s adjust**, PLUS a **local notification + vibrate** when it finishes that fires reliably with the screen off (expo-notifications). Completing the next set **restarts** the timer.

### Finish / discard / summary
- **D-10:** Finish summary shows **duration**, **working-set volume** (Σ weight×reps over non-warmup sets), and **"PRs hit"** — computed in Phase 2 as a lightweight check: heaviest weight and best estimated-1RM per exercise vs that exercise's prior history. The full records table + PR feed remain Phase 4 (reuse the same est-1RM formula).
- **D-11:** **Discarding** an active workout requires a confirmation dialog (reuse the Phase 1 archive-confirm pattern). Both finish and discard end the active-workout session.

### History & editing
- **D-12:** History = chronological **list** + **month calendar** (HIST-01), with a workout detail view.
- **D-13:** **Editing a past workout reuses the active-workout logging screen**, opened in an editable state (edit sets/reps/weights/exercises). One consistent UI — no separate lighter editor (HIST-02).

### Units
- **D-14:** Unit (kg/lb) is a **global setting**; set entry is in the active unit, values stored canonically in **kg** (`sets.weight_kg`). No per-set unit toggle. kg↔lb conversion + sensible display rounding live in a pure, vitest-tested converter.

### Active-workout state & crash safety (locked by spec — restated)
- **D-15:** The active-workout session lives in **Zustand**; every completed set is written to **SQLite immediately** (crash-safe). Reopening the app while a workout is in progress **resumes** it. The active workout is **full-screen over the tabs** and survives navigation + app kill (LOG-02).
- **D-16:** Exercises can be **added, reordered, replaced, and removed** during an active workout (LOG-04). Interaction details (drag-reorder, swap-in-place replace, remove-with-confirm) are planner discretion.

### Claude's Discretion
- Active-workout screen layout, exercise-card anatomy, reorder gesture, empty states.
- Storage location for the per-exercise rest override (D-08) — subject to research.
- Estimated-1RM formula for the Phase-2 PR check (e.g. Epley) — keep identical to the Phase-4 stats formula; flag in research.
- Numeric-keypad input component choice; how the on-screen rest countdown is presented visually.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design spec (locks architecture — read first)
- `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — approved design. Relevant: **§ Data model** (workouts/workout_exercises/sets), **§ Screens item 2 Active workout** (set rows `[weight][reps][✓]`, steppers ±2.5 kg/±1 rep, rest timer on set completion), **§ Screens item 3 History** (list + month calendar, editable past workouts), **§ Reliability** (crash-safe: every set write hits SQLite immediately, reopen resumes), **§ Testing** (pure-function tests; device pass for rest timer backgrounded).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — LOG-01..06, HIST-01, HIST-02 acceptance criteria.
- `.planning/ROADMAP.md` § Phase 2 — goal + 5 success criteria (2-tap logging, crash survival, backgrounded rest notification, add/reorder/replace/remove + summary, kg/lb + history + edit).

### Codebase
- `db/schema.ts` — existing `workouts` / `workout_exercises` / `sets` / `settings` tables. Note: `sets` already has `weight_kg`, `reps`, `type`, `rpe`, `completed_at`; per-exercise rest (D-08) likely needs a new additive column.
- `db/exercises.ts` — the Drizzle query/mutation-layer pattern the new workouts/sets data module should mirror (parameterized, driver-agnostic).
- `CLAUDE.md` — stack + constraints: **expo-notifications 57.0.6** with the **Android 12+ SCHEDULE_EXACT_ALARM + Doze** gotcha (LOG-03 — test with screen off on device), **Zustand 5.0.14**, expo-sqlite + Drizzle, victory-native (not needed this phase).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `db/exercises.ts` + `db/test/fixture.ts` (better-sqlite3 in-memory) — mirror for a new `db/workouts.ts` data layer and its DB-layer vitest tests (set-write persistence, pre-fill selection, volume/PR math).
- `theme.ts` tokens + `components/ExerciseRow.tsx`, `components/FilterChipRow.tsx`, `components/MuscleGroupPills.tsx`, `constants/muscleIcons.ts`, `constants/taxonomy.ts` — reuse for the in-workout exercise picker (add/replace exercise).
- Phase 1 confirm pattern (`Alert.alert` archive confirm in `app/(tabs)/exercises/[id].tsx`) — reuse for discard-workout (D-11).
- `useFocusEffect` reload pattern (Phase 1 GAP-3) — history list/detail should reflect edits on focus.
- `exercises/_layout.tsx` Stack pattern (Phase 1 GAP-4 fix) — apply to any new multi-screen route group (active workout / history) to avoid phantom tabs.

### Established Patterns
- Every set write hits SQLite immediately (D-15); Zustand mirrors DB for UI responsiveness. Session is reconstructable from the DB on cold start.
- Additive, versioned migrations (Phase 1 FNDN-02) — the per-exercise rest column (D-08) follows `drizzle-kit generate` + `useMigrations`.
- Pure logic in `lib/` with vitest, zero RN imports (kg↔lb, est-1RM, volume, PR detection, last-performance pre-fill selection).
- Android-first transient feedback via `ToastAndroid` (Phase 1 pattern in `[id].tsx`).

### Integration Points
- New active-workout route(s) mounted full-screen over the existing `(tabs)` shell (D-15) — the "Workout" tab (currently "Coming soon") becomes the start/active-workout entry; "History" tab hosts list+calendar.
- Reads from `exercises` (Phase 1 library) for the exercise picker; writes to `workouts`/`workout_exercises`/`sets`.

</code_context>

<specifics>
## Specific Ideas

- "Some exercises require more rest than others between sets" → per-exercise rest override (D-08), on top of a global default.
- One-tap repeat of the last set is the headline speed target (D-01) — the whole loop is optimized around not touching numbers that didn't change.

</specifics>

<deferred>
## Deferred Ideas

- Dropset / failure set-types and RPE entry — schema-ready (`sets.type`, `sets.rpe`) but deferred within Phase 2 to keep the loop fast.
- Templates & folders, plate calculator, warm-up suggestions → **Phase 3**.
- Program pointer advance + auto-backup on workout finish → **Phase 6 / 7**.
- Full records table, PR feed, estimated-1RM & volume charts → **Phase 4** (Phase 2 computes only a lightweight in-summary PR check).
- A dedicated per-exercise "rest settings" management UI — Phase 2 keeps the override to a simple field; richer management can come later.

</deferred>

---

*Phase: 02-core-logging-active-workout*
*Context gathered: 2026-07-21*
