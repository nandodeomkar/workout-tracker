---
phase: 04-stats-charts
plan: 06
subsystem: testing
tags: [vitest, better-sqlite3, performance, drizzle, synthetic-data]

# Dependency graph
requires:
  - phase: 04-stats-charts (Plans 02-04)
    provides: db/stats.ts#loadExerciseChartSets / loadWeeklyVolumeSets / loadAllHistorySets, and the pure reductions (buildChartSeries, buildWeeklyVolume, computeAllTimeRecords)
provides:
  - "seedSyntheticHistory — deterministic ~5-year / ~15,600-set in-memory fixture generator (db/test/syntheticHistory.ts)"
  - "Timed regression guard over all three stat query paths (db/stats.performance.test.ts); worst-case all-history PR scan proven <500ms in Node"
  - "Documented on-device (Skia GPU) responsiveness verification closing the STAT-04 automation gap"
affects: [05-body-measurements, 08-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Deterministic seeded-PRNG synthetic history for perf fixtures (fixed integer seed, batched transactional inserts) so timing tests are non-flaky"
    - "performance.now() around query+reduction with the one-time seed cost excluded (seed in beforeEach, time only the path)"
    - "Explicitly-documented automation gap: Node timing covers the data half; Skia GPU frame time is a human-verified device checkpoint"

key-files:
  created:
    - db/test/syntheticHistory.ts
    - db/stats.performance.test.ts
  modified: []

key-decisions:
  - "No production code or db/schema.ts change and no drizzle-kit push — STAT-04 aggregation stays in JS after a targeted fetch; the ~15,600-row scan runs in low tens of ms on existing indexes"
  - "Task 3 (Skia GPU render/scroll) is a blocking human-verify checkpoint, not automated — CLAUDE.md forbids RN rendering in vitest; over-claiming was rejected in favor of a documented device pass"

patterns-established:
  - "Perf ceilings are conservative regression guards (catch accidental N+1 / unbounded scans), not tight budgets: <500ms on the all-history PR scan over ~15,600 sets"

requirements-completed: [STAT-04]

# Metrics
duration: ~15min automated + device-verification checkpoint
completed: 2026-07-23
---

# Phase 04 Plan 06: STAT-04 Performance Validation Summary

**Deterministic ~5-year / ~15,600-set synthetic fixture plus a timed regression guard over all three stat query paths (all-history PR scan proven <500ms in Node), with the non-automatable Skia render half verified live on the physical device against the large dataset.**

## Performance

- **Duration:** ~15 min automated (Tasks 1-2) + an on-device verification checkpoint (Task 3)
- **Started:** 2026-07-22T23:58:00Z
- **Completed:** 2026-07-23T00:37:00Z
- **Tasks:** 3 (2 automated, 1 human-verify checkpoint)
- **Files modified:** 2 created (test-only), 0 production

## Accomplishments
- `db/test/syntheticHistory.ts` — `seedSyntheticHistory(db, opts?)` bulk-seeds a deterministic ~780-workout / ~15,600-set, ~5-year history across multiple muscle groups via a fixed-seed PRNG and transactional/batched inserts; returns `{ workoutCount, setCount, sampleExerciseId }`.
- `db/stats.performance.test.ts` — times all three stat paths (per-exercise chart series, 12-week volume, all-history PR scan) over the fixture; asserts `setCount >= 12000` (can't pass on a trivial DB) and the worst-case all-history PR scan `< 500ms` in Node.
- On-device (Task 3): loaded the ~15,600-set synthetic history onto the physical device and confirmed the per-exercise chart (heaviest synthetic exercise, 3,120 sets, "All" range) and the Stats-tab PR feed / weekly-volume render and stay interactive — **owner confirmed "responsive"** (cosmetic chart styling noted as a separate follow-up, out of scope).

## Task Commits

Each task was committed atomically:

1. **Task 1: Synthetic-history seed generator** - `177e47d` (feat)
2. **Task 2: Timed assertions over the three query paths** - `8c9b38b` (test)
3. **Task 3: On-device chart-responsiveness verification** - human-verify checkpoint (no code commit; owner confirmed responsive on device)

**Plan metadata:** (final docs commit below)

## Files Created/Modified
- `db/test/syntheticHistory.ts` - Deterministic synthetic-history seed generator for the perf fixture (test-only).
- `db/stats.performance.test.ts` - Timed regression assertions over the three stat query paths; all-history PR scan <500ms.

## Decisions Made
- No production/schema change, no `drizzle-kit push` — STAT-04 strategy keeps aggregation in JS after a targeted fetch; existing indexes are sufficient at ~15,600 rows (RESEARCH.md).
- Kept Task 3 as an explicit human-verify checkpoint rather than faking automation of Skia GPU frame time (unmeasurable in the project's Node-only vitest strategy).

## Deviations from Plan

None - plan executed exactly as written. Tasks 1-2 automated and committed; Task 3 completed as the specified blocking human-verify device checkpoint.

## Issues Encountered

- **Device app failed to boot during Task 3** with `[runtime not ready]: TypeError: Cannot read property 'EventEmitter' of undefined` at bundle load. Root cause: stale Metro transform cache (unrelated to wave-5 code or the DB) — the running instance predated 04-01's Skia/victory-native native additions. Resolved by restarting Metro with `--clear`; the app then booted and charts rendered against the large dataset. Not a code defect.
- Device DB seeding was done by swapping the on-device SQLite file (app force-stopped first; verified full backup taken; real data 6 workouts/20 sets/520 exercises restored and re-verified after the check). No user data lost.
- Full `npx vitest run` suite green (416/416). Perf assertions pass (all-history PR scan well under 500ms).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- STAT-04 complete → all four Phase 4 stats requirements (STAT-01..04) satisfied. Phase 4 is functionally done pending phase-level verification.
- Follow-up (out of scope, already spawned as a background task): the per-exercise chart's x-axis renders overlapping raw ISO timestamps instead of thinned date ticks — cosmetic, not a STAT-04 blocker.
- No blockers.

---
*Phase: 04-stats-charts*
*Completed: 2026-07-23*

## Self-Check: PASSED
