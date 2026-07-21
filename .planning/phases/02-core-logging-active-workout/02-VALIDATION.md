---
phase: 02
slug: core-logging-active-workout
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-21
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (already configured) |
| **Config file** | `vitest.config.ts` — Node env, `**/*.test.ts`, no watch by default |
| **Quick run command** | `npx vitest run <single new/changed test file>` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~a few seconds (pure-logic + better-sqlite3 in-memory DB layer) |

DB-layer tests reuse the existing `db/test/fixture.ts` (better-sqlite3 in-memory) — no device/emulator needed. Pure logic (`lib/`) has zero RN imports per CLAUDE.md testing split.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <the single new/changed test file>`
- **After every plan wave:** Run `npx vitest run` (full suite) + `tsc` clean
- **Before `/gsd-verify-work`:** Full suite green + `tsc` clean, PLUS the manual device screen-off rest-timer pass (mirrors Phase 1 device re-UAT precedent)
- **Max feedback latency:** ~10 seconds (single-file run)

---

## Per-Task Verification Map

Task IDs are assigned by the planner (`{padded}-{plan}-{task}`); this map is keyed by requirement until plans exist. Every row below MUST land on at least one task's `<automated>` verify (or a Manual-Only row).

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| LOG-01 | Set logging ≤2 taps, pre-fills from last performance | unit + DB-layer | `npx vitest run db/workouts.query.test.ts -t "loadLastPerformance"` | ❌ W0 |
| LOG-02 | In-progress workout resumable after "crash" (fresh DB connection) | DB-layer | `npx vitest run db/workouts.query.test.ts -t "findResumableWorkout"` | ❌ W0 |
| LOG-03 | Rest notification schedule/cancel/reschedule logic (mocked expo-notifications) | unit | `npx vitest run lib/restTimer.test.ts` | ❌ W0 |
| LOG-03 (device) | Notification fires reliably with screen off / phone locked | manual-only | N/A — physical device, screen off | manual |
| LOG-04 | Add/reorder/replace/remove exercise mutates `workout_exercises` correctly | DB-layer | `npx vitest run db/workouts.crud.test.ts` | ❌ W0 |
| LOG-05 | Discard cascade-deletes; finish computes duration/volume/PRs | DB-layer + unit | `npx vitest run db/workouts.crud.test.ts lib/volume.test.ts lib/prDetection.test.ts` | ❌ W0 |
| LOG-06 | kg↔lb conversion round-trips with plate-loadable rounding | unit (pure) | `npx vitest run lib/weightUnits.test.ts` | ❌ W0 |
| HIST-01 | History list + month-range query returns correct workouts | DB-layer | `npx vitest run db/workouts.query.test.ts -t "history"` | ❌ W0 |
| HIST-02 | Editing a past workout updates existing rows, not duplicate inserts | DB-layer | `npx vitest run db/workouts.crud.test.ts -t "edit"` | ❌ W0 |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `db/workouts.ts` — new data layer (mirrors `db/exercises.ts`)
- [ ] `db/workouts.query.test.ts` — `findResumableWorkout`, `loadLastPerformance`, history list/range queries
- [ ] `db/workouts.crud.test.ts` — set insert/update, exercise add/reorder/replace/remove, discard cascade, finish
- [ ] `lib/estimate1RM.ts` + `.test.ts` (Epley `weight*(1+reps/30)`, shared with Phase 4)
- [ ] `lib/weightUnits.ts` + `.test.ts` (kg↔lb + display rounding)
- [ ] `lib/volume.ts` + `.test.ts` (Σ weight×reps over non-warmup sets)
- [ ] `lib/prDetection.ts` + `.test.ts` (heaviest weight + best est-1RM vs prior history)
- [ ] `lib/restTimer.ts` + `.test.ts` (mock `expo-notifications` — scheduling logic, no device)
- [ ] `store/activeWorkout.ts` — Zustand store (plain, non-persisted; rehydrated from SQLite)
- [ ] `drizzle/000X_*.sql` — additive migration for `exercises.restSeconds`; extend `db/migrations.test.ts` upgrade harness

*Existing `vitest.config.ts` + `db/test/fixture.ts` cover the test mechanism as-is — the gap is new files only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rest-timer notification + vibration fires reliably | LOG-03 | Doze mode / screen-off delivery is not reproducible in emulator or unit tests (CLAUDE.md gotcha) | On a physical Android 12+ device: start a workout, complete a set to auto-start the rest timer, lock the screen, wait for the interval — confirm the notification + vibration fire on time |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-22 (plan-checker pass, 7 plans — Nyquist dims 8a–8d verified)
