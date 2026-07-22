---
phase: 02-core-logging-active-workout
plan: 05
subsystem: ui
tags: [react-native, expo-router, gesture-handler, reanimated, expo-notifications, drizzle, sqlite]

# Dependency graph
requires:
  - phase: 02-core-logging-active-workout
    provides: db/workouts.ts mutations (reorderWorkoutExercises, replaceWorkoutExercise, removeWorkoutExercise), db/settings.ts (getSetting/setSetting), ExerciseCard/active-workout screen scaffolding (Plan 04)
provides:
  - Settings tab Units (kg/lb) + Default rest (D-14/D-07) rows, persisted to the settings table
  - Interactive ExerciseCard drag-to-reorder gesture and Replace/Remove overflow menu (LOG-04/D-16)
  - Active-workout screen wiring for reorder/replace/remove, including the FLAG-1 replace guard and confirm-only-when-at-risk remove rule
  - react-native-gesture-handler and expo-notifications installed as direct dependencies (unblocks Plan 06's rest timer without a second install checkpoint)
affects: [02-06 (rest timer, consumes expo-notifications + default_rest_seconds), 04-stats (units display), any future settings-tab expansion]

# Tech tracking
tech-stack:
  added: [react-native-gesture-handler@3.1.0 (direct dep), expo-notifications@~57.0.6]
  patterns:
    - "Hand-rolled drag-reorder: Gesture.Pan().activateAfterLongPress(ms) + reanimated shared values, driven by each card's onLayout-measured y/height (no draggable-list dependency)"
    - "GestureHandlerRootView wraps the app root once (app/_layout.tsx), not per-screen"
    - "Overflow/action menus (Replace/Remove) via Alert.alert with 3 buttons, consistent with the existing confirm-dialog convention (no new action-sheet dependency)"
    - "Picker overlay reuse: single pickerMode ('add' | 'replace') state branches handleSelectExercise instead of duplicating the overlay"

key-files:
  created: []
  modified:
    - app/(tabs)/settings.tsx
    - components/ExerciseCard.tsx
    - app/active-workout/[workoutId].tsx
    - app/_layout.tsx
    - package.json
    - package-lock.json

key-decisions:
  - "GestureHandlerRootView added to app/_layout.tsx (not declared in the plan's files_modified) — required once app-wide for any gesture-handler use; without it the drag gesture silently fails to receive touch events"
  - "Replace-with-logged-sets flow performs remove+add at the same array index (position), a new workout_exercises row — never a silent exercise_id UPDATE that would reattribute already-logged sets (FLAG-1)"
  - "Drag-reorder computes target index once, on gesture release, from each card's last-measured onLayout position — not a live cross-card reflow during the drag — a scoped simplification within 'planner/executor discretion' (D-16)"
  - "Overflow menu and Remove confirm implemented as sequential Alert.alert calls (menu, then conditional confirm) rather than a custom action-sheet component"

requirements-completed: [LOG-01, LOG-04]

# Metrics
duration: ~20min
completed: 2026-07-22
---

# Phase 2 Plan 05: Settings Units/Rest + Drag-Reorder & Replace/Remove Summary

**Global Units/Default-rest Settings rows plus hand-rolled long-press drag-reorder and a Replace/Remove overflow menu for active-workout exercise cards, wired to the Plan 03 mutation layer with the FLAG-1 replace guard.**

## Performance

- **Duration:** ~20 min (continuation agent, post-checkpoint-approval)
- **Completed:** 2026-07-22T03:20:06Z
- **Tasks:** 3 (checkpoint + 2 auto)
- **Files modified:** 6 (package.json, package-lock.json, app/(tabs)/settings.tsx, components/ExerciseCard.tsx, app/active-workout/[workoutId].tsx, app/_layout.tsx)

## Accomplishments
- Settings ("More") tab now has two functional rows — Units (kg/lb pill selector) and Default rest (±15s stepper) — both reading with a typed fallback and writing immediately via `getSetting`/`setSetting` (D-14/D-07)
- `ExerciseCard`'s drag handle and overflow control are fully interactive: long-press-then-drag reorders exercise cards; the overflow `⋯` opens a Replace/Remove menu
- Active-workout screen persists reorder via `reorderWorkoutExercises`, in-place-swaps a zero-set exercise via `replaceWorkoutExercise`, and falls back to remove+re-add (never silent reattribution) when the FLAG-1 guard throws for a card with logged sets
- Remove shows the destructive UI-SPEC-copy confirm only when the card has ≥1 completed set; a card with nothing logged is removed silently
- `react-native-gesture-handler` and `expo-notifications` installed as direct dependencies only after the mandatory human legitimacy checkpoint was approved — unblocks Plan 06 (rest timer) without a second install interruption

## Task Commits

Each task was committed atomically:

1. **Task 1: [SUS] package legitimacy gate** — checkpoint approved by user (no code commit for the gate itself; approval documented in this continuation's prompt)
2. **Task 2: Install native deps + Settings rows** — `8cad033` (chore, package install) + `8d91cc2` (feat, Settings rows)
3. **Task 3: Drag-reorder + Replace/Remove overflow** — `845f5d2` (feat)

## Files Created/Modified
- `package.json` / `package-lock.json` — `react-native-gesture-handler` promoted to a direct dependency at `3.1.0`; `expo-notifications` added at `~57.0.6`; `react-native-reanimated` reconciled (stayed at the already-current `4.5.0`)
- `app/(tabs)/settings.tsx` — rewritten with Units (kg/lb pill) and Default rest (±15s stepper) rows, `useFocusEffect` cancelled-guard reload, theme tokens only
- `components/ExerciseCard.tsx` — drag handle now a `GestureDetector`-wrapped `Gesture.Pan().activateAfterLongPress(350)` driving a reanimated `translateY` shared value; overflow `⋯` is now a `Pressable` calling `onOverflowPress`
- `app/active-workout/[workoutId].tsx` — added `pickerMode`/`replaceTargetWeId` state (reuses the existing Add-exercise overlay for Replace), `cardLayoutsRef` (onLayout-measured card positions), and handlers: `handleReorderDragEnd`, `handleReplaceExercise`, `handleRemoveAndAddReplacement`, `handleRemovePress`/`doRemoveExercise`, `handleOverflowPress`
- `app/_layout.tsx` — wrapped the root `Stack` in `GestureHandlerRootView` (Rule 3 auto-fix, see Deviations)

## Decisions Made
- Replace-with-logged-sets always creates a **new** `workout_exercises` row (remove old + add new) at the same list position, rather than ever mutating `exercise_id` in place once sets exist — matches the FLAG-1/Pitfall-3 resolution from RESEARCH.md exactly.
- Drag-reorder target index is computed once at gesture release from `onLayout`-measured card `y`/`height` values (a ref, not state, so layout updates never trigger re-renders); this is a scoped simplification of "live" cross-card reflow during the drag itself, acceptable under D-16's "interaction details are planner discretion."
- Used `Alert.alert` for both the overflow action menu and the Remove confirm — consistent with the existing archive-confirm pattern in `exercises/[id].tsx`, avoids adding a dedicated action-sheet dependency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `GestureHandlerRootView` to `app/_layout.tsx`**
- **Found during:** Task 3 (Drag-reorder + Replace/Remove overflow)
- **Issue:** `react-native-gesture-handler`'s `GestureDetector`/`Gesture.Pan` requires the app to be wrapped in a `GestureHandlerRootView` somewhere above any gesture-consuming component. The plan's `files_modified` list only named `components/ExerciseCard.tsx` and `app/active-workout/[workoutId].tsx`, but the Task 3 `<action>` text explicitly said to "wrap the active-workout screen content in `GestureHandlerRootView` (if not already provided by expo-router's root)" — and it was not already provided.
- **Fix:** Wrapped the root `Stack` in `app/_layout.tsx` in `GestureHandlerRootView` (`style={{flex:1}}`) — the standard one-time, app-wide placement recommended by the library, rather than a narrower per-screen wrapper that would need duplicating if a future screen also needs gestures.
- **Files modified:** `app/_layout.tsx`
- **Verification:** `npx tsc --noEmit` exits 0; `npx vitest run` — 101/101 tests pass (no test touches gesture wiring directly, but nothing broke).
- **Committed in:** `845f5d2` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for the drag-reorder gesture to function at all; no scope creep — this is exactly the fallback the plan's own Task 3 action text anticipated.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Both newly-installed packages (`react-native-gesture-handler`, `expo-notifications`) require a rebuilt dev client (`expo run:android` / new EAS dev build) before their native modules are available on-device — this is a build step, not a manual configuration step, and is the same requirement CLAUDE.md already documents for any native-module addition.

## Next Phase Readiness
- Plan 06 (rest timer) can now `import * as Notifications from 'expo-notifications'` directly — no second install checkpoint needed.
- Settings' `default_rest_seconds` and `units` keys are live and readable by the rest timer and any future display code.
- The **human-check** verification steps in this plan's `<verification>` block (physical-device drag/replace/remove/unit-persistence testing) were not run in this session — they require a physical Android dev-client build per CLAUDE.md's screen-off/device-testing guidance and are out of scope for this automated executor pass. Recommend running them before closing out Phase 2.

---
*Phase: 02-core-logging-active-workout*
*Completed: 2026-07-22*
