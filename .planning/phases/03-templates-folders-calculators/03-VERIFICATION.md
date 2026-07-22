---
phase: 03-templates-folders-calculators
verified: 2026-07-22T13:42:17Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "A folder header shows title + count + a chevron that flips on tap; template rows read like history rows."
    expected: "Chevron flips, count badge accurate, rows visually consistent with WorkoutRow"
    why_human: "RN gesture/visual rendering — no automated RN render test in this project (vitest is logic-only)"
  - test: "Create a template: name it, pick 2 exercises, set target sets/reps, type a new folder name (confirm existing folders appear as tap chips), save. Reopen it in the builder and confirm fields hydrate; edit and re-save."
    expected: "Builder persists and re-hydrates correctly on edit"
    why_human: "End-to-end device flow across screens with real user input"
  - test: "Workout home shows templates under collapsible folder headers (Uncategorized last); collapsing/expanding works; tapping a template opens a new active workout containing that template's exercises in order; \"+ New template\" opens the builder."
    expected: "Folder grouping/collapse UI behaves correctly; tap-to-start works"
    why_human: "RN list/section UI + navigation, no automated render test"
  - test: "In More: a Barbell weight row shows 20 (kg) / 45 (lb) by default, steps and persists across app relaunch; switching Units switches which bar weight is shown. PlateCalculatorSheet shows correct per-side plates and a nearest-achievable delta for a non-loadable weight."
    expected: "Setting persists across relaunch; sheet renders correct plate breakdown visually"
    why_human: "Cross-relaunch persistence + visual rendering can't be verified via grep/vitest"
  - test: "OneRMCalculatorSheet: entering 140x5 shows ~163 est-1RM and a %-of-1RM table. WarmupSuggestionSheet renders the Bar/40/60/80 ladder with plate-rounded weights and per-row Accept."
    expected: "Correct computed values rendered visually; Accept buttons work"
    why_human: "Visual RN rendering of computed table/ladder"
  - test: "More shows a Tools section with Plate calculator + 1RM calculator rows; each pushes a full-screen calculator with a working Back control; the 5-tab layout is unchanged (no phantom Tools tab)."
    expected: "Navigation works; no 6th tab appears"
    why_human: "Navigation/UI verification requires running the app"
  - test: "On an exercise card: plate icon opens the plate sheet prefilled with the current weight; 1RM icon opens the 1RM sheet prefilled with weight x reps; warm-up icon opens the ladder and each Accept inserts a warmup set row (visibly excluded from volume/PR on the summary). Rest timer does not auto-start on a warm-up accept."
    expected: "Inline affordances open correct sheets prefilled; warmup insert excluded from volume/PR; no rest-timer auto-start"
    why_human: "Multi-screen device flow involving timers, persistence, and summary aggregation — not verifiable by static analysis alone"
  - test: "Start a workout from a template containing (a) an exercise with prior history and (b) a never-performed exercise: the historied exercise's rows pre-fill from last performance (row count = template target_sets), and the never-done exercise falls back to the template target_reps (weight 0 when target_weight_kg is null). Non-template workouts pre-fill exactly as before."
    expected: "Correct per-exercise pre-fill behavior on a real device with real history data"
    why_human: "Requires seeded history data + device flow; wiring is code-verified but behavior with real data needs human confirmation"
  - test: "Finish a workout that has warm-up + working sets; tap Save as template; confirm the toast, then open Workout home / the builder and verify the new template captured the exercises with working-set counts (warm-ups excluded) and null weights."
    expected: "Template captured correctly; warm-ups excluded; toast confirms"
    why_human: "End-to-end save + re-open verification across three screens"
---

# Phase 3: Templates, Folders & Calculators Verification Report

**Phase Goal:** Users can plan workouts ahead of time with reusable templates and get instant utility calculations during logging.
**Verified:** 2026-07-22T13:42:17Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create, edit, and organize workout templates into folders | ✓ VERIFIED | `db/templates.ts` full CRUD (createTemplate/updateTemplate/deleteTemplate/addTemplateExercise/setTemplateExercises), `components/TemplateBuilderForm.tsx` (669 lines, shared create/edit builder with folder free-text + `loadFolderNames` tap-suggestion chips), `app/templates/new.tsx` + `app/templates/[templateId].tsx` route wrappers, `loadTemplatesGroupedByFolder` groups by folder with Uncategorized last. All 6 crud/query tests pass (18 cases, 44 assertions across the phase's lib+db test files). |
| 2 | Starting a workout from a template pre-fills its exercises and last-performance values | ✓ VERIFIED | `startWorkoutFromTemplate` (db/templates.ts:361-372) copies template_exercises in position order + sets `workouts.template_id`. `app/active-workout/[workoutId].tsx` `loadAll` (lines 227-282) loads the template detail once, builds an exerciseId→target map, and for never-yet-logged cards calls `buildTemplatePrefillRows(templateTarget, history)` where history is `loadLastPerformance` filtered to non-warmup — real data flow traced end to end, not hardcoded. Non-template `loadPrefillRows` path is untouched (confirmed by grep + diff scope). |
| 3 | User can save a completed workout as a new template | ✓ VERIFIED | `app/active-workout/summary.tsx` "Save as template" handler (lines 163-186) calls `buildTemplateExercisesFromWorkout` (warmups excluded, targetWeightKg always null, last-set reps as typical reps) then `createTemplate` + `addTemplateExercise` in a loop. `lib/templateCapture.test.ts` proves warm-up exclusion + null-weight + all-warmup edge case. |
| 4 | User can open a plate calculator inline from the active workout to see plate loading for a target weight | ✓ VERIFIED | `components/ExerciseCard.tsx` exposes `onOpenPlateCalculator` callback rendered as a 44x44 icon Pressable; `app/active-workout/[workoutId].tsx` wires it (`onOpenPlateCalculator={() => handleOpenSheet('plate', entry.weId)}`), mounts `PlateCalculatorSheet` once at screen level with `initialWeightDisplay` derived from the live `openSheetRow` state (the card's current row) — traced to real state, not a stub. `solvePlates` (lib/plateSolver.ts) correctly implements per-side greedy breakdown with fp-drift guards and below-bar handling; 8 test cases pass. |
| 5 | User can use a 1RM calculator and get warm-up set suggestions for a given working weight | ✓ VERIFIED | `OneRMCalculatorSheet` (reuses `estimate1RM` Epley + new `percentOf1RM` NSCA table) and `WarmupSuggestionSheet` (`buildWarmupSets` ladder with `onAccept`) both mounted inline in active-workout and reachable standalone via `app/tools/*`. Warm-up accept persists via `insertSet(..., type: 'warmup')` (grep-confirmed), does not auto-start rest timer (code-reviewed, confirmed by inspection of `handleAcceptWarmup`). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `lib/plateSolver.ts` | solvePlates + PLATE_SET_KG/LB | ✓ VERIFIED | 63 lines, exports match spec, 8 passing tests, zero RN/Drizzle imports |
| `lib/warmupLadder.ts` | buildWarmupSets, imports solvePlates | ✓ VERIFIED | 42 lines, imports `solvePlates` from `./plateSolver`, 4 passing tests |
| `lib/percentOf1RM.ts` | percentOf1RM NSCA table | ✓ VERIFIED | 40 lines, 11-row NSCA table matches spec, does not import estimate1RM, 3 passing tests |
| `lib/templatePrefill.ts` | buildTemplatePrefillRows | ✓ VERIFIED | 54 lines, 5 passing tests (exact/short/long/null-fallback cases) |
| `lib/templateCapture.ts` | buildTemplateExercisesFromWorkout | ✓ VERIFIED | 56 lines, 6 passing tests (warmup exclusion, null weight, all-warmup edge case) |
| `db/templates.ts` | Full template CRUD + queries + start-from-template | ✓ VERIFIED | 372 lines, all 9 exported functions present, detach-before-delete transaction correctly ordered (verified by reading source), 18 passing db-layer tests |
| `components/PlateCalculatorSheet.tsx` | Plate breakdown sheet | ✓ VERIFIED | 181 lines, calls solvePlates, no hardcoded hex, wired inline + standalone |
| `components/OneRMCalculatorSheet.tsx` | 1RM + %-table sheet | ✓ VERIFIED | 184 lines, reuses estimate1RM + percentOf1RM, no hardcoded hex |
| `components/WarmupSuggestionSheet.tsx` | Warm-up ladder sheet | ✓ VERIFIED | 141 lines, calls buildWarmupSets, exposes onAccept, no hardcoded hex |
| `components/TemplateRow.tsx` / `FolderSectionHeader.tsx` | Presentational list components | ✓ VERIFIED | 73/74 lines, no db/ imports, no hardcoded hex |
| `components/TemplateBuilderForm.tsx` | Shared create/edit builder | ✓ VERIFIED | 669 lines (undeclared in plan frontmatter but explicitly required by the plan's own `<action>` text to avoid duplication — documented deviation, not a gap) |
| `app/templates/*` , `app/tools/*` route files | Standalone/pushed routes | ✓ VERIFIED | All exist, registered as siblings in `app/_layout.tsx` (`name="templates"`, `name="tools"`), no phantom 6th tab |
| Settings keys `bar_weight_kg` / `bar_weight_lb` | Independent barbell-weight persistence | ✓ VERIFIED | Both keys read/written independently in `app/(tabs)/settings.tsx`, never cross-converted |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lib/warmupLadder.ts` | `lib/plateSolver.ts#solvePlates` | import | ✓ WIRED | `import { solvePlates } from './plateSolver'` confirmed |
| `components/PlateCalculatorSheet.tsx` | `lib/plateSolver.ts#solvePlates` | import + call | ✓ WIRED | Called with active-unit bar weight, result rendered |
| `components/OneRMCalculatorSheet.tsx` | `estimate1RM` + `percentOf1RM` | import + call | ✓ WIRED | Both imported and called; Epley not reimplemented |
| `components/WarmupSuggestionSheet.tsx` | `buildWarmupSets` + `onAccept` | import + callback | ✓ WIRED | Ladder rendered, Accept emits `onAccept({weight, reps})` |
| `app/(tabs)/settings.tsx` | `bar_weight_kg`/`bar_weight_lb` | getSetting/setSetting | ✓ WIRED | Independent read/write, no cross-conversion |
| `app/_layout.tsx` | `app/tools` + `app/templates` route groups | Stack.Screen | ✓ WIRED | Both registered as siblings |
| `app/(tabs)/index.tsx` | `db/templates.ts#loadTemplatesGroupedByFolder` | useFocusEffect load | ✓ WIRED | Called in load effect, rendered via FolderSectionHeader/TemplateRow |
| `app/(tabs)/index.tsx` | `db/templates.ts#startWorkoutFromTemplate` | tap handler | ✓ WIRED | Called on template row tap, workout created and navigated to |
| `app/templates/[templateId].tsx` (via TemplateBuilderForm) | `db/templates.ts#loadFolderNames` | tap-suggestions | ✓ WIRED | 3 call sites in TemplateBuilderForm.tsx |
| `db/templates.ts#deleteTemplate` | `workouts.template_id` | detach-before-delete | ✓ WIRED | `tx.update(workouts).set({templateId: null})` runs before `tx.delete(templateExercises)`/`tx.delete(templates)`, proven by a passing regression test |
| `app/active-workout/[workoutId].tsx` | PlateCalculatorSheet/OneRMCalculatorSheet/WarmupSuggestionSheet | sheet-open state, prefilled | ✓ WIRED | `openSheetRow` derived from live `rowsByWE` state, passed as `initialWeightDisplay`/`initialReps`/`workingWeightDisplay` — traced to real per-card row data |
| `app/active-workout/[workoutId].tsx` | `lib/templatePrefill.ts#buildTemplatePrefillRows` + `db/templates.ts#loadTemplateDetail` | loadAll merge | ✓ WIRED | Called when `workout.templateId != null`; history filtered `!== 'warmup'` before merge |
| `app/active-workout/[workoutId].tsx` | `db/workouts.ts#insertSet type warmup` | onAccept handler | ✓ WIRED | `type: 'warmup'` present in `handleAcceptWarmup` |
| `app/active-workout/summary.tsx` | `lib/templateCapture.ts` + `db/templates.ts#createTemplate/addTemplateExercise` | Save as template handler | ✓ WIRED | `buildTemplateExercisesFromWorkout` → `createTemplate` → `addTemplateExercise` loop, `targetWeightKg: null` confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `app/(tabs)/index.tsx` template list | `groups` (FolderSectionHeader/TemplateRow) | `loadTemplatesGroupedByFolder(db)` — real `db.select().from(templates)` query, JS-side grouping | Yes | ✓ FLOWING |
| `PlateCalculatorSheet`/`OneRMCalculatorSheet`/`WarmupSuggestionSheet` (inline) | `initialWeightDisplay`/`initialReps`/`workingWeightDisplay` | `openSheetRow` derived from `rowsByWE[openSheet.weId]` live component state | Yes | ✓ FLOWING |
| Active-workout template pre-fill rows | `nextRows[workoutExercise.id]` | `buildTemplatePrefillRows(templateTarget, history)` where `history` comes from `loadLastPerformance(db, exerciseId)` — real DB query | Yes | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TMPL-01 | 03-03, 03-05 | Create/edit/organize templates in folders | ✓ SATISFIED | db/templates.ts CRUD + TemplateBuilderForm + folder-grouped list |
| TMPL-02 | 03-02, 03-03, 03-05, 03-06 | Start-from-template pre-fills exercises + last-performance | ✓ SATISFIED | startWorkoutFromTemplate (structure copy) + buildTemplatePrefillRows (value merge) both wired |
| TMPL-03 | 03-02, 03-06 | Save completed workout as template | ✓ SATISFIED | buildTemplateExercisesFromWorkout + summary.tsx Save-as-template handler |
| UTIL-01 | 03-01, 03-04, 03-06 | Plate calculator inline | ✓ SATISFIED | solvePlates + PlateCalculatorSheet, inline + standalone |
| UTIL-02 | 03-01, 03-04, 03-06 | 1RM calculator | ✓ SATISFIED | estimate1RM + percentOf1RM + OneRMCalculatorSheet, inline + standalone |
| UTIL-03 | 03-01, 03-04, 03-06 | Warm-up set suggestions | ✓ SATISFIED | buildWarmupSets + WarmupSuggestionSheet, one-tap-insert as `type: 'warmup'` |

No orphaned requirements — all 6 phase requirement IDs (TMPL-01/02/03, UTIL-01/02/03) declared across plan frontmatter match REQUIREMENTS.md's Phase 3 traceability row exactly.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `db/templates.ts` | 361-372 | `startWorkoutFromTemplate` stamps `workouts.template_id` even when `loadTemplateDetail` returns `undefined` (template deleted between list-load and tap) | ℹ️ Info (pre-flagged in 03-REVIEW.md as WR-07) | Rare race condition; the workout still creates successfully with zero exercises and a dangling-looking templateId. Does not block the phase goal — the active-workout screen already handles a missing template gracefully by falling through to normal pre-fill (verified in `loadAll`). Not a data-loss or crash bug. |
| `app/(tabs)/index.tsx` | multiple handlers | Independent in-flight guards on Start-empty/Start-from-history/Start-from-template (WR-02 in 03-REVIEW.md) | ℹ️ Info | Rapid double-tap across different start affordances could create two workout rows. Pre-existing/adjacent to this phase's template-start addition; already documented in code review as a warning, not a phase-goal blocker. |
| `app/active-workout/summary.tsx` | 153-186 | "Save as template" has no post-success idempotency latch (WR-03 in 03-REVIEW.md) | ℹ️ Info | Repeated taps after a successful save could create duplicate templates. Documented in code review; does not prevent the core save-as-template capability from working correctly on a single tap. |

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) found in any phase-modified file. No hardcoded hex colors in any new component. No stub `return null`/`{}`/`[]` patterns beyond legitimate `if (!visible) return null` sheet guards specified by the plans themselves.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full vitest suite green | `npx vitest run` | 23 files / 156 tests passed | ✓ PASS |
| Phase-03-specific test files green | `npx vitest run db/templates.crud.test.ts db/templates.query.test.ts lib/plateSolver.test.ts lib/warmupLadder.test.ts lib/percentOf1RM.test.ts lib/templatePrefill.test.ts lib/templateCapture.test.ts` | 7 files / 44 tests passed | ✓ PASS |
| Type-check clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| All claimed task commits exist | `git log --oneline --all \| grep -E "<21 hashes>"` | All 21 commit hashes found | ✓ PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` and none are declared in any plan/summary.

### Human Verification Required

The following items were deferred from `checkpoint:human-verify` to end-of-phase (per `human_verify_mode: end-of-phase`) via `<human-check>` blocks embedded in the plans. None can be verified by static analysis — they require a running device/emulator:

1. **Folder header + template row visuals** — chevron flip on tap, count badge accuracy, visual consistency with WorkoutRow (RN gesture/render UI).
2. **Template builder create/edit round-trip** — creating a template, tap-suggestion chips for existing folders, reopening the builder and confirming field hydration.
3. **Workout-home collapsible folder list** — expand/collapse behavior, Uncategorized-last ordering, tap-to-start-workout navigation.
4. **Barbell-weight setting persistence across app relaunch** — 20kg/45lb defaults, stepping, unit-switch behavior; PlateCalculatorSheet visual correctness for a non-loadable weight.
5. **OneRMCalculatorSheet / WarmupSuggestionSheet computed-value rendering** — 140x5 → ~163 1RM + %-table; Bar/40/60/80 ladder with plate-rounded weights.
6. **Tools section navigation** — More → Tools rows push correctly; confirm no phantom 6th tab appears.
7. **Inline calculator affordances end-to-end** — plate/1RM icons prefilled from the current row; warm-up Accept inserts a row visibly excluded from volume/PR on the summary screen; rest timer does not auto-start on warm-up accept.
8. **Template value pre-fill on a real device with seeded history** — historied exercise pre-fills real last-performance numbers (row count = target_sets); never-done exercise falls back to target reps/weight 0; non-template workouts behave exactly as Phase 2.
9. **Save-as-template round-trip** — finishing a workout with warm-ups + working sets, tapping Save as template, confirming the toast, and re-opening the captured template to verify structure (warm-ups excluded, null weights).

### Gaps Summary

No BLOCKER-level gaps found. All 5 ROADMAP success criteria are code-verified with real, wired, non-stub implementations: full test suite green (156/156), zero TypeScript errors, all key links traced to real data sources (not hardcoded/hollow), and all 6 phase requirement IDs satisfied with no orphans. Three WARNING/INFO-level findings carried over from the phase's own code review (03-REVIEW.md WR-02/WR-03/WR-07) describe edge-case robustness gaps (duplicate-workout race, duplicate-template race, dangling templateId on delete-race) — none of these prevent the phase goal from being observably true in the codebase, and none involve data loss or crashes.

Status is `human_needed` solely because 9 device-only UI/UX verification items were deliberately deferred to end-of-phase per the phase's `human_verify_mode: end-of-phase` configuration — this is expected process, not a code gap. All automated checks (tests, types, wiring, data-flow) pass.

---

*Verified: 2026-07-22T13:42:17Z*
*Verifier: Claude (gsd-verifier)*
