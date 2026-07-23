# Phase 5: Body Measurements - Research

**Researched:** 2026-07-23
**Domain:** Local-first CRUD + chart feature over an existing (unused) SQLite EAV table, in a React Native + Expo + Drizzle app that already has an identical charting stack built in Phase 4.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Metric set**
- **D-01:** Ship the full StrengthLog-style metric set built-in: body weight plus neck, shoulders, chest, waist, hips, biceps (L/R), forearm (L/R), thigh (L/R), calf (L/R). Left/right paired parts are separate metrics.
- **D-02:** Custom metrics are supported — the user can add a free-form named metric (e.g. "body fat %", "left ankle"). The `body_measurements.metric` column is already free text, so a new custom metric costs no schema change for the reading itself — but see D-06 (its unit type must be persisted somewhere).
- **D-03:** Each metric has a unit type: `weight` (body weight), `length` (body parts), or `percent` (body-fat %-style). Body-fat % is an optional built-in or a natural custom metric — planner's discretion whether to seed it.

**Units**
- **D-04:** Length metrics use a separate cm/in setting, independent of the existing weight kg/lb setting (LOG-06). This allows mixed preferences (e.g. lb + cm). Adds one new settings row + one new setting key.
- **D-05:** Canonical storage, convert on display — matching the weights convention (D-16 from Phase 4): store weight in kg, length in cm, percent as-is; convert to the user's display unit only in the UI. Flipping a unit setting never rewrites stored data.
- **D-06:** Because custom metrics (D-02) can be any unit type, each metric's unit type must be persisted so the app knows how to store/convert/label it. Built-in metrics can carry a hardcoded unit type in a code-side registry; custom metrics need their unit type saved (candidate approaches for the planner: an additive migration adding a metric-definitions table or a `unit_type` column, vs. a settings-backed registry). See research flags.

**Entry flow**
- **D-07:** One dedicated Measurements screen holds the whole feature: per metric it shows the latest value, its trend graph, the history list, and add/edit/delete. Log-and-see-progress in one place (StrengthLog "Body" section feel). Chosen over the design-spec's split (graph-on-Stats + entry-in-Settings) for cohesion in this self-contained phase.
- **D-08:** Two entry models, both supported: (a) a quick weigh-in fast path for logging today's body weight, and (b) an "add measurements" dated session where the user enters weight + any body parts together for a single date (blank fields skipped).
- **D-09:** Full correction control — past readings can be edited and deleted. New readings default to today's date but are back-datable. A fat-fingered weigh-in must not permanently poison the trend graph.

**Navigation / placement**
- **D-10:** The Measurements screen is reached via a "Body Measurements" row in the Settings/More tab (per design spec line 101). The existing 5-tab layout is left untouched — Phase 8 owns any tab-level changes.

**Trend graph**
- **D-11:** Graphs are a per-metric line over time — one metric shown at a time, selected via a picker. Reuse Phase 4's chart chrome: `buildChartSeries`/`ChartPoint` shape, the victory-native XL line, range chips (3M / 1Y / All), and the sparse/single-point handling built in 04-07. Consistent look, minimal new charting code.
- **D-12:** Measurement points are already one value per date (unlike sets, which Phase 4 aggregates per workout) — the series build for measurements is simpler than the exercise charts; mirror the shape, not necessarily the aggregation.

### Claude's Discretion
- Whether body-fat % ships as a seeded built-in or only as a user-added custom metric (D-03).
- The exact persistence design for per-metric unit type (D-06) — planner picks migration-vs-registry after confirming what's cleanest against the existing schema.
- Placement/affordance of the quick-weigh-in fast path (D-08), empty-state and sparse-data copy/visuals (reuse Phase 4 patterns), metric ordering/grouping on the Measurements screen, and chart colors within the dark-first `theme.ts` palette.

### Deferred Ideas (OUT OF SCOPE)
- Measurement graphs as a section on the Stats tab — the design spec (line 100) envisioned this; D-07 consolidated into a dedicated screen instead. A cross-link or Stats-tab card could be reconsidered during the Phase 8 UI/navigation audit if discoverability proves weak.
- Progress photos / body-composition scans / measurement reminders — richer body-tracking features not in MEAS-01/02 scope; their own future phase if ever wanted.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MEAS-01 | User can log body measurements (weight, body parts) with date | `db/measurements.ts` CRUD design (Recommended Project Structure, Code Examples), `metric_definitions` additive migration resolving D-06 (Standard Stack / Architecture Patterns Pattern 1), value-bounds validation (Security Domain V5), date-only `measured_at` convention (Pitfall 5) |
| MEAS-02 | User can view measurement history as graphs | `lib/measurementSeries.ts` reduction (Code Examples, Pitfall 3), reuse of Phase 4's victory-native chart chrome verbatim (Architecture Patterns Pattern 4), unit-aware display via `lib/weightUnits.ts`/new `lib/lengthUnits.ts` (Pattern 3) |
</phase_requirements>

## Summary

Phase 5 is a self-contained, additive feature: nothing in the existing `body_measurements` table, chart stack, or settings layer needs to change shape — it needs one small additive migration (a new `metric_definitions` table), one new pure lib (`lengthUnits.ts`), one new data-layer module (`db/measurements.ts`), and two new screens. Every architectural building block it needs (seeded-vs-custom table pattern, driver-agnostic query modules, pure-lib+vitest math, victory-native XL chart chrome, kg/lb-style unit conversion, key-value settings) already exists in this codebase from Phases 1–4 and can be copied almost verbatim.

The one real design decision this phase must resolve — where per-metric unit type lives for free-form custom metrics (D-06) — has a strong answer once you look at how the codebase already solved the *exact same problem* for exercises: `exercises` is a seeded-plus-user-added table with `seed_id` (unique) + `is_custom` (bool), seeded additively via `onConflictDoNothing` and gated by a `seed_version` settings row. Body measurement metrics need precisely the same shape: a small additive migration adding a `metric_definitions` table (`metric_key` PK, `label`, `unit_type`, `is_custom`, `position`), seeded with the 15 built-ins the same way `exercises.seed.json` is seeded, with custom metrics inserted by the user at runtime. This is a proper additive migration, not a settings-JSON-blob workaround — and it directly answers CONTEXT.md's Research Flag 3 (a single source of truth both entry and graph read from) as a side effect.

**Primary recommendation:** Add one additive migration (`metric_definitions` table, mirroring `exercises`' seed_id/is_custom pattern verbatim), reuse Phase 4's chart chrome (`CartesianChart`/`Line`/`Scatter`/`MetricToggle`/range-chip pattern) unmodified for the per-metric trend graph, and store `measured_at` as a date-only (`YYYY-MM-DD`) string with a JS-side "latest row wins" reduction for same-date duplicates in the chart series (there is no session-based reduction concept to reuse from `buildChartSeries` — measurements need a much simpler parallel reducer).

## Architectural Responsibility Map

This app has no server/API/CDN tier — it is a local-first RN client with an on-device SQLite database as sole source of truth. The generic tier vocabulary collapses to two tiers that actually exist here: **Client (RN screens/components)** and **Local DB (SQLite via Drizzle)**, plus a cross-cutting **Pure lib** layer (framework-free TS, vitest-tested) that both tiers import from.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Log a dated measurement reading (MEAS-01) | Local DB (`db/measurements.ts` CRUD) | Client (`app/measurements/*` forms) | Write path must go through parameterized Drizzle inserts with value/date guards, mirroring `db/workouts.ts`'s `assertValidWeightKg`-style convention |
| Per-metric unit-type persistence (D-06) | Local DB (new `metric_definitions` table + migration) | Pure lib (`lib/measurementMetrics.ts` seed-data constants) | Built-ins are code constants seeded into the table at first run; customs are inserted at runtime — the table, not a settings blob, is the single source of truth once seeded |
| Metric registry (built-in list/order/unit types) — CONTEXT Research Flag 3 | Pure lib (`lib/measurementMetrics.ts`) feeding both DB seed data and UI ordering | Local DB (`metric_definitions.position`) | Code constants seed the DB row set; the DB row set (not the constants file) is what both the entry screen and the graph read at runtime, so post-seed edits/customs stay authoritative |
| Trend graph rendering (MEAS-02) | Client (`app/measurements/[metric].tsx`, victory-native XL) | Pure lib (`lib/measurementSeries.ts` reduction) | Identical chart-chrome tier split as `app/stats/[exerciseId].tsx` (STAT-01) |
| kg/lb and cm/in display conversion (D-04/D-05) | Pure lib (`lib/weightUnits.ts`, new `lib/lengthUnits.ts`) | Client (formatting call sites) | Canonical-storage-convert-on-display is a pure function concern, zero DB/RN imports, per `lib/weightUnits.ts`'s existing convention |
| Length-unit setting (cm/in) | Local DB (`settings` key-value table) | Client (Settings screen row) | Reuses the existing generic `db/settings.ts` k/v helper — no new table needed for this scalar preference |

## Standard Stack

### Core
No new packages are required for this phase — every dependency it needs was already installed in Phase 4.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| victory-native | 41.26.0 | Per-metric trend line chart | Already installed (Phase 4, STAT-01); XL API, not legacy v36 `[VERIFIED: package.json]` |
| @shopify/react-native-skia | 2.9.1 | Chart rendering engine victory-native depends on | Already installed; within victory-native's `>=1.2.3 <3.0.0` peer range `[VERIFIED: package.json]` |
| drizzle-orm | 0.45.2 | Schema/query layer, additive migration for `metric_definitions` | Already installed; same `sqlite-core` schema module pattern `[VERIFIED: package.json]` |
| drizzle-kit | 0.31.10 (dev) | Generates the new migration SQL from the schema change | Already installed `[VERIFIED: package.json]` |
| vitest | 4.1.10 (dev) | Pure-logic + in-memory DB tests for the new lib/db modules | Already installed and configured (`vitest.config.ts`, node environment) `[VERIFIED: package.json + vitest --version]` |
| better-sqlite3 | 12.11.1 (dev) | In-memory DB-layer tests for `db/measurements.ts` | Already installed `[VERIFIED: package.json]` |

### Supporting
No new supporting libraries needed. `@expo/vector-icons`, `expo-router`, `react-native-safe-area-context` etc. are already present and used by the reused screen patterns.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Additive `metric_definitions` table | JSON blob under a `settings` key (e.g. `custom_metrics`) | Zero migration, but `db/settings.ts`'s documented contract is "raw string values, typed fallback lives in the caller" (settings.ts:6-11) — a growing array-of-objects blob stretches that contract, has no DB-level uniqueness/type safety, and breaks the "single source both entry and graph read from" requirement (Research Flag 3) cleanly, unlike a real table. Rejected. |
| Additive `metric_definitions` table | `unit_type` column directly on `body_measurements` | Denormalizes unit type onto every reading row instead of once per metric; changing a custom metric's unit type after the fact means rewriting every historical row for that metric. Rejected. |
| victory-native XL | react-native-gifted-charts | Would be a second charting library in the app for a nearly-identical use case (single-value-over-time line); no reason to diverge from Phase 4's already-installed, already-proven stack. |

**Installation:** None required — no new packages.

**Version verification:** Confirmed against the installed `package.json` (not the training-data-only versions in CLAUDE.md's table, which are close but not byte-identical — installed skia is `2.9.1` vs CLAUDE.md's stated `2.9.0`, both satisfy victory-native's peer range).

## Package Legitimacy Audit

Not applicable — this phase installs zero new npm packages. All charting/DB/test dependencies were installed and legitimacy-checked during Phase 4 and Phase 1 respectively.

**Packages removed due to [SLOP] verdict:** none (no packages evaluated — none needed)
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐        ┌────────────────────────────────┐
│  app/(tabs)/settings.tsx    │        │  app/measurements/[metric].tsx  │
│  "Body Measurements" row ───┼───────▶│  (per-metric detail screen)     │
│  (+ new cm/in unit row,     │        │  - latest value                 │
│    D-04, own settings key)  │        │  - MetricToggle range chips     │
└─────────────────────────────┘        │    (3M/1Y/All, reused verbatim) │
                                        │  - CartesianChart+Line+Scatter  │
┌─────────────────────────────┐        │    (reused verbatim)            │
│  app/measurements/index.tsx │        │  - dated history list           │
│  (metric list + latest      │◀───────┼─ - add/edit/delete (D-09)       │
│   value + quick weigh-in    │  nav   └────────────────────────────────┘
│   fast path, D-08a)         │                     │
└──────────────┬───────────────┘                     │ read/write
               │ read/write                           ▼
               ▼                          ┌─────────────────────────────┐
┌─────────────────────────────┐          │  db/measurements.ts          │
│  lib/measurementMetrics.ts   │─seeds──▶│  - loadMetricDefinitions      │
│  (built-in metric constants, │  (via   │  - loadLatestPerMetric        │
│   D-01/D-03, single source)  │  seed)  │  - loadReadingsForMetric      │
└─────────────────────────────┘          │  - insert/update/deleteReading│
                                          │  - createCustomMetric         │
┌─────────────────────────────┐          └───────────────┬───────────────┘
│  lib/measurementSeries.ts    │◀── (Client imports for            │
│  (pure: group by metric+date,│     chart-point building)          ▼
│   latest-row-wins dedup,     │                          ┌──────────────────────┐
│   sort ascending)            │                          │ SQLite: body_        │
└─────────────────────────────┘                           │ measurements (exists)│
                                                            │ + metric_definitions │
┌─────────────────────────────┐                           │   (NEW, additive     │
│  lib/lengthUnits.ts (NEW)    │                           │   migration)         │
│  cmToDisplay / displayToCm   │                           └──────────────────────┘
└─────────────────────────────┘
```

A reader traces MEAS-01 by: Settings tab → measurements index → add-reading form → `db/measurements.ts` insert (validated, canonical units) → SQLite row. MEAS-02 traces: measurements index/detail → `loadReadingsForMetric` → `lib/measurementSeries.ts` reduction → unit conversion (`weightUnits.ts`/`lengthUnits.ts`) → victory-native chart.

### Recommended Project Structure
```
db/
├── measurements.ts          # NEW — CRUD + queries (mirrors db/workouts.ts's AnyDrizzleDb signature)
├── measurements.crud.test.ts   # NEW
lib/
├── measurementMetrics.ts    # NEW — built-in metric constants (key/label/unitType/order), seed source
├── measurementMetrics.test.ts  # NEW
├── measurementSeries.ts     # NEW — pure reduction: readings -> one point per date per metric
├── measurementSeries.test.ts   # NEW
├── lengthUnits.ts           # NEW — cm<->in, mirrors lib/weightUnits.ts convention
├── lengthUnits.test.ts      # NEW
app/
├── measurements/
│   ├── index.tsx            # NEW — metric list, latest values, quick weigh-in
│   └── [metric].tsx         # NEW — per-metric graph + history + CRUD (mirrors app/stats/[exerciseId].tsx)
app/(tabs)/settings.tsx      # MODIFIED — add "Body Measurements" nav row + length-unit setting row
db/schema.ts                 # MODIFIED — add metricDefinitions table
db/seed/runSeed.ts           # MODIFIED — additively seed built-in metric_definitions rows, bump CURRENT_SEED_VERSION
drizzle/000X_*.sql           # NEW — generated additive migration (CREATE TABLE metric_definitions)
```

### Pattern 1: Seeded-plus-custom table (mirror `exercises`)
**What:** A table with a stable unique key for built-ins, an `is_custom` flag, and additive seeding via `onConflictDoNothing`.
**When to use:** Any time built-in + user-added entities share one table and built-ins must never be duplicated or overwritten on app update.
**Example (existing precedent, verbatim from this codebase):**
```typescript
// Source: db/seed/runSeed.ts:34-47 (exercises seeding — the pattern to replicate for metric_definitions)
for (const exercise of curatedExercises) {
  await db
    .insert(exercises)
    .values({ name: exercise.name, /* ...*/, seedId: exercise.seedId, isCustom: false, archived: false })
    .onConflictDoNothing({ target: exercises.seedId });
}
```
Apply the identical shape to `metric_definitions`: `metricKey` plays the role of `seedId` (unique, conflict target), `isCustom` is `false` for the 15 built-ins and `true` for user-added ones, bump `CURRENT_SEED_VERSION` (currently `3`, see `db/seed/seedVersion.ts:10`) to `4` and extend `runSeedIfNeeded`.

### Pattern 2: Driver-agnostic query module
**What:** `AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>` typed functions, so the same module runs against `drizzle-orm/expo-sqlite` (device) and `drizzle-orm/better-sqlite3` (vitest).
**When to use:** Every new `db/*.ts` module in this codebase, no exceptions.
**Example:**
```typescript
// Source: db/settings.ts:14-26 — smallest existing example of the convention
type AnyDrizzleDb = BaseSQLiteDatabase<'async' | 'sync', any, any>;
export async function getSetting(db: AnyDrizzleDb, key: string): Promise<string | null> { /* ... */ }
```
`db/measurements.ts` must follow this exact signature convention (see `db/workouts.ts:29` / `db/stats.ts:26`).

### Pattern 3: Pure-lib canonical-storage-convert-on-display unit conversion
**What:** A pure module with two functions (`xToDisplay`, `displayToX`), canonical unit stored, display unit computed only at render time.
**Example (existing, to be mirrored for length):**
```typescript
// Source: lib/weightUnits.ts:17-30
export function kgToDisplay(weightKg: number, unit: 'kg' | 'lb'): number { /* rounds to plate increment */ }
export function displayToKg(displayValue: number, unit: 'kg' | 'lb'): number { /* ... */ }
```
`lib/lengthUnits.ts` needs the same two-function shape: `cmToDisplay(cm, unit: 'cm' | 'in')` / `displayToCm(value, unit)`. Length has no "plate-loadable" rounding concept — round to 1 decimal cm or nearest 0.25 in (StrengthLog-style tape-measure precision); this is Claude's discretion (not covered by D-04/D-05, which only lock the canonical-storage principle).

### Pattern 4: Chart screen chrome (reuse near-verbatim)
**What:** `useFocusEffect` live reload → pure JS reduction via `useMemo` → range-chip client-side filter → unit conversion at display time → `CartesianChart`/`Line`/`Scatter`.
**Example:**
```typescript
// Source: app/stats/[exerciseId].tsx:124-146 — the exact shape to mirror
const allPoints = useMemo(() => buildChartSeries(chartSets, metric), [chartSets, metric]);
const rangeFilteredPoints = useMemo(() => {
  const cutoff = rangeCutoffISO(range);
  return cutoff === null ? allPoints : allPoints.filter((p) => p.date >= cutoff);
}, [allPoints, range]);
const displayPoints = useMemo(
  () => rangeFilteredPoints.map((p) => ({ date: p.date, value: kgToDisplay(p.value, unit) })),
  [rangeFilteredPoints, unit],
);
```
`app/measurements/[metric].tsx` replaces `buildChartSeries` with the new `buildMeasurementSeries`, and swaps `kgToDisplay` for either `kgToDisplay` or `cmToDisplay` depending on the selected metric's `unitType` (percent metrics pass through unconverted).

**`rangeCutoffISO` is not exported** from `app/stats/[exerciseId].tsx` (it's a local module function, `app/stats/[exerciseId].tsx:65-76`). Either duplicate the ~10-line function locally in the new screen, or extract it to a small shared `lib/dateRange.ts` and update both screens to import it (removes duplication, touches one existing file). Recommend extraction — it's a pure, already-tested-by-usage function and the codebase has an established precedent for exactly this kind of extraction (`lib/duration.ts`, per STATE.md: "Extracted lib/duration.ts#formatDurationMs as a shared pure formatter instead of a third inline duplicate").

### Pattern 5: Single-select pill row — reuse with a caveat
`components/MetricToggle.tsx` is a generic, reusable radio-group pill row (already used for view/metric/range toggles in Phase 4). It's directly reusable for this phase's range chips (3M/1Y/All) and possibly a weight/body-part filter grouping. **Do not** use it as the primary metric selector across all ~15+ built-ins plus customs (see Common Pitfalls — Pitfall 1).

### Anti-Patterns to Avoid
- **Aggregating in SQL:** `db/stats.ts`'s header comment states the house rule explicitly: "Do NOT aggregate/MAX() in SQL here — fetch raw rows and let lib reduce them in JS." Apply the same rule to `db/measurements.ts` — fetch raw readings, reduce in `lib/measurementSeries.ts`.
- **Reimplementing kg/lb conversion inline:** never `* 2.20462` at a call site; always go through `lib/weightUnits.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chart rendering | A second charting approach or raw Skia canvas code | victory-native XL `CartesianChart`/`Line`/`Scatter` (already installed, already proven in `app/stats/[exerciseId].tsx`) | Zero new dependency, zero new API surface to learn |
| Seeded-vs-custom entity storage | A hand-rolled "is this a built-in or user string" heuristic based on metric name matching | `metric_definitions` table with `is_custom` flag, mirroring `exercises` | String-matching heuristics break the moment a user names a custom metric the same as (or similar to) a built-in label |
| kg↔lb / cm↔in conversion | Inline arithmetic at each display call site | `lib/weightUnits.ts` (existing) / `lib/lengthUnits.ts` (new, same shape) | Single formula source, already vitest-tested convention in this repo |
| Metric picker for 15+ options | A custom dropdown/modal built from scratch | A plain scrollable list (`FlatList`/`ScrollView` of rows), each row navigating to `app/measurements/[metric].tsx` — same shape as the existing exercise list (`app/(tabs)/exercises/index.tsx`) | `MetricToggle` is a horizontal pill row designed for 2-5 options; forcing 15+ into it degrades to an unusable horizontally-scrolling wall of pills |

**Key insight:** Everything this phase needs is a smaller/simpler variant of something Phase 1-4 already built. The main risk is *not* under-researching a new library — it's inventing a new pattern where an existing one already fits (e.g. building a bespoke unit-type storage scheme instead of reusing the seeded-table pattern).

## Common Pitfalls

### Pitfall 1: Reusing MetricToggle for the full metric list
**What goes wrong:** With 15 built-ins + arbitrary customs, a horizontal pill-row toggle becomes an unscannable, endlessly-scrolling strip — bad UX and accessibility regression versus the vertical list StrengthLog itself uses.
**Why it happens:** `MetricToggle` is generic and "just works" for any string union, tempting reuse everywhere without checking option count.
**How to avoid:** Use `MetricToggle` only for small, fixed option sets (3M/1Y/All range chips; possibly a weight/body-part-length grouping). Use a plain vertical list for the metric picker itself.
**Warning signs:** A pill row wider than the screen at design time with the full built-in set.

### Pitfall 2: Denormalizing unit type onto every reading row
**What goes wrong:** If `unit_type` is stored per-reading instead of per-metric, editing a custom metric's type later requires a backfill across every historical row, and a bug could let two readings of the "same" custom metric disagree on type.
**Why it happens:** It looks like the smallest possible migration (`ALTER TABLE body_measurements ADD unit_type`).
**How to avoid:** Store unit type once, on `metric_definitions`, keyed by `metric_key` — not on every `body_measurements` row.
**Warning signs:** Any query needing `GROUP BY metric, unit_type` to detect inconsistency is a sign the type lives in the wrong place.

### Pitfall 3: Treating body-measurement chart reduction like `buildChartSeries`
**What goes wrong:** `buildChartSeries` groups by *workout* and picks a session-best value (there's a clear "better" direction — heaviest weight, highest e1RM, most volume). Body measurements have no such "best" direction (a bodyweight of 90kg isn't objectively better or worse than 85kg), so copying the reduction logic verbatim would silently pick a `Math.max`/`Math.min` that makes no sense for this domain.
**Why it happens:** `lib/chartSeries.ts` is the closest and freshest precedent, inviting copy-paste.
**How to avoid:** Write a new, much simpler reducer (`lib/measurementSeries.ts`) that groups by `(metric, date)` and picks the **latest-inserted row** (highest `id`, or latest `createdAt` if you add one) when duplicates exist on the same date — not a min/max of value. CONTEXT.md D-12 explicitly says to "mirror the shape, not necessarily the aggregation."
**Warning signs:** A reducer function importing `Math.max`/`Math.min` over measurement *values* rather than picking by recency.

### Pitfall 4: Forgetting to update `db/schema.test.ts`'s `EXPECTED_TABLES` list and `db/migrations.test.ts`
**What goes wrong:** `db/schema.test.ts:5-19` hardcodes the list of tables a fresh migration must create; adding `metric_definitions` without updating this list won't fail the new table's own tests, but leaves the "all N design-spec tables" test's count/comment stale and a gap in migration-upgrade coverage (no test proves the new migration preserves an already-populated `body_measurements` table, mirroring `db/migrations.test.ts`'s existing FNDN-02-style upgrade tests).
**How to avoid:** Add `'metric_definitions'` to `EXPECTED_TABLES`, and add a new upgrade test (populate a body_measurements row at the pre-migration point, apply the new migration, assert the row survives and the new table + seeded rows exist) following the exact structure of the existing `describe('D-08: migration 0001 -> 0002...')` block in `db/migrations.test.ts:132-167`.

### Pitfall 5: Storing `measured_at` as a full timestamp when the UI only collects a date
**What goes wrong:** If the entry form only lets the user pick a date (no time), but the column stores a full `new Date().toISOString()` timestamp, two readings logged on the same calendar day at different times of day will have different string values, silently defeating any date-equality comparison used for the "latest reading per date" reduction or for detecting "already logged today."
**How to avoid:** Store `measured_at` as a plain `YYYY-MM-DD` string (no time component), consistent for all rows regardless of entry model (quick weigh-in vs dated session). This also makes `loadLatestPerMetric`'s "did the user weigh in today" check a trivial string equality against `new Date().toISOString().slice(0, 10)`.

## Code Examples

### Metric registry (single source, Research Flag 3)
```typescript
// lib/measurementMetrics.ts — NEW. Feeds BOTH the seed data inserted into
// metric_definitions AND, indirectly via the seeded rows, the entry/graph UI
// ordering (position column). This constants file is the origin of truth for
// what gets seeded; the DB table is the origin of truth for what's actually
// present (including post-seed customs) at read time.
export type UnitType = 'weight' | 'length' | 'percent';

export interface BuiltInMetric {
  metricKey: string;
  label: string;
  unitType: UnitType;
  position: number;
}

export const BUILT_IN_METRICS: BuiltInMetric[] = [
  { metricKey: 'weight', label: 'Weight', unitType: 'weight', position: 0 },
  { metricKey: 'body_fat_pct', label: 'Body Fat %', unitType: 'percent', position: 1 },
  { metricKey: 'neck', label: 'Neck', unitType: 'length', position: 2 },
  { metricKey: 'shoulders', label: 'Shoulders', unitType: 'length', position: 3 },
  { metricKey: 'chest', label: 'Chest', unitType: 'length', position: 4 },
  { metricKey: 'waist', label: 'Waist', unitType: 'length', position: 5 },
  { metricKey: 'hips', label: 'Hips', unitType: 'length', position: 6 },
  { metricKey: 'biceps_l', label: 'Biceps (L)', unitType: 'length', position: 7 },
  { metricKey: 'biceps_r', label: 'Biceps (R)', unitType: 'length', position: 8 },
  { metricKey: 'forearm_l', label: 'Forearm (L)', unitType: 'length', position: 9 },
  { metricKey: 'forearm_r', label: 'Forearm (R)', unitType: 'length', position: 10 },
  { metricKey: 'thigh_l', label: 'Thigh (L)', unitType: 'length', position: 11 },
  { metricKey: 'thigh_r', label: 'Thigh (R)', unitType: 'length', position: 12 },
  { metricKey: 'calf_l', label: 'Calf (L)', unitType: 'length', position: 13 },
  { metricKey: 'calf_r', label: 'Calf (R)', unitType: 'length', position: 14 },
];
```
`[ASSUMED]` — the metric list content itself (which parts, left/right split, body-fat % included) is drawn directly from CONTEXT.md D-01/D-02/D-03, which are locked user decisions except body-fat %'s built-in-vs-custom status, which CONTEXT.md explicitly leaves to planner's discretion (resolved here in favor of "seeded built-in").

### Additive migration for `metric_definitions`
```typescript
// db/schema.ts — MODIFIED, add alongside bodyMeasurements
export const metricDefinitions = sqliteTable("metric_definitions", {
  metricKey: text("metric_key").primaryKey(),
  label: text().notNull(),
  unitType: text("unit_type").$type<"weight" | "length" | "percent">().notNull(),
  isCustom: int("is_custom", { mode: "boolean" }).notNull().default(false),
  position: int().notNull(),
});
export type MetricDefinition = typeof metricDefinitions.$inferSelect;
export type NewMetricDefinition = typeof metricDefinitions.$inferInsert;
```
Then `npx drizzle-kit generate` produces the next-numbered migration (`0003_*.sql`, since `0000`/`0001`/`0002` already exist per `drizzle/meta/_journal.json`) containing a single additive `CREATE TABLE metric_definitions (...)` statement — no `ALTER TABLE` on any existing table, so the existing FNDN-02 upgrade-test harness (`db/test/fixture.ts#applyMigrationsUpTo`) applies unchanged.

### Seeding built-ins (mirrors `db/seed/runSeed.ts` exactly)
```typescript
// db/seed/runSeed.ts — MODIFIED
import { BUILT_IN_METRICS } from '../../lib/measurementMetrics';
// ...
for (const metric of BUILT_IN_METRICS) {
  await db
    .insert(metricDefinitions)
    .values({ ...metric, isCustom: false })
    .onConflictDoNothing({ target: metricDefinitions.metricKey });
}
```
Bump `CURRENT_SEED_VERSION` in `db/seed/seedVersion.ts` from `3` to `4` with a comment describing the addition (matches the existing v1→v2→v3 comment convention at `db/seed/seedVersion.ts:6-9`).

### Measurement series reduction (parallel to, not copied from, `buildChartSeries`)
```typescript
// lib/measurementSeries.ts — NEW
export interface MeasurementReading {
  id: number;
  metric: string;
  value: number;
  measuredAt: string; // YYYY-MM-DD
}

export interface MeasurementPoint {
  date: string;
  value: number;
}

/**
 * Groups readings for ONE metric by date, keeping the highest-id (most
 * recently inserted) row when duplicates exist on the same date — there is
 * no "best" value concept for a body measurement, unlike buildChartSeries's
 * session-best reduction for sets. Output sorted ascending by date.
 */
export function buildMeasurementSeries(readings: MeasurementReading[]): MeasurementPoint[] {
  const byDate = new Map<string, MeasurementReading>();
  for (const r of readings) {
    const existing = byDate.get(r.measuredAt);
    if (!existing || r.id > existing.id) {
      byDate.set(r.measuredAt, r);
    }
  }
  return [...byDate.values()]
    .map((r) => ({ date: r.measuredAt, value: r.value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

## State of the Art

Not applicable — this phase reuses Phase 4's charting stack, installed 1 day prior in this same project's timeline. No external ecosystem drift to account for.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Body-fat % ships as a seeded built-in metric (`unitType: percent`) rather than custom-only | Code Examples / Metric registry | Low — CONTEXT.md explicitly delegates this choice to planner's discretion; if wrong, it's a one-row seed-data change, not a schema change |
| A2 | `measured_at` should store date-only (`YYYY-MM-DD`), not a full ISO timestamp | Pitfall 5 / Standard Stack | Medium — if the planner instead wants time-of-day precision (e.g. multiple weigh-ins per day shown as distinct chart points), the "latest-wins" reduction and same-date dedup logic in `lib/measurementSeries.ts` would need to change to a "plot every point, group by date only for the *history list*" model instead |
| A3 | Same-date duplicate readings for one metric collapse to the latest-inserted row in the trend graph (not averaged, not both plotted) | Pitfall 3 / Code Examples | Low-Medium — CONTEXT.md D-12 leaves the aggregation approach open ("mirror the shape, not necessarily the aggregation"); an alternative valid reading is "average same-day values" — worth a quick confirm at plan/discuss time if not already settled |
| A4 | The Measurements feature is two screens (index list + per-metric detail), not one screen showing all metrics at once | Recommended Project Structure | Low — D-07's literal wording ("one dedicated Measurements screen... per metric it shows...") could be read as a single screen; the "Specific Ideas" section's explicit StrengthLog reference ("a list of measurements, each opening to a trend graph") is used here as the disambiguating source, and a single 15-metric-tall scroll-of-everything is impractical on a phone screen regardless |
| A5 | Length-metric rounding for display (nearest 0.1cm / nearest 0.25in) — no plate-loadable analog exists for body parts | Pattern 3 | Very low — purely cosmetic; any reasonable rounding works, not a functional risk |

## Open Questions

1. **Should same-date duplicate readings average or latest-win in the trend graph?**
   - What we know: D-09 guarantees full edit/delete control over history rows; D-12 says the series is "already one value per date" and to mirror the shape, not the aggregation, of `buildChartSeries`.
   - What's unclear: Whether "one value per date" is a description of the expected common case (users log once/day) or a hard reduction rule for the rare double-entry case.
   - Recommendation: Latest-wins (Assumption A3) is simplest and matches "the value I entered most recently is what I meant" semantics; confirm with user only if this surfaces as a real friction point in beta.

2. **Extract `rangeCutoffISO` to a shared lib, or duplicate it?**
   - What we know: The function is 10 lines, pure, and currently private to `app/stats/[exerciseId].tsx`.
   - What's unclear: Whether touching an already-shipped Phase 4 file is in-scope for a Phase 5 plan (it is additive/non-breaking either way).
   - Recommendation: Extract to `lib/dateRange.ts` — matches the `lib/duration.ts` extraction precedent and avoids a second copy of range-cutoff math to keep in sync.

## Environment Availability

No new external dependencies. All required tooling (Node, Expo CLI, EAS dev-client, victory-native/Skia native modules) was already verified and built in Phase 4; this phase adds no new native modules, so no new dev-client/EAS build is required before this phase's code can run on-device.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 `[VERIFIED: npx vitest --version]` |
| Config file | `vitest.config.ts` (node environment, `**/*.test.ts`, `watch: false`) |
| Quick run command | `npx vitest run <path/to/file>.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEAS-01 | Insert/update/delete a dated measurement reading, value bounds enforced | unit (DB-layer, in-memory) | `npx vitest run db/measurements.crud.test.ts` | ❌ Wave 0 |
| MEAS-01 | Built-in metrics seeded additively, custom metric creation persists unit type | unit (DB-layer, in-memory) | `npx vitest run db/measurements.crud.test.ts` (or a dedicated `db/measurements.definitions.test.ts`) | ❌ Wave 0 |
| MEAS-01 | Migration adds `metric_definitions` without losing existing `body_measurements` rows | migration/upgrade | `npx vitest run db/migrations.test.ts` (extend existing file with a new `describe` block) | ❌ Wave 0 (new block) |
| MEAS-01 | cm↔in pure conversion | unit (pure lib) | `npx vitest run lib/lengthUnits.test.ts` | ❌ Wave 0 |
| MEAS-02 | Build one trend point per date, latest-wins on same-date duplicates | unit (pure lib) | `npx vitest run lib/measurementSeries.test.ts` | ❌ Wave 0 |
| MEAS-02 | Metric registry constants match expected count/order/unit types | unit (pure lib) | `npx vitest run lib/measurementMetrics.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test file>`
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `db/measurements.crud.test.ts` — covers MEAS-01 (insert/update/delete + seeded/custom metric definitions)
- [ ] `lib/lengthUnits.test.ts` — covers MEAS-01 (unit conversion)
- [ ] `lib/measurementMetrics.test.ts` — covers MEAS-01/02 (registry shape)
- [ ] `lib/measurementSeries.test.ts` — covers MEAS-02 (series reduction)
- [ ] New `describe` block appended to `db/migrations.test.ts` — covers the additive `metric_definitions` migration
- [ ] Update `EXPECTED_TABLES` in `db/schema.test.ts` to include `metric_definitions` (Pitfall 4)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface in this phase (local-only feature, no accounts touched) |
| V3 Session Management | No | Not applicable — no session concept in this phase |
| V4 Access Control | No | Single-user local device, no multi-tenant/role concept anywhere in this app |
| V5 Input Validation | Yes | Numeric guards on `value` (per `unitType`: weight/length sane ranges, percent 0-100), date-format guard on `measured_at`, string length cap on custom metric `label` — mirror the existing `assertValidWeightKg`/`assertValidReps`/`assertValidName` convention in `db/workouts.ts:40-80` |
| V6 Cryptography | No | No secrets/crypto touched by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed/out-of-range numeric input reaching a DB write (e.g. negative weight, absurd length) | Tampering | Parameterized Drizzle inserts (already the house convention — never string-concatenated SQL) + explicit numeric guard functions before every insert/update, mirroring `db/workouts.ts`'s `assertValidWeightKg`/`assertValidReps` (T-02-04/T-02-15 precedent) |
| Unbounded custom metric label length | Tampering / resource exhaustion (minor, local-only) | Cap at the same `MAX_NAME_LENGTH` convention used in `db/workouts.ts:32,40-52` (`assertValidName`) |
| SQL injection via metric name or date string | Tampering | Drizzle's parameterized query builder only, per every existing `db/*.ts` module's stated security comment convention (e.g. `db/stats.ts:8-9`) — never string-interpolate `metric`/`measuredAt` into raw SQL |

## Sources

### Primary (HIGH confidence)
- `db/schema.ts`, `db/settings.ts`, `db/workouts.ts`, `db/stats.ts`, `db/seed/runSeed.ts`, `db/seed/seedVersion.ts`, `db/migrations.test.ts`, `db/schema.test.ts`, `db/test/fixture.ts` — read directly from the repository, in-repo authoritative patterns
- `lib/chartSeries.ts`, `lib/weightUnits.ts`, `lib/estimate1RM.test.ts`, `components/MetricToggle.tsx`, `app/stats/[exerciseId].tsx`, `app/(tabs)/settings.tsx`, `app/_layout.tsx`, `theme.ts` — read directly from the repository
- `drizzle/0000_cloudy_pet_avengers.sql`, `drizzle/0001_funny_impossible_man.sql`, `drizzle/0002_young_preak.sql`, `drizzle/meta/_journal.json` — read directly, confirms current migration numbering (next migration will be `0003_*`)
- `package.json` — confirmed installed versions of victory-native (41.26.0), @shopify/react-native-skia (2.9.1), drizzle-orm (0.45.2), vitest (4.1.10), better-sqlite3 (12.11.1)
- `npx vitest --version` — confirmed vitest 4.1.10 runs in this environment
- `.planning/phases/05-body-measurements/05-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/04-stats-charts/04-CONTEXT.md`, `.planning/config.json` — project decisions and prior-phase context
- `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` lines 80/100/101/133 — approved design spec references, grepped directly

### Secondary (MEDIUM confidence)
None — this phase required no external documentation lookups; every claim traces to a file read directly from this repository.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all versions read directly from `package.json`
- Architecture: HIGH — every pattern cited is grounded in a specific file:line in this repository, not external documentation
- Pitfalls: HIGH — derived from direct comparison against this codebase's own established conventions (`buildChartSeries`, `exercises` seeding, `db/schema.test.ts`), not generic domain knowledge

**Research date:** 2026-07-23
**Valid until:** Effectively indefinite for this phase (no external API/library surface to drift) — re-verify only if Phase 6/7 changes the schema module or seeding convention before Phase 5 executes.
