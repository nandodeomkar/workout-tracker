---
phase: 03-templates-folders-calculators
plan: 04
subsystem: calculators
tags: [expo-router, settings, calculators, plate-solver, epley, warmup]

# Dependency graph
requires:
  - phase: 03-templates-folders-calculators
    provides: "lib/plateSolver.ts#solvePlates, lib/warmupLadder.ts#buildWarmupSets, lib/percentOf1RM.ts#percentOf1RM (Plan 01 pure math), lib/estimate1RM.ts (Phase 2), lib/weightUnits.ts (Phase 2), db/settings.ts getSetting/setSetting"
provides:
  - "components/PlateCalculatorSheet.tsx#PlateCalculatorSheet — reusable per-side plate breakdown sheet over solvePlates (UTIL-01)"
  - "components/OneRMCalculatorSheet.tsx#OneRMCalculatorSheet — reusable weight x reps -> estimate1RM + percentOf1RM table sheet (UTIL-02)"
  - "components/WarmupSuggestionSheet.tsx#WarmupSuggestionSheet — reusable buildWarmupSets ladder with onAccept callback (UTIL-03, inline-only)"
  - "settings keys bar_weight_kg / bar_weight_lb — independent barbell-weight persistence (D-06/D-07)"
  - "app/tools/plate-calculator.tsx, app/tools/one-rm-calculator.tsx — standalone Tools screens reachable from More"
affects: [03-templates-folders-calculators (Plan 06 mounts PlateCalculatorSheet/OneRMCalculatorSheet/WarmupSuggestionSheet inline on the active-workout exercise card)]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Full-screen picker-overlay sheet component (position:absolute inset:0, pickerHeader/pickerCancelButton) reused for all three calculator sheets, mirroring app/(tabs)/index.tsx's history picker", "Standalone Tools screen = thin settings-reading wrapper that mounts the same sheet component always-visible with onClose -> router.back(), reusing the sheet's own header as the back-navigation affordance instead of a second appbar"]

key-files:
  created: [components/PlateCalculatorSheet.tsx, components/OneRMCalculatorSheet.tsx, components/WarmupSuggestionSheet.tsx, app/tools/_layout.tsx, app/tools/plate-calculator.tsx, app/tools/one-rm-calculator.tsx]
  modified: ["app/(tabs)/settings.tsx", app/_layout.tsx]

key-decisions:
  - "bar_weight_kg / bar_weight_lb stored and stepped as two fully independent settings keys, resolved by the active unit at render/read time — never converted between each other (Pitfall 1)"
  - "Standalone tools screens (app/tools/plate-calculator.tsx, app/tools/one-rm-calculator.tsx) do not add a second in-screen appbar on top of the sheet's own picker-overlay header — the sheet is a full-screen overlay with its own '‹ Close' control, so a second appbar would be visually redundant (stacked/hidden behind the overlay); onClose is mapped straight to router.back(), satisfying the 'working Back control' requirement with the single header the sheet already provides"
  - "app/tools registered as a third sibling in the root Stack (alongside (tabs) and active-workout) — no new bottom tab, per CONTEXT.md Open Question 1 resolution (Tools lives under More)"

requirements-completed: [UTIL-01, UTIL-02, UTIL-03]

# Metrics
duration: 15min
completed: 2026-07-22
---

# Phase 03 Plan 04: Calculator Sheets + Tools Screens Summary

**Three reusable calculator sheet components (plate, 1RM, warm-up) built over the Plan-01 pure math, a persisted two-key barbell-weight Setting, and two standalone Tools screens reachable from More — plate and 1RM calculators are now usable end-to-end standalone.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-22
- **Tasks:** 3
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments
- `app/(tabs)/settings.tsx` gained a "Barbell weight" stepper row bound to the active unit, persisting `bar_weight_kg` (default 20) and `bar_weight_lb` (default 45) as two independent settings keys with a non-negative/≤500 clamp before every write (T-03-10)
- `components/PlateCalculatorSheet.tsx`: full-screen picker-overlay with an editable weight input, calls `solvePlates(weightDisplay, barWeightDisplay, unit)` and renders per-side plate chips (descending) plus "closest {achievable}{unit}, {+/-delta}" when the target isn't exactly loadable (D-08)
- `components/OneRMCalculatorSheet.tsx`: weight+reps inputs converted display-unit -> kg via `displayToKg`, `estimate1RM` (Epley) computes the 1RM, `percentOf1RM` renders the %1RM -> reps -> weight table, all converted back to display units via `kgToDisplay`
- `components/WarmupSuggestionSheet.tsx`: renders `buildWarmupSets(workingWeightDisplay, barWeightDisplay, unit)`'s 4-step ladder with a one-tap "Accept" Pressable per row emitting `onAccept({ weight, reps })` — persistence stays owned by the caller (wired in Plan 06)
- `app/tools/_layout.tsx` + `app/tools/plate-calculator.tsx` + `app/tools/one-rm-calculator.tsx`: standalone screens reading `units`/`bar_weight_*` from settings and mounting the corresponding sheet always-visible with no target prefill; `app/_layout.tsx` registers `tools` as a third sibling to `(tabs)`/`active-workout` (no new bottom tab); `app/(tabs)/settings.tsx` gained a "Tools" section with "Plate calculator" / "1RM calculator" rows pushing to the new routes
- Zero hardcoded hex colors in any new component (theme tokens only); every pressable control is ≥44×44; `npx tsc --noEmit` exits 0 and the full 23-file/156-test vitest suite stays green throughout

## Task Commits

1. **Task 1: Bar-weight setting rows + PlateCalculatorSheet (UTIL-01/D-06/D-07/D-08)**
   - `40a60bb` (feat) — bar_weight_kg/bar_weight_lb persisted setting rows + PlateCalculatorSheet
2. **Task 2: OneRMCalculatorSheet + WarmupSuggestionSheet (UTIL-02/UTIL-03/D-09/D-10/D-11)**
   - `d967ee1` (feat) — OneRMCalculatorSheet (Epley + %-table) and WarmupSuggestionSheet (ladder + onAccept)
3. **Task 3: Standalone Tools screens + route registration (UTIL-01/UTIL-02 standalone)**
   - `5dac2bd` (feat) — app/tools route group, standalone screens, root Stack registration, More → Tools rows

**Plan metadata:** (final commit recorded below, after STATE/ROADMAP update)

## Files Created/Modified
- `components/PlateCalculatorSheet.tsx` — `PlateCalculatorSheet` (props: visible, initialWeightDisplay?, unit, barWeightDisplay, onClose)
- `components/OneRMCalculatorSheet.tsx` — `OneRMCalculatorSheet` (props: visible, initialWeightDisplay?, initialReps?, unit, onClose)
- `components/WarmupSuggestionSheet.tsx` — `WarmupSuggestionSheet` (props: visible, workingWeightDisplay, unit, barWeightDisplay, onAccept, onClose)
- `app/tools/_layout.tsx` — Stack layout registering `plate-calculator` / `one-rm-calculator` siblings
- `app/tools/plate-calculator.tsx`, `app/tools/one-rm-calculator.tsx` — standalone screens
- `app/(tabs)/settings.tsx` — barbell-weight stepper row + Tools section (two new rows)
- `app/_layout.tsx` — added `<Stack.Screen name="tools" />` sibling

## Decisions Made
- Barbell weight step increments chosen as 2.5 (kg) / 5 (lb) — matches the smallest-common plate-loadable increment per unit's plate set (`PLATE_SET_KG`/`PLATE_SET_LB` in `lib/plateSolver.ts`), so every value the stepper can reach is itself a realistic bar weight
- Standalone tools screens skip a redundant second appbar since `PlateCalculatorSheet`/`OneRMCalculatorSheet` already render their own full-screen header with a "‹ Close" control — mapped to `router.back()` for standalone use, matching the "built once, consumed twice" reuse the plan calls for
- `WarmupSuggestionSheet` intentionally has no standalone Tools screen (per plan scope: D-10 auto-insert wiring needs the active-workout screen's `insertSet`, deferred to Plan 06) — it is inline-only, exactly as specified

## Deviations from Plan
None — plan executed as written; all three tasks' acceptance criteria (tsc, vitest, grep checks for `bar_weight_kg`/`bar_weight_lb`, `solvePlates`, `estimate1RM`/`percentOf1RM`, `buildWarmupSets`/`onAccept`, `name="tools"`, route pushes, zero hardcoded hex) pass verbatim.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. Human device-UAT for the sheet visuals + settings persistence is deferred to end-of-phase per `human_verify_mode=end-of-phase` (config.json), covering: Barbell weight row shows 20/45 defaults and persists across relaunch; PlateCalculatorSheet/OneRMCalculatorSheet math on-device; Tools rows navigate correctly from More.

## Next Phase Readiness
- `PlateCalculatorSheet`, `OneRMCalculatorSheet`, and `WarmupSuggestionSheet` are typed and exported for Plan 06 to mount inline on the active-workout exercise card (props already shaped for that reuse — e.g. `WarmupSuggestionSheet.onAccept` is the exact seam Plan 06 wires to `insertSet(..., type: 'warmup')`)
- Plate + 1RM calculators are fully usable standalone today (More → Tools); no new tab, no new package
- Full vitest suite (23 files / 156 tests) green; `npx tsc --noEmit` reports zero errors
- No blockers for downstream plans in this phase

---
*Phase: 03-templates-folders-calculators*
*Completed: 2026-07-22*

## Self-Check: PASSED

All 6 created files found on disk (components/PlateCalculatorSheet.tsx, components/OneRMCalculatorSheet.tsx, components/WarmupSuggestionSheet.tsx, app/tools/_layout.tsx, app/tools/plate-calculator.tsx, app/tools/one-rm-calculator.tsx). All 3 commit hashes verified present in git log (40a60bb, d967ee1, 5dac2bd).
