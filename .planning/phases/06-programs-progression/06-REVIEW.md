---
phase: 06-programs-progression
reviewed: 2026-07-24T05:14:42Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - db/programs.ts
  - db/schema.ts
  - db/programs.crud.test.ts
  - db/migrations.test.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-07-24T05:14:42Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Gaps-only re-review of the Phase-06 Test-3 blocker fix (PROG-02): the new
`program_exercise_progress` table (`db/schema.ts` + migration `0005`), the
per-lift shared linear progression in `db/programs.ts`
(`prefillLinearSets`, `getProgramExerciseProgress`, and the linear branch of
`applyProgressionAndAdvance`), plus the CRUD/migration tests.

The cross-day sharing guarantee is implemented correctly: linear reads/writes
are keyed on `(program_id, exercise_id)` via a composite-PK upsert, so a Squat
bump on Day A carries to Day B (verified by the `HEADLINE` and
`CROSS-DAY WRITE SHARING` tests). CR-01 anchoring on the logged weight is
preserved for the success/hold happy paths, `deleteProgram` cleans up the new
table, and the migration is additive-only.

However, the **write path lacks the defensive skip that the read path has**:
when no valid working-weight anchor exists, `applyProgressionAndAdvance` pushes
a `0` working weight into the transaction where `assertValidWorkingWeightKg`
throws, aborting the entire finish and leaving the program pointer stuck. This
is the notable regression relative to the `%TM` path, which skips gracefully.
There is also a behavioral quirk where a hold/deload can move the shared
working weight in the wrong direction when the logged weight differs from the
prescription.

## Structural Findings (fallow)

No structural pre-pass (`<structural_findings>`) was provided for this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Linear finish with no positive anchor throws inside the transaction and permanently wedges the program pointer

**File:** `db/programs.ts:1026-1040` (write path) vs. `db/programs.ts:656-660` (read-path guard it fails to mirror); throw at `db/programs.ts:1123`

**Issue:**
On a `linear` finish the branch computes an anchor and unconditionally queues a
write:

```ts
const loggedWeightKg =
  workingSets.length > 0
    ? Math.min(...workingSets.map((s) => s.weightKg))
    : (prior?.workingWeightKg ?? templateExercise.targetWeightKg ?? 0);
// ...
const result = resolveLinearProgression(loggedWeightKg, linearRule, success, priorFails);
linearWrites.push({ exerciseId: ..., workingWeightKg: result.nextWeightKg, ... });
```

Consider the reachable first-run case: no `program_exercise_progress` row yet
(`prior` undefined), `targetWeightKg == null` (the default for **every**
bundled and custom program per the CR-01 comment), and the user finishes the
day **without any working (non-warmup) set** — an empty workout, a warmup-only
day, or a bodyweight lift logged at `0` kg. Then:

- `workingSets` is empty → `loggedWeightKg = 0`
- `evaluateLinearSuccess([], 0)` returns `false` (no working sets, `lib/progression.ts:114`)
- `resolveLinearProgression(0, rule, false, 0)` holds → `nextWeightKg = 0`
- `linearWrites.push({ workingWeightKg: 0 })`

Inside `db.transaction`, `assertValidWorkingWeightKg(0)` throws
`"Working weight must be a positive number"` (`db/programs.ts:151-159`,
called at line `1123`). The throw rolls back the **whole** transaction: the
pointer never advances, `workouts.program_id` is never cleared, and the
exception propagates to the caller. Because `program_id` stays set, the WR-01
idempotency guard never engages — re-entering `applyProgressionAndAdvance` for
the same workout deterministically re-throws, so the workout can never be
finished through this path and the program is stuck. In a mixed program this
also suppresses the `%TM` training-max bumps that would otherwise fire on the
same finish.

The `%TM` prefill and the linear **prefill** (`db/programs.ts:658`) both
already handle "no valid anchor" by skipping gracefully; only the linear
**write** path pushes the bad value and lets the write-time guard throw. No
test covers a program-linked linear finish with zero working sets, so this is
untested.

**Fix:** mirror the read-path guard — skip queuing the write and its outcome
when the anchor is not a positive finite number, rather than pushing `0` and
throwing at write time:

```ts
if (!Number.isFinite(loggedWeightKg) || loggedWeightKg <= 0) {
  continue; // No valid anchor (first run, no working sets) — skip, never a 0-weight write.
}
const result = resolveLinearProgression(loggedWeightKg, linearRule, success, priorFails);
```

## Warnings

### WR-01: Hold/deload anchors on the logged weight, so a miss can move the shared working weight in the wrong direction

**File:** `db/programs.ts:1026-1034`

**Issue:**
Success is evaluated against `successTarget` (the prior per-lift working
weight), but the next weight is always resolved from `loggedWeightKg` (the
lightest logged working set), regardless of outcome:

```ts
const successTarget = prior?.workingWeightKg ?? templateExercise.targetWeightKg ?? loggedWeightKg;
const success = evaluateLinearSuccess(setsForEval, successTarget);
// ...
const result = resolveLinearProgression(loggedWeightKg, linearRule, success, priorFails);
```

When the user logs a weight different from the prescription, this decouples the
"hold" from the weight they were supposed to be at:

- **Miss at a heavier weight raises the working weight.** Prior working weight
  `102.5`; user edits all sets to `110` and misses reps (`110x3`, target `5`).
  `success` is `false`, but `loggedWeightKg = 110`, so the hold writes
  `workingWeightKg = 110` — the shared per-lift weight is bumped **up to a
  weight the user just failed**, and Day B will now prescribe `110`.
- **Miss at a lighter weight lowers the working weight.** Prior `102.5`; user
  logs `100` and misses. Hold writes `100`, silently ratcheting the shared
  weight down below the established working weight.

This is a consequence of the deliberate "anchor on the lightest working set"
design (CR-01 comment), which is correct for the *first* finish (no prior). But
once a prior working weight exists, StrongLifts-style linear progression should
*hold at the prescribed working weight* on a miss, not adopt whatever was
logged. Practical exposure is limited because the prefill now defaults sets to
the prescribed weight, but any manual edit before a missed day triggers it.

**Fix:** on a non-success outcome, anchor on the prior working weight when one
exists; only fall back to the logged weight on the first finish:

```ts
const holdAnchorKg = success
  ? loggedWeightKg
  : (prior?.workingWeightKg ?? templateExercise.targetWeightKg ?? loggedWeightKg);
const result = resolveLinearProgression(holdAnchorKg, linearRule, success, priorFails);
```

### WR-02: Upper-bound write guards throw inside the finish transaction instead of skipping the offending exercise

**File:** `db/programs.ts:1119-1144`

**Issue:**
Same failure mode as CR-01 but for the upper bounds: if an accumulated working
weight exceeds `MAX_WEIGHT_KG` (1000) or a bumped TM exceeds it,
`assertValidWorkingWeightKg` / `assertValidTrainingMaxKg` throw *inside*
`db.transaction`, rolling back the entire finish (pointer advance + every
write) rather than skipping the one offending exercise. `MAX_INCREMENT_KG`
(100) already bounds a single jump, so 1000 kg is not reachable in normal
training — hence WARNING, not BLOCKER — but the "validate-inside-transaction so
one bad value aborts everything" pattern is the same latent hazard as CR-01 and
should be resolved consistently.

**Fix:** perform the range validation while building `linearWrites` /
`bumpedTrainingMaxes` (before entering the transaction) and skip any entry that
fails validation, so a single out-of-range value never aborts the whole finish.

## Info

### IN-01: Migration test asserts columns exist but not the composite PK or the nullable `working_weight_kg`

**File:** `db/migrations.test.ts:225-233`

**Issue:**
The `PROG-02: migration 0004 -> 0005` test verifies the four column *names*
exist via `PRAGMA table_info`, but does not assert the two properties the
gap-closure design specifically depends on: the composite primary key
`(program_id, exercise_id)` (the mechanism that enforces one shared row per
lift and backs the `onConflictDoUpdate`) and the nullability of
`working_weight_kg` (the "unset until first anchor" contract). A regression that
dropped the composite PK or made the column `NOT NULL` would still pass this
test.

**Fix:** extend the assertions — check the `pk` ordinals from
`PRAGMA table_info(program_exercise_progress)` for `program_id`/`exercise_id`,
and assert `working_weight_kg` has `notnull === 0` while `consecutive_fails`
has `notnull === 1`.

---

_Reviewed: 2026-07-24T05:14:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
