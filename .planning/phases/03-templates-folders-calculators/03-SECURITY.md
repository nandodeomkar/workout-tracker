---
phase: 03
slug: templates-folders-calculators
status: verified
threats_open: 0
asvs_level: 1
created: 2026-07-22
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Scope:** Templates CRUD, folder grouping, start-from-template, save-as-template capture, template pre-fill merge, plate/1RM/warm-up calculators, bar-weight setting, un-log (delete single set) path.
**Register origin:** authored at plan time (all 8 PLAN.md files carried a `<threat_model>` block). Auditor ran in verify-mitigations mode — no retroactive STRIDE scan.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| keypad/text input → pure calculator | Untrusted numeric weights/reps reach solvePlates / buildWarmupSets / percentOf1RM / estimate1RM | Numeric weight/reps (offline, single-user; no network/auth) |
| DB read → pure aggregation | Already-persisted set rows flow into the pre-fill merge / template capture | Persisted set rows |
| screen input → db/templates.ts write | Untrusted template name/folder text + target sets/reps/weight reach a SQLite write | Template name/folder strings, numeric targets |
| template delete → workout history | Deleting a template must not orphan referencing workouts | `workouts.template_id` FK (data-integrity) |
| settings input → settings write | Untrusted bar-weight numeric input reaches a `settings` write | `bar_weight_kg` / `bar_weight_lb` numeric |
| warm-up accept → sets write | An accepted warm-up weight reaches `insertSet` | Plate-solved weight → SQLite write |
| save-as-template → templates write | Captured working-set counts/reps reach db/templates.ts writes | Bounded non-negative counts/reps |
| Active-workout UI → db/workouts.ts delete | Un-log checkmark crosses into a destructive `deleteSet` | `setId` internal integer PK |
| Workout-home UI → expo-router navigation | Start-from-template navigation carries `templateId` | `templateId` internal integer PK, `String(template.id)` |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01 | Tampering (bad input) | solvePlates | mitigate | Below-bar early return `lib/plateSolver.ts:38-41`; caller clamps `Number.isFinite && >=0` `components/PlateCalculatorSheet.tsx:48-50` | closed |
| T-03-02 | DoS (loop) | solvePlates greedy loop | mitigate | fp-drift guard `while (remaining >= plate - 1e-9)` + `Math.round(x*100)/100` `lib/plateSolver.ts:51-54`; odd-remainder test `lib/plateSolver.test.ts:65-72` | closed |
| T-03-03 | Tampering | percentOf1RM / buildWarmupSets | accept | Pure read-only math; zero DB/RN imports `lib/percentOf1RM.ts`, `lib/warmupLadder.ts` | closed |
| T-03-04 | Tampering (data integrity) | buildTemplateExercisesFromWorkout | mitigate | Warm-up exclusion `s.type !== 'warmup'` `lib/templateCapture.ts:47`; test `lib/templateCapture.test.ts:24-36` | closed |
| T-03-05 | Tampering | buildTemplatePrefillRows | accept | Pure merge; row count bounded by targetSets (cap enforced `db/templates.ts:93-101`) | closed |
| T-03-06 | Tampering | createTemplate/updateTemplate name+folder | mitigate | `assertValidName` trim + cap 200 `db/templates.ts:42-54,140,144,166,173`; test `db/templates.crud.test.ts:38-60` | closed |
| T-03-07 | Tampering | addTemplateExercise/setTemplateExercises targets | mitigate | `assertValidTargetSets/Reps/WeightKg` `db/templates.ts:62-101,196-198,231-233`; test `db/templates.crud.test.ts:128-142` | closed |
| T-03-08 | Tampering (SQL injection) | every template query | mitigate | Drizzle parameterized builder only (`eq`/`and`/`asc`/`isNotNull`), no raw SQL — full-file review `db/templates.ts` | closed |
| T-03-09 | Tampering (data integrity) | deleteTemplate | mitigate | Detach `template_id`→null before delete, one transaction `db/templates.ts:251-266`; dangling-FK test `db/templates.crud.test.ts:206-225` | closed |
| T-03-10 | Tampering | bar-weight setting write | mitigate | Clamp `min(500, max(0, ..))` before `setSetting`, kg/lb independent `app/(tabs)/settings.tsx:26,86-96` | closed |
| T-03-11 | Tampering (bad input) | calculator sheets | mitigate | Clamp non-negative before solvePlates/estimate1RM `components/PlateCalculatorSheet.tsx:48-50`, `components/OneRMCalculatorSheet.tsx:49-53` | closed |
| T-03-12 | Info disclosure / upsell | Tools UI | accept | No ad SDK / paywall / tracking code `app/tools/*.tsx` | closed |
| T-03-13 | Tampering | builder name/folder/target inputs | mitigate | Raw values routed through db/templates.ts guards `components/TemplateBuilderForm.tsx:229-262` | closed |
| T-03-14 | Tampering (data integrity) | start-from-template | mitigate | Tested `startWorkoutFromTemplate`, no ad-hoc UI copy `db/templates.ts:361-372`, `app/(tabs)/index.tsx:286` | closed |
| T-03-15 | DoS (UI) | folder grouping render | accept | Bucketing in tested query layer `db/templates.ts:311-336`; screen only renders `app/(tabs)/index.tsx:351-384` | closed |
| T-03-16 | Tampering | warm-up accept insertSet | mitigate | Reuses `insertSet` (`assertValidWeightKg/Reps`) `db/workouts.ts:178-180`; `displayToKg` convert `app/active-workout/[workoutId].tsx:623-651` | closed |
| T-03-17 | Tampering | save-as-template writes | mitigate | createTemplate + addTemplateExercise guards; `targetWeightKg: null` by construction `app/active-workout/summary.tsx:153-186`, `lib/templateCapture.ts` (register cited `[workoutId].tsx` — stale, see note 1) | closed |
| T-03-18 | Tampering (data integrity) | template pre-fill merge | mitigate | History filtered non-warmup before merge `app/active-workout/[workoutId].tsx:276-278`; output length == targetSets `lib/templatePrefill.ts:46`; tests `lib/templatePrefill.test.ts:36-50` | closed |
| T-03-19 | DoS | inline calculator inputs | accept | Clamp non-negative + bounded plate-set loop (same evidence as T-03-11 + T-03-02) | closed |
| T-03-G1-01 | Tampering | router.push params (templateId) | accept | Internal integer `String(template.id)` from loaded list, no user free-text `app/(tabs)/index.tsx:371-377` | closed |
| T-03-G1-SC | Tampering (supply chain) | npm/pip/cargo installs (plan 03-07) | accept | `git log -- package.json` — last change (`8cad033`) predates all Phase 03 commits | closed |
| T-03-G3-01 | Tampering | deleteSet(db, setId) | mitigate | Parameterized `db.delete(sets).where(eq(sets.id, setId))` `db/workouts.ts:235-237` | closed |
| T-03-G3-02 | Denial (data loss) | un-log path deletes a set | mitigate | Deletes exactly one row by id, siblings untouched `app/active-workout/[workoutId].tsx:522-552`; full-card delete gated behind confirm `:815-825`; test `db/workouts.crud.test.ts:322-335` | closed |
| T-03-G3-SC | Tampering (supply chain) | npm/pip/cargo installs (plan 03-08) | accept | Same `git log -- package.json` evidence — no Phase 03 commit touches package.json | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-03 | percentOf1RM / buildWarmupSets are pure read-only math over caller-supplied numbers; no persistence or injection surface | gsd-security-auditor | 2026-07-22 |
| AR-03-02 | T-03-05 | buildTemplatePrefillRows is a pure read-only merge; row count bounded by targetSets, validated at write time (cap 1000) | gsd-security-auditor | 2026-07-22 |
| AR-03-03 | T-03-12 | Tools UI has no paywall/ad/tracking surface; single-user offline app — nothing to disclose | gsd-security-auditor | 2026-07-22 |
| AR-03-04 | T-03-15 | Folder-grouping bucketing runs in the tested query layer; screen only renders, bounded by single-user template count | gsd-security-auditor | 2026-07-22 |
| AR-03-05 | T-03-19 | Inline calculator inputs clamp non-negative; loop bounded by fixed plate-set array — no unbounded work | gsd-security-auditor | 2026-07-22 |
| AR-03-06 | T-03-G1-01 | router.push templateId is an internal integer from loaded DB rows (`String(template.id)`); no user free-text reaches the route | gsd-security-auditor | 2026-07-22 |
| AR-03-07 | T-03-G1-SC | No package installs in plan 03-07 (verified via git log on package.json) | gsd-security-auditor | 2026-07-22 |
| AR-03-08 | T-03-G3-SC | No package installs in plan 03-08 (verified via git log on package.json) | gsd-security-auditor | 2026-07-22 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-07-22 | 24 | 24 | 0 | gsd-security-auditor (sonnet) |

**Audit method:** verify-mitigations mode (register authored at plan time). Each mitigate threat verified present in implementation with file:line evidence; each accept threat's rationale re-verified against implemented code. All 8 SUMMARY.md files checked for `## Threat Flags` — none present, no unregistered attack surface.

### Non-Blocking Observations

1. **T-03-17 stale file citation.** The threat register lists `app/active-workout/[workoutId].tsx` as the mitigation site, but `handleSaveAsTemplate` actually lives in `app/active-workout/summary.tsx`. The mitigation is present and correctly wired (createTemplate → addTemplateExercise, both validated, `targetWeightKg` null by construction) — this is a documentation drift, not a code gap. Correct the citation in the next plan revision.
2. **`db/settings.ts` performs no validation itself** (`getSetting`/`setSetting` are untyped raw KV) — by design per T-03-10. The one bounded-numeric caller (`bar_weight_kg`/`bar_weight_lb`) clamps at the UI call site before writing. Any future `setSetting` call site handling bounded numeric data must supply its own clamp; this audit does not extend the guarantee to unimplemented phases.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-07-22
