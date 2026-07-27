// e1RM sparkline delta between the last two finished-session best-e1RM points (REDESIGN-02).
//
// Pure, zero React Native / Drizzle imports (mirrors lib/warmupLadder.ts
// convention). Accepts a plain number[] (the caller maps
// buildChartSeries(...).slice(-8).map(p => p.value) before calling) so this
// stays decoupled from lib/chartSeries.ts's ChartPoint shape.

/**
 * Returns the signed percent change between the last two points, or null
 * when there are fewer than two points (renders as the sparkline's dim "—"
 * flat-line delta) or when the previous value is 0 (avoids divide-by-zero).
 */
export function e1rmDeltaPct(points: number[]): number | null {
  if (points.length < 2) {
    return null;
  }

  const prev = points[points.length - 2];
  const last = points[points.length - 1];

  if (prev === 0) {
    return null;
  }

  return ((last - prev) / prev) * 100;
}
