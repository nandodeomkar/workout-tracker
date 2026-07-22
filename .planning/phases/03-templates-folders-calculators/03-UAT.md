---
status: complete
phase: 03-templates-folders-calculators
source: [03-VERIFICATION.md]
started: 2026-07-22T13:42:17Z
updated: 2026-07-22T14:22:49Z
---

## Current Test

[testing complete]

## Tests

### 1. Folder header + template row rendering
expected: A folder header shows title + count + a chevron that flips on tap; template rows read like history rows. Chevron flips, count badge accurate, rows visually consistent with WorkoutRow.
result: pass

### 2. Create / edit template round-trip
expected: Create a template (name, 2 exercises, target sets/reps, type a new folder name — existing folders appear as tap chips), save. Reopen in the builder and confirm fields hydrate; edit and re-save. Builder persists and re-hydrates correctly on edit.
result: issue
reported: "Couldn't edit the template. Tapping it directly starts a new workout — no way to open it in the builder."
severity: major

### 3. Workout-home folder grouping + tap-to-start
expected: Workout home shows templates under collapsible folder headers (Uncategorized last); collapse/expand works; tapping a template opens a new active workout with that template's exercises in order; "+ New template" opens the builder.
result: pass

### 4. Barbell-weight setting persistence + plate sheet
expected: In More, a Barbell weight row shows 20 (kg) / 45 (lb) by default, steps and persists across app relaunch; switching Units switches which bar weight is shown. PlateCalculatorSheet shows correct per-side plates and a nearest-achievable delta for a non-loadable weight.
result: pass

### 5. 1RM + warm-up sheets computed values
expected: OneRMCalculatorSheet — entering 140x5 shows ~163 est-1RM and a %-of-1RM table. WarmupSuggestionSheet renders the Bar/40/60/80 ladder with plate-rounded weights and per-row Accept.
result: pass
note: 1RM sheet verified (140x5 -> ~163 + %-table). Warm-up ladder is inline-only (opened from an exercise card during an active workout — WarmupSuggestionSheet has no standalone Tools entry by design); its rendering is verified under Test 7.

### 6. Tools section navigation (no phantom tab)
expected: More shows a Tools section with Plate calculator + 1RM calculator rows; each pushes a full-screen calculator with a working Back control; the 5-tab layout is unchanged (no phantom Tools tab).
result: pass

### 7. Inline exercise-card calculator affordances
expected: On an exercise card — plate icon opens the plate sheet prefilled with current weight; 1RM icon opens the 1RM sheet prefilled with weight x reps; warm-up icon opens the ladder and each Accept inserts a warmup set row (visibly excluded from volume/PR on the summary). Rest timer does not auto-start on a warm-up accept.
result: issue
reported: "Everything works except if I click on an already existing set to mark it as a warmup, it starts the timer when I log that set. Also logged sets cannot be unlogged."
severity: major
note: Plate/1RM/warm-up icons, prefill, warm-up-Accept insert, and warm-up-Accept NOT starting the timer all verified working. Two defects found (see Gaps: test 7).

### 8. Start-from-template pre-fill with real history
expected: Start a workout from a template with (a) an exercise with prior history and (b) a never-performed exercise — the historied exercise's rows pre-fill from last performance (row count = template target_sets); the never-done exercise falls back to template target_reps (weight 0 when target_weight_kg is null). Non-template workouts pre-fill exactly as before.
result: pass

### 9. Save-as-template capture from finished workout
expected: Finish a workout with warm-up + working sets; tap Save as template; confirm the toast, then open Workout home / the builder and verify the new template captured the exercises with working-set counts (warm-ups excluded) and null weights.
result: pass

## Summary

total: 9
passed: 7
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "User can reopen an existing template in the builder to edit and re-save it"
  status: failed
  reason: "User reported: tapping a template starts a new workout; there is no way to open it in the builder to edit"
  severity: major
  test: 2
  root_cause: "app/(tabs)/index.tsx TemplateRow onPress is wired only to handlePickTemplate (startWorkoutFromTemplate). No UI entry point navigates to the /templates/[templateId] edit route — no edit icon, long-press, or overflow menu. TemplateRow.tsx exposes only label/exerciseCount/onPress. The edit-builder route app/templates/[templateId].tsx exists and is functional but is unreachable."
  artifacts:
    - path: "app/(tabs)/index.tsx"
      issue: "TemplateRow rendered with single onPress=handlePickTemplate; no edit affordance / no push to /templates/[templateId]"
    - path: "components/TemplateRow.tsx"
      issue: "Row exposes only onPress (start). No secondary edit action prop."
  missing:
    - "Add an edit entry point on the template row (edit icon, long-press, or overflow menu) that router.push('/templates/[templateId]')"
    - "Thread an onEdit (or similar) prop through TemplateRow to reach the existing edit builder route"
  debug_session: ""

- truth: "Marking a set as warm-up must not auto-start the rest timer when that set is logged"
  status: failed
  reason: "User reported: clicking an existing (pre-filled) set to mark it a warm-up, then logging it, still starts the rest timer"
  severity: major
  test: 7
  root_cause: "handleLogSet in app/active-workout/[workoutId].tsx (~line 552) auto-starts the rest timer for any not-yet-persisted row logged in logging mode: `if (mode === 'logging') { ... void startRestTimer(seconds) }`. It does NOT check row.isWarmup. The dedicated handleAcceptWarmup path deliberately skips the timer, but the manual toggle-to-warmup (handleToggleWarmup) followed by a checkmark tap routes through handleLogSet, which fires the timer regardless of warm-up status."
  artifacts:
    - path: "app/active-workout/[workoutId].tsx"
      issue: "handleLogSet rest-timer auto-start block (~L552) lacks a !row.isWarmup guard"
  missing:
    - "Guard the auto-start: if (mode === 'logging' && !row.isWarmup) { void startRestTimer(seconds) }"
  debug_session: ""

- truth: "A logged set can be un-logged (reverted to pending / removed) without deleting the whole exercise"
  status: failed
  reason: "User reported: logged sets cannot be unlogged"
  severity: major
  test: 7
  root_cause: "handleLogSet treats re-tapping the checkmark on a row with setId != null as a no-op in logging mode (design note D-01: 'already completed, tapping again is a no-op for now'). No per-set delete/un-log affordance exists — the only removal path is handleRemovePress, which removes the entire exercise card, not a single logged set."
  artifacts:
    - path: "app/active-workout/[workoutId].tsx"
      issue: "No per-set un-log/delete; handleLogSet is a no-op on already-logged rows in logging mode (D-01 deferred)"
  missing:
    - "Add a per-set un-log path: tapping the checkmark on a logged row (or a dedicated control) deletes the sets row via a deleteSet query and reverts the row to pending (setId=null, isCompleted=false)"
    - "Add/confirm a deleteSet helper in the db layer if none exists"
  debug_session: ""
