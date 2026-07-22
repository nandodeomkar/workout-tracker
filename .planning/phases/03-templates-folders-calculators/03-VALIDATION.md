---
phase: 3
slug: templates-folders-calculators
status: verified
nyquist_compliant: true
wave_0_complete: true
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
| **Estimated runtime** | ~2s for the 8 phase-03 files (pure-fn + in-memory better-sqlite3 DB-layer tests) |

---

## Sampling Rate

- **After every task commit:** Run the specific new/changed `.test.ts` file (quick run command)
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green, then a device UAT pass mirroring `01-UAT.md` / `02-UAT.md` for inline calculator affordances + folder/template UI (`human_verify_mode: end-of-phase`)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| UTIL-01 | Plate solver: exact-match, nearest-achievable + delta, below-bar, fp-drift edge cases | unit (pure fn) | `npx vitest run lib/plateSolver.test.ts` | ✅ | ✅ green |
| UTIL-03 | Warm-up ladder %/reps + plate-rounding integration (reuses plate solver) | unit (pure fn) | `npx vitest run lib/warmupLadder.test.ts` | ✅ | ✅ green |
| UTIL-02 | 1RM estimate (Epley) | unit (pure fn, existing) | `npx vitest run lib/estimate1RM.test.ts` | ✅ | ✅ green |
| UTIL-02 | %-of-1RM table lookup | unit (pure fn) | `npx vitest run lib/percentOf1RM.test.ts` | ✅ | ✅ green |
| TMPL-02 | Start-from-template pre-fill merge (structure + last-performance + target fallback) | unit (pure fn) | `npx vitest run lib/templatePrefill.test.ts` | ✅ | ✅ green |
| TMPL-03 | Save-as-template capture (working-set count, typical reps, null weight, excludes warmups) | unit (pure fn) | `npx vitest run lib/templateCapture.test.ts` | ✅ | ✅ green |
| TMPL-01 | Templates CRUD + delete detaches `workouts.template_id` (no dangling FK) | DB-layer (better-sqlite3) | `npx vitest run db/templates.crud.test.ts` | ✅ | ✅ green |
| TMPL-01 / TMPL-02 | Folder grouping / Uncategorized ordering + start-from-template copies `template_exercises` in order | DB-layer (better-sqlite3) | `npx vitest run db/templates.query.test.ts` | ✅ | ✅ green |
| T-03-G3 (gap-close) | Un-log deletes exactly the targeted set, siblings intact | DB-layer (better-sqlite3) | `npx vitest run db/workouts.crud.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Audit result (2026-07-22):** all 8 mapped phase-03 test files run green — 48 tests passing (~2s). Gap-closure un-log path (`deleteSet`) additionally covered by `db/workouts.crud.test.ts` ("deletes exactly the targeted set and leaves siblings intact").

---

## Wave 0 Requirements

- [x] `lib/plateSolver.test.ts` — UTIL-01
- [x] `lib/warmupLadder.test.ts` — UTIL-03
- [x] `lib/percentOf1RM.test.ts` — UTIL-02
- [x] `lib/templatePrefill.test.ts` — TMPL-02
- [x] `lib/templateCapture.test.ts` — TMPL-03
- [x] `db/templates.crud.test.ts` — TMPL-01
- [x] `db/templates.query.test.ts` — TMPL-01 / TMPL-02

*No new fixture/framework work needed — `db/test/fixture.ts` and `vitest.config.ts` already cover the new `db/templates.ts` module without changes.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tools tab layout — free calculators, no paywall/ad/upsell surface | UI-01 | RN screen layout; no automated RN render test in this project (vitest logic-only). Non-disclosure confirmed in security audit T-03-12. | On device: open Tools tab; verify plate + 1RM calculators are freely reachable with no locked/premium prompts |
| Folder section headers (collapsible) + Uncategorized bucket on Workout home; tap template → starts workout | TMPL-01 | RN list/section + navigation UI; no automated RN render test in this project (vitest logic-only) | On device: create templates in ≥2 folders + one uncategorized; verify collapsible headers group correctly; tap a template → active workout opens with `workouts.template_id` set |
| Start-from-template pre-fills exercises + last-performance values, falls back to target | TMPL-02 | End-to-end device flow across screens | Start a workout from a template with prior history and one never-done exercise; verify history pre-fills known exercises, target fills the new one |
| Save finished workout as template | TMPL-03 | Device flow from finish/summary screen | Finish a workout with warm-ups + working sets; Save as template; verify captured structure excludes warm-ups, weight is null |
| Inline plate-calculator sheet (per-side breakdown, editable weight, nearest-achievable) | UTIL-01 | RN bottom-sheet + gesture UI | On device: open plate affordance from a set row; verify per-side plates for the current weight; edit to a non-loadable value → shows nearest + delta |
| Inline 1RM calculator (prefilled from set) + standalone | UTIL-02 | RN UI + navigation | Open 1RM inline from an exercise (prefilled), and from the standalone Tools entry; verify estimate + %-of-1RM table |
| Warm-up suggestions auto-insert as `sets.type='warmup'`, one-tap accept, adjustable/deletable | UTIL-03 | RN UI + set-row interaction | On device: trigger warm-up suggestion for a working weight; one-tap accept inserts warmup rows (excluded from volume/PR); adjust + delete one |

*All manual-only behaviors were exercised in the phase-03 device UAT pass (`03-UAT.md`) — gap-closure re-verification: 3 passed, 0 issues.*

---

## Validation Audit 2026-07-22

| Metric | Count |
|--------|-------|
| Requirements audited | 7 (UTIL-01/02/03, TMPL-01/02/03, UI-01) |
| Automatable — COVERED (green) | 6 |
| Manual-only (RN UI, non-automatable) | 1 (UI-01) |
| Gaps found | 0 |
| Tests generated this run | 0 (all pre-existing, all green) |

**Method:** State A audit. Cross-referenced each mapped requirement to its test file; ran all 8 phase-03 vitest files — 48/48 passing. UI-01 (Tools tab layout) is genuinely non-automatable in a logic-only vitest project → recorded manual-only, already exercised in device UAT. No MISSING/PARTIAL automatable gaps → no auditor spawn required.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`watch: false` enforced)
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** verified 2026-07-22
