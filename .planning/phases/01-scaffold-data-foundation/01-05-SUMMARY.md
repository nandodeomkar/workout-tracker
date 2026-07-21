---
phase: 01-scaffold-data-foundation
plan: 05
subsystem: ui
tags: [expo-router, react-native, drizzle-orm, vitest, exercise-library, crud]

# Dependency graph
requires:
  - phase: 01-scaffold-data-foundation (Plan 01)
    provides: Driver-agnostic Drizzle schema (exercises table with seed_id/is_custom/archived), db/client.ts, db/test/fixture.ts
  - phase: 01-scaffold-data-foundation (Plan 02)
    provides: constants/taxonomy.ts (MUSCLE_GROUPS/EQUIPMENT fixed lists), curated 498-row seed
  - phase: 01-scaffold-data-foundation (Plan 04)
    provides: db/exercises.ts query layer (loadActiveExercises), lib/exerciseFilter.ts, FilterChipRow/ExerciseRow components, Exercises tab shell
provides:
  - Exercise mutation layer (createExercise, updateExercise, setArchived, findByName, loadAllExercises, loadExerciseById) in db/exercises.ts
  - Custom exercise creation form (app/(tabs)/exercises/new.tsx) with duplicate warn-but-allow
  - Edit/detail screen (app/(tabs)/exercises/[id].tsx) supporting edit-in-place + archive/unarchive for any exercise
  - "Show archived" reveal toggle in the library list (app/(tabs)/exercises/index.tsx)
affects: [01-06-device-checkpoint, 02-core-logging]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mutation functions live in db/exercises.ts alongside query functions — one file is the full data-access surface for a table"
    - "Single-select reuse of the multi-select FilterChipRow component (selected=[value], onToggle replaces rather than toggles) for picker fields in forms"
    - "Debounced single-row lookup (findByName on a 300ms timer) for duplicate-name UX, distinct from the per-render in-memory list filter pattern"

key-files:
  created:
    - app/(tabs)/exercises/new.tsx
    - app/(tabs)/exercises/[id].tsx
  modified:
    - db/exercises.ts
    - db/exercises.crud.test.ts
    - app/(tabs)/exercises/index.tsx

key-decisions:
  - "Added loadAllExercises and loadExerciseById query helpers to db/exercises.ts beyond the plan's literal Task 1 export list — needed to back the archived-reveal toggle and the detail screen's load-by-id, follows the established query-layer pattern rather than inlining SQL in a screen"
  - "Added a '+ Add exercise' button to index.tsx navigating to /exercises/new — the plan's Task 2 built the creation form but never wired an entry point to it from the library list, which would have left it unreachable"
  - "Archived rows are visually marked in the list via a reduced-opacity wrapper View and an '(Archived)' name suffix, without changing ExerciseRow's public API — keeps the file-modification scope to exactly the files listed in the plan frontmatter"
  - "Duplicate-name check in new.tsx is a debounced single-row findByName lookup (300ms), not a per-keystroke list re-query — distinct from the RESEARCH.md anti-pattern warning, which applies to the 498-row library list filter, not a one-row existence check"

patterns-established:
  - "Detail/edit screens (app/(tabs)/exercises/[id].tsx) are the canonical analog for future single-record edit screens (e.g. template/program detail in later phases)"

requirements-completed: [EXER-02]

# Metrics
duration: ~15min
completed: 2026-07-21
---

# Phase 1 Plan 5: Custom Exercise Create, Edit-in-Place & Archive Summary

**Exercise mutation layer (createExercise/updateExercise/setArchived/findByName) plus a creation form and an edit/detail screen, delivering full EXER-02 lifecycle: create, edit any exercise in place including seeded rows, and reversible archive/unarchive with no hard delete.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-21T12:46:00Z (approx)
- **Completed:** 2026-07-21T13:01:29Z
- **Tasks:** 3 (Task 1 executed as TDD: RED then GREEN)
- **Files created/modified:** 5

## Accomplishments
- Extended `db/exercises.ts` with `createExercise`, `updateExercise`, `setArchived`, and `findByName`, all built exclusively on Drizzle's parameterized query builder, with name/notes length validation (ASVS V5) and explicit D-10 preservation of `seed_id`/`is_custom` on edited seeded rows
- Wrote `db/exercises.crud.test.ts` (10 tests) proving create defaults, notes persistence, empty-name rejection, duplicate-name allow-and-findable, seeded-row edit-in-place preservation, and reversible archive/unarchive — run through a real RED→GREEN TDD cycle
- Built `app/(tabs)/exercises/new.tsx`: the exact D-09 field set (name required, muscle group, equipment, optional notes), with a debounced duplicate-name lookup surfacing a non-blocking "already exists — open it? / proceed anyway" inline warning (D-12)
- Built `app/(tabs)/exercises/[id].tsx`: an edit-in-place form that works identically for seeded and custom exercises (D-10), with an Archive/Unarchive control and explicitly no delete control (D-11)
- Added a "Show archived" reveal toggle (default hidden) to the library list, reusing the existing search/filter pipeline, plus an entry point button into the new creation form

## Task Commits

Each task was committed atomically:

1. **Task 1a [TDD]: Exercise mutation layer tests — RED** - `102ba1a` (test)
1b. **Task 1b [TDD]: Exercise mutation layer implementation — GREEN** - `1c3a4d4` (feat)
2. **Task 2: Custom exercise creation form** - `08dc363` (feat)
3. **Task 3: Edit/detail screen + archived reveal toggle** - `97bfecd` (feat)

**Plan metadata:** pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified
- `db/exercises.ts` - added `createExercise`, `updateExercise`, `setArchived`, `findByName`, `loadAllExercises`, `loadExerciseById`
- `db/exercises.crud.test.ts` - 10 tests covering EXER-02 create/edit-seeded/archive/duplicate behavior
- `app/(tabs)/exercises/new.tsx` - custom exercise creation form with duplicate warn-but-allow
- `app/(tabs)/exercises/[id].tsx` - edit-in-place + archive/unarchive detail screen
- `app/(tabs)/exercises/index.tsx` - "Show archived" toggle + "+ Add exercise" entry point + archived-row visual marking

## Decisions Made
- Kept mutation functions in the same `db/exercises.ts` module as the query functions from Plan 04 rather than splitting into a separate mutations file — one file remains the full data-access surface for the `exercises` table, matching the plan's explicit instruction to "extend, don't duplicate."
- Used `sql`lower(${exercises.name}) = lower(${name})`` for `findByName`'s case-insensitive exact match, consistent with the `lower(name)` ordering pattern already established in `loadActiveExercises` (Plan 04) — keeps case-insensitivity handling in SQL rather than JS.
- Archived-row visual marking (opacity + "(Archived)" suffix) was implemented via a wrapper `View` in `index.tsx` rather than adding an `archived` prop to `ExerciseRow`, to keep this plan's file changes exactly matching its frontmatter `files_modified` list.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Added loadAllExercises and loadExerciseById query helpers**
- **Found during:** Task 3 (building the detail screen and archived-reveal toggle)
- **Issue:** The plan's Task 3 action requires the detail screen to "load the exercise by route id" and the list to "load and include archived rows when [the toggle is] ON" — neither function existed; `loadActiveExercises` (Plan 04) always excludes archived rows and has no by-id variant.
- **Fix:** Added `loadAllExercises(db)` (same A-Z ordering as `loadActiveExercises`, no archived filter) and `loadExerciseById(db, id)` to `db/exercises.ts`, following the established query-layer pattern (parameterized builder, same file as sibling queries).
- **Files modified:** `db/exercises.ts`
- **Verification:** `npx tsc --noEmit` (0 errors), `npx vitest run` (31/31 passed)
- **Committed in:** `97bfecd` (Task 3 commit)

**2. [Rule 2 - Missing critical] Added a "+ Add exercise" entry point to the library list**
- **Found during:** Task 3 (final review of the create-form flow end to end)
- **Issue:** Task 2 built `new.tsx`, the D-09 creation form, but no screen in the app navigates to it — without an entry point, the form the plan's objective explicitly promises ("users can create custom exercises") would be unreachable in the running app.
- **Fix:** Added a "+ Add exercise" button to `app/(tabs)/exercises/index.tsx`'s toolbar row that calls `router.push('/exercises/new')`.
- **Files modified:** `app/(tabs)/exercises/index.tsx`
- **Verification:** `npx tsc --noEmit` (0 errors); route exists at `app/(tabs)/exercises/new.tsx` (Task 2)
- **Committed in:** `97bfecd` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 - missing critical functionality).
**Impact on plan:** Both additions were necessary for the plan's stated objective (a fully editable, reachable exercise library) to actually function end-to-end. No scope creep — both are minimal, follow established patterns, and stay within the plan's `files_modified` list except `db/exercises.ts`'s two extra exports, which extend rather than replace the existing module.

## Issues Encountered

None. `npx vitest run db/exercises.crud.test.ts` (10/10), `npx tsc --noEmit` (0 errors), and `npx vitest run` (full suite, 31/31) all pass cleanly on the final state.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None. All three tasks' acceptance criteria are fully implemented and verified — create, edit-in-place (including seeded rows), and reversible archive/unarchive are all wired end-to-end from UI to the parameterized query layer.

## Next Phase Readiness

- EXER-02 is fully delivered: the exercise library is now a complete, editable, durable data source — create, edit any row (seeded or custom), and archive/unarchive without ever hard-deleting.
- On-device create/edit/archive smoke testing is explicitly deferred to the Plan 06 device checkpoint per this plan's `<verification>` block and the phase's `human_verify_mode: end-of-phase` setting — all verification in this plan is automated (`tsc`, `vitest`).
- No blockers for Plan 06.

---
*Phase: 01-scaffold-data-foundation*
*Completed: 2026-07-21*

## Self-Check: PASSED

- All key files verified present on disk (`app/(tabs)/exercises/new.tsx`, `app/(tabs)/exercises/[id].tsx`, `db/exercises.ts`, `db/exercises.crud.test.ts`, `app/(tabs)/exercises/index.tsx`).
- All commit hashes verified present in `git log` (`102ba1a`, `1c3a4d4`, `08dc363`, `97bfecd`).
- Plan-level verification re-run clean: `npx vitest run db/exercises.crud.test.ts` (10/10 passed), `npx tsc --noEmit` (0 errors), `npx vitest run` (31/31 passed, full suite).
