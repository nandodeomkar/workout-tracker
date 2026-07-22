---
phase: 03-templates-folders-calculators
plan: 07
subsystem: ui
tags: [expo-router, react-native, templates]

# Dependency graph
requires:
  - phase: 03-templates-folders-calculators
    provides: TemplateBuilderForm edit-mode route (app/templates/[templateId].tsx), Workout home template list (Plan 03/06)
provides:
  - Edit-icon affordance on TemplateRow (optional onEdit callback)
  - Workout home wiring from template row to the existing /templates/[templateId] builder edit route
affects: [03-templates-folders-calculators UAT re-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional-callback affordance pattern (icon renders only when parent supplies callback) reused from ExerciseCard.tsx for TemplateRow's edit icon"

key-files:
  created: []
  modified:
    - components/TemplateRow.tsx
    - app/(tabs)/index.tsx

key-decisions:
  - "Edit icon is a nested Pressable placed just before the trailing chevron, inside the outer row Pressable — RN responder behavior means its press does not bubble to the row's onPress, preserving single-tap-to-start-workout with no extra guard logic needed"

patterns-established:
  - "Optional onEdit?: () => void callback convention: parent only renders/wires the affordance when it supplies the callback, keeping the row component's own logic conditional-free besides the ternary render"

requirements-completed: [TMPL-01]

# Metrics
duration: 4min
completed: 2026-07-22
---

# Phase 03 Plan 07: Template Edit Affordance Summary

**Reconnected the existing template edit-builder route by adding an edit-icon affordance to TemplateRow, wired to `/templates/[templateId]` from Workout home.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-22T14:34:45Z
- **Completed:** 2026-07-22T14:37:57Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- TemplateRow now exposes an optional `onEdit` callback and renders a 44x44 "✎" edit-icon Pressable when supplied, following the ExerciseCard optional-affordance convention
- Workout home wires `onEdit` to `router.push({ pathname: '/templates/[templateId]', params: { templateId: String(template.id) } })`, matching the typed-route object form already used for `/active-workout/[workoutId]`
- Single-tap-row-to-start-workout behavior is unchanged — the edit icon is a nested Pressable, so React Native's responder system captures its press before it can bubble to the outer row's onPress
- Closes UAT Gap 1 (Test 2, major): the working `TemplateBuilderForm` edit mode was previously unreachable from Workout home

## Task Commits

Each task was committed atomically:

1. **Task 1: Add edit affordance to TemplateRow and wire it to the edit route** - `da70a70` (feat)

**Plan metadata:** (pending — this docs commit)

## Files Created/Modified
- `components/TemplateRow.tsx` - Added optional `onEdit?: () => void` prop and a conditionally-rendered edit-icon Pressable (✎, 44x44 min touch target) placed before the trailing chevron
- `app/(tabs)/index.tsx` - Passed `onEdit` to each rendered `TemplateRow`, routing to the existing `/templates/[templateId]` builder edit route with the template's id

## Decisions Made
- Followed the plan's exact convention reference (ExerciseCard.tsx optional-affordance pattern) rather than introducing a new pattern — no deviation from plan's explicit instruction

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npx tsc --noEmit` passed cleanly on the first attempt with no type errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT Test 2's gap ("no way to open [a template] in the builder") is now closed at the code level; a physical-device re-test of the create → edit → re-save round-trip (per the plan's human-check) is recommended before closing out UAT Gap 1 fully.
- No blockers for the remaining gap-closure plan (03-08) or subsequent phase work.

---
*Phase: 03-templates-folders-calculators*
*Completed: 2026-07-22*

## Self-Check: PASSED

- FOUND: components/TemplateRow.tsx
- FOUND: app/(tabs)/index.tsx
- FOUND: .planning/phases/03-templates-folders-calculators/03-07-SUMMARY.md
- FOUND: da70a70 (commit exists in git log)
