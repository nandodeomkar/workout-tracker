---
status: testing
phase: 05-body-measurements
source: [05-VERIFICATION.md]
started: 2026-07-23T10:41:14Z
updated: 2026-07-23T10:41:14Z
---

## Current Test

number: 1
name: Settings → Body Measurements → quick weigh-in upserts today's weight
expected: |
  Index reaches from Settings; quick weigh-in upserts (not duplicates) today's weight; metric list shows Weight with the logged value and other metrics as 'No data yet'.
awaiting: user response

## Tests

### 1. Settings → Body Measurements → quick weigh-in upserts today's weight
expected: Open Settings/More → tap 'Body Measurements' → Measurements index opens. Tap Quick weigh-in, enter a weight, Done → caption shows 'Logged today: ...'. Re-open keypad and change it → caption updates (upsert, not a duplicate row). Index reaches from Settings; quick weigh-in upserts (not duplicates) today's weight; metric list shows Weight with the logged value and other metrics as 'No data yet'.
result: [pending]

### 2. Weight detail — hero + trend chart + range chips + delete + empty state
expected: After ≥2 quick weigh-ins on different dates, open Weight detail → hero shows the latest value, trend line renders with range chips (All default), history list shows each dated reading. Tap the delete icon → confirm dialog → row disappears and chart updates. Open a metric with zero readings → empty state renders.
result: [pending]

### 3. Dated multi-metric session — past date, blank-skip, edit, no future date
expected: Open 'Log measurements', set a past date via the calendar overlay, enter chest + waist + one biceps value, leave others blank, Save → only the filled metrics appear in history. Edit one reading's value and save → history updates. Confirm a future date cannot be picked in the calendar overlay.
result: [pending]

### 4. Independent cm/in length-unit toggle + deferred CTAs open entry in correct mode
expected: Settings shows an independent Length units cm/in toggle; switching it re-labels body-part values on the Measurements screens without changing kg/lb weight display. Index 'Log measurements' CTA and detail '+ Add a reading'/edit (pencil icon) all open the entry form in the correct mode (session / single-metric / edit).
result: [pending]

### 5. Custom metric — create → log → graph → persist across restart
expected: Tap '+ Add custom metric', name it (e.g. 'Body Fat Caliper'), pick a unit type, Save → it appears in a Custom section with the pin icon. Log a reading for it via single-metric add or a dated session, then open it → its trend graph renders like a built-in. Restart the app → the custom metric's unit type is unchanged.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
