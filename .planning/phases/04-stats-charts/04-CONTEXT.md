# Phase 4: Stats & Charts - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Make strength progress **visible** — a read-only stats layer over the existing logged-set data. Delivers four things (STAT-01…04):

1. **Per-exercise progress charts** — estimated 1RM, top set, and volume over time for a single exercise.
2. **Weekly training volume by muscle group** — tonnage broken down per muscle group per week.
3. **A live-computed PR feed** — bests derived from logged sets on every open, never read from a stored/cached value.
4. **Performance under scale** — charts stay responsive against a large synthetic dataset representing years of history.

Everything is derived/read-only. No new logging surfaces, no schema writes for stats values. Body measurements (Phase 5), programs (Phase 6), and backup (Phase 7) are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Stats screen layout & access
- **D-01:** The Stats tab landing is a single-scroll **overview dashboard**: recent PR feed at top → weekly volume chart → an entry point (exercise picker) into per-exercise charts. One screen, everything discoverable.
- **D-02:** Views are stacked as **sections in one scrolling screen** — no segmented sub-tabs at the Stats-tab level.
- **D-03:** A per-exercise progress chart is reachable from **two entry points**: (a) the exercise picker inside the Stats tab, and (b) a "View progress" affordance on the exercise's detail page in the library.

### Per-exercise chart behavior
- **D-04:** Default metric on open is **estimated 1RM** (Epley e1RM of the best set that session).
- **D-05:** Metric switching is a **segmented toggle above the chart** — one chart, 3-way swap between est-1RM / top set / volume. Not three stacked charts.
- **D-06:** Default time window is **all-time**, with **range chips (3M / 1Y / All)** to filter. Pinch/pan zoom is a nice-to-have only if cheap with victory-native XL — not required.
- **D-07:** Trend-line granularity is **one point per workout** = that session's best set for the exercise (best e1RM / heaviest / session volume depending on metric). NOT one point per set. This keeps the line clean and directly supports STAT-04 responsiveness.

### PR feed shape
- **D-08:** A PR is **rep-max records + best e1RM**: StrengthLog-style best weight at each rep count (1RM, 3RM, 5RM…) plus best estimated 1RM per exercise. (Richer than the existing session-only `detectPRs`, which is weight+e1RM only — planner must design an all-history rep-max computation.)
- **D-09:** Presentation is a **recent chronological feed + per-exercise record board**: main feed = PRs hit recently (newest first, across all exercises); tapping an exercise opens its full record board (all current bests).
- **D-10:** Overview feed is **capped to the most recent N PR events across all exercises**, with a "see all" link to full history. (Pick a sensible N at plan time, e.g. 10–15.)
- **D-11:** PR feed is **computed live from logged sets on every open, never stored** (STAT-03, PROJECT.md key decision) — carried forward, non-negotiable. Cache only if measurably slow, and only as a derived cache.

### Weekly volume by muscle group
- **D-12:** Volume metric is **tonnage (kg × reps)** over working sets — consistent with the existing `workingSetVolume()`. (Not set count.)
- **D-13:** A set is attributed to a muscle group via the **exercise's single `muscle_group` tag, as-is** — no primary/secondary apportioning (secondary-muscle data is not in the current schema/seed). Adding secondary-muscle attribution would be its own scope.
- **D-14:** Chart form is a **stacked bar per week** — one bar per week, segments colored by muscle group (shows both weekly total and mix).
- **D-15:** Week boundary is **Monday–Sunday (ISO-style)**; overview shows the **most recent ~12 weeks** with scroll/expand for older weeks.

### Cross-cutting (carried forward, locked)
- **D-16:** Weights stored canonically in **kg**; all charts/records render in the user's **display unit** setting (LOG-06). Axis labels and record values convert; underlying math stays in kg.
- **D-17:** Estimated 1RM uses the existing **`lib/estimate1RM.ts` (Epley, reps≤1 → weight unchanged)** as the single formula source. Volume uses the existing `lib/volume.ts` convention (warmups excluded).
- **D-18:** Charting library is **victory-native XL (v41)** per CLAUDE.md stack — **not yet installed**; research/plan must add `victory-native` + `@shopify/react-native-skia` (reanimated + gesture-handler already present) and confirm dev-client/EAS build implications.

### Claude's Discretion
- Exact cap N for the overview PR feed, empty-state copy/visuals for new users or exercises with too few data points, chart colors within the dark-first `theme.ts` palette, and whether pinch/pan zoom ships in v1 — all left to planner/executor discretion within the decisions above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` §Stats & PRs — STAT-01, STAT-02, STAT-03, STAT-04 definitions.
- `.planning/ROADMAP.md` §"Phase 4: Stats & Charts" — goal + 4 success criteria.
- `.planning/PROJECT.md` §Key Decisions — "PRs computed from sets, never stored"; "Weights stored in kg canonically".

### Approved design spec
- `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — full approved design (data model, screens, stats behavior). Read the stats/records sections before planning.

### Stack & tooling
- `CLAUDE.md` §Technology Stack — victory-native 41.26.0 + @shopify/react-native-skia 2.9.0 pinning, victory XL API caveat (NOT legacy v36), Vitest-for-pure-logic-only rule, better-sqlite3 in-memory for DB tests.

### Reusable in-repo modules (see code_context below for detail)
- `lib/estimate1RM.ts`, `lib/estimate1RM.test.ts` — Epley e1RM (single source).
- `lib/volume.ts`, `lib/volume.test.ts` — working-set tonnage (warmups excluded).
- `lib/prDetection.ts`, `lib/prDetection.test.ts` — session-only PR logic; the all-history rep-max feed extends this pattern.
- `db/workouts.ts` — established query layer (`loadPriorBests`, `loadWorkoutHistory`, `loadLastPerformance`) and the two-driver (expo-sqlite / better-sqlite3) pattern.
- `db/schema.ts` — `exercises.muscle_group` (single text col, indexed), sets/workouts tables.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/estimate1RM.ts`** — pure Epley; reuse directly for est-1RM chart series and the e1RM PR record. Do not reimplement.
- **`lib/volume.ts` (`workingSetVolume`)** — pure tonnage over non-warmup sets; reuse for both the per-exercise volume metric and the weekly-by-muscle-group tonnage.
- **`lib/prDetection.ts` (`detectPRs`)** — pure, session-vs-prior-best. The PR feed (D-08) needs a broader all-history rep-max computation; model it on this file's pure-function convention (zero RN/Drizzle imports, tested with vitest).
- **`db/workouts.ts`** — `loadPriorBests`, `loadWorkoutHistory`, `loadWorkoutsInMonth`, `loadLastPerformance` show the query idioms and the driver-agnostic `AnyDrizzleDb` signature to follow for new stats queries.

### Established Patterns
- **Two-driver testing:** same `sqlite-core` schema runs against `drizzle-orm/expo-sqlite` (device) and `drizzle-orm/better-sqlite3` (Node/vitest). New stats queries should be testable in-memory — this is also the vehicle for the STAT-04 large-synthetic-dataset performance test.
- **Pure-lib + data-layer split:** math (e1RM, volume, PR/records) lives in `lib/*.ts` as pure functions with vitest coverage; DB reads live in `db/*.ts`. Keep chart-series shaping pure where possible.
- **Theme tokens:** `theme.ts` (dark-first) for all colors/spacing/typography; the Stats tab already exists as a themed placeholder.
- **expo-router tabs:** `app/(tabs)/stats.tsx` is the mount point (currently "Coming soon"); per-exercise chart + "see all" screens follow the existing pushed-route pattern (cf. `app/history/[workoutId].tsx`).

### Integration Points
- `app/(tabs)/stats.tsx` — replace placeholder with the overview dashboard.
- Exercise library detail screen — add the "View progress" entry point (D-03).
- New stats queries slot into `db/` alongside `workouts.ts`; new chart-series/record math into `lib/`.
- **Install gap:** `victory-native` + `@shopify/react-native-skia` are NOT in package.json yet — first build step for this phase.

</code_context>

<specifics>
## Specific Ideas

- Reference feel is **StrengthLog's stats/records** (the paywalled features this project makes free): per-exercise progress graph with metric toggle, a records board with per-rep bests, and weekly volume bars — clean, dark, no upsell. Clone the *behavior*, none of the branding/assets/copy (legal constraint).

</specifics>

<deferred>
## Deferred Ideas

- **Rep-range distribution & session-duration trend charts** — already parked as v2 (STAT-05 in REQUIREMENTS.md). Not this phase.
- **Secondary-muscle volume apportioning** — would enrich STAT-02 but needs new secondary-muscle seed data + schema; its own scope if ever wanted.
- **Pinch/pan zoom on charts** — only if cheap with victory XL; otherwise defer. Range chips (D-06) cover the core need.

### Research flags (for gsd-phase-researcher — carried from STATE.md concerns)
- **Validate `muscle_group` seed values before STAT-02:** confirm the actual distinct `muscle_group` strings in the seeded dataset are consistent and few enough to make a legible stacked bar (STATE.md flagged this as unverified). Decide grouping granularity at plan time based on real values.
- **victory-native XL install + dev-client:** add the charting deps and verify the custom dev-client / EAS build still boots (charts use Skia native module).
- **STAT-04 performance strategy:** design the synthetic-dataset test (years of history) and decide whether per-workout aggregation happens in SQL or JS to stay responsive.

</deferred>

---

*Phase: 4-Stats & Charts*
*Context gathered: 2026-07-22*
