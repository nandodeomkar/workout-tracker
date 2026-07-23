# Phase 6: Programs & Progression - Research

**Researched:** 2026-07-23
**Domain:** Structured multi-week strength programs with linear and percent-of-training-max progression, on top of an already-migrated SQLite schema
**Confidence:** MEDIUM-HIGH (schema/codebase claims VERIFIED by direct read; strength-training conventions CITED via cross-checked web sources; two architectural recommendations flagged for planner/user confirmation)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Program structure & advancement (PROG-01)**
- **D-01:** One active program at a time. `program_state` holds the single active program + its `current_day_position`. The Workout-home "Next in program" card surfaces exactly one day.
- **D-02:** Pointer advances on finishing a program workout — finishing a workout that was started from the active program's current day advances the pointer AND applies progression at the same moment (design spec §Screens 2). Not on start, not a manual step.
- **D-03:** Wrap to day 1, cycle forever. After the last day, the pointer loops to day 1 and the program repeats indefinitely while progression keeps climbing. One wrap = one completed cycle (the trigger for %TM TM-bumps, D-08... [cross-ref corrected below: D-12]).
- **D-04:** Tap any day, pointer follows. The user can start any day of the program, not only the pointed one; the pointer moves to whatever they started. Forgiving of missed/reordered training days.
- **D-05:** Advancement/progression are keyed to a program-day origin, not to `workouts.template_id`. A workout must be marked as "started from program P, day D" for finishing it to advance/progress that program — reusing a program's template in an ad-hoc workout must NOT move the pointer. **Planner:** decide the origin marker (e.g. additive `workouts.program_id` + `program_day_position` columns, or a session-store field). Additive migration if columns are chosen.

**Linear progression (PROG-02)**
- **D-06:** Success = all prescribed working (non-warmup) sets hit their target reps at the prescribed weight. Strict all-sets rule (warmups excluded, per the Phase-2/3 `sets.type='warmup'` convention).
- **D-07:** Increment is per-exercise, stored in `template_exercises.progression` as `{type:"linear", increment_kg:N}`. Author picks the amount per exercise (sensible upper/lower defaults, e.g. 2.5 kg / 5 kg — exact defaults = research).
- **D-08 (linear-miss):** On a miss, hold the weight (repeat next time); after N consecutive misses (default ~3) auto-deload by a % (default ~10%). Needs a small per-exercise consecutive-fail counter (planner: where it lives — program-scoped state vs an additive column). Exact N and deload % = research.
- **D-09:** Progressed weight is written to `template_exercises.target_weight_kg` in place on the user's program-instance copy (safe because of D-13's user-owned-copy model). No new prescribed-weight table. Next start of that day pre-fills the new weight (last-performance pre-fill still applies per Phase-3 D-01, with the bumped target as the fallback/prescription source).

**Percent-of-training-max waves (PROG-03)**
- **D-10:** Training max is user-set: manual entry into `training_maxes.max_kg` with an optional "compute from 1RM" helper (% of an entered 1RM or the user's best logged e1RM). Reuses `lib/estimate1RM.ts` (Epley) + the Phase-3 %-of-1RM table. Exact TM % (e.g. 90%) = research.
- **D-11:** The wave is flattened into program days — each week's session is its own `program_days` row whose template exercises carry a single-session `{type:"percent_tm", sets:[{pct,reps}, ...]}`. The "wave" is simply the ordered day list; wrapping past the last day (D-03) = the next cycle. No separate wave-week counter/state.
- **D-12:** TM auto-bumps after a full cycle (pointer wraps past the last day): each %TM exercise's TM increases by a per-exercise amount (e.g. +2.5 kg upper / +5 kg lower — 5/3/1 convention), writing `training_maxes.max_kg`. Exact increments = research.
- **D-13 (%TM weights):** Prescribed weight = `round(TM × pct)` via plate-loadable rounding (`lib/weightUnits.ts`, same as the plate calculator), pre-filled on each set row when the day starts. Pure `lib/` function, vitest.

**Bundled programs & program creation (PROG-04, PROG-01)**
- **D-14:** Ship two bundled programs covering both engines: a linear full-body 5×5 (3-day) and a 4-day percent-of-TM wave (5/3/1-style). Generic, publicly-documented methodologies; generic names, no proprietary/trademarked content (legal constraint). Exact day/exercise composition = research/planner.
- **D-15:** Bundle as data → materialize a user-owned copy on Add/Start. Bundled programs live as JSON/seed definitions (NOT seeded into the DB on launch); adding/starting one clones its templates + `program_days` into user-owned, editable rows. This is what makes D-09's in-place `target_weight_kg` write safe — the shared bundle is never mutated. DB stays empty of program rows until the user chooses a program. Bundled exercises are referenced by the seed `exercises.seed_id` (planner: map methodology lifts to seeded exercises; handle a missing lift).
- **D-16:** %TM bundled program prompts the user to set/confirm each lift's TM up front (compute-from-1RM helper) before first use — the seed can't know the user's TMs. One explicit setup step; correct weights from day 1.
- **D-17:** Progression rules are authored on `template_exercises` in the Phase-3 template builder. The builder gains an optional per-exercise progression field (none / linear+increment / %TM sets). A program is then just an ordered list of templates as days. One authoring place; reuses `components/TemplateBuilderForm.tsx` and the existing `progression` column — no separate program-day rule editor.

### Claude's Discretion
- D-09, D-11, D-13, D-15, D-16 were resolved by Claude (user "no preference") and are the chosen defaults above; the planner may refine the exact data-shape but should keep progression writes isolated to user-owned copies and reuse existing `lib/` math.
- "Next in program" home-card layout, programs-manager screen anatomy, and the TM-setup sheet visual design → planner / UI-phase discretion.
- Programs manager lives under Settings/More per design spec §Screens 6 (settled, not a gray area).
- Exact linear increments, deload N/%, %TM TM %, and per-cycle TM bumps → **research** (all resolved below); use generic strength-training conventions as defaults.

### Deferred Ideas (OUT OF SCOPE)
- Multiple concurrent active programs — chose single-active (D-01) for v1; a program picker + multi-pointer state is a future enhancement.
- Custom progression-rule editor UI (arbitrary schemes beyond none/linear/%TM) — explicitly PROG-05 / v2 in REQUIREMENTS.md.
- Configurable deload rule (user-set N misses / deload %) — v1 uses sensible defaults; making it user-editable is a later refinement.
- A third bundled program / richer program library — start with two (D-14); add more once the two engines are validated in the friends beta.
- Backup/export of programs & training maxes → Phase 7 (needs the model first).

None of the above were pulled into Phase 6 scope. Do not re-open D-01..D-17 — this research fills only the numeric/composition/mechanism gaps explicitly flagged above.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROG-01 | Create a program as an ordered list of template days with a pointer to the next day | Architecture Patterns (program materialization + pointer), Don't Hand-Roll (day-list flattening), Code Examples (`db/programs.ts` shape) |
| PROG-02 | Program templates support linear progression rules (auto-increment weight on success) | Standard Stack defaults (increments), Common Pitfalls (warmup exclusion, fail-counter reset), Code Examples (`resolveLinearProgression`) |
| PROG-03 | Program templates support percent-of-training-max progression (5/3/1-style waves) with per-exercise training maxes | Standard Stack defaults (TM %, week scheme, TM bump), Architecture Patterns (16-day flattened wave), Code Examples (`computeTrainingMaxFromOneRepMax`, `computePercentTmWeight`, `bumpTrainingMax`) |
| PROG-04 | App ships with a small set of bundled generic programs (public methodologies, no proprietary content) | Standard Stack (bundled program compositions + exercise-seed mapping), Package Legitimacy Audit (N/A — no new packages), Common Pitfalls (bundle-clone-not-mutate) |
</phase_requirements>

## Summary

Phase 6 is almost entirely a **pure-logic + data-layer** phase: every table it needs (`programs`, `program_days`, `program_state`, `training_maxes`, `template_exercises.progression`) already exists from migration `0000`, and every piece of shared math it needs (Epley 1RM, plate-loadable rounding, %-of-1RM table) already exists in `lib/`. The net-new work is (1) two pure resolver functions in a new `lib/progression.ts` (linear success/hold/deload, %TM weight computation, TM-from-1RM), (2) a new `db/programs.ts` data layer mirroring `db/templates.ts`'s transactional conventions, (3) two additive-but-small migrations (a program-origin marker on `workouts`, a consecutive-fail counter on `template_exercises`), (4) two bundled-program JSON definitions materialized into user-owned rows on Add/Start, and (5) wiring the finish flow (`app/active-workout/summary.tsx`) to evaluate success and apply progression before advancing `program_state`.

The strength-training conventions needed to fill CONTEXT.md's flagged research gaps are well-established and consistent across independent sources: a StrongLifts-style linear 5×5 program uses **+2.5 kg per successful session on squat/bench/press/row and +5 kg on deadlift** (the split is driven by training frequency and muscle mass, not a strict "upper vs lower" rule, though CONTEXT's upper/lower framing is a reasonable simplification the planner can keep), deloads at **3 consecutive misses by 10%**; a 5/3/1-style wave uses a **training max at 90% of true 1RM**, a **3-week wave (65/75/85% → 70/80/90% → 75/85/95%) + a 40/50/60% deload week**, and a **+2.5 kg upper / +5 kg lower training-max bump per completed cycle**.

Two architectural questions CONTEXT.md explicitly hands to research/planner are resolved with concrete recommendations below: the program-origin marker should be **additive `workouts` columns**, not a Zustand field (Section: Architecture Patterns → Pattern 4), and the consecutive-fail counter should be an **additive `template_exercises` column**, not JSON state on `program_state` (Section: Architecture Patterns → Pattern 5) — both because they must survive app kill and both mirror the codebase's existing "mutate the user-owned template row in place" pattern (D-09).

**Primary recommendation:** Build `lib/progression.ts` first (Wave 1, fully vitest-testable, zero RN imports), then `db/programs.ts` + the two additive migrations, then wire the template builder (D-17) and finish-flow (D-02) integration last, since those depend on both.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Program CRUD (create program, order days, pick templates) | DB/Storage (`db/programs.ts`) | UI/Screens (programs manager) | Mirrors `db/templates.ts` — data layer owns validation + transactions, screen only renders |
| Program-day pointer advancement | DB/Storage (`program_state` write) | Pure lib/ (deciding *whether* to advance) | The write is a DB concern; the decision ("did this workout belong to the active program day") is origin-marker logic, testable in isolation |
| Linear progression success eval + weight bump | Pure lib/ (`lib/progression.ts`) | DB/Storage (applies the returned write) | Success eval and next-weight math must be vitest-pure per design spec §Testing; DB layer is a thin transactional wrapper around the pure result |
| %TM weight computation for a given day | Pure lib/ (`lib/progression.ts`) | — | `round(TM × pct)`, reuses existing plate-rounding — pure, no DB access needed to compute |
| Training max storage/update | DB/Storage (`training_maxes` table) | Pure lib/ (TM-from-1RM, TM bump amount) | Storage is a simple keyed table; the interesting math (Epley-derived TM, per-cycle bump) is pure and reused from `lib/estimate1RM.ts` |
| Program-day origin marker (this workout belongs to program P day D) | DB/Storage (additive `workouts` columns) | — | Must survive app kill/crash — Zustand holds no persist middleware (Phase 2 D-15); SQLite is the sole source of truth end-to-end in this app |
| Bundled program definitions | Client bundled data (static JSON, not DB) | DB/Storage (materialization target) | Mirrors the exercise-library seed pattern: ships as data, never mutated, cloned into user rows on first use (D-15) |
| Progression-rule authoring | UI/Screens (`TemplateBuilderForm.tsx` extension) | DB/Storage (`template_exercises.progression` write) | One authoring surface (D-17); the screen collects the rule shape, the data layer validates/persists it |
| Finish-flow orchestration (evaluate → progress → advance → wrap) | UI/Screens (`app/active-workout/summary.tsx`) | Pure lib/ + DB/Storage | The screen is the trigger point (D-02); it calls into `lib/progression.ts` for the decision and `db/programs.ts` for the write, staying thin itself |

## Standard Stack

### Core
No new packages are required for this phase — every dependency (`drizzle-orm`, `expo-sqlite`, `zustand`, `vitest`, `better-sqlite3`) is already installed and pinned per `CLAUDE.md`'s stack table. This phase is pure application code (new `lib/` functions, a new `db/programs.ts` module, two additive migrations, and UI wiring) on top of the existing schema.

**Version verification:** N/A — no new package installs this phase. Existing versions (`drizzle-orm@0.45.2`, `expo-sqlite@57.0.1`, `zustand@5.0.14`, `vitest@4.1.10`, `better-sqlite3@12.11.1`) were already verified in the project's stack research and remain unchanged; confirmed present in `package.json` `[VERIFIED: package.json]`.

### Supporting
| Concept | Source | Purpose | When to Use |
|---------|--------|---------|-------------|
| Epley 1RM | `lib/estimate1RM.ts` (existing) | TM-from-1RM helper (D-10) | Reuse verbatim — do not reimplement 1RM math in `lib/progression.ts` |
| Plate-loadable rounding | `lib/weightUnits.ts` / `lib/plateSolver.ts` (existing) | Rounding computed %TM weights (D-13) | See Open Question 1 below — recommend `plateSolver.solvePlates` for true per-side loadability, not `weightUnits.kgToDisplay`'s coarser display rounding |
| %-of-1RM table | `lib/percentOf1RM.ts` (existing, NSCA table) | "Compute TM from 1RM" helper UI (D-10) | Reuse for the TM-setup sheet's supporting reference table; the TM itself is a single 90%-of-1RM computation, not a table lookup |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Additive `workouts.program_id`/`program_day_position` columns for origin marker (recommended) | Zustand session-store field | Zustand has no persist middleware in this app (Phase 2 D-15) — a killed app loses the marker before finish, silently breaking D-02/D-05. Only viable if the marker were re-derivable after restart, which it isn't (a program can have many days pointing at the same template). Not recommended. |
| Additive `template_exercises.consecutive_fails` column (recommended) | A JSON map in `program_state` keyed by template_exercise_id | Keeps `program_state` to its single-responsibility shape (one program's pointer); a JSON map read-modify-write on every finish also risks accidental clobbering across concurrent exercises evaluated in one transaction and duplicates the "progression state lives on template_exercises" precedent already set by D-09's `target_weight_kg`. Not recommended, but documented as the flagged alternative per CONTEXT.md D-08. |
| 90% training max (5/3/1 standard) | 85% (more conservative variant some coaches use) | 85% is safer for detrained/older lifters but slows early progress; 90% is the more commonly cited default and matches the "5/3/1-style" naming in D-03/D-12. Recommend 90% as the shipped default; both are defensible. |

## Package Legitimacy Audit

**N/A — this phase installs no new external packages.** All functionality is built from libraries already installed and audited in prior phases (`drizzle-orm`, `expo-sqlite`, `zustand`, `vitest`, `better-sqlite3`). No `npm install` step belongs in this phase's plan.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐        ┌──────────────────────────┐
│ Template Builder (D-17) │──────▶ │ template_exercises.       │
│ author progression rule │        │ progression (JSON)        │
│ {none|linear|percent_tm}│        └──────────────┬─────────────┘
└─────────────────────────┘                       │
                                                   ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│ Bundled program JSON     │──────▶ │ Add/Start: clone templates │
│ (static, never mutated,  │        │ + program_days into        │
│ D-15)                    │        │ user-owned rows (db/       │
└─────────────────────────┘        │ programs.ts)                │
                                    └──────────────┬─────────────┘
                                                   ▼
                                    ┌──────────────────────────┐
                                    │ program_state             │
                                    │ (current_day_position)    │
                                    └──────────────┬─────────────┘
                                                   ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│ Workout home:            │◀──────│ "Next in program" card     │
│ "Next in program" (D-01) │        │ reads program_state's      │
└────────────┬─────────────┘        │ pointed-to day (D-04: any  │
             │ tap (any day, D-04)  │ day is startable)          │
             ▼                       └──────────────────────────┘
┌─────────────────────────┐
│ startWorkoutFromTemplate  │
│ + write origin marker      │  workouts.program_id,
│ (D-05)                     │  workouts.program_day_position
└────────────┬─────────────┘
             ▼
┌─────────────────────────┐
│ Active workout (existing  │
│ Phase 2 logging loop)      │
└────────────┬─────────────┘
             ▼
┌─────────────────────────┐        ┌──────────────────────────┐
│ Finish (summary.tsx,      │──────▶ │ lib/progression.ts:        │
│ D-02)                     │        │ evaluateLinearSuccess /    │
│ has origin marker?         │        │ resolveLinearProgression / │
│  no  → stop (ad-hoc)       │        │ computePercentTmWeight      │
│  yes → evaluate            │        └──────────────┬─────────────┘
└────────────┬─────────────┘                          │ pure result
             │                                         ▼
             │                       ┌──────────────────────────┐
             │                       │ db/programs.ts: apply        │
             │                       │ progression (write            │
             │                       │ target_weight_kg /            │
             │                       │ consecutive_fails /           │
             │                       │ training_maxes.max_kg on      │
             │                       │ cycle wrap) + advance/wrap     │
             │                       │ program_state.current_day_    │
             │                       │ position (D-02/D-03/D-12)      │
             │                       └──────────────────────────┘
             ▼
      (existing PR/volume summary UI, unchanged)
```

### Recommended Project Structure
```
lib/
├── progression.ts          # NEW — pure resolvers (linear + %TM + TM math), vitest
├── progression.test.ts     # NEW
db/
├── programs.ts             # NEW — CRUD + materialize-bundle + advance/apply-progression
├── programs.crud.test.ts   # NEW (mirrors templates.crud.test.ts)
├── trainingMaxes.ts        # NEW (or folded into programs.ts — planner discretion)
data/                       # NEW top-level folder (or db/seed/ sibling — planner discretion)
├── bundledPrograms/
│   ├── linear5x5.json      # generic full-body 3-day linear program definition
│   └── percentWave.json    # generic 4-day %TM wave program definition
components/
├── TemplateBuilderForm.tsx # MODIFIED — add optional progression field (D-17)
app/
├── programs/                # NEW route group — programs manager (Settings/More entry)
├── active-workout/summary.tsx # MODIFIED — finish-flow progression hook (D-02)
├── (tabs)/index.tsx          # MODIFIED — "Next in program" card (D-01/D-04)
drizzle/
├── 0004_xxx.sql             # NEW additive migration — workouts.program_id/
│                            #   program_day_position + template_exercises.
│                            #   consecutive_fails
```

### Pattern 1: In-place progression write (mirrors D-09)
**What:** Progression results are written directly onto the user's already-cloned `template_exercises` row (`target_weight_kg`, `consecutive_fails`) — never a new "prescribed weight history" table.
**When to use:** Every finish of a program-origin workout that evaluates a linear-progression exercise.
**Example:**
```typescript
// lib/progression.ts (new) — pure, no DB import
export interface LinearProgressionRule {
  type: 'linear';
  incrementKg: number;
}

export interface LinearProgressionResult {
  nextWeightKg: number;
  nextConsecutiveFails: number;
  deloaded: boolean;
}

const DEFAULT_FAIL_THRESHOLD = 3;
const DEFAULT_DELOAD_PCT = 0.10;

export function resolveLinearProgression(
  currentWeightKg: number,
  rule: LinearProgressionRule,
  success: boolean,
  consecutiveFails: number,
  failThreshold = DEFAULT_FAIL_THRESHOLD,
  deloadPct = DEFAULT_DELOAD_PCT,
): LinearProgressionResult {
  if (success) {
    return {
      nextWeightKg: currentWeightKg + rule.incrementKg,
      nextConsecutiveFails: 0,
      deloaded: false,
    };
  }
  const nextFails = consecutiveFails + 1;
  if (nextFails >= failThreshold) {
    const deloaded = Math.round(currentWeightKg * (1 - deloadPct) * 2) / 2; // nearest 0.5kg
    return { nextWeightKg: deloaded, nextConsecutiveFails: 0, deloaded: true };
  }
  return { nextWeightKg: currentWeightKg, nextConsecutiveFails: nextFails, deloaded: false };
}
```

### Pattern 2: Program materialization on Add/Start (D-15)
**What:** A bundled program is static JSON (never queried from the DB, never mutated). "Add" or "Start" clones its template definitions into new `templates`/`template_exercises` rows, then clones its day list into new `programs`/`program_days` rows pointing at the freshly-cloned templates.
**When to use:** Any time a user adds a bundled program — this is the ONLY write path that touches bundled program data.
**Example:**
```typescript
// db/programs.ts (new) — sketch, mirrors db/templates.ts transactional style
export async function materializeBundledProgram(
  db: AnyDrizzleDb,
  bundle: BundledProgramDefinition, // parsed from data/bundledPrograms/*.json
  exerciseSeedIdToId: Map<string, number>, // resolved from exercises.seed_id
): Promise<Program> {
  // 1. For each bundle.days[i].template, createTemplate + setTemplateExercises
  //    (resolving exerciseId via exerciseSeedIdToId; throw/flag if a seed_id
  //    is missing from this install's exercise library).
  // 2. createProgram(name) + insert program_days rows in order, each
  //    pointing at the template created in step 1.
  // 3. Insert a program_state row with current_day_position = 0.
  // All in one db.transaction(...) — mirrors setTemplateExercises's
  // synchronous transaction convention.
}
```

### Pattern 3: Wave-as-flattened-day-list (D-11) — concrete day count
**What:** The 5/3/1-style wave is NOT modeled as "4 lifts, each with an independent 4-week internal counter." Per D-11, there is exactly ONE ordered day list and ONE pointer. To reproduce the standard weekly 4-lift split across a 4-week wave with a single pointer, the bundled percent-of-TM program must flatten to **16 `program_days` rows** (4 lifts × 4 weeks), e.g.:
```
Day 1:  Week1 Squat   (65/75/85% x5/5/5+)
Day 2:  Week1 Bench   (65/75/85% x5/5/5+)
Day 3:  Week1 Deadlift(65/75/85% x5/5/5+)
Day 4:  Week1 Press   (65/75/85% x5/5/5+)
Day 5:  Week2 Squat   (70/80/90% x3/3/3+)
...
Day 13: Week4 Squat   (40/50/60% x5/5/5 deload)
Day 14: Week4 Bench   (40/50/60% x5/5/5 deload)
Day 15: Week4 Deadlift(40/50/60% x5/5/5 deload)
Day 16: Week4 Press   (40/50/60% x5/5/5 deload)
                       ↓ wrap (D-03) = one full cycle → TM bump (D-12)
```
Each row is its own `template_exercises.progression` = `{type:"percent_tm", sets:[{pct,reps}]}` for that lift's percentage that week — a distinct template per (lift, week) pair, all pointing at the same underlying exercise but different target percentages. **This flattening is an architectural interpretation reconciling D-11's "wave = ordered day list" with the well-established 4-day/4-week 5/3/1 split — flag for planner/user confirmation before locking (see Assumptions Log A7).**
**When to use:** The bundled 4-day percent-of-TM program (D-14) and any user-authored %TM program.

### Pattern 4: Program-origin marker via additive columns (resolves D-05)
**What:** Add nullable `workouts.program_id` (FK to `programs.id`) and `workouts.program_day_position` (int, the `program_days.position` this workout started from) — written at `startWorkoutFromTemplate` time when starting from a program day, left `null` for empty/template-only/history-repeat starts.
**When to use:** Every program-day start (D-04: tapping any day). At finish, `db/programs.ts` checks `workout.programId !== null` before doing anything program-related — an ad-hoc reuse of the same template (`workouts.template_id` set but `program_id` null) must never advance or progress (D-05's core requirement).
**Rationale for additive columns over Zustand:** Phase 2's D-15 established that Zustand holds ONLY ephemeral state with no persist middleware, and that SQLite is the sole source of truth precisely so an in-progress workout survives app kill. A program's finish-time progression logic must run correctly even if the app was killed and resumed mid-workout — a Zustand field would be lost on that resume, silently breaking D-02. `[VERIFIED: store/activeWorkoutStore.ts pattern + Phase 2 CONTEXT.md D-15]`.

### Pattern 5: Consecutive-fail counter placement (resolves D-08)
**What:** Additive `template_exercises.consecutive_fails` (int, default 0), reset to 0 on any success, incremented on any miss, reset to 0 again after a deload fires.
**When to use:** Read/write inside the same transaction that writes `target_weight_kg` at finish time (Pattern 1) — always co-located, one row, one write.
**Rationale over a `program_state` JSON map:** `program_state` is currently a clean one-row-per-program singleton (`program_id`, `current_day_position`). Attaching a growing per-exercise JSON blob mixes pointer-tracking with per-exercise progression state and requires parse/stringify on every finish; an additive column keeps the same "mutate the user-owned template row in place" precedent D-09 already established for `target_weight_kg`, needs no JSON schema, and is trivially reset when a template row's progression rule is edited.

### Anti-Patterns to Avoid
- **Mutating the bundled JSON program definitions in place:** They must stay static, read-only data shipped with the app bundle (imported as JSON modules or bundled assets) — never rows in the DB, never edited by user actions. Only cloned copies (Pattern 2) are ever mutated.
- **Storing program origin in Zustand:** Violates the established SQLite-source-of-truth pattern (Phase 2 D-15) and breaks crash-safety for the exact moment (finish) that matters most.
- **Building a generic progression-rule interpreter:** PROG-05 (arbitrary rule editor) is explicitly v2/out of scope. `lib/progression.ts` should expose exactly two resolvers (linear, percent_tm) plus the shared TM helpers — not a rule-engine abstraction that anticipates future rule types.
- **Reintroducing a separate wave-week counter:** D-11 deliberately flattens the wave into the day list precisely to avoid a second piece of progression state; don't add a `program_state.current_week` field alongside `current_day_position` — the day position IS the week (via the day's own `percent_tm` scheme).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Estimated 1RM for TM-from-1RM helper | A second Epley/Brzycki implementation in `lib/progression.ts` | `lib/estimate1RM.ts#estimate1RM` (existing) | Single shared formula already used by Phase 2 PR detection and Phase 4 stats charts — a second implementation risks silent divergence |
| Plate-loadable rounding of computed %TM weights | A new rounding function in `lib/progression.ts` | `lib/plateSolver.ts#solvePlates` (existing) — see Open Question 1 for the `weightUnits.ts` vs `plateSolver.ts` reconciliation | Phase 3's Pitfall 2 explicitly documents that `weightUnits.ts`'s 0.5kg/1lb DISPLAY rounding is coarser/finer than actual per-plate granularity and produces values that look loadable but aren't |
| Progression rule interpretation (custom schemes) | A generic rules-engine / DSL for arbitrary progression schemes | Two flat resolver functions (`resolveLinearProgression`, `computePercentTmWeight`) | PROG-05 (custom editor) is v2; over-engineering a rule engine now adds complexity with no v1 payoff |
| Deload/fail-counter bookkeeping | A separate `progression_events` audit table | The additive `consecutive_fails` column (Pattern 5) | v1 has no requirement to show a fail history — only the current streak matters for the deload decision |
| Week-by-week wave state machine | A `program_state.current_week` + `current_day_in_week` compound pointer | The single flattened day list + `current_day_position` (Pattern 3) | D-11 already resolved this: the day list ordering IS the week progression, no second counter needed |

**Key insight:** Almost nothing in this phase should be "clever" — the schema, the shared math, and the transactional conventions all already exist from Phases 1-3. The risk in Phase 6 is architectural sprawl (a rules engine, a wave-state-machine, a program-origin field that doesn't survive a crash), not missing functionality. Every pattern above resolves a CONTEXT.md-flagged ambiguity in favor of the simplest option that reuses an established codebase precedent.

## Common Pitfalls

### Pitfall 1: Ad-hoc reuse of a program's template silently advancing the program
**What goes wrong:** A user starts a workout from `templates.id` that happens to belong to an active program's day (e.g., via "start from history" or the plain template list, not the "Next in program" card) — if advancement keys off `workouts.template_id` instead of an explicit origin marker, this ad-hoc workout would incorrectly advance/progress the program.
**Why it happens:** `template_id` is already set on every template-started workout (Phase 3), so it's tempting to reuse it as the "was this a program workout" signal.
**How to avoid:** Gate ALL program advancement/progression logic on the new `workouts.program_id IS NOT NULL` check (Pattern 4), never on `template_id` alone (this is D-05's exact requirement).
**Warning signs:** A user reports their program pointer "jumped" or a training max bumped without them touching the programs UI.

### Pitfall 2: Warmup sets counted toward linear-progression success
**What goes wrong:** If `evaluateLinearSuccess` iterates ALL sets on a card instead of filtering `type !== 'warmup'`, a warmup miss (lower reps by design) could falsely fail an otherwise-successful day, or a warmup "success" could mask a real working-set failure.
**Why it happens:** The sets array returned by `loadWorkoutDetail` mixes warmup and working sets undifferentiated by default.
**How to avoid:** Filter to `sets.type === 'normal'` (or `!== 'warmup'`, matching the existing `lib/volume.ts#workingSetVolume` convention) before evaluating success, exactly mirroring how PR detection and volume already exclude warmups.
**Warning signs:** vitest cases with a mixed warmup+working-set input array are the cheapest way to catch this — include one explicitly.

### Pitfall 3: Misinterpreting "cycle wrap" as a per-lift weekly event instead of a full-list wrap
**What goes wrong:** If the %TM bundled program is NOT flattened to the full 16-day list (Pattern 3) — e.g. if each lift's 4 program_days are modeled as 4 separate mini-programs — "wrap" would fire weekly per lift instead of once per full 4-week cycle, causing TM to bump 4x too often.
**Why it happens:** The single-pointer/single-day-list model (D-01/D-11) is a real simplification from how 5/3/1 is usually described (4 independent per-lift week-counters); it's easy to under-flatten.
**How to avoid:** Confirm the wave is ONE `program_days` list of `weeks × lifts-per-day` rows, with TM bump logic firing only when `current_day_position` wraps from the LAST row back to 0 (not on every lift's "week 4" row).
**Warning signs:** TM values increasing faster than +2.5/+5 kg per ~4 weeks of actual training.

### Pitfall 4: Mutating the bundled JSON definition instead of a clone
**What goes wrong:** If "Add/Start bundled program" reads the JSON and writes progression state directly onto some cached/shared representation of it (rather than freshly-inserted DB rows), every user (or a second Add of the same bundle) would share and corrupt the same mutable state.
**Why it happens:** It's tempting to treat the bundle JSON as if it were already a `Template`/`Program` row shape, skipping the clone step for speed.
**How to avoid:** Bundle JSON should be typed distinctly from the DB row types (`BundledProgramDefinition`, not `Program`/`Template`) so the type system forces a translation step through `createTemplate`/`createProgram` inserts (Pattern 2) before any progression math ever touches it.
**Warning signs:** Two different friends' installs behaving identically after one deloads — a sure sign of shared mutable state (in this local-only app, more likely to surface as: reinstalling/reseeding the bundle "remembers" a prior TM bump).

### Pitfall 5: Floating-point drift across many small increments
**What goes wrong:** Repeated `weightKg + 2.5` additions across dozens of program cycles can accumulate binary floating-point error (e.g., `102.49999999999999` instead of `102.5`), which then fails exact-equality comparisons or displays oddly.
**Why it happens:** JS numbers are IEEE-754 doubles; repeated addition of decimals like 2.5 is usually safe but not guaranteed once combined with deload's `* 0.9` multiplication.
**How to avoid:** Round to the nearest 0.5 kg (matching `lib/weightUnits.ts`'s existing display-rounding convention, or the plate-solver's granularity if that's the chosen rounding — see Open Question 1) after every progression write, mirroring `lib/plateSolver.ts`'s existing epsilon-guard precedent (`Math.round((remaining - plate) * 100) / 100`).
**Warning signs:** A vitest case that runs `resolveLinearProgression` 50 times in a loop and asserts the final value is an exact multiple of 0.5.

### Pitfall 6: Missing exercise-seed mapping for a bundled program lift
**What goes wrong:** If a bundled program's JSON references an `exercises.seed_id` that doesn't exist in a given install (e.g. a future re-curation of the exercise library prunes/renames a seed_id), `materializeBundledProgram` would either crash or silently create a template row with an invalid `exercise_id`.
**Why it happens:** The bundle JSON and the exercise seed JSON are two independently-versioned files; nothing enforces they stay in sync.
**How to avoid:** Resolve every bundle exercise reference to an `exercises.id` up front (before any inserts); if a `seed_id` is missing, either fail the whole materialize with a clear error or open the exercise picker for the user to substitute — never insert with a dangling/null exercise reference.
**Warning signs:** This project's own exercise seed (`db/seed/exercises.seed.json`) already contains all five needed lifts under stable `seed_id`s (see Standard Stack → bundled program compositions below) — verified this session, so the risk is future re-curation, not today's mapping.

### Pitfall 7: Finish-flow progression eval running on every workout, not just program ones
**What goes wrong:** If the finish-flow hook (`app/active-workout/summary.tsx`) unconditionally tries to load/evaluate progression for every finished workout, ad-hoc/empty/template (non-program) workouts pay an unnecessary DB round-trip and risk null-pointer bugs on missing program data.
**Why it happens:** It's the natural place to "just add a check" without an early-return guard.
**How to avoid:** Guard the entire progression block on `workout.programId !== null` (Pitfall 1's marker) as the very first check in the finish-flow hook, before any program/training-max queries run.
**Warning signs:** Slower finish-screen load times for ordinary (non-program) workouts, or crashes on finishing an empty/ad-hoc workout.

### Pitfall 8: Consecutive-fail counter never resetting after a deload
**What goes wrong:** If the deload branch forgets to reset `consecutive_fails` to 0, the very next miss would immediately re-trigger another deload (since the counter is already at/over threshold).
**Why it happens:** Easy to remember "increment on miss" but forget the reset-on-deload branch is distinct from reset-on-success.
**How to avoid:** `resolveLinearProgression` (Pattern 1's example) explicitly returns `nextConsecutiveFails: 0` in BOTH the success branch and the deload branch — only the "miss but under threshold" branch increments.
**Warning signs:** A vitest case with 4+ consecutive misses in a row should show exactly one deload event, not one every 3 misses forever with no reset.

## Code Examples

### lib/progression.ts — full signature set (all pure, vitest-testable, zero RN imports)
```typescript
// Source: derived from CONTEXT.md D-06/D-07/D-08/D-09/D-10/D-12/D-13 +
// cross-checked strength-training conventions (see Sources below).

export interface WorkingSetPerformance {
  weightKg: number;
  reps: number;
  targetReps: number;
  type: 'normal' | 'warmup' | 'dropset' | 'failure';
}

/** D-06: success = every non-warmup set hit its target reps at the prescribed weight. */
export function evaluateLinearSuccess(sets: WorkingSetPerformance[], targetWeightKg: number): boolean {
  const workingSets = sets.filter((s) => s.type !== 'warmup');
  if (workingSets.length === 0) return false;
  return workingSets.every((s) => s.weightKg >= targetWeightKg && s.reps >= s.targetReps);
}

export interface LinearProgressionRule {
  type: 'linear';
  incrementKg: number;
}

export interface LinearProgressionResult {
  nextWeightKg: number;
  nextConsecutiveFails: number;
  deloaded: boolean;
}

/** D-08: hold on miss; deload by deloadPct after failThreshold consecutive misses. */
export function resolveLinearProgression(
  currentWeightKg: number,
  rule: LinearProgressionRule,
  success: boolean,
  consecutiveFails: number,
  failThreshold?: number,  // default 3
  deloadPct?: number,      // default 0.10
): LinearProgressionResult;

/** D-10: training max = a fixed percent (default 90%) of a supplied 1RM. */
export function computeTrainingMaxFromOneRepMax(oneRepMaxKg: number, tmPercent?: number): number;

export interface PercentTmSetScheme {
  pct: number;   // e.g. 0.85
  reps: number;  // e.g. 5
  amrap?: boolean;
}

export interface PercentTmRule {
  type: 'percent_tm';
  sets: PercentTmSetScheme[];
}

/** D-13: prescribed weight per set = round(trainingMaxKg * pct) via plate-loadable rounding. */
export function computePercentTmWeight(
  trainingMaxKg: number,
  pct: number,
  barWeightKg: number,
  unit: 'kg' | 'lb',
): number; // delegates to lib/plateSolver.ts#solvePlates internally — see Open Question 1

/** D-12: TM bump amount per completed cycle. */
export function bumpTrainingMax(currentTmKg: number, lift: 'upper' | 'lower'): number;
// default deltas: upper +2.5kg, lower +5kg (see Standard Stack — 5/3/1 convention)
```

### Standard-strength-convention defaults (all CITED, cross-checked web sources)
```typescript
// lib/progression.ts constants
export const DEFAULT_LINEAR_INCREMENT_KG = {
  squat: 2.5,
  bench: 2.5,
  overheadPress: 2.5,
  row: 2.5,
  deadlift: 5,       // trained less frequently (1x/week in the split) + biggest compound
} as const;

export const DEFAULT_FAIL_THRESHOLD = 3;   // consecutive misses before deload
export const DEFAULT_DELOAD_PCT = 0.10;    // -10% on deload

export const DEFAULT_TM_PERCENT = 0.90;    // training max = 90% of true 1RM

export const DEFAULT_WAVE_SCHEME = [
  // Week 1
  [{ pct: 0.65, reps: 5 }, { pct: 0.75, reps: 5 }, { pct: 0.85, reps: 5, amrap: true }],
  // Week 2
  [{ pct: 0.70, reps: 3 }, { pct: 0.80, reps: 3 }, { pct: 0.90, reps: 3, amrap: true }],
  // Week 3
  [{ pct: 0.75, reps: 5 }, { pct: 0.85, reps: 3 }, { pct: 0.95, reps: 1, amrap: true }],
  // Week 4 (deload)
  [{ pct: 0.40, reps: 5 }, { pct: 0.50, reps: 5 }, { pct: 0.60, reps: 5 }],
] as const;

export const DEFAULT_TM_BUMP_KG = { upper: 2.5, lower: 5 } as const; // bench/OHP vs squat/deadlift
```

### Bundled program exercise-seed mapping (VERIFIED via grep of db/seed/exercises.seed.json)
```typescript
// data/bundledPrograms/linear5x5.json + percentWave.json reference these
// stable seed_ids (present in the current 517-row exercise seed):
const LIFT_SEED_IDS = {
  squat: 'barbell-squat',                            // Barbell Squat, Quads
  bench: 'barbell-bench-press-medium-grip',          // Barbell Bench Press - Medium Grip, Chest
  deadlift: 'barbell-deadlift',                       // Barbell Deadlift, Back
  overheadPress: 'standing-military-press',           // Standing Military Press, Shoulders
  row: 'bent-over-barbell-row',                       // Bent Over Barbell Row, Back
} as const;
```

### Bundled program compositions (CITED, generic names — no proprietary/trademarked content)
```
"Linear 5x5 (3-Day)" — full-body, 3 sessions/week, alternating:
  Day A: Squat 5x5, Bench Press 5x5, Barbell Row 5x5
  Day B: Squat 5x5, Overhead Press 5x5, Deadlift 1x5
  (2 program_days, wraps A→B→A→B...; each exercise carries a
  {type:"linear", increment_kg:N} rule per Standard-convention defaults above)

"Percent-Based Wave (4-Day)" — one main lift per session, 4 sessions/week,
  4-week wave (16 program_days total per Pattern 3):
  Week1: Squat(65/75/85 x5/5/5+), Bench(...), Deadlift(...), Press(...)
  Week2: Squat(70/80/90 x3/3/3+), Bench(...), Deadlift(...), Press(...)
  Week3: Squat(75/85/95 x5/3/1+), Bench(...), Deadlift(...), Press(...)
  Week4: Squat(40/50/60 x5/5/5 deload), Bench(...), Deadlift(...), Press(...)
  (each exercise carries a {type:"percent_tm", sets:[...]} rule per its
  week's row of DEFAULT_WAVE_SCHEME; wraps after Week4 Press → TM bump, D-12)
```
Both names are generic descriptions of publicly-documented training methodologies (linear 5×5 progression; percentage-of-training-max wave progression), with no reference to any trademarked program name, brand, or proprietary content — satisfying the design spec's legal constraint.

## State of the Art

This phase's domain (linear progression and percent-of-training-max wave programming) is a decades-stable area of strength-training practice, not a fast-moving software ecosystem — there is no "old vs current approach" churn to track. The one thing worth flagging as "current" vs "legacy" is internal to this codebase, not the training domain:

| Old Approach (Phase 3 and earlier) | Current Approach (Phase 6) | When Changed | Impact |
|--------------------------------------|------------------------------|---------------|--------|
| `template_exercises.progression` column exists but is unused/always null | Column is actively read/written by `lib/progression.ts` + `db/programs.ts` | This phase | First phase where the Phase-1-designed JSON schema (`{type:"linear",...}` / `{type:"percent_tm",...}`) is actually exercised — validate the exact JSON shape against real inserts, not just the doc comment in `db/schema.ts` |

**Deprecated/outdated:** None — no libraries, APIs, or conventions in this phase's scope have been superseded since the project's stack was last verified.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 16-day flattening (4 lifts × 4 weeks) is the correct way to reconcile D-11's "single ordered day list" with the standard 4-day/4-week percent-of-TM wave split | Architecture Patterns → Pattern 3 | If the planner instead models the wave as 4 independent per-lift mini-programs, `program_state`'s single pointer/D-01 single-active-program model breaks down, OR the "wrap = one cycle" (D-03/D-12) trigger fires at the wrong cadence (weekly instead of every 4 weeks), causing training maxes to bump 4x too fast |
| A2 | The "%TM prescribed weight" should be rounded via `lib/plateSolver.ts#solvePlates` (true per-side plate-loadable rounding) rather than `lib/weightUnits.ts#kgToDisplay` (0.5kg/1lb display rounding), despite CONTEXT.md D-13 literally naming `weightUnits.ts` | Standard Stack → Supporting; Don't Hand-Roll | If the planner follows D-13's literal wording, %TM prescribed weights will be "loadable-looking" but not actually achievable with real plates on a barbell — this repeats Phase 3's own documented Pitfall 2 (display rounding ≠ plate granularity) inside a brand-new phase. Needs explicit user/planner confirmation before locking either way. |
| A3 | "Upper vs lower body" increment split (CONTEXT D-07's framing) is better expressed as "all main lifts get +2.5kg except deadlift gets +5kg" (frequency/muscle-mass driven, not a strict upper/lower rule) | Code Examples → Standard-strength-convention defaults | Low risk — the numeric defaults are the same either way (2.5/5), only the conceptual label differs; if the planner wants a strict upper/lower table (e.g. squat also gets +5kg as "lower body"), that's a defensible alternative convention with its own citable sources, just less common for a 5x5-style program |
| A4 | Bundled program names "Linear 5x5 (3-Day)" and "Percent-Based Wave (4-Day)" carry no trademark risk | Code Examples → Bundled program compositions | Very low risk — these are descriptive, generic, methodology-based names (design spec's own legal note explicitly names "linear progression," "5×5," and "percent-based wave progression" as acceptable generic terms); still worth a final human eyeball before shipping copy |

**If this table is empty:** N/A — see entries above. Items NOT in this table (schema columns, existing lib/ function signatures, exercise seed_ids, package versions) were verified directly against the codebase this session and are tagged `[VERIFIED: <path>]` inline.

## Open Questions

1. **Should %TM weight rounding use `plateSolver.solvePlates` or `weightUnits.kgToDisplay`?**
   - What we know: CONTEXT.md D-13 names `lib/weightUnits.ts` explicitly ("same as the plate calculator"), but Phase 3's own Pitfall 2 established that `weightUnits.ts` is DISPLAY rounding (0.5kg/1lb), not plate-loadable rounding — that's what `plateSolver.ts` is for.
   - What's unclear: Whether D-13's author meant "the general rounding convention used throughout the app" loosely, or specifically intended the coarser display rounding for this one case (perhaps because %TM weights are shown as a plan/target, not a mandatory exact-plate load, so slight non-loadability might be acceptable at the prescription stage and resolved later via the existing inline plate calculator).
   - Recommendation: Use `plateSolver.solvePlates(rawTarget, barWeight, unit).achievableWeight` for the actual prescribed/pre-filled weight (true loadability, avoids repeating Pitfall 2), and reserve `weightUnits.kgToDisplay` only for kg↔lb display conversion elsewhere in the programs UI. Flag this as a one-line confirmation for the user/planner rather than silently picking one.

2. **Where exactly does `bar_weight_kg` come from for %TM prescribed-weight rounding?**
   - What we know: `settings` already stores a global bar weight (Phase 3 D-06), read via `getSetting(db, 'bar_weight_kg')` (or the lb equivalent).
   - What's unclear: Whether `computePercentTmWeight` should take `barWeightKg` as a parameter (pure, caller fetches the setting) or reach into `db/settings.ts` itself (impure). CONTEXT.md's "pure lib/ function, vitest" instruction (D-13) strongly implies the former.
   - Recommendation: Keep `computePercentTmWeight` pure — caller (`db/programs.ts` or the UI) fetches `bar_weight_kg` from settings once and passes it in, mirroring how `lib/warmupLadder.ts#buildWarmupSets` already takes `barWeight`/`unit` as parameters rather than querying settings itself.

## Environment Availability

Skipped — this phase has no new external tool/service/runtime dependencies. It builds entirely on the already-verified Expo/Drizzle/vitest toolchain from prior phases.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.10 `[VERIFIED: package.json]` |
| Config file | `vitest.config.ts` (environment: node, include `**/*.test.ts`) |
| Quick run command | `npx vitest run lib/progression.test.ts` (single-file, unaffected by the Windows paging issue below) |
| Full suite command | `npx vitest run --no-file-parallelism` — **required on this Windows dev machine**; a plain `npx vitest run` intermittently crashes with `Error: The paging file is too small for this operation to complete` from better-sqlite3's native binding under the default multi-worker pool `[VERIFIED: project memory — vitest-windows-paging-crash, 61 files/464 tests green as of Plan 05-02]` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROG-01 | Materializing a bundled program clones templates + program_days into user-owned rows, program_state starts at position 0 | unit (DB-layer, in-memory) | `npx vitest run db/programs.crud.test.ts -t "materialize"` | ❌ Wave 0 |
| PROG-01 | Tapping any day moves the pointer to that day's position (D-04) | unit (DB-layer) | `npx vitest run db/programs.crud.test.ts -t "advance"` | ❌ Wave 0 |
| PROG-01 | Wrap: pointer at last day + finish → wraps to 0, not out-of-bounds (D-03) | unit (pure or DB-layer) | `npx vitest run lib/progression.test.ts -t "wrap"` | ❌ Wave 0 |
| PROG-02 | `evaluateLinearSuccess` excludes warmup sets, requires ALL working sets to hit target (D-06) | unit (pure) | `npx vitest run lib/progression.test.ts -t "evaluateLinearSuccess"` | ❌ Wave 0 |
| PROG-02 | `resolveLinearProgression` increments on success, holds on miss, deloads at N=3 with reset (D-08/D-09) | unit (pure) | `npx vitest run lib/progression.test.ts -t "resolveLinearProgression"` | ❌ Wave 0 |
| PROG-02 | Origin-marker guard: ad-hoc workout reusing a program's template does NOT advance/progress (D-05) | unit (DB-layer) | `npx vitest run db/programs.crud.test.ts -t "origin marker"` | ❌ Wave 0 |
| PROG-03 | `computeTrainingMaxFromOneRepMax` = 1RM × 0.90 (D-10) | unit (pure) | `npx vitest run lib/progression.test.ts -t "computeTrainingMaxFromOneRepMax"` | ❌ Wave 0 |
| PROG-03 | `computePercentTmWeight` = plate-loadable round(TM × pct) (D-13) | unit (pure) | `npx vitest run lib/progression.test.ts -t "computePercentTmWeight"` | ❌ Wave 0 |
| PROG-03 | `bumpTrainingMax` applies +2.5kg upper / +5kg lower only on full-cycle wrap (D-12) | unit (pure + DB-layer wrap-timing) | `npx vitest run lib/progression.test.ts -t "bumpTrainingMax"` | ❌ Wave 0 |
| PROG-04 | Bundled program JSON's exercise seed_ids all resolve against the current exercise seed | unit (DB-layer, fixture-backed) | `npx vitest run db/programs.crud.test.ts -t "seed mapping"` | ❌ Wave 0 |
| PROG-04 | Adding the same bundled program twice creates two independent, non-shared user copies | unit (DB-layer) | `npx vitest run db/programs.crud.test.ts -t "clone independence"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run lib/progression.test.ts` (and/or `db/programs.crud.test.ts` once that task's file exists) — fast, single-file, safe on Windows.
- **Per wave merge:** `npx vitest run --no-file-parallelism` (full suite — required flag on this machine per project memory).
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus a manual device pass exercising: add a bundled linear program → complete a day successfully → confirm weight bumped; miss 3 times in a row → confirm deload; add the %TM program → set TMs → complete a full 16-day wave → confirm TM bump on wrap.

### Wave 0 Gaps
- [ ] `lib/progression.ts` + `lib/progression.test.ts` — new pure module, covers PROG-02/PROG-03 core math
- [ ] `db/programs.ts` + `db/programs.crud.test.ts` — new data layer, covers PROG-01/PROG-04 + the D-05 origin-marker guard
- [ ] Additive migration `0004_*.sql` — `workouts.program_id`/`workouts.program_day_position` + `template_exercises.consecutive_fails`; regenerate `db/test/fixture.ts`'s journal-driven migration list automatically picks this up (no fixture code change needed, per its existing "reads `drizzle/meta/_journal.json`" design)
- [ ] `data/bundledPrograms/linear5x5.json` + `percentWave.json` — new static definitions, need at least one fixture-backed test asserting their exercise `seed_id`s resolve against `db/seed/exercises.seed.json`

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface in this phase (local-only app, no accounts touched) |
| V3 Session Management | no | N/A — Zustand ephemeral session store unchanged by this phase |
| V4 Access Control | no | Single-user local app, no multi-tenant boundaries |
| V5 Input Validation | yes | Mirror `db/templates.ts`'s existing `assertValid*` guard pattern for all new numeric inputs: `increment_kg`, `consecutive_fails`, `training_maxes.max_kg`, `program_days.position` — reject negative/NaN/non-finite/absurdly-large values before every insert/update, exactly like `assertValidTargetWeightKg`/`assertValidTargetReps` already do |
| V6 Cryptography | no | No new secrets/crypto surface introduced |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed `progression` JSON (`template_exercises.progression` is a free-text column) causing a parse crash or silently-wrong math (e.g. negative `increment_kg`, `pct` > 1, missing fields) | Tampering | Validate the parsed JSON shape (type discriminant + numeric range checks) before ANY progression math runs, mirroring the existing `assertValid*` numeric-guard pattern in `db/templates.ts`/`db/workouts.ts`; never trust a stored JSON blob's shape implicitly |
| A user (or a corrupted bundle JSON) supplying an out-of-range `program_days.position` or `current_day_position` that indexes past the array length | Tampering / Denial of Service (crash) | `db/programs.ts`'s advance/wrap logic must always compute the next position via `(position + 1) % dayCount`, never trust a stored position blindly against a stale `dayCount` if days were ever removed |
| Parameterized queries for all new `db/programs.ts` writes | Tampering | Continue the established Drizzle query-builder-only convention (no string-concatenated SQL) — already the pattern in every other `db/*.ts` module in this codebase |

## Sources

### Primary (HIGH confidence)
- `db/schema.ts`, `db/templates.ts`, `db/workouts.ts`, `lib/estimate1RM.ts`, `lib/weightUnits.ts`, `lib/plateSolver.ts`, `lib/percentOf1RM.ts`, `lib/warmupLadder.ts`, `db/settings.ts`, `db/test/fixture.ts`, `app/active-workout/summary.tsx`, `components/TemplateBuilderForm.tsx`, `db/seed/exercises.seed.json` — read directly this session; all codebase-derived claims (schema shape, existing patterns, exercise seed_ids, package versions) are `[VERIFIED]` against these files.
- `.planning/phases/06-programs-progression/06-CONTEXT.md`, `.planning/phases/03-templates-folders-calculators/03-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `docs/superpowers/specs/2026-07-19-workout-tracker-design.md` — read directly this session; locked-decision and design-spec claims are `[VERIFIED]` against these documents.
- Project memory `vitest-windows-paging-crash.md` — the `--no-file-parallelism` full-suite requirement, confirmed via direct read.

### Secondary (MEDIUM confidence — WebSearch cross-checked across ≥3 independent sources each)
- stronglifts.com (official) + support.stronglifts.com + legionathletics.com — linear 5x5 increment defaults (+2.5kg main lifts, +5kg deadlift) and workout A/B day composition.
- barbend.com, norma-athletics.at, myworkoutcalendar.com, train531.com — 5/3/1-style training max (90% of 1RM), 3-week wave percentages + deload week, and per-cycle TM bump (+2.5kg upper / +5kg lower).
- Cross-checked consecutive-miss deload rule (3 misses → 10% deload) via stronglifts support docs + multiple independent strength-coaching articles.

### Tertiary (LOW confidence)
- None — every WebSearch-derived claim above was cross-checked against at least 2-3 independent sources before being tagged MEDIUM/CITED; no single-source claims were carried into the Standard Stack or Code Examples sections without corroboration.

## Metadata

**Confidence breakdown:**
- Standard stack (strength-training numeric defaults): MEDIUM — cross-checked WebSearch, no official/authoritative single source exists for these community-originated conventions, but convergence across 3+ independent sources per claim is strong
- Architecture (schema reuse, transactional patterns, origin-marker/fail-counter placement): HIGH — directly grounded in this codebase's existing, already-shipped patterns (D-09, D-15, `db/templates.ts` conventions)
- Pitfalls: HIGH — each pitfall is either a direct extrapolation of an already-documented Phase 2/3 pitfall (warmup exclusion, plate-rounding granularity, transactional atomicity) or a straightforward consequence of this phase's own locked decisions (D-03/D-05/D-08/D-15)

**Research date:** 2026-07-23
**Valid until:** Indefinite for the strength-training conventions (decades-stable domain); 30 days for the codebase-grounded claims (re-verify if Phase 6 planning is delayed past a schema-touching phase)
