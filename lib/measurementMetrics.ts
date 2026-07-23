// Built-in body-measurement metric registry (D-01/D-03, MEAS-01/MEAS-02).
//
// Single code-side source of truth for the 15 built-in metrics' key, label,
// unit type, icon, and display order. Seeds the `metric_definitions` table
// (Plan 05-02) and is imported directly by the entry/graph screens for
// ordering and icon lookup. Pure, zero React Native / Drizzle imports
// (mirrors lib/weightUnits.ts convention).
//
// Emoji sourced verbatim from 05-UI-SPEC.md "Metric Icon & Label Registry" —
// shoulders/chest/hips reuse the exact glyphs already shipped in
// constants/muscleIcons.ts (Shoulders/Chest/Glutes) for cross-phase
// consistency.

export type UnitType = 'weight' | 'length' | 'percent';

export interface BuiltInMetric {
  metricKey: string;
  label: string;
  unitType: UnitType;
  icon: string;
  position: number;
}

export const BUILT_IN_METRICS: BuiltInMetric[] = [
  { metricKey: 'weight', label: 'Weight', unitType: 'weight', icon: '⚖️', position: 0 },
  { metricKey: 'body_fat_pct', label: 'Body Fat %', unitType: 'percent', icon: '📊', position: 1 },
  { metricKey: 'neck', label: 'Neck', unitType: 'length', icon: '🧣', position: 2 },
  { metricKey: 'shoulders', label: 'Shoulders', unitType: 'length', icon: '🙆', position: 3 },
  { metricKey: 'chest', label: 'Chest', unitType: 'length', icon: '🫁', position: 4 },
  { metricKey: 'waist', label: 'Waist', unitType: 'length', icon: '📏', position: 5 },
  { metricKey: 'hips', label: 'Hips', unitType: 'length', icon: '🍑', position: 6 },
  { metricKey: 'biceps_l', label: 'Biceps (L)', unitType: 'length', icon: '💪', position: 7 },
  { metricKey: 'biceps_r', label: 'Biceps (R)', unitType: 'length', icon: '💪', position: 8 },
  { metricKey: 'forearm_l', label: 'Forearm (L)', unitType: 'length', icon: '🤜', position: 9 },
  { metricKey: 'forearm_r', label: 'Forearm (R)', unitType: 'length', icon: '🤜', position: 10 },
  { metricKey: 'thigh_l', label: 'Thigh (L)', unitType: 'length', icon: '🦵', position: 11 },
  { metricKey: 'thigh_r', label: 'Thigh (R)', unitType: 'length', icon: '🦵', position: 12 },
  { metricKey: 'calf_l', label: 'Calf (L)', unitType: 'length', icon: '🦶', position: 13 },
  { metricKey: 'calf_r', label: 'Calf (R)', unitType: 'length', icon: '🦶', position: 14 },
];

/** Fallback glyph for user-created custom metrics (not in BUILT_IN_METRICS). */
export const CUSTOM_METRIC_ICON = '📌';

/**
 * Resolves the emoji for a metric key: the registry icon for a built-in key,
 * or CUSTOM_METRIC_ICON for any unknown (custom) key.
 */
export function getMetricIcon(metricKey: string): string {
  const match = BUILT_IN_METRICS.find((m) => m.metricKey === metricKey);
  return match ? match.icon : CUSTOM_METRIC_ICON;
}
