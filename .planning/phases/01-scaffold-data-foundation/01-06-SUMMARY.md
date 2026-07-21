---
phase: 01-scaffold-data-foundation
plan: 06
status: gaps_found
type: checkpoint:human-verify
requirements: [FNDN-01]
completed: 2026-07-21
---

# Plan 01-06 Summary — On-device offline foundation smoke test

## Execution

Dev client built and installed on a physical Android device (25080RABDI) after resolving two Windows build blockers:

1. **Transient NDK failure** — NDK 27.1 was auto-extracted mid-build; one libc++ header (`datasizeof.h`) was unreadable (likely Defender scanning freshly extracted files). Resolved on retry.
2. **Windows MAX_PATH failure** — ninja `Stat()` failed on a ~370-char object path from react-native-gesture-handler codegen. SDK CMake 3.22.1's bundled ninja 1.10.2 is not long-path-aware. **Fix:** installed SDK CMake 3.31.4 (`sdkmanager "cmake;3.31.4"`) and pinned it via `cmake.dir` in `android/local.properties` (machine-local, gitignored). CMake 3.31 hashes over-long object paths at configure time. Build then succeeded in 5m28s.

Metro served over USB via `adb reverse tcp:8081` with the dev client pointed at `localhost:8081`, so airplane-mode testing worked with the cable attached.

## Device test results

| # | Check | Result |
|---|-------|--------|
| 1–3 | Offline cold-launch to tabs, no crash, no network error, no onboarding | PASS (no crash or network error reported; tester confidence reduced by UX issues below) |
| 4 | Browse/search/filter ~500 exercises | PARTIAL — works, but library coverage gaps (GAP-1) |
| 5 | Create custom + duplicate-name warning | FAIL — near-duplicate not detected (GAP-2) |
| 6 | Edit seeded exercise persists | FAIL — persists in detail view but list/search shows stale name (GAP-3) |
| 6b | Archive / show-archived / unarchive | PASS |
| 7 | Force-kill + relaunch persistence | Not explicitly disputed; re-verify after fixes |
| 8 | No network needed | PASS (no network errors in airplane mode) |

## Gaps (feed to gap-closure planning)

- **GAP-1 (content):** Seed library missing commonly used exercises/variants — e.g. "seated chest supported machine row". Curation from free-exercise-db (498 rows) lacks common machine/cable variants. Needs curation-rule expansion or supplemental seed entries.
- **GAP-2 (logic):** Duplicate detection missed "Seated cable row" vs existing "Seated Cable Rows". `findByName` matching is too strict (misses case/plural/near-duplicate forms). Needs normalized matching (lowercase, trim, strip trailing plural, collapse whitespace) before the D-12 warn-but-allow prompt.
- **GAP-3 (bug):** After editing a seeded exercise, the new name shows in the expanded/detail panel but NOT in the library list/search results — list state is stale because the library is loaded once and not refreshed on focus. Needs reload-on-focus (`useFocusEffect`) or store invalidation after mutations.
- **GAP-4 (UX):** Overall Exercises UI judged unintuitive by the owner — layout, search bar, exercise editing section, and archive flow are hard to understand; tester could not confidently verify all steps because of this. Needs a UX rework pass of the library screens, not just polish.

## Verdict

FNDN-01's core claim (offline boot, SQLite-only, no network) held on hardware. The checkpoint is NOT approved: two functional defects (GAP-2, GAP-3), one content gap (GAP-1), and one UX blocker (GAP-4) require a gap-closure pass before Phase 1 can be marked complete.
