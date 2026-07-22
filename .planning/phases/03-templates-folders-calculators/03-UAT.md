---
status: testing
phase: 03-templates-folders-calculators
source: [03-VERIFICATION.md]
started: 2026-07-22T13:42:17Z
updated: 2026-07-22T13:42:17Z
---

## Current Test

number: 1
name: Folder header + template row rendering
expected: |
  Chevron flips, count badge accurate, rows visually consistent with WorkoutRow
awaiting: user response

## Tests

### 1. Folder header + template row rendering
expected: A folder header shows title + count + a chevron that flips on tap; template rows read like history rows. Chevron flips, count badge accurate, rows visually consistent with WorkoutRow.
result: [pending]

### 2. Create / edit template round-trip
expected: Create a template (name, 2 exercises, target sets/reps, type a new folder name — existing folders appear as tap chips), save. Reopen in the builder and confirm fields hydrate; edit and re-save. Builder persists and re-hydrates correctly on edit.
result: [pending]

### 3. Workout-home folder grouping + tap-to-start
expected: Workout home shows templates under collapsible folder headers (Uncategorized last); collapse/expand works; tapping a template opens a new active workout with that template's exercises in order; "+ New template" opens the builder.
result: [pending]

### 4. Barbell-weight setting persistence + plate sheet
expected: In More, a Barbell weight row shows 20 (kg) / 45 (lb) by default, steps and persists across app relaunch; switching Units switches which bar weight is shown. PlateCalculatorSheet shows correct per-side plates and a nearest-achievable delta for a non-loadable weight.
result: [pending]

### 5. 1RM + warm-up sheets computed values
expected: OneRMCalculatorSheet — entering 140x5 shows ~163 est-1RM and a %-of-1RM table. WarmupSuggestionSheet renders the Bar/40/60/80 ladder with plate-rounded weights and per-row Accept.
result: [pending]

### 6. Tools section navigation (no phantom tab)
expected: More shows a Tools section with Plate calculator + 1RM calculator rows; each pushes a full-screen calculator with a working Back control; the 5-tab layout is unchanged (no phantom Tools tab).
result: [pending]

### 7. Inline exercise-card calculator affordances
expected: On an exercise card — plate icon opens the plate sheet prefilled with current weight; 1RM icon opens the 1RM sheet prefilled with weight x reps; warm-up icon opens the ladder and each Accept inserts a warmup set row (visibly excluded from volume/PR on the summary). Rest timer does not auto-start on a warm-up accept.
result: [pending]

### 8. Start-from-template pre-fill with real history
expected: Start a workout from a template with (a) an exercise with prior history and (b) a never-performed exercise — the historied exercise's rows pre-fill from last performance (row count = template target_sets); the never-done exercise falls back to template target_reps (weight 0 when target_weight_kg is null). Non-template workouts pre-fill exactly as before.
result: [pending]

### 9. Save-as-template capture from finished workout
expected: Finish a workout with warm-up + working sets; tap Save as template; confirm the toast, then open Workout home / the builder and verify the new template captured the exercises with working-set counts (warm-ups excluded) and null weights.
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps
