---
phase: 06-programs-progression
plan: 06
subsystem: ui
tags: [react-native, expo-router, drizzle, progression, template-builder, program-builder]

# Dependency graph
requires:
  - phase: 06-programs-progression (Plan 02)
    provides: template_exercises.progression column, TemplateExerciseInput.progression, db/programs.ts createProgram/addProgramDay/setActiveProgram
  - phase: 06-programs-progression (Plan 03)
    provides: app/programs/new.tsx placeholder route, Workout-home folder-grouped TemplateRow/FolderSectionHeader picker precedent
  - phase: 06-programs-progression (Plan 05)
    provides: app/programs/training-maxes.tsx TM-setup chain (programId query param)
provides:
  - Per-exercise progression authoring (None/Linear/%TM) in the shared template builder, writing the two locked JSON shapes into template_exercises.progression
  - Custom program builder screen assembling ordered existing templates into a program, chaining into TM-setup for %TM days
affects: [07-backup-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Display-unit-native local field state converted to canonical kg only at save/hydrate boundaries (Measurements-phase precedent) applied to the new linear-increment stepper"
    - "Folder-grouped TemplateRow/FolderSectionHeader picker (Workout-home pattern) reused verbatim in single-select mode for the program builder's + Add day picker"

key-files:
  created: []
  modified:
    - components/TemplateBuilderForm.tsx
    - app/programs/new.tsx

key-decisions:
  - "Linear-increment field stored as display-unit-native local state (default/step 2.5kg or 5lb, matching UI-SPEC literally) and converted to canonical kg only via displayToKg at save time / kgToDisplay at hydrate time — avoids float-drift from repeated unit conversions"
  - "AMRAP toggle only ever rendered/serialized on the last %TM set row; earlier rows never carry amrap:true regardless of prior state, enforced by index check at serialize time not by mutating removed rows"
  - "Unit setting resolved once in a single sequenced init effect BEFORE edit-mode hydrate runs (not as a separate effect keyed on `unit`), avoiding a re-fetch race that could clobber in-progress user edits if the setting resolved late"
  - "Custom-program %TM detection re-fetches loadTemplateDetail per distinct picked template id at save time (not cached from the add-day step), since progression data isn't part of the picker's lightweight exerciseCount projection"

patterns-established:
  - "Progression authoring sub-section nested inside TemplateBuilderForm's existing exerciseRow card, directly reusing MetricToggle/stepperGroup/reorderGroup styling rather than introducing new form primitives"

requirements-completed: [PROG-01]

# Metrics
duration: 20min
completed: 2026-07-23
---

# Phase 06 Plan 06: Progression Authoring + Custom Program Builder Summary

**Per-exercise Linear/%TM progression authoring added to the shared template builder, plus a new custom program builder screen that assembles ordered existing templates into an active program and chains into TM setup for %TM days.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-23
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `components/TemplateBuilderForm.tsx` gained a None/Linear/%TM progression selector per exercise row, with a linear increment stepper and a nested %TM per-set pct/reps/AMRAP editor, serializing to and hydrating from the exact `{type:"linear"}`/`{type:"percent_tm"}` JSON shapes
- `app/programs/new.tsx` replaced the Plan-03 "Coming soon" placeholder with a working custom program builder: name field, ordered/reorderable/removable day list, a folder-grouped template picker, and a Save flow that creates the program, adds its days in order, activates it, and routes to TM setup when any picked day has a %TM exercise

## Task Commits

Each task was committed atomically:

1. **Task 1: Per-exercise progression authoring in the template builder** - `ab9399f` (feat)
2. **Task 2: Custom program builder screen** - `c84961b` (feat)

**Plan metadata:** (pending — this commit)

## Files Created/Modified
- `components/TemplateBuilderForm.tsx` - Adds `progressionType`/`linearIncrementDisplay`/`percentTmSets` to `BuilderExerciseRow`, a `MetricToggle`-driven progression sub-section per exercise row, `hydrateProgression`/`serializeProgression` helpers, and a single sequenced init effect that resolves the display unit before edit-mode hydrate runs
- `app/programs/new.tsx` - Full custom program builder: name input, ordered day list with reorder/remove, folder-grouped single-select template picker (reuses `TemplateRow`/`FolderSectionHeader`), `programHasPercentTm` detection, and the create→activate→route flow

## Decisions Made
- Linear increment authored as a display-unit-native stepper (2.5kg/5lb default+step, per UI-SPEC screen 6 literally) rather than a canonical-kg stepper with converted step sizes — canonical `incrementKg` is only ever computed at the save/hydrate boundary via `displayToKg`/`kgToDisplay`, mirroring the Phase-5 Measurements-entry convention already used elsewhere in this codebase
- AMRAP is only ever true on the last %TM set at serialize time (an index check, not per-row mutation), so adding a new set behind a previously-AMRAP set silently drops that earlier set's AMRAP status on next save, matching the UI-SPEC's "AMRAP on last set only" contract without extra state-syncing logic
- The template builder's unit setting and folder-name load were merged into one sequenced init `useEffect` (unit resolves first, then edit-mode hydrate runs with that resolved unit) instead of two independent effects, to eliminate a race where a late-resolving unit setting would re-trigger `loadEdit` and overwrite in-progress user edits
- `app/programs/new.tsx`'s %TM detection re-queries `loadTemplateDetail` per distinct picked template id at save time rather than threading progression data through the picker's lightweight exercise-count projection, keeping the picker's data shape unchanged from the Workout-home precedent it borrows

## Deviations from Plan

None - plan executed as written. Both tasks matched their acceptance criteria exactly; no bugs, missing functionality, or blocking issues were discovered during implementation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 06 (Programs & Progression) is now feature-complete per its 6-plan roadmap: progression math (Plan 01), data layer + migrations (Plan 02), programs-manager/detail/bundled-picker UI (Plan 03), finish-screen progression application (Plan 04), TM-setup sheet (Plan 05), and this plan's progression authoring + custom program builder (Plan 06).
- `npx tsc --noEmit` is clean and the full vitest suite (515 tests, 63 files) passes with `--no-file-parallelism`.
- Manual device UAT (author a Linear/%TM rule on a template, build and save a custom program, confirm a %TM custom program routes into TM setup) is still owed per this plan's `<verification>` block — deferred to end-of-phase UAT, consistent with every other Phase-6 plan's SUMMARY.
- Ready for Phase 07 (Backup & Export), which per STATE.md's blockers note needs its own focused research pass before planning.

---
*Phase: 06-programs-progression*
*Completed: 2026-07-23*
