---
phase: 04-stats-charts
reviewed: 2026-07-23T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - app/stats/[exerciseId].tsx
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 04-07: Code Review Report

**Reviewed:** 2026-07-23
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Reviewed `app/stats/[exerciseId].tsx` at standard depth, focused on the plan 04-07 gap-closure diff (`git diff b805503^ b805503`): adding `Scatter` to the victory-native import, rendering a `<Scatter>` alongside `<Line>` inside the `CartesianChart` render-prop fragment, and restyling `sparseCaption`.

**The diff itself is correct.** The `Scatter` is drawn after `Line`, so single-point series (which a Line cannot render) now show a visible dot — exactly the intended fix. Both primitives share the same `points.value`, the render-prop fragment is valid JSX, and the `sparseCaption` restyle (`typography.body` + `colors.text` + `textAlign: 'center'`) is a pure presentation change with no correctness impact. `tsc --noEmit` is clean and the change was device-verified. No BLOCKER or diff-level defect found.

One pre-existing robustness issue in the surrounding chart-render/data-loading code that the change interacts with is worth fixing, plus two minor items.

## Warnings

### WR-01: Async loader has no error handling — a failed DB read leaves the screen stuck on the spinner forever

**File:** `app/stats/[exerciseId].tsx:99-116`
**Issue:** The IIFE inside `useFocusEffect` awaits four DB calls in `Promise.all` but has no `try/catch`. `setLoading(false)` runs only on the success path (line 115). If any of `loadExerciseChartSets`, `loadAllHistorySets`, `loadExerciseById`, or `getSetting` rejects (DB locked, corrupt row, migration mid-flight), the promise rejects, `setLoading(false)` never runs, and the user is pinned on the `ActivityIndicator` (lines 148-154) with no recovery path — this is a live-loaded screen re-run on every focus, so a transient failure traps the view. It also surfaces as an unhandled promise rejection. The chart-render branch this change lives in is only reachable after this loader succeeds, so hardening it directly protects the new `Scatter`/`Line` render path.
**Fix:**
```tsx
(async () => {
  try {
    const [sets, allHistorySets, exerciseRow, unitSetting] = await Promise.all([
      loadExerciseChartSets(db, exerciseId),
      loadAllHistorySets(db),
      loadExerciseById(db, exerciseId),
      getSetting(db, 'units'),
    ]);
    if (cancelled) return;
    setExercise(exerciseRow ?? null);
    setUnit(unitSetting === 'lb' ? 'lb' : 'kg');
    setChartSets(sets);
    setHistorySets(allHistorySets);
  } catch (err) {
    if (!cancelled) {
      // surface an error state instead of an infinite spinner
      setExercise(null); // falls through to a not-found/error branch
    }
  } finally {
    if (!cancelled) setLoading(false);
  }
})();
```
Consider a dedicated error state rather than reusing the "Exercise not found" branch, so a DB failure isn't mislabeled as a missing exercise.

## Info

### IN-01: `exerciseId` is never validated for `NaN`

**File:** `app/stats/[exerciseId].tsx:80`
**Issue:** `const exerciseId = Number(exerciseIdParam)` yields `NaN` if the route param is missing or non-numeric. `NaN` then flows into `loadExerciseChartSets(db, NaN)`, `loadExerciseById(db, NaN)`, and `historySets.filter((s) => s.exerciseId === exerciseId)` (line 131), where `s.exerciseId === NaN` is always `false`. Behavior degrades gracefully (empty series → "Exercise not found"), so this is not a crash, but the failure mode is silent and indistinguishable from a genuinely missing exercise.
**Fix:** Guard early, e.g. `if (Number.isNaN(exerciseId)) { /* render invalid-id state */ }`, or `Number.isInteger(exerciseId)` before issuing queries.

### IN-02: `Scatter` renders a dot on every point, including dense multi-point series

**File:** `app/stats/[exerciseId].tsx:198`
**Issue:** The `Scatter` is unconditional, so a long "All"-range trend with many sessions gets a `radius={6}` dot on every point, which can visually crowd the line. The gap being closed is specifically the single-point case (a `Line` can't render one point). This is an aesthetic observation, not a correctness bug, and was device-verified — noting only in case dense-range rendering wasn't checked with a large dataset.
**Fix:** Optional. If crowding appears at scale, gate the scatter to sparse series (e.g. render `Scatter` only when `displayPoints.length <= N`, or use a smaller radius for large N). No change needed if the current look was accepted on-device.

---

_Reviewed: 2026-07-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
