---
status: passed
phase: 05-body-measurements
source: [05-VERIFICATION.md]
started: 2026-07-23T10:41:14Z
updated: 2026-07-23
---

## Current Test

All 5 tests passed on device (2026-07-23). UAT complete.

## Tests

### 1. Settings → Body Measurements → quick weigh-in upserts today's weight
expected: Open Settings/More → tap 'Body Measurements' → Measurements index opens. Tap Quick weigh-in, enter a weight, Done → caption shows 'Logged today: ...'. Re-open keypad and change it → caption updates (upsert, not a duplicate row). Index reaches from Settings; quick weigh-in upserts (not duplicates) today's weight; metric list shows Weight with the logged value and other metrics as 'No data yet'.
result: [pass] — device 2026-07-23; quick weigh-in upserts today's weight (no duplicate), Weight row shows value, others 'No data yet'.

### 2. Weight detail — hero + trend chart + range chips + delete + empty state
expected: After ≥2 quick weigh-ins on different dates, open Weight detail → hero shows the latest value, trend line renders with range chips (All default), history list shows each dated reading. Tap the delete icon → confirm dialog → row disappears and chart updates. Open a metric with zero readings → empty state renders.
result: [pass] — device 2026-07-23; hero=latest, trend line + range chips render, delete-to-correct removes row + updates chart, zero-reading metric shows empty state, future days not tappable.

### 3. Dated multi-metric session — past date, blank-skip, edit, no future date
expected: Open 'Log measurements', set a past date via the calendar overlay, enter chest + waist + one biceps value, leave others blank, Save → only the filled metrics appear in history. Edit one reading's value and save → history updates. Confirm a future date cannot be picked in the calendar overlay.
result: [pass] — device 2026-07-23; dated session writes only filled metrics (blanks skipped), edit updates history in place, future date not selectable.

### 4. Independent cm/in length-unit toggle + deferred CTAs open entry in correct mode
expected: Settings shows an independent Length units cm/in toggle; switching it re-labels body-part values on the Measurements screens without changing kg/lb weight display. Index 'Log measurements' CTA and detail '+ Add a reading'/edit (pencil icon) all open the entry form in the correct mode (session / single-metric / edit).
result: [pass] — device 2026-07-23; Length units cm/in toggle is independent (re-labels body-part values, weight kg/lb unchanged); all 3 CTAs open entry in correct mode (session/single/edit).

### 5. Custom metric — create → log → graph → persist across restart
expected: Tap '+ Add custom metric', name it (e.g. 'Body Fat Caliper'), pick a unit type, Save → it appears in a Custom section with the pin icon. Log a reading for it via single-metric add or a dated session, then open it → its trend graph renders like a built-in. Restart the app → the custom metric's unit type is unchanged.
result: [pass] — device 2026-07-23; custom metric created (Custom section + icon), logs a reading, renders its own trend graph, unit type persists across app restart.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- **[minor, non-blocking] No user-facing feedback when a value exceeds the 1000 guardrail.** During UAT, `assertValidMeasurementValue` (db/measurements.ts:49) threw `Error: Measurement value must be 1000 or less` as an **uncaught promise rejection** from the quick weigh-in path (app/measurements/index.tsx handleWeighInDone → upsertReadingForDate). The save silently fails with only a console error; the keypad closes as if it succeeded and no alert/toast tells the user the value was rejected. All 5 UAT tests still passed. Fix candidate: catch the validation error in the keypad-done handlers (index quick weigh-in + entry save) and surface an inline message / keep the keypad open. Track as tech debt.
