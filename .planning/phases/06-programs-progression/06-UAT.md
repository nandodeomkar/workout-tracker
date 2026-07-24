---
status: testing
phase: 06-programs-progression
source: [06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md, 06-06-SUMMARY.md, 06-07-SUMMARY.md, 06-08-SUMMARY.md]
started: 2026-07-23T19:54:03Z
updated: 2026-07-24T11:05:00Z
---

## Current Test

number: 3
name: Linear progression on finish — next weight prescribed at day start, shared per-lift across days (PROG-02)
expected: |
  Gap-closure (06-07 + 06-08 + CR-01 fix) has landed. Re-run Test 3 on a physical device.
  Start the pointed Linear 5×5 day, log all working sets at a real weight (e.g. 100 kg × 5), Finish.
  Confirm the finish screen "+2.5 kg" badge AND that starting the NEXT program day (any day using
  that lift — including a DIFFERENT day than the one just finished) prescribes sets pre-filled at the
  incremented weight (102.5 kg), not the same weight as before.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test (migration 0004)
expected: Fully close the app (force stop / swipe from recents), then relaunch cold. App boots with no crash, additive migration 0004 applies against the populated DB, and existing data is intact — exercise library, workout history, body measurements all still there. No data loss, no migration error.
result: [pass] — device 2026-07-23; cold boot on fresh cache-cleared bundle (2910 modules), Workout home rendered with no red-box, templates (Wrestling/Pehalvan, Rope, 22 Jul 2026 set) + history intact, migration 0004 applied cleanly on populated DB.

### 2. Add & start a bundled program (PROG-01, PROG-04)
expected: Settings/More → 🗓️ Programs → the manager opens. Tap "+ Add a program" → overlay lists the two bundled programs (Linear 5×5, Percent-Based Wave). Tap Linear 5×5 → read-only day preview (ordered day list) → "Add & start". Program detail opens showing the ordered day list with a "▶ Next" badge on the first day. Return to Workout home → a "🗓️ {program name} / Day 1 of {total}: {day label}" card is shown that starts the pointed day on tap.
result: [pass] — device 2026-07-23; Programs manager → Add → Linear 5×5 preview → Add & start; detail shows ordered days + ▶ Next on day 1; Workout home Next-in-program card starts the pointed day.

### 3. Linear progression on finish — next weight tracks the weight lifted (PROG-02)
expected: Start the pointed Linear 5×5 day, log all working sets at a REAL weight (e.g. 100 kg × 5 for every set), Finish. The finish screen's "Program progress" section shows a success line with a "+2.5 kg" badge, and the pointer-advance caption "Next up: Day 2 of {M} — {label}." Re-open that program day / template: the exercise's next prescribed target is the weight you lifted + increment (e.g. 102.5 kg) — NOT 2.5 kg, and NOT unchanged. (Regression guard for the CR-01 fix — a bundled program seeds no starting weight, so a first finish must anchor on what you actually lifted.)
result: [pending] — original device run 2026-07-23 FAILED (finish badge shown but next day prefilled the same weight). Gap-closure fix landed 2026-07-24: linear prefill at day start (prefillLinearSets) + per-lift shared progression keyed (program_id, exercise_id) via new program_exercise_progress table (06-07 migration 0005, 06-08), plus the CR-01 no-working-sets wedge guard (fix 5ae086b, regression 9ce96c7). Unit coverage green (HEADLINE cross-day, CROSS-DAY WRITE SHARING, FIRST RUN, CR-01 regressions; 526/526 full suite). Awaiting device re-test.
reported: "The finish screen showed a +2.5kg badge but on starting next days workout in the program the weight prefilled was same as before"
severity: blocker

### 4. Linear miss holds the weight, three misses deload — finish-screen copy (PROG-02)
expected: Finish-screen behavior only (independent of the Test-3 prefill gap). Finish a linear day having MISSED the target reps (e.g. log 3 reps when target is 5) → finish screen shows a muted "missed a rep. Same weight next time (1/3)" line, no badge. Repeat the miss two more times → on the third consecutive miss the finish screen shows a "−10%" deload badge. (The prescribed-weight-drop surfacing is covered by the Test-3 linear-prefill fix.)
result: [pass] — device 2026-07-23; finish-screen hold copy "Same weight next time (1/3)" + deload "−10%" badge render correctly (applyProgressionAndAdvance evaluate/hold/deload logic; also covered by vitest exactly-one-deload-on-third-miss).

### 5. %TM setup + plate-loadable prescribed weights (PROG-03)
expected: Add the "Percent-Based Wave" program → it routes into the TM-setup sheet listing each %TM exercise. For a lift, set a training max via each of the three sources (direct keypad entry; "Enter a 1RM" → converts to a TM; "Use my best logged 1RM" → shown only if that lift has history). Save (disabled until every row is non-zero). Start the day → each %TM set's prescribed weight is a plate-loadable percentage of the training max (loads to real plates on a 20 kg bar), not a raw un-rounded number.
result: [pass] — device 2026-07-23; TM-setup sheet (three sources), Save-gate, and plate-loadable %TM prescribed weights at day start all work (prefillPercentTmSets path — unaffected by the linear-prefill gap).

### 6. %TM cycle wrap → training-max bump + Cycle-complete banner (PROG-03)
expected: Complete the Percent-Based Wave far enough to wrap the pointer past the last day (cycle complete). On that finish, an accent-bordered "Cycle complete" banner appears above the Program-progress rows, listing each bumped lift's delta and new training max (e.g. "Squat +2.5 kg → 102.5 kg"). The program-detail "🎯 Training Maxes" section reflects the bumped values. The bump happens exactly once for the wrap (not per week, and not twice if you revisit the finished workout's summary).
result: [pass] — device 2026-07-23; cycle wrap fires the "Cycle complete" banner with per-lift TM deltas, program-detail Training Maxes reflects bumps, bump-once-on-wrap holds (WR-01 idempotency fix + vitest wrap-bumps-every-distinct-exercise-once).

### 7. Progression authoring in the template builder (PROG-01)
expected: Create or edit a template. Each exercise row has a None/Linear/%TM progression selector. Choosing Linear reveals an increment stepper (2.5 kg / 5 lb default). Choosing %TM reveals a per-set pct/reps editor with an AMRAP toggle on the last set only. Save the template, reopen it → the authored progression rule and its values persist exactly as entered.
result: [pass] — device 2026-07-23; per-exercise None/Linear/%TM selector, linear increment stepper, %TM per-set pct/reps + last-set-only AMRAP all author + persist across save/reopen.

### 8. Custom program builder (PROG-01)
expected: Programs → "Build a custom program". Enter a name, add ordered days from your existing templates via a folder-grouped picker, reorder and remove days. Save → the program is created, activated, and appears in the manager (and as the Workout-home "Next in program" card). If any picked day contains a %TM exercise, Save routes you into the TM-setup sheet for that program.
result: [pass] — device 2026-07-23; custom builder creates + activates a program from ordered existing-template days (reorder/remove, folder-grouped picker), surfaces in manager + Next-in-program card, and routes to TM-setup when a picked day has a %TM exercise.

## Summary

total: 8
passed: 7
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

- truth: "Completing a linear-progression program day auto-increments its PRESCRIBED weight on success — next session prescribes lifted+increment."
  status: resolved
  resolved_by: [06-07, 06-08]
  resolved_note: "Fixed via per-lift shared progression: program_exercise_progress table + migration 0005 (06-07), prefillLinearSets + composite-key read/write in applyProgressionAndAdvance (06-08), and the CR-01 no-working-sets wedge guard (fix 5ae086b, regression 9ce96c7). Code/test verified 6/6 (06-VERIFICATION.md); on-device re-test of Test 3 outstanding before final sign-off."
  reason: "User reported: The finish screen showed a +2.5kg badge but on starting next days workout in the program the weight prefilled was same as before"
  severity: blocker
  test: 3
  root_cause: |
    Two compounding defects:
    (A) PRIMARY — no linear prefill exists. startWorkoutFromProgramDay (db/programs.ts:588) only
        calls prefillPercentTmSets (db/programs.ts:617), which prescribes sets ONLY for percent_tm
        exercises. startWorkoutFromTemplate (db/templates.ts:388) inserts NO sets at all (only
        workout_exercises rows). So a linear exercise's stored target_weight_kg — including the
        just-bumped 102.5 — is never turned into a prescribed set; the active-workout screen falls
        back to LOG-01 last-performance prefill, showing the last weight lifted (100). Linear
        progression is computed + stored + badge-shown, but never PRESCRIBED. Affects every linear
        program day, bundled and custom.
    (B) SECONDARY — cross-day sharing. linear5x5.json Day A and Day B both contain Barbell Squat as
        SEPARATE template_exercise rows with independent target_weight_kg. Finishing Day A bumps Day
        A's Squat row only; Day B's Squat row is untouched. Even with (A) fixed, StrongLifts-style
        A/B programs would not carry a lift's progressed weight across days (progression is keyed
        per-template-exercise-row, not per-lift). User started Day B after Day A, so hit (B) as well.
  artifacts: [db/programs.ts:588, db/programs.ts:617, db/templates.ts:388, data/bundledPrograms/linear5x5.json]
  missing: ["linear-progression prefill at day start (prescribe sets from the progressed weight)", "cross-day per-lift progression sharing"]
  resolution: "APPROVED per-lift shared progression (StrongLifts-faithful). Fix BOTH: (A) prescribe linear sets at day start from the lift's progressed weight, AND (B) key linear progression per-lift across the whole program so a Squat bump on Day A carries to Day B. Batch-fixed after UAT completes (all gaps in one gap-closure round)."
