# Phase 4: Stats & Charts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 4-Stats & Charts
**Areas discussed:** Stats screen layout & access, Per-exercise chart behavior, PR feed shape, Weekly volume by muscle group

---

## Stats screen layout & access

### Stats tab landing
| Option | Description | Selected |
|--------|-------------|----------|
| Overview dashboard | Single scroll: recent PR feed + weekly volume chart + per-exercise picker entry | ✓ |
| Exercise-first | Landing is an exercise picker; PRs and volume on separate sub-screens | |
| PR feed first | Recent PRs headline; volume + charts secondary | |

### Per-exercise chart access
| Option | Description | Selected |
|--------|-------------|----------|
| Both entry points | Picker in Stats tab AND "View progress" on exercise library detail | ✓ |
| Stats tab only | Pick exercise from within Stats | |
| Exercise library only | Charts reached only from exercise detail | |

### Layout / navigation
| Option | Description | Selected |
|--------|-------------|----------|
| Single scroll w/ sections | All views stacked in one scrollable screen | ✓ |
| Segmented sub-tabs | Segmented control (Charts / PRs / Volume) | |

**User's choice:** Overview dashboard; both entry points; single scroll with sections.
**Notes:** —

---

## Per-exercise chart behavior

### Default metric
| Option | Description | Selected |
|--------|-------------|----------|
| Estimated 1RM | Epley e1RM of best set each session | ✓ |
| Top set | Heaviest weight that session | |
| Volume | Session tonnage for the exercise | |

### Metric switching
| Option | Description | Selected |
|--------|-------------|----------|
| Segmented toggle above chart | One chart, 3-way swap | ✓ |
| Three stacked charts | All three shown, no toggle | |
| Dropdown menu | Menu picks active metric | |

### Time range
| Option | Description | Selected |
|--------|-------------|----------|
| All-time + range chips | Full history default; chips 3M/1Y/All; zoom if cheap | ✓ |
| All-time only, pan/zoom | Full history, gesture zoom, no chips | |
| 3 months default + chips | Opens recent 3mo; chips expand | |

### Trend-line granularity
| Option | Description | Selected |
|--------|-------------|----------|
| One point per workout | Each session = one point (day's best set) | ✓ |
| One point per set | Every logged set is a point | |

**User's choice:** est-1RM default; segmented toggle; all-time + chips; one point per workout.
**Notes:** Per-workout granularity chosen partly for STAT-04 responsiveness.

---

## PR feed shape

### PR types
| Option | Description | Selected |
|--------|-------------|----------|
| Rep-max records + e1RM | Best weight per rep count (1RM/3RM/5RM…) + best e1RM | ✓ |
| Best weight + best e1RM only | Matches existing session detectPRs | |
| Best e1RM only | Single record per exercise | |

### Feed presentation
| Option | Description | Selected |
|--------|-------------|----------|
| Recent feed + record board | Recent PR timeline + tap exercise for full record board | ✓ |
| Chronological feed only | Timeline of PR events only | |
| Current records list only | Static board, no time dimension | |

### Scope
| Option | Description | Selected |
|--------|-------------|----------|
| Recent across all, capped + see-all | Recent N events + "see all" link | ✓ |
| Only recently-trained exercises | Limited to last few weeks | |
| Full uncapped list | Every event on overview | |

**User's choice:** rep-max records + e1RM; recent feed + per-exercise record board; capped + see-all.
**Notes:** Requires an all-history rep-max computation beyond the current session-only detectPRs.

---

## Weekly volume by muscle group

### Volume metric
| Option | Description | Selected |
|--------|-------------|----------|
| Tonnage (kg×reps) | Consistent with workingSetVolume() | ✓ |
| Working set count | Set count per group per week | |
| Both (toggle) | Segmented tonnage/set-count | |

### Grouping
| Option | Description | Selected |
|--------|-------------|----------|
| Single muscle_group tag as-is | Matches current schema, no apportioning | ✓ |
| Primary + secondary split | Needs secondary-muscle data not in schema | |

### Chart form
| Option | Description | Selected |
|--------|-------------|----------|
| Stacked bar per week | One bar/week, segments by muscle group | ✓ |
| Grouped bars per week | Side-by-side bars per group | |
| Line per muscle group | One trend line per group | |

### Week boundary + window
| Option | Description | Selected |
|--------|-------------|----------|
| Mon–Sun, ~12 weeks + scroll | ISO weeks, recent 12wk, scroll for more | ✓ |
| Sun–Sat, ~12 weeks | US-style Sunday start | |
| Mon–Sun, all-time | Every week, no cap | |

**User's choice:** tonnage; single muscle_group tag as-is; stacked bar per week; Mon–Sun, ~12 weeks + scroll.
**Notes:** Research must validate distinct muscle_group seed values before building the stacked bar.

---

## Claude's Discretion

- Exact cap N for overview PR feed (~10–15).
- Empty-state copy/visuals for new users or sparse exercises.
- Chart colors within dark-first theme.ts palette.
- Whether pinch/pan zoom ships in v1.

## Deferred Ideas

- Rep-range distribution & session-duration trend charts — v2 (STAT-05).
- Secondary-muscle volume apportioning — needs new seed data + schema.
- Pinch/pan zoom — only if cheap with victory XL.
- Research flags: validate muscle_group seed values; install victory-native + skia (dev-client check); design STAT-04 synthetic-dataset perf test.
