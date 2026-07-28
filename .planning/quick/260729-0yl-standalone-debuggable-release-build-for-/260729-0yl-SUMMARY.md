---
quick_id: 260729-0yl
description: Standalone debuggable release build for multi-week on-device testing
date: 2026-07-29
status: complete
tasks_completed: 3
---

# Quick Task 260729-0yl — Summary

## Outcome

One command now produces an APK that runs on the device with no Metro and no PC, boots straight into the app, stays debuggable for `adb run-as` database pulls, and installs in place over the existing build without touching user data. Verified on device `5dqwzpdqemsc6xpb`.

## What shipped

| File | Purpose |
|------|---------|
| `plugins/withDebuggableRelease.js` | Adds `debuggable true` to the release buildType. Opt-in via `WT_DEBUGGABLE_RELEASE=1`. |
| `plugins/withWindowsNinja.js` | Points `CMAKE_MAKE_PROGRAM` at a vendored long-path-aware ninja. Windows-only. |
| `app.json` | Registers both plugins. |
| `docs/device-testing.md` | Build/install command, env prerequisites, ninja fetch, `run-as` backup recipe, Phase 8 unwind. |
| `.gitignore` | Ignores `tools/ninja/`. |

Both gradle transforms are idempotent, marker-guarded, and throw rather than silently no-op if their anchors are missing — a silent no-op would have produced a non-debuggable APK whose failure only surfaced weeks later when a backup was attempted.

## Decisions

**Release variant, not a bundled debug variant.** The original request was a bundled debug build. That does not work: `expo-dev-launcher/android/build.gradle:49-67` maps the `debug` and `debugOptimized` source sets to the dev-launcher source set, and only `release` receives `src/disableInRelease`. A bundled debug APK would cold-boot into the dev-client launcher screen hunting for a dead Metro. The release variant embeds the JS bundle by default and excludes the launcher entirely; adding `debuggable true` restores `run-as` without bringing the launcher back.

**Config plugins, not a `build.gradle` edit.** `.gitignore:41` ignores `/android` and `git ls-files android` is empty — this is a Continuous Native Generation project. A direct edit would be uncommittable and destroyed by the next prebuild. Confirmed necessary in practice: `expo prebuild` cleared and regenerated `android/` on every run, even without `--clean`.

**Opt-in via env var.** Default builds stay non-debuggable, so this cannot leak into the Phase 8 Play Store release by omission.

## The blocker, and two approaches that failed

The release native build died in ninja: `Filename longer than 260 characters`, compiling react-native-gesture-handler's autolinked codegen shadow nodes. CMake mirrors each source file's absolute path beneath the target's `.dir` directory, yielding a 288-character object path before any prefix. Both installed Android SDK cmake packages (3.22.1 and 3.31.4) ship ninja 1.10.2, which enforces 260 regardless of the OS setting — Windows `LongPathsEnabled` was already `1`.

1. **Path shortening — ruled out arithmetically.** The irreducible part of the object path (the `CMakeFiles/<target>.dir` prefix at 96 chars plus the source tail at 152) is 248, leaving ~12 characters of headroom. Even relocating the repo to `C:\wt` *and* using a short build staging directory lands at 293.

2. **`CMAKE_OBJECT_PATH_MAX` — ruled out empirically.** CMake's documentation says it hash-shortens object paths over the limit, and the argument verifiably reached CMake (`CMAKE_OBJECT_PATH_MAX:UNINITIALIZED=200` in `CMakeCache.txt`, fresh config hash), but the emitted path stayed 288. Re-running configure directly at 200, 160 and 128 (the documented floor) all produced 288 — it does not apply to mirrored absolute source paths under the Ninja generator. This attempt was committed and then reverted (`aff8ace` → `3adecca`) rather than left in place as a workaround that does not work.

**Resolution:** ninja 1.11+ is long-path aware. ninja 1.13.2 was vendored to `tools/ninja/` and verified against the exact object file 1.10.2 rejected — it compiled cleanly, producing a 514,848-byte object. Injected into `defaultConfig`, so the debug variant benefits too.

## Verification

| Check | Result |
|-------|--------|
| Plugin applied | `build.gradle:118`; device reports `flags=[ DEBUGGABLE HAS_CODE ... ]` |
| Metro-off cold start | Port 8081 confirmed not listening, `adb reverse` tunnels cleared, app cold-started and rendered fully |
| No dev-client launcher | Boots to the Workout screen; no `DevLauncher` entries and no fatals in logcat |
| `run-as` still works | Reads `files/SQLite/` successfully |
| Data preserved | `workout.db` 217088 bytes (07-24) and `workout.db-wal` 4120032 bytes (07-25) unchanged across the upgrade |

Screenshot confirmed live data: active program *Linear 5x5 (3-Day)* Day 1 of 2, Wrestling and Uncategorized template folders.

APK: `android/app/build/outputs/apk/release/app-release.apk`, 159,219,977 bytes.

## Safety note recorded during execution

A pre-install database backup was taken and verified (37 workouts, 226 sets, 66 workout_exercises, 3 programs, `integrity_check ok`, latest session 2026-07-25). It lives in the session scratchpad and **should be copied somewhere durable** — it is the only backup until Phase 7 ships.

`expo prebuild` regenerates `android/app/debug.keystore`. Before allowing any install, the regenerated key's SHA-256 was compared against the installed APK's signing certificate and matched exactly (`fac61745…033b9c`), so the in-place upgrade was safe. This is the **stock React Native template debug key**, shared by every RN project — nothing is lost by not backing it up, but it also means anyone can sign an APK Android will accept as an update to this app. Phase 8 must generate a real keystore before any distribution, not merely before Play Store submission.

## Follow-ups

- `tools/ninja/ninja.exe` is gitignored, so a fresh clone needs the one-line fetch in `docs/device-testing.md`. Vendoring the 600 KB binary was rejected as worse than documenting the fetch.
- Why the debug variant built successfully on this path before the ninja upgrade was never determined. The diagnostic build was killed mid-run when it locked `android/` and blocked prebuild. Moot now — the fix applies to `defaultConfig`, so both variants use the new ninja — but it remains unexplained.

## Out of scope (unchanged)

Phase 7 backup/export; production keystore generation; app TypeScript/React source; `db/` schema and migrations.
