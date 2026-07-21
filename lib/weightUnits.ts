// kg<->display-unit conversion + plate-loadable rounding (D-14 / LOG-06).
//
// Canonical storage unit for weight is always kg (D-14). These are the only
// functions that should convert a stored kg value to/from the user-facing
// display unit — callers must never inline `* 2.20462` themselves. Pure,
// zero React Native / Drizzle imports (mirrors lib/exerciseName.ts convention).
//
// Rounding rule (UI-SPEC "6. kg/lb display (D-14)"): display to the nearest
// 0.5 kg or nearest whole lb — standard plate-loadable increments.

const KG_TO_LB = 2.20462;

/**
 * Converts a canonical kg weight to the given display unit, rounded to a
 * plate-loadable increment: nearest 0.5 kg, or nearest whole lb.
 */
export function kgToDisplay(weightKg: number, unit: 'kg' | 'lb'): number {
  if (unit === 'kg') {
    return Math.round(weightKg * 2) / 2;
  }
  return Math.round(weightKg * KG_TO_LB);
}

/**
 * Converts a user-entered display-unit value back to canonical kg.
 * kg input passes through unchanged; lb input is divided by KG_TO_LB.
 */
export function displayToKg(displayValue: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? displayValue : displayValue / KG_TO_LB;
}
