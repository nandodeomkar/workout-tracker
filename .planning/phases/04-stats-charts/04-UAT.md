---
status: complete
phase: 04-stats-charts
source: [04-VERIFICATION.md]
started: 2026-07-23T01:20:00Z
updated: 2026-07-23T02:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Per-exercise chart — metric toggle + range chips
expected: Tapping Est. 1RM / Top Set / Volume swaps the rendered line series; tapping 3M / 1Y / All re-filters the chart without a per-tap DB round trip or visible freeze.
result: pass

### 2. Empty / sparse states across all three surfaces
expected: A never-logged exercise's chart shows "No data yet for {name}"; an exercise with exactly one workout shows the point + "Log one more workout..." caption; a fresh account shows "No PRs yet" and "No training logged yet" on the dashboard.
result: issue
reported: "no single point visible for exercise with one log. \"Log one more workout' caption visible but hard to read"
severity: major

### 3. Chart/Records toggle + PR-feed tap-through to record board
expected: Tapping a PR-feed row (or the "Records" toggle on the chart screen) opens the exercise's live record board — curated 1/3/5/8/10/12-rep-max rows (only logged counts) + best-e1RM hero card, in the user's display unit.
result: pass

### 4. "See all" full history + live PR-feed update after logging a new PR
expected: "See all" opens an unbounded, newest-first list of all PR events. Logging a new PR set and returning to the Stats tab shows it appear in the feed without restarting the app (live recompute, D-11).
result: pass

## Summary

total: 4
passed: 3
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Exercise with exactly one logged workout shows a single visible data point on the chart, plus a legible 'Log one more workout...' caption"
  status: failed
  reason: "User reported: no single point visible for exercise with one log. \"Log one more workout' caption visible but hard to read"
  severity: major
  test: 2
  root_cause: ""     # Filled by diagnosis
  artifacts: []      # Filled by diagnosis
  missing: []        # Filled by diagnosis
  debug_session: ""  # Filled by diagnosis
