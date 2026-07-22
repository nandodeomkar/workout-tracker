---
phase: 03-templates-folders-calculators
reviewed: 2026-07-22T14:10:00Z
depth: standard
scope: gap-closure (plans 03-07, 03-08; diff base 2433604)
files_reviewed: 5
files_reviewed_list:
  - components/TemplateRow.tsx
  - app/(tabs)/index.tsx
  - db/workouts.ts
  - db/workouts.crud.test.ts
  - app/active-workout/[workoutId].tsx
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 03: Code Review Report (Gap Closure 03-07 / 03-08)

**Reviewed:** 2026-07-22T14:10:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

This is a **gap-closure review** scoped strictly to the diff since base `2433604`
(gap plans 03-07 / 03-08, commits da70a70 … b618e49). Pre-existing phase-03 code was
reviewed previously; only the new changes are in scope here:

- **TemplateRow.tsx** — new optional `onEdit` prop rendering an edit button (UAT Gap 1).
- **app/(tabs)/index.tsx** — wires `onEdit` to `router.push('/templates/[templateId]')` (route verified to exist).
- **db/workouts.ts** — new `deleteSet(db, setId)` (Gap 3 / D-01 un-log).
- **app/active-workout/[workoutId].tsx** — re-tapping ✓ on a logged set now un-logs it (`deleteSet` + revert the row to pending), and logging a warm-up set no longer starts the rest timer (Gap 2).
- **db/workouts.crud.test.ts** — DB-layer coverage for `deleteSet`.

**Overall assessment:** The DB change is clean. `deleteSet` is parameterized (no injection surface), targets exactly one row by integer PK, and is adequately tested (targeted-delete-leaves-siblings + crash-safe re-read). The warm-up timer-skip (`mode === 'logging' && !row.isWarmup`) is correct and consistent with `handleAcceptWarmup`. The un-log state transition preserves weight/reps for re-logging and uses a functional `setRowsByWE` update, so it is race-safe against itself. No BLOCKER-level defects were found in the gap changes.

The findings below concern an accessibility regression introduced by the new edit button, a re-entrancy hazard the new ✓ toggle makes easier to hit, and two lower-severity robustness issues.

No `<structural_findings>` block was provided, so this report contains only narrative findings.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Edit button nested inside the row Pressable breaks screen-reader access

**File:** `components/TemplateRow.tsx:22-49`
**Issue:** The new edit `Pressable` (lines 38-47) is a child of the outer row `Pressable` (line 23), which already declares `accessibilityRole="button"` and an `accessibilityLabel`. Nesting an interactive button inside a button is an accessibility anti-pattern: on Android TalkBack the outer element is announced as a single focusable button ("{label}, N exercises"), and the inner "Edit {label}" button is typically merged/suppressed, so screen-reader users cannot reach the edit action this gap was added to provide. The component otherwise invests in a11y (explicit 44×44 target, role + label), so this regresses against that bar.

Functionally, RN's touch-responder system means the inner press wins and the outer `onPress` does **not** fire, so a sighted tap on Edit will not accidentally start a workout via `handlePickTemplate` — the defect is limited to assistive-tech reachability, not incorrect navigation.

**Fix:** Make the row container a plain `View` and render the tappable body and the edit button as siblings so neither is nested inside the other:
```tsx
<View style={styles.row}>
  <Pressable onPress={onPress} accessibilityRole="button"
             accessibilityLabel={`${label}, ${exerciseLabel}`} style={styles.body}>
    <Text style={styles.icon}>📋</Text>
    <View style={styles.textColumn}>{/* name + caption */}</View>
  </Pressable>
  {onEdit ? (
    <Pressable onPress={onEdit} accessibilityRole="button"
               accessibilityLabel={`Edit ${label}`} style={styles.editButton}>
      <Text style={styles.editButtonText}>✎</Text>
    </Pressable>
  ) : null}
  <Text style={styles.chevron}>›</Text>
</View>
```

### WR-02: `handleLogSet` has no re-entrancy guard — the new ✓ toggle makes a double-tap phantom-set race easier to trigger

**File:** `app/active-workout/[workoutId].tsx:515-586`
**Issue:** Gap 3 turns the ✓ checkmark into a toggle (log ⇄ un-log), so repeatedly tapping the same checkmark is now an intended interaction. `handleLogSet` reads `row.setId` from the render closure and is not guarded against concurrent invocation. On a *pending* row, a fast double-tap can fire two `insertSet` calls before the first `setRowsByWE` commits (both observe `setId == null`). Both inserts persist a `sets` row, but the second state update overwrites the first `created.id`, so the UI tracks only one. The first inserted row becomes an **untracked phantom set** that inflates working-set volume / PR detection and can never be un-logged from the UI. (The delete branch is safe: a second `deleteSet` on the same id is a harmless no-op — only the insert branch is exposed.)
**Fix:** Guard the handler against re-entry per row:
```ts
const inFlight = useRef<Set<string>>(new Set());
async function handleLogSet(weId: number, rowKey: string) {
  if (inFlight.current.has(rowKey)) return;
  inFlight.current.add(rowKey);
  try { /* existing body */ } finally { inFlight.current.delete(rowKey); }
}
```

## Info

### IN-01: `Date.now()`-based row key can collide on same-millisecond un-log

**File:** `app/active-workout/[workoutId].tsx:544` (shares the pattern with `handleAddSet` at 592)
**Issue:** Un-logging rewrites the row key to `p-${weId}-${Date.now()}`. If two rows on the same card are un-logged (or a row is un-logged while a set is added) within the same millisecond, the generated keys collide, producing duplicate React keys and possible mis-reconciliation of row state (a re-render swapping which row shows which weight/reps). Low probability, but the collision surface is new with the un-log path.
**Fix:** Add a stable discriminator or a monotonic counter ref, e.g. `p-${weId}-${row.setNumber}-${keySeq.current++}`.

### IN-02: Un-log leaves a dangling keypad/calculator target when it re-keys a row

**File:** `app/active-workout/[workoutId].tsx:536-548`
**Issue:** `editingTarget` and `openSheet` reference a row by `rowKey`. When an un-log rewrites that row's `key`, an open keypad (`editingRow` lookup, 491-493) or calculator sheet (`openSheetRow`, 892-894) for the same row silently resolves to `undefined`, falling back to `initialValue` 0 / `undefined` prefill instead of tracking the row. It degrades gracefully rather than crashing, and requires an unlikely simultaneous interaction, but the target is left dangling rather than cleared.
**Fix:** When re-keying a row during un-log, clear `editingTarget`/`openSheet` if they point at the affected `rowKey` (or key those targets by a stable id rather than the mutable `key`).

---

_Reviewed: 2026-07-22T14:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (gap-closure scope)_
