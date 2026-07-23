---
phase: 06-programs-progression
fixed_at: 2026-07-24T00:00:00Z
review_path: .planning/phases/06-programs-progression/06-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-07-24
**Source review:** .planning/phases/06-programs-progression/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (CR-01, WR-01, WR-02)
- Fixed: 3
- Skipped: 0

All three fixes are behavioural/data-integrity changes. Syntax and full-project
type-checking passed (0 TypeScript errors in the edited files and 0 project-wide),
but Tier 1/2 verification does not prove semantic correctness — each is flagged
below as **requires human verification**, and the review calls for new regression
tests that were NOT added by this fixer (see "Follow-up" per finding).

## Fixed Issues

### CR-01: Linear progression computes next weight from 0 — never from the weight actually lifted

**Files modified:** `db/programs.ts`
**Commit:** bbe8d28
**Status:** fixed — requires human verification (progression logic)

**Applied fix:** In `applyProgressionAndAdvance`, the linear resolver no longer
anchors on `templateExercise.targetWeightKg ?? 0`. It now derives the working
weight from the lightest non-warmup ("working") set actually logged this session,
falling back to the stored target only when there are no working sets:

```ts
const workingSets = setsForEval.filter((s) => s.type !== 'warmup');
const loggedWeightKg =
  workingSets.length > 0
    ? Math.min(...workingSets.map((s) => s.weightKg))
    : (templateExercise.targetWeightKg ?? 0);
const success = evaluateLinearSuccess(setsForEval, templateExercise.targetWeightKg ?? loggedWeightKg);
const result = resolveLinearProgression(loggedWeightKg, linearRule, success, templateExercise.consecutiveFails);
```

This matches the reviewer's suggested fix verbatim. Success is evaluated against
the stored target when present (subsequent finishes) and against the logged anchor
otherwise (first finish, where `target_weight_kg` is null for both bundled and
custom programs), so on the first finish success rides on reps and the next target
becomes `loggedWeight + increment` (e.g. 100 kg × 5 → 102.5 kg) instead of 2.5 kg.

**Follow-up (not done):** The review requests a regression test that starts a
bundled/custom linear program with `target_weight_kg = null`, logs 100 kg × 5,
finishes, and asserts the stored next target is 102.5, not 2.5. This fixer did not
add tests — please add before closing the phase.

### WR-02: Deleting a template leaves dangling `program_days`, silently desyncing the program pointer and cycle-wrap math

**Files modified:** `db/programs.ts`, `db/templates.ts`
**Commit:** dcd83a5
**Status:** fixed — requires human verification (data-integrity + caller impact)

**Applied fix (two parts, per the review):**

1. `db/templates.ts#deleteTemplate` now refuses to hard-delete a template that is
   still referenced by `program_days`. Before touching anything it queries
   `program_days` for the templateId and throws a clear error
   (`"Cannot delete template: it is used by a program. Remove it from the program
   first."`) if any reference exists. Added `programDays` to the schema import.
   No UI currently calls `deleteTemplate` (only tests do), so the throw cannot
   crash a screen today; a future caller must handle/guard it.

2. `db/programs.ts#applyProgressionAndAdvance` now bases the cycle-wrap boundary on
   the TRUE `program_days` row count for the program (a fresh count query), not the
   post-filter `detail.days.length` (which silently shrinks when a day's template
   fails to load). The returned `totalDays` uses the same count. This is
   defense-in-depth now that part (1) prevents the dangling row in the first place.

**Follow-up (not done):** No test was added for the refuse-on-referenced-template
path or the wrap-count behaviour. Existing `deleteTemplate` tests operate on
program-free templates and are unaffected.

### WR-01: `applyProgressionAndAdvance` is not idempotent — a summary remount double-advances the pointer and re-bumps training maxes

**Files modified:** `db/programs.ts`
**Commit:** a0fffe8
**Status:** fixed — requires human verification (idempotency semantics + origin-marker tradeoff)

**Applied fix:** Inside the existing progression transaction, the workout's
program-origin marker is now cleared:

```ts
tx.update(workouts).set({ programId: null, programDayPosition: null }).where(eq(workouts.id, workoutId)).run();
```

A re-entry of `applyProgressionAndAdvance` for the same workout (StrictMode
double-invoke, fast-refresh, or re-navigation to the summary screen) then hits the
existing top guard (`workout.programId == null → EMPTY_PROGRESS_RESULT`) and is a
no-op — so the pointer cannot advance twice and `%TM` training maxes cannot be
re-bumped. This is the reviewer's "cheapest option: clear the origin marker inside
the same transaction." The first-render summary banner is unaffected because
`summary.tsx` reads its program detail from a `detail` snapshot loaded BEFORE this
call (line ~147 checks `detail.workout.programId`, and the follow-up
`loadProgramDetail(db, detail.workout.programId)` uses that same pre-clear snapshot).

**Tradeoff (deliberate, needs sign-off):** The reviewer noted a stored
`progression_applied_at` flag is *preferable* to clearing `program_id`, because
history/reporting may later want the workout's program origin. Adding that column
requires a new Drizzle migration (schema + generated SQL + snapshot + journal),
which cannot be produced reliably here without running `drizzle-kit generate` — a
hand-authored migration risks breaking `useMigrations` at app startup, which is
worse than the bug. The clear-marker approach was chosen as the lower-risk,
verifiable fix. There is no current reader of a finished workout's `program_id`
(only `summary.tsx`, which uses the pre-clear snapshot), so no functionality
regresses today. If program-origin history is wanted, revisit with a proper
migration + `progression_applied_at` flag.

---

_Fixed: 2026-07-24_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
