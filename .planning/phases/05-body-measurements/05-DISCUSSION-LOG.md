# Phase 5: Body Measurements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 5-Body Measurements
**Areas discussed:** Metric set, Units, Entry flow, Trend graph

---

## Metric set

### Built-in metrics
| Option | Description | Selected |
|--------|-------------|----------|
| StrengthLog-style full set | Weight + neck, shoulders, chest, waist, hips, biceps (L/R), forearm (L/R), thigh (L/R), calf (L/R). Body-fat % optional. | ✓ |
| Core set | Weight + chest, waist, hips, biceps, thigh. | |
| Weight only + all custom | Only body weight built-in; everything else custom. | |

### Custom metrics
| Option | Description | Selected |
|--------|-------------|----------|
| Yes, free-form custom metrics | User adds named metrics; needs an add affordance + unit-type pick. Table stores metric as free text. | ✓ |
| No, fixed built-in list only | Simpler UI, no unit-type ambiguity. | |

**User's choice:** Full StrengthLog set + free-form custom metrics.
**Notes:** Free-form choice implies each metric carries a unit type (weight/length/percent), which must be persisted for custom metrics — flagged for planner.

---

## Units

### Length unit
| Option | Description | Selected |
|--------|-------------|----------|
| Tied to weight unit | kg→cm, lb→in via the existing LOG-06 setting. | |
| Separate length-unit setting | Independent cm/in toggle, decoupled from weight. | ✓ |

### Storage
| Option | Description | Selected |
|--------|-------------|----------|
| Canonical base, convert on display | Store kg/cm/percent, convert in UI (matches D-16 weights). | ✓ |
| Store as-entered | Save typed unit; needs migration on unit flip. | |

**User's choice:** Separate cm/in setting + canonical storage with display conversion.
**Notes:** Allows mixed preferences (e.g. lb + cm). Adds one settings row + one setting key.

---

## Entry flow

### Entry model
| Option | Description | Selected |
|--------|-------------|----------|
| Per-metric add (list → tap → add) | StrengthLog-style; natural for frequent weigh-ins. | |
| Dated session (fill many at once) | One flow per date, blanks skipped; good for measure-day. | |
| Both: quick weight + session | Fast weigh-in path + full dated session. | ✓ |

### Edit / date handling
| Option | Description | Selected |
|--------|-------------|----------|
| Edit + delete, date today-default & editable | Full correction control, back-datable. | ✓ |
| Add + delete only (no edit) | Delete-and-re-add to fix. | |
| Append-only, today only | Minimal, no back-dating or correction. | |

**User's choice:** Both entry models; edit + delete; date defaults today, back-datable.
**Notes:** Correction control chosen so a mistaken weigh-in doesn't poison the trend graph.

---

## Trend graph

### Structure
| Option | Description | Selected |
|--------|-------------|----------|
| One dedicated Measurements screen | Latest value + graph + history + add/edit per metric, all in one place. | ✓ |
| Split: graph on Stats, entry in Settings | Follows design spec literally; scatters across two tabs. | |

### Entry point
| Option | Description | Selected |
|--------|-------------|----------|
| Settings row (per spec) | "Body Measurements" row in Settings/More. | ✓ |
| Settings row + Stats card | Also a card on the Stats tab. | |

### Graph shape
| Option | Description | Selected |
|--------|-------------|----------|
| Per-metric line, reuse Phase 4 chrome | Metric picker + victory line + range chips (3M/1Y/All) + sparse handling. | ✓ |
| Per-metric line, no range chips | Always all-time, no range filter. | |

**User's choice:** One dedicated Measurements screen; Settings-row entry point; per-metric line reusing Phase 4 chart chrome.
**Notes:** Consolidates the design spec's split layout into one cohesive screen while keeping the spec's Settings entry point. Phase 8 owns any tab-level changes.

---

## Claude's Discretion

- Whether body-fat % ships as a seeded built-in or only as a user-added custom metric.
- Exact persistence design for per-metric unit type (migration vs. code registry).
- Quick-weigh-in fast-path placement, empty/sparse-state copy/visuals, metric ordering/grouping, chart colors within `theme.ts`.

## Deferred Ideas

- Measurement graphs as a Stats-tab section (design spec line 100) — reconsider during Phase 8 UI/nav audit.
- Progress photos / body-composition scans / measurement reminders — own future phase if ever wanted.
