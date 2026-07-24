---
phase: 06
slug: programs-progression
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-24
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Scope:** Pure progression math (linear + percent-of-training-max resolvers), `db/programs.ts` data layer (program CRUD, bundle materialization, start-from-day, training maxes, finish-time progression apply), the `program_exercise_progress` per-lift storage model (gap-closure plans 07/08), bundled program JSON, template-builder progression authoring, custom program builder, and the Programs UI surface (manager, detail, TM-setup sheet, home card, finish-screen progress/banner).
**Register origin:** authored at plan time (all 8 PLAN.md files carried a `<threat_model>` block; plans 06-01..06-06 use the `T-06-*` numbering, plans 06-07/06-08 gap-closure use `T-07-*`/`T-08-*`). Two threat IDs (`T-06-05`, `T-06-07`) were reused across plans for different threats and are disambiguated below as `a`/`b` per the audit brief. Auditor ran in verify-mitigations mode — no retroactive STRIDE scan.
**Calibration note:** app is offline-only, single-device, no server, no auth. "Tampering" here means corrupt/absurd local data poisoning the progression math or wedging the program pointer — not a remote attacker.

---

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| stored `template_exercises.progression` JSON → resolver input | Free-text column parsed and fed into `lib/progression.ts`'s pure resolvers at finish-time and day-start |
| bundled JSON (app asset) → DB rows | Static bundle definitions crossing into user-owned DB rows during materialization |
| numeric inputs (increment_kg, training max, working weight, day position, consecutive_fails) → SQLite writes | Untrusted numeric values reaching parameterized writes |
| screen user actions → db/programs.ts writes | Taps triggering materialize/start/delete/set-active cross into DB writes |
| route params (programId, dayPosition, exerciseId) → queries | Route params reaching parameterized reads, always sourced from a loaded list, never free-typed |
| best logged e1RM (records path) → TM prefill → training_maxes write | A value computed from stored history feeding the TM field and, on save, the DB write |
| stored TM + scheme pct → prescribed weights | Training max and percentages driving computed set weights |
| cycle-wrap detection → TM bump write | Wrap flag gating a persistent TM increase |
| stored `program_exercise_progress.working_weight_kg` → prescribed set weight | A tampered/corrupt per-lift working weight would be prescribed straight into a workout set (no plate-solving at this stage) |
| generated migration SQL → on-device SQLite | A malformed/destructive migration would run against real user data on app upgrade |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-06-01 | Tampering | progression JSON parse → resolvers | mitigate | `parseValidLinearRule` (`db/programs.ts:894-900`) / `parseValidPercentTmSets` (`db/programs.ts:908-927`) validate discriminant + numeric ranges before any resolver call; `JSON.parse` wrapped in try/catch at every read site — `applyProgressionAndAdvance` (`db/programs.ts:987-1002,1065-1069`), `prefillPercentTmSets` (`:558-570`), `prefillLinearSets` (`:642-654`), `loadAllPrograms` (`:302-310`), `listProgramTrainingMaxes` (`:806-814`); resolvers round every weight to nearest 0.5kg (`lib/progression.ts:101-104,127-157`), total functions, no NaN propagation; authoring writes only the two locked shapes (`components/TemplateBuilderForm.tsx` `serializeProgression` ~L137-160, `hydrateProgression` L95-128 falls back to None on malformed JSON) | closed |
| T-06-02 | Tampering / DoS | program_days.position, current_day_position, pct/scheme | mitigate | `assertValidDayPosition` (`db/programs.ts:181-189`) on every write (`addProgramDay:220`, `setActiveProgram:371`, `startWorkoutFromProgramDay:702`); pointer advance always via `nextDayPosition = (pos+1) % dayCount` (`lib/progression.ts:199-205`, called at `db/programs.ts:1093`), never a stored index trusted blindly; `dayPosition` sourced from the rendered program_days list — `app/programs/[programId].tsx:268` (`dayDetail.day.position`), `app/(tabs)/index.tsx:351` (`activeProgram.currentDay.day.position`), never free-typed; percent_tm scheme validated (`parseValidPercentTmSets`) before `computePercentTmWeight`/`computePrescribedWeightKg`, malformed rules skipped (`db/programs.ts:567-570`) | closed |
| T-06-03 | Tampering | increment_kg, training_maxes.max_kg, consecutive_fails writes | mitigate | `assertValidIncrementKg` (`db/programs.ts:122-130`), `assertValidTrainingMaxKg` (`:136-144`), `assertValidConsecutiveFails` (`:165-173`) reject NaN/negative/non-finite/absurd before every insert/update; applied regardless of source — `setTrainingMax` (`:763-774`) validates every write whether the caller is direct-entry, manual-1RM, or best-logged-e1RM; `app/programs/training-maxes.tsx` hides the "Use my best logged 1RM" option entirely when `bestE1RMKg == null` (L136-138, L238-248) rather than ever computing from a null/0 e1RM; `canSave` (L164) blocks any row with `tmKg <= 0` from being saved; builder steppers bounded — increment `Math.max(0, …)` (`components/TemplateBuilderForm.tsx:362`), pct `Math.min(1, Math.max(0.3, …))` (`:392`), reps `Math.max(1, …)` (`:408`) | closed |
| T-06-03b | Tampering / correctness | TM bump cadence | mitigate | Bump block gated strictly on `if (wrapped)` (`db/programs.ts:1100-1128`), never per lift-week; test `db/programs.crud.test.ts:876` "does not bump the training max on a non-wrapping finish (day 0 of 2)" | closed |
| T-06-04 | Tampering | all db/programs.ts queries | mitigate | Full-file review confirms only Drizzle parameterized query-builder helpers (`eq`/`and`/`inArray`) are used; `grep -n "sql\`\|sql("` over `db/programs.ts` and `db/templates.ts` returns zero matches — no string-concatenated SQL anywhere | closed |
| T-06-05a | Tampering | %TM weight rounding | mitigate | `computePercentTmWeight` delegates to `solvePlates` (`lib/progression.ts:176-178`), never raw TM×pct; `db/programs.ts#computePrescribedWeightKg` (`:496-509`) wraps it for unit conversion but still routes through `solvePlates`-backed rounding | closed |
| T-06-05b | Tampering | missing/renamed bundle seed_id | mitigate | `materializeBundledProgram` resolves every bundle exercise seed_id up front across all days (`db/programs.ts:445-457`) and throws a clear, named error before any write; test `db/programs.crud.test.ts:187` "throws a clear error naming the missing seed_id and inserts nothing" | closed |
| T-06-06 | Tampering | shared bundle JSON mutation | mitigate | `BundledProgramDefinition` typed distinctly from Program/Template rows (`db/programs.ts:403-425`); `materializeBundledProgram` only ever inserts fresh rows, never writes back to `bundle` (`:445-483`); `app/programs/index.tsx#doMaterialize` (`:102-126`) reads from the static `BUNDLED_PROGRAMS` import without mutation; clone-independence test `db/programs.crud.test.ts:197` proves two adds are non-shared | closed |
| T-06-07a | Information disclosure / crash | starting a non-active program's day | mitigate | `app/programs/[programId].tsx#handleStartDay` (`:162-175`) and `app/programs/index.tsx#handleAddAndStart` (`:131-144`) both route through the non-destructive "Switch active program?" `Alert` whenever a DIFFERENT program is currently active, before calling `startWorkoutFromProgramDay`/`materializeBundledProgram` | closed |
| T-06-07b | DoS (crash) / correctness | finish-flow running on non-program workouts | mitigate | `applyProgressionAndAdvance` guards `workout.programId == null \|\| workout.programDayPosition == null` as the FIRST check (`db/programs.ts:945-948`), returning `EMPTY_PROGRESS_RESULT` before any further program-table query; caller `app/active-workout/summary.tsx:147-148` only invokes it when `detail.workout.programId != null`; test `db/programs.crud.test.ts:593` "an ad-hoc workout (program_id null) returns an empty result with no writes" | closed |
| T-06-08 | Tampering | warmup sets skewing success eval | mitigate | `evaluateLinearSuccess` filters `s.type !== 'warmup'` (`lib/progression.ts:112-116`); test `lib/progression.test.ts:58` "a warmup set with low reps does NOT fail an otherwise-successful day (Pitfall 2, mixed fixture)" | closed |
| T-07-01 | Tampering | drizzle/0005_*.sql schema migration | mitigate | `drizzle/0005_mushy_gressill.sql:1-9` contains exactly one `CREATE TABLE program_exercise_progress` (composite PK, two FK clauses) — zero `ALTER`/`DROP`/`UPDATE` statements | closed |
| T-07-02 | Denial of Service | app-upgrade migration path | mitigate | `db/migrations.test.ts:169-236` ("PROG-02: migration 0004 -> 0005 …") seeds programs/program_days via raw SQL, applies the idx-5 journal entry, and asserts both tables are byte-identical before/after plus the new table's 4 columns exist | closed |
| T-08-01 | Tampering | applyProgressionAndAdvance upsert into program_exercise_progress | mitigate | `assertValidWorkingWeightKg` (`db/programs.ts:151-159`, mirrors `assertValidTrainingMaxKg`) + `assertValidConsecutiveFails` both called immediately before every upsert in the finish transaction (`:1136-1137`); `parseValidLinearRule` rejects a bad increment before any resolver math (`:999-1002`) | closed |
| T-08-02 | Tampering | prefillLinearSets read of stored working_weight_kg | mitigate | `prefillLinearSets` skips prescription when `workingWeightKg == null \|\| !Number.isFinite(...) \|\| <= 0` (`db/programs.ts:656-660`) — same defensive fallback `prefillPercentTmSets` uses for a missing training max; test `db/programs.crud.test.ts:706` "FIRST RUN: a fresh program with no prior finish inserts zero linear sets" | closed |
| T-SC | Supply chain | package installs across all 8 plans | accept | `git log --oneline -- package.json` shows the last change (`0177cc8`) predates the first Phase-06 commit (`d7e80e2`, plan 06-01); no phase-06 commit touches package.json | closed |
| T-08-03 | Denial of Service | malformed progression JSON on a program day | accept | Verified the underlying claim: `parseValidLinearRule` (`db/programs.ts:894-900`) + try/catch `JSON.parse` guards are present at both the day-start read path (`prefillLinearSets:642-654`) and the finish-time write path (`applyProgressionAndAdvance:987-1002`) — a single bad rule is skipped at both sites, never aborting the whole finish or day-start | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Threat Flags (SUMMARY.md)

All 8 SUMMARY.md files (06-01 through 06-08) were checked for a `## Threat Flags` section — none present in any file. No unregistered new attack surface was flagged by any executor during implementation.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-SC | No package installs across any of the 8 phase-06 plans; `npx drizzle-kit generate` (plan 06-07) runs an already-installed devDependency (`drizzle-kit@0.31.10`) — verified via `git log -- package.json` showing the last touching commit predates all phase-06 commits | gsd-security-auditor | 2026-07-24 |
| AR-06-02 | T-08-03 | Malformed progression JSON on a program day is already defended by the T-06-01/T-08-01 parse-validate-skip guards present at both `prefillLinearSets` (day-start) and `applyProgressionAndAdvance` (finish-time) — confirmed present in code, not merely asserted by the plan | gsd-security-auditor | 2026-07-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-24 | 17 | 17 | 0 | gsd-security-auditor (sonnet) |

**Audit method:** verify-mitigations mode (register authored at plan time across 06-01..06-08 PLAN.md `<threat_model>` blocks). Each `mitigate` threat verified present in the currently-shipped implementation (not superseded intermediate states — e.g. T-08-01/T-08-02 verify the final Plan-08 per-lift `program_exercise_progress` model, which superseded Plan-04's per-row `template_exercises` write path) with file:line evidence. Each `accept` threat's rationale independently re-verified against the implementation/git history, not merely accepted on the plan's word. All 8 SUMMARY.md files checked for `## Threat Flags` — none present.

### Non-Blocking Observations

1. **`template_exercises.target_weight_kg`/`consecutive_fails` are now vestigial for linear progression.** Plan 06-08 moved the single source of truth for linear working weight + fail streak to the per-lift `program_exercise_progress` table (composite key `program_id`+`exercise_id`), superseding Plan 06-04's original per-row write path. The two `template_exercises` columns remain in the schema (still used as `percent_tm`'s null seed and a template-authoring initial value per `db/programs.ts` L33) but are dead for linear reads/writes. Not a security gap — the register's threats (T-08-01/T-08-02) were written against and verified against this final state — but worth a schema-cleanup note for a future phase.
2. **`db/schema.ts` FK columns are not enforced at the SQLite layer** (project-wide convention, confirmed in `db/migrations.test.ts:178-180`'s own comment: "this project does not enforce FK constraints at write time"). `program_exercise_progress`'s FKs to `programs`/`exercises` are therefore advisory. This is consistent with every other table in the schema and outside this phase's threat register (no threat ID claims FK enforcement) — noted for completeness, not a gap.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-24
