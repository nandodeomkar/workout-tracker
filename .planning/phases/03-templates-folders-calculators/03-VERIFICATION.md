---
phase: 03-templates-folders-calculators
verified: 2026-07-22T20:30:00Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "User can reopen an existing template in the builder to edit and re-save it (UAT Gap 1, closed by 03-07)"
    - "Marking a set as warm-up must not auto-start the rest timer when that set is logged (UAT Gap 2, closed by 03-08)"
    - "A logged set can be un-logged (reverted to pending) without deleting the whole exercise (UAT Gap 3, closed by 03-08)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "On Workout home, tap the ✎ edit icon on a template row. Confirm the builder opens hydrated with that template's name/folder/exercises/targets; edit a field, save, and confirm the change persists on return. Then tap the row body (not the icon) and confirm it still starts a new workout from the template."
    expected: "Edit icon opens the builder pre-filled; edits persist; row-body tap still starts a workout (unchanged)."
    why_human: "Nested-Pressable touch-responder behavior and screen re-hydration after save are RN runtime behaviors not verifiable by static analysis; code review (WR-01) also flagged the nested button as an accessibility concern worth confirming does not affect sighted-tap correctness."
  - test: "Mark a pre-filled set as warm-up via the W chip, then tap ✓ to log it. Confirm the rest timer does NOT start. Log a normal (non-warm-up) set and confirm the timer DOES start."
    expected: "Warm-up-then-log never starts the timer; normal log still does."
    why_human: "Timer auto-start is a live RN runtime behavior (setInterval/notification scheduling) that cannot be observed via grep; this is the exact defect UAT caught that static review missed initially."
  - test: "Log a normal set (tap ✓), then tap ✓ again on that same row. Confirm it reverts to an outline/pending checkmark, the exercise card and its other sets remain untouched, and the finish-workout volume/PR no longer counts that set. Re-tap ✓ to confirm it re-logs with the same weight/reps."
    expected: "Un-log removes exactly one set and reverts the row to pending; siblings and the card remain; re-logging works; volume/PR recompute correctly."
    why_human: "Requires live device state (rest timer, volume/PR aggregation across screens) and the exact double-tap sequence; code review (WR-02) also flagged a same-row rapid-double-tap race worth confirming does not misbehave under normal single-tap-at-a-time use."
---

# Phase 3: Templates, Folders & Calculators Verification Report

**Phase Goal:** Users can plan workouts ahead of time with reusable templates and get instant utility calculations during logging.
**Verified:** 2026-07-22T20:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after UAT gap closure (03-UAT.md defects closed by plans 03-07, 03-08)

## Context

This is a gap-closure re-verification. The prior 03-VERIFICATION.md (2026-07-22T13:42:17Z) passed all 5 ROADMAP success criteria at the code level but carried a `human_needed` status pending 9 deferred device checks. Those device checks were then run as UAT (03-UAT.md): 7 passed, 2 issues covering 3 defects:

1. **Gap 1 (Test 2, major):** Template edit-builder route (`app/templates/[templateId].tsx`) existed but was unreachable — tapping a template row only started a workout, with no edit affordance. Closed by plan 03-07.
2. **Gap 2 (Test 7, major):** Manually marking a pre-filled set as warm-up then logging it still auto-started the rest timer (guard checked only `mode === 'logging'`, not `row.isWarmup`). Closed by plan 03-08, Task 2.
3. **Gap 3 (Test 7, major):** A logged set could not be un-logged — re-tapping ✓ was a no-op; only whole-exercise removal existed. Closed by plan 03-08 (new `deleteSet` helper + un-log path), un-deferring design note D-01.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — regression check)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create, edit, and organize workout templates into folders | ✓ VERIFIED | Full CRUD unchanged (`db/templates.ts`); the previously-hidden defect (edit unreachable from Workout home) is now fixed — see Gap-Closure Truths below. |
| 2 | Starting a workout from a template pre-fills its exercises and last-performance values | ✓ VERIFIED | `startWorkoutFromTemplate` + `buildTemplatePrefillRows` unchanged by gap plans; UAT Test 8 passed on device. |
| 3 | User can save a completed workout as a new template | ✓ VERIFIED | `buildTemplateExercisesFromWorkout` + summary.tsx handler unchanged; UAT Test 9 passed on device. |
| 4 | User can open a plate calculator inline from the active workout to see plate loading for a target weight | ✓ VERIFIED | `PlateCalculatorSheet` wiring unchanged; UAT Test 7 confirmed plate icon/prefill working (only the warm-up-timer and un-log sub-behaviors on the same screen were defective, now fixed). |
| 5 | User can use a 1RM calculator and get warm-up set suggestions for a given working weight | ✓ VERIFIED | `OneRMCalculatorSheet`/`WarmupSuggestionSheet` unchanged; UAT Tests 5 and 7 confirmed correct computed values and warm-up-Accept insert; the warm-up-Accept-not-starting-timer behavior was already correct — only the separate manual-toggle-then-log path was defective (now fixed). |

**Score:** 5/5 ROADMAP truths still verified (no regressions from gap-closure plans).

### Gap-Closure Truths (from 03-UAT.md, closed by 03-07/03-08)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| G1 | From Workout home, the user can open an existing template in the builder, edit it, and re-save it | ✓ VERIFIED | `components/TemplateRow.tsx` adds optional `onEdit?: () => void` rendering a 44×44 "✎" `Pressable` (lines 38-47) nested inside the outer row `Pressable`; `app/(tabs)/index.tsx` (lines 372-377) wires `onEdit={() => router.push({ pathname: '/templates/[templateId]', params: { templateId: String(template.id) } })}`. The existing `/templates/[templateId].tsx` edit-builder route is confirmed present (`Glob` verified). RN touch-responder capture means the inner Pressable's press does not bubble to the outer row's `onPress`, so single-tap-to-start-workout is preserved (`onPress={() => void handlePickTemplate(template.id)}` at line 371, unchanged). |
| G2 | Marking a set as warm-up must not auto-start the rest timer when that set is logged | ✓ VERIFIED | `app/active-workout/[workoutId].tsx` line 578: `if (mode === 'logging' && !row.isWarmup) { ... void startRestTimer(seconds); }` — the `!row.isWarmup` guard was added exactly as the gap plan specified, matching `handleAcceptWarmup`'s existing no-timer intent. |
| G3 | A logged set can be un-logged (reverted to pending / removed) without deleting the whole exercise | ✓ VERIFIED | `db/workouts.ts` line 235: `export async function deleteSet(db, setId)` — single parameterized `db.delete(sets).where(eq(sets.id, setId))`. `app/active-workout/[workoutId].tsx` lines 522-553: re-tapping ✓ on a row with `setId != null` in logging mode now calls `deleteSet(db, row.setId)` then reverts the row in place (`setId: null, isCompleted: false`, fresh `p-${weId}-${Date.now()}` key) instead of the prior no-op. Does not touch sibling sets or the workout_exercise. |

**Score:** 3/3 gap-closure truths verified.

**Combined score:** 8/8 must-haves verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `components/TemplateRow.tsx` | Optional `onEdit` callback + edit-icon affordance | ✓ VERIFIED | 96 lines; `onEdit?: () => void` prop, conditionally-rendered edit `Pressable` with `accessibilityLabel`, 44×44 `editButton` style. |
| `app/(tabs)/index.tsx` | `onEdit` wired to `/templates/[templateId]` | ✓ VERIFIED | Line 372-377: `router.push({ pathname: '/templates/[templateId]', params: { templateId: String(template.id) } })`. |
| `db/workouts.ts` | `deleteSet(db, setId)` helper | ✓ VERIFIED | Line 235-237: single parameterized delete, matches spec exactly (contrast doc-commented against `removeWorkoutExercise`). |
| `db/workouts.crud.test.ts` | `deleteSet` unit tests | ✓ VERIFIED | `describe('deleteSet')` (lines 315-365): Test A (target-only delete, siblings intact) + Test B (crash-safe cold re-read via a second Drizzle instance) — both pass. |
| `app/active-workout/[workoutId].tsx` | Warm-up rest-timer guard + per-set un-log path | ✓ VERIFIED | `!row.isWarmup` guard (line 578) and un-log branch (lines 522-553) both present and match plan spec. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/(tabs)/index.tsx` | `/templates/[templateId]` | `router.push` in `TemplateRow`'s `onEdit` callback | ✓ WIRED | Confirmed at lines 372-377; route file exists (`app/templates/[templateId].tsx`). |
| `components/TemplateRow.tsx` `onEdit` prop | edit-icon `Pressable onPress` | nested Pressable, does not trigger outer row `onPress` | ✓ WIRED | Confirmed structurally (nested Pressable per RN responder semantics); code review (WR-01) confirms functionally correct, flags only an accessibility (TalkBack) reachability concern — not a navigation-correctness defect. |
| `app/active-workout/[workoutId].tsx` `handleLogSet` (setId != null, logging mode) | `db/workouts.ts` `deleteSet` | un-log: delete then revert row to pending | ✓ WIRED | Confirmed lines 536-548; `deleteSet(db, row.setId)` awaited, then `setRowsByWE` functional update reverts the row. |
| `handleLogSet` rest-timer auto-start block | `startRestTimer` | guarded by `mode === 'logging' && !row.isWarmup` | ✓ WIRED | Confirmed line 578. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TMPL-01 | 03-03, 03-05, 03-07 | Create/edit/organize templates in folders | ✓ SATISFIED | CRUD + builder unchanged; edit-builder route now reachable from Workout home via the new edit affordance (03-07 closes the previously-hidden gap). |
| TMPL-02 | 03-02, 03-03, 03-05, 03-06 | Start-from-template pre-fills exercises + last-performance | ✓ SATISFIED | Unchanged by gap plans; UAT Test 8 passed on device. |
| TMPL-03 | 03-02, 03-06 | Save completed workout as template | ✓ SATISFIED | Unchanged by gap plans; UAT Test 9 passed on device. |
| UTIL-01 | 03-01, 03-04, 03-06 | Plate calculator inline | ✓ SATISFIED | Unchanged by gap plans; UAT Test 7 confirmed plate-icon prefill working. |
| UTIL-02 | 03-01, 03-04, 03-06 | 1RM calculator | ✓ SATISFIED | Unchanged by gap plans; UAT Test 5 passed on device. |
| UTIL-03 | 03-01, 03-04, 03-06 | Warm-up set suggestions | ✓ SATISFIED | `WarmupSuggestionSheet`/`buildWarmupSets` unchanged; the fixed defects (manual-toggle timer bug, un-log) are adjacent active-workout logging behaviors (LOG-02/LOG-03, Phase 2 requirements regressed by Phase 3's warm-up feature), not UTIL-03 itself. |

No orphaned requirements — all 6 Phase 3 requirement IDs (TMPL-01/02/03, UTIL-01/02/03) declared across plan frontmatter (including 03-07/03-08 gap-closure plans, which additionally declare TMPL-01 and the Phase-2 regression IDs LOG-02/LOG-03 respectively) match REQUIREMENTS.md's Phase 3 traceability row. LOG-02/LOG-03 are correctly attributed to Phase 2 in REQUIREMENTS.md's traceability table; the 03-08 gap plan cites them because it fixes a Phase-3-introduced regression against those already-complete requirements, not because they are newly-claimed Phase 3 requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `components/TemplateRow.tsx` | 22-49 (WR-01, gap-closure code review) | Edit-icon `Pressable` nested inside the outer row `Pressable` that already declares `accessibilityRole`/`accessibilityLabel` | ⚠️ Warning | Screen-reader (TalkBack) users likely cannot reach the new edit affordance — the outer element is announced as a single focusable button and the inner one is typically merged/suppressed. Does NOT affect sighted-tap correctness (RN responder capture means the inner press wins, outer `onPress` does not fire). Flagged in code review with a concrete fix (sibling layout instead of nesting) but not applied; not a BLOCKER for the phase goal since the core reachability-for-sighted-users defect (UAT Gap 1) is closed. |
| `app/active-workout/[workoutId].tsx` | 515-586 (WR-02, gap-closure code review) | `handleLogSet` has no re-entrancy guard; Gap 3 turns ✓ into a toggle, so a fast double-tap on a *pending* row can fire two `insertSet` calls before the first state update commits, creating one untracked "phantom" set | ⚠️ Warning | Low-probability race requiring a fast double-tap; the delete/un-log branch itself is a safe no-op on double-invocation (only the insert branch is exposed). Flagged in gap-closure code review with a concrete fix (in-flight `Set<string>` ref guard) but not applied. Not a BLOCKER — normal single-tap-per-set use is unaffected; included as a human-verification prompt below to confirm no regression under ordinary use. |
| `app/active-workout/[workoutId].tsx` | 544 / 592 (IN-01, gap-closure code review) | `Date.now()`-based row key can theoretically collide on same-millisecond un-log/add | ℹ️ Info | Very low probability; documented in code review, not a phase-goal blocker. |
| `app/active-workout/[workoutId].tsx` | 536-548 (IN-02, gap-closure code review) | Un-log re-keying a row can leave a stale `editingTarget`/`openSheet` reference pointing at the old key | ℹ️ Info | Degrades gracefully (falls back to default/undefined prefill) rather than crashing; requires an unlikely simultaneous interaction; documented in code review, not a phase-goal blocker. |

No debt markers (TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER) found in any file modified by the gap-closure plans. No hardcoded hex colors. No stub `return null`/`{}`/`[]` patterns.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full vitest suite green (regression check) | `npx vitest run` | 23 files / 158 tests passed | ✓ PASS |
| `deleteSet` unit tests green | `npx vitest run db/workouts.crud.test.ts` | 19 tests passed, including new `describe('deleteSet')` block (target-only delete + crash-safe re-read) | ✓ PASS |
| Type-check clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| All claimed gap-closure task commits exist | `git log --oneline` | `da70a70`, `5f5bb7b`, `0d8e325` all present in history | ✓ PASS |
| Working tree clean (nothing uncommitted) | `git status` | "nothing to commit, working tree clean" | ✓ PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` and none are declared in any plan/summary.

### Human Verification Required

The 3 items below are narrowly scoped re-tests of exactly the defects UAT found and the gap plans fixed. All 3 are code-verified (artifacts exist, are substantive, and are wired to the correct data/state), and the gap-closure code review (03-REVIEW.md) found zero critical defects — but all three fixes touch live RN runtime behavior (touch-responder nesting, timer scheduling, cross-screen volume/PR recomputation) that static analysis cannot fully observe, and this is precisely the category of defect that was missed by the phase's initial code-level verification and only caught by device-based UAT. A quick device re-test closes the loop with confidence:

1. **Template edit affordance reachability** — tap ✎ opens the builder hydrated; edit + save persists; tapping the row body still starts a workout (unchanged). See human_verification frontmatter for full script.
2. **Warm-up manual-toggle rest-timer suppression** — mark a set warm-up via the W chip, log it, confirm no timer start; log a normal set, confirm timer does start.
3. **Per-set un-log round-trip** — log a set, re-tap ✓ to un-log (row reverts to pending, siblings/card untouched, volume/PR recompute), re-tap ✓ to re-log.

### Gaps Summary

No BLOCKER-level gaps found. All 3 UAT-identified defects (Gap 1: unreachable template edit; Gap 2: warm-up manual-toggle auto-starting the rest timer; Gap 3: no per-set un-log) are closed at the code level with implementations that precisely match each gap plan's specified fix, backed by passing unit tests (`deleteSet` describe block, 19/19) and a clean full-suite regression run (158/158 tests, 0 TypeScript errors). All 5 original ROADMAP success criteria remain verified with no regressions introduced by the gap-closure plans. The gap-closure code review (03-REVIEW.md) found 0 critical issues, 2 warnings (an accessibility nesting concern on the new edit button, and a same-row double-tap race that could create an untracked phantom set), and 2 info-level items — none block the phase goal, and none involve data loss or crashes; they are surfaced as anti-patterns above and folded into the human-verification prompts as things to watch for during device re-test.

Status is `human_needed` because the 3 fixes are UI/runtime behaviors (touch-responder nesting, live timer scheduling, cross-screen recomputation) that — per this same phase's prior experience — are exactly the category of defect static/code-level verification can miss. A short, targeted device re-test of the 3 specific UAT scenarios is recommended before fully closing the phase's UAT sign-off.

---

*Verified: 2026-07-22T20:30:00Z*
*Verifier: Claude (gsd-verifier)*
