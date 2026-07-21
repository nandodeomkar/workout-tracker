// One-time build-time curation script — dev-time Node/TS only, NEVER
// bundled into the app. Transforms free-exercise-db's raw exercise records
// into the app's fixed 10-muscle-group / 8-equipment taxonomy (D-01/D-02),
// producing the committed `db/seed/exercises.seed.json` (D-03: ~400-500
// rows, trimmed via auditable rule-based exclusions, never one-by-one
// manual curation).
//
// Run: npx tsx scripts/curate-exercises.ts
//
// Security (T-1-02): this script only reads external data and writes a
// local JSON file — no SQL, no raw string concatenation into a query.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { EQUIPMENT, MUSCLE_GROUPS, type EquipmentType, type MuscleGroup } from '../constants/taxonomy';
import { normalizeExerciseName } from '../lib/exerciseName';

const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const OUTPUT_PATH = path.resolve(__dirname, '../db/seed/exercises.seed.json');

export interface RawExercise {
  id?: string | null;
  name: string;
  equipment?: string | null;
  primaryMuscles?: string[] | null;
  category?: string | null;
  level?: string | null;
}

export interface CuratedExercise {
  seedId: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipment: EquipmentType;
  notes: string | null;
}

export interface CurationReport {
  input: number;
  output: number;
  excluded: number;
  muscleGroupFallbacks: number;
  equipmentFallbacks: number;
  supplemental: number;
}

// GAP-1: common gym machine/cable/free-weight staples that lifters expect
// but that free-exercise-db does not contain at all (verified 2026-07-21 —
// these are absent from source, not excluded by the curation rules, so
// relaxing exclusions would not recover them). Hand-authored with the fixed
// taxonomy and a stable `supp-` seedId prefix so they carry a durable
// identity across re-seeds (D-04). Merged in after the rule-based curation;
// any entry whose name already exists in the curated set is skipped.
export const SUPPLEMENTAL_EXERCISES: CuratedExercise[] = [
  { seedId: 'supp-chest-supported-machine-row', name: 'Chest Supported Machine Row', muscleGroup: 'Back', equipment: 'Machine', notes: null },
  { seedId: 'supp-pec-deck', name: 'Pec Deck', muscleGroup: 'Chest', equipment: 'Machine', notes: null },
  { seedId: 'supp-machine-chest-press', name: 'Machine Chest Press', muscleGroup: 'Chest', equipment: 'Machine', notes: null },
  { seedId: 'supp-incline-machine-chest-press', name: 'Incline Machine Chest Press', muscleGroup: 'Chest', equipment: 'Machine', notes: null },
  { seedId: 'supp-machine-shoulder-press', name: 'Machine Shoulder Press', muscleGroup: 'Shoulders', equipment: 'Machine', notes: null },
  { seedId: 'supp-reverse-pec-deck', name: 'Reverse Pec Deck', muscleGroup: 'Shoulders', equipment: 'Machine', notes: null },
  { seedId: 'supp-assisted-pull-up', name: 'Assisted Pull-Up', muscleGroup: 'Back', equipment: 'Machine', notes: null },
  { seedId: 'supp-smith-machine-row', name: 'Smith Machine Row', muscleGroup: 'Back', equipment: 'Machine', notes: null },
  { seedId: 'supp-straight-arm-cable-pulldown', name: 'Straight-Arm Cable Pulldown', muscleGroup: 'Back', equipment: 'Cable', notes: null },
  { seedId: 'supp-cable-pullover', name: 'Cable Pullover', muscleGroup: 'Back', equipment: 'Cable', notes: null },
  { seedId: 'supp-cable-lateral-raise', name: 'Cable Lateral Raise', muscleGroup: 'Shoulders', equipment: 'Cable', notes: null },
  { seedId: 'supp-cable-rear-delt-fly', name: 'Cable Rear Delt Fly', muscleGroup: 'Shoulders', equipment: 'Cable', notes: null },
  { seedId: 'supp-cable-rope-triceps-pushdown', name: 'Cable Rope Triceps Pushdown', muscleGroup: 'Triceps', equipment: 'Cable', notes: null },
  { seedId: 'supp-cable-rope-hammer-curl', name: 'Cable Rope Hammer Curl', muscleGroup: 'Biceps', equipment: 'Cable', notes: null },
  { seedId: 'supp-barbell-hip-thrust', name: 'Barbell Hip Thrust', muscleGroup: 'Glutes', equipment: 'Barbell', notes: null },
  { seedId: 'supp-machine-hip-thrust', name: 'Machine Hip Thrust', muscleGroup: 'Glutes', equipment: 'Machine', notes: null },
  { seedId: 'supp-bulgarian-split-squat', name: 'Bulgarian Split Squat', muscleGroup: 'Quads', equipment: 'Dumbbell', notes: null },
  { seedId: 'supp-close-grip-bench-press', name: 'Close-Grip Bench Press', muscleGroup: 'Triceps', equipment: 'Barbell', notes: null },
  { seedId: 'supp-stiff-leg-deadlift', name: 'Stiff-Leg Deadlift', muscleGroup: 'Hamstrings', equipment: 'Barbell', notes: null },
  { seedId: 'supp-pendlay-row', name: 'Pendlay Row', muscleGroup: 'Back', equipment: 'Barbell', notes: null },
];

/**
 * Appends supplemental staples to a curated set, skipping any whose name
 * (after duplicate-detection normalization) or seedId already exists in the
 * base set. Pure and offline — no network, no side effects — so it is safe
 * to run over the committed seed to add only the new rows with a minimal diff.
 */
export function mergeSupplements(
  base: CuratedExercise[],
  supplements: CuratedExercise[] = SUPPLEMENTAL_EXERCISES,
): { rows: CuratedExercise[]; added: number } {
  const seenNames = new Set(base.map((r) => normalizeExerciseName(r.name)));
  const seenIds = new Set(base.map((r) => r.seedId));
  const rows = [...base];
  let added = 0;

  for (const supp of supplements) {
    const normName = normalizeExerciseName(supp.name);
    if (seenNames.has(normName) || seenIds.has(supp.seedId)) {
      continue;
    }
    seenNames.add(normName);
    seenIds.add(supp.seedId);
    rows.push(supp);
    added++;
  }

  return { rows, added };
}

// Explicit, reviewable free-exercise-db `primaryMuscles[0]` -> fixed
// MUSCLE_GROUPS lookup. Every key below is a raw value enumerated from
// free-exercise-db's dist/exercises.json (873 rows, checked 2026-07-21).
// Any value NOT in this table (or missing entirely) falls back to "Other"
// with a logged/counted fallback (Pitfall 3 — never null/empty).
export const muscleGroupMap: Record<string, MuscleGroup> = {
  abdominals: 'Core',
  hamstrings: 'Hamstrings',
  adductors: 'Other',
  quadriceps: 'Quads',
  biceps: 'Biceps',
  shoulders: 'Shoulders',
  chest: 'Chest',
  'middle back': 'Back',
  calves: 'Other',
  glutes: 'Glutes',
  'lower back': 'Back',
  lats: 'Back',
  triceps: 'Triceps',
  traps: 'Back',
  forearms: 'Other',
  neck: 'Other',
  abductors: 'Other',
};

// Explicit, reviewable free-exercise-db `equipment` -> fixed EQUIPMENT
// lookup. Any value NOT in this table (or missing entirely) falls back to
// "Other" with a logged/counted fallback.
export const equipmentMap: Record<string, EquipmentType> = {
  'body only': 'Bodyweight',
  machine: 'Machine',
  kettlebells: 'Kettlebell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  barbell: 'Barbell',
  bands: 'Band',
  'e-z curl bar': 'Barbell',
};

// Auditable, rule-based exclusions (D-03: trim ~873 -> ~400-500 by rule,
// never one-by-one manual curation).
//   - category: non-general-strength-training categories (mobility work,
//     cardio, and specialized competition lifts requiring gear/technique
//     outside this app's fixed equipment taxonomy).
//   - equipment: vague/accessory equipment values that aren't meaningfully
//     distinguishable within the fixed 8-item EQUIPMENT list.
//   - level: "expert"-level movements are niche/advanced, not needed for a
//     general-purpose curated library.
const EXCLUDED_CATEGORIES = new Set([
  'stretching',
  'cardio',
  'plyometrics',
  'strongman',
  'olympic weightlifting',
  'powerlifting',
]);
const EXCLUDED_EQUIPMENT_VALUES = new Set(['other', 'foam roll', 'exercise ball', 'medicine ball']);
const EXCLUDED_LEVELS = new Set(['expert']);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Transforms raw free-exercise-db-shaped records into the app's fixed
 * taxonomy. Every returned row has exactly one MuscleGroup and one
 * EquipmentType — never null/empty — with unmapped source values falling
 * back to "Other" and counted in the report for human spot-check.
 */
export function curate(records: RawExercise[]): { rows: CuratedExercise[]; report: CurationReport } {
  let excluded = 0;
  let muscleGroupFallbacks = 0;
  let equipmentFallbacks = 0;
  const seenIds = new Set<string>();
  const rows: CuratedExercise[] = [];

  for (const record of records) {
    const rawEquipment = record.equipment?.trim() ?? '';
    const rawMuscle = record.primaryMuscles?.[0]?.trim() ?? '';

    // Junk: neither field present at all — nothing to tag this exercise with.
    if (!rawEquipment && !rawMuscle) {
      excluded++;
      continue;
    }

    if (record.category && EXCLUDED_CATEGORIES.has(record.category.trim().toLowerCase())) {
      excluded++;
      continue;
    }
    if (rawEquipment && EXCLUDED_EQUIPMENT_VALUES.has(rawEquipment.toLowerCase())) {
      excluded++;
      continue;
    }
    if (record.level && EXCLUDED_LEVELS.has(record.level.trim().toLowerCase())) {
      excluded++;
      continue;
    }

    let muscleGroup = rawMuscle ? muscleGroupMap[rawMuscle.toLowerCase()] : undefined;
    if (!muscleGroup) {
      muscleGroup = 'Other';
      muscleGroupFallbacks++;
    }

    let equipment = rawEquipment ? equipmentMap[rawEquipment.toLowerCase()] : undefined;
    if (!equipment) {
      equipment = 'Other';
      equipmentFallbacks++;
    }

    const baseId = slugify(record.id || record.name);
    let seedId = baseId;
    let suffix = 2;
    while (seenIds.has(seedId)) {
      seedId = `${baseId}-${suffix}`;
      suffix++;
    }
    seenIds.add(seedId);

    rows.push({
      seedId,
      name: record.name,
      muscleGroup,
      equipment,
      notes: null,
    });
  }

  return {
    rows,
    report: {
      input: records.length,
      output: rows.length,
      excluded,
      muscleGroupFallbacks,
      equipmentFallbacks,
      supplemental: 0,
    },
  };
}

async function main(): Promise<void> {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`);
  }
  const records = (await response.json()) as RawExercise[];

  const { rows: curated, report } = curate(records);
  const { rows, added } = mergeSupplements(curated);
  report.output = rows.length;
  report.supplemental = added;

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(rows, null, 2)}\n`, 'utf-8');

  console.log('Curation report:');
  console.log(`  Input records:            ${report.input}`);
  console.log(`  Curated (rule-based):      ${curated.length}`);
  console.log(`  Supplemental added:        ${report.supplemental}`);
  console.log(`  Output rows:               ${report.output}`);
  console.log(`  Excluded:                  ${report.excluded}`);
  console.log(`  Muscle-group fallbacks:    ${report.muscleGroupFallbacks}`);
  console.log(`  Equipment fallbacks:       ${report.equipmentFallbacks}`);
  console.log(`Wrote ${report.output} rows to ${OUTPUT_PATH}`);

  if (report.output < 400 || report.output > 520) {
    console.warn(
      `WARNING: output row count (${report.output}) is outside the D-03 target range of 400-500 — review exclusion rules.`,
    );
  }
}

// Only run the network-fetching main() when executed directly (not when
// imported by the test file, which exercises curate() against an inline
// fixture and never touches the network). Compares the resolved module
// path against argv[1] (ESM-safe — works under `npx tsx` and does not
// false-positive when imported by vitest's transform pipeline).
const isDirectRun = (() => {
  try {
    return fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '');
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
