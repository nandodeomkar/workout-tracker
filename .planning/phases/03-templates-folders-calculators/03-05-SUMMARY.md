---
phase: 03-templates-folders-calculators
plan: 05
subsystem: ui
tags: [expo-router, react-native, templates, folders, drizzle]

# Dependency graph
requires:
  - phase: 03-templates-folders-calculators (plan 03)
    provides: db/templates.ts data layer (createTemplate, updateTemplate, setTemplateExercises, loadTemplateDetail, loadTemplatesGroupedByFolder, loadFolderNames, startWorkoutFromTemplate)
  - phase: 03-templates-folders-calculators (plan 04)
    provides: app/tools route-group registration precedent (sibling Stack.Screen pattern) mirrored for app/templates
provides:
  - TemplateRow + FolderSectionHeader presentational components
  - Shared TemplateBuilderForm (create + edit) with folder tap-suggestions and reused exercise picker
  - app/templates route group (new.tsx, [templateId].tsx, _layout.tsx) registered in app/_layout.tsx
  - Workout-home folder-grouped, collapsible template list with start-from-template (writes workouts.template_id + copies exercises)
affects: [03-06 (calculator sheets wiring into active-workout, if any remaining home/template touch-points)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared builder body factored into one component (components/TemplateBuilderForm.tsx) imported by two thin expo-router wrapper files (new.tsx / [templateId].tsx), rather than duplicating form logic per the exercises new.tsx/[id].tsx precedent"
    - "Folder tap-suggestions reuse FilterChipRow's existing tap-to-select pattern directly (selected=[folder.trim()], onToggle=setFolder) instead of a bespoke chip component"
    - "Client-side per-template exercise-count resolution via loadTemplateDetail per row (N+1, single-user scale, matches threat model's accepted DoS disposition) since loadTemplatesGroupedByFolder does not carry a count"

key-files:
  created:
    - components/TemplateRow.tsx
    - components/FolderSectionHeader.tsx
    - components/TemplateBuilderForm.tsx
    - app/templates/_layout.tsx
    - app/templates/new.tsx
    - app/templates/[templateId].tsx
  modified:
    - app/_layout.tsx
    - app/(tabs)/index.tsx

key-decisions:
  - "Builder body factored into components/TemplateBuilderForm.tsx (a new file not listed in the plan frontmatter's files_modified) so the create/edit builder is genuinely shared rather than duplicated wholesale, per the task's own explicit instruction and RESEARCH.md Open Question 2"
  - "Template create position is scoped within the target folder bucket (Assumptions Log A5) — computed by counting existing templates already in that folder via loadTemplatesGroupedByFolder before insert"
  - "Per-template exercise counts resolved client-side (loadTemplateDetail per row) rather than adding a new db/templates.ts aggregation function, staying inside this task's declared file scope (app/(tabs)/index.tsx only)"
  - "Workout-home screen body wrapped in a ScrollView (templates list can grow unbounded) while the history-picker overlay stays an absolutely-positioned sibling of the ScrollView (not nested inside it), preserving its prior full-screen-overlay behavior"

patterns-established:
  - "Collapsible folder section header (Pressable row + count badge + rotating chevron) — first of its kind in this codebase, likely reusable if folder-style grouping appears elsewhere"

requirements-completed: [TMPL-01, TMPL-02]

# Metrics
duration: 14min
completed: 2026-07-22
---

# Phase 3 Plan 5: Template Builder + Folder List Summary

**Template create/edit builder (shared form component, folder tap-suggestions, reused exercise picker) plus a folder-grouped collapsible template list on Workout home that starts a workout from a template.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-22T12:56:32Z
- **Completed:** 2026-07-22T13:09:53Z
- **Tasks:** 3/3 completed
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments
- `TemplateRow`/`FolderSectionHeader` presentational components mirroring existing row/header anatomy (WorkoutRow, ExerciseCard header)
- A single shared `TemplateBuilderForm` powers both create (`app/templates/new.tsx`) and edit (`app/templates/[templateId].tsx`) — free-text Folder field with existing-folder tap chips (D-04), ordered exercise list with target-sets/target-reps steppers, remove, and up/down reorder controls, and the reused active-workout exercise-picker overlay
- Workout home now lists templates grouped under collapsible folder headers (Uncategorized last, default expanded) below the existing Start-empty/Start-from-history group; tapping a template calls `startWorkoutFromTemplate` (writes `workouts.template_id`, copies exercises in position order) and hands off to the active-workout screen

## Task Commits

Each task was committed atomically:

1. **Task 1: TemplateRow + FolderSectionHeader components** - `18cce23` (feat)
2. **Task 2: Template builder route (create + edit) + folder tap-suggestions** - `0b2690a` (feat)
3. **Task 3: Workout-home folder-grouped template list + start-from-template** - `ad7ad52` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `components/TemplateRow.tsx` - Template list row (glyph + name + exercise count + chevron)
- `components/FolderSectionHeader.tsx` - Collapsible folder header (title + count badge + chevron)
- `components/TemplateBuilderForm.tsx` - Shared create/edit builder body (name, folder + tap-suggestions, exercise list with steppers/reorder/remove, reused exercise picker, save via createTemplate/updateTemplate + setTemplateExercises)
- `app/templates/_layout.tsx` - Stack route group registration (headerShown off)
- `app/templates/new.tsx` - Thin route wrapper mounting `TemplateBuilderForm` in create mode
- `app/templates/[templateId].tsx` - Thin route wrapper mounting `TemplateBuilderForm` in edit mode, hydrated from the route param
- `app/_layout.tsx` - Registered `templates` as a pushed sibling Stack.Screen (no new bottom tab)
- `app/(tabs)/index.tsx` - Added folder-grouped, collapsible template list + "+ New template" entry point + start-from-template handler; wrapped screen body in a ScrollView

## Decisions Made
- Factored the builder body into a new `components/TemplateBuilderForm.tsx` file (not explicitly named in the plan's frontmatter `files_modified` list) because the task's own `<action>` text and RESEARCH.md Open Question 2 both require the create/edit builder to be genuinely shared, not duplicated across the two route files — see Deviations below.
- Template creation position is scoped per-folder (Assumptions Log A5): before insert, the builder counts existing templates already in the target folder bucket via `loadTemplatesGroupedByFolder` and uses that count as the new template's `position`.
- Per-template exercise counts on Workout home are resolved with one `loadTemplateDetail` call per template (client-side, N+1-shaped) rather than extending `db/templates.ts` with a new counting query — this keeps Task 3 inside its declared single-file scope (`app/(tabs)/index.tsx`) and matches the threat model's explicit "accept" disposition for folder-grouping render cost at single-user scale (T-03-15).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `components/TemplateBuilderForm.tsx` as a new shared file**
- **Found during:** Task 2 (Template builder route)
- **Issue:** The plan's frontmatter `files_modified` list only names `app/templates/_layout.tsx`, `app/templates/new.tsx`, `app/templates/[templateId].tsx`, and `app/_layout.tsx` — no new component file. But the task's own `<action>` text explicitly instructs "Factor the builder body into a shared component/function used by both `app/templates/new.tsx` ... and `app/templates/[templateId].tsx`", and the acceptance criteria state "the builder body is shared (not duplicated wholesale)". Duplicating the full builder (name/folder fields, exercise-picker overlay, steppers, save handlers) across two route files would directly contradict that instruction.
- **Fix:** Added `components/TemplateBuilderForm.tsx` containing the entire builder body; both `new.tsx` and `[templateId].tsx` became thin wrappers that import and render it with/without a `templateId` prop.
- **Files modified:** `components/TemplateBuilderForm.tsx` (new), `app/templates/new.tsx`, `app/templates/[templateId].tsx`
- **Verification:** `npx tsc --noEmit` and `npx vitest run` both green; both route files render correctly per their acceptance criteria (`grep -c 'name="templates"' app/_layout.tsx` = 1)
- **Committed in:** `0b2690a` (Task 2 commit)

**2. [Rule 1 - Bug/consequence] Acceptance-criteria grep for `loadFolderNames`/`createTemplate`/`updateTemplate`/`setTemplateExercises` "across the two route files" resolves to 0 in each route file individually**
- **Found during:** Task 2 self-verification
- **Issue:** The plan's acceptance criteria literally say to grep those symbols "across the two route files" (`app/templates/new.tsx`, `app/templates/[templateId].tsx`) — but per the deviation above, those calls now live exclusively in the shared `TemplateBuilderForm` component that both files import and render, so a literal per-file grep returns 0.
- **Fix:** None needed functionally — the calls are reachable and exercised through both routes exactly as required by the underlying requirement (TMPL-01 builder persistence + D-04 folder tap-suggestions); this is treated as an acceptance-criteria wording artifact of the plan's own explicit "share, don't duplicate" instruction, documented here rather than silently reverting to duplication just to satisfy a literal grep.
- **Files modified:** none (documentation-only note)
- **Verification:** `grep -c "loadFolderNames" components/TemplateBuilderForm.tsx` = 3; `grep -c "createTemplate\|updateTemplate" components/TemplateBuilderForm.tsx` = 6; `grep -c "setTemplateExercises" components/TemplateBuilderForm.tsx` = 5
- **Committed in:** `0b2690a` (Task 2 commit, same as above)

---

**Total deviations:** 2 (1 Rule 2 addition of a necessary shared file, 1 documentation note on an acceptance-criteria wording tension created by that same addition)
**Impact on plan:** No scope creep — both stem directly from following the plan's own explicit "shared, not duplicated" instruction for the builder body. No behavior, security, or requirement coverage is missing.

## Issues Encountered
None beyond the deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TMPL-01 is real end-to-end: create/edit templates with folders (free-text + tap-suggestions), target sets/reps per exercise, reorder/remove.
- TMPL-02 structure copy works: tapping a template starts a workout with its exercises in order and `workouts.template_id` set. Last-performance value pre-fill for template-started workouts (the remaining TMPL-02 half) lands in Plan 06 per the phase objective.
- No blockers for Plan 06 (calculator sheets / active-workout wiring) — this plan did not touch `app/active-workout/[workoutId].tsx` or `components/ExerciseCard.tsx`.

---
*Phase: 03-templates-folders-calculators*
*Completed: 2026-07-22*
