---
status: complete
phase: 02-core-logging-active-workout
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md, 02-05-SUMMARY.md, 02-06-SUMMARY.md, 02-07-SUMMARY.md]
started: 2026-07-22T06:43:40Z
updated: 2026-07-22T06:43:40Z
device: 5dqwzpdqemsc6xpb (25080RABDI), airplane mode
automated_gate: vitest 112 pass / 16 files, tsc clean (2026-07-22)
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start / Offline Smoke
expected: Fresh launch in airplane mode lands on the 5-tab shell, no crash / red box / network error. Additive rest_seconds migration applied to the existing populated DB with no data loss.
result: pass

### 2. Start workout + 2-tap set logging + pre-fill (LOG-01)
expected: Start a blank workout, add an exercise, log a set's reps + weight in ≤2 taps. Start again later, re-add the same exercise → its reps/weight pre-fill from the last performance of that exercise.
result: pass
note: User confirmed a re-added exercise pre-fills with the prior finished performance's reps/weight (not 0/0). Depends on the Test-3 ✓-log fix (pre-fill sources committed sets).

### 3. Crash-safe persistence — force-kill + relaunch (LOG-02)
expected: With a workout in progress and sets logged, force-kill the app (swipe from recents / kill process), relaunch offline → a "Resume workout" card appears and every logged set/rep/weight is intact, nothing lost.
result: pass
note: |
  Found as a BLOCKER (see Gaps), diagnosed to SetRow horizontal overflow hiding the ✓
  log button, fixed in components/SetRow.tsx, and re-verified on device:
    - ✓ now renders in-bounds at the row's right edge (screenshot uat-fix-rows.png)
    - User confirmed "works now" — ✓ fills, set persists across leave/return
    - DB proof: after the fix a logged set wrote to SQLite (workout 2 / we 10 →
      sets row: weight 5kg, reps 1; TOTAL sets 0 → 1). Crash-safe write path restored.
history: |
  reported: "Reps and weights that I am trying to put in are not persisting even before killing app."
  severity: blocker → RESOLVED. Pre-fix DB probe: 0 rows in sets table (nothing ever committed).

### 4. Rest timer auto-start + screen-off notification (LOG-03)
expected: Completing a set auto-starts the rest timer with a live countdown. Lock the screen; when the interval elapses the phone fires a notification + vibration on time, screen still off. Per-exercise rest override pill changes that exercise's rest duration.
result: pass
note: |
  User confirmed a–d: (a) countdown bar works, (b) notification fires with screen off,
  (c) sound + vibration present, (d) ⏱ rest-override pill changes duration.
  Minor bug found + fixed en route: the notification channel passed `sound: 'default'`,
  which expo-notifications treats as a custom sound file → "Custom sound 'default' not
  found" red LogBox. Fixed in lib/restTimer.ts: omit channel `sound` (OS default) and
  bump channel id → 'rest-timer-v2' (Android channels are immutable after creation).
  restTimer.test.ts still 5/5; error box gone; sound now plays.

### 5. Add/reorder/replace/remove exercises + Finish summary (LOG-04, LOG-05)
expected: During an active workout you can add, drag-reorder, replace, and remove exercises. Finish → summary shows duration, total volume, and any PRs hit. Discard instead → workout is gone (cascade delete), not saved to history.
result: pass
note: User confirmed all four mutations (add / reorder / replace / remove) and Finish → summary (duration / volume / PRs) work on device.

### 6. kg/lb units + History list/calendar + edit past workout (LOG-06, HIST-01, HIST-02)
expected: Toggle units (kg ⇄ lb) in Settings and weights convert with plate-loadable rounding. History tab shows finished workouts as a list AND a month calendar (toggle). Open a past workout, edit a set's reps/weight/exercise → the change persists (updates existing rows, no duplicate workout).
result: pass
note: User confirmed a–d — units convert (kg⇄lb), History list, month calendar, and edit-past-workout persistence all work. Edit screen reuses the same SetRow, so the ✓-row fix applies to editing too (verified incidentally with wider lb values).

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0
resolved_issues: 2

## Gaps

- truth: "Every completed set persists to SQLite immediately (LOG-01/LOG-02 core value)"
  status: fixed_verified
  reason: "User reported: Reps and weights that I am trying to put in are not persisting even before killing app."
  severity: blocker
  test: 3
  root_cause: |
    CONFIRMED — SetRow horizontal overflow at ~360-393dp screen width. Screen is 393dp
    (1280px ÷ 520dpi). Row needs ~428dp (indexChip 32 + weight stepper group 156 + reps
    stepper group 156 + ✓ 44 + gaps/padding) but only ~329dp is available inside the card.
    With no flexWrap, marginLeft:auto pushed the ✓ log button (last child) off the right
    edge → invisible → handleLogSet never callable → insertSet never runs. Device DB probe
    proved it: TOTAL sets rows = 0 (zero sets ever persisted). Unit/DB tests never render
    layout, so the automated gate could not catch it. Not device-specific — 393dp is
    mainstream (Pixel 411dp, iPhone ~390dp), so the row was broken on essentially all phones.
  evidence:
    - "Cropped device screenshot: ~44px right slot where ✓ should sit is empty"
    - "User confirmed: no ✓ button anywhere on the set row; stepper values do update locally"
    - "better-sqlite3 probe of pulled on-device workout.db: 0 rows in sets table"
  artifacts:
    - path: "components/SetRow.tsx"
      issue: "✓ log button (marginLeft:auto) pushed off-screen by overflowing row"
  fix: |
    Restructured SetRow layout so ✓ can never be pushed off: indexChip (width 28, flexShrink 0)
    + two numberControls (flex 1, minWidth 0 → shrink to fit) + ✓ logButton (width 44,
    flexShrink 0, marginLeft:auto removed). Steppers shrunk to width 30 with hitSlop restoring
    the 44dp touch target; numberTap uses adjustsFontSizeToFit. Row gap sm→xs. tsc clean.
  missing:
    - "Re-verify on device: ✓ visible + tappable, and a logged set writes to sets table"
  debug_session: ""
