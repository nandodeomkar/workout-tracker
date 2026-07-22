---
phase: 03-templates-folders-calculators
reviewed: 2026-07-22T13:34:19Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - app/(tabs)/index.tsx
  - app/_layout.tsx
  - app/active-workout/[workoutId].tsx
  - app/active-workout/summary.tsx
  - app/templates/[templateId].tsx
  - app/templates/_layout.tsx
  - app/templates/new.tsx
  - components/ExerciseCard.tsx
  - components/FolderSectionHeader.tsx
  - components/TemplateBuilderForm.tsx
  - components/TemplateRow.tsx
  - lib/percentOf1RM.test.ts
  - lib/percentOf1RM.ts
  - lib/plateSolver.test.ts
  - lib/plateSolver.ts
  - lib/warmupLadder.test.ts
  - lib/warmupLadder.ts
findings:
  critical: 0
  warning: 7
  info: 5
  total: 12
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-07-22T13:34:19Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Reviewed the Templates/Folders/Calculators phase: the three pure calculator libs (`plateSolver`, `warmupLadder`, `percentOf1RM`), the templates data-layer consumers, the shared `TemplateBuilderForm`, the Workout-home template list, and the active-workout / summary screens that were extended for template pre-fill, save-as-template, and the inline calculator sheets.

**Overall assessment:** The pure-logic libraries are correct, well-tested, and free of the floating-point / off-by-one traps they document. The DB layer (`db/templates.ts`) is parameterized, validated, and transaction-safe — no injection surface. No security defects and no crash/data-loss BLOCKERs were provable.

The narrative findings below concentrate on **latent correctness and robustness gaps in the screen layer**: swallowed/unhandled async errors on the seed and save paths, stale-closure handling of the rest-timer notification id, a couple of missing in-flight guards that allow duplicate rows to be created, and an ambiguous duration format. None block shipping on their own, but WR-01, WR-02, WR-03, and WR-04 each produce user-visible wrong behavior under realistic conditions and should be fixed.

No `<structural_findings>` block was provided, so this report contains only narrative findings.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Seed failure is silently swallowed and produces an unhandled promise rejection

**File:** `app/_layout.tsx:27-31`
**Issue:** `runSeedIfNeeded(db).finally(() => { ... setSeeded(true); })` has no `.catch`. `.finally` re-propagates a rejection, so if the first-launch seed throws the app emits an **unhandled promise rejection**. Worse, the `.finally` callback flips `seeded` to `true` regardless of success/failure, so the app shell renders (line 41) on top of a database that was never seeded — an empty exercise catalog with no error surfaced to the user or logs. The sibling migration path *does* hard-stop on error (`MigrationErrorScreen`); the seed path silently degrades.
**Fix:**
```tsx
runSeedIfNeeded(db)
  .then(() => { if (!cancelled) setSeeded(true); })
  .catch((e) => {
    if (!cancelled) setSeedError(e instanceof Error ? e : new Error(String(e)));
  });
```
Render an error screen (mirroring `MigrationErrorScreen`) when `seedError` is set instead of proceeding into the app with an unseeded DB.

### WR-02: Workout-home start actions have independent in-flight guards, allowing two workouts to be created at once

**File:** `app/(tabs)/index.tsx:227-239, 250-270, 280-292`
**Issue:** `handleStartEmpty`, `handlePickHistoryWorkout`, and `handlePickTemplate` each guard only their *own* boolean (`starting`, `startingFromHistory`, `startingFromTemplate`). Nothing prevents two of them from running concurrently. Tapping "Start empty workout" and a template row in quick succession creates **two** `workouts` rows; the second `setActiveWorkout` wins and navigates, leaving the first as an orphaned unfinished workout that `findResumableWorkout` will surface as a phantom "Resume workout" on next cold start.
**Fix:** Use a single shared guard for all start paths, e.g. `const [startingAny, setStartingAny] = useState(false);` checked/set at the top of all three handlers, or disable the other affordances whenever any start is in flight.

### WR-03: "Save as template" can create duplicate templates on repeated taps

**File:** `app/active-workout/summary.tsx:153-186`
**Issue:** `handleSaveAsTemplate` guards only concurrent execution (`savingTemplate`), and resets `savingTemplate` to `false` in `finally`. After a successful save the button remains enabled and shows no committed state, so a second (or third) tap creates additional identical templates. There is no idempotency latch and no navigation away.
**Fix:** After a successful save, latch a `saved` state that permanently disables the button (and/or change its label to "Saved"), or navigate away / dismiss. Example:
```tsx
const [saved, setSaved] = useState(false);
// ...after success:
setSaved(true);
// button: disabled={savingTemplate || saved}
```

### WR-04: Rest-timer notification id is read from a stale render closure — skip/adjust/restart can leave notifications uncancelled

**File:** `app/active-workout/[workoutId].tsx:369-415` (`startRestTimer`, `handleSkipRest`, `handleAdjustRest`)
**Issue:** These async handlers call `cancelRestNotification(restNotificationId)` where `restNotificationId` is the value captured in the render closure, not the live store value. Because scheduling is async and a set can be logged (or Skip tapped) before the `setRestNotificationId(...)` from the previous action has committed, the cancel can run against a stale/`null` id and fail to cancel the actually-scheduled OS notification. Result: logging sets in rapid succession can leave orphaned notifications, and "Skip" can fail to stop a buzz that then fires after the user has moved on. The unmount cleanup (line 359) deliberately uses `useActiveWorkout.getState().restNotificationId` to avoid exactly this staleness — the same technique is missing here.
**Fix:** Read the id from the store at call time in each handler:
```ts
await cancelRestNotification(useActiveWorkout.getState().restNotificationId);
```

### WR-05: `formatDuration` produces ambiguous `M:SS` vs `H:MM` output

**File:** `app/active-workout/summary.tsx:53-65`
**Issue:** Below 60 minutes the function returns `minutes:seconds` (e.g. `5:00`); at/above 60 minutes it returns `hours:minutes` (e.g. `1:05`). A 65-minute workout renders `1:05`, visually indistinguishable from a 1-minute-5-second workout. The unit silently changes meaning at the 60-minute boundary with no `h`/`m` marker.
**Fix:** Use unambiguous unit suffixes across both branches, e.g. `1h 05m` for ≥60 min and `5m 00s` (or `5:00`) below, so the two ranges can never collide.

### WR-06: `updateRow` and `handleAddSet` use non-functional `setState` over a closure snapshot of `rowsByWE`

**File:** `app/active-workout/[workoutId].tsx:461-464, 562-575`
**Issue:** Both compute `setRowsByWE({ ...rowsByWE, [weId]: ... })` from the `rowsByWE` captured in the render closure, whereas the async insert paths (`handleLogSet` line 542, `handleAcceptWarmup` line 609) correctly use the functional `setRowsByWE((prev) => ...)`. Mixing the two forms is fragile: if a closure-based update and a resolving async functional update land in the same batch (e.g. add-set tapped while a `✓` insert is mid-flight), the closure form can clobber the concurrently-committed change, dropping a row's `setId` or an appended set.
**Fix:** Convert both to the functional form:
```ts
setRowsByWE((prev) => ({ ...prev, [weId]: (prev[weId] ?? []).map(...) }));
```

### WR-07: `startWorkoutFromTemplate` writes a `templateId` even when the template no longer exists

**File:** `db/templates.ts:361-372`
**Issue:** `startWorkout(db, { templateId })` is called before/independently of the `if (detail)` check. If `loadTemplateDetail` returns `undefined` (template deleted between the home-list load and the tap), the workout is still created with `templateId` pointing at a nonexistent template and with zero exercises. Downstream, `active-workout` `loadAll` (`[workoutId].tsx:227`) will `loadTemplateDetail` that dangling id, get `undefined`, and silently fall through — but the workout row now carries a dangling FK-like reference. This is the exact "dangling `workouts.template_id`" hazard the module's own header comment (lines 15-17) warns about for the delete path.
**Fix:** Only stamp `templateId` when the template was actually found, or bail out early:
```ts
const detail = await loadTemplateDetail(db, templateId);
if (!detail) throw new Error('Template no longer exists');
const workout = await startWorkout(db, { templateId });
```

## Info

### IN-01: Active-workout elapsed label has no hours component (`90:00`)

**File:** `app/active-workout/[workoutId].tsx:435-444`
**Issue:** `elapsedLabel` only formats `minutes:seconds`, so a 90-minute session renders `90:00`. This is inconsistent with the summary screen's `H:MM` handling (`summary.tsx:56-60`) for the same underlying duration.
**Fix:** Add an hours component once `minutes >= 60`, matching the summary formatter (and ideally share one formatter between the two screens).

### IN-02: `UNCATEGORIZED_KEY` sentinel can collide with a real folder named `__uncategorized__`

**File:** `app/(tabs)/index.tsx:49, 186, 355`
**Issue:** The expanded-state map keys named folders by their raw string and the null bucket by `'__uncategorized__'`. A user-created folder literally named `__uncategorized__` would share the key and toggle collapse/expand together with the Uncategorized bucket. Extreme edge, but the sentinel is user-reachable free text.
**Fix:** Key the map by a non-string-collidable value (e.g. keep folder keys namespaced like `f:${folder}` and the null bucket as `uncategorized`), so no real folder name can alias the sentinel.

### IN-03: `notify`, `workoutLabel`, and `durationMsFor` are duplicated across screens

**File:** `app/(tabs)/index.tsx:56-72`, `app/active-workout/summary.tsx:36-51`, `app/active-workout/[workoutId].tsx:85-89`
**Issue:** `notify()` is copied verbatim into at least three files (acknowledged in comments), and `workoutLabel`/date-formatting logic is re-implemented in both `index.tsx` and `summary.tsx`. Divergence risk as formatting rules evolve (see IN-01/WR-05).
**Fix:** Extract shared `lib/notify.ts` and a `lib/formatWorkout.ts` (label + duration) and import them; the per-file duplication is a deliberate current convention but is accreting drift-prone copies.

### IN-04: Workout-home template counts issue one `loadTemplateDetail` per template on every focus

**File:** `app/(tabs)/index.tsx:166-193`
**Issue:** For each template in each folder group, a full `loadTemplateDetail` round-trip runs solely to read `exercises.length`, on every screen focus. This is a maintainability/scaling smell (an N+1 access pattern) even setting aside raw performance: the count belongs in the grouped query.
**Fix:** Extend `loadTemplatesGroupedByFolder` (or add a lightweight count query) to return `exerciseCount` per template so the screen renders directly without per-row detail loads.

### IN-05: Drag-to-reorder can't drop a card below the last position on overshoot

**File:** `app/active-workout/[workoutId].tsx:814-839`
**Issue:** The target index is chosen by finding the card whose `[y, y+height)` band contains `draggedCenterY`. If the user overshoots below the last card's band, no band matches, `targetIndex` stays `fromIndex`, and the reorder is silently dropped — the intuitive "drag past the bottom to move last" gesture no-ops.
**Fix:** Clamp: if `draggedCenterY >= lastCard.y + lastCard.height`, set `targetIndex = entries.length - 1`; symmetrically clamp to `0` when above the first band.

---

_Reviewed: 2026-07-22T13:34:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
