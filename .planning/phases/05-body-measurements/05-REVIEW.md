---
phase: 05-body-measurements
reviewed: 2026-07-23T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - app/(tabs)/settings.tsx
  - app/_layout.tsx
  - app/measurements/[metric].tsx
  - app/measurements/_layout.tsx
  - app/measurements/entry.tsx
  - app/measurements/index.tsx
  - app/stats/[exerciseId].tsx
  - components/HistoryRow.tsx
  - components/MetricRow.tsx
  - db/measurements.crud.test.ts
  - db/measurements.ts
  - db/migrations.test.ts
  - db/schema.test.ts
  - db/schema.ts
  - db/seed/runSeed.ts
  - db/seed/seedVersion.ts
  - drizzle/0003_awesome_fat_cobra.sql
  - drizzle/meta/0003_snapshot.json
  - drizzle/meta/_journal.json
  - drizzle/migrations.js
  - lib/dateRange.test.ts
  - lib/dateRange.ts
  - lib/lengthUnits.test.ts
  - lib/lengthUnits.ts
  - lib/measurementMetrics.test.ts
  - lib/measurementMetrics.ts
  - lib/measurementSeries.test.ts
  - lib/measurementSeries.ts
findings:
  critical: 1
  warning: 4
  info: 4
  total: 9
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-23
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Phase 05 (Body Measurements) is a well-structured feature: the DB layer is
uniformly parameterized (no injection surface), every numeric value and date
string is guarded before a write, custom-metric keys are sanitized, and free
text is trimmed/length-capped. Security posture is clean — no hardcoded
secrets, no `eval`, no raw SQL, no unsafe deserialization. The pure lib
modules (`measurementSeries`, `lengthUnits`, `dateRange`, `measurementMetrics`)
are correct and well-tested.

The defects that remain are concentrated in **date/timezone handling** and
**error surfacing at save time**. The most serious is a data-correctness bug:
"today" is computed from a UTC calendar date, which misdates readings by a full
day for users in non-UTC timezones — including the project owner (India,
UTC+5:30) during early-morning gym sessions. There is also no user feedback
when a validation guard rejects an out-of-range value: the save silently
no-ops. Neither is a security issue, but both erode the "fast, offline, never
lose data / never confuse the user" core value.

No structural-findings substrate was provided with this task, so all findings
below are from direct narrative review.

## Critical Issues

### CR-01: Readings are dated from a UTC calendar day, misdating them by ±1 day in non-UTC timezones

**File:** `app/measurements/entry.tsx:44-46`, `app/measurements/index.tsx:71-73`, `db/measurements.ts:62-73`

**Issue:** `todayISO()` (and `assertValidMeasuredAt`'s "today") is derived from
`new Date().toISOString().slice(0, 10)`, which is the **UTC** calendar date,
not the user's local date. The write path stamps `measuredAt` with this value
(quick weigh-in: `index.tsx:165`; single/session entry defaults:
`entry.tsx:104,136`), and the calendar's `selectableDays` caps at the same UTC
date (`entry.tsx:185-196`).

Consequences in the owner's timezone (UTC+5:30) and any UTC+ region: between
local midnight and the offset hour (e.g. 00:00–05:30 in India), `toISOString()`
still reports the previous UTC day. A weigh-in taken at 05:00 for a morning
workout is stored as **yesterday**, and the actual local "today" is not even
offered as selectable in the calendar. Symmetrically, UTC− users (e.g. US
Pacific) logging in the evening get readings stamped **tomorrow**. The
`loggedToday` check (`index.tsx:147`) uses the same UTC basis, so the UI stays
internally self-consistent while writing the wrong date — making the corruption
silent. This directly contradicts the timezone-safety awareness already
encoded in `formatDateLabel`'s "never `new Date(iso)`" comments elsewhere in
the same files.

**Fix:** Compute the local calendar date instead of the UTC one, in a single
shared helper, and use it everywhere "today" is needed for storage/validation:
```ts
// lib/localDate.ts (shared)
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```
Replace the three `todayISO()` definitions and the `today` computation in
`assertValidMeasuredAt` with this helper so stored `measuredAt`, the
future-date guard, and `selectableDays` all agree on the user's local day.
(Note: this UTC-slice pattern appears to be inherited from earlier phases —
fixing it centrally is preferable to a measurements-only patch.)

## Warnings

### WR-01: Validation-guard throws at save time are unhandled — invalid input silently no-ops with no user feedback

**File:** `app/measurements/entry.tsx:259-307`, `app/measurements/index.tsx:163-168, 174-186`

**Issue:** `handleSave` (and `handleWeighInDone` / `handleSaveCustomMetric`)
call into `updateReading` / `insertReadingsForDate` / `upsertReadingForDate`,
which run `assertValidMeasurementValue`. That guard **throws** for reachable
inputs: a percent metric > 100, a length reading that converts to > 300 cm
(e.g. ~118 in), or a body weight > 1000 kg. The buttons invoke the handler as
`() => void handleSave()` (`entry.tsx:393`) / `onDone={(v) => void handleWeighInDone(v)}`
(`index.tsx:288`), so a thrown error becomes an unhandled promise rejection:
the screen does not navigate back, nothing is written, and the user gets **no
error message**. For a "fast in the gym" tool this reads as a dead Save button.

**Fix:** Wrap the write in try/catch and surface the failure:
```ts
try {
  await insertReadingsForDate(db, date, entries);
  router.back();
} catch (e) {
  Alert.alert('Could not save', e instanceof Error ? e.message : 'Please check the value and try again.');
}
```
Apply the same pattern to the weigh-in and custom-metric handlers.

### WR-02: Stats chart range filter drops points that fall exactly on the cutoff day (off-by-one)

**File:** `app/stats/[exerciseId].tsx:121-127`

**Issue:** `rangeFilteredPoints` compares `p.date >= cutoff`, where `p.date` is
a date-only `YYYY-MM-DD` string but `cutoff` is the **full ISO timestamp**
returned by `rangeCutoffISO` (`lib/dateRange.ts:21`, `.toISOString()`). String
comparison of `"2026-04-23"` against `"2026-04-23T14:30:00.000Z"` treats the
shorter (prefix) string as *less than*, so a data point dated exactly on the
boundary day is excluded from the 3M/1Y window. The sibling measurements screen
correctly avoids this by slicing first (`app/measurements/[metric].tsx:125-126`,
`const cutoffDate = cutoff.slice(0, 10); ... p.date >= cutoffDate`). The stats
screen was not updated to match.

**Fix:** Mirror the measurements screen — slice the cutoff to a date before
comparing:
```ts
const cutoffDate = cutoff.slice(0, 10);
return allPoints.filter((p) => p.date >= cutoffDate);
```

### WR-03: `formatRelativeDate` fallback shifts the displayed date by a day in UTC− timezones

**File:** `app/measurements/index.tsx:89`

**Issue:** The ">= 7 days ago" fallback returns
`new Date(measuredAt).toLocaleDateString(...)`. `measuredAt` is a date-only
`YYYY-MM-DD` string, which `new Date(...)` parses as **UTC midnight**;
`toLocaleDateString` then renders it in local time. In any negative-UTC-offset
timezone this displays the *previous* calendar day (e.g. `"2026-07-01"` shows
as "Jun 30, 2026"). This is precisely the pitfall that `formatDateLabel` in
`[metric].tsx:37-42` and `entry.tsx:48-53` documents and deliberately avoids by
splitting the string and using the local `Date(y, m-1, d)` constructor — the
index screen's caption path was not given the same treatment.

**Fix:** Reuse the same local-parse formatter the sibling screens already use
instead of `new Date(measuredAt)`:
```ts
const [y, m, d] = measuredAt.split('-').map(Number);
return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
```

### WR-04: `insertReadingsForDate` fires `db.transaction(...)` without returning/awaiting it

**File:** `db/measurements.ts:253-264`

**Issue:** The function is `async`, but the `db.transaction((tx) => { ... })`
call is neither `await`ed nor `return`ed. The inline comment argues this is
safe because both the better-sqlite3 and expo-sqlite Drizzle drivers execute
synchronously (`resultKind: "sync"`), and today that holds. But the function's
own signature accepts `BaseSQLiteDatabase<'async' | 'sync', ...>`
(`db.ts:25`) — for any async driver, `transaction` returns a promise and the
function would resolve *before the writes commit*, so the caller's
`await insertReadingsForDate(...)` → `router.back()` → focus-reload could read
stale data or lose the write. This is a latent correctness landmine guarded
only by a driver-implementation detail.

**Fix:** `return db.transaction((tx) => { ... })` (Drizzle's transaction is
overloaded to accept a sync callback and returns a value/promise), so the
`async` wrapper actually awaits completion regardless of driver kind.

## Info

### IN-01: Single-metric "+ Add a reading" silently replaces an existing same-day reading

**File:** `app/measurements/entry.tsx:273-284`, `app/measurements/[metric].tsx:139-141`

**Issue:** "+ Add a reading" pushes to `entry?metric=X` with no date (defaults
to today), and single-metric save routes through `insertReadingsForDate`, which
**upserts** by `(metric, date)`. If a reading already exists for that metric
today, entering a new value overwrites it rather than adding a second reading.
This matches the one-point-per-date data model (D-12), but the "Add" wording
does not signal replacement, and there is no confirmation. Consider labeling or
confirming when an existing same-day value will be overwritten.

### IN-02: Editing a reading's date can create two rows sharing `(metric, measuredAt)`, visible only in the history list

**File:** `db/measurements.ts:161-176`, `app/measurements/[metric].tsx:227-241`

**Issue:** `updateReading` changes `measuredAt` in place with no dedup. Editing
reading A's date to collide with reading B's date leaves two rows on the same
day. `buildMeasurementSeries` and the hero card resolve this to the highest-id
row, but the history list renders **all** rows (`[...readings].reverse().map`),
so the user sees two entries for one date while the chart plots one — a
confusing inconsistency. Consider upserting (delete/replace the colliding row)
on date-edit, or de-duplicating the history list the same way the series does.

### IN-03: Edit mode proceeds to a no-op `updateReading(value: 0)` when the target reading is missing

**File:** `app/measurements/entry.tsx:124-134, 259-271`

**Issue:** If `isEdit` is true but the reading is not found in `load()` (e.g.
deleted on another screen before focus), `values` stays empty and `date` keeps
its default. `handleSave` still runs the edit branch, computing
`values.get(metricParam) ?? 0` and calling `updateReading` with value `0`
against a non-existent id. Today this is harmless (0 rows updated, `updated`
is `undefined`, then `router.back()`), but it relies on that no-match behavior
rather than guarding explicitly. Add an early `router.back()` when the reading
was not loaded.

### IN-04: `handleAddReading` interpolates `metricKey` into a route string without encoding

**File:** `app/measurements/[metric].tsx:139-145`

**Issue:** `router.push(\`/measurements/entry?metric=${metricKey}\`)` interpolates
the metric key directly. It is currently safe because `deriveMetricKey`
(`index.tsx:51-68`) restricts keys to `[a-z0-9_]`, so no query-breaking
characters can occur. Flagged only as a defensive note: if the key-derivation
rules ever loosen, prefer `encodeURIComponent(metricKey)` to keep the query
param well-formed.

---

_Reviewed: 2026-07-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
