---
status: testing
phase: 03-templates-folders-calculators
source: [03-VERIFICATION.md]
started: 2026-07-22T20:30:00Z
updated: 2026-07-22T20:30:00Z
re_test: gap-closure re-verification of UAT defects closed by plans 03-07 and 03-08 (prior full round: 7 passed / 2 issues → 3 gaps, archived in git history + 03-VERIFICATION.md re_verification block)
---

## Current Test

number: 1
name: Template edit affordance reachable + start-workout unchanged (UAT Gap 1 / 03-07)
expected: |
  On Workout home, tapping the ✎ edit icon on a template row opens the builder hydrated with
  that template's name/folder/exercises/targets; edits persist on save and return; tapping the
  row BODY (not the icon) still starts a new workout from the template.
awaiting: user response

## Tests

### 1. Template edit affordance reachable + start-workout unchanged (UAT Gap 1 / 03-07)
expected: On Workout home, tap the ✎ edit icon on a template row → the builder opens hydrated with that template's name/folder/exercises/targets; edit a field, save, and the change persists on return. Then tap the row body (not the icon) → it still starts a new workout from the template (unchanged).
result: pending

### 2. Warm-up log does NOT auto-start rest timer; normal log still does (UAT Gap 2 / 03-08)
expected: Mark a pre-filled set as warm-up via the W chip, then tap ✓ to log it → the rest timer does NOT start. Log a normal (non-warm-up) set → the timer DOES start.
result: pending

### 3. Re-tap ✓ un-logs a single set; siblings/card untouched; re-log works (UAT Gap 3 / 03-08)
expected: Log a normal set (tap ✓), then tap ✓ again on that same row → it reverts to an outline/pending checkmark, the exercise card and its other sets remain untouched, and finish-workout volume/PR no longer counts that set. Re-tap ✓ → it re-logs with the same weight/reps; volume/PR recompute correctly.
result: pending

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

[none yet]
