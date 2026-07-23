---
phase: 05-body-measurements
plan: 04
subsystem: app (measurements entry form + CTA wiring + settings)
tags: [expo-router, react-native, typed-routes, unit-conversion]

# Dependency graph
requires:
  - phase: 05-body-measurements
    plan: 01
    provides: getMetricIcon, UnitType, cmToDisplay/displayToCm, kgToDisplay/displayToKg
  - phase: 05-body-measurements
    plan: 02
    provides: db/measurements.ts (insertReadingsForDate/updateReading/deleteReading/loadMetricDefinitions/loadReadingsForMetric)
  - phase: 05-body-measurements
    plan: 03
    provides: app/measurements/index.tsx + [metric].tsx (deferred TODO(05-04) CTAs), Settings Body Measurements nav row
provides:
  - "/measurements/entry" route (dated-session / single-metric / edit modes in one form)
  - Independent `length_units` (cm/in) setting, never derived from `units` (kg/lb)
  - app/measurements/_layout.tsx (Stack group layout, closes a Plan-03 gap)
affects: [05-05-custom-metrics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-screen '‹ Cancel' + title form overlay pattern (active-workout add-exercise picker precedent) applied to a standalone pushed route rather than an in-screen overlay"
    - "MonthCalendar repurposed as a back-date picker by computing `workoutDays` as the set of past-or-today ISO dates in the displayed month (its `disabled` gate), rather than actual workout-logged days"
    - "Stack _layout.tsx-per-route-group convention (templates/tools/active-workout precedent) applied retroactively to app/measurements/"

key-files:
  created:
    - app/measurements/entry.tsx
    - app/measurements/_layout.tsx
  modified:
    - app/measurements/index.tsx
    - app/measurements/[metric].tsx
    - app/(tabs)/settings.tsx

key-decisions:
  - "Values entered via NumericKeypad are stored in component state as DISPLAY-unit numbers (not canonical) and only converted to canonical kg/cm at save time via displayToKg/displayToCm — mirrors how the keypad's label/initialValue are already display-unit throughout the codebase"
  - "Dated-session mode's blank-field-skip (D-08b) is implemented via presence-in-Map: a metric row is written only if its keypad was opened and Done pressed at least once; untouched rows are never in the values Map and are excluded from insertReadingsForDate's entries array"
  - "MonthCalendar's `workoutDays` Set is repurposed to mean 'selectable' (all days <= today in the displayed month), not 'has a workout' — its dot indicator and disabled-state logic are cosmetic/functional side effects, not semantically renamed, since changing the component itself was out of this plan's file scope"

requirements-completed: [MEAS-01, MEAS-02]

# Metrics
duration: ~25min
completed: 2026-07-23
---

# Phase 05 Plan 04: Measurement Entry Form + CTA Wiring Summary

**One `app/measurements/entry.tsx` route serves dated-session logging (blank fields skipped), single-metric quick-add, and full edit/delete (back-datable, never future) — plus an independent Settings cm/in length-unit toggle that never touches the existing kg/lb setting.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-23T15:26:21+05:30
- **Tasks:** 2 completed
- **Files modified:** 5 (2 new, 3 modified)

## Accomplishments
- `app/measurements/entry.tsx` — a single full-screen form resolves its mode from optional `?metric=`/`?readingId=` query params: no params → dated-session (every built-in metric rendered, blanks skipped on save), `?metric=` only → single-metric add (auto-opens the keypad), `?metric=&readingId=` → edit (pre-filled, destructive delete)
- Back-datable date row reuses `MonthCalendar` as an overlay, restricting selectable days to today-or-earlier in the displayed month (D-09 never-future)
- Every entered value is converted to canonical units (`displayToKg`/`displayToCm`, weight/length; percent passes through) only at save time, writing through the already-guarded `insertReadingsForDate`/`updateReading` layer
- All three of Plan 03's deferred CTAs are now wired: index screen's "Log measurements", detail screen's "+ Add a reading" (both instances) and history-row edit (✎)
- Settings gains an independent "Length units" cm/in pill row (`length_units` key), structured identically to the existing kg/lb row but never derived from or synced to it (D-04)

## Task Commits

Each task was committed atomically:

1. **Task 1: Measurement entry form (dated-session / single-metric / edit)** - `498999c` (feat)
2. **Task 2: Wire entry CTAs + cm/in length-unit setting** - `9f56533` (feat)

**Plan metadata:** pending (docs: complete plan, this commit)

## Files Created/Modified
- `app/measurements/entry.tsx` - new full-screen route; header mode title, date row + MonthCalendar overlay, two-section metric-row list (dated-session) or single row (single-metric/edit), NumericKeypad per-row entry, Save button (label varies by mode), edit-mode destructive Delete link
- `app/measurements/_layout.tsx` - new Stack layout for the `measurements` route group (see Deviations)
- `app/measurements/index.tsx` - `handleLogMeasurements` now `router.push('/measurements/entry')`
- `app/measurements/[metric].tsx` - `handleAddReading`/`handleEditReading` now `router.push` to `/measurements/entry` with `metric`/`readingId` params
- `app/(tabs)/settings.tsx` - new `lengthUnits` state + `handleSelectLengthUnit`, new "Length units" section with cm/in `UnitPill` row, loaded alongside `units` in the existing focus-effect `Promise.all`

## Decisions Made
- Component state stores entered values as display-unit numbers (matching what the user typed via the keypad, which already labels/shows values in the current display unit); conversion to canonical kg/cm happens exactly once, at save time — avoids a round-trip conversion bug where a mid-edit re-render could double-convert
- Dated-session blank-skip (D-08b) implemented as "presence in a `Map<metricKey, displayValue>`" rather than a sentinel value (e.g. `0` or `null`) — a metric is written iff its row's keypad was opened and "Done" was pressed at least once
- `MonthCalendar`'s `workoutDays` prop (originally "days with a logged workout") is repurposed as "days selectable in this back-date picker" — computed as every day `<= today` in the currently displayed month — since the component's own disabled-state gate is exactly the mechanism needed to enforce D-09's never-future rule, and modifying the component itself was outside this plan's file scope

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Added app/measurements/_layout.tsx (missing Stack group layout from Plan 03)**
- **Found during:** Task 1, running `npx tsc --noEmit` to verify the new entry route
- **Issue:** Every other standalone pushed-route group in this codebase (`app/templates/`, `app/tools/`, `app/active-workout/`) has its own `_layout.tsx` wrapping its screens in a `Stack`. `app/measurements/` never got one in Plan 03. Without it, expo-router's typed-routes codegen could not fold `index.tsx` into the bare `/measurements` path, and generated `[metric].tsx`'s route as a literal static string instead of a parameterized dynamic segment — so `router.push('/measurements')`, `router.push(\`/measurements/${metricKey}\`)`, and the new `router.push('/measurements/entry')`/`?metric=&readingId=` calls all failed `tsc --noEmit` with "not assignable" errors. (This is a latent gap in Plan 03's committed code, not something introduced by this plan — it surfaced here because Task 1 was the first change in this route group to trigger a full typed-routes regeneration check.)
- **Fix:** Added `app/measurements/_layout.tsx`, mirroring `app/templates/_layout.tsx`/`app/tools/_layout.tsx` exactly (`Stack` with `headerShown: false`, screens `index`/`[metric]`/`entry`). Restarted the background Expo dev server (metro's file watcher performs the typed-routes codegen; `tsc` alone does not trigger it — same mechanic Plan 03 documented) to force a full regeneration, confirmed `/measurements`, `/measurements/${Router.SingleRoutePart<T>}`, and `/measurements/entry` all resolve correctly, then re-ran `tsc --noEmit` clean.
- **Files modified:** `app/measurements/_layout.tsx` (new)
- **Commit:** `498999c`

**2. [Rule 1 - Bug] Fixed `StyleSheet.absoluteFillObject` typo in the calendar overlay backdrop**
- **Found during:** Task 1, `npx tsc --noEmit`
- **Issue:** Used the non-existent `StyleSheet.absoluteFillObject` (RN's API is `StyleSheet.absoluteFill`) for the date-picker overlay's backdrop style.
- **Fix:** Changed to `...StyleSheet.absoluteFill`, matching `components/NumericKeypad.tsx`'s existing backdrop style precedent.
- **Files modified:** `app/measurements/entry.tsx`
- **Commit:** `498999c`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both necessary for the plan's own stated `npx tsc --noEmit exits 0` acceptance criteria and for Task 2's CTA wiring to type-check at all. No scope creep — the `_layout.tsx` addition follows an established, verbatim-copyable pattern already used by three sibling route groups.

## Issues Encountered

The machine's available physical memory was very low (~900MB-1GB free, ~55GB/56GB virtual memory in use) during this session — the same environment constraint previously logged in the project memory (`vitest-windows-paging-crash`). The first two `npx tsc --noEmit` attempts crashed with `FATAL ERROR: ... JavaScript heap out of memory` before completing (raising/lowering `--max-old-space-size` did not help, confirming it's a total-system-RAM ceiling, not a V8 heap-flag issue). A subsequent retry succeeded once memory pressure eased. No code change was made in response; this is an environment characteristic of this Windows machine, not a defect in this plan's code. `npx vitest run --no-file-parallelism` (61 files, 464 tests) passed 100% green after both tasks, confirming no regression to the `lib/`/`db/`/screen layers this plan builds on.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 05 (custom metrics) can now add its "+ Add custom metric" entry point to the index screen's metric list. The entry form built here already renders any `metric_definitions` row (built-in or custom) generically via `loadMetricDefinitions`, so a newly-created custom metric will appear in dated-session mode and be individually loggable/editable through this same form with no further changes to `entry.tsx` needed.

No blockers.

## Human Verification Required

Per this plan's `<verify>` `<human-check>` notes (informational, not a blocking checkpoint — both tasks are `type="auto"`/`autonomous: true`):
- On device: open "Log measurements", set a past date, enter chest + waist + one biceps, leave others blank, Save → only the filled metrics appear in their history. Edit one reading's value and save → history updates. Confirm a future date cannot be picked in the calendar overlay.
- On device: Settings shows an independent Length units cm/in toggle; switching it re-labels body-part values on the Measurements screens without changing the kg/lb weight display. The index "Log measurements" CTA and the detail "+ Add a reading"/edit (✎) all open the entry form in the correct mode.

---
*Phase: 05-body-measurements*
*Completed: 2026-07-23*

## Self-Check: PASSED

All 5 created/modified source files and this SUMMARY.md verified present on disk. Both task commits (`498999c`, `9f56533`) verified present in git log.
