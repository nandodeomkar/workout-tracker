# Phase 4: Stats & Charts - Research

**Researched:** 2026-07-22
**Domain:** React Native charting (victory-native XL / Skia), SQLite aggregation queries, pure-function record/PR computation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** The Stats tab landing is a single-scroll **overview dashboard**: recent PR feed at top → weekly volume chart → an entry point (exercise picker) into per-exercise charts. One screen, everything discoverable.
- **D-02:** Views are stacked as **sections in one scrolling screen** — no segmented sub-tabs at the Stats-tab level.
- **D-03:** A per-exercise progress chart is reachable from **two entry points**: (a) the exercise picker inside the Stats tab, and (b) a "View progress" affordance on the exercise's detail page in the library.
- **D-04:** Default metric on open is **estimated 1RM** (Epley e1RM of the best set that session).
- **D-05:** Metric switching is a **segmented toggle above the chart** — one chart, 3-way swap between est-1RM / top set / volume. Not three stacked charts.
- **D-06:** Default time window is **all-time**, with **range chips (3M / 1Y / All)** to filter. Pinch/pan zoom is a nice-to-have only if cheap with victory-native XL — not required.
- **D-07:** Trend-line granularity is **one point per workout** = that session's best set for the exercise (best e1RM / heaviest / session volume depending on metric). NOT one point per set. This keeps the line clean and directly supports STAT-04 responsiveness.
- **D-08:** A PR is **rep-max records + best e1RM**: StrengthLog-style best weight at each rep count (1RM, 3RM, 5RM…) plus best estimated 1RM per exercise. (Richer than the existing session-only `detectPRs`, which is weight+e1RM only — planner must design an all-history rep-max computation.)
- **D-09:** Presentation is a **recent chronological feed + per-exercise record board**: main feed = PRs hit recently (newest first, across all exercises); tapping an exercise opens its full record board (all current bests).
- **D-10:** Overview feed is **capped to the most recent N PR events across all exercises**, with a "see all" link to full history. (Pick a sensible N at plan time, e.g. 10–15.)
- **D-11:** PR feed is **computed live from logged sets on every open, never stored** (STAT-03, PROJECT.md key decision) — carried forward, non-negotiable. Cache only if measurably slow, and only as a derived cache.
- **D-12:** Volume metric is **tonnage (kg × reps)** over working sets — consistent with the existing `workingSetVolume()`. (Not set count.)
- **D-13:** A set is attributed to a muscle group via the **exercise's single `muscle_group` tag, as-is** — no primary/secondary apportioning (secondary-muscle data is not in the current schema/seed). Adding secondary-muscle attribution would be its own scope.
- **D-14:** Chart form is a **stacked bar per week** — one bar per week, segments colored by muscle group (shows both weekly total and mix).
- **D-15:** Week boundary is **Monday–Sunday (ISO-style)**; overview shows the **most recent ~12 weeks** with scroll/expand for older weeks.
- **D-16:** Weights stored canonically in **kg**; all charts/records render in the user's **display unit** setting (LOG-06). Axis labels and record values convert; underlying math stays in kg.
- **D-17:** Estimated 1RM uses the existing **`lib/estimate1RM.ts` (Epley, reps≤1 → weight unchanged)** as the single formula source. Volume uses the existing `lib/volume.ts` convention (warmups excluded).
- **D-18:** Charting library is **victory-native XL (v41)** per CLAUDE.md stack — **not yet installed**; research/plan must add `victory-native` + `@shopify/react-native-skia` (reanimated + gesture-handler already present) and confirm dev-client/EAS build implications.

### Claude's Discretion

Exact cap N for the overview PR feed, empty-state copy/visuals for new users or exercises with too few data points, chart colors within the dark-first `theme.ts` palette, and whether pinch/pan zoom ships in v1 — all left to planner/executor discretion within the decisions above.

### Deferred Ideas (OUT OF SCOPE)

- **Rep-range distribution & session-duration trend charts** — already parked as v2 (STAT-05 in REQUIREMENTS.md). Not this phase.
- **Secondary-muscle volume apportioning** — would enrich STAT-02 but needs new secondary-muscle seed data + schema; its own scope if ever wanted.
- **Pinch/pan zoom on charts** — only if cheap with victory XL; otherwise defer. Range chips (D-06) cover the core need.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| STAT-01 | User can view per-exercise charts: estimated 1RM, top set, and volume over time | Pattern 1 (`buildChartSeries` — one point per workout, D-07) + Pattern 2 (`CartesianChart`+`Line` with segmented-toggle metric swap) + Standard Stack (victory-native/Skia install) |
| STAT-02 | User can view weekly volume by muscle group | Verified 10-value `muscle_group` distribution (Code Examples) + Pattern 3 (`CartesianChart`+`StackedBar`) + Pitfall 5 ("Other" bucket handling) |
| STAT-03 | User sees a PR feed; PRs are computed from sets, never stored | `computeAllTimeRecords` chronological single-pass sketch (Code Examples) + Architectural Responsibility Map (no caching tier) + Validation Architecture (live-recompute test strategy) |
| STAT-04 | Charts stay responsive with years of history (validated against a large synthetic dataset) | Validation Architecture §STAT-04 performance strategy (synthetic-history generator + timed query paths + on-device manual verification gap called out explicitly) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Charting library locked to victory-native XL v41** (`victory-native@41.26.0` + `@shopify/react-native-skia@2.9.0`) — do not substitute an alternative charting library; do not follow legacy pre-v40 `VictoryChart`/`VictoryLine` API docs/tutorials.
- **Vitest is for pure-logic tests only** — never force React Native component/screen rendering into vitest; use it for `lib/chartSeries.ts`, `lib/records.ts`, and any new pure math, plus `db/*.ts` query-layer tests via the existing in-memory `better-sqlite3` fixture. Chart-rendering/screen-level verification is manual/on-device only (no `jest-expo`/`@testing-library/react-native` installed or planned for this phase).
- **Do not bump `@shopify/react-native-skia` past the 2.x major** without first re-checking `victory-native`'s peer range (currently `>=1.2.3 <3.0.0`).
- **`expo-dev-client` + EAS/`expo run:android` required** — Skia is a native module; it will not load in Expo Go, and installing it requires a native dev-client rebuild before any chart code can be tested (see Pitfall 2).
- **Zero running costs / no server** — this phase is 100% on-device computation over local SQLite; no network calls of any kind.
- **Dark-first UI, no upsell** — all new Stats screens must use `theme.ts` tokens exclusively, matching the project's existing dark-only design system.

## Summary

This phase adds a read-only stats layer over data that already exists and is already query-tested (`db/workouts.ts`, `lib/estimate1RM.ts`, `lib/volume.ts`, `lib/prDetection.ts`). Nothing here requires new schema or new writes. The three things that make this phase non-trivial are: (1) `victory-native` and `@shopify/react-native-skia` are genuinely new native dependencies that were never installed in Phases 1-3, so this phase's first task must be an install + native-rebuild step, not just an `npm install`; (2) the "one point per workout" chart series (D-07) and the "computed live, never stored" PR feed (D-11/STAT-03) both require a chronological, per-workout aggregation pass over `sets`/`workout_exercises`/`workouts` that does not yet exist anywhere in the codebase and must be designed fresh, modeled on `lib/prDetection.ts`'s pure-function convention; (3) STAT-04 requires proving this aggregation stays fast against years of synthetic history using the project's existing in-memory `better-sqlite3` test fixture, which is the correct vehicle and needs no new test infrastructure — only new seed-generation and timing assertions.

The seeded exercise library has exactly 10 distinct `muscle_group` values (verified directly against `db/seed/exercises.seed.json`, 517 rows) — few enough for a legible stacked bar per D-14, with one caveat: "Other" is a 37-exercise catch-all bucket, not a real muscle group, and should be visually deprioritized (e.g., rendered last / muted) rather than treated as equal to the eight real muscle groups.

**Primary recommendation:** Install `victory-native@41.26.0` and `@shopify/react-native-skia@2.9.0` with exact pinned versions via plain `npm install` (not bare `expo install`, whose bundled compatibility table for this SDK resolves skia to a stale `2.6.2` and would also try to downgrade the project's intentionally-pinned `react-native-gesture-handler@3.1.0` back to `~2.32.0` if `--fix` is ever run). Rebuild the dev client with `npm run android` immediately after install, before writing any chart code — Skia ships native code and the existing dev client binary does not contain it yet. Build the chart-series and PR-feed aggregation as pure functions (`lib/*.ts`) fed by a new `db/stats.ts` query module, following the existing `db/workouts.ts` + `lib/prDetection.ts` split exactly, and prove STAT-04 with a synthetic-history generator in the existing vitest + in-memory-better-sqlite3 fixture.

## Architectural Responsibility Map

This is a local-first mobile app (no browser/SSR/CDN tiers) — capabilities map onto this project's actual layers: **UI/Screen** (RN components + Skia canvas rendering), **Query Layer** (`db/*.ts`, Drizzle over SQLite), **Pure Math Lib** (`lib/*.ts`, zero RN/Drizzle imports, vitest-tested), and **SQLite** (on-device storage, sole source of truth).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Chart rendering (lines, stacked bars, axes) | UI/Screen (Skia) | — | GPU-drawn Skia canvas; must live in a component tree, not the query/lib layers |
| Per-workout chart-series aggregation (D-07) | Query Layer (`db/stats.ts`) | Pure Math Lib | Row fetch is a DB concern; the per-workout "best set" reduction should be a pure, independently-testable function the query layer calls |
| Est-1RM / volume formulas | Pure Math Lib | — | Already exist (`estimate1RM`, `workingSetVolume`) — reuse, do not reimplement |
| All-history rep-max + e1RM record board (D-08) | Pure Math Lib | Query Layer | Chronological scan/reduce over sets is pure computation; the query layer's only job is fetching the ordered rows |
| Live PR-feed computation, never stored (D-11/STAT-03) | Query Layer + Pure Math Lib | — | No caching tier permitted by design; SQLite is queried fresh on every Stats-tab open |
| Weekly volume by muscle group (STAT-02) | Query Layer | Pure Math Lib | Week-bucketing + tonnage-per-group is a straightforward aggregation; keep grouping logic pure/testable, keep the SQL read in `db/stats.ts` |
| kg→display-unit conversion for axis/record labels (D-16) | UI/Screen | Pure Math Lib (`weightUnits.ts`) | Conversion math is already pure and shared; the screen layer is only responsible for reading the `units` setting and calling it at render time |
| Empty-state / too-few-data-points handling | UI/Screen | — | Presentation-only concern; the query/lib layers should return whatever data exists (including 0-1 points) and let the screen decide what to render |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `victory-native` | **41.26.0** | Charting — line charts (est-1RM/top-set/volume trend), stacked bar (weekly volume by muscle group) | Ground-up Skia/Reanimated rewrite ("XL"), GPU-rendered, actively maintained by Nearform/FormidableLabs. Pinned in CLAUDE.md. [VERIFIED: npm registry] — `npm view victory-native version` returns `41.26.0`, published 2026-06-09, package created 2016, 417,703 weekly downloads, repo `github.com/FormidableLabs/victory-native-xl`. |
| `@shopify/react-native-skia` | **2.9.0** | GPU rendering engine victory-native draws on | Required peer; victory-native's peer range is `>=1.2.3 <3.0.0`, and 2.9.0 fits comfortably below the 3.x boundary CLAUDE.md warns not to cross. [VERIFIED: npm registry] — package created 2022, 1,160,529 weekly downloads, official `github.com/Shopify/react-native-skia` repo. **Note:** the exact patch `2.9.0` was published 2026-07-16 (~1 week before this research); the very latest `2.9.1` published the same day as this research (2026-07-22) — install the exact pinned `2.9.0`, not `latest`, to avoid landing on an untested same-day release. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react-native-reanimated` | 4.5.0 (already installed) | Animation driver victory-native/Skia depend on | Already present in `package.json`; satisfies both victory-native's `>=3.0.0` peer and skia's `>=3.19.1` peer. No action needed. |
| `react-native-gesture-handler` | 3.1.0 (already installed) | Gesture system for chart pan/zoom if adopted | Already present; satisfies victory-native's `>=2.0.0` peer. **Do not let `expo install --fix` downgrade this** (see Pitfall 1). |
| `react-native-worklets` | 0.10.0 (already installed) | Reanimated 4's worklets runtime peer | Already present, no action needed. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| victory-native XL (CartesianChart + Line/StackedBar) | `react-native-gifted-charts` | Simpler API, no Skia dependency — but CLAUDE.md already locked victory-native for this project and gifted-charts has weaker gesture/pan support; not revisited here (D-18 is locked). |
| Fetching all sets for an exercise and reducing per-workout in JS | Pure-SQL `GROUP BY workout_id` with `MAX(weight_kg)` | SQL `MAX` cannot replicate the Epley e1RM's non-linear weight×reps combination or the `reps<=1` short-circuit in `lib/estimate1RM.ts` without duplicating that formula in SQL — duplicating a formula that already has an Assumptions Log entry (A3) is a correctness risk. Recommend: fetch rows grouped by workout via SQL, reduce per-workout bests in JS via the existing pure function. Data volume is small enough (see STAT-04 section) that this costs nothing measurable. |

**Installation:**
```bash
npm install victory-native@41.26.0 @shopify/react-native-skia@2.9.0
# NOT: npx expo install victory-native @shopify/react-native-skia
# (see Pitfall 1 — Expo's bundled compatibility table for this SDK recommends
# a stale skia 2.6.2 and has no entry for victory-native at all)

# Then rebuild the native dev client (Skia ships native code):
npm run android
```

**Version verification:** Ran directly against the npm registry (2026-07-22):
```
npm view victory-native version                          → 41.26.0
npm view victory-native@41.26.0 peerDependencies          → react *, react-native *,
                                                              react-native-reanimated >=3.0.0,
                                                              @shopify/react-native-skia >=1.2.3 <3.0.0,
                                                              react-native-gesture-handler >=2.0.0
npm view @shopify/react-native-skia version                → 2.9.1 (latest; project pins 2.9.0)
npm view @shopify/react-native-skia@2.9.0 peerDependencies  → react >=19.0, react-native >=0.78,
                                                              react-native-reanimated >=3.19.1
```
Both peer ranges are satisfied by the project's currently-installed `react@19.2.3`, `react-native@0.86.0`, `react-native-reanimated@4.5.0`, `react-native-gesture-handler@3.1.0`. No conflicts. [VERIFIED: npm registry]

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `victory-native` | npm | ~10 yrs (created 2016) | 417,703/wk | `github.com/FormidableLabs/victory-native-xl` | OK | Approved |
| `@shopify/react-native-skia` | npm | ~4 yrs (created 2022) | 1,160,529/wk | `github.com/Shopify/react-native-skia` | SUS ("too-new" signal) | Flagged — see note below |

**Packages removed due to [SLOP] verdict:** none.

**Packages flagged as suspicious [SUS]:** `@shopify/react-native-skia` — `gsd-tools query package-legitimacy check` flags it `SUS` with reason `too-new`. This signal is triggered by the **latest** version (`2.9.1`) having been published the same day as this research (2026-07-22T10:33). The package itself is not new (created 2022, official Shopify org, 1.16M weekly downloads, no postinstall script) — the risk is isolated to accidentally installing the same-day `2.9.1` release instead of the CLAUDE.md-pinned, one-week-old `2.9.0`. **The planner must add a `checkpoint:human-verify` task before this install**, and the install command must pin the exact version (`@2.9.0`), never `@latest` or an unpinned `expo install`.

## Architecture Patterns

### System Architecture Diagram

```
Stats tab opens
      |
      v
[Screen] app/(tabs)/stats.tsx
      | reads settings.units (kg/lb, D-16)
      v
[Query Layer] db/stats.ts  ---------------------------+
      | SELECT sets JOIN workout_exercises              |
      | JOIN workouts WHERE finished_at IS NOT NULL      |
      | (parameterized, ordered by started_at)           |
      v                                                  |
[Pure Lib] lib/chartSeries.ts   lib/records.ts           |
      | group rows by workout_id                         |
      | reduce to one point per workout (D-07)            |
      | OR chronological running-max scan (D-08/D-11)     |
      v                                                  |
[Query Layer] returns typed series / record board / PR events
      v
[Screen] converts kg -> display unit (lib/weightUnits.ts)
      v
[UI/Skia] CartesianChart + Line   (per-exercise trend, D-04/D-05/D-06)
          CartesianChart + StackedBar (weekly volume by muscle group, D-14)
          FlatList/ScrollView (PR feed, D-09/D-10)
      |
      v
Rendered dashboard (D-01/D-02): PR feed -> weekly volume -> exercise picker
```

A per-exercise chart open (from D-03's two entry points) re-enters at the Query Layer step scoped to one `exerciseId`; a Stats-tab open re-enters scoped to "all exercises, most recent N events" for the PR feed and "most recent ~12 weeks" for the volume chart (D-15).

### Recommended Project Structure
```
db/
├── stats.ts             # new: chart-series queries, weekly-volume query, all-history record queries
├── stats.query.test.ts  # new: vitest against in-memory better-sqlite3 (mirrors workouts.query.test.ts)
lib/
├── chartSeries.ts        # new: pure "one point per workout" reduction (D-07) for e1RM/top-set/volume
├── chartSeries.test.ts   # new
├── records.ts             # new: pure all-history rep-max + best-e1RM record board + PR event timeline (D-08/D-09)
├── records.test.ts        # new
app/(tabs)/stats.tsx        # replace placeholder with overview dashboard (D-01/D-02)
app/stats/[exerciseId].tsx  # new: per-exercise chart screen (D-03), reachable from picker + exercise detail
app/stats/records.tsx       # new: "see all" full PR history (D-10)
```

### Pattern 1: One-point-per-workout chart series (D-07)
**What:** For a given exercise and metric (est-1RM / top set / volume), reduce each workout's non-warmup sets to a single point representing that session's best for the metric.
**When to use:** All three per-exercise chart metrics (STAT-01).
**Example:**
```typescript
// lib/chartSeries.ts — models lib/prDetection.ts's pure-function convention
import { estimate1RM } from './estimate1RM';

export interface ChartSet {
  workoutId: number;
  startedAt: string; // workouts.started_at (ISO)
  weightKg: number;
  reps: number;
  type: string;
}

export interface ChartPoint {
  workoutId: number;
  date: string;
  value: number; // kg for top-set/volume metrics, kg-equivalent for e1rm
}

export type ChartMetric = 'e1rm' | 'topSet' | 'volume';

/** Groups already-ordered, non-warmup sets by workout and reduces each
 * workout to a single best-of-session point for the given metric (D-07). */
export function buildChartSeries(sets: ChartSet[], metric: ChartMetric): ChartPoint[] {
  const byWorkout = new Map<number, ChartSet[]>();
  for (const s of sets) {
    if (s.type === 'warmup') continue;
    const bucket = byWorkout.get(s.workoutId);
    if (bucket) bucket.push(s); else byWorkout.set(s.workoutId, [s]);
  }

  const points: ChartPoint[] = [];
  for (const [workoutId, workoutSets] of byWorkout) {
    const date = workoutSets[0].startedAt;
    let value: number;
    if (metric === 'volume') {
      value = workoutSets.reduce((sum, s) => sum + s.weightKg * s.reps, 0);
    } else if (metric === 'topSet') {
      value = Math.max(...workoutSets.map((s) => s.weightKg));
    } else {
      value = Math.max(...workoutSets.map((s) => estimate1RM(s.weightKg, s.reps)));
    }
    points.push({ workoutId, date, value });
  }
  return points.sort((a, b) => a.date.localeCompare(b.date));
}
```
Note: the `volume` metric here should reuse `workingSetVolume` from `lib/volume.ts` per-workout rather than reimplementing the tonnage sum inline — the sketch above shows the shape; the planner should wire it to call the existing shared function.

### Pattern 2: CartesianChart + Line (per-exercise trend)
**What:** victory-native XL's core container + a Line child for the metric toggle chart (D-05).
**When to use:** STAT-01 per-exercise chart.
**Example:**
```typescript
// Source: https://nearform.com/open-source/victory-native/docs/cartesian/cartesian-chart
import { View } from 'react-native';
import { CartesianChart, Line } from 'victory-native';
import { useFont } from '@shopify/react-native-skia';

function ExerciseChart({ points }: { points: ChartPoint[] }) {
  const font = useFont(require('../assets/fonts/inter-medium.ttf'), 12);
  return (
    <View style={{ height: 260 }}>
      <CartesianChart data={points} xKey="date" yKeys={['value']} axisOptions={{ font }}>
        {({ points: p }) => <Line points={p.value} color={theme.colors.accent} strokeWidth={3} />}
      </CartesianChart>
    </View>
  );
}
```
**Pitfall:** `axisOptions.font` needs a loaded `.ttf` via `useFont` for axis labels to render at all — without it, axis labels silently don't draw (chart line still renders). Bundle a font asset; Metro's default `assetExts` already handles `.ttf`, no metro.config.js change needed.

### Pattern 3: CartesianChart + StackedBar (weekly volume by muscle group)
**What:** Stacked bar per week (D-14), one segment per muscle group.
**When to use:** STAT-02.
**Example:**
```typescript
// Source: https://nearform.com/open-source/victory-native/docs/cartesian/bar/stacked-bar/
import { CartesianChart, StackedBar } from 'victory-native';

// data shape: one row per week, one key per muscle group
// [{ weekStart: '2026-W29', Chest: 4200, Back: 3800, Shoulders: 1900, ... }, ...]
const MUSCLE_GROUP_KEYS = ['Chest', 'Back', 'Shoulders', 'Quads', 'Hamstrings',
  'Glutes', 'Biceps', 'Triceps', 'Core', 'Other']; // 'Other' last — catch-all, deprioritized

function WeeklyVolumeChart({ data }: { data: WeeklyVolumeRow[] }) {
  return (
    <CartesianChart data={data} xKey="weekStart" yKeys={MUSCLE_GROUP_KEYS}
      domainPadding={{ left: 30, right: 30, top: 20 }} axisOptions={{ font }}>
      {({ points, chartBounds }) => (
        <StackedBar
          chartBounds={chartBounds}
          points={MUSCLE_GROUP_KEYS.map((k) => points[k])}
          colors={MUSCLE_GROUP_COLORS} // must be same length/order as MUSCLE_GROUP_KEYS
          innerPadding={0.25}
        />
      )}
    </CartesianChart>
  );
}
```

### Anti-Patterns to Avoid
- **Following legacy `victory-native` v36 tutorials:** The `<VictoryChart><VictoryLine/></VictoryChart>` web-ported composition API from v36 does not exist in v41 "XL" — it is a from-scratch Skia rewrite. Any tutorial or Stack Overflow answer not explicitly referencing `CartesianChart` is for the wrong major version. [CITED: CLAUDE.md — carried-forward project constraint]
- **Storing PR/record values in SQLite:** D-11/STAT-03 is explicit and non-negotiable — compute live on every open. Do not add a `records` or `personal_bests` table "for performance" without first measuring that the live query is actually slow (see STAT-04 validation below, which is designed to prove it isn't).
- **Computing e1RM independently in two places:** SQL-side `MAX` aggregation and `lib/estimate1RM.ts` will silently diverge on the `reps<=1` edge case (Assumptions Log A3 in that file). Always fetch raw rows and reduce with the shared function.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Est-1RM calculation | A new Epley (or other) formula inline in chart/record code | `lib/estimate1RM.ts#estimate1RM` | Already the single source (D-17); a second implementation risks silently diverging on the `reps<=1` edge case |
| Working-set tonnage | A new `weightKg * reps` sum inline in the weekly-volume query | `lib/volume.ts#workingSetVolume` | Already excludes warmups correctly (D-12/D-17); reuse verbatim |
| GPU chart rendering | A custom `react-native-svg` line/bar chart | `victory-native` `CartesianChart` + `Line`/`StackedBar` | Hand-rolled SVG charts do not scale to years of points at 60fps; Skia is GPU-accelerated and is the locked D-18 choice |
| Week-boundary bucketing | Ad-hoc `Date` arithmetic per call site | One shared `getWeekStart(date)` helper (Mon-Sun per D-15), analogous to the existing `lib/duration.ts` shared-formatter pattern | Prevents the History-tab's UTC-month-boundary lesson (already learned in Phase 2, see STATE.md) from repeating for week boundaries |

**Key insight:** Every math primitive this phase needs except week-bucketing and the new all-history record/chart-series reduction already exists, tested, and is explicitly cited by CONTEXT.md as reusable. The actual net-new logic is small and isolated: two new pure functions (`buildChartSeries`, an all-history record/PR-event scanner) plus two thin query functions that feed them.

## Common Pitfalls

### Pitfall 1: `expo install` resolves stale/wrong versions for these two packages
**What goes wrong:** Running `npx expo install victory-native @shopify/react-native-skia` (no explicit version) or later running `npx expo install --fix` silently changes dependency versions away from the CLAUDE.md pins.
**Why it happens:** [VERIFIED — ran directly against this repo] The installed `expo@57.0.7` package's own `node_modules/expo/bundledNativeModules.json` lists `@shopify/react-native-skia: "2.6.2"` (stale vs. the pinned `2.9.0`) and has **no entry at all** for `victory-native` (so `expo install` would just resolve `latest`, currently `41.26.0` — a coincidental match, not a guarantee). The same file lists `react-native-gesture-handler: "~2.32.0"` — running `npx expo install --check` in this repo right now reports `react-native-gesture-handler@3.1.0 - expected version: ~2.32.0` as "should be updated." The project already deliberately runs `3.1.0` (required for Reanimated 4 / New Architecture, per package.json comments and Phase 2/3 history) — `expo install --fix` would silently regress this.
**How to avoid:** Use `npm install victory-native@41.26.0 @shopify/react-native-skia@2.9.0` with exact versions. Never run `npx expo install --fix` in this project without manually reviewing the diff first.
**Warning signs:** `npx expo install --check` reporting gesture-handler or skia as "outdated" is expected and should be ignored for these two packages specifically — do not auto-fix.

### Pitfall 2: Installing the JS package is not enough — the dev client must be rebuilt
**What goes wrong:** After `npm install`, Metro reloads the JS bundle but the app crashes or the Skia canvas fails to mount, because the native Skia binary isn't linked into the installed APK.
**Why it happens:** [CITED: docs.expo.dev/guides/local-app-development] Any package containing native code (Skia ships native C++/Kotlin) requires the native Android project to be rebuilt — `expo run:android` re-links native modules; a plain Metro/Fast-Refresh reload (as used for pure-JS changes per the project's own `device-run-setup` memory) does not.
**How to avoid:** After installing both packages, run `npm run android` again (full native rebuild) before writing or testing any chart component — treat this as its own first task/checkpoint in the plan, separate from writing chart code.
**Warning signs:** "Native module RNSkia... cannot be found" or a blank/crashing Stats screen after install with no code changes yet.

### Pitfall 3: Axis labels silently missing without a loaded font
**What goes wrong:** Chart renders (line/bars draw fine) but axis tick labels never appear, with no error.
**Why it happens:** [CITED: nearform.com/open-source/victory-native docs] `axisOptions.font` expects a Skia `SkFont` from `useFont(source, size)`; if no font asset is loaded, `axisOptions` should be omitted or the font must resolve before axis labels can draw.
**How to avoid:** Bundle a `.ttf` (e.g., reuse whatever font `@expo/vector-icons`/system already ships, or add one to `assets/fonts/`) and confirm `useFont(...)` returns non-null before passing `axisOptions`.
**Warning signs:** Chart line/bars visible, no numbers/dates around the chart edges.

### Pitfall 4: Duplicating the e1RM formula in a SQL aggregate
**What goes wrong:** A `MAX(weight_kg * (1 + reps / 30.0))` SQL expression for "best e1RM" diverges from `lib/estimate1RM.ts` on the `reps <= 1` short-circuit (Assumptions Log A3), producing chart points or PR events that disagree with the finish-summary PR toast from Phase 2.
**Why it happens:** SQL aggregate functions are tempting for performance but can't express the conditional branch without duplicating application logic in SQL.
**How to avoid:** Fetch raw (exerciseId/workoutId/weightKg/reps/type) rows via a parameterized query, filter warmups, group by workout in JS, and call `estimate1RM` per set. Given realistic data volumes (see STAT-04 below), this costs nothing measurable.
**Warning signs:** A PR/e1RM value shown on the Stats tab that doesn't match the equivalent value shown on a workout's finish-summary screen for the same session.

### Pitfall 5: "Other" muscle-group bucket treated as a real muscle group
**What goes wrong:** The stacked bar's 10th segment ("Other", 37/517 seeded exercises — custom-exercise catch-all and miscellaneous seeded items) gets equal visual weight/legend prominence to 8 anatomically real groups, confusing the "what am I training" read.
**Why it happens:** `muscle_group` is a flat string column (D-13, no schema for a real/catch-all distinction) — "Other" is indistinguishable from "Chest" at the data layer.
**How to avoid:** [ASSUMED — no CONTEXT.md decision on this specific point; Claude's Discretion per D-13's scope] Order "Other" last in the stack and legend, and consider a muted/grey color rather than a saturated theme color, so it reads as "miscellaneous" rather than a peer muscle group.
**Warning signs:** User feedback that the weekly volume chart "looks wrong" or that Other dominates visually despite being a small bucket.

## Code Examples

### Verified distinct `muscle_group` values in the seeded dataset
```
$ node -e "... group by muscleGroup ..." against db/seed/exercises.seed.json (517 rows)
Shoulders   99
Chest       65
Back        65
Core        64
Triceps     56
Biceps      50
Quads       45
Other       37
Hamstrings  25
Glutes      11
```
[VERIFIED: codebase] 10 distinct values, none inconsistent (no casing/typo variants observed) — few enough for a legible stacked bar per D-14. Recommend using these 10 as-is for the muscle-group grouping granularity (matches D-13's "single tag, as-is" decision); no further consolidation needed, only the "Other" de-emphasis in Pitfall 5.

### All-history record board sketch (D-08)
```typescript
// lib/records.ts — models lib/prDetection.ts's pure-function convention
import { estimate1RM } from './estimate1RM';

export interface HistoricalSet {
  exerciseId: number;
  workoutId: number;
  startedAt: string; // ISO, workouts.started_at
  weightKg: number;
  reps: number;
  type: string;
}

export interface RecordBoardEntry {
  reps: number;          // rep count this is the record for (e.g. 1RM, 3RM, 5RM...)
  weightKg: number;
  workoutId: number;
  date: string;
}

export interface ExerciseRecordBoard {
  exerciseId: number;
  repMaxes: RecordBoardEntry[];   // one entry per distinct rep count actually logged
  bestE1RM: RecordBoardEntry & { e1rm: number };
}

export interface PREvent {
  exerciseId: number;
  workoutId: number;
  date: string;
  kind: 'rep-max' | 'e1rm';
  reps: number;
  weightKg: number;
}

/**
 * Single chronological pass (input MUST be pre-sorted by startedAt ASC) that
 * tracks a running best per (exerciseId, reps) and per exerciseId's best
 * e1RM, emitting a PREvent every time a non-warmup set beats the running
 * best. Returns both the full event timeline (for D-09's recent feed, sliced
 * to N by the caller) and the final record boards (for D-09's per-exercise
 * board). Never persisted — recomputed on every Stats-tab open (D-11).
 */
export function computeAllTimeRecords(
  sortedSets: HistoricalSet[],
): { events: PREvent[]; boards: Map<number, ExerciseRecordBoard> } {
  const repBests = new Map<string, number>(); // `${exerciseId}:${reps}` -> weightKg
  const e1rmBests = new Map<number, number>();
  const boards = new Map<number, ExerciseRecordBoard>();
  const events: PREvent[] = [];

  for (const s of sortedSets) {
    if (s.type === 'warmup') continue;
    const repKey = `${s.exerciseId}:${s.reps}`;
    const priorRepBest = repBests.get(repKey);
    if (priorRepBest === undefined || s.weightKg > priorRepBest) {
      repBests.set(repKey, s.weightKg);
      events.push({ exerciseId: s.exerciseId, workoutId: s.workoutId, date: s.startedAt,
        kind: 'rep-max', reps: s.reps, weightKg: s.weightKg });
    }
    const e1rm = estimate1RM(s.weightKg, s.reps);
    const priorE1RM = e1rmBests.get(s.exerciseId);
    if (priorE1RM === undefined || e1rm > priorE1RM) {
      e1rmBests.set(s.exerciseId, e1rm);
      events.push({ exerciseId: s.exerciseId, workoutId: s.workoutId, date: s.startedAt,
        kind: 'e1rm', reps: s.reps, weightKg: s.weightKg });
    }
    // board assembly omitted for brevity — derive from the two Maps after the loop
  }

  return { events, boards };
}
```
This is a design sketch, not a locked implementation — the planner should verify the exact `ExerciseRecordBoard` shape against what the "per-exercise record board" screen (D-09) needs to render, and decide the board-assembly step. The chronological-single-pass shape is the key finding: it is what makes D-09's "recent feed" (needs event dates) and "record board" (needs final state) derivable from one scan, and it is what STAT-04's performance test should exercise directly.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Victory Native (legacy, web-ported `VictoryChart`/`VictoryLine` composition API, pre-v40) | Victory Native XL (`CartesianChart` + Skia-rendered children) | Ground-up rewrite, current major is 41.x | Any pre-v40 tutorial/StackOverflow code will not compile against the pinned `41.26.0` — verify `CartesianChart` appears in any reference before following it |

**Deprecated/outdated:** None specific to this phase beyond the above — this is a fresh install, not an upgrade.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Other" muscle-group bucket should be visually deprioritized (ordered last, muted color) rather than treated as a peer group | Pitfall 5 / Pattern 3 | Low — purely a UI polish choice within Claude's Discretion (D-13 scope); wrong call just means a slightly less legible chart, not a functional bug |
| A2 | Bundling a new `.ttf` font asset for `useFont`/axis labels is the right fix, vs. omitting `axisOptions.font` entirely | Pitfall 3 | Low — if omitted, charts still render (just without axis labels), so this is reversible at plan/execute time with no data risk |
| A3 | The chronological single-pass record/PR-event design (`computeAllTimeRecords` sketch) is an efficient and sufficient shape for D-08/D-09/D-11 at this app's realistic data scale | Code Examples / STAT-04 | Medium — if actual usage patterns (e.g., very high rep-count variety per exercise) make the `Map`-per-rep-count approach unwieldy, the planner may need a different record-board assembly; the underlying single-pass-scan performance conclusion (validated in STAT-04 below) should still hold since it's the same total row count either way |

**Note on the two pinned charting packages:** their names, versions, and rationale come from `CLAUDE.md` (this project's own approved, already-registry-verified tech stack document — not from this session's WebSearch/training data), so they are treated as `[CITED: CLAUDE.md]`/`[VERIFIED: npm registry]` rather than `[ASSUMED]` throughout this document; the peer-dependency and native-rebuild facts around them were independently re-verified in this session via direct `npm view` calls and one official Expo docs fetch.

## Open Questions

1. **Exact `ExerciseRecordBoard` assembly and StrengthLog-style rep range to track**
   - What we know: StrengthLog-style rep-max boards typically show a record only for rep counts the user has actually logged (D-08 says "best weight at each rep count 1RM, 3RM, 5RM…"), not a synthetic 1-30 grid.
   - What's unclear: Whether to show every distinct rep count logged (could be noisy — e.g., 1, 2, 3, 4, 5, 6, 7, 8...) or curate to a canonical subset (1/3/5/8/10/12, StrengthLog's actual convention).
   - Recommendation: Planner/executor discretion per CONTEXT.md's "Claude's Discretion" — recommend curating to a small canonical rep-count list (e.g., 1/3/5/8/10/12) for the record board display, since that's closer to the StrengthLog reference feel cited in CONTEXT.md's Specific Ideas, while still computing (and could store internally) records at every distinct rep count logged for the PR-event feed.

2. **Range chips (3M/1Y/All, D-06) — filtered client-side after full fetch, or a bounded query?**
   - What we know: Default window is all-time; chips filter to 3M/1Y. D-07's per-workout aggregation already bounds the series to one point per session (small N even at "All").
   - What's unclear: Whether it's simpler to fetch all-time once and filter client-side (cheap given D-07's point-count bound) vs. re-querying per chip tap.
   - Recommendation: Fetch all-time once per exercise-chart open, filter client-side in the pure `buildChartSeries`/date-range step — avoids redundant DB round-trips for a dataset already proven small (see STAT-04). This is the simpler implementation and should be the default unless STAT-04 timing proves otherwise.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Local dev/test tooling | Yes | v24.18.0 | — |
| npm | Package install | Yes | 11.4.0 | — |
| Android SDK (`ANDROID_HOME`) | Native dev-client rebuild (Pitfall 2) | Yes | SDK present at `%LOCALAPPDATA%\Android\Sdk` (build-tools, cmdline-tools, emulator, extras dirs confirmed) | — |
| Java (Android Studio JBR) | Gradle build for `npm run android` | Yes (per prior-session memory `device-run-setup.md`, used successfully through Phase 2/3 device UAT) | Android Studio's bundled JBR | — |
| Physical Android device (adb) | On-device chart-rendering/performance verification | Yes (per `device-run-setup.md`: serial `5dqwzpdqemsc6xpb`) | — | — |

No missing dependencies. This phase's only genuinely new environment requirement — the native rebuild step — is already covered by the project's existing local Android toolchain (documented in the `device-run-setup` memory from prior phases).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 |
| Config file | `vitest.config.ts` (Node environment, `**/*.test.ts`, no watch) |
| Quick run command | `npx vitest run lib/chartSeries.test.ts lib/records.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAT-01 | Per-exercise chart series: e1RM/top-set/volume, one point per workout (D-07) | unit | `npx vitest run lib/chartSeries.test.ts` | ❌ Wave 0 |
| STAT-01 | Chart-series query fetches only non-warmup sets, ordered, scoped to one exercise | integration (in-memory SQLite) | `npx vitest run db/stats.query.test.ts` | ❌ Wave 0 |
| STAT-02 | Weekly volume by muscle group: Monday-Sunday buckets, tonnage per group (D-12/D-15) | unit + integration | `npx vitest run lib/weeklyVolume.test.ts db/stats.query.test.ts` | ❌ Wave 0 |
| STAT-03 | PR feed computed live from `sets`, never a stored value — re-running the scan after inserting a new heavier set immediately reflects it with no cache to invalidate | integration (in-memory SQLite) | `npx vitest run lib/records.test.ts` | ❌ Wave 0 |
| STAT-04 | Charts stay responsive against years of synthetic history | performance (in-memory SQLite, timed) | `npx vitest run db/stats.performance.test.ts` | ❌ Wave 0 |
| UI-hint (screen renders, empty states, unit conversion) | Manual/device UAT — chart rendering itself is not automatable in this project's vitest-Node-only test strategy (per CLAUDE.md "What NOT to Use" — do not force RN component rendering into vitest) | manual-only | on-device screenshot verification (per `device-run-setup.md` techniques) | — |

### Sampling Rate
- **Per task commit:** quick run scoped to the file(s) touched (e.g., `npx vitest run lib/chartSeries.test.ts`)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus one on-device manual pass confirming charts render and stay responsive on the physical test device (JS-level timing in Node does not guarantee on-device GPU/Skia frame timing — flag this gap explicitly rather than over-claim automated coverage of "responsive" for the actual rendered frame rate)

### STAT-04 performance strategy (detail)
**Synthetic dataset design:** Extend `db/test/fixture.ts`'s `createTestDb()` pattern with a new seed-generation helper that inserts N years of history — recommend 5 years, ~3 sessions/week, ~5 exercises/session, ~4 sets/exercise ≈ **~780 workouts / ~15,600 sets** as a "years of history" stand-in. This is deliberately generous versus realistic personal use (a few thousand sets/year) to leave margin.

**What to time:** three query paths, each wrapped in `performance.now()` before/after in the test:
1. Per-exercise chart series for a single exercise across all 5 years (bounded by that one exercise's set count, not the full 15,600 — this is the smallest-scope query)
2. Weekly volume by muscle group for the most-recent-12-weeks default view (bounded by 12 weeks × all exercises, not all-time)
3. The all-history PR/record scan (STAT-03/D-11) — the worst case, since it must touch every non-warmup set ever logged

**Aggregation location decision:** Do per-workout/per-week aggregation in JS after a targeted SQL fetch (not in raw SQL), per the "Don't duplicate the e1RM formula in SQL" pitfall above — at ~15,600 rows worst-case for the full-history PR scan, a single JS pass is expected to complete in low tens of milliseconds in Node, several orders of magnitude under any UI-perceptible threshold. [ASSUMED — no concrete pass/fail threshold has been set by CONTEXT.md; recommend the plan assert something concrete like "full-history PR scan over the 15,600-row synthetic fixture completes in under 500ms in the vitest/Node environment" as a regression guard, understood as a conservative ceiling, not a tight performance budget]. This assertion catches an accidental N+1 query pattern (e.g., a per-exercise loop issuing one DB round-trip per exercise, mirroring the existing `loadPriorBests` N+1-per-exercise-id shape in `db/workouts.ts` — acceptable there because it's called with a handful of exercise IDs per finish-summary, but would not scale to an all-history, all-exercise PR scan) far more reliably than it catches genuine algorithmic complexity, since the data volume itself is small for a personal SQLite app.

**On-device verification (not automatable):** Because chart *rendering* speed (Skia GPU frame time, not DB query time) is what STAT-04's "charts stay responsive" success criterion is actually about, the vitest performance test above only proves the data-layer half. The plan should include a manual on-device check (per `device-run-setup.md` screenshot/timing techniques) confirming the per-exercise chart and weekly-volume chart render and remain scrollable/interactive against the same synthetic dataset loaded onto the physical test device — this cannot be automated given the project's Node-only vitest strategy.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No auth in this app (local-only, Phase 7 covers optional Google sign-in for backup) |
| V3 Session Management | No | N/A |
| V4 Access Control | No | Single-user local app, no access boundaries |
| V5 Input Validation | Yes (narrow) | All Stats-tab reads are parameterized Drizzle queries (`eq`, `gte`, `lt`, etc.) over internal integer IDs and dates computed in JS — mirrors the existing `db/workouts.ts` pattern (T-02-03/T-02-08 precedent). No new free-text user input is introduced by this phase; range-chip selection (3M/1Y/All) is a closed enum, not free text. |
| V6 Cryptography | No | No new crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| SQL injection via a date-range or exercise-id parameter | Tampering | Parameterized Drizzle query builder only, exactly as `db/workouts.ts` already does — never string-concatenate a date bound or exercise id into raw SQL (precedent: `loadWorkoutsInMonth`'s bound-parameter date handling) |
| Unbounded query DoS (a malformed/huge synthetic date range or exercise-id list) | Denial of Service | Not attacker-reachable in this single-user offline app, but STAT-04's performance test itself doubles as a regression guard against an accidental unbounded scan being introduced |

## Sources

### Primary (HIGH confidence)
- `npm view victory-native version / peerDependencies / dependencies / time.created` — direct npm registry queries, 2026-07-22
- `npm view @shopify/react-native-skia version / peerDependencies / time` — direct npm registry queries, 2026-07-22
- `npx expo install --check` run directly against this repo — surfaced the stale `bundledNativeModules.json` gesture-handler/skia mismatch (Pitfall 1)
- `node -e ...` direct read of `db/seed/exercises.seed.json` (517 rows) — exact `muscle_group` distribution
- `gsd-tools query package-legitimacy check --ecosystem npm victory-native @shopify/react-native-skia` — legitimacy verdicts
- Codebase reads: `lib/estimate1RM.ts`, `lib/volume.ts`, `lib/prDetection.ts`, `db/workouts.ts`, `db/schema.ts`, `db/settings.ts`, `db/test/fixture.ts`, `lib/weightUnits.ts`, `theme.ts`, `vitest.config.ts`, `package.json`

### Secondary (MEDIUM confidence)
- https://nearform.com/open-source/victory-native/docs/cartesian/cartesian-chart — CartesianChart + Line official code example [CITED]
- https://nearform.com/open-source/victory-native/docs/cartesian/bar/stacked-bar/ — StackedBar official code example [CITED]
- https://docs.expo.dev/guides/local-app-development/ — native module install requires rebuild via `expo run:android`/prebuild [CITED]

### Tertiary (LOW confidence)
- General WebSearch results on victory-native XL ecosystem commentary (Nearform blog, DeepWiki, community tutorials) — used only for orientation, not as the basis of any claim in this document; all concrete code examples were re-fetched from the official nearform.com docs pages directly.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package names/versions sourced from CLAUDE.md (project-locked decision), existence/versions/peer-deps independently re-verified via direct npm registry queries this session
- Architecture: HIGH - chart-series and record-board patterns are direct extensions of existing, tested in-repo conventions (`lib/prDetection.ts`, `db/workouts.ts`); code examples are official-docs-sourced, not invented
- Pitfalls: HIGH - Pitfall 1 (expo install mismatch) and the muscle-group distribution (Pitfall 5 context) were both directly reproduced/verified against this exact repo, not inferred

**Research date:** 2026-07-22
**Valid until:** 2026-08-21 (30 days — stable domain: no fast-moving framework churn expected for a pinned major version within that window; re-verify npm versions if planning is delayed past that date)
