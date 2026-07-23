# Phase 6: Programs & Progression - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver **structured multi-week programs with auto-progression** on top of the
existing templates layer:

- **PROG-01** — Create a program as an **ordered list of template "days"** with a
  next-day pointer; user can build their own program from existing templates.
- **PROG-02** — **Linear progression**: auto-increment an exercise's prescribed
  weight when a day is completed successfully.
- **PROG-03** — **Percent-of-training-max progression** (5/3/1-style waves) driven
  by a per-exercise training max.
- **PROG-04** — Ship a **small set of bundled generic programs** (public
  methodologies, generic names, no proprietary content).

**Already migrated, unused until now:** `programs`, `program_days`,
`program_state`, `training_maxes` tables and `template_exercises.progression`
(JSON text) all exist from migration `0000`. **Phase 6 needs NO new migration for
the program data model** (same "tables already exist" situation as Phase 3);
only an additive migration if a new fail-counter / program-origin column is
needed (see D-05/D-11).

**Out of scope (later phases / v2):**
- Custom progression-rule *editor UI* beyond none/linear/%TM (PROG-05 → v2).
- Multiple concurrent active programs (chose single-active — see D-01).
- Backup/export of programs → Phase 7 (data model must exist first).
- Zero-paywall UI audit / final polish of the programs manager → Phase 8.

</domain>

<decisions>
## Implementation Decisions

### Program structure & advancement (PROG-01)
- **D-01:** **One active program at a time.** `program_state` holds the single
  active program + its `current_day_position`. The Workout-home "Next in program"
  card surfaces exactly one day.
- **D-02:** **Pointer advances on finishing a program workout** — finishing a
  workout that was started from the active program's current day advances the
  pointer AND applies progression at the same moment (design spec §Screens 2:
  "finish screen advances the program pointer"). Not on start, not a manual step.
- **D-03:** **Wrap to day 1, cycle forever.** After the last day, the pointer
  loops to day 1 and the program repeats indefinitely while progression keeps
  climbing. One wrap = one completed cycle (the trigger for %TM TM-bumps, D-08).
- **D-04:** **Tap any day, pointer follows.** The user can start any day of the
  program, not only the pointed one; the pointer moves to whatever they started.
  Forgiving of missed/reordered training days.
- **D-05:** **Advancement/progression are keyed to a program-day origin**, not to
  `workouts.template_id`. A workout must be marked as "started from program P,
  day D" for finishing it to advance/progress that program — reusing a program's
  template in an ad-hoc workout must NOT move the pointer. **Planner:** decide the
  origin marker (e.g. additive `workouts.program_id` + `program_day_position`
  columns, or a session-store field). Additive migration if columns are chosen.

### Linear progression (PROG-02)
- **D-06:** **Success = all prescribed working (non-warmup) sets hit their target
  reps** at the prescribed weight. Strict all-sets rule (warmups excluded, per the
  Phase-2/3 `sets.type='warmup'` convention).
- **D-07:** **Increment is per-exercise**, stored in `template_exercises.progression`
  as `{type:"linear", increment_kg:N}`. Author picks the amount per exercise
  (sensible upper/lower defaults, e.g. 2.5 kg / 5 kg — exact defaults = research).
- **D-08 (linear-miss):** On a **miss, hold** the weight (repeat next time); after
  **N consecutive misses (default ~3) auto-deload by a % (default ~10%)**. Needs a
  small **per-exercise consecutive-fail counter** (planner: where it lives —
  program-scoped state vs an additive column). Exact N and deload % = research.
- **D-09:** **Progressed weight is written to `template_exercises.target_weight_kg`
  in place** on the user's program-instance copy (safe because of D-13's
  user-owned-copy model). No new prescribed-weight table. Next start of that day
  pre-fills the new weight (last-performance pre-fill still applies per Phase-3
  D-01, with the bumped target as the fallback/prescription source).

### Percent-of-training-max waves (PROG-03)
- **D-10:** **Training max is user-set**: manual entry into `training_maxes.max_kg`
  with an optional **"compute from 1RM" helper** (% of an entered 1RM or the user's
  best logged e1RM). Reuses `lib/estimate1RM.ts` (Epley) + the Phase-3 %-of-1RM
  table. Exact TM % (e.g. 90%) = research.
- **D-11:** **The wave is flattened into program days** — each week's session is its
  own `program_days` row whose template exercises carry a **single-session**
  `{type:"percent_tm", sets:[{pct,reps}, ...]}`. The "wave" is simply the ordered
  day list; wrapping past the last day (D-03) = the next cycle. **No separate
  wave-week counter/state.**
- **D-12:** **TM auto-bumps after a full cycle** (pointer wraps past the last day):
  each %TM exercise's TM increases by a **per-exercise amount** (e.g. +2.5 kg upper
  / +5 kg lower — 5/3/1 convention), writing `training_maxes.max_kg`. Exact
  increments = research.
- **D-13 (%TM weights):** Prescribed weight = **`round(TM × pct)` via plate-loadable
  rounding** (`lib/weightUnits.ts`, same as the plate calculator), **pre-filled** on
  each set row when the day starts. Pure `lib/` function, vitest.

### Bundled programs & program creation (PROG-04, PROG-01)
- **D-14:** **Ship two bundled programs** covering both engines: a **linear
  full-body 5×5 (3-day)** and a **4-day percent-of-TM wave (5/3/1-style)**. Generic,
  publicly-documented methodologies; **generic names, no proprietary/trademarked
  content** (legal constraint). Exact day/exercise composition = research/planner.
- **D-15:** **Bundle as data → materialize a user-owned copy on Add/Start.** Bundled
  programs live as JSON/seed definitions (NOT seeded into the DB on launch); adding/
  starting one **clones its templates + `program_days` into user-owned, editable
  rows**. This is what makes D-09's in-place `target_weight_kg` write safe — the
  shared bundle is never mutated. DB stays empty of program rows until the user
  chooses a program. Bundled exercises are referenced by the seed `exercises.seed_id`
  (planner: map methodology lifts to seeded exercises; handle a missing lift).
- **D-16:** **%TM bundled program prompts the user to set/confirm each lift's TM up
  front** (compute-from-1RM helper) before first use — the seed can't know the
  user's TMs. One explicit setup step; correct weights from day 1.
- **D-17:** **Progression rules are authored on `template_exercises` in the Phase-3
  template builder.** The builder gains an optional per-exercise progression field
  (none / linear+increment / %TM sets). A program is then just an ordered list of
  templates as days. One authoring place; reuses `components/TemplateBuilderForm.tsx`
  and the existing `progression` column — no separate program-day rule editor.

### Claude's Discretion (locked defaults — user had no preference)
- **D-09, D-11, D-13, D-15, D-16** were resolved by Claude (user "no preference")
  and are the chosen defaults above; the planner may refine the exact data-shape
  but should keep progression writes isolated to user-owned copies and reuse
  existing `lib/` math.
- "Next in program" home-card layout, programs-manager screen anatomy, and the
  TM-setup sheet visual design → planner / UI-phase discretion.
- Programs manager lives under **Settings/More** per design spec §Screens 6 (settled,
  not a gray area).
- Exact linear increments, deload N/%, %TM TM %, and per-cycle TM bumps → **research**
  (all flagged above); use generic strength-training conventions as defaults.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design spec (locks architecture — read first)
- `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — approved design.
  Relevant: **§ Data model** (`programs` id/name/notes; `program_days`
  id/program_id/position/template_id; `program_state` program_id/current_day_position;
  `training_maxes` exercise_id/max_kg/updated_at; `template_exercises.progression`
  JSON `{type:"linear",increment_kg}` | `{type:"percent_tm",scheme:[...]}`);
  **§ Data model → Decisions** ("Progression lives on template_exercises …
  Finishing a program workout advances program_state"); **§ Screens 1** (Workout
  home "Next in program" card), **§ Screens 2** (finish screen advances the program
  pointer), **§ Screens 6** (programs manager under Settings/More); **§ Testing**
  ("progression logic" is a pure-function vitest target); **§ Suggested build
  phases 3** and the **legal note** (generic public methodologies only, no
  proprietary/trademarked program content).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — PROG-01/02/03/04 acceptance criteria; note
  **PROG-05** (custom progression-rule editor UI) is explicitly **v2**.
- `.planning/ROADMAP.md` § Phase 6 — goal + 4 success criteria; depends on Phase 3.

### Codebase (already exists — reuse; see code_context)
- `db/schema.ts` — `programs`, `programDays`, `programState`, `trainingMaxes`,
  `templateExercises.progression` **already declared** (+ inferred row types).
- `drizzle/0000_cloudy_pet_avengers.sql` — creates all program tables; **no new
  migration needed for the model** (additive only if D-05/D-08 add columns).
- `db/templates.ts` / `db/workouts.ts` — driver-agnostic data-layer pattern to
  mirror for a new `db/programs.ts`; `startWorkoutFromTemplate`,
  `loadLastPerformance`, `loadTemplateDetail` reuse points.
- `lib/estimate1RM.ts` (Epley, TM helper D-10), `lib/weightUnits.ts` (plate-loadable
  rounding for D-13). New pure fns: linear-progression resolver, %TM weight
  computer, deload rule — all `lib/`, vitest, zero RN imports.
- `app/(tabs)/index.tsx` (Workout home — "Next in program" card),
  `app/(tabs)/settings.tsx` (programs manager entry), `app/active-workout/summary.tsx`
  (finish hook — advance pointer + apply progression), `components/TemplateBuilderForm.tsx`
  (per-exercise progression authoring, D-17).
- `.planning/phases/03-templates-folders-calculators/03-CONTEXT.md` — templates
  model, folders, start-from-template pre-fill (D-01), save-as-template (D-02) that
  Phase 6 builds directly on.
- `CLAUDE.md` — stack + constraints (expo-sqlite + Drizzle, Zustand, dark-first).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Program tables + progression column already migrated** (schema.ts + 0000) —
  no model migration; only additive columns if D-05 (program origin marker) or
  D-08 (fail counter) need them.
- `db/templates.ts` (`startWorkoutFromTemplate`, `loadTemplateDetail`,
  `setTemplateExercises`) and `db/workouts.ts` (`loadLastPerformance`,
  `finishWorkout`) — the data-layer + pre-fill machinery programs sit on.
- `lib/estimate1RM.ts` + `lib/weightUnits.ts` — TM-from-1RM helper (D-10) and
  plate-loadable rounding of computed %TM weights (D-13).
- `components/TemplateBuilderForm.tsx` — shared builder (new.tsx + [templateId].tsx)
  to extend with the per-exercise progression field (D-17).
- Exercise-library seed pattern (idempotent, no-clobber, `seed_id` keyed) —
  the model for the bundled-program JSON definitions (D-15).
- `Alert.alert` confirm, `useFocusEffect` reload, route-group `_layout`,
  `NumericKeypad`, `ToastAndroid` — established Phase 1–5 UI patterns.

### Established Patterns
- **No migration for the program model** (like Phase 3 for templates).
- Pure progression math in `lib/` + vitest (design spec §Testing explicitly lists
  "progression logic").
- Pre-fill = last completed performance with a target/prescription fallback
  (Phase-3 D-01) — extended so a program day's prescription (linear target or
  computed %TM weight) is the fallback source.
- Progression applied transactionally at finish (mirror `db/templates.ts`
  synchronous `db.transaction(...run())` convention; both drivers are sync).

### Integration Points
- **Workout home** (`app/(tabs)/index.tsx`) — new "Next in program" card (single
  active program, D-01) alongside start-empty / start-from-history / templates.
- **Settings/More** (`app/(tabs)/settings.tsx`) — programs manager: add a bundled
  program, build a custom program (ordered template days), set/confirm TMs.
- **Finish flow** (`app/active-workout/summary.tsx`) — after `finishWorkout`, if
  the workout has a program origin (D-05): evaluate success (D-06), apply linear
  bump or %TM cycle logic, advance/wrap the pointer (D-02/D-03).
- **Template builder** (`components/TemplateBuilderForm.tsx`) — per-exercise
  progression authoring writes `template_exercises.progression` (D-17).
- New `db/programs.ts` (CRUD + advance + apply-progression) and `db/trainingMaxes.ts`
  (or fold in); new `lib/progression.ts` pure resolvers.

</code_context>

<specifics>
## Specific Ideas

- **Programs are a plan that tracks reality** — consistent with the Phase-3 stance:
  the user chose in-place progression on the program-instance copy + last-performance
  pre-fill so the prescribed weights climb automatically without freezing a snapshot.
- **The wave = the ordered day list.** The deliberate simplification (D-11) is to
  express a 5/3/1 wave as distinct program days rather than a scheme+week-pointer,
  so the whole feature reuses `program_days` ordering + the cycle-forever pointer
  with no extra weekly state.
- **Bundled programs are a starting point, not a fixture** — cloned to user-owned,
  fully-editable rows on Add/Start (D-15) so the user can tweak them and progression
  can mutate them safely.
- Legal: bundled programs use generic public methodologies and generic names only.

</specifics>

<deferred>
## Deferred Ideas

- **Multiple concurrent active programs** — chose single-active (D-01) for v1; a
  program picker + multi-pointer state is a future enhancement.
- **Custom progression-rule editor UI** (arbitrary schemes beyond none/linear/%TM)
  — explicitly **PROG-05 / v2** in REQUIREMENTS.md.
- **Configurable deload rule** (user-set N misses / deload %) — v1 uses sensible
  defaults; making it user-editable is a later refinement.
- **A third bundled program / richer program library** — start with two (D-14);
  add more once the two engines are validated in the friends beta.
- **Backup/export of programs & training maxes** → Phase 7 (needs the model first).

None of the above were pulled into Phase 6 scope.

</deferred>

---

*Phase: 6-programs-progression*
*Context gathered: 2026-07-23*
