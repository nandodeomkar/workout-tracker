# Phase 1: Scaffold & Data Foundation - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The app has a durable local data foundation — an Expo scaffold with offline SQLite storage (expo-sqlite + Drizzle, versioned migrations) that survives schema upgrades — and a searchable, filterable exercise library (seeded from free-exercise-db) to log against, including custom exercise create/edit/archive. Requirements: FNDN-01, FNDN-02, EXER-01, EXER-02. Workout logging, templates, stats, and backup are later phases.

</domain>

<decisions>
## Implementation Decisions

### Exercise taxonomy & curation
- **D-01:** Each exercise gets exactly **one primary muscle group** from a fixed ~10-item list (Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings, Glutes, Core, Other). No secondary muscles. This is load-bearing for Phase 4 weekly-volume-by-muscle-group stats — each set counts once.
- **D-02:** Equipment is a fixed short list: Barbell, Dumbbell, Machine, Cable, Bodyweight, Kettlebell, Band, Other. free-exercise-db values re-mapped to these during curation.
- **D-03:** Library size target **~400–500 exercises** (not the spec's ~250): trim only clear junk/obscure duplicates from free-exercise-db's ~870. Bigger library preferred over aggressive curation risk. (Supersedes the "~250" figure in EXER-01/spec — refinement, not scope change.)
- **D-04:** Seed ships as **bundled JSON**, inserted on first launch, with a **seed-version row**. Future app updates may add exercises additively; updates **never overwrite user-edited rows**.

### Library browse & search UX
- **D-05:** Exercises tab default view: **flat A–Z list** with sticky search bar and filter chips on top. No muscle-group section headers.
- **D-06:** Search is **live substring filter-as-you-type on name only**, case-insensitive, matches anywhere in the name. No fuzzy matching, no tag-text search (chips cover tags).
- **D-07:** Filters: two chip rows (muscle group, equipment), **multi-select**; chips within a row combine as OR, across rows as AND. Active filters visible at a glance, one-tap clear.
- **D-08:** List row = exercise name + secondary line "muscle group · equipment". Custom exercises **mixed into the A–Z list** with a small "custom" badge — no separate section.

### Custom exercise lifecycle
- **D-09:** Creation form: **name (required) + muscle group + equipment** (picked from the same fixed lists as seeded exercises) + optional notes. Nothing else.
- **D-10:** **Seeded exercises are user-editable** (rename/re-tag) in place. Combined with D-04: seed updates never clobber edited rows.
- **D-11:** **Archive** (custom and seeded alike): hidden from library list and future pickers, a toggle reveals archived; logged history and stats remain intact; reversible. **No hard delete in v1.**
- **D-12:** Duplicate names: **warn but allow** — inline hint "X already exists — open it?" with a proceed-anyway option.

### Scaffold breadth
- **D-13:** Build the **full 5-tab expo-router shell** now (Workout, History, Exercises, Stats, Settings/More). Exercises fully functional; other tabs show clean "coming soon" empty states. Later phases fill existing slots — no nav rework.
- **D-14:** **Theme token file (`theme.ts`)** — colors/spacing/typography tokens consumed by all components. **Dark-only in Phase 1**; light theme is a later token swap. No ad-hoc inline styling.
- **D-15:** **Migration 0001 creates the full schema from the design spec** (exercises, workouts, workout_exercises, sets, templates, template_exercises, programs, program_days, program_state, training_maxes, body_measurements, settings, backup_meta). Phase 1 populates only exercises + settings. FNDN-02 migration testing runs against the real schema.
- **D-16:** First launch: **silent seed, land directly on tabs**. No onboarding flow, no unit picker (default kg; settings toggle arrives later), no seed progress screen.

### Claude's Discretion
- Drizzle migration ergonomics, exact seed-JSON shape, seed-version bookkeeping mechanics, chip/list component structure, and curation script details — researcher/planner decide within the decisions above.
- Exercise detail screen depth in Phase 1 (spec describes history/records/1RM chart, but those need logged data — a minimal detail/edit view is acceptable this phase).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product & architecture
- `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — Approved design spec: full data model (Drizzle schema for all tables), screen layout (5-tab), architecture decisions (kg canonical, PRs computed not stored, crash-safe writes), error handling, testing strategy. Migration 0001 (D-15) implements its data-model section verbatim.
- `.planning/REQUIREMENTS.md` — FNDN-01, FNDN-02, EXER-01, EXER-02 definitions and traceability.
- `CLAUDE.md` — Locked tech stack with exact versions (Expo SDK 57, drizzle-orm 0.45.2, expo-sqlite 57.0.1, babel-plugin-inline-import for .sql migrations, expo-dev-client from day one, better-sqlite3 for DB tests) and known gotchas (Expo Go incompatible once Drizzle wired in).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield repo, no app code yet. Phase 1 creates the scaffold everything else builds on.

### Established Patterns
- None to inherit. Patterns established here (theme tokens, Drizzle schema module shared between expo-sqlite and better-sqlite3 drivers, expo-router file layout) become the project conventions.

### Integration Points
- Drizzle schema must live in a driver-agnostic module so vitest + better-sqlite3 can test the DB layer without a device (per CLAUDE.md testing strategy).
- expo-dev-client + EAS development build required from this phase onward — expo-sqlite with Drizzle does not run in Expo Go.

</code_context>

<specifics>
## Specific Ideas

- StrengthLog is the explicit UX reference (flat searchable list, single muscle group per exercise) — clean-room: patterns yes, assets/branding never.
- STATE.md concern to address during curation: verify muscle-group tagging consistency of the actual free-exercise-db data against the fixed 10-group list (flagged as a Phase 4 stats risk).

</specifics>

<deferred>
## Deferred Ideas

- **Recent/frequent-first exercise ordering** in the exercise picker — belongs in Phase 2+ (active-workout picker context), not the library tab.
- **Light theme** — token swap in a later phase (Phase 8 polish per spec's "light available").
- **Functional Settings screen** (units, rest defaults, plates) — settings table exists from migration 0001, but the UI belongs to later phases.

</deferred>

---

*Phase: 1-Scaffold & Data Foundation*
*Context gathered: 2026-07-19*
