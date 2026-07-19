# Project Research Summary

**Project:** Workout Tracker (offline-first Android strength-training app)
**Domain:** Mobile fitness/workout tracker (StrengthLog/Strong/Hevy/Boostcamp category) — React Native + Expo, SQLite-only, no backend
**Researched:** 2026-07-19
**Confidence:** HIGH

## Executive Summary

This is a StrengthLog-style strength-training tracker whose entire value proposition is giving away, for free, the features competitors paywall (advanced stats, training programs with progression, body measurements) while fixing the category's most-cited failure mode: losing workout data due to crashes or lack of connectivity. Research across stack, features, architecture, and pitfalls converges on a single coherent design: React Native + Expo (SDK 57) with expo-sqlite + Drizzle ORM as the single local source of truth, Zustand scoped to only the in-flight workout session, live SQLite queries for everything else, and an optional, strictly one-directional Google Drive appDataFolder backup layer that can never block or gate core logging. All fixed choices in the approved design spec hold up under research — no pivot recommended.

The recommended approach is disciplined phase sequencing driven by a clear dependency chain: exercise library then fast set logging (crash-safe, write-through to SQLite immediately) then templates/history then calculators (plate/1RM/warm-up, cheap early wins) then stats/charts then programs+progression (highest architectural risk) then backup (second-highest risk, deprecation-exposed) then polish/beta distribution. The single biggest recurring theme across all four research files is "looks done but isn't": migrations only tested on empty DBs, rest timers only tested with the screen on, backups only tested on idle data, and auth only tested in the first hour before token expiry. Every one of these looks correct in casual dev testing and fails specifically in real gym conditions.

Key risks: (1) Drizzle/expo-sqlite migrations crashing on upgrade for users with real data; (2) ephemeral Zustand state being treated as crash-safe when Android can kill the JS process at any time; (3) Google Drive backup auth built on a deprecated Play Services library with no reliable server-less token refresh; (4) naive SQLite file-copy backup silently corrupting snapshots in WAL mode. None of these require changing the approved stack or architecture; they require discipline in testing and sequencing.

## Key Findings

### Recommended Stack

Expo SDK 57 (React Native 0.86, React 19.2, New Architecture mandatory) with TypeScript and expo-router. expo-sqlite + Drizzle ORM (`drizzle-orm/expo-sqlite`) is the standard local-first pairing, with `drizzle-kit` generating versioned migrations and the same driver-agnostic schema running against `better-sqlite3` in Node for fast unit tests. Zustand holds exactly one thing — the active workout session. victory-native XL (v41, Skia/Reanimated-based, not legacy SVG v36) handles charts with GPU rendering. Google Drive backup uses `@react-native-google-signin/google-signin` plus raw Drive v3 REST calls scoped to `appDataFolder`. `expo-dev-client`/EAS builds are mandatory from the scaffold phase since expo-sqlite (with Drizzle) and Google Sign-In don't work in Expo Go.

**Core technologies:**
- Expo SDK 57 + expo-router: app framework and file-based navigation, locked in lockstep versioning
- expo-sqlite + Drizzle ORM + drizzle-kit: on-device SQLite, versioned migrations, driver-agnostic schema testable in Node
- Zustand: minimal ephemeral state for the active workout session only
- victory-native XL (Skia-based) + @shopify/react-native-skia: GPU-rendered charts for stats
- @react-native-google-signin/google-signin + Drive v3 REST: optional, scope-limited (`drive.appdata`) cloud backup

### Expected Features

The entire competitive strategy is "ship what StrengthLog paywalls, for free, with zero locked screens anywhere." Table stakes must not be compromised on speed (fewer than 2 taps per set, pre-fill from last performance); differentiators are what create the moat.

**Must have (table stakes):**
- Fast set logging with pre-fill, rest timer with auto-start + notification, exercise library with search/custom exercises
- Workout history (list + calendar + edit), templates/folders with pre-fill, PR tracking (computed, never stored)
- Offline-first crash-safe logging, data export (CSV/JSON), kg/lb units, zero ads/upsell

**Should have (differentiators):**
- Advanced stats/charts (est-1RM, volume, weekly-by-muscle) free where StrengthLog paywalls at $17/mo
- Training programs with progression (linear + %TM) free where StrengthLog gates its whole catalog
- Plate calculator + warm-up suggestions + 1RM calculator integrated inline in the active-workout flow
- Body measurements + graphs free (isolated from logging core — good early-phase win)

**Defer (v2+ / anti-features):**
- Social feed/leaderboards, gamification/streaks, AI-generated programming, exercise videos, accounts/auth beyond optional backup, workout sharing/marketplace

### Architecture Approach

Layered local-first architecture: thin expo-router UI layer calls into framework-free domain/service modules (progression, stats/PR/1RM math, plate/warm-up calculators) and a Drizzle data-access layer over a single SQLite file that is the sole source of truth. Zustand mirrors only the in-flight workout for responsive UI but writes through to SQLite on every completed set; everything else (history, stats, exercise library) reads live from SQLite via query hooks, never mirrored into global state. Backup is an isolated, one-directional module that can fail completely without touching core logging.

**Major components:**
1. `domain/` (progression, stats/PR/1RM, plates, warmup, units) — pure TS, framework-free, vitest-covered, never stores derived values
2. `store/activeWorkout` (Zustand) — write-through cache for the in-flight session only, rehydrated from SQLite on cold start
3. `db/` (schema, migrations, client) — Drizzle over expo-sqlite, WAL mode, versioned migrations bundled via babel/metro config, migration gate on app root
4. `backup/` (auth, drive, snapshot) — Google Sign-In (`drive.appdata` scope only) + Drive REST + `VACUUM INTO` snapshotting, strictly downstream/optional

### Critical Pitfalls

1. **Migrations crash existing users' devices** — use the official migration-gate + `useMigrations` pattern and always test upgrades against a populated (non-empty) DB.
2. **Ephemeral Zustand state treated as crash-safe** — reconstruct all active-workout UI state from stored timestamps/SQLite on every resume, never from a running in-memory timer.
3. **Rest-timer notifications silently failing** — use absolute date-based triggers, request `SCHEDULE_EXACT_ALARM`, and test on a real device with screen off/locked on an aggressive OEM.
4. **Google Drive backup auth built on a deprecated primitive with no server-side token refresh** — isolate auth behind a small interface now so the underlying library can be swapped later.
5. **Naive `.db` file copy for backup corrupts WAL-mode snapshots** — always use `VACUUM INTO`, never a raw file copy, and validate schema-version on restore.

## Implications for Roadmap

### Phase 1: Scaffold & Data Foundation
**Rationale:** Everything depends on the DB/migration setup being correct from day one; hardest thing to retrofit; dev-client requirement must be established before any feature work.
**Delivers:** Expo SDK 57 project with expo-router, expo-dev-client/EAS dev build, Drizzle schema + migration gate, exercise library seeded (~250 exercises), settings table with schema_version.
**Addresses:** Exercise library (table stakes)
**Avoids:** Pitfall 1 (migration crashes)

### Phase 2: Core Logging (Active Workout)
**Rationale:** The entire product if nothing else works — the fast-logging loop with crash-safety is the core promise.
**Delivers:** Active workout screen, set logging with pre-fill, write-through Zustand store, rest timer (notification + in-app), workout history (list/detail/edit).
**Uses:** expo-sqlite + Drizzle write-through pattern, Zustand `activeWorkout` store, expo-notifications
**Implements:** Single-source-of-truth write-through pattern; pure-function PR detection
**Avoids:** Pitfall 2 (ephemeral state loss) and Pitfall 3 (rest-timer reliability)

### Phase 3: Templates, Folders & Calculators
**Rationale:** Templates depend on history (pre-fill needs past sets); calculators are low-risk, high-value pure functions buildable in parallel.
**Delivers:** Templates with folders and pre-fill, plate calculator, 1RM calculator, warm-up suggestions integrated inline in active workout.
**Addresses:** Templates/folders (table stakes), plate/1RM/warmup calculators (differentiator)

### Phase 4: Stats & Charts
**Rationale:** Requires workout history with consistently-tagged data; charting is the highest technical-complexity item and must be validated against realistic data volume.
**Delivers:** Est-1RM/volume charts, weekly volume by muscle group, PR feed.
**Uses:** victory-native XL (Skia), indexed queries on sets/workout_exercises
**Avoids:** Pitfall 7 (chart performance collapse on real history)

### Phase 5: Body Measurements
**Rationale:** Zero dependency on the logging core — a low-risk, isolated phase that can slot in wherever convenient.
**Delivers:** Body measurement logging + graphs.
**Addresses:** Body measurements (differentiator vs. StrengthLog's premium gate)

### Phase 6: Programs & Progression
**Rationale:** Highest architectural risk in the feature set — depends on templates + a progression-rules engine + training maxes; building linear and %TM progression simultaneously is explicitly flagged as a mistake.
**Delivers:** Training maxes table, linear progression, percent-of-TM progression (linear first), program state/advancement.
**Addresses:** Programs with progression (top differentiator)
**Avoids:** Building both progression types at once

### Phase 7: Backup & Export
**Rationale:** Isolated, one-directional module; must never gate core logging; has its own deprecation-exposed auth risk requiring a focused research spike.
**Delivers:** Google Sign-In (drive.appdata scope), VACUUM INTO snapshotting, upload/list/download/restore-with-confirmation, CSV/JSON export.
**Avoids:** Pitfall 4 (auth without server-side refresh) and Pitfall 5 (WAL corruption)

### Phase 8: Polish & Beta Distribution
**Rationale:** Notification hardening and distribution-channel friction are non-negotiable since real friends will hit them immediately.
**Delivers:** Rest-timer hardening across OEMs, EAS internal distribution setup (or Play Console internal testing track), friend onboarding doc for Play Protect warnings, zero-paywall UI audit.
**Avoids:** Pitfall 6 (Play Protect sideload friction)

### Phase Ordering Rationale

- Dependency chain drives most of the order: exercise library then logging then templates (need history to pre-fill) then programs (need templates + progression + training maxes).
- Isolated components (body measurements, backup) are placed where they don't block riskier core-logging and progression work.
- Highest-risk items (programs/progression, backup/auth) are sequenced later, after the core loop and data model have proven stable.
- Signing/versioning decision for distribution (Pitfall 6) should be made as early as Phase 1 since it affects build config from day one, even though the distribution phase itself is last.

### Research Flags

Needs research: Phase 6 (Programs & Progression — progression JSON schema design), Phase 7 (Backup — Google Sign-In / Credential Manager deprecation target)

Standard patterns (skip research-phase): Phase 1 (Scaffold — Drizzle+Expo officially documented), Phase 2 (Core logging — write-through pattern already specified), Phase 3 (Templates/Calculators — straightforward CRUD/pure functions), Phase 5 (Body Measurements — simple isolated CRUD + chart)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified directly against npm registry; gotchas cross-checked against official docs |
| Features | MEDIUM | Web search across competitor marketing pages/reviews/Reddit sentiment; no direct API/docs source exists, but cross-checked across 4 competitors + community sentiment |
| Architecture | HIGH | Patterns match official Drizzle/Expo docs; Google Drive appDataFolder specifics are MEDIUM due to library churn |
| Pitfalls | MEDIUM-HIGH | Official docs + GitHub issues + practitioner write-ups; exact deprecation timelines should be treated as directional |

**Overall confidence:** HIGH

### Gaps to Address

- Google Sign-In library deprecation timeline is a moving target — re-verify at the start of Phase 7.
- Feature-landscape research relies on marketing pages and review-site/Reddit sentiment rather than primary competitor documentation — treat competitive-feature claims as directional.
- Exercise-library muscle-group tagging consistency (needed for Phase 4 stats) was not directly verified against the actual seed dataset — validate tagging quality before building that stat.
- EAS free-tier build-queue behavior is MEDIUM confidence and subject to change — reconfirm limits close to beta rollout.

## Sources

### Primary (HIGH confidence)
- npm registry version/peer-dependency data for the full stack
- https://orm.drizzle.team/docs/sqlite/connect-expo-sqlite and https://orm.drizzle.team/docs/get-started/expo-new
- https://docs.expo.dev/versions/latest/sdk/sqlite/, https://docs.expo.dev/router/basics/core-concepts/
- https://sqlite.org/wal.html, https://www.sqlite.org/howtocorrupt.html
- https://developers.google.com/workspace/drive/api/guides/appdata
- https://developer.android.com/identity/sign-in/legacy-gsi-migration
- https://developers.google.com/android/play-protect/warning-dev-guidance

### Secondary (MEDIUM confidence)
- Competitor reviews/marketing (StrengthLog, Strong, Hevy, Boostcamp) and aggregated Reddit sentiment
- GitHub issue threads (expo/expo#2194, #21895, react-native-google-signin#1373)
- Community tutorials (LogRocket, DEV Community) corroborating official integration patterns

### Tertiary (LOW confidence)
- APK Sideloading Safety Checklist 2026 (blog)

---
*Research completed: 2026-07-19*
*Ready for roadmap: yes*
