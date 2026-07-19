<!-- GSD:project-start source:PROJECT.md -->

## Project

**Workout Tracker**

A personal Android-first workout tracking app that replicates StrengthLog's feature set with the paywalled features (advanced statistics, programs, body measurements) free. Built for the owner and a group of friends to use and refine in real training, with a public Play Store release as the long-term goal.

Full approved design spec: `docs/superpowers/specs/2026-07-19-workout-tracker-design.md`

**Core Value:** Logging a strength workout in the gym must be fast, offline, and never lose data — free, with no clutter or upsell.

### Constraints

- **Budget**: Zero running costs — no server, free-tier services only (Google Drive app-data quota)
- **Tech stack**: React Native + Expo (TypeScript), expo-sqlite + Drizzle, victory-native, expo-router, Zustand — decided in approved spec
- **Platform**: Android-first; nothing that forecloses a later iOS build
- **Offline**: App fully functional without network; network used only for backup/restore
- **Legal**: No StrengthLog name, branding, icons, UI assets, or proprietary program content; bundled programs use generic public methodologies

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Verdict on the Approved Spec

- **React Native + Expo (TypeScript)** — correct call for a solo/small-team app that needs fast iteration and an open door to iOS.
- **expo-sqlite + Drizzle ORM** — this is the standard, actively-maintained pairing for local-first Expo apps in 2026. Drizzle ships an official `drizzle-orm/expo-sqlite` driver.
- **victory-native** — current major (v41, "XL") is a from-scratch Skia/Reanimated rewrite, actively maintained by Nearform. Correct choice, but pin to the v41 line, not legacy v36 API docs/tutorials still floating around.
- **expo-router** — standard navigation for Expo SDK 50+, versions are locked to the Expo SDK release train.
- **Zustand** — correct minimal-state choice for the single piece of ephemeral state (active workout session) the spec calls for.
- **Google Drive appDataFolder backup** — correct zero-server pattern; implemented via `@react-native-google-signin/google-signin` for auth + the Drive v3 REST API directly (no dedicated Drive SDK needed on RN).

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Expo SDK | **57** (`expo@57.0.7`) | App framework/runtime | Current stable train as of July 2026, ships React Native 0.86 + React 19.2. New Architecture is mandatory since SDK 55, so there's no "old architecture" fallback to worry about — one less variant to support. SDK 56→57 was a non-breaking RN point upgrade (RN 0.86 targets zero user-facing breaks from 0.85). Confidence: HIGH (registry-verified). |
| TypeScript | latest stable bundled with `create-expo-app` template | Type safety | Standard for Expo projects; matches spec. Confidence: HIGH. |
| expo-router | **57.0.7** (locked to Expo SDK version) | File-based navigation, tabs + stacks | Ships in lockstep with the Expo SDK — always match the router version to the SDK version exactly, don't pin independently. Requires `react-native-screens>=4.25.2`, `react-native-safe-area-context>=5.4.0`, gesture-handler and reanimated as peers (all satisfied by current majors below). Confidence: HIGH. |
| expo-sqlite | **57.0.1** | On-device SQLite database | Official Expo-maintained SQLite binding, exposes `openDatabaseSync` for Drizzle's sync driver. **Requires a custom Dev Client / EAS build — does not work in Expo Go** once Drizzle is wired in. Plan for `expo-dev-client` from day one of scaffolding, not as an afterthought. Confidence: HIGH. |
| drizzle-orm | **0.45.2** | ORM / schema / query builder over SQLite | Official `drizzle-orm/expo-sqlite` driver targets `expo-sqlite>=14.0.0` (57.0.1 satisfies this easily). Versioned migrations via `drizzle-kit generate` + the `useMigrations` hook match the spec's "versioned migrations" requirement exactly. Confidence: HIGH. |
| drizzle-kit | **0.31.10** | Migration generation (dev-time CLI) | Dev dependency only; generates SQL migration files from the Drizzle schema. Set `dialect: 'sqlite'`, `driver: 'expo'` in `drizzle.config.ts`. Confidence: HIGH. |
| Zustand | **5.0.14** | Ephemeral active-workout session state | Peer deps: `react>=18`, `use-sync-external-store>=1.2.0` — both satisfied by React 19.2. No RN-specific config needed; works out of the box. Confidence: HIGH. |
| victory-native | **41.26.0** ("XL") | Charts (est-1RM, volume, measurements) | Ground-up rewrite on Skia + Reanimated + Gesture Handler, GPU-rendered, 60fps. **Not API-compatible with legacy Victory Native v36** — when reading tutorials/Stack Overflow, confirm they're targeting v40+/XL, not the old Victory-for-web-ported API. Confidence: HIGH (peer deps verified on registry). |
| @shopify/react-native-skia | **2.9.0** | Rendering engine victory-native depends on | victory-native@41.26.0's peer range is `>=1.2.3 <3.0.0`, so current 2.9.0 is compatible — don't let it auto-update past 3.x without checking victory-native's peer range again first. Confidence: HIGH. |
| react-native-reanimated | **4.5.2** | Animation driver (gestures, chart interactions, screen transitions) | Required peer for both expo-router and victory-native. Confidence: HIGH. |
| react-native-gesture-handler | **3.1.0** | Gesture system | Required peer for expo-router and victory-native (chart pan/zoom). Confidence: HIGH. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| expo-notifications | **57.0.6** | Local rest-timer notifications | Use for the "vibrate + notify when rest timer finishes" requirement. **Gotcha:** Android 12+ needs the `SCHEDULE_EXACT_ALARM` permission for reliable scheduled delivery, and Doze mode can delay delivery after ~10 min of screen-off inactivity. A gym rest timer is short (1–5 min) and the phone is typically recently touched, so risk is lower than a long-interval reminder app, but **test on a real device with the screen off** before shipping — don't trust the emulator. |
| expo-dev-client | **57.0.7** | Custom dev client for EAS builds | Mandatory as soon as expo-sqlite + Drizzle (or Google Sign-In) are added — none of these work in vanilla Expo Go. Add this in the scaffold phase, not later. |
| @react-native-google-signin/google-signin | **16.1.2** | Google OAuth for Drive backup | Standard library for native Google auth in Expo/RN; supports the New Architecture. Requires a config plugin + custom dev/EAS build (same constraint as above). After sign-in, call `GoogleSignin.getTokens()` to get an access token, then hit the Drive v3 REST API directly (`fetch` to `https://www.googleapis.com/drive/v3/files` with `spaces=appDataFolder`) — no separate Drive SDK wrapper is needed or recommended; the extra abstraction layers in wrapper packages (e.g. `react-native-google-drive-api-wrapper`) add version-lag risk for little benefit. |
| expo-file-system | **57.0.1** | Reading/writing the SQLite file for backup snapshots and CSV/JSON export | Needed to grab the raw `.db` file bytes for the Drive upload and to write export files. |
| better-sqlite3 | **12.11.1** (devDependency only) | In-memory SQLite for DB-layer unit tests | Drizzle's `sqlite-core` schema is driver-agnostic — the same schema file works against `drizzle-orm/expo-sqlite` (device) and `drizzle-orm/better-sqlite3` (Node test runner). Use this to satisfy the spec's "SQLite in-memory for DB layer tests" requirement without needing a device/emulator in CI. |
| vitest | **4.1.10** | Pure-logic unit tests | Scope narrowly: progression math, 1RM/plate/warm-up calculators, PR detection, kg↔lb conversion — anything with zero React Native imports. Do not try to use it for component/screen tests (see What NOT to Use). |
| babel-plugin-inline-import | **3.0.0** | Bundles `.sql` migration files into the JS bundle | Required for Drizzle + Expo: add to `babel.config.js` and add `'sql'` to `metro.config.js`'s `resolver.sourceExts`. Without this, generated migration files won't import and `useMigrations` will fail silently or throw at runtime. |
| @expo/vector-icons | **15.1.1** | Tab bar / UI icons | Bundled with Expo; zero extra native config, safe default for a StrengthLog-style tab layout. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| EAS Build | Cloud build service for Dev Client + release APKs | Free tier: 15 Android + 15 iOS builds/month, 45-minute build timeout, low-priority queue (can add up to ~an hour of wait at US peak business hours). This comfortably covers a friends-beta cadence of a handful of builds a week; revisit if the team scales up build frequency before Play Store launch. |
| drizzle-kit studio (drizzle-studio-expo) | Inspect the on-device DB during development | Dev-tools plugin launched from the Expo CLI; useful for debugging seeded exercise data and migrations without pulling the device DB file manually. |
| jest-expo (**57.0.2**) + @testing-library/react-native (**14.0.1**) | Component/screen tests, if/when needed | Not in the original spec's testing plan (which only calls for vitest + in-memory SQLite), but flag as the fallback if screen-level tests are wanted later — do not attempt to force Vitest to render RN components (see below). |

## Installation

# Scaffold (creates Expo SDK 57 project with expo-router template)

# Core stack additions

# Charts/gesture peers (expo install resolves compatible versions automatically)

# Google Drive backup

# Testing

# (only if/when component tests are added later)

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| expo-sqlite + Drizzle | WatermelonDB | If the app needed reactive sync across multiple devices/collaborative editing — WatermelonDB's sync engine is heavier than this single-device, Drive-snapshot-backup use case needs. |
| expo-sqlite + Drizzle | @op-engineering/op-sqlite (also Drizzle-supported) | If raw SQLite throughput became a measured bottleneck (op-sqlite is generally faster) — not a concern at this app's scale (a few thousand sets per user). |
| victory-native (XL) | react-native-gifted-charts | If chart requirements were simpler (basic line/bar charts) and GPU-accelerated Skia rendering wasn't needed — gifted-charts has a gentler learning curve but weaker interactive-gesture support (pan/zoom on a 1RM trend line). |
| Zustand | Jotai / Redux Toolkit | Redux Toolkit only makes sense if state complexity grows far beyond "one active workout session" — would be overkill here. Jotai is a reasonable lateral alternative but Zustand's simpler global-store model fits a single ephemeral session better. |
| @react-native-google-signin/google-signin + raw Drive REST calls | react-native-cloud-storage / react-native-google-drive-api-wrapper | If the backup surface grew to need full Drive folder browsing (not just the hidden appDataFolder) — for this spec's narrow appDataFolder-only use case, the extra wrapper is unneeded indirection. |
| vitest (pure logic only) | jest-expo for everything | If the team wants a single test runner instead of two — Jest can run pure-logic tests fine too. The spec's split (vitest for logic, in-memory SQLite for DB) is optimizing for fast pure-function test iteration; collapsing to Jest-only is a valid simplification if the two-runner setup becomes annoying to maintain. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Legacy `victory-native` v36 API / tutorials | The v41 "XL" line is a ground-up rewrite; v36-era code (Victory-web-style `<VictoryChart>` composition) will not run against the installed v41 package. | Follow only current Victory Native XL / Nearform docs, which use the Skia `CartesianChart` component API. |
| Expo Go for any development after Drizzle/Google Sign-In are added | Expo Go can't load the native modules expo-sqlite (with Drizzle wired in) or Google Sign-In require — you'll hit confusing "module not found" errors that look like config bugs but are actually an Expo Go limitation. | `expo-dev-client` + EAS build (development profile) from the scaffold phase onward. |
| Forcing Vitest to render/test React Native components | Vitest's RN support is community-maintained and thin (`vitest-react-native`) compared to Jest's first-party `jest-expo` preset that most RN libraries assume and ship mocks for. | Use vitest only for framework-free pure TS logic; add `jest-expo` + `@testing-library/react-native` if/when screen-level tests are wanted. |
| `react-native-google-drive-api-wrapper` or similar Drive SDK wrappers | Adds an extra dependency layer with its own update cadence, wrapping an API surface (Drive v3 REST) that's trivial to call directly with `fetch` once you have an access token. | Call the Drive v3 REST API directly using the access token from `GoogleSignin.getTokens()`. |
| Scheduling the rest-timer notification without requesting `SCHEDULE_EXACT_ALARM` on Android 12+ | Silent unreliability — the notification API call succeeds but delivery can be delayed or dropped under Doze, which is exactly the kind of bug that erodes trust in a gym-use tool. | Request the exact-alarm permission where required by the OS version, and explicitly test the timer with the screen off on a physical Android device before beta. |

## Stack Patterns by Variant

- Consider `@op-engineering/op-sqlite` as a drop-in Drizzle driver swap (same `sqlite-core` schema, different driver import).
- Because Drizzle's schema layer is driver-agnostic, this migration is low-risk if it's ever needed later.
- Google Sign-In config plugin, expo-notifications, expo-sqlite, and victory-native/Skia all have iOS support already — no stack change needed, only additional EAS build profile + Apple Developer account.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| expo@57.0.7 | react-native@0.86.0, react@19.2.7 | Installed automatically by `create-expo-app`; don't hand-pin react/react-native versions separately — let `expo install` manage them. |
| expo-router@57.0.7 | react-native-screens>=4.25.2, react-native-safe-area-context>=5.4.0, react-native-gesture-handler (any), react-native-reanimated (any) | All satisfied by current majors (screens 4.26.2, safe-area-context 5.8.0, gesture-handler 3.1.0, reanimated 4.5.2). |
| drizzle-orm@0.45.2 | expo-sqlite>=14.0.0 | 57.0.1 far exceeds the floor; no compatibility risk. |
| victory-native@41.26.0 | @shopify/react-native-skia >=1.2.3 <3.0.0 | Current skia 2.9.0 fits; **do not bump skia to a 3.x major** without first checking victory-native's peer range has been updated to allow it. |
| @react-native-google-signin/google-signin@16.1.2 | expo>=52.0.40 | Comfortably satisfied by SDK 57. |
| drizzle-orm (sqlite-core schema) | drizzle-orm/expo-sqlite (device) AND drizzle-orm/better-sqlite3 (Node tests) | Same schema file, two drivers — this is the mechanism that lets vitest+better-sqlite3 test DB logic without a device/emulator. |

## Sources

- npm registry (`npm view <pkg> version` / `peerDependencies` / `dependencies`) — direct, authoritative version and peer-dependency data for: expo, expo-router, expo-sqlite, expo-notifications, expo-dev-client, drizzle-orm, drizzle-kit, zustand, victory-native, @shopify/react-native-skia, react-native, react, @react-native-google-signin/google-signin, vitest, expo-file-system, react-native-reanimated, react-native-gesture-handler, react-native-screens, react-native-safe-area-context, better-sqlite3, jest-expo, @testing-library/react-native, babel-plugin-inline-import, @expo/vector-icons. Confidence: HIGH.
- https://expo.dev/changelog/sdk-57 and related coverage (Expo SDK 57 = RN 0.86, React 19.2, non-breaking from 0.85) — Confidence: MEDIUM (community-summarized, cross-checked across multiple articles).
- https://orm.drizzle.team/docs/sqlite/connect-expo-sqlite and https://orm.drizzle.team/docs/get-started/expo-new — official Drizzle+Expo integration steps (babel/metro config, useMigrations, Expo Go incompatibility). Confidence: MEDIUM-HIGH (official docs, cross-checked via search).
- https://github.com/FormidableLabs/victory-native-xl and Nearform docs — Victory Native XL architecture and versioning history. Confidence: MEDIUM.
- Expo/GitHub issue threads on expo-notifications + Doze mode (expo/expo#21895, #2194, #10700) — Confidence: MEDIUM (real reported issues, cross-checked across multiple threads).
- https://react-native-google-signin.github.io/docs/setting-up/expo — official Google Sign-In Expo setup guide. Confidence: MEDIUM-HIGH.
- https://github.com/expo/fyi/blob/main/eas-build-queues.md and EAS pricing coverage — free-tier build limits and queue behavior. Confidence: MEDIUM.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
