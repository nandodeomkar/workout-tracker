# Roadmap: Workout Tracker

## Overview

The journey runs from a durable offline data foundation, through the fast crash-safe logging loop that is the app's entire reason to exist, out to the planning and utility layer (templates, calculators) that makes logging faster, into the stats/charts and body-measurement views that make progress visible, then to the highest-risk feature (structured programs with progression), and finally to the isolated backup/export safety net and the polish/distribution work needed to put a sideloaded APK in friends' hands. Each phase leaves the app in a state a real person could use for real training — nothing is a throwaway scaffold.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Scaffold & Data Foundation** - Offline-first SQLite foundation with safe migrations and a searchable exercise library (6 plans + gap closure GAP-1..4; device UAT all 7 tests pass 2026-07-21, see 01-UAT.md)
- [x] **Phase 2: Core Logging (Active Workout)** - Fast, crash-safe set logging with rest timer and workout history (completed 2026-07-22; device UAT 6/6 pass 2026-07-22, 2 fixes: SetRow ✓ overflow + rest-notif sound, see 02-UAT.md)
- [x] **Phase 3: Templates, Folders & Calculators** - Reusable workout templates plus plate/1RM/warm-up calculators (completed 2026-07-22)
- [ ] **Phase 4: Stats & Charts** - Per-exercise progress charts, weekly volume, and a live-computed PR feed
- [ ] **Phase 5: Body Measurements** - Body measurement logging and trend graphs
- [ ] **Phase 6: Programs & Progression** - Ordered program days with linear and percent-of-TM progression
- [ ] **Phase 7: Backup & Export** - Optional Google Drive backup/restore and CSV/JSON export
- [ ] **Phase 8: Polish & Beta Distribution** - Zero-paywall UI audit, notification hardening, and friend APK distribution

## Phase Details

### Phase 1: Scaffold & Data Foundation

**Goal**: The app has a durable local data foundation — offline SQLite storage that survives schema upgrades — and a searchable exercise library to log against.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FNDN-01, FNDN-02, EXER-01, EXER-02
**Success Criteria** (what must be TRUE):

  1. App launches and runs fully offline, with local SQLite as the sole source of truth and no network calls required
  2. User can browse and search a seeded library of ~250 exercises by name, muscle group, and equipment
  3. User can create, edit, and archive a custom exercise alongside the seeded ones
  4. A simulated app upgrade (schema migration) runs against a populated database without crashing or losing existing data

**Plans**: 6 plans (Walking Skeleton)Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: scaffold + Drizzle wiring + 13-table schema + migration gate + stub seed + minimal Exercises render

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Exercise curation pipeline + real ~400–500-row seed JSON (idempotent, no-clobber)
- [x] 01-03-PLAN.md — Migration safety (FNDN-02): additive migration 0002 + populate→upgrade→data-intact test

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-04-PLAN.md — Exercise library browse & search UI (flat A–Z, substring search, multi-select chip filters)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-05-PLAN.md — Custom exercise lifecycle: create (duplicate warn-but-allow), edit-in-place, reversible archive

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-06-PLAN.md — On-device offline foundation verification checkpoint (FNDN-01)

### Phase 2: Core Logging (Active Workout)

**Goal**: Users can log a full strength workout in the gym fast, offline, and without losing data even if the app crashes or the phone restarts.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, LOG-06, HIST-01, HIST-02
**Success Criteria** (what must be TRUE):

  1. User can start a workout (blank or from history) and log a set's reps and weight in 2 taps or fewer, pre-filled from their last performance of that exercise
  2. An in-progress workout survives an app kill, crash, or phone restart with no lost sets, because every completed set is persisted immediately
  3. A rest timer auto-starts on set completion and delivers a reliable notification even with the screen off or phone locked
  4. User can add, reorder, replace, and remove exercises during an active workout, then finish or discard it and see a summary (duration, volume, PRs hit)
  5. User can enter weights in kg or lb, view workout history as a list and a calendar, and edit any past workout's sets, reps, weights, or exercises

**Plans**: 7 plans
**UI hint**: yes

**Wave 1**

- [x] 02-01-PLAN.md — Pure calculators: kg/lb converter, Epley 1RM, working-set volume, PR detection (vitest)
- [x] 02-02-PLAN.md — Rest-override migration (additive `exercises.rest_seconds`) + crash-safe workout/set data core + settings helper

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-03-PLAN.md — Workout mutations (reorder/replace/remove, discard cascade, finish) + history/prior-bests queries
- [x] 02-04-PLAN.md — Active-workout logging screen: Zustand store, set steppers + custom keypad, start-empty/resume (the core loop)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-05-PLAN.md — Settings rows (units + default rest) + drag-reorder/replace/remove UI + [SUS] package legitimacy gate

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 02-06-PLAN.md — Rest timer (auto-start, drift-free countdown, screen-off notification) + per-exercise override pill + finish/summary + discard

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 02-07-PLAN.md — History (list + month calendar + detail) + edit-past-workout reuse + start-from-history

### Phase 3: Templates, Folders & Calculators

**Goal**: Users can plan workouts ahead of time with reusable templates and get instant utility calculations during logging.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: TMPL-01, TMPL-02, TMPL-03, UTIL-01, UTIL-02, UTIL-03
**Success Criteria** (what must be TRUE):

  1. User can create, edit, and organize workout templates into folders
  2. Starting a workout from a template pre-fills its exercises and last-performance values
  3. User can save a completed workout as a new template
  4. User can open a plate calculator inline from the active workout to see plate loading for a target weight
  5. User can use a 1RM calculator and get warm-up set suggestions for a given working weight

**Plans**: 6 plans (3 waves) + gap closure GAP 07-08 (2 plans, from 03-UAT)
**Mode:** mvp
**UI hint**: yes

**Wave 1** *(tested foundations — pure lib + data layer, parallel)*

- [x] 03-01-PLAN.md — Calculator math lib: plate solver, warm-up ladder, %-of-1RM table (vitest, UTIL-01/02/03)
- [x] 03-02-PLAN.md — Template pure logic: start-from-template pre-fill merge + save-as-template capture (vitest, TMPL-02/03)
- [x] 03-03-PLAN.md — Template data layer db/templates.ts: CRUD + detach-delete + folder grouping + start-from-template copy (TMPL-01/02)

**Wave 2** *(blocked on Wave 1)*

- [x] 03-04-PLAN.md — Calculator sheet components + bar-weight setting + standalone Tools screens (UTIL-01/02/03)

**Wave 3** *(blocked on Wave 2)*

- [x] 03-05-PLAN.md — Template builder + folder-grouped Workout-home list + start-from-template (TMPL-01/02)
- [x] 03-06-PLAN.md — Active-workout inline calculators + template value pre-fill + save-as-template (UTIL-01/02/03, TMPL-02/03)

**Gap closure** *(from 03-UAT — 2 defects, 3 gaps; parallel, Wave 1)*

- [x] 03-07-PLAN.md — Reachable template edit entry point: onEdit affordance on TemplateRow → /templates/[templateId] (TMPL-01, UAT Gap 1)
- [x] 03-08-PLAN.md — Warm-up log skips rest timer + per-set un-log (deleteSet helper) in handleLogSet (LOG-02/LOG-03, D-01 un-deferred, UAT Gaps 2-3)

### Phase 4: Stats & Charts

**Goal**: Users can see their strength progress over time through fast, reliable charts.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: STAT-01, STAT-02, STAT-03, STAT-04
**Success Criteria** (what must be TRUE):

  1. User can view per-exercise charts for estimated 1RM, top set, and volume over time
  2. User can view weekly training volume broken down by muscle group
  3. User sees a PR feed reflecting bests computed live from logged sets, never from a stored/cached value
  4. Charts stay responsive when loaded against a large synthetic dataset representing years of history

**Plans**: 6 plans (5 waves)
**UI hint**: yes

Plans:

**Wave 1**

- [x] 04-01-PLAN.md — Charting deps install ([SUS] skia gate) + native dev-client rebuild (STAT-01/02 enabler)

**Wave 2** *(blocked on Wave 1)*

- [x] 04-02-PLAN.md — Per-exercise progress chart slice: buildChartSeries + loadExerciseChartSets + chart screen w/ metric toggle + range chips + View-progress entry (STAT-01)

**Wave 3** *(blocked on Wave 2)*

- [ ] 04-03-PLAN.md — Weekly volume by muscle group: weeklyVolume lib + palette + query + Stats dashboard shell + stacked bar + exercise picker (STAT-02)

**Wave 4** *(blocked on Wave 3)*

- [ ] 04-04-PLAN.md — Live PR feed: computeAllTimeRecords + loadAllHistorySets + Section A feed + See-all full history (STAT-03)

**Wave 5** *(blocked on Wave 4; two parallel plans)*

- [ ] 04-05-PLAN.md — Per-exercise record board (curated rep-max + best e1RM, live) on the exercise screen (STAT-03)
- [ ] 04-06-PLAN.md — STAT-04 performance validation: synthetic ~15,600-set history + timed query paths + on-device responsiveness check (STAT-04)

### Phase 5: Body Measurements

**Goal**: Users can track body measurements independently of the workout-logging core.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: MEAS-01, MEAS-02
**Success Criteria** (what must be TRUE):

  1. User can log body weight and body-part measurements with a date
  2. User can view measurement history as trend graphs over time

**Plans**: TBD
**UI hint**: yes

### Phase 6: Programs & Progression

**Goal**: Users can run a structured multi-week program that auto-advances through days and progresses their working weights.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: PROG-01, PROG-02, PROG-03, PROG-04
**Success Criteria** (what must be TRUE):

  1. User can create a program as an ordered list of template days with a pointer to the next day
  2. Completing a program day with a linear-progression exercise auto-increments its prescribed weight on success
  3. A percent-of-training-max exercise computes prescribed weights from a per-exercise training max across a wave (5/3/1-style)
  4. User can select from a small set of bundled generic programs (public methodologies, no proprietary content) and start using one immediately

**Plans**: TBD

### Phase 7: Backup & Export

**Goal**: Users' data is never at risk of permanent loss — it can be backed up to their own Google Drive and exported on demand, without ever blocking core logging.
**Mode:** mvp
**Depends on**: Phase 6
**Requirements**: BAK-01, BAK-02, BAK-03
**Success Criteria** (what must be TRUE):

  1. User can optionally sign in with Google and back up a consistent database snapshot to Drive appDataFolder, and this never blocks or gates logging
  2. User can restore from a Drive backup after explicit confirmation, and the restored data matches the backup
  3. User can export all data as CSV and as JSON

**Plans**: TBD

### Phase 8: Polish & Beta Distribution

**Goal**: The app is a cohesive, ad-free product that friends can install directly and rely on in real gym conditions.
**Mode:** mvp
**Depends on**: Phase 7
**Requirements**: UI-01, DIST-01
**Success Criteria** (what must be TRUE):

  1. Every screen uses a dark-first UI with a StrengthLog-style 5-tab layout, with zero paywalls, ads, or upsell prompts anywhere
  2. Rest-timer notifications fire reliably across tested devices with the screen off or locked, including aggressive OEM battery/notification behavior
  3. Friends can install and update the app via a direct APK (EAS build), guided by onboarding notes explaining Play Protect warnings

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Scaffold & Data Foundation | 6/6 | Complete   | 2026-07-21 |
| 2. Core Logging (Active Workout) | 7/7 | Complete   | 2026-07-22 |
| 3. Templates, Folders & Calculators | 8/8 | Complete   | 2026-07-22 |
| 4. Stats & Charts | 2/6 | In Progress|  |
| 5. Body Measurements | 0/TBD | Not started | - |
| 6. Programs & Progression | 0/TBD | Not started | - |
| 7. Backup & Export | 0/TBD | Not started | - |
| 8. Polish & Beta Distribution | 0/TBD | Not started | - |

---
*Roadmap created: 2026-07-19*
*Source: .planning/PROJECT.md, .planning/REQUIREMENTS.md, .planning/research/SUMMARY.md*
