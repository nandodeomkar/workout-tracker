// Plate breakdown solver (D-06/D-08, UTIL-01).
//
// Pure, zero React Native / Drizzle imports (mirrors lib/exerciseName.ts
// convention). Plate sets are NATIVE per unit (D-06) — never derived by
// converting the other unit's set through lib/weightUnits.ts's
// kgToDisplay/displayToKg. This is deliberate: a 20kg bar and a 45lb bar are
// two independently manufactured standards, not unit-conversions of each
// other (Pitfall 1). Rounding to "nearest achievable" also does NOT reuse
// weightUnits.ts's 0.5kg/1lb DISPLAY rounding — that granularity is coarser/
// finer than actual per-plate granularity and would produce a value that
// looks loadable but isn't (Pitfall 2). This module rounds to a multiple of
// its own plate set's smallest denomination instead.

export const PLATE_SET_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
export const PLATE_SET_LB = [45, 35, 25, 10, 5, 2.5] as const;

export interface PlateSolveResult {
  achievableWeight: number; // same unit as input target/bar
  perSidePlates: number[]; // descending order
  deltaFromTarget: number; // achievableWeight - targetWeight (+/-)
}

/**
 * Resolves a (targetWeight, barWeight) pair — already in ONE display unit,
 * never mixed — to a per-side plate breakdown using a fixed, unit-specific
 * plate set. Below-bar targets (target <= barWeight) return the bar itself
 * as the nearest achievable weight with an empty plate list. Greedy fill is
 * provably minimal here because every denomination in each plate set is an
 * exact multiple of that set's smallest denomination (see 03-RESEARCH.md).
 * Guards against floating-point drift (Pitfall 5) via rounding `remaining`
 * after each subtraction and an epsilon in the loop comparison.
 */
export function solvePlates(targetWeight: number, barWeight: number, unit: 'kg' | 'lb'): PlateSolveResult {
  const plateSet = unit === 'kg' ? PLATE_SET_KG : PLATE_SET_LB;
  const smallest = plateSet[plateSet.length - 1]; // 1.25 (kg) / 2.5 (lb)

  const rawPerSide = (targetWeight - barWeight) / 2;
  // Below-bar edge case: nothing to load, bar itself is the nearest achievable.
  if (rawPerSide <= 0) {
    return { achievableWeight: barWeight, perSidePlates: [], deltaFromTarget: barWeight - targetWeight };
  }

  // Round to the nearest exactly-loadable per-side increment (multiple of
  // the smallest plate) — this IS the "nearest achievable weight" step,
  // distinct from the app's general 0.5kg/1lb DISPLAY rounding.
  const roundedPerSide = Math.round(rawPerSide / smallest) * smallest;

  const perSidePlates: number[] = [];
  let remaining = roundedPerSide;
  for (const plate of plateSet) {
    while (remaining >= plate - 1e-9) {
      perSidePlates.push(plate);
      remaining = Math.round((remaining - plate) * 100) / 100; // avoid fp drift
    }
  }

  const achievableWeight = barWeight + roundedPerSide * 2;
  return {
    achievableWeight,
    perSidePlates,
    deltaFromTarget: Math.round((achievableWeight - targetWeight) * 100) / 100,
  };
}
