// cm<->display-unit conversion (D-04/D-05).
//
// Canonical storage unit for length body-measurement metrics is always cm.
// These are the only functions that should convert a stored cm value to/from
// the user-facing display unit — callers must never inline `* 2.54`
// themselves. Pure, zero React Native / Drizzle imports (mirrors
// lib/weightUnits.ts convention).
//
// Rounding rule (05-UI-SPEC.md "Display precision" / RESEARCH.md Pattern 3):
// cosmetic only, no plate-loadable analog — nearest 0.1 cm, or nearest 0.25
// in display unit.
//
// Non-finite input (NaN/Infinity) is guarded to 0, mirroring NumericKeypad's
// `Number.isFinite ? parsed : 0` sentinel convention (T-05-06).

const CM_TO_IN = 2.54;

/**
 * Converts a canonical cm length to the given display unit, rounded to a
 * cosmetic display increment: nearest 0.1 cm, or nearest 0.25 in.
 * Non-finite input returns 0.
 */
export function cmToDisplay(cm: number, unit: 'cm' | 'in'): number {
  if (!Number.isFinite(cm)) {
    return 0;
  }
  if (unit === 'cm') {
    return Math.round(cm * 10) / 10;
  }
  return Math.round((cm / CM_TO_IN) * 4) / 4;
}

/**
 * Converts a user-entered display-unit value back to canonical cm.
 * cm input passes through unchanged; in input is multiplied by CM_TO_IN.
 * Non-finite input returns 0.
 */
export function displayToCm(value: number, unit: 'cm' | 'in'): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return unit === 'cm' ? value : value * CM_TO_IN;
}
