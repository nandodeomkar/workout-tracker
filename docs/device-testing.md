# Device Testing — Standalone Build

How to put a build on a physical Android device that runs **without Metro or the PC**, for extended real-training use.

## Why the release variant

The debug variant does not embed a JS bundle (the React Native Gradle plugin's `debuggableVariants` defaults to `["debug"]`, so only `debug` skips bundling), and `expo-dev-launcher` hijacks its cold start with the dev-client launcher screen. The release variant embeds the bundle and excludes the dev launcher, so it boots straight into the app with no network and no dev server.

Stock release APKs are not debuggable, which disables `adb run-as` — currently the only way to pull the SQLite database off the device. The `WT_DEBUGGABLE_RELEASE` flag below re-enables it. Once Phase 7 (Backup & Export) ships, this flag is no longer needed for backups.

## Prerequisites

This shell has no `java` or `adb` on `PATH` by default. Every command below assumes:

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ANDROID_HOME="$HOME/AppData/Local/Android/Sdk" PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
```

Device adb serial is `5dqwzpdqemsc6xpb` (its display name is `25080RABDI` — pass the serial to `adb -s`, not the name). Package is `com.anonymous.workouttracker`, scheme `workouttracker://`.

## Build and install

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" ANDROID_HOME="$HOME/AppData/Local/Android/Sdk" PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH" WT_DEBUGGABLE_RELEASE=1 && npx expo prebuild --platform android && npx expo run:android --variant release --device 5dqwzpdqemsc6xpb
```

`WT_DEBUGGABLE_RELEASE=1` activates `plugins/withDebuggableRelease.js`, which adds `debuggable true` to the release buildType during prebuild. Without the variable the plugin is a no-op.

The release buildType signs with `android/app/debug.keystore` — the same key as the dev build — so this installs **over** the existing app and preserves the on-device database. It does not require an uninstall.

Confirm the flag actually took effect:

```bash
grep -n "debuggable true" android/app/build.gradle
```

## Verify it is genuinely standalone

Stop Metro first, or the test proves nothing:

```bash
npx kill-port 8081 || true
adb -s 5dqwzpdqemsc6xpb shell am force-stop com.anonymous.workouttracker && adb -s 5dqwzpdqemsc6xpb shell am start -a android.intent.action.VIEW -d "workouttracker://" com.anonymous.workouttracker
```

Then screenshot to confirm the app's own home screen renders (not the dev-client launcher):

```bash
adb -s 5dqwzpdqemsc6xpb exec-out screencap -p > /tmp/device.png
```

Note: this device blocks `adb shell input tap` and `swipe` (INJECT_EVENTS `SecurityException` on MIUI/HyperOS), and `uiautomator dump` fails on animated screens. Navigate with deep links (`workouttracker://exercises/<id>` etc.) rather than synthetic taps.

## Manual database backup

Until Phase 7 ships, this is the only way to get data off the device. Recent writes live in the WAL sidecar, so pull all three files — the main `.db` alone under-counts:

```bash
adb -s 5dqwzpdqemsc6xpb shell am force-stop com.anonymous.workouttracker && adb -s 5dqwzpdqemsc6xpb exec-out run-as com.anonymous.workouttracker cat files/SQLite/workout.db > workout.db && adb -s 5dqwzpdqemsc6xpb exec-out run-as com.anonymous.workouttracker cat files/SQLite/workout.db-wal > workout.db-wal
```

Force-stopping first closes the app's DB handles. Opening the pulled file with `better-sqlite3` and closing it checkpoints the WAL into the main file, giving a clean single-file restore point.

## Before a Play Store build (Phase 8)

Build **without** `WT_DEBUGGABLE_RELEASE=1`. The plugin no-ops and the release APK is non-debuggable again. Phase 8 also has to replace the debug keystore with a real production keystore — the current release signing config points at `debug.keystore`, which is not acceptable for distribution.

## Keystore warning

`android/app/debug.keystore` lives inside the gitignored `/android` tree and is **backed up nowhere**. If `android/` is regenerated with a fresh keystore, the signing key changes, in-place upgrade stops working, and reinstalling wipes the on-device database. Copy that file somewhere outside the repo before an extended testing run.
