// Elapsed-time formatting — shared by WorkoutRow, the History workout detail,
// and (conceptually) the Finish/summary screen's local formatter. Pure, zero
// React Native / Drizzle imports (mirrors lib/weightUnits.ts convention).
//
// Format: "m:ss" under an hour, "h:mm" at/above an hour — matches the
// Finish/summary screen's existing duration readout exactly (D-10).

/**
 * Formats a millisecond duration as "m:ss" (under 60 minutes) or "h:mm" (60
 * minutes and above). Negative/non-finite input is clamped to zero.
 */
export function formatDurationMs(durationMs: number): string {
  const safeMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  const totalMinutes = Math.floor(safeMs / 60000);

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  }

  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
