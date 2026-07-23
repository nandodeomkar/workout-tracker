// One-point-per-date measurement series reduction (D-12, MEAS-02).
//
// For a given metric's readings, groups by measuredAt date and reduces
// same-date duplicates to the latest-inserted (highest-id) row — there is no
// "best" value concept for a body measurement, unlike lib/chartSeries.ts's
// session-best reduction for workout sets. Output sorted ascending by date.
// Pure, zero React Native / Drizzle imports.

export interface MeasurementReading {
  id: number;
  metric: string;
  value: number;
  measuredAt: string; // YYYY-MM-DD
}

export interface MeasurementPoint {
  date: string;
  value: number;
}

/**
 * Reduces readings for ONE metric to one point per distinct measuredAt date.
 * On same-date duplicates, the reading with the highest `id` (most recently
 * inserted) wins — no averaging, no double-plot (D-12). Empty input returns
 * `[]`. Output sorted ascending by date string.
 */
export function buildMeasurementSeries(readings: MeasurementReading[]): MeasurementPoint[] {
  const byDate = new Map<string, MeasurementReading>();
  for (const r of readings) {
    const existing = byDate.get(r.measuredAt);
    if (!existing || r.id > existing.id) {
      byDate.set(r.measuredAt, r);
    }
  }
  return [...byDate.values()]
    .map((r) => ({ date: r.measuredAt, value: r.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
