---
phase: 05
slug: body-measurements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-23
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (pure logic + DB layer via better-sqlite3 in-memory) |
| **Config file** | vitest.config.ts (existing from prior phases) |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| {N}-01-01 | 01 | 1 | REQ-{XX} | T-{N}-01 / — | {expected secure behavior or "N/A"} | unit | `{command}` | ✅ / ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*(Filled per-plan by gsd-planner / gsd-executor during Wave 0.)*

---

## Wave 0 Requirements

- [ ] `lib/lengthUnits.test.ts` — cm↔in conversion (MEAS-01)
- [ ] `lib/measurementSeries.test.ts` — date-only series build, same-date latest-wins (MEAS-02)
- [ ] `db/measurements.test.ts` — CRUD + history queries against better-sqlite3 in-memory (MEAS-01/02)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Trend graph renders on device (victory-native XL / Skia) | MEAS-02 | Skia charts require a device/emulator; not renderable in vitest | Log ≥2 readings for a metric, open its detail screen, confirm line + range chips |
| Quick weigh-in + add-measurements entry flows | MEAS-01 | UI interaction on device | Log today's weight via quick path; log a dated multi-metric session; confirm both appear |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
