# Workout Tracker — Design Spec

**Date:** 2026-07-19
**Status:** Approved (design sections reviewed in brainstorming session)
**Working title:** Workout Tracker (final name chosen before public release)

## Summary

A personal Android-first workout tracking app replicating the feature set of StrengthLog, with the paywalled features (advanced statistics, programs, body measurements) available for free. Built for the owner and a group of friends to use and refine, with a public Play Store release as the long-term goal.

Local-first: all data lives in an on-device SQLite database and the app is fully functional offline. Optional cloud backup ties to the user's Google account via the Google Drive app-data folder. There is no application server.

## Goals

1. Log strength workouts faster and with less clutter than StrengthLog.
2. Provide StrengthLog's paid features free: progression statistics and graphs, personal records, training programs with progression, body measurements.
3. Work fully offline; never lose data (crash-safe writes, cloud backup).
4. Zero running costs: no server, free-tier services only.
5. Distributable to friends as a direct APK now; Play Store ready later.

## Non-goals (v1)

- No social features (feeds, leaderboards, sharing).
- No iOS build (stack keeps the option open).
- No monetization, ads, or accounts beyond optional Google sign-in for backup.
- No exercise instruction videos/animations.

## Users

- Primary: the owner and friends — all Android phones.
- Later: general public via Play Store.

## Stack

| Concern | Choice |
|---|---|
| Framework | React Native + Expo (latest SDK), TypeScript |
| Navigation | expo-router |
| Local DB | expo-sqlite + Drizzle ORM (versioned migrations) |
| State | Zustand for active-workout session; DB queries for everything else |
| Charts | victory-native |
| Auth | Google Sign-In, used only for backup (scope: `drive.appdata`) |
| Backup | Google Drive appDataFolder — SQLite snapshot upload |
| Notifications | expo-notifications (rest timer, scheduled locally) |
| Testing | vitest for pure logic; SQLite in-memory for DB layer tests |
| Distribution | EAS build → APK sideload for beta; Play Store later |

Rationale: fastest iteration loop for the test-with-friends phase, cross-platform door stays open for a future iOS build, and the Drive app-data approach eliminates server cost and maintenance entirely.

## Architecture

- Single Expo app. No backend.
- One SQLite database is the single source of truth. Every set logged is written to SQLite immediately (crash-safe).
- Google account is optional. Without sign-in the app is fully functional; only cloud backup is unavailable.
- Exercise library (~250 exercises with muscle group and equipment tags, from open data) is seeded into the DB on first launch; users can add custom exercises.
- Weights are stored in kilograms canonically; the UI converts to pounds when the unit setting says so.

## Data model

SQLite tables (Drizzle schema):

```
exercises           id, name, muscle_group, equipment, is_custom, notes
workouts            id, name, started_at, finished_at, notes, template_id?
workout_exercises   id, workout_id, exercise_id, position, notes
sets                id, workout_exercise_id, set_number, weight_kg, reps,
                    type (normal|warmup|dropset|failure), rpe?, completed_at

templates           id, name, folder, position, notes
template_exercises  id, template_id, exercise_id, position,
                    target_sets, target_reps, target_weight_kg?,
                    progression? (JSON: {type:"linear", increment_kg:2.5}
                                  or {type:"percent_tm", scheme:[...]})

programs            id, name, notes
program_days        id, program_id, position, template_id
program_state       program_id, current_day_position

training_maxes      exercise_id, max_kg, updated_at
body_measurements   id, metric (weight|chest|waist|...), value, measured_at
settings            key, value
backup_meta         key, value (last_backup_at, snapshot list cache)
```

Decisions:

- **PRs and records are computed from `sets`, never stored.** No stale-cache bugs. Estimated 1RM uses the Epley formula. Add a cache table only if queries measurably slow down.
- **Progression lives on `template_exercises`**: linear (increment weight after successful completion) or percent-of-training-max schemes (covers 5/3/1-style wave programs). Finishing a program workout advances `program_state`.
- **Templates pre-fill from history**: starting a template loads the last performance of each exercise so repeating a set is one tap.
- `settings` holds: units (kg/lb), default rest seconds, bar weight, plates owned, theme.

## Screens

StrengthLog-style bottom tab layout, five tabs plus a settings stack:

1. **Workout (home):** "Next in program" card (one tap to start), start-from-template, empty workout, template list with folders.
2. **Active workout** (full-screen over tabs, survives navigation and app kill): exercise cards with set rows `[weight] [reps] [✓]`; values pre-filled from last performance; steppers ±2.5 kg / ±1 rep; completing a set starts the rest timer (local notification + vibrate on finish); per-exercise warm-up suggestion and plate calculator; finish screen shows volume, duration, PRs hit, then advances the program pointer and triggers auto-backup.
3. **History:** chronological list + month calendar; workout detail; past workouts editable.
4. **Exercises:** searchable/filterable library (muscle group, equipment); custom exercise creation; detail view with history log, records table (best weight × reps), estimated-1RM chart.
5. **Stats:** per-exercise charts (estimated 1RM, top set, volume over time); weekly volume by muscle group (sets/week); bodyweight and measurement graphs; PR feed.
6. **Settings/More (gear icon):** programs manager, measurements entry, units, rest timer defaults, plates owned, theme, Google backup/restore, CSV/JSON export, feedback mailto link.

UI principles: dark theme default (light available), large touch targets for gym use, no promotional banners, no locked features, no gamification noise.

## Backup and restore

- Sign in with Google requesting only the `drive.appdata` scope; the app cannot see the rest of the user's Drive.
- Backup = upload the SQLite file plus schema version to the hidden appDataFolder. Keep the last 5 snapshots, prune older.
- Auto-backup fires after each finished workout when signed in and online; manual backup button in settings.
- Restore lists snapshots; choosing one replaces the local DB after a confirmation dialog, and the current DB is first copied aside locally.
- New-phone flow: install APK → sign in → restore latest snapshot.

## Error handling

- Backup and restore failures never block use or corrupt local data; local DB is always the source of truth. Failed auto-backups retry at the next workout; a small banner appears only after repeated failures.
- Active workouts are crash-safe: every set write hits SQLite immediately; reopening the app returns to the in-progress workout.
- Migrations are versioned through Drizzle. Restoring a snapshot with a newer schema version than the installed app is refused with an "update the app" message.
- All destructive actions (delete workout, discard active workout, restore over local data) require confirmation.

## Testing

- Unit tests (vitest): progression logic, 1RM/plate/warm-up calculators, PR detection, kg↔lb conversion — all pure functions.
- DB layer: migration and query tests against in-memory SQLite.
- Manual device pass per release: end-to-end workout logging, rest timer firing while backgrounded, backup → wipe → restore roundtrip.
- Friends beta is the primary feedback loop; in-app feedback link.

## Suggested build phases

1. Scaffold: Expo app, theme, navigation shell, SQLite + Drizzle with migrations, seeded exercise library.
2. Core logging: active workout screen, set logging, rest timer, history.
3. Templates and programs: template CRUD, pre-fill from history, program sequencing, progression rules.
4. Stats: charts, PR detection, weekly volume.
5. Measurements and utilities: body log, plate calculator, 1RM calculator, warm-up suggestions.
6. Backup: Google sign-in, Drive snapshot backup/restore, CSV/JSON export.
7. Polish and beta: notification hardening, empty states, APK packaging, friends rollout.

## Legal and naming notes

- Clean-room feature clone: no StrengthLog branding, name, icons, screenshots, UI assets, or text may be copied. Feature ideas and generic layout patterns are not protected; assets and branding are.
- Bundled programs use generic, publicly documented methodologies (linear progression, 5×5, percent-based wave progression) with generic names — no proprietary program content or trademarked program names.
- Pick a distinct app name before public release.
