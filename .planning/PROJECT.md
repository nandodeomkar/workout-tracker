# Workout Tracker

## What This Is

A personal Android-first workout tracking app that replicates StrengthLog's feature set with the paywalled features (advanced statistics, programs, body measurements) free. Built for the owner and a group of friends to use and refine in real training, with a public Play Store release as the long-term goal.

Full approved design spec: `docs/superpowers/specs/2026-07-19-workout-tracker-design.md`

## Core Value

Logging a strength workout in the gym must be fast, offline, and never lose data — free, with no clutter or upsell.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Core workout logging: sets/reps/weight, rest timer, crash-safe active workout
- [ ] Exercise library (~250 seeded from free-exercise-db, public domain) + custom exercises
- [ ] Workout history: list, calendar, edit past workouts
- [ ] Templates with folders; pre-fill from last performance
- [ ] Programs: ordered template days, program pointer, linear + percent-of-TM progression
- [ ] Stats: per-exercise est-1RM/top-set/volume charts, weekly volume by muscle group, PR feed
- [ ] Body measurements log with graphs
- [ ] Utilities: plate calculator, 1RM calculator, warm-up suggestions
- [ ] Google Drive appDataFolder backup/restore (optional sign-in), CSV/JSON export
- [ ] Dark-first clean UI, StrengthLog-style 5-tab layout

### Out of Scope

- Social features (feeds, leaderboards, sharing) — not needed for personal/friends use; revisit at public release
- iOS build — all current users on Android; stack keeps the door open
- App server / hosted backend — zero running costs; Drive app-data covers backup
- Monetization, ads, accounts beyond optional Google sign-in — the whole point is free and clean
- Exercise instruction videos/animations — large content burden, low value for experienced lifters

## Context

- Owner currently uses StrengthLog (strengthlog.com); the app progressively paywalled features and the UI degraded. This project is a clean-room feature clone: no StrengthLog branding, assets, or proprietary content.
- Users: owner + friends, all Android. Distribution during beta: direct APK sideload (EAS build). Play Store later.
- Design was fully brainstormed and approved 2026-07-19; the spec covers architecture, data model, screens, backup, error handling, testing, and suggested build phases.
- Friends beta is the primary feedback loop.

## Constraints

- **Budget**: Zero running costs — no server, free-tier services only (Google Drive app-data quota)
- **Tech stack**: React Native + Expo (TypeScript), expo-sqlite + Drizzle, victory-native, expo-router, Zustand — decided in approved spec
- **Platform**: Android-first; nothing that forecloses a later iOS build
- **Offline**: App fully functional without network; network used only for backup/restore
- **Legal**: No StrengthLog name, branding, icons, UI assets, or proprietary program content; bundled programs use generic public methodologies

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native + Expo over Kotlin/Flutter | Fastest iteration for friends-beta loop; iOS door stays open | — Pending |
| Local-first SQLite, no backend | Offline gym use, zero cost, nothing to maintain | — Pending |
| Backup to Google Drive appDataFolder (`drive.appdata` scope) | "Backup on Google account" with no server; private per user | — Pending |
| Weights stored in kg canonically | No unit ambiguity; UI converts to lb | — Pending |
| PRs computed from sets, never stored | No stale-cache bugs; cache only if measurably slow | — Pending |
| Progression rules on template exercises (linear / %TM JSON) | Covers linear and 5/3/1-style wave programs with one mechanism | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-19 after initialization*
