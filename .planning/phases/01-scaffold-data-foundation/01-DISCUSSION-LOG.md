# Phase 1: Scaffold & Data Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 1-Scaffold & Data Foundation
**Areas discussed:** Exercise taxonomy & curation, Library browse & search UX, Custom exercise lifecycle, Scaffold breadth

*Area selection: user answered "[No preference]" — all four proposed areas discussed, questions batched with recommendations marked.*

---

## Exercise taxonomy & curation

### Muscle group tagging scheme

| Option | Description | Selected |
|--------|-------------|----------|
| Single primary group, fixed list | One primary muscle group per exercise from fixed ~10-item list; clean stats, each set counts once | ✓ |
| Primary + secondary groups | Richer stats via fractional volume counting, more curation work | |
| Keep raw free-exercise-db muscles | No curation now, inconsistent granularity for charts later | |

**User's choice:** Single primary group, fixed list (Recommended)

### Trim strategy for free-exercise-db (~870 exercises)

| Option | Description | Selected |
|--------|-------------|----------|
| Script filter + manual review (~250) | Script drops obscure variants, user reviews final list | |
| Fully scripted, no review | Heuristic filter only | |
| Keep more (~400–500) | Trim only clear junk; bigger library, less curation risk | ✓ |

**User's choice:** Keep more (~400–500)
**Notes:** Diverges from spec's ~250 figure — treated as refinement of EXER-01, not scope change.

### Seed shipping + update policy

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled JSON + seed version | Insert on first launch; additive updates never overwrite user edits | ✓ |
| Pre-built SQLite file | Faster first launch, complicates migrations/merging | |
| Seed once, never update | Simplest, library frozen | |

**User's choice:** Bundled JSON + seed version (Recommended)

### Equipment tag scheme

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed short list | Barbell, Dumbbell, Machine, Cable, Bodyweight, Kettlebell, Band, Other | ✓ |
| Raw dataset equipment values | No mapping work, inconsistent filter labels | |

**User's choice:** Fixed short list (Recommended)

---

## Library browse & search UX

### Default library organization

| Option | Description | Selected |
|--------|-------------|----------|
| Flat A–Z list + filter chips | Alphabetical list, sticky search, chips on top | ✓ |
| Grouped by muscle group | Section headers, longer scroll | |
| Recent/frequent first | Usage-based ordering; empty signal at first launch | |

**User's choice:** Flat A–Z list + filter chips (Recommended)

### Search behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Live substring, name-only | Filter-as-you-type, case-insensitive, matches anywhere in name | ✓ |
| Name + muscle/equipment text | Broader recall, muddier results | |
| Fuzzy/typo-tolerant | Extra matching logic for marginal gain | |

**User's choice:** Live substring, name-only (Recommended)

### Filter interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Chip rows, multi-select, AND across dimensions | OR within row, AND across rows, one-tap clear | ✓ |
| Single-select chips | One group + one equipment max | |
| Filter sheet (modal) | Cleaner bar, extra tap per change | |

**User's choice:** Chip rows, multi-select, AND across dimensions (Recommended)

### List row content + custom exercise display

| Option | Description | Selected |
|--------|-------------|----------|
| Name + tags line, custom badge, mixed in | Secondary line "muscle group · equipment"; customs in A–Z with badge | ✓ |
| Custom section pinned on top | Separate section, splits A–Z ordering | |
| Name only, minimal rows | Densest, info hidden in detail view | |

**User's choice:** Name + tags line, custom badge, mixed in (Recommended)

---

## Custom exercise lifecycle

### Creation form fields

| Option | Description | Selected |
|--------|-------------|----------|
| Name + muscle group + equipment, optional notes | Tags from same fixed lists as seeded; fast creation | ✓ |
| Name only, tags optional | Fastest, but untagged exercises fall out of stats | |
| Rich form (+ instructions, media) | Spec excludes instruction content | |

**User's choice:** Name + muscle group + equipment, optional notes (Recommended)

### Editing seeded exercises

| Option | Description | Selected |
|--------|-------------|----------|
| Rename/re-tag allowed, tracked | Edits in place; seed updates never overwrite edited rows | ✓ |
| Seeded read-only, duplicate to customize | Cleaner provenance, splits history | |
| Notes only editable | Least flexible | |

**User's choice:** Rename/re-tag allowed, tracked (Recommended)

### Archive semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden from pickers, history intact, unarchivable | Toggle reveals archived; reversible; custom + seeded; no hard delete v1 | ✓ |
| Archive custom only, hide seeded separately | Two mechanisms, same outcome | |
| Allow hard delete when unused | Edge-case logic for zero-set customs | |

**User's choice:** Hidden from pickers, history intact, unarchivable (Recommended)

### Duplicate names

| Option | Description | Selected |
|--------|-------------|----------|
| Warn but allow | Inline hint "X already exists — open it?" + proceed anyway | ✓ |
| Block exact duplicates | Strict, annoying for legit variants | |
| Allow silently | Accidental duplicates fragment history | |

**User's choice:** Warn but allow (Recommended)

---

## Scaffold breadth

### Navigation shell scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full 5-tab shell, placeholder screens | All 5 tabs; Exercises functional, others "coming soon" | ✓ |
| Exercises tab only | Minimal, nav rework cost later | |
| Shell + Settings functional | Adds working units/theme settings now | |

**User's choice:** Full 5-tab shell, placeholder screens (Recommended)

### Theme formality

| Option | Description | Selected |
|--------|-------------|----------|
| Token file, dark-only | theme.ts tokens consumed everywhere; light = later swap | ✓ |
| Dark + light both now | Doubles visual QA before real UI exists | |
| Ad-hoc styles, formalize later | Guaranteed restyling debt | |

**User's choice:** Token file, dark-only (Recommended)

### Database schema scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full schema from spec, one migration | Migration 0001 = all tables; Phase 1 populates exercises + settings | ✓ |
| Only Phase 1 tables | Per-phase migrations, schema churn risk | |
| You decide | Defer to research/planning | |

**User's choice:** Full schema from spec, one migration (Recommended)

### First-launch experience

| Option | Description | Selected |
|--------|-------------|----------|
| Silent seed, land on tabs | No onboarding; seed fast and invisible | ✓ |
| Brief unit picker (kg/lb) first | One-screen setup; kg default suffices | |
| Loading/progress screen during seed | Only worth it if seeding slow | |

**User's choice:** Silent seed, land on tabs (Recommended)

---

## Claude's Discretion

- Drizzle migration ergonomics, seed-JSON shape, seed-version bookkeeping, chip/list component structure, curation script details
- Exercise detail screen depth in Phase 1 (minimal detail/edit view acceptable; history/records/1RM chart need logged data from later phases)

## Deferred Ideas

- Recent/frequent-first exercise ordering in workout picker context (Phase 2+)
- Light theme (later token swap; Phase 8 polish)
- Functional Settings screen UI (table exists from migration 0001; UI in later phases)
