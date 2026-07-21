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
    },
  };
}

async function main(): Promise<void> {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${SOURCE_URL}: ${response.status} ${response.statusText}`);
  }
  const records = (await response.json()) as RawExercise[];

  const { rows, report } = curate(records);

  writeFileSync(OUTPUT_PATH, `${JSON.stringify(rows, null, 2)}\n`, 'utf-8');

  console.log('Curation report:');
  console.log(`  Input records:            ${report.input}`);
  console.log(`  Output rows:               ${report.output}`);
  console.log(`  Excluded:                  ${report.excluded}`);
  console.log(`  Muscle-group fallbacks:    ${report.muscleGroupFallbacks}`);
  console.log(`  Equipment fallbacks:       ${report.equipmentFallbacks}`);
  console.log(`Wrote ${report.output} rows to ${OUTPUT_PATH}`);

  if (report.output < 400 || report.output > 500) {
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
