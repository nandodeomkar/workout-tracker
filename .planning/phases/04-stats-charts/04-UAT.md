---
status: diagnosed
phase: 04-stats-charts
source: [04-VERIFICATION.md]
started: 2026-07-23T01:20:00Z
updated: 2026-07-23T02:10:00Z
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
  root_cause: "Two distinct defects in app/stats/[exerciseId].tsx. (1) major: chart renders only <Line> (194-196); victory-native <Line> draws a path connecting points, so a single-point series has a zero-length path and no point marker — nothing is painted. buildChartSeries correctly emits one point; the render just has no dot/Scatter mark. (2) cosmetic: sparse caption (304-309) uses typography.caption (13px) + textMuted (#8B94A3), the low-emphasis treatment — legible-but-weak, and worse next to the chart made empty-looking by defect 1."
  artifacts:
    - path: "app/stats/[exerciseId].tsx"
      issue: "Lines 194-196: CartesianChart children render <Line> only; no point/Scatter mark, so a single-point (1-workout) series shows nothing."
    - path: "app/stats/[exerciseId].tsx"
      issue: "Lines 304-309: sparseCaption style uses caption/13px + textMuted, low-emphasis; caption reads as hard to read on-device."
  missing:
    - "Add a point/marker mark to the chart (e.g. victory-native <Scatter> over points.value, ~6px accent dots) so every datum — including a lone single point — is visible. Confirm victory-native v41/XL API."
    - "Raise sparse-caption legibility: use theme.colors.text (or bump to typography.body 16px) and consider textAlign:'center' so the single-point state reads as intentional."
  debug_session: ".planning/debug/chart-single-point-invisible.md, .planning/debug/sparse-caption-low-contrast.md"
