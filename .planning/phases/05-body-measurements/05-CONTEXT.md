# Phase 5: Body Measurements - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Body measurement logging and trend graphs, **independent of the workout-logging core** (depends only on Phase 1's data foundation). Delivers two things (MEAS-01, MEAS-02):

1. **Log** body weight and body-part measurements, each with a date.
2. **View** measurement history as trend graphs over time.

Everything lives in one self-contained Measurements surface. No changes to workout logging, stats/PR feed, programs, or backup. This is a read-and-write feature over the existing `body_measurements` table — not a derived/read-only stats layer.

</domain>

<decisions>
## Implementation Decisions

### Metric set
- **D-01:** Ship the **full StrengthLog-style metric set** built-in: body **weight** plus **neck, shoulders, chest, waist, hips, biceps (L/R), forearm (L/R), thigh (L/R), calf (L/R)**. Left/right paired parts are separate metrics.
- **D-02:** **Custom metrics are supported** — the user can add a free-form named metric (e.g. "body fat %", "left ankle"). The `body_measurements.metric` column is already free text, so a new custom metric costs no schema change *for the reading itself* — but see D-06 (its unit type must be persisted somewhere).
- **D-03:** Each metric has a **unit type**: `weight` (body weight), `length` (body parts), or `percent` (body-fat %-style). Body-fat % is an optional built-in or a natural custom metric — planner's discretion whether to seed it.

### Units
- **D-04:** **Length metrics use a separate cm/in setting**, independent of the existing weight kg/lb setting (LOG-06). This allows mixed preferences (e.g. lb + cm). Adds one new settings row + one new setting key.
- **D-05:** **Canonical storage, convert on display** — matching the weights convention (D-16 from Phase 4): store weight in **kg**, length in **cm**, percent **as-is**; convert to the user's display unit only in the UI. Flipping a unit setting never rewrites stored data.
- **D-06:** Because custom metrics (D-02) can be any unit type, **each metric's unit type must be persisted** so the app knows how to store/convert/label it. Built-in metrics can carry a hardcoded unit type in a code-side registry; **custom metrics need their unit type saved** (candidate approaches for the planner: an additive migration adding a metric-definitions table or a `unit_type` column, vs. a settings-backed registry). See research flags.

### Entry flow
- **D-07:** **One dedicated Measurements screen** holds the whole feature: per metric it shows the latest value, its trend graph, the history list, and add/edit/delete. Log-and-see-progress in one place (StrengthLog "Body" section feel). Chosen over the design-spec's split (graph-on-Stats + entry-in-Settings) for cohesion in this self-contained phase.
- **D-08:** **Two entry models, both supported:** (a) a **quick weigh-in** fast path for logging today's body weight, and (b) an **"add measurements" dated session** where the user enters weight + any body parts together for a single date (blank fields skipped).
- **D-09:** **Full correction control** — past readings can be **edited and deleted**. New readings **default to today's date but are back-datable**. A fat-fingered weigh-in must not permanently poison the trend graph.

### Navigation / placement
- **D-10:** The Measurements screen is reached via a **"Body Measurements" row in the Settings/More tab** (per design spec line 101). The existing 5-tab layout is left untouched — Phase 8 owns any tab-level changes.

### Trend graph
- **D-11:** Graphs are a **per-metric line over time** — one metric shown at a time, selected via a picker. **Reuse Phase 4's chart chrome**: `buildChartSeries`/`ChartPoint` shape, the victory-native XL line, **range chips (3M / 1Y / All)**, and the sparse/single-point handling built in 04-07. Consistent look, minimal new charting code.
- **D-12:** Measurement points are already **one value per date** (unlike sets, which Phase 4 aggregates per workout) — the series build for measurements is simpler than the exercise charts; mirror the shape, not necessarily the aggregation.

### Claude's Discretion
- Whether body-fat % ships as a seeded built-in or only as a user-added custom metric (D-03).
- The exact persistence design for per-metric unit type (D-06) — planner picks migration-vs-registry after confirming what's cleanest against the existing schema.
- Placement/affordance of the quick-weigh-in fast path (D-08), empty-state and sparse-data copy/visuals (reuse Phase 4 patterns), metric ordering/grouping on the Measurements screen, and chart colors within the dark-first `theme.ts` palette.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Body Measurements — **MEAS-01** (log weight + body parts with date), **MEAS-02** (view history as graphs).
- `.planning/ROADMAP.md` §"Phase 5: Body Measurements" — goal + 2 success criteria. Depends on Phase 1.

### Approved design spec
- `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — full approved design. Relevant lines: **§data model line 80** (`body_measurements   id, metric (weight|chest|waist|...), value, measured_at`), **§Screens line 100** (measurement graphs on Stats), **line 101** (measurements entry under Settings/More), **line 133** (body log under Measurements & utilities). Note: D-07 intentionally consolidates the split spec layout into one screen; the Settings entry point (D-10) still follows the spec.

### Prior phase context (chart infra to reuse)
- `.planning/phases/04-stats-charts/04-CONTEXT.md` — D-16 (kg-canonical, display-unit convert), D-06/D-07 (range-chip + one-point-per-entry chart discipline), D-18 (victory-native XL install). The Phase 4 charting stack is the direct model for MEAS-02.

### Stack & tooling
- `CLAUDE.md` §Technology Stack — victory-native 41.26.0 + @shopify/react-native-skia 2.9.0 (already installed in Phase 4), victory XL API caveat (NOT legacy v36), Vitest-for-pure-logic-only, better-sqlite3 in-memory for DB tests, additive-migration discipline (Phase 1 FNDN-02 pattern).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`db/schema.ts` → `bodyMeasurements`** — table **already exists** from Phase 1 scaffold: `{ id, metric (text), value (real), measured_at (text) }` (EAV shape). Types `BodyMeasurement` / `NewBodyMeasurement` already exported. Reading (MEAS-01) may need no migration; **D-06 unit-type persistence may require an additive migration** — decide at plan time.
- **`lib/chartSeries.ts`** — `buildChartSeries(sets, metric)` + `ChartPoint`/`ChartSet` interfaces. Reuse the `ChartPoint` shape and victory rendering for MEAS-02; measurement series is simpler (one value per date).
- **`app/stats/[exerciseId].tsx`** — the per-exercise chart screen: `RangeOption = '3M' | '1Y' | 'All'`, `rangeCutoffISO()`, victory-native line, single-point Scatter + sparse caption (04-07). **Closest analog to mirror** for the measurement trend graph.
- **`components/MetricToggle.tsx`** — segmented toggle component; reusable as the metric picker on the Measurements screen.
- **`lib/weightUnits.ts`** — `kgToDisplay(kg, unit)` / `displayToKg(value, unit)` for weight. **Reuse for the weight metric.** A parallel **`lib/lengthUnits.ts` (cm↔in)** is a new pure lib to add (test with vitest).
- **`db/settings.ts`** — `getSetting(db, key)` / `setSetting(db, key, value)` key/value helpers. Add the new **length-unit setting key** here.

### Established Patterns
- **Two-driver testing:** same `sqlite-core` schema runs against `drizzle-orm/expo-sqlite` (device) and `drizzle-orm/better-sqlite3` (Node/vitest). New measurement queries + the cm/in converter are unit-testable in-memory.
- **Pure-lib + data-layer split:** unit math (cm↔in) as a pure `lib/*.ts` with vitest; DB reads/writes in a new `db/measurements.ts` alongside `db/workouts.ts` (follow its driver-agnostic `AnyDrizzleDb` signature).
- **Theme tokens:** dark-first `theme.ts` for all colors/spacing/typography.
- **expo-router pushed routes:** mirror `app/stats/[exerciseId].tsx` for a new `app/measurements/` route (or a `[metric]` detail); the Settings tab (`app/(tabs)/settings.tsx`) is the entry point.
- **Additive migration discipline:** if D-06 needs schema, follow the Phase 1 FNDN-02 additive-migration + populate→upgrade→data-intact test pattern.

### Integration Points
- **New:** `db/measurements.ts` (CRUD + history queries), `lib/lengthUnits.ts` (cm↔in), `app/measurements/*` (dedicated screen + graph), a metric registry (built-in metrics + unit types).
- **Modified:** `app/(tabs)/settings.tsx` — add "Body Measurements" navigation row (D-10) + a length-unit (cm/in) settings row (D-04). `db/settings.ts` — new setting key.
- **No charting install needed** — victory-native + Skia already present from Phase 4.

</code_context>

<specifics>
## Specific Ideas

- Reference feel is **StrengthLog's "Body" section** (a paywalled feature this project makes free): a list of measurements, each opening to a trend graph + a dated log, weigh-in quick-add, back-datable entries. Clone the *behavior* only — none of the branding, assets, or copy (legal constraint).

</specifics>

<deferred>
## Deferred Ideas

- **Measurement graphs as a section on the Stats tab** — the design spec (line 100) envisioned this; D-07 consolidated into a dedicated screen instead. A cross-link or Stats-tab card could be reconsidered during the Phase 8 UI/navigation audit if discoverability proves weak.
- **Progress photos / body-composition scans / measurement reminders** — richer body-tracking features not in MEAS-01/02 scope; their own future phase if ever wanted.

### Research flags (for gsd-phase-researcher / gsd-planner)
- **Unit-type persistence (D-06):** decide the cleanest way to persist per-metric unit type for free-form custom metrics against the existing `body_measurements` EAV table — additive migration (metric-definitions table or `unit_type` column) vs. a code registry for built-ins plus a stored type for customs. Confirm whether MEAS-01/02 can ship without a migration or not.
- **`measured_at` granularity:** confirm date-only vs full timestamp for readings, and how multiple readings on the same date are handled in the trend graph (latest wins vs plot both). Align with the Phase 4 one-point-per-entry discipline.
- **Metric registry values:** define the canonical built-in metric list + display order + unit types (D-01/D-03) as the single source both entry and graph read from.

</deferred>

---

*Phase: 5-Body Measurements*
*Context gathered: 2026-07-23*
