---
phase: 06-programs-progression
plan: 03
subsystem: ui
tags: [expo-router, react-native, programs, ui]

# Dependency graph
requires:
  - phase: 06-programs-progression (Plan 02)
    provides: db/programs.ts CRUD/materialize/start-day data layer, data/bundledPrograms/* definitions
provides:
  - "app/programs/* route group: manager (index.tsx), detail ([programId].tsx), and training-maxes/new placeholders, all pre-registered in app/programs/_layout.tsx + app/_layout.tsx"
  - "Settings/More \"Programs\" nav row (D-01/D-17 placement)"
  - "Workout home \"Next in program\" card wired to loadActiveProgram + startWorkoutFromProgramDay"
  - "db/programs.ts#loadAllPrograms: per-program day count + Linear/Percent-TM/Mixed/Custom origin summary for the manager's list captions"
affects: [06-04-finish-flow-progression, 06-05-percent-tm-wiring, 06-06-custom-program-builder]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Programs manager/detail screens mirror app/measurements/index.tsx's appbar (‹ back + title, insets.top-padded) and useFocusEffect cancelled-guard reload convention"
    - "Add-a-program overlay reuses the pickerOverlay/pickerHeader pattern from app/(tabs)/index.tsx's history picker (full-screen overlay, ‹ Cancel/‹ Back header, bottom accent CTA)"
    - "Switch-active confirmation is a plain Alert.alert (non-destructive, Cancel/Switch) invoked before any materialize/set-active/day-start that would move a DIFFERENT program's pointer; skipped entirely when no program is currently active"

key-files:
  created:
    - app/programs/_layout.tsx
    - app/programs/index.tsx
    - app/programs/[programId].tsx
    - app/programs/training-maxes.tsx
    - app/programs/new.tsx
  modified:
    - app/_layout.tsx
    - app/(tabs)/settings.tsx
    - app/(tabs)/index.tsx
    - db/programs.ts
    - db/programs.crud.test.ts

key-decisions:
  - "Added db/programs.ts#loadAllPrograms (not in the plan's files_modified frontmatter list but explicitly instructed in the plan's Task 1 action text) — derives day count + a Linear/Percent-TM/Mixed/Custom origin label per program by scanning each day's template_exercises.progression JSON, mirroring listProgramTrainingMaxes's parse-and-skip-on-malformed-JSON convention"
  - "Add-a-program overlay's bundled-row tap opens an in-overlay read-only day preview (state-driven, not a separate route) with '‹ Back' replacing '‹ Cancel' in the header — matches UI-SPEC screen 3's 'read-only preview + bottom Add & start CTA' without adding a new pushed route"
  - "Non-active-program day-start and 'Set as active' both skip the switch-active confirmation when no program is currently active at all (nothing to switch from) — only prompt when a DIFFERENT program is active, per D-05's 'never silently advance' requirement applied literally"
  - "startWorkoutFromProgramDay (db/programs.ts, Plan 02) already calls setActiveProgram internally, so program-detail's day-tap handler only wraps it in the switch-active confirmation UX gate and never calls setActiveProgram itself"

patterns-established:
  - "Programs manager/detail reuse the exact appbar + row + pickerOverlay visual conventions already shipped in measurements/index.tsx and (tabs)/index.tsx, keeping this phase's new screens visually consistent with zero new UI primitives"

requirements-completed: [PROG-01, PROG-04]

# Metrics
duration: 55min
completed: 2026-07-23
---

# Phase 6 Plan 3: Programs UI Summary

**Programs manager (add bundled Linear 5x5 / Percent-Based Wave, switch-active confirmation), program detail (day list with ▶ Next badge, set-active, remove), and a "Next in program" card on Workout home — all wired to Plan 02's db/programs.ts data layer.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-07-23T23:34:00+05:30 (approx)
- **Completed:** 2026-07-23T23:52:00+05:30 (approx)
- **Tasks:** 3
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments
- `app/programs/_layout.tsx` pre-registers all four programs screens (`index`, `[programId]`, `training-maxes`, `new`) and `app/_layout.tsx` registers the group as a root Stack sibling — expo-router typed-routes resolves every `router.push` target this plan and Plans 05/06 use
- Settings/More gained a "🗓️ Programs" nav row (styled identically to the Body Measurements row) opening the manager
- `app/programs/index.tsx`: lists the single active program (accent "Active" pill) plus every other user-owned program (`{N} days · {origin}` captions via the new `loadAllPrograms`), with a full-width "+ Add a program" CTA opening an overlay of the two bundled programs (read-only day preview → "Add & start") and a "Build a custom program" link to the `new.tsx` placeholder
- `app/programs/[programId].tsx`: ordered day list (every day tappable, D-04) via `startWorkoutFromProgramDay`, a "▶ Next" badge on the pointer's day, "Set as active" and destructive "Remove program" actions — both non-active-program actions route through a non-destructive "Switch active program?" confirmation, skipped when no program is active yet
- Workout home (`app/(tabs)/index.tsx`) gained an own-cancelled-guard `useFocusEffect` loading the active program, rendering a `resumeCard`-styled "🗓️ {Program name}" / "Day {n} of {total}: {day label}" card (omitted entirely when no program is active, D-01) that starts the pointed day on tap
- `db/programs.ts#loadAllPrograms` (+ a new vitest case) added to support the manager's list captions, since Plan 02 didn't ship a bulk list-with-summary read

## Task Commits

Each task was committed atomically:

1. **Task 1: Programs route group + Settings nav row + programs manager screen** - `d8971ec` (feat)
2. **Task 2: Program detail screen (day list, tap any day, Next badge, set-active, remove)** - `71c4be7` (feat)
3. **Task 3: Next in program card on Workout home** - `88c9e18` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `app/programs/_layout.tsx` - Stack route-group layout (headerShown false), pre-registers all 4 screens
- `app/programs/index.tsx` - Programs manager: active section, program list, Add-a-program overlay (bundled preview + Add & start, switch-active confirmation, Build-a-custom-program link)
- `app/programs/[programId].tsx` - Program detail: day list, ▶ Next badge, Set as active, Remove program (destructive Alert), day-tap starts a workout via `startWorkoutFromProgramDay`
- `app/programs/training-maxes.tsx` - Minimal "Coming soon" placeholder (Plan 05 replaces)
- `app/programs/new.tsx` - Minimal "Coming soon" placeholder (Plan 06 replaces)
- `app/_layout.tsx` - Registers the `programs` route group as a root Stack sibling
- `app/(tabs)/settings.tsx` - Adds the "🗓️ Programs" nav row
- `app/(tabs)/index.tsx` - Adds the "Next in program" card (own useFocusEffect, resumeCard-styled, tap starts the pointed day)
- `db/programs.ts` - Adds `loadAllPrograms` (day count + origin summary per program)
- `db/programs.crud.test.ts` - Adds a test covering `loadAllPrograms`'s Linear vs Custom origin derivation

## Decisions Made
- `loadAllPrograms` was added to `db/programs.ts` even though it wasn't listed in the plan's frontmatter `files_modified` for Task 1 — the plan's own action text explicitly instructed adding it ("add a `loadAllPrograms(db)` to db/programs.ts if not present"), so this is plan-literal work, not scope creep.
- The Add-a-program overlay's bundled-program preview is implemented as in-overlay state (`previewBundle`) rather than a separate pushed route, keeping the overlay's back-stack simple (`‹ Back` vs `‹ Cancel` in the same header) while still matching UI-SPEC screen 3's read-only-preview-then-CTA anatomy.
- Program-detail's day-tap and "Set as active" handlers rely on `startWorkoutFromProgramDay`/`setActiveProgram` (Plan 02) already performing the actual pointer write — this plan's screens only gate those calls behind the switch-active confirmation UX, never duplicating the write.

## Deviations from Plan

None - plan executed exactly as written; the one addition (`loadAllPrograms`) was explicitly instructed by the plan's own Task 1 action text, not an unplanned deviation.

## Issues Encountered
- expo-router's typed-routes (`.expo/types/router.d.ts`) is only regenerated by the dev server (`expo start`), not `expo export` — a plain `npx tsc --noEmit` failed on the new `/programs/*` route literals until a short-lived `expo start` (killed once the file updated) regenerated it. This file is gitignored (`.expo/`), so no committed artifact was affected; documented here in case a future plan hits the same "typed-routes stale after adding a new route" friction.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `app/programs/*` is reachable end-to-end: More → Programs → Add a program → Linear 5x5 → Add & start → program detail with a day list; Workout home surfaces the "Next in program" card once a program is active.
- Plan 04 (finish-flow progression) can now rely on `workouts.programId`/`programDayPosition` being set on every program-day-started workout via this plan's UI paths.
- Plan 05 (%TM wiring) replaces `app/programs/training-maxes.tsx`'s placeholder with the functional TM-setup sheet; Plan 06 replaces `app/programs/new.tsx`'s placeholder with the custom-program builder.
- Full test suite (63 files / 505 tests) green under `--no-file-parallelism`; `tsc --noEmit` clean. No blockers for Plan 04.

---
*Phase: 06-programs-progression*
*Completed: 2026-07-23*

## Self-Check: PASSED

- FOUND: app/programs/_layout.tsx
- FOUND: app/programs/index.tsx
- FOUND: app/programs/[programId].tsx
- FOUND: app/programs/training-maxes.tsx
- FOUND: app/programs/new.tsx
- FOUND: d8971ec (Task 1 commit)
- FOUND: 71c4be7 (Task 2 commit)
- FOUND: 88c9e18 (Task 3 commit)
