---
phase: 01-scaffold-data-foundation
plan: 04
subsystem: ui
tags: [expo-router, react-native, flatlist, drizzle-orm, vitest, exercise-library, filter]

# Dependency graph
requires:
  - phase: 01-scaffold-data-foundation (Plan 01)
    provides: Driver-agnostic Drizzle schema (exercises table), db/client.ts, theme.ts token module, minimal Exercises tab shell
  - phase: 01-scaffold-data-foundation (Plan 02)
    provides: constants/taxonomy.ts (MUSCLE_GROUPS/EQUIPMENT fixed lists), curated 498-row seed
provides:
  - Pure in-memory filter pipeline (lib/exerciseFilter.ts) implementing D-06/D-07 search+chip semantics
  - Archived-visible A-Z query layer (db/exercises.ts) implementing D-11
  - Reusable theme-tokenized FilterChipRow and ExerciseRow components
  - Full searchable/filterable Exercises tab (app/(tabs)/exercises/index.tsx) — first end-to-end user-facing capability
affects: [01-05-exercise-detail-crud, 02-core-logging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure filter pipeline over an in-memory array, loaded once via useEffect on mount — never re-queries SQLite per keystroke"
    - "orderBy(asc(sql`lower(${column})`)) for case-insensitive A-Z ordering in Drizzle/SQLite"
    - "Theme-tokenized presentational components (FilterChipRow, ExerciseRow) with zero hardcoded color hex or spacing literals"

key-files:
  created:
    - lib/exerciseFilter.ts
    - db/exercises.ts
    - db/exercises.query.test.ts
    - components/FilterChipRow.tsx
    - components/ExerciseRow.tsx
  modified:
    - app/(tabs)/exercises/index.tsx

key-decisions:
  - "Case-insensitive A-Z ordering implemented via Drizzle's sql template (asc(sql`lower(${exercises.name})`)) rather than fetching all rows and sorting in JS, keeping the query layer the single source of ordering truth"
  - "Touch-target sizing for chips/rows achieved via generous theme.spacing padding rather than an arbitrary numeric minHeight literal, keeping every style value traceable to a theme token"
  - "Row press wires router.push to /exercises/[id] now (per plan instruction) even though that route does not exist until Plan 05 — navigation call is correct and ready, screen arrives next plan"

patterns-established:
  - "lib/exerciseFilter.ts is the canonical analog for any future pure client-side filter pipeline over an in-memory dataset"
  - "components/FilterChipRow.tsx and components/ExerciseRow.tsx are the canonical analogs for future theme-tokenized, no-inline-style presentational components"

requirements-completed: [EXER-01]

# Metrics
duration: ~15min
completed: 2026-07-21
---

# Phase 1 Plan 4: Exercise Library Browse & Search Summary

**Searchable, multi-filter Exercises tab: live name-substring search, two multi-select chip rows (muscle group/equipment) with OR-within/AND-across semantics and one-tap clear, over a once-loaded, archived-hidden, A-Z-sorted exercise list rendered in a flat FlatList.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-21T12:35:00Z (approx)
- **Completed:** 2026-07-21T12:49:34Z
- **Tasks:** 3 (Task 1 executed as TDD: RED then GREEN)
- **Files created/modified:** 6

## Accomplishments
- Built `lib/exerciseFilter.ts`: a pure `filterExercises()` function proving the exact D-06/D-07 semantics — case-insensitive name-only substring search, OR-within-row muscle/equipment chip selection, AND-across-rows combination
- Built `db/exercises.ts`: `loadActiveExercises()` querying `archived=false` exercises via Drizzle's parameterized builder, ordered A-Z case-insensitively via `lower(name)`
- Wrote `db/exercises.query.test.ts` (9 tests) covering every filter behavior plus the query layer's archived-exclusion and ordering, run through the full RED → GREEN TDD cycle
- Built `components/FilterChipRow.tsx` and `components/ExerciseRow.tsx` — reusable, theme-tokenized presentational components with zero hardcoded color/spacing literals
- Replaced Plan 01's minimal read-only list with the full `app/(tabs)/exercises/index.tsx`: sticky search bar + two chip rows + one-tap clear, single flat A-Z `FlatList` with custom-badge rows mixed in, empty-match state, and row-press navigation wired to `/exercises/[id]`

## Task Commits

Each task was committed atomically:

1. **Task 1 [TDD]: Pure filter pipeline + query layer — RED** - `c7d6241` (test)
1b. **Task 1 [TDD]: Pure filter pipeline + query layer — GREEN** - `badd34e` (feat)
2. **Task 2: FilterChipRow + ExerciseRow components** - `a3bbf47` (feat)
3. **Task 3: Compose the Exercises tab** - `f56adb7` (feat)

**Plan metadata:** pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified

- `lib/exerciseFilter.ts` - `filterExercises(rows, filter)` pure function + `ExerciseFilter` type
- `db/exercises.ts` - `loadActiveExercises(db)` query layer
- `db/exercises.query.test.ts` - 9 tests covering filter semantics + query behavior
- `components/FilterChipRow.tsx` - horizontally scrollable multi-select chip row
- `components/ExerciseRow.tsx` - name + secondary line + custom badge row
- `app/(tabs)/exercises/index.tsx` - full search/filter/list screen replacing Plan 01's minimal version

## Decisions Made

- Used Drizzle's `sql` template helper for `orderBy(asc(sql`lower(${exercises.name})`))` to get case-insensitive A-Z ordering directly from SQLite, rather than sorting the already-loaded array in JavaScript — keeps the query layer as the single source of truth for row order.
- Chip and row touch targets are sized via `theme.spacing` padding alone (no arbitrary `minHeight` literal), satisfying both the "large touch target for gym use" UX requirement and the "no hardcoded numeric literals outside theme tokens" constraint.
- `router.push('/exercises/${id}')` is wired now per the plan's explicit instruction, even though the `/exercises/[id]` route itself doesn't exist until Plan 05 — this is forward-wiring, not a stub; tapping a row today does nothing harmful (expo-router simply has no matching route yet) and will start working the moment Plan 05 lands.

## Deviations from Plan

None — plan executed exactly as written. All three tasks, their `<behavior>`/`<action>` specs, and every listed acceptance criterion were implemented and verified as specified.

## Issues Encountered

None. `npx vitest run db/exercises.query.test.ts` (9/9), `npx tsc --noEmit` (0 errors), and `npx vitest run` (full suite, 21/21) all pass cleanly on the final state.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None. The `/exercises/[id]` route referenced by row-press navigation does not exist yet (arrives in Plan 05), but this is explicitly scoped forward-wiring called out in the plan's Task 3 action text, not a stub blocking this plan's own goal (browse/search/filter the library).

## Next Phase Readiness

- The Exercises tab is now a real, fully functional EXER-01 slice: search, filter, and browse the 498-row seeded library, ready for friends-beta use as soon as a device build exists.
- `lib/exerciseFilter.ts` and `db/exercises.ts` are ready to be reused/extended by Plan 05's exercise detail/edit/archive screen and any future exercise picker (Phase 2 active-workout logging).
- `components/FilterChipRow.tsx` and `components/ExerciseRow.tsx` establish the theme-tokenized component pattern for all future presentational components in the project.
- No blockers for Plan 05 (exercise detail/edit/create/archive — EXER-02).

---
*Phase: 01-scaffold-data-foundation*
*Completed: 2026-07-21*

## Self-Check: PASSED

- All key files verified present on disk (`lib/exerciseFilter.ts`, `db/exercises.ts`, `db/exercises.query.test.ts`, `components/FilterChipRow.tsx`, `components/ExerciseRow.tsx`, `app/(tabs)/exercises/index.tsx`).
- All commit hashes verified present in `git log` (`c7d6241`, `badd34e`, `a3bbf47`, `f56adb7`).
- Plan-level verification re-run clean: `npx vitest run db/exercises.query.test.ts` (9/9 passed), `npx tsc --noEmit` (0 errors), `npx vitest run` (21/21 passed, full suite).
