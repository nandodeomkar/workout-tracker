# Requirements: Workout Tracker

**Defined:** 2026-07-19
**Core Value:** Logging a strength workout in the gym must be fast, offline, and never lose data — free, with no clutter or upsell.

## v1 Requirements

### Foundation & Exercise Library

- [x] **FNDN-01**: App runs offline-first on Android with local SQLite as the sole source of truth (no server)
- [x] **FNDN-02**: Database migrations run safely on app upgrade without losing existing user data
- [x] **EXER-01**: User can browse and search a seeded exercise library (~250 exercises from free-exercise-db, tagged by muscle group and equipment)
- [x] **EXER-02**: User can create, edit, and archive custom exercises

### Core Workout Logging

- [x] **LOG-01**: User can start a workout (empty or from template) and log sets with reps and weight in ≤2 taps per set, pre-filled from last performance
- [x] **LOG-02**: Every completed set is persisted immediately; an in-progress workout survives app kill, crash, or phone restart
- [x] **LOG-03**: User gets a rest timer with auto-start on set completion and a notification that fires reliably with screen off
- [x] **LOG-04**: User can add, reorder, replace, and remove exercises during an active workout
- [x] **LOG-05**: User can finish or discard a workout and see a summary (duration, volume, PRs hit)
- [x] **LOG-06**: User can enter weights in kg or lb; values stored canonically in kg

### History

- [x] **HIST-01**: User can view workout history as a list and calendar
- [x] **HIST-02**: User can view and edit any past workout (sets, reps, weights, exercises)

### Templates

- [x] **TMPL-01**: User can create, edit, and organize workout templates in folders
- [x] **TMPL-02**: Starting from a template pre-fills exercises and last-performance values
- [x] **TMPL-03**: User can save a completed workout as a template

### Programs & Progression

- [ ] **PROG-01**: User can create a program as an ordered list of template days with a pointer to the next day
- [ ] **PROG-02**: Program templates support linear progression rules (auto-increment weight on success)
- [ ] **PROG-03**: Program templates support percent-of-training-max progression (5/3/1-style waves) with per-exercise training maxes
- [ ] **PROG-04**: App ships with a small set of bundled generic programs (public methodologies, no proprietary content)

### Stats & PRs

- [ ] **STAT-01**: User can view per-exercise charts: estimated 1RM, top set, and volume over time
- [ ] **STAT-02**: User can view weekly volume by muscle group
- [ ] **STAT-03**: User sees a PR feed; PRs are computed from sets, never stored
- [ ] **STAT-04**: Charts stay responsive with years of history (validated against a large synthetic dataset)

### Body Measurements

- [ ] **MEAS-01**: User can log body measurements (weight, body parts) with date
- [ ] **MEAS-02**: User can view measurement history as graphs

### Utilities

- [x] **UTIL-01**: User can open a plate calculator inline from the active workout
- [x] **UTIL-02**: User can use a 1RM calculator
- [x] **UTIL-03**: User gets warm-up set suggestions for a working weight

### Backup & Export

- [ ] **BAK-01**: User can optionally sign in with Google and back up the database to Drive appDataFolder (consistent snapshot, never blocks or gates logging)
- [ ] **BAK-02**: User can restore from a Drive backup with explicit confirmation
- [ ] **BAK-03**: User can export all data as CSV and JSON

### UI & Distribution

- [ ] **UI-01**: Dark-first clean UI with StrengthLog-style 5-tab layout, zero paywalls, ads, or upsell anywhere
- [ ] **DIST-01**: Friends can install and update the app via direct APK (EAS build) with onboarding notes for Play Protect warnings

## v2 Requirements

Deferred until v1 validated by friends beta:

- **STAT-05**: Additional chart types (rep-range distribution, session duration trends)
- **PROG-05**: Custom progression rule editor UI (v1 covers linear + %TM via JSON rules)
- **DIST-02**: Play Store public release (listing, screenshots, policy compliance)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Social features (feeds, leaderboards, sharing) | Not needed for personal/friends use; revisit at public release |
| iOS build | All current users on Android; stack keeps the door open |
| App server / hosted backend | Zero running costs; Drive app-data covers backup |
| Monetization, ads, accounts beyond optional Google sign-in | The whole point is free and clean |
| Exercise instruction videos/animations | Large content burden, low value for experienced lifters |
| Gamification, streaks, AI programming | Research: serious lifters view these as bloat (anti-features) |

## Traceability

Which phases cover which requirements. Filled by roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FNDN-01 | Phase 1 | Complete |
| FNDN-02 | Phase 1 | Complete |
| EXER-01 | Phase 1 | Complete |
| EXER-02 | Phase 1 | Complete |
| LOG-01 | Phase 2 | Complete |
| LOG-02 | Phase 2 | Complete |
| LOG-03 | Phase 2 | Complete |
| LOG-04 | Phase 2 | Complete |
| LOG-05 | Phase 2 | Complete |
| LOG-06 | Phase 2 | Complete |
| HIST-01 | Phase 2 | Complete |
| HIST-02 | Phase 2 | Complete |
| TMPL-01 | Phase 3 | Complete |
| TMPL-02 | Phase 3 | Complete |
| TMPL-03 | Phase 3 | Complete |
| UTIL-01 | Phase 3 | Complete |
| UTIL-02 | Phase 3 | Complete |
| UTIL-03 | Phase 3 | Complete |
| STAT-01 | Phase 4 | Pending |
| STAT-02 | Phase 4 | Pending |
| STAT-03 | Phase 4 | Pending |
| STAT-04 | Phase 4 | Pending |
| MEAS-01 | Phase 5 | Pending |
| MEAS-02 | Phase 5 | Pending |
| PROG-01 | Phase 6 | Pending |
| PROG-02 | Phase 6 | Pending |
| PROG-03 | Phase 6 | Pending |
| PROG-04 | Phase 6 | Pending |
| BAK-01 | Phase 7 | Pending |
| BAK-02 | Phase 7 | Pending |
| BAK-03 | Phase 7 | Pending |
| UI-01 | Phase 8 | Pending |
| DIST-01 | Phase 8 | Pending |

**Coverage:** 33/33 v1 requirements mapped ✓

---
*Requirements defined: 2026-07-19*
*Source: .planning/PROJECT.md, docs/superpowers/specs/2026-07-19-workout-tracker-design.md, .planning/research/*
