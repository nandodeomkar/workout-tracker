# Debug: chart-single-point-invisible

**Status:** resolved — fixed in plan 04-07 (commit b805503); on-device UAT Test 2 re-passed 2026-07-23
**Discovered:** Phase 04 UAT — Test 2 (Empty / sparse states)
**Severity:** major

## Symptoms

- expected: An exercise with exactly one logged workout shows a single visible data point on the chart.
- actual: "no single point visible for exercise with one log" — chart card renders but appears empty.
- errors: None reported.
- reproduction: Log exactly one working set for a fresh exercise, open its progress chart (Chart view, any metric/range). Test 2 in 04-UAT.md.
- timeline: Discovered during Phase 04 device UAT (2026-07-23).

## Investigation

Chart render is at `app/stats/[exerciseId].tsx:191-202`:

```tsx
<View style={styles.chartContainer}>
  <CartesianChart data={displayPoints} xKey="date" yKeys={['value']} axisOptions={{ font }}>
    {({ points }) => <Line points={points.value} color={theme.colors.accent} strokeWidth={3} />}
  </CartesianChart>
</View>
{displayPoints.length === 1 ? (
  <Text style={styles.sparseCaption}>Log one more workout to see a trend line.</Text>
) : null}
```

The `displayPoints.length === 0` branch (empty state) and the `length === 1` caption branch both exist, so the sparse case IS handled for text — but the chart itself only ever renders a `<Line>`.

`buildChartSeries` (`lib/chartSeries.ts`) correctly produces exactly one `ChartPoint` for a single-workout exercise (verified: one workout → one grouped point), so data is present — `displayPoints.length === 1` is true and the chart mounts with one datum.

## Root cause

victory-native's `<Line>` renders a **path that connects** the series points. A single-point series produces a zero-length path — there is no line segment and no point marker, so nothing is painted. The screen renders only `<Line>` and never a point/marker mark (no `<Scatter>` or equivalent), so a 1-point (and by extension the first datum of any series) has no visible dot.

## Files involved

- `app/stats/[exerciseId].tsx:194-196` — `CartesianChart` children render `<Line>` only; no point/scatter mark. This is the defect site.
- `lib/chartSeries.ts:37-65` — `buildChartSeries` (NOT at fault; correctly emits one point).

## Suggested fix direction

Render a point/marker mark in addition to (or, for a 1-point series, instead of) the `<Line>`. Options, in order of preference:
1. Add a `<Scatter>` mark (from `victory-native`) over the same `points.value` so every datum shows a dot — fixes the single-point case and also makes multi-point series read as discrete sessions.
2. Or conditionally render a dot mark when `displayPoints.length === 1`.

Prefer a small accent-colored circle (`theme.colors.accent`) sized ~6px radius. Verify the chosen victory-native XL API (v41) — use the current `<Scatter>` / point API, not legacy Victory v36 composition.
