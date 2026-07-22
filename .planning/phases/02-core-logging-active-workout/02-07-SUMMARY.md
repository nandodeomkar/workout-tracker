---
phase: 02-core-logging-active-workout
plan: 07
subsystem: ui
tags: [expo-router, react-native, sqlite, drizzle, history, calendar]

# Dependency graph
requires:
  - phase: 02-core-logging-active-workout (Plan 03)
    provides: loadWorkoutHistory, loadWorkoutsInMonth, loadWorkoutDetail, loadPriorBests, loadLastPerformance, startWorkout, addWorkoutExercise query/mutation layer
  - phase: 02-core-logging-active-workout (Plan 04)
    provides: active-workout screen's mode='editing' branch (updateSet on existing rows, never duplicate-insert)
  - phase: 02-core-logging-active-workout (Plan 06)
    provides: rest-timer suppression in editing mode
provides:
  - History tab (List + Calendar toggle) over finished workouts
  - Custom MonthCalendar component (7-column grid, zero new dependency)
  - WorkoutRow component (reused by History list and the Start-from-history picker)
  - Read-only workout detail screen with Edit CTA reopening the active-workout screen in editing mode
  - "Start from history" entry on the Workout tab (copies exercise list, pre-fills from each exercise's own last performance)
affects: [phase-04-stats-and-prs, phase-06-programs-and-progression]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route-group replacement of a single-file tab (history.tsx -> history/_layout.tsx + index.tsx + [workoutId].tsx), mirroring exercises/_layout.tsx"
    - "Hand-built 7-column calendar grid computed via Date.UTC month-boundary math, matching the DB query's own UTC bounds"
    - "Shared lib/duration.ts#formatDurationMs extracted so WorkoutRow and the history detail screen don't each inline their own duration formatter"

key-files:
  created:
    - components/WorkoutRow.tsx
    - components/MonthCalendar.tsx
    - lib/duration.ts
    - lib/duration.test.ts
    - app/(tabs)/history/_layout.tsx
    - app/(tabs)/history/index.tsx
    - app/(tabs)/history/[workoutId].tsx
  modified:
    - app/(tabs)/index.tsx

key-decisions:
  - "Extracted lib/duration.ts#formatDurationMs (Rule 2) instead of a third inline copy of summary.tsx's local duration formatter, since both WorkoutRow and the new history detail screen need identical m:ss/h:mm formatting"
  - "Added a minimal placeholder app/(tabs)/history/[workoutId].tsx during Task 2 (Rule 3) so expo-router's typed-routes graph included the route before Task 2's router.push('/history/{id}') calls could type-check; Task 3 replaced it with the full implementation"
  - "Calendar day-bucketing computed in UTC (getUTCFullYear/getUTCMonth/getUTCDate) to stay consistent with db/workouts.ts#loadWorkoutsInMonth's Date.UTC month-boundary query, avoiding an off-by-one-day mismatch near month boundaries in non-UTC timezones"
  - "When a calendar day has more than one finished workout (edge case), the first one found wins as the day's detail target - UI-SPEC doesn't disambiguate multi-workout days"

patterns-established:
  - "Duration formatting is now a shared lib/ pure function (formatDurationMs) rather than each screen inlining its own"

requirements-completed: [LOG-01, HIST-01, HIST-02]

# Metrics
duration: 18min
completed: 2026-07-22
---

# Phase 2 Plan 7: History Tab + Start-from-History Summary

**History tab (List + custom Calendar grid) with read-only workout detail, Edit reopening the active-workout screen in editing mode, and a "Start from history" entry that copies a past workout's exercise list and pre-fills each card from its own last performance**

## Performance

- **Duration:** 18 min
- **Started:** 2026-07-22T04:11:54Z
- **Completed:** 2026-07-22T04:29:01Z
- **Tasks:** 3
- **Files modified:** 8 (6 created, 2 modified; 1 file deleted and replaced by a route group)

## Accomplishments
- History tab replaced its "Coming soon" placeholder with a List/Calendar segmented toggle over finished workouts, both reloading on focus
- Read-only workout detail (duration/volume/PRs stat rows + per-exercise/per-set breakdown) with a single "Edit" CTA that reopens the active-workout screen in `mode='editing'` — no separate editor
- "Start from history" wired on the Workout tab: a picker (reusing `WorkoutRow`) that starts a new session, copies the picked workout's exercise list in order, and lets each card pre-fill independently from its own most-recent performance

## Task Commits

Each task was committed atomically:

1. **Task 1: WorkoutRow + MonthCalendar components** - `e0917b9` (feat)
2. **Task 2: History route group — list + calendar toggle** - `79a5aed` (feat)
3. **Task 3: Workout detail + Edit + Start-from-history** - `93a6be6` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `components/WorkoutRow.tsx` - History list row (glyph + name/date + "N exercises · volume · duration" caption + chevron), mirrors ExerciseRow anatomy
- `components/MonthCalendar.tsx` - Hand-built 7-column month grid with ‹/› nav and accent dots on workout days, zero new dependency
- `lib/duration.ts` / `lib/duration.test.ts` - Shared `formatDurationMs` (m:ss / h:mm) pure function + vitest coverage
- `app/(tabs)/history/_layout.tsx` - Stack layout for the History route group (mirrors exercises/_layout.tsx)
- `app/(tabs)/history/index.tsx` - List (loadWorkoutHistory) / Calendar (loadWorkoutsInMonth) segmented toggle
- `app/(tabs)/history/[workoutId].tsx` - Read-only workout detail + Edit CTA
- `app/(tabs)/index.tsx` - "Start from history" picker wired (was a non-interactive placeholder)
- `app/(tabs)/history.tsx` - Deleted (replaced by the `history/` route group)

## Decisions Made
- Extracted `lib/duration.ts#formatDurationMs` as a shared pure formatter (Rule 2) instead of a third inline duplicate of the Finish/summary screen's local formatter
- Calendar day bucketing uses UTC date components to exactly match `loadWorkoutsInMonth`'s `Date.UTC` month-boundary query
- A calendar day with more than one finished workout (edge case) navigates to whichever workout was found first for that day

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extracted `lib/duration.ts` shared duration formatter**
- **Found during:** Task 1 (WorkoutRow needed duration formatting; Task 3's detail screen needed the same logic)
- **Issue:** The plan's `files_modified` didn't list a duration-formatting helper, but `WorkoutRow` and the history detail screen both need identical m:ss/h:mm formatting, and `active-workout/summary.tsx` already has a local (unexported) copy of the same logic — a third inline copy would be silent duplication
- **Fix:** Added `lib/duration.ts#formatDurationMs` (pure, vitest-tested) and had both new files import it; did not touch `summary.tsx` (out of scope for this plan)
- **Files modified:** lib/duration.ts, lib/duration.test.ts
- **Verification:** `npx vitest run lib/duration.test.ts` (6 tests passed)
- **Committed in:** e0917b9 (Task 1 commit)

**2. [Rule 3 - Blocking] Added a placeholder `[workoutId].tsx` ahead of Task 3**
- **Found during:** Task 2 (History list/calendar `router.push('/history/{id}')` calls)
- **Issue:** With `expo-router`'s `typedRoutes` experiment enabled, `npx tsc --noEmit` requires the target route file to already exist in the router's generated type graph — Task 2's own verify step (`tsc --noEmit`) failed because `[workoutId].tsx` didn't exist yet (it's Task 3's deliverable)
- **Fix:** Added a minimal placeholder `app/(tabs)/history/[workoutId].tsx` (loading-only stub) in Task 2 so the route existed and typed-routes generation included it; regenerated router types via a short-lived `expo start` run, confirmed Task 2's `tsc --noEmit` passed, then Task 3 fully replaced the stub with the real read-only detail + Edit CTA implementation
- **Files modified:** app/(tabs)/history/[workoutId].tsx (stub in Task 2, replaced in full in Task 3)
- **Verification:** `npx tsc --noEmit` exits 0 after both Task 2 and Task 3
- **Committed in:** 79a5aed (Task 2 stub), 93a6be6 (Task 3 full implementation)

---

**Total deviations:** 2 auto-fixed (1 missing critical extraction, 1 blocking typed-routes sequencing)
**Impact on plan:** Both were necessary for correctness/tooling; no scope creep. The plan's three tasks describe the intended end state exactly — the deviations are about *how* to get there without breaking the `tsc --noEmit` gate mid-plan when two tasks have a route-graph dependency on each other.

## Issues Encountered
- `expo-router`'s typed-routes type file (`.expo/types/router.d.ts`) is generated by the Metro/dev-server process, not by a standalone CLI command in this Expo CLI version. Resolved by running `npx expo start` briefly (with a hard timeout) to trigger regeneration, then stopping it — `.expo/` is gitignored so this is a local dev artifact only, not committed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- HIST-01, HIST-02, and the LOG-01 "Start from history" (D-04) second start path are complete, closing out Phase 2's must-have truths for history browsing, editing, and the second start path
- Phase 2 (core-logging-active-workout) is now fully planned and executed across all 7 plans
- Human verification (physical Android device) is still required per this plan's `<verification>` block: List/Calendar toggle correctness, Edit round-trip (no duplicate sets, no rest-timer auto-start), and Start-from-history pre-fill behavior

---
*Phase: 02-core-logging-active-workout*
*Completed: 2026-07-22*
