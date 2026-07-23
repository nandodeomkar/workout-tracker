---
phase: 6
slug: programs-progression
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-23
validated: 2026-07-23
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 06-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 `[VERIFIED: package.json]` |
| **Config file** | `vitest.config.ts` (environment: node, include `**/*.test.ts`) — already present |
| **Quick run command** | `npx vitest run lib/progression.test.ts` (single-file; unaffected by the Windows paging issue below) |
| **Full suite command** | `npx vitest run --no-file-parallelism` — **required on this Windows dev machine**; a plain `npx vitest run` intermittently crashes with `Error: The paging file is too small for this operation to complete` from better-sqlite3's native binding under the default multi-worker pool `[VERIFIED: project memory — vitest-windows-paging-crash]` |
| **Estimated runtime** | single-file quick run ~2–5s; full suite ~45–60s (61 files / 464 tests green as of Plan 05-02) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run lib/progression.test.ts` (and/or `npx vitest run db/programs.crud.test.ts` once that task's file exists) — fast, single-file, safe on Windows.
- **After every plan wave:** Run `npx vitest run --no-file-parallelism` (full suite — required flag on this machine per project memory).
- **Before `/gsd-verify-work`:** Full suite must be green, plus the phase-end device UAT pass (add a bundled linear program → complete a day → confirm weight bumped; miss 3× → confirm deload; add the %TM program → set TMs → complete a full 16-day wave → confirm TM bump on wrap).
- **Max feedback latency:** ~60 seconds (full suite, serial).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Test File | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-----------|--------|
| 06-01-01 | 01 | 1 | PROG-02, PROG-03 | T-06-01 / T-06-05 | Float-drift guard; %TM delegates to solvePlates (RED tests assert both) | unit (pure) | `npx vitest run lib/progression.test.ts` | `lib/progression.test.ts` ← created by 06-01-01 | ⬜ pending |
| 06-01-02 | 01 | 1 | PROG-02, PROG-03 | T-06-01 / T-06-05 | Total functions over finite numbers; weights rounded to 0.5; plate-loadable %TM | unit (pure) | `npx vitest run lib/progression.test.ts` | `lib/progression.test.ts` (06-01-01) | ⬜ pending |
| 06-02-01 | 02 | 2 | PROG-02 (origin marker + fail counter cols) | T-06-02 / T-06-03 | Migration 0004 columns exist at runtime (not just in types) | unit (migration) | `npx vitest run db/schema.test.ts db/migrations.test.ts` | ✅ existing (`db/schema.test.ts`, `db/migrations.test.ts`) | ⬜ pending |
| 06-02-02 | 02 | 2 | PROG-01, PROG-04 | T-06-03 / T-06-04 / T-06-06 | ASVS V5 guards on all numeric writes; parameterized queries only; origin marker separates program vs ad-hoc | unit (DB, in-memory) | `npx vitest run db/programs.crud.test.ts db/templates.crud.test.ts` | `db/programs.crud.test.ts` ← created by 06-02-02 | ⬜ pending |
| 06-02-03 | 02 | 2 | PROG-04 | T-06-05 | Every bundle seed_id resolves to a real exercises.id before insert (Pitfall 6) | unit (DB, fixture) | `npx vitest run db/programs.crud.test.ts -t "seed mapping"` | `db/programs.crud.test.ts` (06-02-02) | ⬜ pending |
| 06-03-01 | 03 | 3 | PROG-01, PROG-04 | — | N/A (navigation/manager UI) | manual + type | `npx tsc --noEmit` + device UAT | N/A (UI screens) | ⬜ pending |
| 06-03-02 | 03 | 3 | PROG-01 | — | N/A (program detail UI) | manual + type | `npx tsc --noEmit` + device UAT | N/A (UI screens) | ⬜ pending |
| 06-03-03 | 03 | 3 | PROG-01 | — | N/A ("Next in program" home card) | manual + type | `npx tsc --noEmit` + device UAT | N/A (UI screens) | ⬜ pending |
| 06-04-01 | 04 | 4 | PROG-02 | T-06-01 / T-06-02 | Progression written in place on user-owned copy; pointer advances via `(pos+1) % dayCount`; ad-hoc workout has zero side effects | unit (DB) | `npx vitest run db/programs.crud.test.ts` | `db/programs.crud.test.ts` (06-02-02) | ⬜ pending |
| 06-04-02 | 04 | 4 | PROG-02 | — | N/A (finish-summary Program-progress section) | manual + type | `npx tsc --noEmit` + device UAT | N/A (UI screen) | ⬜ pending |
| 06-05-01 | 05 | 5 | PROG-03 | T-06-03 | assertValidTrainingMaxKg on every TM write regardless of source (manual / manual-1RM / best-logged-e1RM) | manual + type | `npx tsc --noEmit` + device UAT | N/A (UI screen) | ⬜ pending |
| 06-05-02 | 05 | 5 | PROG-03 | T-06-03 / T-06-05 / T-06-03b | Plate-loadable %TM prefill; TM bump gated strictly on cycle wrap, once per exercise | unit (DB) | `npx vitest run db/programs.crud.test.ts` | `db/programs.crud.test.ts` (06-02-02) | ⬜ pending |
| 06-05-03 | 05 | 5 | PROG-03 | — | N/A (cycle-complete banner) | manual + type | `npx tsc --noEmit` + device UAT | N/A (UI screen) | ⬜ pending |
| 06-06-01 | 06 | 6 | PROG-01 | — | N/A (per-exercise progression authoring in builder) | manual + type | `npx tsc --noEmit` + device UAT | N/A (UI) | ⬜ pending |
| 06-06-02 | 06 | 6 | PROG-01 | — | N/A (custom program builder screen) | manual + type | `npx tsc --noEmit` + device UAT | N/A (UI screen) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → Test coverage roll-up

| Req | Behaviour | Test file | Owning plan/task(s) |
|-----|-----------|-----------|---------------------|
| PROG-01 | materialize + program_state at 0; tap-any-day pointer; wrap | `db/programs.crud.test.ts` + `lib/progression.test.ts` (nextDayPosition) | 06-02-02, 06-04-01, 06-01-01/06-01-02 |
| PROG-02 | evaluateLinearSuccess / resolveLinearProgression (increment/hold/deload); apply-in-place + advance; origin-marker guard | `lib/progression.test.ts`, `db/programs.crud.test.ts` | 06-01-01/06-01-02, 06-04-01, 06-02-02 |
| PROG-03 | computeTrainingMaxFromOneRepMax; computePercentTmWeight (plate-loadable); bumpTrainingMax; %TM prefill + wrap-timed bump | `lib/progression.test.ts`, `db/programs.crud.test.ts` | 06-01-01/06-01-02, 06-05-02 |
| PROG-04 | bundle seed_ids resolve; clone independence; 16 program_days | `db/programs.crud.test.ts` | 06-02-02, 06-02-03 |

---

## Wave 0 Requirements

Existing vitest infrastructure covers all phase requirements — the framework, `vitest.config.ts`, and the in-memory better-sqlite3 fixture (`db/test/fixture.ts`, journal-driven) already exist from prior phases, so there is **no separate framework-install / scaffolding wave**. New phase test files are authored RED-first by their owning TDD tasks:

- [x] `lib/progression.test.ts` — authored RED by **06-01-01** (dedicated TDD plan) before the 06-01-02 implementation. Covers PROG-02/PROG-03 pure math.
- [x] `db/programs.crud.test.ts` — authored alongside implementation by **06-02-02** (`tdd="true"`), then extended by **06-02-03** (seed mapping), **06-04-01** (linear apply/advance), and **06-05-02** (%TM prefill + wrap bump). Covers PROG-01/PROG-04 + origin-marker guard.
- [x] `db/schema.test.ts` / `db/migrations.test.ts` — already exist; the journal-driven fixture auto-applies migration 0004 (**06-02-01**) with no fixture-code change.
- [x] `db/templates.crud.test.ts` — already exists; re-run by **06-02-02** to prove the added `progression` field does not regress the templates layer.

`wave_0_complete: true` — no missing test scaffolding; every logic requirement lands with an automated `<automated>` verify created no later than its owning task.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Programs manager / detail / "Next in program" card render and navigate | PROG-01, PROG-04 | RN screen rendering + navigation (no vitest RN component coverage per stack contract) | Settings/More → Programs → add a bundled program → open detail → tap a day → confirm Next badge + start |
| Finish-summary Program-progress section | PROG-02 | Rendered finish screen state | Finish a linear program-origin day → confirm the progress section lists each exercise's bump/hold/deload |
| TM-setup sheet: manual entry / "Enter a 1RM" / "Use my best logged 1RM" | PROG-03 (D-10) | Device UI + reads live logged history for best-e1RM source | Add Percent-Based Wave → TM-setup opens → Compute from 1RM offers both sources (best-logged hidden when no history) → each fills a TM → edit → Save |
| Plate-loadable %TM prescribed weights at day start | PROG-03 (D-13) | Visible on the active-workout screen | Start a %TM day after setting TMs → confirm each set's pre-filled weight is plate-loadable |
| Cycle-complete banner + TM bump | PROG-03 (D-12) | Rendered celebratory banner on wrap | Complete the full 16-day wave → confirm "🎉 Cycle complete" banner lists each TM bump; mid-wave day shows no banner |
| Per-exercise progression authoring + custom program builder | PROG-01 (D-17) | RN form UI | Template builder → set None/Linear/%TM per exercise → save → build a custom program from ordered template days |
| Migration 0004 applies on a real device cold-start | PROG-02 | On-device SQLite migration | Cold-start the app once → confirm no migration error and the app loads |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every task runs at least `npx tsc --noEmit`; logic tasks run vitest)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (progression + programs.crud test files authored RED-first by owning TDD tasks; framework pre-exists)
- [x] No watch-mode flags (all commands use `vitest run`)
- [x] Feedback latency < 60s (full suite serial; quick run ~2–5s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-23
