---
phase: 4
slug: stats-charts
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-22
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Content transcribed from `04-RESEARCH.md` §"Validation Architecture". Source of
> truth for the STAT-04 performance strategy and the manual/on-device gap.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (pure-logic + in-memory `better-sqlite3` integration; per CLAUDE.md "Vitest for pure-logic only" — no RN component rendering) |
| **DB test driver** | `drizzle-orm/better-sqlite3` in-memory via existing `db/test/fixture.ts#createTestDb` (same `sqlite-core` schema as device `expo-sqlite`) |
| **Config file** | `vitest.config.ts` (Node environment, matches `**/*.test.ts`, no watch) |
| **Quick run command** | `npx vitest run lib/chartSeries.test.ts lib/records.test.ts` (or the single file the touched task owns) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 s full suite (estimate; dominated by the STAT-04 ~15,600-row synthetic-history seed + three timed paths). Quick per-file run < 2 s. |

Both `vitest@4.1.10` and `better-sqlite3` are already present in `devDependencies` from prior phases — no test-framework install is required this phase.

---

## Sampling Rate

- **After every task commit:** Run the quick run scoped to the file(s) touched (e.g. `npx vitest run lib/chartSeries.test.ts`).
- **After every plan wave:** Run `npx vitest run` (full suite).
- **Before `/gsd-verify-work`:** Full suite must be green, **plus** one on-device manual pass confirming charts render and stay responsive on the physical test device (Node/JS timing does not guarantee on-device Skia GPU frame timing — see Manual-Only Verifications).
- **Max feedback latency:** ~10 s (full suite estimate).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | STAT-01, STAT-02 | T-04-SC | `[SUS]` skia package verified on npmjs.com before install; exact `@2.9.0` pin, never same-day `2.9.1` | checkpoint (human-verify) | MISSING — blocking-human legitimacy gate (verify `npmjs.com/package/@shopify/react-native-skia`) | N/A (setup) | ⬜ pending |
| 04-01-02 | 01 | 1 | STAT-01, STAT-02 | — | Exact-pinned `npm install` (41.26.0 / 2.9.0); never `expo install --fix` (would regress gesture-handler) | cli-check | `npm ls victory-native @shopify/react-native-skia` shows 41.26.0 / 2.9.0 | N/A (setup) | ⬜ pending |
| 04-01-03 | 01 | 1 | STAT-01, STAT-02 | — | N/A | checkpoint (human-verify) | MISSING — native Skia link only observable on-device (no RNSkia-not-found crash) | N/A (setup) | ⬜ pending |
| 04-02-01 | 02 | 2 | STAT-01 | — | N/A (pure reduction, no I/O) | unit | `npx vitest run lib/chartSeries.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | STAT-01 | T-04-02 | Parameterized Drizzle read, exercise-scoped + non-warmup filter; no string-concatenated SQL | integration (in-memory SQLite) | `npx vitest run db/stats.query.test.ts` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | STAT-01 | — | N/A | manual (device) | MISSING — Skia chart render + metric toggle + range chips (device only) | N/A | ⬜ pending |
| 04-03-01 | 03 | 3 | STAT-02 | — | N/A (pure bucketing/tonnage) | unit | `npx vitest run lib/weeklyVolume.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | STAT-02 | T-04-02 | Parameterized week-window read (`gte`/`lt` on JS-computed ISO bounds); no raw SQL | integration (in-memory SQLite) | `npx vitest run db/stats.query.test.ts` | ❌ W0 | ⬜ pending |
| 04-03-03 | 03 | 3 | STAT-02 | — | N/A | manual (device) | MISSING — Skia stacked-bar render + scroll (device only) | N/A | ⬜ pending |
| 04-04-01 | 04 | 4 | STAT-03 | — | Records computed live from sets, never stored (D-11); re-scan reflects a new heavier set with no cache to invalidate | unit + integration | `npx vitest run lib/records.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-02 | 04 | 4 | STAT-03 | T-04-02 | Parameterized all-history read (ordered by `started_at`); no string-concatenated SQL | integration (in-memory SQLite) | `npx vitest run db/stats.query.test.ts` | ❌ W0 | ⬜ pending |
| 04-04-03 | 04 | 4 | STAT-03 | — | Feed recomputed on every screen focus, never from a stored value (D-11) | manual (device) | MISSING — PR-feed screen render / `useFocusEffect` recompute (device only) | N/A | ⬜ pending |
| 04-05-01 | 05 | 5 | STAT-03 | — | Record board computed live from logged sets (D-11), curated rep-max `[1,3,5,8,10,12]` display | unit + manual (device) | `npx vitest run lib/records.test.ts` (board logic) + on-device render | ❌ W0 (records.test.ts) | ⬜ pending |
| 04-06-01 | 06 | 5 | STAT-04 | T-04-08 | Deterministic (seeded PRNG) ~15,600-set fixture; batched/transactional inserts, no unbounded per-row awaits | performance (in-memory SQLite) | `npx vitest run db/stats.performance.test.ts` | ❌ W0 | ⬜ pending |
| 04-06-02 | 06 | 5 | STAT-04 | T-04-08 | `<500ms` all-history PR-scan assertion doubles as a regression guard against an accidental N+1 / unbounded scan | performance (in-memory SQLite, timed) | `npx vitest run db/stats.performance.test.ts` | ❌ W0 | ⬜ pending |
| 04-06-03 | 06 | 5 | STAT-04 | — | Skia GPU frame time — explicitly not automatable in Node/vitest (documented gap) | manual (device) | MISSING — on-device chart responsiveness against a large dataset (see Manual-Only Verifications) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists: `❌ W0` = net-new test file created test-first (RED) inside its owning plan's `tdd="true"` task — see Wave 0 Requirements.*

---

## Wave 0 Requirements

This phase uses **test-first TDD within each plan** (the code-producing tasks are marked `tdd="true"`), so there is no separate Wave-0 execution stage — each net-new test file below is authored as the RED step of its owning plan's first task, then driven to GREEN in the same plan. No test-framework install is needed (`vitest@4.1.10` + `better-sqlite3` already in `devDependencies`; `db/test/fixture.ts#createTestDb` already exists).

Net-new test/fixture files that must be created (each currently MISSING → `❌ W0`):

- [ ] `lib/chartSeries.test.ts` — STAT-01 pure one-point-per-workout reduction (Plan 04-02, Task 1)
- [ ] `db/stats.query.test.ts` — STAT-01/02/03 query-layer integration over in-memory SQLite (created in Plan 04-02, appended in 04-03 / 04-04)
- [ ] `lib/weeklyVolume.test.ts` — STAT-02 Mon-Sun bucketing + per-muscle-group tonnage (Plan 04-03, Task 1)
- [ ] `lib/records.test.ts` — STAT-03 live all-history rep-max + e1RM scan (Plan 04-04, Task 1; extended for the curated board in Plan 04-05)
- [ ] `db/test/syntheticHistory.ts` — STAT-04 deterministic ~5-year / ~15,600-set seed generator (Plan 04-06, Task 1)
- [ ] `db/stats.performance.test.ts` — STAT-04 timed assertions over the three query paths (Plan 04-06, Task 2)

*Existing infrastructure (`vitest.config.ts`, `db/test/fixture.ts`) covers everything else; no framework install required.*

---

## Manual-Only Verifications

Chart **rendering** (Skia GPU frame time) and screen-level behavior are not automatable in this project's Node-only vitest strategy (CLAUDE.md "What NOT to Use" — do not force RN component rendering into vitest). These are verified on the physical device per `device-run-setup.md`.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-exercise line chart renders; Est.1RM/Top Set/Volume toggle swaps feel immediate; 3M/1Y/All chips re-filter without a freeze | STAT-01 | Skia GPU render + gesture response not measurable in Node | On-device: open a heavily-logged exercise's chart (both entry points — Stats picker + library "View progress"), toggle all three metrics, tap each range chip (Plan 04-02, Task 3) |
| Weekly-volume stacked bar renders and scrolls smoothly across weeks; "Other" reads as muted/last | STAT-02 | Skia GPU render not measurable in Node | On-device: open Stats tab, scroll the weekly-volume section across the ~12-week window (Plan 04-03, Task 3) |
| PR feed and per-exercise record board render live on focus; "See all" opens full history | STAT-03 | Screen render + `useFocusEffect` recompute not automatable in vitest | On-device: open Stats tab (feed populates), tap a PR row → record board, tap "See all" (Plans 04-04 Task 3, 04-05 Task 1) |
| Charts stay responsive against years of history (GPU frame time, not DB query time) | STAT-04 | Skia GPU frame time ≠ Node query timing; the automated `<500ms` test only proves the data-layer half | On-device: load a large history, open the per-exercise chart and weekly-volume chart, confirm no multi-second stalls or broken-feeling jank during scroll/interaction (Plan 04-06, Task 3) |
| Empty states (0 / 1 data points) and kg→display-unit conversion on axis + record labels (D-16) | STAT-01/02/03 (UI-hint) | Presentation-only screen render | On-device: verify empty-state copy for a fresh exercise and that axis/record values honor the kg/lb display-unit setting |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — every code-producing task maps to a `vitest` command; manual/checkpoint tasks (chart render, native install/boot) carry a documented `MISSING` rationale and a `<human-check>`
- [x] Sampling continuity: no 3 consecutive **code-producing** tasks without automated verify — Plan 01 (native install + dev-client rebuild) is the only all-checkpoint/CLI plan and produces no testable JS; every `lib/`/`db/` task has an automated `vitest` run
- [x] Wave 0 covers all MISSING references — all six net-new test/fixture files are listed under Wave 0 Requirements and owned by a plan's test-first `tdd="true"` task
- [x] No watch-mode flags — all commands use `vitest run` (single-shot), never `vitest` watch
- [x] Feedback latency < ~10 s (full suite estimate) — quick per-file runs < 2 s
- [x] `nyquist_compliant: true` set in frontmatter

*`wave_0_complete` remains `false`: the test scaffolds do not yet exist on disk — they are created test-first (RED) inside each owning plan during execution, not in a separate pre-wave. Flip to `true` once every file in Wave 0 Requirements exists.*

**Approval:** approved 2026-07-22
