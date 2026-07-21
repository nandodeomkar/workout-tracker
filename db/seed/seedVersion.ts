// Bumped whenever the bundled seed data changes (additive updates only —
// see D-04/D-10: seed updates never overwrite user-edited rows).
//
// v1: Plan 01 stub (5 hardcoded exercises).
// v2: Plan 02 curated library — 498 rows from free-exercise-db, re-mapped
//     onto the fixed taxonomy via scripts/curate-exercises.ts.
// v3: GAP-1 — +19 supplemental machine/cable/free-weight staples missing
//     from free-exercise-db (scripts/curate-exercises.ts SUPPLEMENTAL_EXERCISES),
//     merged additively by seed_id so existing installs gain only the new rows.
export const CURRENT_SEED_VERSION = 3;
