---
phase: 03-templates-folders-calculators
plan: 08
subsystem: database
tags: [sqlite, drizzle, react-native, active-workout, gap-closure]

# Dependency graph
requires:
  - phase: 03-templates-folders-calculators
    provides: active-workout logging screen (handleLogSet, insertSet, updateSet, rest timer) and UAT-identified Gap 2/Gap 3 defects (03-UAT.md)
provides:
  - deleteSet(db, setId) data-layer helper for a single-row, crash-safe set delete
  - Per-set un-log interaction on the active-workout screen (re-tap ✓ on a logged set)
  - Warm-up rest-timer guard so a manually-toggled warm-up set never auto-starts the rest timer
affects: [active-workout logging, history/PR/volume recomputation, future UAT re-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-row un-log reverts local row state to a fresh pending key (p-{weId}-{timestamp}) rather than reusing the stale s-<deletedId> key, since that key would reference a now-deleted DB row"

key-files:
  created: []
  modified:
    - db/workouts.ts
    - db/workouts.crud.test.ts
    - app/active-workout/[workoutId].tsx

key-decisions:
  - "deleteSet never renumbers sibling set_number values, matching the existing removeWorkoutExercise precedent — volume/PR are computed live from remaining rows, so non-contiguous set numbers are already tolerated end-to-end"
  - "Un-log is implemented as a re-tap of the existing ✓ control (no new SetRow affordance), consistent with the UAT-chosen 'tap ✓ again to toggle off' interaction"
  - "Un-log preserves weightKg/reps/setNumber/isWarmup on the reverted row so re-tapping ✓ re-logs the same values"

patterns-established: []

requirements-completed: [LOG-02, LOG-03]

# Metrics
duration: 8min
completed: 2026-07-22
---

# Phase 03 Plan 08: Gap Closure — Warm-up Timer Guard + Per-Set Un-log Summary

**Added a `deleteSet` data-layer helper and wired it into the active-workout checkmark handler to close two UAT defects: warm-up sets no longer auto-start the rest timer, and re-tapping ✓ on a logged set now un-logs just that one set.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-22T14:40:07Z
- **Completed:** 2026-07-22T14:43:53Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `deleteSet(db, setId)` added to `db/workouts.ts`: a single parameterized delete of exactly one `sets` row, with unit tests proving target-only deletion (siblings untouched) and crash-safe cold re-read
- Gap 2 closed: `handleLogSet`'s rest-timer auto-start condition now checks `mode === 'logging' && !row.isWarmup`, so a set manually toggled to warm-up via the W chip and then logged no longer starts the timer (matches `handleAcceptWarmup`'s existing no-timer intent)
- Gap 3 closed / D-01 un-deferred: re-tapping ✓ on an already-logged set in logging mode now deletes that set via `deleteSet` and reverts the row in place to pending (`setId: null`, `isCompleted: false`, fresh pending key), instead of being a no-op — the exercise card and its other sets are untouched, and volume/PR recompute correctly on the next read because they are always computed live from the remaining rows (never cached)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add deleteSet db helper + unit test** - `5f5bb7b` (feat)
2. **Task 2: Guard warm-up timer and wire per-set un-log in handleLogSet** - `0d8e325` (fix)

**Plan metadata:** (pending — final docs commit below)

## Files Created/Modified
- `db/workouts.ts` - Added `deleteSet(db, setId)`: parameterized single-row delete, doc comment contrasting it with `removeWorkoutExercise`
- `db/workouts.crud.test.ts` - Added `describe('deleteSet')`: Test A (target-only delete, siblings intact) and Test B (crash-safe cold re-read via a second Drizzle instance)
- `app/active-workout/[workoutId].tsx` - Imported `deleteSet`; guarded the rest-timer auto-start with `!row.isWarmup`; replaced the logging-mode no-op in the `row.setId != null` branch with an un-log path (`deleteSet` + revert-to-pending), wrapped in try/catch mirroring the existing `insertSet` failure-notify pattern

## Decisions Made
- `deleteSet` intentionally does not renumber sibling `set_number` values, consistent with `removeWorkoutExercise`'s existing precedent (documented in-line in the new doc comment)
- The un-log interaction reuses the existing ✓ control rather than introducing a new SetRow affordance, per the UAT's chosen "tap ✓ again to toggle off" resolution
- The reverted-to-pending row gets a fresh `p-${weId}-${Date.now()}` key (not the stale `s-<deletedId>` key) to avoid referencing a now-deleted DB row, while weight/reps/setNumber/isWarmup are preserved unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both UAT Test 7 defects (Gap 2, Gap 3) are closed at the code level; `npx vitest run` (158/158) and `npx tsc --noEmit` both pass clean
- Manual device re-verification of UAT Test 7 (warm-up timer suppression + un-log without deleting the whole exercise card) is still recommended before closing out Phase 03's UAT sign-off, per the plan's `<verification>` human-check note — no blockers, this is a confirmation step only
- No new blockers introduced for Phase 04

---
*Phase: 03-templates-folders-calculators*
*Completed: 2026-07-22*

## Self-Check: PASSED

All created/modified files and commit hashes verified present on disk and in git history.
