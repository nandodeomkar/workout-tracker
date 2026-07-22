---
phase: 04-stats-charts
reviewed: 2026-07-22T19:17:18Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - app/(tabs)/exercises/[id].tsx
  - app/(tabs)/stats.tsx
  - app/stats/[exerciseId].tsx
  - app/stats/records.tsx
  - components/MetricToggle.tsx
  - constants/statsChart.ts
  - db/stats.performance.test.ts
  - db/stats.query.test.ts
  - db/stats.ts
  - db/test/syntheticHistory.ts
  - lib/chartSeries.test.ts
  - lib/chartSeries.ts
  - lib/records.test.ts
  - lib/records.ts
  - lib/weeklyVolume.test.ts
  - lib/weeklyVolume.ts
  - package.json
  - theme.ts
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-22T19:17:18Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the Phase 04 stats/charts slice: the Drizzle query layer (`db/stats.ts`), the three
pure reducers (`lib/chartSeries.ts`, `lib/records.ts`, `lib/weeklyVolume.ts`), the three screens
(overview dashboard, per-exercise chart/records, full PR history), the shared chart constants, and
the Node-only performance fixture.

Overall the correctness-critical concerns the phase set out to get right are solid: all queries are
parameterized (no injection surface), `isNotNull(finishedAt)` correctly excludes in-progress
workouts everywhere, `getWeekStart` bucketing is UTC and DST-safe, the weekly-volume query window
(`weeksAgoIso(12)`) is a strict superset of the `buildWeeklyVolume(12)` bucket window so no bucket
is under-populated, and the live-recompute discipline (`useFocusEffect` reload + `useMemo` keyed on
freshly-loaded sets, never persisted) is applied consistently. `loadAllHistorySets` is a single
query, not an N+1 loop.

No BLOCKER-severity defects (no crashes, injection, auth, or data-loss paths) were found. The
findings below are a genuine display-correctness bug in the PR feed, a missing effect-cancellation
guard, flaky wall-clock test assertions, and several efficiency / consistency observations.

## Warnings

### WR-01: "Est. 1RM" PR-feed rows display the working weight, not the estimated 1RM

**File:** `app/(tabs)/stats.tsx:171-174`, `app/stats/records.tsx:119-122`, `lib/records.ts:36-43,111-118`
**Issue:** `PREvent` carries only `weightKg` (the weight of the set that set the record) — it does
not carry the computed e1RM. Both feed rows render `${prKindLabel(event)} · ${kgToDisplay(event.weightKg, unit)}${unit}`.
For a `kind: 'e1rm'` event `prKindLabel` returns the literal string `"Est. 1RM"`, so a bench of
90 kg × 10 renders as **"Est. 1RM · 90 kg"** — but the estimated 1RM for that set is
`90 * (1 + 10/30) ≈ 120 kg`. The number shown next to the "Est. 1RM" label is not the estimated 1RM;
it is the raw working weight. This is inconsistent with the per-exercise Records hero card, which
correctly shows `recordBoard.bestE1RM.e1rm` (`app/stats/[exerciseId].tsx:223`). The e1RM feed row
also omits the rep count, so the user cannot even infer the real e1RM. Misleading information under
an explicit label.
**Fix:** Add the estimated 1RM to the event so the feed can show the value its label promises:
```ts
// lib/records.ts — extend the e1rm PREvent
events.push({
  exerciseId: s.exerciseId,
  workoutId: s.workoutId,
  date: s.startedAt,
  kind: 'e1rm',
  reps: s.reps,
  weightKg: s.weightKg,
  e1rm, // NEW: the computed estimate
});
```
```tsx
// feed rows: show the e1RM for e1rm events, the lifted weight for rep-max events
const shownKg = event.kind === 'e1rm' ? event.e1rm : event.weightKg;
<Text>{prKindLabel(event)} · {kgToDisplay(shownKg, unit)}{unit} · {formatShortDate(event.date)}</Text>
```
(Or, if showing the working weight is the deliberate intent, relabel to e.g. `"Est. 1RM (from 90×10)"`
so the number is not read as the estimate.)

### WR-02: `loadExercise` effect has no cancellation/race guard (setState-after-unmount + stale response)

**File:** `app/(tabs)/exercises/[id].tsx:57-72`
**Issue:** Unlike every stats screen in this phase (which uses a `let cancelled = false` guard in the
`useFocusEffect` cleanup), `loadExercise` awaits `loadExerciseById` and then unconditionally calls
`setExercise/setName/...`. If the component unmounts, or `exerciseId` changes before the await
resolves, the resolved older request still writes state — a setState-after-unmount warning and a
last-write-wins race where a stale exercise can overwrite the newer one. The phase-04 delta to this
file is only the "View progress" button, so the race predates this phase, but it is now a reviewed
file and the inconsistency with the phase's own established pattern is worth closing.
**Fix:** Mirror the stats screens' guard:
```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    setLoading(true);
    const row = await loadExerciseById(db, exerciseId);
    if (cancelled) return;
    if (row) { setExercise(row); setName(row.name); /* ... */ }
    setLoading(false);
  })();
  return () => { cancelled = true; };
}, [exerciseId]);
```

### WR-03: Wall-clock timing assertions make the performance suite flaky

**File:** `db/stats.performance.test.ts:45,56,66`
**Issue:** The three tests assert `expect(ms).toBeLessThan(200 | 300 | 500)` against `performance.now()`
deltas. Absolute wall-clock thresholds are environment-dependent: on a loaded CI runner, a cold
better-sqlite3 build, or slower hardware these will fail spuriously even with zero code regression —
the exact "flaky on machine speed" failure mode. A regression guard that fails on a busy laptop
erodes trust in the suite and invites `--no-verify`.
**Fix:** Assert on shape/scale rather than absolute time, or scale the ceiling to a measured baseline.
E.g. keep the `rows.length` assertions (already present and good) and gate the timing behind an
opt-in env flag, or assert relative ordering (Path 1 < Path 3) instead of a hard millisecond ceiling.
If a hard ceiling is required, widen it substantially (e.g. 2000 ms) so it only catches
order-of-magnitude N+1 regressions, which is the stated intent.

## Info

### IN-01: `Number(exerciseIdParam)` is not validated — NaN flows into the query/filter

**File:** `app/stats/[exerciseId].tsx:81`
**Issue:** `const exerciseId = Number(exerciseIdParam)` yields `NaN` for a missing or non-numeric
route param. It is passed to `loadExerciseChartSets(db, NaN)` / `loadAllHistorySets` filter
(`s.exerciseId === NaN` is always false) and to `eq(workoutExercises.exerciseId, NaN)`. SQLite binds
NaN as NULL so the query returns `[]` and the screen degrades to the "Exercise not found" state
rather than crashing — but the intent is opaque. Consider `Number.isFinite(exerciseId)` guarding and
rendering the not-found state explicitly.

### IN-02: Per-exercise Records loads the entire all-history set table to filter one exercise

**File:** `app/stats/[exerciseId].tsx:101-104,131-134`
**Issue:** The per-exercise screen calls `loadAllHistorySets(db)` (every set across every exercise —
~15,600 rows in the perf fixture) then `historySets.filter(s => s.exerciseId === exerciseId)` in JS,
keeping only one exercise's rows. This is an explicit "do not add a new query" design decision per
the file comment, and it is a single query (not N+1), so it is out of the v1 performance scope — but
it does pull the full history into memory on every focus of a single-exercise screen. If it ever
shows up on-device, a targeted `loadExerciseHistorySets(db, exerciseId)` would bound it.

### IN-03: Archived exercises still surface in stats picker, PR feed, and weekly volume

**File:** `db/stats.ts:94-115,126-141,61-76`
**Issue:** None of `loadExercisesWithSets`, `loadAllHistorySets`, or `loadWeeklyVolumeSets` filter
`exercises.archived`. An archived exercise with historical sets therefore still appears in the Stats
"View Progress" picker, PR feed, and weekly-volume totals, even though the exercise library hides it.
This is plausibly intentional (you still want the history you already logged), but it is an
inconsistency with the library's archived-hiding behavior and should be a conscious decision, not an
accident. Confirm intent; if archived should be hidden here too, add `eq(exercises.archived, false)`.

### IN-04: Duplicate-looking feed rows — the same set emits both a rep-max and an e1RM event

**File:** `lib/records.ts:89-119`, `app/(tabs)/stats.tsx:155-177`
**Issue:** A set that beats both the running rep-max and the running e1RM (the common case for a
genuine strength PR, and always true for the very first working set) pushes two `PREvent`s with the
same date/weight. The overview feed then renders two adjacent rows, e.g. "5RM · 100 kg" and
"Est. 1RM · 100 kg", which read as near-duplicates (compounded by WR-01). Consider de-duplicating
same-set rep-max + e1RM into one row, or visually grouping them, to keep the "Recent PRs" feed
scannable.

### IN-05: UTC bucketing vs local-time label formatting can drift at the year boundary

**File:** `lib/weeklyVolume.ts:32-39` vs `constants/statsChart.ts:45-53`, `app/(tabs)/stats.tsx:49-51`
**Issue:** `getWeekStart` deliberately computes week keys in UTC, but `formatChartDateTick`,
`formatShortDate`, and `formatRecordDate` format with local-time getters (`getFullYear`,
`toLocaleDateString`). A `weekStart` of `"2026-01-01"` (UTC) rendered in a negative-offset timezone
resolves to Dec 31 of the prior year for the label. Cosmetic and edge-only (year/month boundary),
but the UTC-vs-local split is a latent inconsistency worth a comment or a UTC-based formatter.

### IN-06: Performance fixture re-seeds ~15,600 rows in `beforeEach` for each of 3 tests

**File:** `db/stats.performance.test.ts:27-36`
**Issue:** `seedSyntheticHistory` runs in `beforeEach`, so the full ~780-workout / ~15,600-set
dataset is built and inserted three times per run. The seed cost is correctly excluded from the
timed region, but it triples suite wall time for no coverage gain. A `beforeAll` with a fresh
read-only DB (the queries are read-only) would cut seeding to once. Minor; test-runtime only.

---

_Reviewed: 2026-07-22T19:17:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
