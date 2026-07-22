# Phase 3: Templates, Folders & Calculators - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 3-templates-folders-calculators
**Areas discussed:** Template pre-fill + save-as-template, Template + folder organization UX, Plate calculator, Warm-up + 1RM calculators

---

## Template pre-fill + save-as-template

### Q1 — What pre-fills each set row when starting a template?
| Option | Description | Selected |
|--------|-------------|----------|
| Last performance, fallback to target | Structure from template; weight/reps from last performance, fall back to template target when no history | ✓ |
| Always template targets | Always show stored target_weight_kg / target_reps, ignore history | |
| Last performance only | Ignore targets except for set count; blank for never-logged exercises | |

### Q2 — What does 'save finished workout as template' capture?
| Option | Description | Selected |
|--------|-------------|----------|
| Structure: exercises + set counts as targets | Exercise list + per-exercise set count + typical reps; target_weight null | ✓ |
| Full snapshot: exercises + sets/reps/weights | Freeze exact weights/reps as targets | |
| Exercises only | Just the exercise list; targets default | |

**User's choice:** Last-performance-with-target-fallback pre-fill; structure-only save (weights stay history-driven).
**Notes:** Templates are a plan, not a frozen snapshot.

---

## Template + folder organization UX

### Q1 — How can a user create a template?
| Option | Description | Selected |
|--------|-------------|----------|
| Both: builder + save-from-workout | Dedicated editor AND save-from-finished-workout | ✓ |
| Save-from-workout only | Only via finishing a workout | |
| Builder only | Dedicated editor only (conflicts with TMPL-03) | |

### Q2 — How are folders assigned?
| Option | Description | Selected |
|--------|-------------|----------|
| Free-text + existing suggestions | Type new or tap existing; flat templates.folder column | ✓ |
| Pick-from-existing only | Choose from folders created separately | |

### Q3 — How do templates display on the Workout home?
| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by folder, collapsible sections | Collapsible folder headers + Uncategorized bucket | ✓ |
| Flat list with folder tag per row | Single list with folder badges | |
| Folder drill-down | Home shows folders; tap → templates | |

**User's choice:** Builder + save-from-workout; free-text folders with suggestions; grouped-by-folder collapsible home.

---

## Plate calculator

### Q1 — Bar weight + available plates fixed or configurable?
| Option | Description | Selected |
|--------|-------------|----------|
| Configurable bar, standard plate set | Bar weight a Setting (20kg/45lb default); standard plates per unit; inventory edit deferred | ✓ |
| Fully fixed | 20kg bar + standard plates hardcoded | |
| Configurable bar AND plate inventory | User edits bar + exact plates owned | |

### Q2 — How is the plate calculator invoked?
| Option | Description | Selected |
|--------|-------------|----------|
| Inline per-exercise, prefilled w/ current weight | Plates button on card/set row → per-side breakdown; editable; also standalone | ✓ |
| Exercise ⋯ overflow menu | Reachable via overflow | |
| Standalone tool only | Separate screen, manual weight entry | |

### Q3 — When a weight isn't exactly loadable?
| Option | Description | Selected |
|--------|-------------|----------|
| Nearest achievable + delta | Closest loadable weight + plates + difference | ✓ |
| Exact only, else 'not loadable' | Only exactly-achievable | |

**User's choice:** Configurable bar (Setting) + standard plates; inline per-exercise prefilled; nearest-achievable + delta.

---

## Warm-up + 1RM calculators

### Q1 — Warm-up scheme?
| Option | Description | Selected |
|--------|-------------|----------|
| Fixed %-ladder, plate-rounded | bar → 40/60/80% with descending reps, rounded to plate-achievable | ✓ |
| Plate-jump based | Add plates progressively | |
| Configurable scheme | User edits % steps and reps | |

### Q2 — Warm-up sets auto-insert or display?
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-insert as warmup rows, one-tap accept | Insert sets.type='warmup' rows; accept/adjust/delete | ✓ |
| Display suggestion only | Read-only list; add manually | |

### Q3 — 1RM calculator scope + location?
| Option | Description | Selected |
|--------|-------------|----------|
| Estimate + %-table, inline & standalone | Epley estimate + %-of-1RM table; inline + standalone | ✓ |
| Estimate only, inline | Just the number, inline | |
| Standalone tool only | Separate screen only | |

**User's choice:** Fixed plate-rounded %-ladder; auto-insert warmup rows; 1RM estimate + %-table, inline & standalone.

---

## Claude's Discretion
- Standalone-calculator placement (Tools under More vs elsewhere).
- Exact warm-up %/rep ladder values and number of warm-up sets.
- Template-builder screen anatomy, folder-section collapse UI, plate-sheet visual design.
- "Typical reps" definition for save-as-template (last set vs modal).
- settings key name for bar weight + plate-set representation.

## Deferred Ideas
- User-editable plate inventory + per-exercise/alternate bar weight → v2.
- Configurable warm-up scheme editor → v2.
- Progression rules on template_exercises + "Next in program" card → Phase 6.
- Standalone Tools/utilities hub polish → planner discretion / Phase 8.
