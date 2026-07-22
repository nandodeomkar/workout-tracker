# Phase 3: Templates, Folders & Calculators - Context

**Gathered:** 2026-07-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the planning + utility layer that makes logging faster: **reusable workout
templates** organized in flat folders, **starting a workout from a template**
(pre-filled), **saving a finished workout as a template**, and three **inline utility
calculators** — plate calculator, 1RM calculator, and warm-up set suggestions.
Requirements: TMPL-01, TMPL-02, TMPL-03, UTIL-01, UTIL-02, UTIL-03.

**Out of scope (later phases):** progression rules on templates (linear / %-of-TM) and
the "Next in program" pointer — the `template_exercises.progression` column and
programs/program_days/program_state/training_maxes tables already exist but stay unused
until **Phase 6**. Stats/charts/PR feed → **Phase 4**. Body measurements → **Phase 5**.
Backup/export → **Phase 7**.

</domain>

<decisions>
## Implementation Decisions

### Templates — pre-fill & save (TMPL-02, TMPL-03)
- **D-01:** Start-from-template pre-fill — the template supplies **structure** (exercise
  list + per-exercise target working-set count). Each set row's weight/reps then pre-fill
  from that exercise's **last completed performance** (the Phase-2 D-06 model), **falling
  back to the template's `target_weight_kg` / `target_reps`** when the exercise has no
  history. Templates stay a plan, not a frozen snapshot — weights track real lifting.
- **D-02:** "Save finished workout as template" captures the **exercise list + per-exercise
  working-set count + typical reps** as targets; `target_weight_kg` is left **null** so
  weights always come from last-performance pre-fill. Warmup sets are excluded from the
  captured set count.

### Template creation & folders (TMPL-01)
- **D-03:** **Two creation paths** — (a) a dedicated template **builder** (add / reorder /
  remove exercises via the reused exercise picker; set target sets/reps per exercise) and
  (b) **save-from-finished-workout** (D-02). Editing an existing template reuses the builder.
- **D-04:** Folder = the existing flat **`templates.folder` text column**. Assigned via a
  free-text "Folder" field on the template name/edit screen that offers existing folder
  names as tap suggestions; `null` = **Uncategorized**. No nested folders, no separate
  folder-management screen.
- **D-05:** The **Workout home** lists templates grouped under **collapsible folder section
  headers** (+ an Uncategorized bucket), alongside the existing Start-empty / Start-from-history.
  Tapping a template starts a workout from it (writes `workouts.template_id`).

### Plate calculator (UTIL-01)
- **D-06:** **Bar weight is a global Setting** (default **20 kg / 45 lb** resolved by the
  active unit). Available plates assumed a **standard set per unit** (kg: 25/20/15/10/5/2.5/1.25;
  lb: 45/35/25/10/5/2.5). User-editable plate **inventory is deferred (v2)**.
- **D-07:** Invoked **inline per-exercise** — a plates affordance on the exercise card / set
  row opens a sheet with the **per-side breakdown** for the current target weight; the weight
  is editable to any value; also usable as a standalone calculator.
- **D-08:** When a weight isn't exactly loadable, show the **nearest achievable weight + its
  per-side plates + the delta** (e.g. "closest 102.5 kg, +0.5"). Plate-solve is a **pure
  `lib/` function (vitest)**, reusing `weightUnits` rounding.

### Warm-up suggestions (UTIL-03)
- **D-09:** Scheme = fixed **%-of-working-weight ladder** (empty bar → ~40% → 60% → 80%,
  descending reps ~8/5/3/2), each **rounded to a plate-achievable weight** (reuses the D-08
  plate solver). Configurable scheme deferred (v2).
- **D-10:** Warm-ups **auto-insert as warmup set rows** using the existing
  `sets.type='warmup'` (excluded from volume/PR), **one tap to accept**; user can adjust or
  delete. Reuses the Phase-2 warmup type end-to-end.

### 1RM calculator (UTIL-02)
- **D-11:** Enter **weight × reps → estimated 1RM** via the existing **`lib/estimate1RM.ts`
  (Epley** — same formula as the Phase-2 PR check and Phase-4 stats) **plus a %-of-1RM table**
  for programming. Reachable **inline** from an exercise (prefilled with the current set) **and
  as a standalone tool**.

### Claude's Discretion
- Standalone-calculator placement (a "Tools" area under **More** vs elsewhere).
- Exact warm-up %/rep ladder values and number of warm-up sets (sensible strength defaults;
  flag in research).
- Template-builder screen anatomy, folder-section collapse UI, plate-sheet visual design.
- Whether "typical reps" captured by save-as-template (D-02) uses the last working set's reps
  vs the modal reps.
- `settings` key name for bar weight + how the standard plate set is represented.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design spec (locks architecture — read first)
- `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — approved design. Relevant:
  **§ Data model** (`templates`: id/name/folder/position/notes; `template_exercises`:
  target_sets/target_reps/target_weight_kg + progression JSON; `workouts.template_id`),
  **§ Screens item 1 Workout home** (template list with folders, start-from-template),
  **§ Screens item 2 Active workout** ("per-exercise warm-up suggestion and plate calculator"
  inline), **§ Testing** (pure-function tests for 1RM / plate / warm-up calculators).

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — TMPL-01/02/03, UTIL-01/02/03 acceptance criteria.
- `.planning/ROADMAP.md` § Phase 3 — goal + 5 success criteria.

### Codebase
- `db/schema.ts` — `templates`, `template_exercises`, `workouts.template_id`, and `settings`
  **already exist** (Phase-1 13-table schema). **Phase 3 needs NO migration** for
  templates/folders; only an additive path if a new settings key is stored.
  `template_exercises.progression` stays unused until Phase 6.
- `db/workouts.ts` — `startWorkout({ templateId })` already accepts a template link;
  `loadLastPerformance` is the pre-fill source to reuse for D-01. Mirror this parameterized,
  driver-agnostic data-layer pattern for a new `db/templates.ts`.
- `lib/estimate1RM.ts` — Epley 1RM, reuse for UTIL-02. `lib/weightUnits.ts` — kg↔lb +
  plate-loadable rounding, reuse for plate/warm-up math. New pure fns needed: plate solver +
  warm-up ladder (both `lib/`, vitest, zero RN imports).
- `app/active-workout/[workoutId].tsx` + `components/ExerciseCard.tsx` / `SetRow.tsx` — inline
  calculators hang off the exercise card; warm-up auto-insert reuses `handleAddSet` +
  `sets.type='warmup'`. `components/ExerciseRow.tsx` / `FilterChipRow.tsx` /
  `MuscleGroupPills.tsx` — reuse in the template builder's exercise picker.
- `CLAUDE.md` — stack + constraints (expo-sqlite + Drizzle, Zustand, dark-first theme tokens).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `db/workouts.ts` — `loadLastPerformance` (pre-fill source, D-01), `startWorkout(templateId)`.
- `lib/estimate1RM.ts` (UTIL-02) and `lib/weightUnits.ts` (plate math + display rounding).
- Exercise-picker components (`ExerciseRow` / `FilterChipRow` / `MuscleGroupPills`) — template builder.
- `Alert.alert` confirm, `useFocusEffect` reload, route-group `_layout` (no phantom tabs),
  `ToastAndroid` transient feedback — established Phase 1/2 patterns.
- Active-workout set row + warmup toggle (`sets.type='warmup'`) for warm-up auto-insert (D-10).

### Established Patterns
- **No migration for templates** — unlike Phase 2, all target tables already exist in the schema.
- Pure logic in `lib/` with vitest (plate solver, warm-up ladder, reuse est-1RM/weightUnits).
- Pre-fill = last completed performance per exercise (Phase-2 D-06), extended here with a
  template-target fallback (D-01).

### Integration Points
- **Workout home** ("Workout" tab) gains a folder-grouped template list + start-from-template,
  next to Start-empty / Start-from-history.
- **Finish/summary screen** gains "Save as template" (D-02); a **template builder** route for D-03.
- **Active-workout exercise card** mounts the inline plate / warm-up / 1RM calculators.
- Reads the `exercises` library; reads/writes `templates` + `template_exercises`; reads
  `settings` (bar weight); sets `workouts.template_id` on start.

</code_context>

<specifics>
## Specific Ideas

- Templates are a **plan, not a frozen snapshot** — the user chose structure-only save (D-02) +
  history-with-target-fallback pre-fill (D-01) so weights track real lifting automatically.
- Calculators must be **fast and inline in the gym** — plate sheet prefilled with the current
  weight (D-07); warm-ups accepted in one tap (D-10).

</specifics>

<deferred>
## Deferred Ideas

- **User-editable plate inventory** and per-exercise / alternate **bar weight** → v2.
- **Configurable warm-up scheme** editor (custom % steps / reps) → v2.
- **Progression rules** on `template_exercises` (linear / %-of-training-max) and the "Next in
  program" home card → **Phase 6** (columns/tables exist, unused now).
- Standalone **Tools/utilities hub** polish → planner discretion / Phase 8.

None of the above were pulled into Phase 3 scope.

</deferred>

---

*Phase: 3-templates-folders-calculators*
*Context gathered: 2026-07-22*
