---
phase: 06-programs-progression
verified: 2026-07-24T11:00:00Z
status: human_needed
score: 6/6 must-haves verified (code-level); 1 item requires device re-test
overrides_applied: 0
human_verification:
  - test: "Re-run 06-UAT.md Test 3 on a physical device: start the pointed Linear 5x5 day, log all working sets at a real weight (e.g. 100 kg x 5), Finish. Confirm the finish screen '+2.5 kg' badge AND that starting the NEXT program day (any day using that lift, including a different day than the one just finished) prescribes sets at the incremented weight (102.5 kg), not the same weight as before."
    expected: "Next day's card shows prescribed sets pre-filled at 102.5 kg (lifted + increment), matching db/programs.crud.test.ts's HEADLINE cross-day test which passes at the unit level."
    why_human: "06-UAT.md Test 3 originally failed on-device even though the underlying computation (applyProgressionAndAdvance) was correct — the defect was in prefill wiring that only a live app render can confirm. The gap-closure fix (06-07/06-08) is now fully covered by passing unit tests (HEADLINE, CROSS-DAY WRITE SHARING, FIRST RUN, CR-01 regressions — 40/40 targeted tests, 526/526 full suite), but no device re-test has been recorded since the fix landed. Unit tests exercise the DB layer only; they cannot confirm the active-workout screen actually renders the prescribed sets correctly on a real device."
---

# Phase 6: Programs & Progression — Verification Report

**Phase Goal:** Users can run a structured multi-week program that auto-advances through days and progresses their working weights.
**Verified:** 2026-07-24T11:00:00Z
**Status:** human_needed
**Re-verification:** Yes — final verification after gap-closure re-execution (06-07, 06-08) that closed the 06-UAT.md Test-3 BLOCKER (PROG-02), plus a code-review BLOCKER (CR-01) found and fixed during the same run.

This report focuses primary scrutiny on the two gap-closure plans (06-07: `program_exercise_progress` storage model; 06-08: per-lift prefill + cross-day sharing) and the CR-01 write-path fix, per the verification scope note. The other Success Criteria (PROG-01, PROG-03, PROG-04) were already device-UAT-verified in `06-UAT.md` (tests 1, 2, 5, 6, 7, 8 — all passed) and receive a lighter regression check here since their underlying code was not touched by the gap-closure plans.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create a program as an ordered list of template days with a pointer to the next day (PROG-01) | VERIFIED | `createProgram`/`addProgramDay`/`loadProgramDetail` in `db/programs.ts`; `app/programs/index.tsx`, `app/programs/new.tsx`, `app/programs/[programId].tsx` exist; device UAT tests 2, 7, 8 passed (06-UAT.md). Untouched by gap closure — regression-checked only. |
| 2 | A percent-of-training-max exercise computes prescribed weights from a per-exercise training max across a wave (PROG-03) | VERIFIED | `prefillPercentTmSets` (db/programs.ts:521), `app/programs/training-maxes.tsx`; device UAT tests 5, 6 passed. `applyProgressionAndAdvance`'s %TM branch and cycle-wrap bump logic untouched by 06-07/06-08 — confirmed still passing in the 526/526 full-suite run. |
| 3 | User can select from a small set of bundled generic programs and start using one immediately (PROG-04) | VERIFIED | `data/bundledPrograms/linear5x5.json`, `percentWave.json`; `materializeBundledProgram` (db/programs.ts:440); device UAT test 2 passed. |
| 4 | Completing a linear-progression program day auto-increments its PRESCRIBED weight on success — next session (any day using that lift) prescribes lifted+increment (PROG-02, Test-3 blocker, defect A: no prefill) | VERIFIED (code-level) — see human verification | `prefillLinearSets` (db/programs.ts:611-677) reads `program_exercise_progress` via `getProgramExerciseProgress` and inserts prescribed straight-sets when a positive working weight is anchored; wired into `startWorkoutFromProgramDay` (db/programs.ts:727). Unit test "prescribes linear straight-sets at day start from the per-lift working weight" and "HEADLINE: a Squat bump on Day A is prescribed on Day B" both pass. No device re-test recorded since fix landed — flagged for human verification. |
| 5 | Linear progression state is keyed per (program, exercise) — a Squat bump on Day A carries to Day B (PROG-02, defect B: per-row not per-lift) | VERIFIED | `program_exercise_progress` table with composite PK `(program_id, exercise_id)` (db/schema.ts:169-185); `applyProgressionAndAdvance`'s linear branch reads/writes this table via `getProgramExerciseProgress` + upsert (db/programs.ts:1014-1053, 1132-1149). Test "CROSS-DAY WRITE SHARING: finishing Day A success writes exactly one shared per-lift row" and "HEADLINE" both pass. |
| 6 | CR-01 preserved: a linear finish with no valid positive weight anchor (no working sets, no prior state, null template target) skips the write instead of wedging the program pointer | VERIFIED | Guard at db/programs.ts:1040-1042 (`if (!Number.isFinite(loggedWeightKg) \|\| loggedWeightKg <= 0) { continue; }`) — added in commit `5ae086b`. Regression test "CR-01: a finish with no working sets for a null-target linear lift advances without wedging (no 0 kg write)" (db/programs.crud.test.ts:508-532, committed `9ce96c7`) passes and asserts `result.applied === true`, pointer advances, `programId` clears, and zero garbage rows are written. |

**Score:** 6/6 truths verified at the code/test level. Truth 4 requires a device re-test before it can be marked fully closed — routed to human verification per the scope note (the original UAT failure for this exact truth was only visible on-device, not in unit tests).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `db/schema.ts` — `programExerciseProgress` table | Composite-PK per-lift-per-program progression storage | VERIFIED | Lines 169-185: `programId`/`exerciseId` composite PK, nullable `workingWeightKg`, `consecutiveFails` NOT NULL DEFAULT 0. `ProgramExerciseProgress`/`NewProgramExerciseProgress` types exported (lines 222-223). |
| `drizzle/0005_mushy_gressill.sql` | Additive-only migration | VERIFIED | Single `CREATE TABLE program_exercise_progress` with composite PK and two FK clauses; zero `ALTER`/`DROP` statements. |
| `drizzle/meta/_journal.json` / `drizzle/migrations.js` | Migration wired into the app's migration chain | VERIFIED | Journal has idx-5 entry (`0005_mushy_gressill`); migrations.js imports/wires m0005 (confirmed by passing migration test). |
| `db/migrations.test.ts` — 0004→0005 case | Proves the migration is additive and data-safe | VERIFIED | `PROG-02: migration 0004 -> 0005 (program_exercise_progress) preserves data` test passes; asserts before/after byte-identical `programs`/`program_days` rows and the new table's 4 columns. |
| `db/programs.ts` — `prefillLinearSets` | Prescribes linear sets at day start from per-lift working weight | VERIFIED | Lines 611-677; wired into `startWorkoutFromProgramDay` (line 727); T-08-02 guard skips prescription when no valid anchor exists. |
| `db/programs.ts` — `getProgramExerciseProgress` | Single-row per-lift-per-program read helper | VERIFIED | Lines 745-755; used by both `prefillLinearSets` (day-start read) and `applyProgressionAndAdvance` (finish-time read), matching the plan's "same reader at both sites" pattern. |
| `db/programs.ts` — `assertValidWorkingWeightKg` | Validates before every upsert; caps at MAX_WEIGHT_KG | VERIFIED | Line 151; invoked at line 1136 before every `programExerciseProgress` write. |
| `db/programs.ts` — CR-01 write-path guard | Skips (never queues) a non-positive anchor write | VERIFIED | Lines 1040-1042; matches the reviewer's exact suggested fix in 06-REVIEW.md. |
| `db/programs.crud.test.ts` — gap-closure + CR-01 coverage | Cross-day sharing, prefill, first-run fallback, CR-01 regression | VERIFIED | All present and passing: HEADLINE, CROSS-DAY WRITE SHARING, FIRST RUN, targetSets-honored, both CR-01 cases (null-target success anchor, no-working-sets wedge regression). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `startWorkoutFromProgramDay` | `program_exercise_progress` | `prefillLinearSets` reads the shared working weight, then `insertSet` | WIRED | db/programs.ts:727 calls `prefillLinearSets` inside the `templateDetail` guard, right after `prefillPercentTmSets`. |
| `applyProgressionAndAdvance` | `program_exercise_progress` | Upsert keyed by `(program_id, exercise_id)` | WIRED | db/programs.ts:1138-1148 — `tx.insert(programExerciseProgress)...onConflictDoUpdate({ target: [programId, exerciseId], ... })`. |
| `app/active-workout/[workoutId].tsx` | Prescribed sets rendering | `setRows.length > 0` branch (pre-existing, no change needed) | WIRED | Confirmed at line 258 — the screen already renders any pre-inserted sets, exactly as the plan claimed; no screen files were modified in 06-07/06-08 (confirmed via `files_modified` in both plans and `git log`). |
| `deleteProgram` | `program_exercise_progress` cleanup | `tx.delete(programExerciseProgress).where(programId=...)` | WIRED | Test "deleteProgram removes the program_exercise_progress rows it wrote" passes. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `prefillLinearSets` | `workingWeightKg` | `getProgramExerciseProgress` → real DB row (`program_exercise_progress.working_weight_kg`), not a static/hardcoded value | Yes | FLOWING |
| `applyProgressionAndAdvance` linear branch | `loggedWeightKg` / `result.nextWeightKg` | Computed from actually-logged sets (`Math.min` over working sets) and `resolveLinearProgression`, then written to the DB via upsert | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CR-01 regression test passes in isolation | `npx vitest run db/programs.crud.test.ts db/migrations.test.ts --no-file-parallelism` | 40/40 tests pass (3 test files, incl. a benign leftover worktree copy of migrations.test.ts) | PASS |
| Full project suite still green after gap closure | `npx vitest run --no-file-parallelism` | 526/526 tests pass across 63 files | PASS |
| Typecheck clean | `npx tsc --noEmit -p tsconfig.json` | 0 errors | PASS |
| Migration 0005 is additive-only | Manual inspection of `drizzle/0005_mushy_gressill.sql` | Single `CREATE TABLE`, no `ALTER`/`DROP` | PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes exist in this project and none were declared in the phase's PLAN/SUMMARY files. Skipped — no probes to run.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| PROG-01 | 06-02, 06-03, 06-06 | Program as ordered list of template days with next-day pointer | SATISFIED | Programs manager, program detail, custom builder all present and device-UAT-passed. |
| PROG-02 | 06-01, 06-04, 06-07, 06-08 | Linear progression rules (auto-increment weight on success) | SATISFIED | Gap-closure (06-07/06-08) plus CR-01 fix close the Test-3 blocker at the code/test level; device re-verification pending (human_needed). |
| PROG-03 | 06-01, 06-05 | Percent-of-training-max progression (5/3/1-style waves) with per-exercise training maxes | SATISFIED | TM-setup sheet, prefill, cycle-wrap bump all device-UAT-passed; untouched by this gap-closure round. |
| PROG-04 | 06-02, 06-03 | Bundled generic programs, no proprietary content | SATISFIED | `linear5x5.json` / `percentWave.json` bundled; device-UAT-passed. |

No orphaned requirements — REQUIREMENTS.md maps exactly PROG-01..04 to Phase 6, and all four appear in at least one plan's `requirements` frontmatter field.

### Anti-Patterns Found

None. Grep for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` across all files touched by the gap-closure plans (`db/schema.ts`, `db/programs.ts`, `db/programs.crud.test.ts`, `db/migrations.test.ts`) returned zero matches.

**Advisory (non-blocking) note carried forward from 06-REVIEW.md:** IN-01 — the `db/migrations.test.ts` 0004→0005 case asserts the four `program_exercise_progress` column *names* exist via `PRAGMA table_info` but does not additionally assert the composite PK ordinals or `working_weight_kg`'s nullability. This is an INFO-level test-coverage gap (a regression that dropped the composite PK would still pass the existing test), not a functional defect — no code, schema, or behavior is missing. Left open per 06-REVIEW-FIX.md's explicit "left for user decision" note; does not block phase goal achievement and is not treated as a gap here.

WR-01 and WR-02 from 06-REVIEW.md remain open as documented, deliberate tradeoffs (WR-01: anchor-on-logged-weight design decision that also backs a passing test; WR-02: practically unreachable given `MAX_INCREMENT_KG` bounds) — both explicitly deferred by the reviewer/fixer, not silently dropped.

### Human Verification Required

### 1. Device re-test of 06-UAT.md Test 3 (PROG-02 linear prefill + cross-day sharing)

**Test:** Start the pointed Linear 5×5 day on a physical device, log all working sets at a real weight (e.g. 100 kg × 5 for every set), Finish. Confirm the finish screen's "+2.5 kg" badge. Then start the NEXT program day that shares the same lift (e.g. Day B's Squat in the bundled Linear 5×5 program) and confirm its card is pre-filled at the incremented weight (102.5 kg), not the previous weight.

**Expected:** Day B's Squat sets are prescribed at 102.5 kg (lifted + increment) — matching the passing `HEADLINE` and `CROSS-DAY WRITE SHARING` unit tests.

**Why human:** This is exactly the truth that failed device UAT originally (06-UAT.md Test 3) despite the underlying computation being correct — the defect was in the prefill wiring, which only a live app render can confirm end-to-end (workout creation → set insertion → active-workout screen render → user-visible pre-filled weight). The gap-closure fix is now fully covered by passing unit/integration-level tests against an in-memory DB, but no on-device confirmation has been recorded since the fix (06-07/06-08 + CR-01) landed. Unit tests cannot substitute for this because they don't exercise the React Native rendering layer.

### Gaps Summary

No code-level gaps found. All must-haves for the phase goal — program creation with ordered days and a pointer (PROG-01), linear progression prescribed and shared per-lift across days (PROG-02, the specific Test-3 blocker this re-verification targeted), percent-of-training-max progression (PROG-03), and bundled programs (PROG-04) — are backed by passing code, passing tests (40/40 targeted, 526/526 full suite), and clean typecheck. The CR-01 code-review blocker (linear finish with no valid anchor wedging the program) is fixed and regression-tested.

The phase is not marked `passed` because Truth 4 (the specific device-visible symptom that Test-3 originally caught) has strong automated evidence but no recorded on-device confirmation since the fix landed — per the scope note, this is routed as a human-verification item rather than an automated pass/fail. This is the sole reason for `human_needed` status; there are no `gaps_found` items to close via a further plan.

---

*Verified: 2026-07-24T11:00:00Z*
*Verifier: Claude (gsd-verifier)*
