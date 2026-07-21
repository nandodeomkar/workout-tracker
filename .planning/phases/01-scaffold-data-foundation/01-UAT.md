---
status: gaps-fixed-pending-reuat
phase: 01-scaffold-data-foundation
source: [01-06-SUMMARY.md]
started: 2026-07-21T13:30:00Z
updated: 2026-07-21T14:20:00Z
---

## Current Test

number: complete
name: On-device offline foundation smoke test
expected: All 8 checkpoint steps pass on a real Android device in airplane mode
awaiting: device re-UAT (GAP-1..4 fixed in code; re-run tests 2,3,4,6,7 on a real device)

## Tests

### 1. Offline cold-launch to tabs (no crash, no network error, no onboarding)
expected: Lands directly on 5-tab shell in airplane mode
result: pass

### 2. Browse/search/filter ~500 exercises
expected: A–Z list, live substring search, chip filters with OR-within/AND-across
result: issue → GAP-1 fixed (seed 517, +19 supplemental staples incl. "Chest Supported Machine Row"); pending device re-UAT

### 3. Duplicate-name warning on create (D-12)
expected: Creating "Seated cable row" when "Seated Cable Rows" exists shows non-blocking "already exists — open it?" warning
result: issue → GAP-2 fixed (normalized near-duplicate detection; unit + DB tests cover the case); pending device re-UAT

### 4. Edit seeded exercise persists everywhere
expected: Renamed exercise shows new name in list, search results, and detail view
result: issue → GAP-3 fixed (useFocusEffect reload-on-focus); pending device re-UAT

### 5. Archive / show-archived / unarchive
expected: Archived exercise leaves default list, reappears under "Show archived", can be unarchived, no delete option
result: pass

### 6. Force-kill + relaunch persistence (offline)
expected: Custom exercise and seeded-exercise edit persist, no duplicate seeding
result: pending — re-verify after gap fixes (tester confidence reduced by UX issues)

### 7. Overall usability of the Exercises library
expected: Layout, search, editing, and archive flows are understandable without instruction
result: issue → GAP-4 fixed (library reworked per sketch 001-C: pills + sticky A–Z + iconified rows; clearer detail/create headers, archive confirm, save toast); pending device re-UAT

## Summary

total: 7
passed: 2
issues: 4 (all fixed in code — GAP-1..4; awaiting device re-UAT)
pending: 1 (test 6 — force-kill persistence, re-verify on device)
skipped: 0
blocked: 0
gates_remaining: on-device re-UAT of tests 2, 3, 4, 6, 7 (code verified via typecheck + 48-test vitest suite; no RN component tests in stack)

## Gaps

### GAP-1: Seed library missing common exercise variants
severity: major
area: data curation (scripts/curate-exercises.ts, db/seed/exercises.seed.json)
detail: Curated 498-row seed from free-exercise-db lacks commonly used machine/cable variants, e.g. "seated chest supported machine row". Expand curation rules or add supplemental entries.
status: fixed
resolution: Root cause — the flagged staples are ABSENT from free-exercise-db entirely (verified against the 873-row source), not merely excluded by curation rules, so relaxing exclusions could not recover them. Added SUPPLEMENTAL_EXERCISES (20 hand-authored machine/cable/free-weight staples) + a pure mergeSupplements() to scripts/curate-exercises.ts, merged +19 into the seed (517 rows, append-only; 1 was a dedup of an existing row), and bumped CURRENT_SEED_VERSION 2→3 so existing installs gain only the new rows via onConflictDoNothing(seed_id). Commit 5631562.

### GAP-2: Duplicate detection misses near-duplicates
severity: major
area: db/exercises.ts (findByName), app/(tabs)/exercises/new.tsx
detail: "Seated cable row" created with no warning while "Seated Cable Rows" exists. Matching must normalize case, whitespace, and trailing plural before the D-12 warn-but-allow prompt.
status: fixed
resolution: Added lib/exerciseName.ts normalizeExerciseName() (lowercase + collapse non-alphanumeric to spaces + strip a single trailing plural "s", preserving "...ss" like "press") and db findDuplicatesByName() using it over the full table; wired the create form to it. New unit + DB tests cover the exact reported case. Commit 3f04b35.

### GAP-3: Library list stale after edit
severity: major
area: app/(tabs)/exercises/index.tsx (load-once pattern)
detail: Editing a seeded exercise updates detail view but the list/search still shows the old name until reload. Library loads once on mount; needs reload-on-focus (useFocusEffect) or mutation-driven invalidation.
status: fixed
resolution: Replaced the load-once useEffect in app/(tabs)/exercises/index.tsx with useFocusEffect — the query re-runs whenever the Exercises tab regains focus, so edits/creates/archives are reflected on return. Search/filter stay in-memory. Commit 7673dc5 (carried into the GAP-4 rework, commit 1e00407).

### GAP-4: Exercises UI unintuitive (blocking UX)
severity: major
area: app/(tabs)/exercises/* screens, components/FilterChipRow.tsx, components/ExerciseRow.tsx
detail: Owner reports overall layout, search bar, editing section, and archive flow are hard or impossible to understand; verification confidence suffered. Needs a UX rework of the library screens (information hierarchy, affordances, edit/archive discoverability), not cosmetic polish.
status: fixed
resolution: Reworked the library per approved sketch 001-C ("Pills + A–Z"): titled app bar + clear '+' add button, single-select muscle-group pill row (All + 10 groups, replacing the two multi-select chip rows), sticky A–Z SectionList, iconified rows with chevron + inline ARCHIVED tag, explicit empty-state create affordance. Detail/create screens gained in-screen headers (back + identity), an archive confirmation dialog (reversible, not delete — D-11), and Android save/archive toast feedback ("updated everywhere") — the low-risk trust wins shared across sketch 002 variants (002 itself remains unreviewed, so no single variant was adopted wholesale). Commit 1e00407.
note: Verified by typecheck + full vitest suite (no RN component tests in this stack). Visual/interaction quality still needs on-device confirmation in re-UAT.
