# Phase 6: Programs & Progression - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 6-programs-progression
**Areas discussed:** Program structure & advancement, Linear progression rules, Percent-of-TM waves (5/3/1), Bundled generic programs

---

## Program structure & advancement (PROG-01)

### How many programs in progress at once?
| Option | Description | Selected |
|--------|-------------|----------|
| One active program | Single program_state pointer; one "Next in program" home card | ✓ |
| Multiple concurrent | Several programs, each own pointer; needs picker + more UI | |

### When does the pointer advance?
| Option | Description | Selected |
|--------|-------------|----------|
| On finishing a program workout | Finishing the current day advances pointer + applies progression (spec §Screens 2) | ✓ |
| Manual "mark day done" | Explicit step; extra tap, easy to forget | |
| On starting the next day | Advance on start; discarded day would still advance | |

### After the last day?
| Option | Description | Selected |
|--------|-------------|----------|
| Wrap to day 1, cycle forever | Repeats indefinitely while progression climbs | ✓ |
| Stop at "program complete" | Finite; must restart | |
| You decide | — | |

### Start a different day than the pointer?
| Option | Description | Selected |
|--------|-------------|----------|
| Yes — tap any day, pointer follows | Forgiving of missed/reordered days | ✓ |
| Sequential only | Strict order; unforgiving | |
| Sequential + manual reset | Sequential + "set current day" control | |

**Notes:** Advancement/progression keyed to a program-day origin marker (D-05), not merely `workouts.template_id` — reusing a program's template ad-hoc must not move the pointer.

---

## Linear progression rules (PROG-02)

### Success definition?
| Option | Description | Selected |
|--------|-------------|----------|
| All working sets hit target reps | Strict all-sets rule (warmups excluded) | ✓ |
| Top set hits target reps | Only last/heaviest set | |
| Total reps met across sets | Sum ≥ sets×reps, any distribution | |

### Increment source?
| Option | Description | Selected |
|--------|-------------|----------|
| Per-exercise in rule JSON | `{type:'linear', increment_kg}` per exercise | ✓ |
| One global default | Single increment for all | |
| You decide | — | |

### On a miss?
| Option | Description | Selected |
|--------|-------------|----------|
| Hold, deload after N misses | Repeat; after ~3 consecutive misses auto-deload ~10% | ✓ |
| Hold only | Repeat, never auto-deload | |
| You decide | — | |

### Store the progressed weight?
| Option | Description | Selected |
|--------|-------------|----------|
| Write to template target weight | Update `template_exercises.target_weight_kg` in place | ✓ (Claude discretion — no user preference) |
| Per-program-day override | Separate store; template stays generic | |
| You decide | — | |

**Notes:** "No preference" on storage → Claude decided in-place write; confirmed safe by the Area-4 user-owned-copy model (D-15). Exact deload N/% flagged for research.

---

## Percent-of-TM waves (5/3/1) (PROG-03)

### TM source?
| Option | Description | Selected |
|--------|-------------|----------|
| Manual entry + compute-from-1RM helper | Type TM; optional % of entered/best-e1RM 1RM | ✓ |
| Auto-derive from best e1RM | No manual step; hides number, risk of wrong values | |
| You decide | — | |

### Wave modeling?
| Option | Description | Selected |
|--------|-------------|----------|
| Flatten into program days | Each week's session = its own day; single-session %TM sets; wave = day list | ✓ (Claude discretion — no user preference) |
| Store scheme + wave-week pointer | Full multi-week scheme + weekly counter | |
| You decide | — | |

### TM increase timing/amount?
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-bump after a full cycle | Per-exercise +2.5/+5kg on wrap; writes training_maxes | ✓ |
| Manual TM updates only | User edits between cycles | |
| You decide | — | |

### Computed weights at start?
| Option | Description | Selected |
|--------|-------------|----------|
| Plate-loadable round, pre-filled | round(TM×pct) via lib/weightUnits; pre-filled | ✓ (Claude discretion — no user preference) |
| Nearest 2.5kg/5lb target only | Fixed rounding, shown as target | |
| You decide | — | |

**Notes:** Two "no preference" answers resolved by Claude to defaults that compose with the cycle-forever + auto-bump model. Exact TM % and per-cycle increments flagged for research.

---

## Bundled generic programs + creation (PROG-04, PROG-01)

### Which bundled programs?
| Option | Description | Selected |
|--------|-------------|----------|
| Two — one linear, one %TM wave | Linear 5×5 (3-day) + 4-day %TM wave; exercises both engines | ✓ |
| Three — add a second linear | + second linear (3-day barbell / PPL) | |
| You decide | — | |

### Delivery + ownership?
| Option | Description | Selected |
|--------|-------------|----------|
| Bundle as data → user-owned copy on Add/Start | JSON defs; clone to editable rows; progression writes the copy | ✓ (Claude discretion — no user preference) |
| Seed all on launch, run shared read-only | All seeded; forces per-program-day override store | |
| You decide | — | |

### TM setup for %TM bundled program?
| Option | Description | Selected |
|--------|-------------|----------|
| Prompt to set/confirm each TM up front | With compute-from-1RM helper; correct day-1 weights | ✓ (Claude discretion — no user preference) |
| Seed placeholder TM from best e1RM | Zero friction; risk of wrong weights | |
| You decide | — | |

### Where is a per-exercise progression rule authored?
| Option | Description | Selected |
|--------|-------------|----------|
| In the template builder (per exercise) | Optional progression field on each exercise row; program = ordered templates | ✓ |
| In a separate program-day editor | Program-scoped override; duplicates authoring UI | |
| You decide | — | |

**Notes:** The delivery model (bundle-as-data → user-owned copy) resolved the Area-2 open storage item — in-place `target_weight_kg` writes are safe because they hit the user's copy, never the shared bundle.

---

## Claude's Discretion

- **D-09** (progressed-weight storage → in-place on `template_exercises.target_weight_kg`), **D-11** (wave flattened into program days), **D-13** (plate-loadable rounding + pre-fill), **D-15** (bundle-as-data → user-owned copy), **D-16** (prompt TMs up front) — all resolved by Claude where the user answered "no preference"; recorded as chosen defaults in CONTEXT.md.
- "Next in program" home-card layout, programs-manager anatomy, TM-setup sheet visuals → planner / UI-phase.
- Exact linear increments, deload N/%, %TM TM %, per-cycle TM bumps → research (flagged in CONTEXT.md).

## Deferred Ideas

- Multiple concurrent active programs (chose single-active for v1).
- Custom progression-rule editor UI (PROG-05 / v2).
- Configurable deload rule (user-set N / %).
- A third bundled program / richer library.
- Backup/export of programs & training maxes → Phase 7.
