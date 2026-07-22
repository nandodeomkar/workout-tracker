---
phase: 03-templates-folders-calculators
plan: 06
subsystem: ui
tags: [expo-router, react-native, drizzle, active-workout, templates, calculators]

# Dependency graph
requires:
  - phase: 03-templates-folders-calculators
    provides: "PlateCalculatorSheet/OneRMCalculatorSheet/WarmupSuggestionSheet components (Plan 04), buildTemplatePrefillRows/buildTemplateExercisesFromWorkout pure logic (Plan 02), db/templates.ts data layer (Plan 03)"
provides:
  - "Inline plate/1RM/warm-up calculator affordances on every active-workout exercise card, prefilled from the card's current row"
  - "Warm-up ladder one-tap-insert persisting sets.type='warmup' via insertSet, excluded from rest-timer auto-start"
  - "Start-from-template pre-fill merge (last-performance + template target fallback) in the active-workout loadAll"
  - "Save-as-template action on the finish/summary screen (structure + typical reps, null weight)"
affects: [04-stats-and-programs-research, history-edit-flow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Screen-level sheet-open state ({ kind, weId, rowKey }) with sheets mounted once, not per-card — mirrors the existing add/replace picker-overlay convention"
    - "Warm-up accept reuses the insertSet-then-setRowsByWE idiom from handleLogSet, but never starts the rest timer"
    - "Template pre-fill map built once per loadAll call (exerciseId -> TemplateTarget), consumed only by never-yet-logged cards; template-less workouts fall through to the unchanged Phase-2 branch"

key-files:
  created: []
  modified:
    - components/ExerciseCard.tsx
    - app/active-workout/[workoutId].tsx
    - app/active-workout/summary.tsx

key-decisions:
  - "A card's 'current' row for calculator prefill is its last row (rows[rows.length-1]) — the set about to be logged"
  - "Warm-up sheet stays open after Accept so multiple ladder rungs can be inserted in one session; user closes manually"
  - "Save-as-template always creates an Uncategorized (folder null) template, position computed the same way as the template builder's new-template path (count of existing Uncategorized templates)"
  - "Save-as-template default name reuses the same workoutLabel(workout) fallback (name, else formatted date) already used on Workout home / History"

patterns-established:
  - "Inline calculator affordances are optional ExerciseCardProps callbacks — a card renders an icon only if the screen supplies the corresponding onOpen* prop"

requirements-completed: [UTIL-01, UTIL-02, UTIL-03, TMPL-02, TMPL-03]

duration: 12min
completed: 2026-07-22
---

# Phase 03 Plan 06: Active-Workout Calculator Wiring + Template Round-Trip Summary

**Wired the three tested calculator sheets and template-merge logic into the live active-workout screen, closing the Phase-3 loop: inline plate/1RM/warm-up math per exercise card, template-target pre-fill on start, and save-finished-workout-as-template on the summary screen.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-22T13:20:00Z (approx)
- **Completed:** 2026-07-22T13:22:37Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Every exercise card in the active-workout screen now exposes plate/1RM/warm-up icon affordances that open the matching sheet (mounted once at screen level) prefilled from that card's current set
- Warm-up ladder "Accept" persists a `type: 'warmup'` set via the existing crash-safe `insertSet` path without triggering the rest timer
- Starting a workout from a template merges last-performance history with the template's target structure (`buildTemplatePrefillRows`), so historied exercises pre-fill real numbers and never-done exercises fall back to the template's target reps/weight
- Finishing a workout offers "Save as template", capturing working-set counts + typical (last) reps per exercise with `targetWeightKg` always null, so future starts pull real weights from history

## Task Commits

Each task was committed atomically:

1. **Task 1: Inline calculator affordances + sheet wiring + warm-up one-tap insert** - `346423f` (feat)
2. **Task 2: Start-from-template value pre-fill merge in loadAll** - `358779d` (feat)
3. **Task 3: Save finished workout as template** - `e77726b` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `components/ExerciseCard.tsx` - Added three optional `onOpenPlateCalculator`/`onOpenOneRM`/`onOpenWarmup` callbacks + 44×44 icon Pressables in the card header (theme tokens only, no hardcoded hex)
- `app/active-workout/[workoutId].tsx` - Reads `bar_weight_kg`/`bar_weight_lb`; tracks `openSheet` state; mounts `PlateCalculatorSheet`/`OneRMCalculatorSheet`/`WarmupSuggestionSheet` once; `handleAcceptWarmup` persists warm-up sets; `loadAll` merges template targets with last-performance for never-yet-logged, template-started cards
- `app/active-workout/summary.tsx` - Retains loaded `WorkoutDetail`; adds "Save as template" action calling `buildTemplateExercisesFromWorkout` + `createTemplate`/`addTemplateExercise`, with a non-blocking toast

## Decisions Made
- See `key-decisions` in frontmatter above (current-row prefill source, warm-up sheet stays open across accepts, save-as-template folder/position/name conventions).

## Deviations from Plan

None - plan executed exactly as written. Task 1 and Task 2 both touch the same `loadAll` function; they were implemented and committed as fully separable diffs (Task 1's commit adds only the bar-weight-setting reads, Task 2's commit adds only the template-merge branch) so each commit's diff maps 1:1 to its task, per the atomic-commit-per-task requirement.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 3 (templates-folders-calculators) is now functionally complete: template CRUD/folders (Plans 01-03/05), calculator components + standalone tools routes (Plan 04), and this plan's active-workout wiring + template round-trip.
- End-of-phase device UAT still needed per this plan's `<verification>` block: inline plate/1RM/warm-up sheets, warm-up exclusion from volume/PR, template value pre-fill, and save-as-template round-trip on a physical Android device.
- Phase 4 (stats) can build on the now-complete template/history data model.

---
*Phase: 03-templates-folders-calculators*
*Completed: 2026-07-22*

## Self-Check: PASSED

All created/modified files exist on disk; all three task commit hashes (346423f, 358779d, e77726b) verified present in git log.
