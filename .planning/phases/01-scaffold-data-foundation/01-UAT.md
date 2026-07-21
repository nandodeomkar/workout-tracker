---
status: diagnosed
phase: 01-scaffold-data-foundation
source: [01-06-SUMMARY.md]
started: 2026-07-21T13:30:00Z
updated: 2026-07-21T13:30:00Z
---

## Current Test

number: complete
name: On-device offline foundation smoke test
expected: All 8 checkpoint steps pass on a real Android device in airplane mode
awaiting: gap closure

## Tests

### 1. Offline cold-launch to tabs (no crash, no network error, no onboarding)
expected: Lands directly on 5-tab shell in airplane mode
result: pass

### 2. Browse/search/filter ~500 exercises
expected: A–Z list, live substring search, chip filters with OR-within/AND-across
result: issue — works mechanically, but library is missing commonly used exercises/variants (e.g. "seated chest supported machine row")

### 3. Duplicate-name warning on create (D-12)
expected: Creating "Seated cable row" when "Seated Cable Rows" exists shows non-blocking "already exists — open it?" warning
result: issue — no warning; near-duplicate (case/plural) not detected, exercise created silently

### 4. Edit seeded exercise persists everywhere
expected: Renamed exercise shows new name in list, search results, and detail view
result: issue — new name persists in expanded/detail panel but list/search panels show stale name until app reload

### 5. Archive / show-archived / unarchive
expected: Archived exercise leaves default list, reappears under "Show archived", can be unarchived, no delete option
result: pass

### 6. Force-kill + relaunch persistence (offline)
expected: Custom exercise and seeded-exercise edit persist, no duplicate seeding
result: pending — re-verify after gap fixes (tester confidence reduced by UX issues)

### 7. Overall usability of the Exercises library
expected: Layout, search, editing, and archive flows are understandable without instruction
result: issue — owner judged the UI unintuitive to the point of blocking confident verification (layout, search bar, editing section, archive flow)

## Summary

total: 7
passed: 2
issues: 4
pending: 1
skipped: 0
blocked: 0

## Gaps

### GAP-1: Seed library missing common exercise variants
severity: major
area: data curation (scripts/curate-exercises.ts, db/seed/exercises.seed.json)
detail: Curated 498-row seed from free-exercise-db lacks commonly used machine/cable variants, e.g. "seated chest supported machine row". Expand curation rules or add supplemental entries.
status: failed

### GAP-2: Duplicate detection misses near-duplicates
severity: major
area: db/exercises.ts (findByName), app/(tabs)/exercises/new.tsx
detail: "Seated cable row" created with no warning while "Seated Cable Rows" exists. Matching must normalize case, whitespace, and trailing plural before the D-12 warn-but-allow prompt.
status: failed

### GAP-3: Library list stale after edit
severity: major
area: app/(tabs)/exercises/index.tsx (load-once pattern)
detail: Editing a seeded exercise updates detail view but the list/search still shows the old name until reload. Library loads once on mount; needs reload-on-focus (useFocusEffect) or mutation-driven invalidation.
status: failed

### GAP-4: Exercises UI unintuitive (blocking UX)
severity: major
area: app/(tabs)/exercises/* screens, components/FilterChipRow.tsx, components/ExerciseRow.tsx
detail: Owner reports overall layout, search bar, editing section, and archive flow are hard or impossible to understand; verification confidence suffered. Needs a UX rework of the library screens (information hierarchy, affordances, edit/archive discoverability), not cosmetic polish.
status: failed
