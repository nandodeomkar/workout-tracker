---
phase: 1
slug: scaffold-data-foundation
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 (pure logic + DB layer via `drizzle-orm/better-sqlite3`); no jest-expo in Phase 1 (no component/screen tests per CLAUDE.md's testing split) |
| **Config file** | none in repo yet — `vitest.config.ts` is created in Plan 01 Task 1 (Node env, no watch-mode default) |
| **Quick run command** | `npx vitest run <file>` (e.g. `npx vitest run db/schema.test.ts`) |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10–15 seconds (in-memory `better-sqlite3`; no device/emulator required) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run` (fast — in-memory SQLite, no device needed)
- **After every plan wave:** Run `npx vitest run` (full suite) + one manual device smoke pass (app boots, seed populates, one exercise created/archived)
- **Before `/gsd-verify-work`:** Full suite green + FNDN-02's simulated-upgrade test (populate DB after migration 0001, apply 0002, assert data intact) must pass
- **Max feedback latency:** < 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FNDN-01 | T-1-SC | Exact pinned versions, no `@rc/@next/@latest`; SUS `expo-drizzle-studio-plugin` NOT installed | config/build | `npx tsc --noEmit && npx expo-doctor` | N/A (build/config check) | ⬜ pending |
| 1-01-02 | 01 | 1 | FNDN-02 (D-15) | — | Driver-agnostic schema; migration 0001 materializes all 13 tables against a fresh DB | integration | `npx drizzle-kit generate && npx vitest run db/schema.test.ts` | `db/schema.test.ts` ❌ W0 (created RED-first in-task) | ⬜ pending |
| 1-01-03 | 01 | 1 | FNDN-01 | T-1-01 / T-1-02 | Migration gate hard-stops on error (no partial-migrated render); parameterized seed inserts only | integration | `npx tsc --noEmit && npx vitest run` | ✅ (reuses `db/schema.test.ts` + `db/test/fixture.ts`) | ⬜ pending |
| 1-02-01 | 02 | 2 | EXER-01 | T-1-06 | No null/empty taxonomy escapes to seed JSON; explicit reviewable mapping tables + logged `"Other"` fallback | unit | `npx vitest run scripts/curate-exercises.test.ts` | `scripts/curate-exercises.test.ts` ❌ W0 (created RED-first in-task) | ⬜ pending |
| 1-02-02 | 02 | 2 | EXER-01 | T-1-02 | Parameterized inserts; idempotent, no-clobber seed (`onConflictDoNothing` on `seedId`) | integration | `npx vitest run db/seed/runSeed.test.ts` | `db/seed/runSeed.test.ts` ❌ W0 (created RED-first in-task) | ⬜ pending |
| 1-03-01 | 03 | 2 | FNDN-02 | T-1-03 | Populate at 0001 → apply 0002 → assert every row intact (zero data loss) | integration | `npx vitest run db/migrations.test.ts` | `db/migrations.test.ts` ❌ W0 (created RED-first in-task) | ⬜ pending |
| 1-03-02 | 03 | 2 | FNDN-02 | T-1-03 | Additive `CREATE INDEX` only; no destructive table rebuild of 0001 | integration | `npx drizzle-kit generate && npx vitest run db/migrations.test.ts` | ✅ (reuses `db/migrations.test.ts`) | ⬜ pending |
| 1-04-01 | 04 | 3 | EXER-01 | T-1-04 | In-memory filter (no per-keystroke SQL); parameterized `.where(eq(...))` read | unit + integration | `npx vitest run db/exercises.query.test.ts` | `db/exercises.query.test.ts` ❌ W0 (created RED-first in-task) | ⬜ pending |
| 1-04-02 | 04 | 3 | EXER-01 | — | Theme-tokenized components (no inline color/spacing literals) | type-check | `npx tsc --noEmit` | N/A (component; behavior covered by full-suite tsc) | ⬜ pending |
| 1-04-03 | 04 | 3 | EXER-01 | T-1-04 | Search string filtered in memory, never interpolated into SQL | type-check + suite | `npx tsc --noEmit && npx vitest run` | ✅ (reuses `db/exercises.query.test.ts`) | ⬜ pending |
| 1-05-01 | 05 | 4 | EXER-02 | T-1-05 / T-1-09 | Parameterized create/update; name-required + max length (ASVS V5); archive-not-delete, no hard delete | integration | `npx vitest run db/exercises.crud.test.ts` | `db/exercises.crud.test.ts` ❌ W0 (created RED-first in-task) | ⬜ pending |
| 1-05-02 | 05 | 4 | EXER-02 | T-1-05 | Duplicate name warn-but-allow (non-blocking); parameterized insert | type-check | `npx tsc --noEmit` | N/A (component) | ⬜ pending |
| 1-05-03 | 05 | 4 | EXER-02 | T-1-09 | Reversible `setArchived` only — no hard-delete control shipped | type-check + suite | `npx tsc --noEmit && npx vitest run` | ✅ (reuses `db/exercises.crud.test.ts`) | ⬜ pending |
| 1-06-01 | 06 | 5 | FNDN-01 | T-1-10 / T-1-01 | Offline (airplane-mode) boot; local SQLite is sole source of truth; migration gate observed on hardware | manual-only | manual device check — airplane mode + cold launch (see Manual-Only Verifications) | N/A (device-only) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*File Exists legend: ✅ = test artifact already on disk / reused · ❌ W0 = missing, created RED-first inside its TDD task (each code task carries its own scaffold; see Wave 0 Requirements for the shared cross-plan dependencies).*

---

## Wave 0 Requirements

The only test infrastructure that must exist **before any downstream plan can be verified** (created in Plan 01, Wave 1, then depended on by Plans 02–05):

- [ ] `vitest.config.ts` — framework config; none exists yet (greenfield repo) — created in Plan 01 Task 1
- [ ] `db/test/fixture.ts` — shared in-memory helper (`createTestDb()` opens a `:memory:` better-sqlite3 DB, applies generated migrations, returns a Drizzle instance; `applyMigrationsUpTo(n)` for the FNDN-02 upgrade test) — created in Plan 01 Task 2; consumed by every DB-layer test below

Per-requirement test files (each created RED-first inside its own TDD task, not a separate Wave 0 step):

- [ ] `db/schema.test.ts` — schema materialization / D-15 (Plan 01 Task 2): all 13 tables present in `sqlite_master` after migration 0001
- [ ] `db/migrations.test.ts` — FNDN-02 (Plan 03 Task 1): populate after 0001, apply 0002, assert rows survive + indexes present
- [ ] `db/exercises.query.test.ts` — EXER-01 (Plan 04 Task 1): substring search, muscle/equipment filter, OR-within / AND-across per D-06/D-07
- [ ] `db/exercises.crud.test.ts` — EXER-02 (Plan 05 Task 1): create, edit-in-place of seeded rows (D-10), archive/unarchive (D-11), duplicate-name allow (D-12)
- [ ] `scripts/curate-exercises.test.ts` — EXER-01 curation (Plan 02 Task 1, recommended): taxonomy-mapping fallback logic, so a bad mapping rule is caught before the seed JSON is committed
- [ ] `db/seed/runSeed.test.ts` — EXER-01 seed idempotency (Plan 02 Task 2): full populate + version set, idempotent re-run, no-clobber of an edited row

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| App boots and runs fully offline with local SQLite as the sole source of truth (no network calls anywhere) | FNDN-01 | "No network calls" and true cold-boot behavior are device/integration-level assertions that cannot be exercised by the in-memory unit suite; expo-sqlite requires a dev client (not Expo Go), so this is a real-hardware check | Covered by **Plan 01-06** (blocking `checkpoint:human-verify`): build the dev client (`npx expo run:android`), put the device in AIRPLANE MODE, cold-launch, and confirm the full `migrate → seed → browse → search/filter → create → edit → archive` loop works offline and persists across a force-kill (8-step script in 01-06) |

FNDN-01 is the **sole** manual-only verification in Phase 1. FNDN-02, EXER-01, and EXER-02 are all fully automated in the vitest suite above.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the only non-automated task, 1-06-01, is the FNDN-01 device checkpoint that is manual-only by nature)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (component-only tasks 1-04-02 / 1-05-02 still gate on `npx tsc --noEmit`)
- [x] Wave 0 covers all MISSING references (`vitest.config.ts` + `db/test/fixture.ts` in Plan 01; each requirement test file created RED-first in its TDD task)
- [x] No watch-mode flags (every command uses `npx vitest run`, never `vitest` watch)
- [x] Feedback latency < 60s (in-memory better-sqlite3 suite runs in ~10–15s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-19
