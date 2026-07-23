// Shared chart-range cutoff helper — extracted from app/stats/[exerciseId].tsx
// (STAT-01) so both the Stats chart screen and the Measurements per-metric
// chart screen (Plan 05-04) filter an already-fetched all-time series
// client-side against the same range logic, instead of duplicating it
// (RESEARCH.md Open Question 2, mirrors the lib/duration.ts extraction
// precedent). Pure, zero React Native / Drizzle imports.

export type RangeOption = '3M' | '1Y' | 'All';

/** Returns an ISO cutoff date for the given range, or `null` for 'All' (no filter). */
export function rangeCutoffISO(range: RangeOption): string | null {
  if (range === 'All') {
    return null;
  }
  const cutoff = new Date();
  if (range === '3M') {
    cutoff.setMonth(cutoff.getMonth() - 3);
  } else {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  }
  return cutoff.toISOString();
}
