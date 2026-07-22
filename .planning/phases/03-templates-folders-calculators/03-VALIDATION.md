---
phase: 3
slug: templates-folders-calculators
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (environment: node) |
| **Config file** | `vitest.config.ts` (already exists — include `**/*.test.ts`, `watch: false`) |
| **Quick run command** | `npx vitest run <path/to/file>.test.ts` (the specific file under test) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5–15 seconds (pure-fn + in-memory better-sqlite3 DB-layer tests) |

---

## Sampling Rate

- **After every task commit:** Run the specific new/changed `.test.ts` file (quick run command)
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green, then a device UAT pass mirroring `01-UAT.md` / `02-UAT.md` for inline calculator affordances + folder/template UI (`human_verify_mode: end-of-phase`)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

Task IDs are assigned by the planner; rows below are keyed by requirement + planned module and will be bound to concrete task IDs during planning/execution.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| UTIL-01 | Plate solver: exact-match, nearest-achievable + delta, below-bar, fp-drift edge cases | unit (pure fn) | `npx vitest run lib/plateSolver.test.ts` | ❌ W0 | ⬜ pending |
| UTIL-03 | Warm-up ladder %/reps + plate-rounding integration (reuses plate solver) | unit (pure fn) | `npx vitest run lib/warmupLadder.test.ts` | ❌ W0 | ⬜ pending |
| UTIL-02 | 1RM estimate (Epley) | unit (pure fn, existing) | `npx vitest run lib/estimate1RM.test.ts` | ✅ existing | ⬜ pending |
| UTIL-02 | %-of-1RM table lookup | unit (pure fn) | `npx vitest run lib/percentOf1RM.test.ts` | ❌ W0 | ⬜ pending |
| TMPL-02 | Start-from-template pre-fill merge (structure + last-performance + target fallback) | unit (pure fn) | `npx vitest run lib/templatePrefill.test.ts` | ❌ W0 | ⬜ pending |
| TMPL-03 | Save-as-template capture (working-set count, typical reps, null weight, excludes warmups) | unit (pure fn) | `npx vitest run lib/templateCapture.test.ts` | ❌ W0 | ⬜ pending |
| TMPL-01 | Templates CRUD + delete detaches `workouts.template_id` (no dangling FK) | DB-layer (better-sqlite3) | `npx vitest run db/templates.crud.test.ts` | ❌ W0 | ⬜ pending |
| TMPL-01 / TMPL-02 | Folder grouping / Uncategorized ordering + start-from-template copies `template_exercises` in order | DB-layer (better-sqlite3) | `npx vitest run db/templates.query.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/plateSolver.test.ts` — stubs for UTIL-01
- [ ] `lib/warmupLadder.test.ts` — stubs for UTIL-03
- [ ] `lib/percentOf1RM.test.ts` — stubs for UTIL-02
- [ ] `lib/templatePrefill.test.ts` — stubs for TMPL-02
- [ ] `lib/templateCapture.test.ts` — stubs for TMPL-03
- [ ] `db/templates.crud.test.ts` — stubs for TMPL-01
- [ ] `db/templates.query.test.ts` — stubs for TMPL-01 / TMPL-02

*No new fixture/framework work needed — `db/test/fixture.ts` and `vitest.config.ts` already cover the new `db/templates.ts` module without changes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Folder section headers (collapsible) + Uncategorized bucket on Workout home; tap template → starts workout | TMPL-01 | RN list/section + navigation UI; no automated RN render test in this project (vitest logic-only) | On device: create templates in ≥2 folders + one uncategorized; verify collapsible headers group correctly; tap a template → active workout opens with `workouts.template_id` set |
| Start-from-template pre-fills exercises + last-performance values, falls back to target | TMPL-02 | End-to-end device flow across screens | Start a workout from a template with prior history and one never-done exercise; verify history pre-fills known exercises, target fills the new one |
| Save finished workout as template | TMPL-03 | Device flow from finish/summary screen | Finish a workout with warm-ups + working sets; Save as template; verify captured structure excludes warm-ups, weight is null |
| Inline plate-calculator sheet (per-side breakdown, editable weight, nearest-achievable) | UTIL-01 | RN bottom-sheet + gesture UI | On device: open plate affordance from a set row; verify per-side plates for the current weight; edit to a non-loadable value → shows nearest + delta |
| Inline 1RM calculator (prefilled from set) + standalone | UTIL-02 | RN UI + navigation | Open 1RM inline from an exercise (prefilled), and from the standalone Tools entry; verify estimate + %-of-1RM table |
| Warm-up suggestions auto-insert as `sets.type='warmup'`, one-tap accept, adjustable/deletable | UTIL-03 | RN UI + set-row interaction | On device: trigger warm-up suggestion for a working weight; one-tap accept inserts warmup rows (excluded from volume/PR); adjust + delete one |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`watch: false` enforced)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
