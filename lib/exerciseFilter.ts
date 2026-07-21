// Pure, in-memory exercise filter pipeline (D-06/D-07).
//
// No DB access, no per-keystroke SQL (RESEARCH.md Anti-Pattern) — operates
// entirely over an already-loaded array of exercise rows.
//
// Semantics:
//   - `search`: case-insensitive substring match anywhere in `name` only
//     (never notes/muscleGroup/equipment).
//   - `muscleGroups` / `equipment`: OR within each row (empty array = no
//     constraint for that row); the two rows AND together.

import type { MuscleGroup, EquipmentType } from '../constants/taxonomy';
import type { Exercise } from '../db/schema';

export interface ExerciseFilter {
  search: string;
  muscleGroups: MuscleGroup[];
  equipment: EquipmentType[];
}

export function filterExercises<T extends Pick<Exercise, 'name' | 'muscleGroup' | 'equipment'>>(
  rows: T[],
  filter: ExerciseFilter,
): T[] {
  const search = filter.search.trim().toLowerCase();
  const muscleGroups = filter.muscleGroups;
  const equipment = filter.equipment;

  return rows.filter((row) => {
    if (search && !row.name.toLowerCase().includes(search)) {
      return false;
    }
    if (muscleGroups.length > 0 && !muscleGroups.includes(row.muscleGroup as MuscleGroup)) {
      return false;
    }
    if (equipment.length > 0 && !equipment.includes(row.equipment as EquipmentType)) {
      return false;
    }
    return true;
  });
}
