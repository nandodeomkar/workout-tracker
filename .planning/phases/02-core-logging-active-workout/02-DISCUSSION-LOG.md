# Phase 2: Core Logging (Active Workout) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-21
**Phase:** 02-core-logging-active-workout
**Areas discussed:** Set-logging loop, Starting a workout, Rest timer behavior, Finish summary + PR scope, History editing

---

## Set-logging loop

| Option | Description | Selected |
|--------|-------------|----------|
| Logs set as-is, 1 tap | ✓ commits pre-filled weight/reps immediately | ✓ |
| Confirm weight+reps first | ✓ enabled only after glancing/adjusting | |

**User's choice:** ✓ logs set as-is (D-01).

| Option | Description | Selected |
|--------|-------------|----------|
| Steppers + tap-to-type | ±2.5 kg/±1 rep steppers + numeric keypad on tap | ✓ |
| Steppers only | ± buttons only | |
| Keypad only | Tap always opens keypad | |

**User's choice:** Steppers + tap-to-type (D-02).

| Option | Description | Selected |
|--------|-------------|----------|
| Weight/reps + warmup toggle | Normal sets + a warmup mark (excluded from volume/PRs) | ✓ |
| Weight/reps only | Every set 'normal' | |
| Full: type + RPE now | warmup/dropset/failure picker + RPE | |

**User's choice:** Weight/reps + warmup toggle (D-03). Dropset/failure/RPE deferred.

---

## Starting a workout

| Option | Description | Selected |
|--------|-------------|----------|
| Exercises, sets pre-fill from last time | Copy exercise list; sets pre-fill from each exercise's most recent performance | ✓ |
| Exact sets from that workout | Copy exercises + exact weights/reps of that session | |
| Blank only for Phase 2 | Drop start-from-history | |

**User's choice:** Exercise list + per-exercise last-performance pre-fill (D-04/D-05/D-06).

---

## Rest timer behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Global default, auto-start on ✓ | One default rest from settings, auto-starts, adjustable | ✓ (extended) |
| Per-exercise default | Each exercise remembers its own rest | ✓ (extended) |
| Manual start only | No auto-start | |

**User's choice:** Global default auto-starting on ✓ **plus** a per-exercise custom override ("some exercises require more rest than others between sets") — D-07/D-08. Note: per-exercise override needs an additive migration; storage flagged for research.

| Option | Description | Selected |
|--------|-------------|----------|
| On-screen countdown + notification | Persistent countdown (skip / ±15s) + background notification/vibrate | ✓ |
| Notification only | Background notification only | |

**User's choice:** On-screen countdown + notification (D-09). Next set restarts the timer.

---

## Finish summary + PR scope

| Option | Description | Selected |
|--------|-------------|----------|
| Compute basic PRs now | duration + volume + PRs hit (heaviest weight & best est-1RM vs history) | ✓ |
| Defer PRs to Phase 4 | duration + volume + counts only | |

**User's choice:** Compute basic PRs now (D-10). Full records table + PR feed remain Phase 4.

---

## History editing

| Option | Description | Selected |
|--------|-------------|----------|
| Reopen in the logging screen | Same active-workout UI, editable | ✓ |
| Separate lighter editor | Distinct read-detail + edit view | |

**User's choice:** Reopen past workout in the logging screen, editable (D-13).

## Claude's Discretion

- Active-workout screen layout, exercise-card anatomy, reorder gesture, empty states.
- Storage location for the per-exercise rest override (subject to research).
- Estimated-1RM formula for the Phase-2 PR check (keep identical to Phase-4 stats).
- Numeric-keypad component; visual presentation of the rest countdown.

## Deferred Ideas

- Dropset/failure set-types + RPE (schema-ready, deferred within Phase 2).
- Templates & folders, plate calculator, warm-up suggestions → Phase 3.
- Program pointer advance + auto-backup on finish → Phase 6/7.
- Full records table, PR feed, est-1RM/volume charts → Phase 4.
- Dedicated per-exercise "rest settings" management UI → later.
