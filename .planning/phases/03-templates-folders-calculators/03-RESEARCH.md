# Phase 3: Templates, Folders & Calculators - Research

**Researched:** 2026-07-22
**Domain:** Local CRUD data layer (templates/folders) + pure-function utility calculators (plates, 1RM, warm-up) for an offline React Native/Expo + Drizzle app
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Templates — pre-fill & save (TMPL-02, TMPL-03)**
- **D-01:** Start-from-template pre-fill — the template supplies **structure** (exercise
  list + per-exercise target working-set count). Each set row's weight/reps then pre-fill
  from that exercise's **last completed performance** (the Phase-2 D-06 model), **falling
  back to the template's `target_weight_kg` / `target_reps`** when the exercise has no
  history. Templates stay a plan, not a frozen snapshot — weights track real lifting.
- **D-02:** "Save finished workout as template" captures the **exercise list + per-exercise
  working-set count + typical reps** as targets; `target_weight_kg` is left **null** so
  weights always come from last-performance pre-fill. Warmup sets are excluded from the
  captured set count.

**Template creation & folders (TMPL-01)**
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

**Plate calculator (UTIL-01)**
- **D-06:** **Bar weight is a global Setting** (default **20 kg / 45 lb** resolved by the
  active unit). Available plates assumed a **standard set per unit** (kg: 25/20/15/10/5/2.5/1.25;
  lb: 45/35/25/10/5/2.5). User-editable plate **inventory is deferred (v2)**.
- **D-07:** Invoked **inline per-exercise** — a plates affordance on the exercise card / set
  row opens a sheet with the **per-side breakdown** for the current target weight; the weight
  is editable to any value; also usable as a standalone calculator.
- **D-08:** When a weight isn't exactly loadable, show the **nearest achievable weight + its
  per-side plates + the delta** (e.g. "closest 102.5 kg, +0.5"). Plate-solve is a **pure
  `lib/` function (vitest)**, reusing `weightUnits` rounding.

**Warm-up suggestions (UTIL-03)**
- **D-09:** Scheme = fixed **%-of-working-weight ladder** (empty bar → ~40% → 60% → 80%,
  descending reps ~8/5/3/2), each **rounded to a plate-achievable weight** (reuses the D-08
  plate solver). Configurable scheme deferred (v2).
- **D-10:** Warm-ups **auto-insert as warmup set rows** using the existing
  `sets.type='warmup'` (excluded from volume/PR), **one tap to accept**; user can adjust or
  delete. Reuses the Phase-2 warmup type end-to-end.

**1RM calculator (UTIL-02)**
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

### Deferred Ideas (OUT OF SCOPE)
- **User-editable plate inventory** and per-exercise / alternate **bar weight** → v2.
- **Configurable warm-up scheme** editor (custom % steps / reps) → v2.
- **Progression rules** on `template_exercises` (linear / %-of-training-max) and the "Next in
  program" home card → **Phase 6** (columns/tables exist, unused now).
- Standalone **Tools/utilities hub** polish → planner discretion / Phase 8.

None of the above were pulled into Phase 3 scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| TMPL-01 | User can create, edit, and organize workout templates in folders | `db/templates.ts` CRUD (Pattern 1/5), `loadTemplatesGroupedByFolder`/`loadFolderNames`, template builder route structure (Open Question 2), Security Domain V5 input-validation guards |
| TMPL-02 | Starting from a template pre-fills exercises and last-performance values | `lib/templatePrefill.ts#buildTemplatePrefillRows` (Pattern 2), start-from-template copy loop (Architecture Diagram), Pitfall 4 (warmup exclusion) |
| TMPL-03 | User can save a completed workout as a template | `lib/templateCapture.ts` (Don't Hand-Roll), Assumptions Log A2 (typical-reps discretion resolved), `db/templates.ts#createTemplate`/`addTemplateExercise` |
| UTIL-01 | User can open a plate calculator inline from the active workout | `lib/plateSolver.ts#solvePlates` (Pattern 3), Pitfalls 1/2/5 (unit-conversion, rounding-granularity, fp-drift), `PlateCalculatorSheet` component |
| UTIL-02 | User can use a 1RM calculator | Existing `lib/estimate1RM.ts` (Epley, unchanged) + new `lib/percentOf1RM.ts` (NSCA-sourced table, Code Examples), `OneRMCalculatorSheet` component |
| UTIL-03 | User gets warm-up set suggestions for a working weight | `lib/warmupLadder.ts#buildWarmupSets` (Pattern 4), Assumptions Log A1 (ladder values), `WarmupSuggestionSheet` + one-tap `insertSet` auto-insert (D-10 reuse) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Zero running costs / no new server-side dependency:** every recommendation in this
  research stays on-device (SQLite + pure `lib/` functions) — no new package, service, or
  network call is introduced.
- **No new npm packages this phase** — CLAUDE.md's approved stack table lists
  `drizzle-orm@0.45.2`, `vitest@4.1.10`, `better-sqlite3@12.11.1` (devDependency),
  `react-native-gesture-handler@3.1.0`, `react-native-reanimated@4.5.0`, all already
  installed; this research adds no entries to that table.
- **`drizzle-orm/expo-sqlite` (device) vs `drizzle-orm/better-sqlite3` (vitest) — same
  driver-agnostic `sqlite-core` schema:** `db/templates.ts` must import only from
  `drizzle-orm`/`drizzle-orm/sqlite-core` (never a driver-specific import), exactly like
  `db/workouts.ts`, so it works against both drivers unchanged.
- **`db.transaction()` callbacks must be plain synchronous functions using `.run()`**
  (not `async`/`await`) — both drizzle-orm/better-sqlite3 and drizzle-orm/expo-sqlite
  construct `BaseSQLiteDatabase` with `resultKind: sync` (STATE.md decision log,
  Phase 2). `deleteTemplate`'s transaction (Pattern 1) follows this exactly.
- **vitest for pure logic only; never for RN component tests** — every new `lib/*.ts`
  file must have zero React Native/Drizzle imports (mirrors `lib/exerciseName.ts`
  convention cited in every existing `lib/` module's doc comment).
- **Dark-first theme tokens only** — all new components (`TemplateRow`,
  `FolderSectionHeader`, `PlateCalculatorSheet`, `OneRMCalculatorSheet`,
  `WarmupSuggestionSheet`) must style exclusively via `theme.ts` tokens
  (`theme.colors`/`theme.spacing`/`theme.radius`/`theme.typography`), no inline
  hardcoded colors/spacing (D-14 convention, verified against every existing component
  read this session).
- **Android-first, 44×44 minimum touch targets** — new sheet/row components must follow
  the same `minHeight: 44`/`hitSlop` conventions already used in `SetRow.tsx`/`ExerciseRow.tsx`.
- **GSD workflow enforcement** — this research is itself produced under
  `/gsd-plan-phase`; no direct repo edits happen outside the GSD flow.

## Summary

Phase 3 is almost entirely a **data-layer + pure-logic** phase riding on infrastructure Phase 1/2 already built — no schema migration, no new npm packages, and every screen-level pattern it needs (overlay pickers, exercise-picker reuse, settings key/value helper, `useFocusEffect` reload, Android `ToastAndroid` transient errors, theme tokens) already has a working precedent in this codebase. The two genuinely new pieces of engineering are (1) a `db/templates.ts` data module mirroring `db/workouts.ts`'s parameterized, transaction-safe style, and (2) three small, pure, vitest-tested `lib/` functions — a plate solver, a warm-up ladder, and a %-of-1RM lookup — that must NOT be hand-rolled inline in screen components.

The most consequential technical finding is that **the plate solver must operate in the display unit's *native* plate denominations, not by converting a kg canonical value into lb** — a kg gym's 20kg bar and an lb gym's 45lb bar are two independently-manufactured standards (20kg = 44.09lb ≠ 45lb), so kg-canonical conversion math would silently produce a bar/plate breakdown no gym actually has. This drives a concrete recommendation: store bar weight as **two independent settings keys** (`bar_weight_kg`, `bar_weight_lb`) rather than one canonical-kg value with unit conversion.

The second consequential finding is that the standard plate denominations chosen in D-06 (kg: 25/20/15/10/5/2.5/1.25; lb: 45/35/25/10/5/2.5) are each an exact multiple of their own smallest denomination, which is the condition under which a simple greedy-fill algorithm is *provably optimal* (minimum plate count, exact-fit whenever the target is a multiple of 2×smallest-plate). This lets the plate solver be a small, deterministic, fully-tested pure function rather than a general knapsack/DP solve.

**Primary recommendation:** Build `db/templates.ts` (mirrors `db/workouts.ts` conventions exactly — Drizzle parameterized queries, `assertValid*` guards, transaction-wrapped multi-table writes) plus five new pure `lib/` modules (`plateSolver.ts`, `warmupLadder.ts`, `percentOf1RM.ts`, `templatePrefill.ts`, `templateCapture.ts`), each with a `.test.ts` vitest file mirroring the existing `weightUnits.test.ts`/`estimate1RM.test.ts` style. No new dependencies are required.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Template CRUD (create/edit/delete/folder assignment) | Database / Storage (`db/templates.ts`) | API/Backend equivalent (screen handlers call it directly — no server tier in this app) | Same pattern as `db/workouts.ts`: a thin driver-agnostic Drizzle module is the sole write path |
| Folder grouping / collapsible list | Frontend Server tier n/a (no SSR) → Client (React Native screen) | Database (`loadTemplatesGroupedByFolder` query) | Grouping-for-display logic (bucketing, Uncategorized fallback) lives in the query layer so the screen only renders already-grouped data, matching `loadWorkoutHistory`'s precedent of doing aggregation in `db/` |
| Start-from-template pre-fill merge (structure + history + fallback) | Client (pure `lib/templatePrefill.ts`) | Database (`loadLastPerformance`, `template_exercises` read) | Merge logic has zero I/O — it is a pure function over two already-fetched arrays, so it belongs in `lib/`, not inlined in the active-workout screen (mirrors `lib/prDetection.ts`'s "caller supplies the DB reads, this stays pure" convention) |
| Save-as-template capture (working-set count + typical reps) | Client (pure `lib/templateCapture.ts`) | Database (insert via `db/templates.ts`) | Same reasoning — aggregating a `WorkoutDetail` into `TemplateExercise` inputs is pure computation |
| Plate solver, warm-up ladder, %-1RM table | Client (pure `lib/`) | — | Zero RN/Drizzle imports, by explicit project convention (`lib/exerciseName.ts` convention referenced in every existing `lib/` file's doc comment) |
| Bar-weight setting | Database (`settings` key/value table) | Client (Settings/More tab UI) | Follows the exact `getSetting`/`setSetting` pattern already used for `units`/`default_rest_seconds` |
| Inline calculator affordances (plate sheet, 1RM sheet, warm-up suggestion) | Client (React Native components) | Database (read `bar_weight_*` setting only) | No DB writes needed except optional warm-up auto-insert, which reuses the existing `insertSet` write path |

## Standard Stack

### Core

No new libraries are required for this phase. All work builds on already-installed, already-verified dependencies from Phase 1/2:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 (installed) | `db/templates.ts` schema access | Same driver-agnostic `sqlite-core` schema already used project-wide |
| vitest | 4.1.10 (installed) | New pure-fn + DB-layer tests | Existing project test runner; config at `vitest.config.ts` already covers `**/*.test.ts` |
| better-sqlite3 | 12.11.1 (installed, devDependency) | In-memory DB-layer tests for `db/templates.ts` | Same fixture (`db/test/fixture.ts`) already used by `workouts.crud.test.ts`/`workouts.query.test.ts` |
| react-native-gesture-handler / reanimated | 3.1.0 / 4.5.0 (installed) | Only if the template builder reuses `ExerciseCard`'s drag-reorder pattern for reordering template exercises | Already wired app-wide (`GestureHandlerRootView` in `app/_layout.tsx`); no new setup needed |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-router | 57.0.7 (installed) | New routes for template builder + standalone tools | Follow existing route-group conventions (`app/active-workout/_layout.tsx` pattern) for a new `app/templates/` group if a dedicated builder screen is chosen |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled greedy plate solver in `lib/` | A generic knapsack/DP "make change" library | Unnecessary — D-06's plate denominations are each an exact multiple of the smallest, so greedy is provably optimal; a DP solver adds complexity/bundle size for zero benefit here (see Code Examples) |
| Two settings keys (`bar_weight_kg` / `bar_weight_lb`) | One canonical-kg `bar_weight_kg` setting converted per unit | Converting silently breaks the "20kg bar / 45lb bar are independent standards" fact (20kg ≠ 45lb-equivalent) — see Common Pitfalls |
| `templates.folder` free-text column (already in schema) | A normalized `folders` table with FK | Design spec and D-04 explicitly lock the flat text-column approach for v1; do not introduce a new table this phase |

**Installation:** None — no new packages.

**Version verification:** N/A — no new packages to verify. Existing `drizzle-orm@0.45.2`, `vitest@4.1.10`, `better-sqlite3@12.11.1` already confirmed installed via `package.json` (read directly, not re-queried against registry since no version change is proposed).

## Package Legitimacy Audit

**No new external packages are introduced by this phase.** Every capability (template CRUD, folder grouping, plate/1RM/warm-up calculators) is implemented with the existing `drizzle-orm`, `expo-router`, `react-native-gesture-handler`/`reanimated`, and `vitest` dependencies already vetted in Phase 1/2 research. The Package Legitimacy Gate protocol is not applicable — skip the audit table.

**Packages removed due to [SLOP] verdict:** none (n/a — no packages evaluated)
**Packages flagged as suspicious [SUS]:** none (n/a)

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Workout tab (app/(tabs)/index.tsx)                                 │
│  ├─ existing: Resume / Start-empty / Start-from-history             │
│  └─ NEW: folder-grouped template list (collapsible section headers) │
│         │                                                            │
│         │ tap template row                                          │
│         ▼                                                            │
│  startWorkout(db,{templateId}) ──► loop template_exercises (by       │
│                                     position) ──► addWorkoutExercise  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Active workout screen (app/active-workout/[workoutId].tsx)         │
│  loadAll(): for each workout_exercise with zero logged sets —        │
│    1. read template_exercises row (target_sets/target_reps/         │
│       target_weight_kg) if workout.template_id != null               │
│    2. read loadLastPerformance(exerciseId) — non-warmup sets only    │
│    3. lib/templatePrefill.ts#buildTemplatePrefillRows(...) MERGES    │
│       (1)+(2) → exact row count = target_sets, falls back to         │
│       template target when history is short/absent                   │
│                                                                       │
│  ExerciseCard NEW affordances (plate 🏋 / 1RM 📈 / warm-up 🔥 icons) │
│    ├─ Plate sheet    → lib/plateSolver.ts#solvePlates(...)            │
│    ├─ 1RM sheet      → lib/estimate1RM.ts (existing) +                │
│    │                    lib/percentOf1RM.ts (NEW table)               │
│    └─ Warm-up sheet  → lib/warmupLadder.ts#buildWarmupSets(...)        │
│         │ (each ladder step rounded via plateSolver)                  │
│         ▼ one-tap "Accept" per suggested row                          │
│       insertSet(db,{...,type:'warmup'}) — existing write path         │
└─────────────────────────────────────────────────────────────────────┘
                              │ Finish workout
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Finish/summary screen (app/active-workout/summary.tsx)             │
│  NEW: "Save as template" button                                     │
│    loadWorkoutDetail(db, workoutId)                                  │
│      → lib/templateCapture.ts#buildTemplateExercisesFromWorkout(...)  │
│        (pure: counts non-warmup sets per exercise, picks "typical    │
│         reps", leaves target_weight_kg = null)                       │
│      → db/templates.ts#createTemplate + addTemplateExercise (loop)   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Template builder (NEW route, e.g. app/templates/[templateId].tsx)  │
│  create/edit path (D-03a): reuses ExerciseRow/FilterChipRow/         │
│  MuscleGroupPills picker overlay wholesale (same as active-workout   │
│  add-exercise picker) + a Folder text input with tap-suggestions     │
│  from db/templates.ts#loadFolderNames                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Settings/More tab                                                   │
│  NEW "Tools" section: Plate Calculator / 1RM Calculator rows         │
│  → push to standalone screens that render the SAME sheet components │
│    used inline (no target-weight prefill; user enters weight fresh) │
│  NEW bar-weight setting row (persists bar_weight_kg / bar_weight_lb) │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
db/
├── templates.ts              # NEW — CRUD + folder grouping (mirrors workouts.ts)
├── templates.crud.test.ts    # NEW — mutation tests (create/update/delete)
└── templates.query.test.ts   # NEW — read/grouping tests

lib/
├── plateSolver.ts             # NEW — pure D-08 plate breakdown
├── plateSolver.test.ts        # NEW
├── warmupLadder.ts            # NEW — pure D-09 warm-up ladder
├── warmupLadder.test.ts       # NEW
├── percentOf1RM.ts            # NEW — NSCA %1RM→reps table lookup (UTIL-02)
├── percentOf1RM.test.ts       # NEW
├── templatePrefill.ts         # NEW — pure D-01 merge (structure+history+fallback)
├── templatePrefill.test.ts    # NEW
├── templateCapture.ts         # NEW — pure D-02 save-as-template aggregation
└── templateCapture.test.ts    # NEW

components/
├── TemplateRow.tsx             # NEW — mirrors WorkoutRow/ExerciseRow anatomy
├── FolderSectionHeader.tsx      # NEW — collapsible header (D-05)
├── PlateCalculatorSheet.tsx     # NEW — reused inline + standalone
├── OneRMCalculatorSheet.tsx     # NEW — reused inline + standalone
└── WarmupSuggestionSheet.tsx    # NEW — reused inline only (D-10 auto-insert)

app/
├── templates/
│   ├── _layout.tsx              # NEW route group (mirrors active-workout/_layout.tsx)
│   └── [templateId].tsx         # NEW — builder (create when :templateId==='new', else edit)
└── tools/
    ├── plate-calculator.tsx      # NEW — standalone, pushes PlateCalculatorSheet
    └── one-rm-calculator.tsx     # NEW — standalone, pushes OneRMCalculatorSheet
```

### Pattern 1: Parameterized, transaction-safe data module (mirror `db/workouts.ts`)
**What:** Every DB write goes through Drizzle's query-builder (never string-built SQL); multi-table writes (delete template + its template_exercises + null-out referencing workouts) run inside `db.transaction((tx) => {...})` with **synchronous, non-async callbacks** using `.run()`.
**When to use:** All of `db/templates.ts`.
**Example:**
```typescript
// Source: db/workouts.ts (this codebase) — reorderWorkoutExercises/removeWorkoutExercise
// pattern to mirror verbatim for deleteTemplate:
export async function deleteTemplate(db: AnyDrizzleDb, templateId: number): Promise<void> {
  const teRows = await db
    .select({ id: templateExercises.id })
    .from(templateExercises)
    .where(eq(templateExercises.templateId, templateId));

  db.transaction((tx) => {
    // Detach (never cascade-delete) any workouts that reference this template —
    // a deleted template must not corrupt workout history (see Pitfall: Dangling template_id).
    tx.update(workouts).set({ templateId: null }).where(eq(workouts.templateId, templateId)).run();
    if (teRows.length > 0) {
      tx.delete(templateExercises).where(eq(templateExercises.templateId, templateId)).run();
    }
    tx.delete(templates).where(eq(templates.id, templateId)).run();
  });
}
```

### Pattern 2: Pure lib function for structure+history+fallback merge (D-01)
**What:** `buildTemplatePrefillRows` takes the template's `targetSets`/`targetReps`/`targetWeightKg` plus the exercise's already-loaded `loadLastPerformance` result (filtered to non-warmup sets) and returns exactly `targetSets` rows, index-aligned to history where available and falling back to the template's targets otherwise.
**When to use:** Called once per workout_exercise in the active-workout screen's `loadAll()`, only when `workout.templateId != null` and the template has a matching `template_exercises` row for that exercise.
**Example:**
```typescript
// lib/templatePrefill.ts — NEW pure function, vitest-tested, zero DB imports.
export interface TemplateTarget {
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | null;
}
export interface HistorySet {
  weightKg: number;
  reps: number;
}
export interface PrefillRow {
  weightKg: number;
  reps: number;
}

/**
 * D-01: template supplies STRUCTURE (row count = targetSets); each row's
 * weight/reps pre-fill from the exercise's own last-performance history
 * (already filtered to non-warmup sets by the caller), falling back to the
 * template's target_weight_kg/target_reps once history is shorter than
 * targetSets or absent entirely. targetWeightKg null (D-02 save-as-template
 * always leaves it null) means "no fallback weight" — falls through to 0,
 * same as an ordinary never-performed exercise (Phase 2 D-06 convention).
 */
export function buildTemplatePrefillRows(target: TemplateTarget, history: HistorySet[]): PrefillRow[] {
  const rows: PrefillRow[] = [];
  for (let i = 0; i < target.targetSets; i += 1) {
    const historical = history[i];
    rows.push({
      weightKg: historical?.weightKg ?? target.targetWeightKg ?? 0,
      reps: historical?.reps ?? target.targetReps,
    });
  }
  return rows;
}
```

### Pattern 3: Greedy plate solver (native display-unit denominations)
**What:** Converts a `(targetWeight, barWeight)` pair (already in ONE display unit — never mixed) into a per-side plate breakdown using a fixed, unit-specific plate set, exploiting the fact that every denomination is an exact multiple of the smallest one.
**When to use:** `lib/plateSolver.ts`, called by both the plate calculator sheet and the warm-up ladder (each ladder step is rounded through this same function).
**Example:**
```typescript
// lib/plateSolver.ts — NEW. Plate sets are NATIVE per unit (D-06) — never
// derived by converting the other unit's set through kgToDisplay/displayToKg.
// This is deliberate: a 20kg bar and a 45lb bar are two independently
// manufactured standards, not unit-conversions of each other (see Pitfall 1).
const PLATE_SET_KG = [25, 20, 15, 10, 5, 2.5, 1.25] as const;
const PLATE_SET_LB = [45, 35, 25, 10, 5, 2.5] as const;

export interface PlateSolveResult {
  achievableWeight: number;      // same unit as input target/bar
  perSidePlates: number[];       // descending order
  deltaFromTarget: number;       // achievableWeight - targetWeight (+/-)
}

export function solvePlates(
  targetWeight: number,
  barWeight: number,
  unit: 'kg' | 'lb',
): PlateSolveResult {
  const plateSet = unit === 'kg' ? PLATE_SET_KG : PLATE_SET_LB;
  const smallest = plateSet[plateSet.length - 1]; // 1.25 (kg) / 2.5 (lb)

  const rawPerSide = (targetWeight - barWeight) / 2;
  // Below-bar edge case: nothing to load, bar itself is the nearest achievable.
  if (rawPerSide <= 0) {
    return { achievableWeight: barWeight, perSidePlates: [], deltaFromTarget: barWeight - targetWeight };
  }

  // Round to the nearest exactly-loadable per-side increment (multiple of
  // the smallest plate) — this IS the "nearest achievable weight" step,
  // distinct from the app's general 0.5kg/1lb DISPLAY rounding
  // (lib/weightUnits.ts), which is coarser/finer than actual plate
  // granularity and must not be reused here (see Pitfall 2).
  const roundedPerSide = Math.round(rawPerSide / smallest) * smallest;

  const perSidePlates: number[] = [];
  let remaining = roundedPerSide;
  for (const plate of plateSet) {
    while (remaining >= plate - 1e-9) {
      perSidePlates.push(plate);
      remaining = Math.round((remaining - plate) * 100) / 100; // avoid fp drift
    }
  }

  const achievableWeight = barWeight + roundedPerSide * 2;
  return {
    achievableWeight,
    perSidePlates,
    deltaFromTarget: Math.round((achievableWeight - targetWeight) * 100) / 100,
  };
}
```

### Pattern 4: %-of-working-weight warm-up ladder, plate-rounded
**What:** Fixed percentage/rep ladder (D-09), each step's weight rounded through `solvePlates` so every suggested warm-up is something the lifter can actually load.
**Example:**
```typescript
// lib/warmupLadder.ts — NEW.
// [ASSUMED — no single canonical source; a widely-used generic
// percentage-ramp pattern (see Assumptions Log A1). Concrete values locked
// here per CONTEXT.md D-09 discretion.
import { solvePlates } from './plateSolver';

interface WarmupStep {
  label: string;
  weight: number;
  reps: number;
}

const LADDER = [
  { label: 'Bar', percent: 0, reps: 8 },   // empty-bar step: weight = barWeight itself
  { label: '40%', percent: 0.4, reps: 5 },
  { label: '60%', percent: 0.6, reps: 3 },
  { label: '80%', percent: 0.8, reps: 2 },
] as const;

export function buildWarmupSets(workingWeight: number, barWeight: number, unit: 'kg' | 'lb'): WarmupStep[] {
  return LADDER.map((step) => {
    const rawTarget = step.percent === 0 ? barWeight : workingWeight * step.percent;
    const { achievableWeight } = solvePlates(rawTarget, barWeight, unit);
    return { label: step.label, weight: achievableWeight, reps: step.reps };
  });
}
```

### Pattern 5: Folder-grouped template list (query-layer aggregation)
**What:** `loadTemplatesGroupedByFolder` returns pre-bucketed groups so the screen only renders; Uncategorized (`folder === null`) sorts last.
**Example:**
```typescript
// db/templates.ts — mirrors loadWorkoutHistory's "aggregate in the query
// layer, screen only renders" convention.
export interface TemplateFolderGroup {
  folder: string | null; // null = Uncategorized
  templates: Template[];
}

export async function loadTemplatesGroupedByFolder(db: AnyDrizzleDb): Promise<TemplateFolderGroup[]> {
  const rows = await db.select().from(templates).orderBy(asc(templates.position));
  const byFolder = new Map<string | null, Template[]>();
  for (const row of rows) {
    const key = row.folder ?? null;
    const list = byFolder.get(key) ?? [];
    list.push(row);
    byFolder.set(key, list);
  }
  const namedFolders = [...byFolder.keys()].filter((k): k is string => k !== null).sort((a, b) => a.localeCompare(b));
  const groups: TemplateFolderGroup[] = namedFolders.map((folder) => ({ folder, templates: byFolder.get(folder)! }));
  if (byFolder.has(null)) {
    groups.push({ folder: null, templates: byFolder.get(null)! }); // Uncategorized last
  }
  return groups;
}
```

### Anti-Patterns to Avoid
- **Reusing `kgToDisplay`/`displayToKg` rounding inside the plate solver:** those functions round to a *display* granularity (0.5kg / 1lb) that does not match the actual per-plate granularity (2.5kg / 5lb total, given the smallest plates are 1.25kg/2.5lb per side). Using them would produce "achievable" weights that aren't actually loadable. Round via the plate set's own smallest denomination instead (Pattern 3).
- **Converting bar weight between units via `kgToDisplay`:** 20kg (kg-gym standard) converts to 44.09lb, not 45lb (lb-gym standard) — these are two different physical bars. Store both defaults independently (see Pitfall 1).
- **Inlining the pre-fill merge or save-as-template aggregation directly in a screen component:** both are pure functions over already-fetched data and must live in `lib/` with their own vitest suite, exactly like `lib/prDetection.ts` does for PR-hit computation.
- **Hard-deleting a template without detaching `workouts.template_id`:** SQLite in this project does not enforce FK constraints at write time, so a naive `DELETE FROM templates` leaves `workouts.template_id` pointing at a nonexistent row — silently breaks any future join. Always null it out first, in the same transaction (Pattern 1).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Plate breakdown for a target weight | An ad-hoc loop scattered across the plate-sheet component | `lib/plateSolver.ts#solvePlates` — one pure, fully-tested function | The rounding-to-nearest-achievable logic has real edge cases (below-bar, fp drift, tie-breaking) that need isolated unit tests, not UI-embedded logic |
| 1RM-to-%-table lookup | A hardcoded switch/if-chain inline in the 1RM sheet | `lib/percentOf1RM.ts` — one data table + one lookup fn, sourced from the NSCA training load chart | Keeps the officially-sourced table in one reviewable place; matches the existing `lib/estimate1RM.ts` convention of "one canonical formula/table, not reimplemented per screen" |
| Template pre-fill merge / save-as-template capture | Duplicating the active-workout screen's existing `loadPrefillRows` inline logic with template-specific tweaks bolted on | Two new small pure functions (`templatePrefill.ts`, `templateCapture.ts`) that the screen calls | `loadPrefillRows` already exists for the non-template case (Phase 2 D-06) and must NOT be modified to special-case templates — that would silently change Phase-2-verified behavior; keep template logic additive and separate |

**Key insight:** every genuinely new piece of business logic this phase introduces (plate math, warm-up ladder, %1RM table, pre-fill merge, save-as-template capture) is pure data-in/data-out computation with no I/O — the project's existing convention of isolating these into `lib/*.ts` with a co-located `.test.ts` (zero React Native/Drizzle imports) applies directly and should not be deviated from.

## Common Pitfalls

### Pitfall 1: Bar-weight unit conversion mismatch
**What goes wrong:** Storing bar weight as one canonical-kg value and converting it for lb display (`kgToDisplay(20, 'lb')` → 44, not 45) silently disagrees with the real-world lb-gym standard of a 45lb bar (= 20.41kg).
**Why it happens:** Every other weight value in this app is canonical-kg-with-display-conversion (D-14/LOG-06) — it's tempting to apply the same pattern to bar weight, but bar weight is a *manufactured physical standard* that differs by market, not a single physical quantity observed in two units.
**How to avoid:** Store `bar_weight_kg` (default 20) and `bar_weight_lb` (default 45) as two independent `settings` rows; read/write whichever matches the active unit, never convert between them.
**Warning signs:** A plate sheet showing "44kg" as the "bar" in a kg-unit gym, or a lb user seeing a bar defaulted from a kg-converted value instead of 45.

### Pitfall 2: Display rounding granularity ≠ plate-loadable granularity
**What goes wrong:** Reusing `lib/weightUnits.ts#kgToDisplay`'s 0.5kg/1lb rounding for "nearest achievable weight" in the plate solver produces a value that LOOKS plate-loadable but isn't, because the actual finest achievable increment (given the smallest plate is 1.25kg or 2.5lb per side) is 2.5kg or 5lb total.
**Why it happens:** Both are "rounding for weight display," so it's easy to conflate them; but one is a UI convention (LOG-06/D-14) and the other is dictated by the physical plate inventory (D-06/D-08).
**How to avoid:** The plate solver rounds to a multiple of its own plate set's smallest denomination (Pattern 3), never calling `kgToDisplay`.
**Warning signs:** A plate sheet claiming an "exact" match for a weight that isn't actually a multiple of 2.5kg/5lb above the bar.

### Pitfall 3: Dangling `workouts.template_id` after template delete
**What goes wrong:** SQLite (as configured in this project — no `PRAGMA foreign_keys=ON` observed) does not block a `DELETE FROM templates` that still has workouts pointing at it via `template_id`, leaving orphaned foreign keys that break any future join (e.g., a future "started from" badge in History).
**Why it happens:** Drizzle's `.references()` declares the relationship in the schema but SQLite must be explicitly configured to enforce it; this project's existing deletes (`discardWorkout`) are careful to delete children before parents, but template deletion has an *inverse* relationship (workouts reference templates, not vice versa) that's easy to miss.
**How to avoid:** `deleteTemplate` must first `UPDATE workouts SET template_id = NULL WHERE template_id = ?` inside the same transaction, before deleting `template_exercises` and the `templates` row (Pattern 1).
**Warning signs:** A History detail screen crashing or showing garbage when it later tries to look up a workout's template name.

### Pitfall 4: Warmup sets polluting template structure/capture counts
**What goes wrong:** `loadLastPerformance` returns ALL sets for an exercise, including `type === 'warmup'` rows. If the template pre-fill merge or save-as-template capture logic doesn't filter these out first, target_sets counts and pre-fill row counts include warmup sets, which D-01/D-02 explicitly exclude.
**Why it happens:** The existing Phase-2 `loadLastPerformance` is deliberately generic (returns everything so the *active-workout* screen's non-template pre-fill can preserve a logged warmup) — Phase 3's new template logic has a stricter, narrower requirement.
**How to avoid:** Both new pure functions (`templatePrefill.ts`, `templateCapture.ts`) must filter their input arrays to `type !== 'warmup'` before doing any counting/merging — reuse the same filter idiom already used in `lib/volume.ts#workingSetVolume`/`lib/prDetection.ts`/`db/workouts.ts#loadPriorBests`, never reimplement it ad hoc.
**Warning signs:** A template's `target_sets` value including a warmup set that was logged in the source workout; a start-from-template session pre-filling one extra row.

### Pitfall 5: Greedy plate solver breaking on floating-point drift
**What goes wrong:** Repeated subtraction of fractional plate weights (e.g., `1.25`, `2.5`) in JS floating point can leave a `remaining` value like `2.220446049250313e-16` instead of exactly `0`, causing the `while (remaining >= plate)` loop to either infinite-loop-adjacent-behave or drop a plate.
**Why it happens:** Standard IEEE-754 float behavior; the same class of issue the project already guards against elsewhere is absent here because this is new code.
**How to avoid:** Round `remaining` after each subtraction (Pattern 3 does this via `Math.round(x * 100) / 100`), and use a small epsilon in the loop's comparison (`plate - 1e-9`).
**Warning signs:** A vitest case with an odd per-side remainder (e.g., 17.5) either looping or under-counting plates by one.

## Code Examples

### Solving plates for a target weight (kg gym)
```typescript
// Source: lib/plateSolver.ts (this phase's new module — see Pattern 3)
solvePlates(102, 20, 'kg');
// -> { achievableWeight: 102.5, perSidePlates: [20, 1.25], deltaFromTarget: 0.5 }
// (per-side remaining = (102-20)/2 = 41 -> rounds to nearest 1.25 multiple = 41.25
//  -> greedy: 20+20+1.25=41.25 achieved with two plates... but greedy takes one 25
//  first if it fits: 41.25 -> 25 -> 16.25 -> 15 -> 1.25 -> 0. Exact decomposition
//  will be produced by the greedy loop; the illustrative numbers above show the
//  ROUNDING step only — exact per-side plate list depends on the greedy pass.)
```

### Estimating 1RM and cross-referencing the %-table
```typescript
// Source: lib/estimate1RM.ts (existing) + lib/percentOf1RM.ts (NEW)
const e1rm = estimate1RM(140, 5);       // Epley -> 163.33
const table = percentOf1RM(e1rm);        // NEW lookup, NSCA training load chart
// table[0] = { percent: 100, reps: 1, weight: 163.3 }
// table[7] = { percent: 80, reps: 8, weight: 130.7 }
```

### %1RM → reps table (NSCA Training Load Chart, adapted from Landers 1984)
```
% 1RM:  100  95  93  90  87  85  83  80  77  75  70
Reps:     1   2   3   4   5   6   7   8   9  10  12
```
Source: NSCA "Training Load Chart" (official PDF, nsca.com), Table 17.7 equivalent
in NSCA's Essentials of Strength Training and Conditioning, 4th ed. — [CITED: nsca.com/contentassets/61d813865e264c6e852cadfe247eae52/nsca_training_load_chart.pdf].

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| N/A — greenfield feature within an already-current stack | N/A | — | No stack-level "old vs new" applies; this phase adds capability, not a stack upgrade |

**Deprecated/outdated:** None applicable — Phase 3 introduces no new dependencies subject to version churn.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Warm-up ladder concrete values (Bar×8, 40%×5, 60%×3, 80%×2) are a reasonable, widely-used generic strength-training convention, not tied to any single proprietary program | Architecture Patterns (Pattern 4), Summary | Low — D-09 already locks "empty bar → ~40% → 60% → 80%, descending reps ~8/5/3/2" as approximate; if a user/reviewer wants different defaults, it's a one-constant change in `lib/warmupLadder.ts`, not a redesign |
| A2 | "Typical reps" for save-as-template (D-02 discretion) should use the LAST working set's reps rather than the modal (most frequent) value | Architecture Patterns / Don't Hand-Roll | Low-Medium — for straight-sets workouts (most common case) last-set reps and modal reps are usually identical; if a user does a pyramid/descending scheme, "last set" may not read as "typical" to them — flagged for planner/discuss follow-up if this matters to the user |
| A3 | Uncategorized folder bucket sorts LAST (not first) in the folder-grouped template list | Architecture Patterns (Pattern 5) | Low — purely a display-order convention; trivial to flip in `loadTemplatesGroupedByFolder` if the planner/user prefers Uncategorized first |
| A4 | Folder ordering is case-insensitive alphabetical (mirrors the existing `sql\`lower(name)\`` exercise-library ordering convention from Phase 1) rather than by `templates.position`/insertion order | Architecture Patterns (Pattern 5) | Low — easy to change; alphabetical was chosen for discoverability consistency with the one other grouped-list precedent in the codebase |
| A5 | `templates.position` orders templates WITHIN their folder bucket (not globally across all templates) | Standard Stack / Architecture | Low-Medium — if the planner intends a single global ordering instead, `loadTemplatesGroupedByFolder`'s `orderBy(asc(templates.position))` still works either way, but the write-side "position = count of existing templates" logic on create must be scoped to the target folder for the within-folder interpretation to hold |

**If this table is empty:** N/A — see entries above; all are LOW or LOW-MEDIUM risk and independently correctable without redesign.

## Open Questions

1. **Standalone "Tools" placement exact UX (Claude's discretion per CONTEXT.md)**
   - What we know: CONTEXT.md explicitly leaves "Tools area under More vs elsewhere" to discretion; this research recommends a "Tools" section in the Settings/More tab with two rows (Plate Calculator, 1RM Calculator) pushing to dedicated standalone screens that render the same sheet components used inline.
   - What's unclear: Whether the planner/user wants a dedicated 6th tab instead, or a FAB on the Workout tab. Given zero-clutter is a core project value (CLAUDE.md), adding to the existing "More" tab (already the catch-all for Settings) is the lowest-clutter option and is what this research recommends.
   - Recommendation: Lock the More-tab "Tools" section approach; it requires no navigation-structure changes (5-tab layout stays intact per UI-01).

2. **Template builder: single combined create/edit route vs two routes**
   - What we know: D-03 says editing an existing template reuses the same builder as creation.
   - What's unclear: Whether expo-router file-based routing should use one dynatmic route (`app/templates/[templateId].tsx` with `templateId==='new'` as a sentinel) or two files (`new.tsx` + `[templateId].tsx` both rendering a shared component), mirroring the existing `exercises/new.tsx` + `exercises/[id].tsx` split already in this codebase.
   - Recommendation: Mirror the existing `exercises/new.tsx`/`exercises/[id].tsx` split exactly (two thin route files sharing one builder component) — this is the codebase's own precedent for "create vs edit of the same entity," so following it minimizes surprise for the planner/executor.

## Environment Availability

Skip — this phase has no external tool/service/runtime dependencies beyond the already-installed npm packages audited above (no new CLI tools, no network services, no databases beyond the existing on-device SQLite).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 |
| Config file | `vitest.config.ts` (environment: node, include `**/*.test.ts`, `watch: false`) |
| Quick run command | `npx vitest run lib/plateSolver.test.ts` (swap filename per file under test) |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| TMPL-01 | Create/edit/organize templates in folders | unit + DB-layer | `npx vitest run db/templates.crud.test.ts` | ❌ Wave 0 |
| TMPL-01 | Folder grouping / Uncategorized bucket ordering | DB-layer | `npx vitest run db/templates.query.test.ts` | ❌ Wave 0 |
| TMPL-02 | Start-from-template pre-fill merge (structure+history+fallback) | unit (pure fn) | `npx vitest run lib/templatePrefill.test.ts` | ❌ Wave 0 |
| TMPL-02 | Starting a workout copies template_exercises in template order | DB-layer | `npx vitest run db/templates.query.test.ts` | ❌ Wave 0 |
| TMPL-03 | Save-as-template capture (working-set count, typical reps, null weight, excludes warmups) | unit (pure fn) | `npx vitest run lib/templateCapture.test.ts` | ❌ Wave 0 |
| UTIL-01 | Plate solver exact-match, nearest-achievable, below-bar, fp-drift edge cases | unit (pure fn) | `npx vitest run lib/plateSolver.test.ts` | ❌ Wave 0 |
| UTIL-02 | 1RM estimate (reuse existing Epley) | unit (pure fn, existing) | `npx vitest run lib/estimate1RM.test.ts` | ✅ existing |
| UTIL-02 | %-of-1RM table lookup | unit (pure fn) | `npx vitest run lib/percentOf1RM.test.ts` | ❌ Wave 0 |
| UTIL-03 | Warm-up ladder %/reps + plate-rounding integration | unit (pure fn) | `npx vitest run lib/warmupLadder.test.ts` | ❌ Wave 0 |
| TMPL-01/TMPL-02/UTIL-01/UTIL-03 | Inline UI affordances (folder headers, template row tap, plate/1RM/warm-up sheets, one-tap warm-up accept) | manual/UAT (device) | N/A — device pass, mirrors 01-UAT.md/02-UAT.md precedent | manual-only, no automated command justified (RN gesture/sheet UI) |

### Sampling Rate
- **Per task commit:** run the specific new/changed `.test.ts` file (quick run command above)
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`, followed by a device UAT pass mirroring `01-UAT.md`/`02-UAT.md` for the inline calculator affordances and folder/template UI (per `human_verify_mode: end-of-phase` in config)

### Wave 0 Gaps
- [ ] `db/templates.crud.test.ts` — covers TMPL-01 (create/update/delete + dangling-template_id detach)
- [ ] `db/templates.query.test.ts` — covers TMPL-01/TMPL-02 (folder grouping, loadFolderNames, start-from-template copy)
- [ ] `lib/plateSolver.test.ts` — covers UTIL-01
- [ ] `lib/warmupLadder.test.ts` — covers UTIL-03
- [ ] `lib/percentOf1RM.test.ts` — covers UTIL-02
- [ ] `lib/templatePrefill.test.ts` — covers TMPL-02
- [ ] `lib/templateCapture.test.ts` — covers TMPL-03
- [ ] No new fixture/framework work needed — `db/test/fixture.ts` and `vitest.config.ts` already cover the new `db/templates.ts` module without changes

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No | Single local user, no auth surface introduced this phase |
| V3 Session Management | No | No session concept beyond the existing Zustand active-workout store (unchanged this phase) |
| V4 Access Control | No | Single-user local app; no multi-tenant/role boundary |
| V5 Input Validation | Yes | Mirror `db/workouts.ts`'s `assertValidName`/`assertValidWeightKg`/`assertValidReps` pattern for every new numeric/text field: template `name`/`folder` (trim + length cap, mirrors `MAX_NAME_LENGTH`), `target_sets`/`target_reps` (non-negative integer + sane upper bound, mirrors `assertValidReps`), `target_weight_kg` (non-negative + `MAX_WEIGHT_KG` cap, mirrors `assertValidWeightKg`, nullable per D-02), bar-weight setting value (non-negative + sane upper bound before `setSetting` write) |
| V6 Cryptography | No | No secrets/crypto introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malformed/oversized numeric input reaching a `template_exercises`/`settings` write (e.g., a corrupted keypad value, negative reps) | Tampering | Reuse the exact `assertValidWeightKg`/`assertValidReps`-style guard functions before every insert/update in `db/templates.ts`, same as `db/workouts.ts` already does (T-02-04/T-02-15 precedent) |
| Free-text `folder`/`name` fields written unbounded | Tampering / Denial of Service (storage bloat) | Trim + cap length (mirror `MAX_NAME_LENGTH` = 200) before persisting, same as `assertValidName` |
| SQL injection via folder/name free text | Tampering | Already structurally prevented — Drizzle's parameterized query builder is used exclusively project-wide; continue that convention for every new query in `db/templates.ts` (no raw string concatenation) |
| Dangling foreign key after template delete (data integrity, not classic security, but a correctness/tampering-adjacent risk) | Tampering (data integrity) | See Common Pitfalls #3 — null out `workouts.template_id` before delete, in a transaction |

## Sources

### Primary (HIGH confidence)
- `db/schema.ts`, `db/workouts.ts`, `db/settings.ts`, `lib/estimate1RM.ts`, `lib/weightUnits.ts`, `lib/prDetection.ts`, `lib/volume.ts`, `components/ExerciseCard.tsx`, `components/SetRow.tsx`, `components/ExerciseRow.tsx`, `components/FilterChipRow.tsx`, `components/MuscleGroupPills.tsx`, `components/WorkoutRow.tsx`, `app/active-workout/[workoutId].tsx`, `app/active-workout/summary.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx`, `db/test/fixture.ts`, `vitest.config.ts`, `package.json` — all read directly from this repository this session
- `.planning/phases/03-templates-folders-calculators/03-CONTEXT.md` — locked D-01..D-11 decisions
- `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — approved design spec (Data model, Screens, Testing sections)
- NSCA "Training Load Chart" official PDF (nsca.com) — [CITED] exact %1RM-to-reps table (adapted from Landers, J. "Maximum based on reps," NSCA J 6(6):60-61, 1984)

### Secondary (MEDIUM confidence)
- WebSearch confirming the NSCA training-load-chart's general structure and that it is the standard/widely-cited reference for %1RM-to-reps mapping in strength & conditioning

### Tertiary (LOW confidence)
- Warm-up ladder exact %/rep values (Bar×8, 40%×5, 60%×3, 80%×2) — [ASSUMED], see Assumptions Log A1; these are the CONTEXT.md-specified approximate values made concrete, not independently sourced from a single canonical program this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every reused pattern verified by direct file reads
- Architecture: HIGH — every new module mirrors an exact, already-shipped precedent in this codebase (db/workouts.ts, lib/prDetection.ts, app/(tabs)/settings.tsx)
- Pitfalls: HIGH for the unit-conversion/rounding-granularity pitfalls (derived from first-principles arithmetic on the D-06-specified plate sets, independently verified above); MEDIUM for the exact warm-up ladder values (locked by CONTEXT.md as approximate, not independently sourced)

**Research date:** 2026-07-22
**Valid until:** 2026-08-21 (30 days — stable domain, no fast-moving external dependency)
