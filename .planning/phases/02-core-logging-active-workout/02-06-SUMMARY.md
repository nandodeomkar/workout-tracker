---
phase: 02-core-logging-active-workout
plan: 06
subsystem: ui
tags: [expo-notifications, react-native, zustand, drizzle, rest-timer, active-workout]

# Dependency graph
requires:
  - phase: 02-core-logging-active-workout (Plan 01)
    provides: estimate1RM/workingSetVolume/detectPRs/weightUnits pure-function calculators
  - phase: 02-core-logging-active-workout (Plan 02)
    provides: exercises.rest_seconds column, settings.default_rest_seconds
  - phase: 02-core-logging-active-workout (Plan 03)
    provides: finishWorkout, discardWorkout, loadWorkoutDetail, loadPriorBests query helpers
  - phase: 02-core-logging-active-workout (Plan 04)
    provides: Zustand activeWorkout store (restEndsAt/restNotificationId fields), active-workout screen/route
  - phase: 02-core-logging-active-workout (Plan 05)
    provides: expo-notifications/gesture-handler install, ExerciseCard drag-reorder/overflow menu
provides:
  - lib/restTimer.ts expo-notifications scheduling wrapper (ensureNotificationChannel/requestRestPermission/scheduleRestNotification/cancelRestNotification)
  - components/RestTimerBar.tsx drift-free sticky countdown bar with -15s/+15s/Skip and denied-permission banner
  - Auto-start rest timer on set completion using per-exercise override or global default (D-07/D-08/D-09)
  - Per-exercise rest-override pill wired to exercises.rest_seconds via setExerciseRestOverride
  - app/active-workout/summary.tsx finish summary (duration/volume/PRs hit)
  - Finish (replace-navigate) and Discard (confirm + hard-delete) flows on the active-workout app-bar
affects: [03-templates-calculators, 04-stats, 08-polish]

# Tech tracking
tech-stack:
  added: [expo-notifications (already installed in Plan 05, first consumed here)]
  patterns:
    - "Absolute-timestamp countdown: RestTimerBar recomputes remaining = Math.max(0, restEndsAt - Date.now()) on a 1s wall-clock tick + AppState foreground listener, never a decrementing counter (Pitfall 4)"
    - "Notification channel-before-permission ordering: ensureNotificationChannel() always called before requestRestPermission() (Pitfall 5, Android 13+)"
    - "Notification scheduling failures are swallowed into non-blocking state (setRestNotificationId(null)) — LOG-03 must never gate logging"
    - "Finish navigates via router.replace (not push) to the summary screen so back cannot re-enter a finished session"

key-files:
  created:
    - lib/restTimer.ts
    - lib/restTimer.test.ts
    - components/RestTimerBar.tsx
    - app/active-workout/summary.tsx
  modified:
    - theme.ts (new typography.display token, 32px/700/lineHeight 35)
    - app/active-workout/[workoutId].tsx (rest-timer wiring, rest-override pill wiring, Finish/Discard handlers)
    - app/active-workout/_layout.tsx (registered summary Stack.Screen)
    - db/workouts.ts (setExerciseRestOverride, validated + parameterized)
    - components/ExerciseCard.tsx (rest-override pill + inline ± stepper)

key-decisions:
  - "setExerciseRestOverride validates rest seconds (non-negative integer, capped at 1800s) before the parameterized update — T-02-15 mitigation"
  - "Notification scheduling errors caught and surfaced only as notificationsDenied state, never thrown — keeps LOG-03 non-blocking end-to-end"
  - "Rest notification is cancelled on screen unmount (Discard/Finish) via a cleanup effect reading the store directly, so no stale alert fires after a session ends (T-02-16)"

patterns-established:
  - "Pattern 3 (RESEARCH.md) rest-timer scheduling with cancel/reschedule via SchedulableTriggerInputTypes.TIME_INTERVAL, confirmed here as the concrete implementation"

requirements-completed: [LOG-03, LOG-05]

# Metrics
duration: 35min
completed: 2026-07-22
---

# Phase 02 Plan 06: Rest Timer + Finish/Discard Summary

**expo-notifications rest-timer wrapper with drift-free absolute-timestamp countdown, per-exercise rest overrides, and a Finish/summary (duration/volume/PRs) + Discard flow closing out the active-workout logging loop**

## Performance

- **Duration:** 35 min
- **Started:** 2026-07-22T09:00:00+05:30 (approx, from ae32d65 predecessor state)
- **Completed:** 2026-07-22T09:15:13+05:30
- **Tasks:** 3
- **Files modified:** 8 (4 created, 4 modified — theme.ts, db/workouts.ts, ExerciseCard.tsx, app/active-workout/_layout.tsx counted as modified; [workoutId].tsx modified across Tasks 2 and 3)

## Accomplishments
- Rest-timer notification scheduling wrapper (`lib/restTimer.ts`) unit-tested with `expo-notifications` fully mocked — schedule/cancel behavior and the Pitfall-5 channel-before-permission ordering are proven without a device.
- Sticky bottom `RestTimerBar` auto-starts on every logged set (logging mode only), computing remaining time from an absolute `restEndsAt` timestamp so backgrounding/Doze never causes drift; supports -15s/+15s/Skip and a non-blocking "Notifications are off" banner.
- Per-exercise rest override pill (`⏱ {seconds}s ›`) persists to `exercises.rest_seconds` via a validated, parameterized `setExerciseRestOverride`, falling back to the global `default_rest_seconds` setting.
- Finish workout stamps `finished_at` then `router.replace`s to a new summary screen computing duration/volume (`workingSetVolume`)/PRs (`detectPRs` against `loadPriorBests`), each PR rendered with a "PR" badge; Discard shows the exact confirm copy, hard-deletes the workout, cancels any outstanding rest notification, and returns to the Workout tab.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rest-timer notification wrapper + display token (LOG-03/D-09)** - `ae32d65` (feat)
2. **Task 2: RestTimerBar + auto-start on set completion + rest-override pill (D-07/D-08/D-09)** - `00c497c` (feat)
3. **Task 3: Finish/summary + Discard flow (LOG-05/D-10/D-11)** - `4daf754` (feat)

**Plan metadata:** pending (this commit)

_Note: All three tasks were type="auto" (no TDD gate on this plan); Task 1 includes its own test file (`lib/restTimer.test.ts`) as part of the same commit per the plan's action spec, not a separate RED/GREEN TDD cycle._

## Files Created/Modified
- `lib/restTimer.ts` - expo-notifications wrapper: ensureNotificationChannel, requestRestPermission, scheduleRestNotification, cancelRestNotification
- `lib/restTimer.test.ts` - vi.mock'd expo-notifications; asserts schedule/cancel shape and channel-before-permission ordering
- `components/RestTimerBar.tsx` - sticky bottom countdown bar, drift-free via Date.now(), -15s/+15s/Skip controls, denied-permission banner
- `app/active-workout/summary.tsx` - finish summary screen: duration/volume/PRs-hit stat cards + per-PR list + Done CTA
- `theme.ts` - added `typography.display` (32px/700/lineHeight 35)
- `app/active-workout/[workoutId].tsx` - rest-timer auto-start/adjust/skip wiring, rest-override pill handler, Finish/Discard handlers
- `app/active-workout/_layout.tsx` - registered `summary` as a second Stack.Screen
- `db/workouts.ts` - added `setExerciseRestOverride` (validated, parameterized update to `exercises.rest_seconds`)
- `components/ExerciseCard.tsx` - added the rest-override pill + inline ± stepper in the card header

## Decisions Made
- `setExerciseRestOverride` rejects negative/non-integer/NaN values and caps at 1800s (30 min) before writing — satisfies the plan's T-02-15 tampering mitigation for untrusted numeric input reaching a DB write.
- All notification scheduling calls in `[workoutId].tsx` are wrapped in try/catch that degrade to `setRestNotificationId(null)` rather than propagating — keeps the on-screen countdown authoritative and logging never gated by notification failures (LOG-03 requirement).
- A screen-unmount cleanup effect cancels any outstanding rest notification directly from the Zustand store snapshot (`useActiveWorkout.getState()`) so Discard/Finish never leave a stale alert scheduled (T-02-16).

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria are met: `theme.ts` has the `display` token, `lib/restTimer.ts` exports all four required functions using `SchedulableTriggerInputTypes.TIME_INTERVAL`, `RestTimerBar` computes remaining time via `Date.now()` (not a decrementing counter) with accessibility labels on all three controls, `db/workouts.ts` exports `setExerciseRestOverride`, `summary.tsx` calls `workingSetVolume`/`detectPRs` and is registered in `_layout.tsx`, and Discard/Finish wire to `discardWorkout`/`finishWorkout` + `clearActiveWorkout` with the exact confirm copy.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (Notification permission is requested at runtime from within the app; no manual dashboard/env-var setup needed.)

## Next Phase Readiness

Verification performed this run (automated only — human_verify_mode is "end-of-phase" per config, so the plan's `<human-check>` device-verification block, including the mandatory LOG-03 screen-off notification test, is deferred to phase-end verification rather than run per-plan):
- `npx vitest run lib/restTimer.test.ts` — 5/5 tests pass.
- `npx tsc --noEmit` — exits 0, no type errors across the full project.

With this plan, a full workout can be logged, rested through (with a reliable-by-design notification scheduling contract), and finished into a duration/volume/PRs summary or discarded — the LOG-03/LOG-05 loop is functionally complete pending the mandatory physical-device screen-off notification check at phase-end verification. No blockers for Plan 07 (History) or Phase 03.

## Known Stubs

None - no hardcoded/placeholder data paths were introduced. `summary.tsx` reads live workout/exercise/PR data from SQLite; `RestTimerBar` renders live computed state.

## Threat Flags

None - both threat-register items already had `mitigate`/`accept` dispositions with mitigations implemented in this plan (rest-seconds input validation in `setExerciseRestOverride`; notification cancel-on-unmount for discarded sessions). No new unaddressed surface introduced.

---
*Phase: 02-core-logging-active-workout*
*Completed: 2026-07-22*

## Self-Check: PASSED

All 9 files created/modified this plan verified present on disk (lib/restTimer.ts, lib/restTimer.test.ts, components/RestTimerBar.tsx, app/active-workout/summary.tsx, theme.ts, app/active-workout/[workoutId].tsx, app/active-workout/_layout.tsx, db/workouts.ts, components/ExerciseCard.tsx). All 3 task commits (ae32d65, 00c497c, 4daf754) verified present in git log.
