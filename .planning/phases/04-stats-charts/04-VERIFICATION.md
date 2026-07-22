---
phase: 04-stats-charts
verified: 2026-07-23T01:15:00Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Per-exercise chart: metric toggle + range chips"
    expected: "Tapping Est. 1RM / Top Set / Volume swaps the rendered line series; tapping 3M / 1Y / All re-filters the chart without a per-tap DB round trip or visible freeze."
    why_human: "Skia GPU render output and perceived interaction latency cannot be confirmed by static analysis; code inspection shows the wiring (useState + useMemo) is correct but not that the canvas visually updates correctly."
  - test: "Empty / sparse states across all three surfaces"
    expected: "A never-logged exercise's chart shows 'No data yet for {name}'; an exercise with exactly one workout shows the point + 'Log one more workout...' caption; a fresh account shows 'No PRs yet' and 'No training logged yet' on the dashboard."
    why_human: "The synthetic STAT-04 fixture used for the one on-device pass this session (~15,600 sets) is dense and cannot exercise these zero/near-zero-data branches; only source-level conditional logic was verified, not the rendered screen."
  - test: "Chart/Records toggle + PR-feed tap-through to record board"
    expected: "Tapping a PR-feed row (or the 'Records' toggle on the chart screen) opens the exercise's live record board: curated 1/3/5/8/10/12-rep-max rows (only logged counts) + best-e1RM hero card, in the user's display unit."
    why_human: "Navigation and view-toggle wiring is code-verified (router.push + MetricToggle state), but the on-device pass this session did not report exercising the Records view specifically — only 'the per-exercise chart' and 'PR feed / weekly-volume' render/responsiveness."
  - test: "'See all' full history screen + live PR-feed update after logging a new PR"
    expected: "'See all' opens an unbounded, newest-first FlatList of all PR events. Logging a new PR set and returning to the Stats tab shows it appear in the Section A feed without restarting the app (live recompute, D-11)."
    why_human: "Requires an interactive round trip (log a set, background/foreground the tab) that cannot be simulated by static code review; the live-recompute *mechanism* (useFocusEffect, no cache) is code-verified, but the end-to-end user-visible behavior is not."
---

# Phase 4: Stats & Charts Verification Report

**Phase Goal:** Users can see their strength progress over time through fast, reliable charts.
**Verified:** 2026-07-23T01:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view per-exercise charts for est-1RM, top set, and volume over time (ROADMAP SC1) | VERIFIED | `app/stats/[exerciseId].tsx` renders `CartesianChart`+`Line` fed by `buildChartSeries(chartSets, metric)`; `METRIC_OPTIONS` = Est.1RM/Top Set/Volume, default `'e1rm'`. `lib/chartSeries.ts` reuses `estimate1RM`/`workingSetVolume` verbatim (D-17). 9/9 unit tests green. |
| 2 | User can view weekly training volume broken down by muscle group (ROADMAP SC2) | VERIFIED | `app/(tabs)/stats.tsx` Section B renders `CartesianChart`+`StackedBar` fed by `buildWeeklyVolume(weeklySets, 12)`; `MUSCLE_GROUP_KEYS`/`COLORS` index-aligned, `'Other'` last/muted (`constants/statsChart.ts`). 10/10 `weeklyVolume` tests green. |
| 3 | User sees a PR feed reflecting bests computed live from logged sets, never stored/cached (ROADMAP SC3) | VERIFIED (display caveat) | `app/(tabs)/stats.tsx` Section A + `app/stats/records.tsx` both call `computeAllTimeRecords(historySets)` inside `useFocusEffect`, no persistence path (grep confirms no new table/settings write). 11/11 `records` tests green, incl. an explicit "re-scan after appending a heavier set reflects immediately" test. **Caveat:** a pre-existing, already-tracked review finding (WR-01, `04-REVIEW.md`) shows `e1rm`-kind feed rows render the raw working weight, not the computed e1RM, next to the "Est. 1RM" label — a display bug in `prKindLabel`/render, not in the detection/live-compute logic itself. Confirmed still present in both `app/(tabs)/stats.tsx:171-174` and `app/stats/records.tsx:119-122`. Does not fail the underlying truth (PRs *are* detected and shown live) but is a real correctness defect worth tracking to closure. |
| 4 | Charts stay responsive against a large synthetic dataset representing years of history (ROADMAP SC4 / STAT-04) | VERIFIED | `db/test/syntheticHistory.ts` + `db/stats.performance.test.ts` seed a deterministic ~15,600-set/~780-workout fixture and assert all three query paths under ceiling (all-history PR scan <500ms); `npx vitest run` confirms 416/416 passing including this suite. On-device Skia-render half was performed this session and the owner confirmed "responsive" (per session context — not re-requested). |
| 5 | Chart is one point per workout, defaults Est. 1RM, switchable metric via toggle (Plan 02) | VERIFIED | `buildChartSeries` groups by `workoutId` (one point/workout); `useState<ChartMetric>('e1rm')` default; `MetricToggle` wired to `setMetric`. |
| 6 | Range chips 3M/1Y/All filter client-side, default All, no per-chip re-query (Plan 02) | VERIFIED | `rangeCutoffISO` computed client-side over the already-fetched `allPoints`; single `useFocusEffect` fetch keyed only on `exerciseId`. |
| 7 | Empty (0 sets) and sparse (1 point) chart states show correct copy (Plan 02) | VERIFIED (source) | Conditional render paths present with the exact specified copy; visual confirmation deferred to human verification (dense synthetic fixture doesn't exercise these branches). |
| 8 | Exercise picker (D-03a) is the second "View progress" entry point alongside the library link (D-03b) (Plan 03) | VERIFIED | `app/(tabs)/exercises/[id].tsx` has a "View progress" `Pressable` → `router.push('/stats/[exerciseId]')`; `app/(tabs)/stats.tsx` Section C picker rows do the same via `loadExercisesWithSets`. |
| 9 | Recent PR feed capped to 12, newest-first, with a working "See all" link (Plan 04) | VERIFIED | `recentPREvents` = `events.sort(...).slice(0, 12)`; "See all" → `router.push('/stats/records')`; `app/stats/records.tsx` renders the full unbounded `FlatList`. |
| 10 | Per-exercise record board: curated rep-max rows (untouched counts omitted) + best e1RM, live-computed (Plan 05) | VERIFIED | `app/stats/[exerciseId].tsx` Records view iterates `CURATED_REP_MAXES`, renders only logged counts (`if (!entry) return null`), derives via `computeExerciseRecordBoard(historySets.filter(...))` inside the existing `useFocusEffect`/`useMemo` — no new query, nothing persisted. |
| 11 | No production code/schema changed by the STAT-04 performance plan (Plan 06) | VERIFIED | `files_modified` for Plan 06 lists only `db/test/syntheticHistory.ts` + `db/stats.performance.test.ts`; confirmed no `db/schema.ts` diff in this phase's file set. |

**Score:** 11/11 distinct truths VERIFIED (one with a non-blocking, already-tracked display caveat). Full vitest suite: 416/416 passing. `npx tsc --noEmit`: exits 0.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | victory-native@41.26.0 + @shopify/react-native-skia pinned exact | VERIFIED (with deviation) | `victory-native: 41.26.0` exact. Skia pinned `2.9.1`, not the plan's `2.9.0` — an explicit, user-approved deviation captured in 04-01-SUMMARY.md (still within victory-native's peer range `>=1.2.3 <3.0.0`). CLAUDE.md still documents `2.9.0` as the intended pin; open reconciliation item, not a functional gap. |
| `lib/chartSeries.ts` | `buildChartSeries` pure reduction | VERIFIED | Exists, imports `estimate1RM`/`workingSetVolume`, zero RN/Drizzle imports, 9 tests green. |
| `db/stats.ts` | `loadExerciseChartSets`, `loadWeeklyVolumeSets`, `loadExercisesWithSets`, `loadAllHistorySets` | VERIFIED | All four exported, parameterized Drizzle builders only, `isNotNull(finishedAt)` applied consistently. |
| `components/MetricToggle.tsx` | Single-select pill row | VERIFIED | Generic `MetricToggle<T>`, reused 3x (metric, range, chart/records view). |
| `app/stats/[exerciseId].tsx` | Chart + Records screen | VERIFIED | Both views present behind a `MetricToggle`-based Chart/Records switch; wired to all required data sources. |
| `app/(tabs)/exercises/[id].tsx` | "View progress" entry point | VERIFIED | `router.push` to `/stats/[exerciseId]` present. |
| `lib/weeklyVolume.ts` | `getWeekStart` + `buildWeeklyVolume` | VERIFIED | UTC Monday-anchored, zero-filled window, 10 tests green. |
| `constants/statsChart.ts` | `MUSCLE_GROUP_KEYS`/`COLORS`, Other last | VERIFIED | Index-aligned, `'Other'`/`#6B7280` last. |
| `app/(tabs)/stats.tsx` | Dashboard shell: Sections A/B/C | VERIFIED | All three sections present and populated (no placeholder remaining). |
| `lib/records.ts` | `computeAllTimeRecords`/`computeExerciseRecordBoard` | VERIFIED | Both exported, single chronological pass, strict-`>` tie handling, 11 tests green. |
| `app/stats/records.tsx` | Full PR history screen | VERIFIED | Unbounded `FlatList`, same live-recompute discipline. |
| `db/test/syntheticHistory.ts` | `seedSyntheticHistory` | VERIFIED | Exists, deterministic, `setCount >= 12000` asserted in the perf suite. |
| `db/stats.performance.test.ts` | Timed assertions, 3 paths | VERIFIED | `performance.now()` around all 3 paths; all-history scan `<500ms` asserted and passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app/(tabs)/exercises/[id].tsx` | `/stats/[exerciseId]` | `router.push` | WIRED | Confirmed via grep + read. |
| `app/stats/[exerciseId].tsx` | `db/stats.ts#loadExerciseChartSets` → `lib/chartSeries.ts#buildChartSeries` | `useFocusEffect` load + `useMemo` reduction | WIRED | Confirmed in file (lines 100-125). |
| `app/(tabs)/stats.tsx` (Section B) | `db/stats.ts#loadWeeklyVolumeSets` → `lib/weeklyVolume.ts#buildWeeklyVolume` → `StackedBar` | `useFocusEffect` load + pure bucketing | WIRED | Confirmed (lines 76-122, 196-213). |
| `app/(tabs)/stats.tsx` (picker) | `/stats/[exerciseId]` | `router.push` | WIRED | Confirmed (line 254). |
| `app/(tabs)/stats.tsx` (Section A) | `db/stats.ts#loadAllHistorySets` → `lib/records.ts#computeAllTimeRecords` | live recompute, never cached | WIRED | Confirmed (lines 80, 105-108); no writes to settings/tables found. |
| `app/(tabs)/stats.tsx` (See all) | `/stats/records` | `router.push` | WIRED | Confirmed (line 181). |
| `app/stats/[exerciseId].tsx` (Records view) | `db/stats.ts#loadAllHistorySets` → `lib/records.ts#computeExerciseRecordBoard` | `useFocusEffect` live recompute, scoped to exerciseId | WIRED | Confirmed (lines 101-134); no new query added, matching plan's explicit instruction. |
| `db/stats.performance.test.ts` | `db/stats.ts` (all 3 paths) | timed calls over synthetic fixture | WIRED | Confirmed; test passes. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `app/stats/[exerciseId].tsx` chart | `displayPoints` | `loadExerciseChartSets` (real DB join) → `buildChartSeries` | Yes | FLOWING |
| `app/(tabs)/stats.tsx` stacked bar | `displayRows` | `loadWeeklyVolumeSets` (real DB join) → `buildWeeklyVolume` | Yes | FLOWING |
| `app/(tabs)/stats.tsx` PR feed | `recentPREvents` | `loadAllHistorySets` (real DB join) → `computeAllTimeRecords` | Yes (but see WR-01 for one field's display mapping) | FLOWING |
| `app/stats/[exerciseId].tsx` Records view | `recordBoard` | `loadAllHistorySets` filtered in JS → `computeExerciseRecordBoard` | Yes | FLOWING |

No hardcoded/static returns found in any of the four `db/stats.ts` query functions — all issue real parameterized joins against `sets`/`workoutExercises`/`workouts`/`exercises`.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full vitest suite passes | `npx vitest run` | 56 files / 416 tests passed | PASS |
| Typecheck clean | `npx tsc --noEmit` | exits 0, no output | PASS |
| No debt markers in phase files | grep TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER across all phase-touched files | no matches | PASS |
| Perf ceiling: all-history PR scan | `expect(ms).toBeLessThan(500)` in `db/stats.performance.test.ts` | asserted and passing (part of full suite run) | PASS |

### Probe Execution

Not applicable — this phase has no `scripts/*/tests/probe-*.sh` convention or PLAN/SUMMARY-declared probes. Step 7c: SKIPPED (no probes declared or discovered).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| STAT-01 | 04-02-PLAN | Per-exercise charts: est-1RM, top set, volume over time | SATISFIED | `app/stats/[exerciseId].tsx`, `lib/chartSeries.ts`, `db/stats.ts#loadExerciseChartSets` |
| STAT-02 | 04-03-PLAN | Weekly volume by muscle group | SATISFIED | `app/(tabs)/stats.tsx` Section B, `lib/weeklyVolume.ts`, `db/stats.ts#loadWeeklyVolumeSets` |
| STAT-03 | 04-04-PLAN, 04-05-PLAN | PR feed, computed live, never stored | SATISFIED (WR-01 display caveat, non-blocking) | `lib/records.ts`, `db/stats.ts#loadAllHistorySets`, Section A feed, `app/stats/records.tsx`, per-exercise Records view |
| STAT-04 | 04-06-PLAN | Charts stay responsive with years of history | SATISFIED | `db/test/syntheticHistory.ts`, `db/stats.performance.test.ts`, on-device pass confirmed this session |

No orphaned requirements — REQUIREMENTS.md's traceability table (lines 114-117) maps exactly STAT-01..04 to Phase 4, and all four appear in a plan's `requirements` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `app/(tabs)/stats.tsx` | 171-174 | "Est. 1RM" feed rows display `weightKg`, not the computed `e1rm` (WR-01, already tracked in `04-REVIEW.md`) | WARNING | Misleading number under a correct label; does not affect PR *detection* or live-recompute correctness. Not yet fixed. |
| `app/stats/records.tsx` | 119-122 | Same WR-01 defect, second occurrence | WARNING | Same as above. |
| `app/(tabs)/exercises/[id].tsx` | 57-72 | `loadExercise` effect has no cancellation guard (WR-02, pre-existing, already tracked) | WARNING | Pre-dates this phase's delta (only the "View progress" button was added here); reviewed file, worth closing but not introduced by Phase 4. |
| `db/stats.performance.test.ts` | 45,56,66 | Absolute wall-clock ceilings (200/300/500ms) can be flaky on slower hardware (WR-03, already tracked) | WARNING | Currently passing; a documented, low-risk flakiness vector, not a functional defect. |

All four are pre-existing findings from the standard-depth code review (`04-REVIEW.md`, 0 critical / 3 warning / 6 info) — carried forward here for completeness, not newly discovered. None block the phase goal.

## Human Verification Required

### 1. Per-exercise chart: metric toggle + range chips

**Test:** Open a heavily-logged exercise's chart. Tap Est. 1RM / Top Set / Volume, then tap 3M / 1Y / All.
**Expected:** The line series visually swaps per metric; range chips re-filter without a noticeable freeze or a new DB round trip.
**Why human:** Skia GPU render correctness and perceived interaction latency aren't verifiable from source; the state-wiring is code-confirmed but not the rendered result.

### 2. Empty / sparse states across all three surfaces

**Test:** View the chart for a never-logged exercise, an exercise with exactly one workout, a fresh/empty Stats dashboard (zero PRs, zero volume).
**Expected:** Exact specified copy renders ("No data yet for {name}", "Log one more workout...", "No PRs yet", "No training logged yet").
**Why human:** This session's on-device pass used the dense ~15,600-set synthetic fixture, which cannot exercise these zero/near-zero branches.

### 3. Chart/Records toggle + PR-feed tap-through

**Test:** Tap a PR-feed row (or the "Records" toggle on the chart screen) for an exercise with mixed rep-count history.
**Expected:** Opens the record board: curated 1/3/5/8/10/12-rep-max rows (only logged counts, no placeholders) + best-e1RM hero card, values in display unit.
**Why human:** Navigation/derivation logic is code-verified, but the on-device pass this session reported checking "the per-exercise chart" and "PR feed / weekly-volume," not specifically the Records view or feed-to-board tap-through.

### 4. "See all" full history + live PR-feed update

**Test:** Tap "See all" from the Stats tab. Separately, log a new PR-setting set, return to the Stats tab.
**Expected:** "See all" opens the complete newest-first PR history. The new PR appears in Section A's feed on return, with no app restart needed.
**Why human:** Requires an interactive round trip (navigate away, mutate data, navigate back) that static review cannot simulate; the live-recompute *mechanism* is code-verified, not the end-to-end user-visible update.

## Gaps Summary

No BLOCKER-level gaps. All 4 ROADMAP success criteria and all plan-level must-haves are backed by real, wired, tested code: 416/416 vitest tests pass, `tsc --noEmit` is clean, all four `db/stats.ts` query functions issue real parameterized joins (no stubs/static returns), and every screen-to-query-to-lib chain traced in this report is genuinely connected. STAT-04's synthetic-scale device pass was explicitly performed and confirmed this session.

The phase is functionally complete pending the four human-verification items above — none of which are new construction (they exercise UI interactions and rare data states inside already-built, already-wired screens) but all of which were explicitly deferred to "phase gate" in Plans 02-05 and have not yet been confirmed beyond the STAT-04 responsiveness pass. One already-tracked, non-blocking display defect (WR-01: "Est. 1RM" feed rows show the working weight, not the computed estimate) remains open in `04-REVIEW.md` and is carried forward here for visibility — it does not block phase goal achievement since the underlying PR detection and live-recompute guarantees are correct.

---

_Verified: 2026-07-23T01:15:00Z_
_Verifier: Claude (gsd-verifier)_
