---
phase: 04-stats-charts
plan: 03
subsystem: ui
tags: [victory-native, react-native-skia, drizzle, vitest, stacked-bar, expo-router]

# Dependency graph
requires:
  - phase: 04-02
    provides: victory-native/Skia chart wiring, db/stats.ts + AnyDrizzleDb convention, app/stats/[exerciseId].tsx per-exercise chart screen to route into
provides:
  - "lib/weeklyVolume.ts#getWeekStart + buildWeeklyVolume — UTC Monday-anchored week bucketing + per-week per-muscle-group tonnage reduction (D-12/D-13/D-15)"
  - "constants/statsChart.ts#MUSCLE_GROUP_KEYS + MUSCLE_GROUP_COLORS — index-aligned categorical palette, 'Other' last/muted (Pitfall 5)"
  - "db/stats.ts#loadWeeklyVolumeSets + loadExercisesWithSets — parameterized date-windowed volume query + distinct trained-exercise query"
  - "app/(tabs)/stats.tsx — overview dashboard shell (replaces placeholder): Section B weekly-volume stacked bar, Section C exercise picker, labelled Section A placeholder for Plan 04-04"
  - "theme.ts spacing['2xl']=32 — dashboard inter-section gap token"
affects: [04-04, 04-05, 04-06, stats-charts]

# Tech tracking
tech-stack:
  added: []
  patterns: ["victory-native XL CartesianChart+StackedBar for grouped weekly totals", "UTC Monday-anchored getWeekStart helper (mirrors lib/duration.ts single-helper convention, avoids the History-tab UTC-month drift lesson)", "zero-filled continuous week window computed independently of the fetched date range, so a sparse week still renders a 0 bar"]

key-files:
  created: [lib/weeklyVolume.ts, lib/weeklyVolume.test.ts, constants/statsChart.ts]
  modified: ["db/stats.ts", "db/stats.query.test.ts", "app/(tabs)/stats.tsx", "theme.ts"]

key-decisions:
  - "buildWeeklyVolume anchors its zero-filled weeksBack window to the current real date (new Date()), independent of which weeks actually have rows in the input — so a week with zero logged sets still renders as a 0 bar and the x-axis stays continuous (STAT-02 requirement), while a genuinely empty input (sets.length === 0) short-circuits to [] rather than returning a zero-filled window with no data at all"
  - "Section C exercise-picker row is a small inline Pressable row (icon + name + chevron) rather than reusing ExerciseRow, since loadExercisesWithSets intentionally returns only {id, name, muscleGroup} (no equipment) per the plan's query contract, and ExerciseRow's secondary line assumes an equipment value"
  - "loadExercisesWithSets dedupes in JS (Map keyed by exercise id) after a single joined SELECT, then sorts case-insensitively via localeCompare — mirrors db/templates.ts#loadFolderNames's precedent so the query stays identical across both Drizzle drivers"

patterns-established:
  - "Weekly-bucketing lib module (lib/weeklyVolume.ts) extends the existing pure-lib/query-layer split from Plan 02 to a group-by-week-then-group-by-category shape"

requirements-completed: [STAT-02]

# Metrics
duration: ~15min
completed: 2026-07-22
---

# Phase 4 Plan 03: Weekly Volume by Muscle Group + Exercise Picker (STAT-02) Summary

**Stats-tab overview dashboard replacing the placeholder — a Skia `CartesianChart`+`StackedBar` of weekly training tonnage by muscle group (Mon-Sun weeks, Other last/muted, display-unit axis) plus a searchable trained-exercise picker that opens Plan 02's per-exercise chart**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-22T23:20:12+05:30
- **Tasks:** 3 (2 TDD lib/query tasks + 1 screen task)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- `lib/weeklyVolume.ts#getWeekStart` — UTC Monday-anchored ISO week-start, Sunday maps to the same Monday as the preceding week (Mon-Sun, D-15); 10/10 tests green including the History-tab UTC-drift precedent
- `lib/weeklyVolume.ts#buildWeeklyVolume` — per-week per-muscle-group tonnage via `workingSetVolume`, zero-fills the requested `weeksBack` window so the chart x-axis stays continuous, `'Other'` bucketed like any other group (D-13)
- `constants/statsChart.ts` — `MUSCLE_GROUP_KEYS`/`MUSCLE_GROUP_COLORS`, index-aligned, `'Other'`/`#6B7280` last (Pitfall 5)
- `db/stats.ts#loadWeeklyVolumeSets` — parameterized `gte(startedAt, sinceIso)` window over finished workouts joined to `exercises.muscle_group`; `db/stats.ts#loadExercisesWithSets` — distinct trained exercises, excludes never-trained and unfinished-only exercises, case-insensitive name sort; 13/13 query tests green (5 pre-existing Plan 02 + 8 new)
- `app/(tabs)/stats.tsx` — full dashboard shell: `useFocusEffect` + cancelled-guard live load (D-11), Section B stacked bar with legend + empty state, Section C search + picker routing to `/stats/[exerciseId]` (D-03a second entry point), labelled placeholder comment for Plan 04-04's PR feed (no fake data)
- `theme.ts` — new `spacing['2xl'] = 32` inter-section token
- Full vitest suite (190 tests, 26 files) green; `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically (TDD RED→GREEN pairs for Tasks 1-2):

1. **Task 1: Week-bucketing + weekly-volume reduction + chart palette**
   - `06a8e64` (test) — failing test for getWeekStart/buildWeeklyVolume
   - `47558a9` (feat) — getWeekStart + buildWeeklyVolume implementation
2. **Task 2: Weekly-volume + trained-exercises queries (db/stats.ts append)**
   - `d792fa1` (test) — failing tests for loadWeeklyVolumeSets/loadExercisesWithSets
   - `2bc49f9` (feat) — loadWeeklyVolumeSets + loadExercisesWithSets implementation
3. **Task 3: Stats dashboard shell + weekly-volume chart + exercise picker** - `f1aea78` (feat)

## Files Created/Modified
- `lib/weeklyVolume.ts` - `getWeekStart(date)` + `buildWeeklyVolume(sets, weeksBack)` pure reduction; `WeeklyVolumeSet`/`WeeklyVolumeRow` types
- `lib/weeklyVolume.test.ts` - 10 tests: Mon/Sun boundary, mid-week, Date-vs-string input, UTC drift guard, per-group tonnage with warmup exclusion, zero-key presence, zero-filled window ordering, 'Other' bucketing
- `constants/statsChart.ts` - `MUSCLE_GROUP_KEYS` (reuses `taxonomy.ts`'s Other-last order) + `MUSCLE_GROUP_COLORS` categorical palette
- `db/stats.ts` - appended `loadWeeklyVolumeSets(db, sinceIso)` and `loadExercisesWithSets(db)` + `TrainedExercise` type
- `db/stats.query.test.ts` - appended 8 tests: 4 for `loadWeeklyVolumeSets` (empty DB, date-window scoping + muscle-group join, unfinished-workout exclusion, warmup rows returned), 4 for `loadExercisesWithSets` (empty DB, never-trained exclusion, unfinished-only exclusion, dedup + case-insensitive sort)
- `app/(tabs)/stats.tsx` - replaced "Coming soon" placeholder with the overview dashboard: Section B (weekly-volume stacked bar, legend, empty state) + Section C (search + picker)
- `theme.ts` - added `spacing['2xl'] = 32`

## Decisions Made
- `buildWeeklyVolume`'s zero-filled window is anchored to the real current date, not to the min/max of the input rows — so weeks with genuinely zero logged sets still render as a 0 bar (continuous x-axis), while a fully empty input returns `[]` per the plan's explicit "Empty input → `[]`" acceptance criterion.
- Section C's picker row is a small inline component rather than a reuse of `ExerciseRow`, since `loadExercisesWithSets`'s query contract intentionally omits `equipment` (not needed for the picker) and `ExerciseRow`'s secondary line assumes it.
- `loadExercisesWithSets` dedupes/sorts in JS (mirrors `loadFolderNames`) to keep the query driver-identical across `better-sqlite3` (tests) and `expo-sqlite` (device).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- STAT-02's weekly-volume-by-muscle-group slice is fully wired and demoable: opening the Stats tab shows a real stacked bar of the last 12 weeks' tonnage broken down by muscle group, with a legend and display-unit y-axis.
- D-03's second entry point (D-03a, the exercise picker) is complete — combined with Plan 02's "View progress" link (D-03b), both entry points into the per-exercise chart now exist.
- The dashboard shell (`app/(tabs)/stats.tsx`) has a clearly labelled placeholder where Plan 04-04 will insert Section A (recent PR feed) — no PR/record logic or mock data exists yet in this plan, by design.
- On-device human verification of the stacked bar (Other last/muted, legend accuracy, display-unit axis, empty state, picker navigation) is deferred to the phase gate per the plan's verification section — not yet performed in this plan.

---
*Phase: 04-stats-charts*
*Completed: 2026-07-22*

## Self-Check: PASSED

All created files verified present on disk; all task commits (`06a8e64`, `47558a9`, `d792fa1`, `2bc49f9`, `f1aea78`) verified in git log.
