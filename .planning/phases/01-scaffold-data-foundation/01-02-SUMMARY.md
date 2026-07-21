---
phase: 01-scaffold-data-foundation
plan: 02
subsystem: database
tags: [drizzle-orm, vitest, free-exercise-db, exercise-taxonomy, data-curation]

# Dependency graph
requires:
  - phase: 01-scaffold-data-foundation (Plan 01)
    provides: Driver-agnostic Drizzle schema (exercises table with seed_id/is_custom/archived), db/client.ts, silent first-launch seed pipeline (gated by settings.seed_version), db/test/fixture.ts in-memory test harness
provides:
  - Fixed exercise taxonomy (constants/taxonomy.ts) — 10 muscle groups (D-01), 8 equipment types (D-02), single source of truth for curation and future UI
  - Dev-time curation script (scripts/curate-exercises.ts) transforming free-exercise-db's 873 exercises into the fixed taxonomy via explicit reviewable lookup tables + logged "Other" fallback
  - Committed curated seed data (db/seed/exercises.seed.json) — 498 rows, every row with exactly one valid muscleGroup and equipment value, no null/empty taxonomy
  - Real runSeedIfNeeded wired to the curated JSON (seed_version bumped to 2), proven idempotent and non-clobbering of user-edited rows
affects: [01-04-exercise-library-ui, 04-stats]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Build-time-only curation script (scripts/curate-exercises.ts): fetches upstream data, transforms via explicit lookup tables, writes a committed static JSON artifact — never re-tags at runtime"
    - "curate() as a pure, network-free function separated from main()'s network fetch/file-write side effects, so scripts/curate-exercises.test.ts exercises the mapping/fallback/exclusion logic against an inline fixture only"
    - "constants/taxonomy.ts as the single shared source of truth for fixed enum-like lists, consumed by both build-time tooling and (later) runtime UI"

key-files:
  created:
    - constants/taxonomy.ts
    - scripts/curate-exercises.ts
    - scripts/curate-exercises.test.ts
    - db/seed/exercises.seed.json
  modified:
    - db/seed/runSeed.ts
    - db/seed/seedVersion.ts
    - db/seed/runSeed.test.ts

key-decisions:
  - "Curation exclusion rules (D-03, ~873 -> 498 rows): drop category in {stretching, cardio, plyometrics, strongman, olympic weightlifting, powerlifting} (non-general-strength or specialized-competition movements), drop equipment in {other, foam roll, exercise ball, medicine ball} (vague/accessory gear not distinguishable in the fixed 8-item list), drop level=expert (niche/advanced), drop records with neither equipment nor primaryMuscles present at all. All auditable, rule-based — no one-by-one manual curation."
  - "Missing/blank equipment or an unmapped primaryMuscles value does NOT exclude a record — it falls back to \"Other\" with a counted/logged fallback (Pitfall 3: never leave a row with null/empty taxonomy). Exclusion and fallback are separate concerns: exclusion trims toward the D-03 target; fallback guarantees every surviving row is fully tagged."
  - "seedId = slugified free-exercise-db `id` field (already a stable per-exercise slug in the source dataset), with a numeric suffix on the rare collision — used as the onConflictDoNothing target so re-seeding is additive and never clobbers edits (D-04/D-10)."
  - "CURRENT_SEED_VERSION bumped 1 -> 2 to ship the curated dataset additively to any install that already ran the Plan 01 stub seed."

patterns-established:
  - "constants/taxonomy.ts is the canonical analog for any future fixed-list constant (e.g. a later settings-driven enum) that must be shared between build-time tooling and app UI."
  - "scripts/curate-exercises.ts is the canonical analog for future one-time data-transform scripts: pure transform function (unit-testable, network-free) + a thin main() that does I/O and is guarded from running during tests via an import.meta.url-vs-argv[1] check."

requirements-completed: [EXER-01]

# Metrics
duration: ~15min
completed: 2026-07-21
---

# Phase 1 Plan 2: Curated Exercise Library Summary

**Dev-time curation script transforms free-exercise-db's 873 exercises into a committed 498-row seed JSON via explicit muscleGroupMap/equipmentMap lookup tables with a logged "Other" fallback, and runSeedIfNeeded (seed v2) loads it idempotently without clobbering user edits.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-21T12:15:00Z (approx)
- **Completed:** 2026-07-21T12:30:24Z
- **Tasks:** 2 (both executed as TDD: RED then GREEN)
- **Files created/modified:** 7

## Accomplishments
- Defined `constants/taxonomy.ts` as the single source of truth for the fixed 10-muscle-group (D-01) and 8-equipment (D-02) taxonomies
- Built `scripts/curate-exercises.ts`: downloaded free-exercise-db's live `dist/exercises.json` (873 records), enumerated every distinct `equipment`/`primaryMuscles[0]` value actually present, and built explicit, reviewable `muscleGroupMap`/`equipmentMap` lookup tables with a logged `"Other"` fallback for anything unmapped (Pitfall 3 — zero null/empty taxonomy rows)
- Trimmed 873 → 498 rows via auditable, rule-based exclusions (category, equipment-vagueness, level) — never one-by-one manual curation — landing inside the D-03 target range (400–500)
- Committed `db/seed/exercises.seed.json`: 498 rows, verified 0 invalid taxonomy values, 498 unique `seedId`s, only 6 equipment fallbacks and 0 muscle-group fallbacks in the real dataset (human-spot-checkable via the printed report)
- Replaced Plan 01's 5-exercise stub seed with a real import of the curated JSON in `db/seed/runSeed.ts`, bumped `CURRENT_SEED_VERSION` to 2, and proved full-populate + idempotency + no-clobber-of-edited-row (D-04/D-10) with an automated test

## Task Commits

Each task was committed atomically:

1. **Task 1: Fixed taxonomy + curation script + curated seed JSON** - `fcf72fd` (feat)
2. **Task 2: Wire runSeed to curated JSON, idempotent + no-clobber proof** - `7f10936` (feat)

**Plan metadata:** pending (this SUMMARY + STATE/ROADMAP update)

## Files Created/Modified

- `constants/taxonomy.ts` - `MUSCLE_GROUPS` (10-item readonly tuple) and `EQUIPMENT` (8-item readonly tuple) with derived `MuscleGroup`/`EquipmentType` union types
- `scripts/curate-exercises.ts` - dev-time-only Node/TS script: `curate()` (pure transform, unit-tested), `muscleGroupMap`/`equipmentMap` (explicit lookup tables), `main()` (fetches free-exercise-db, writes the seed JSON, prints a human-readable report)
- `scripts/curate-exercises.test.ts` - mapping, fallback (unmapped/missing values → "Other" + counted), exclusion (junk records dropped), and seedId-uniqueness behaviors against an inline fixture (no network dependency)
- `db/seed/exercises.seed.json` - 498 curated rows: `{ seedId, name, muscleGroup, equipment, notes }`
- `db/seed/runSeed.ts` - stub `STUB_EXERCISES` array replaced with an import of `./exercises.seed.json`; same `onConflictDoNothing({ target: exercises.seedId })` / `onConflictDoUpdate` gate pattern from Plan 01
- `db/seed/seedVersion.ts` - `CURRENT_SEED_VERSION` bumped from 1 to 2
- `db/seed/runSeed.test.ts` - rewritten to assert against the real curated row count (498) instead of an arbitrary `>0`, covering full populate + seed_version set, idempotent re-run, and no-clobber of an edited row after a version bump

## Decisions Made

- **Curation exclusion rules (D-03):** drop `category` in `{stretching, cardio, plyometrics, strongman, olympic weightlifting, powerlifting}`, drop `equipment` in `{other, foam roll, exercise ball, medicine ball}` (vague/accessory gear), drop `level=expert`, drop records with neither `equipment` nor `primaryMuscles` present. This is auditable and rule-based (documented in code comments), not manual one-by-one curation, and lands at 498 rows — inside the 400–500 target.
- **Exclusion vs. fallback are separate concerns:** a record missing only ONE of `equipment`/`primaryMuscles` (or with an unmapped value) is kept and gets a `"Other"` fallback with a counted/logged occurrence; only records missing BOTH fields, or matching an explicit category/equipment/level exclusion rule, are dropped. This was clarified during Task 1 TDD (the behavior spec explicitly requires missing/blank equipment and unmapped-muscle records to survive with a fallback, not be dropped).
- **seedId = slugified free-exercise-db `id`** (the source dataset's own stable per-exercise slug, e.g. `barbell-bench-press`), with a numeric suffix appended only on the rare collision — reused as the `onConflictDoNothing` target so re-seeding stays additive (D-04/D-10).
- **`CURRENT_SEED_VERSION` bumped 1 → 2** so any install that already ran Plan 01's stub seed picks up the curated 498-row library additively on next launch, without touching any row the user has already edited.

## Deviations from Plan

### Auto-fixed Issues

None — no bugs, missing-critical-functionality, or blocking issues encountered requiring Rule 1/2/3 fixes.

### Process note (not a deviation from scope, but from strict TDD commit granularity)

Both tasks were executed as `tdd="true"`: the failing test was written and run (confirmed RED) before the implementation was written and re-run (confirmed GREEN) in both cases. However, each task's RED test and GREEN implementation were committed together in a single `feat(01-02):` commit rather than as separate `test(...)` → `feat(...)` commits. This plan's frontmatter is `type: execute` (not `type: tdd`), so the strict plan-level RED/GREEN gate-commit-sequence enforcement does not apply here, and no acceptance criterion required separate commits — but documenting for transparency since the general task-level TDD guidance recommends separate commits.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** None — plan executed exactly as specified; the only deviation is the commit-granularity note above, which has no functional impact.

## Issues Encountered

None. Network access to `raw.githubusercontent.com` (free-exercise-db's `dist/exercises.json`) was available in this environment, so the curation script ran end-to-end without needing a locally-vendored fallback copy.

## User Setup Required

None — no external service configuration required. The curation script's network fetch is a one-time, dev-time-only operation (not part of the shipped app or its boot path).

## Next Phase Readiness

- The exercise seed pipeline is now fully real: `migrate → seed (498 curated rows) → read → render` is proven end-to-end by `db/seed/runSeed.test.ts`, replacing Plan 01's Walking Skeleton stub.
- `constants/taxonomy.ts` is ready to be consumed directly by the Exercises tab's filter chips and custom-exercise create/edit forms (D-05–D-12), whichever later plan in this phase builds that UI.
- Muscle-group tagging consistency (the STATE.md-flagged Phase 4 stats risk) is now verified: every one of the 498 seeded rows carries exactly one of the 10 fixed `MUSCLE_GROUPS` values, confirmed by an automated one-off check over the committed JSON (0 invalid rows).
- No blockers for the next plan in this phase.

---
*Phase: 01-scaffold-data-foundation*
*Completed: 2026-07-21*

## Self-Check: PASSED

- All key files verified present on disk (`constants/taxonomy.ts`, `scripts/curate-exercises.ts`, `scripts/curate-exercises.test.ts`, `db/seed/exercises.seed.json`, `db/seed/runSeed.ts`, `db/seed/seedVersion.ts`, `db/seed/runSeed.test.ts`).
- Both task commit hashes verified present in `git log` (`fcf72fd`, `7f10936`).
- Plan-level verification re-run clean: `npx vitest run scripts/curate-exercises.test.ts db/seed/runSeed.test.ts` (9/9 tests passed), `npx tsc --noEmit` (0 errors).
- One-off node check confirms `db/seed/exercises.seed.json` has 498 rows (within the 400–500 target), 0 rows with invalid/missing taxonomy, 498 unique `seedId`s.
