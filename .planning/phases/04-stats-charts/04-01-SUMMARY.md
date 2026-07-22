---
phase: 04-stats-charts
plan: 01
subsystem: infra
tags: [victory-native, react-native-skia, expo, charts, native-build]

# Dependency graph
requires:
  - phase: 03-*
    provides: Stats tab shell with "Coming soon" placeholder (existing boot path this plan must not break)
provides:
  - victory-native@41.26.0 (CartesianChart, Line, StackedBar) available to chart plans
  - "@shopify/react-native-skia@2.9.1 (GPU canvas + useFont) linked into the dev-client APK"
  - Rebuilt native dev client booting on the physical device with Skia linked
affects: [04-02, 04-03, 04-04, 04-05, stats-charts]

# Tech tracking
tech-stack:
  added: [victory-native@41.26.0, "@shopify/react-native-skia@2.9.1"]
  patterns: [exact-pinned native chart deps via `npm install --save-exact` (never `expo install --fix`)]

key-files:
  created: []
  modified: [package.json, package-lock.json]

key-decisions:
  - "Installed with plain `npm install --save-exact`, not `npx expo install`/`--fix` (RESEARCH.md Pitfall 1: stale bundledNativeModules would add no victory-native entry and downgrade gesture-handler 3.1.0→~2.32.0)"
  - "DEVIATION: pinned skia 2.9.1 (latest), not the plan's 2.9.0 — user reviewed the T-04-SC supply-chain gate and explicitly approved the newer release"
  - "gesture-handler asserted still 3.1.0 post-install (not regressed)"

patterns-established:
  - "Native module additions require a full `expo run:android` rebuild, not a Metro reload (Skia ships native C++/Kotlin — RESEARCH.md Pitfall 2)"
  - "On-device boot verification via adb (screencap + logcat) when the device is in airplane mode: `adb reverse tcp:8081 tcp:8081` + relaunch dev-client URL on localhost"

requirements-completed: [STAT-01, STAT-02]

# Metrics
duration: ~18min
completed: 2026-07-22
---

# Phase 4 Plan 01: Chart Dependency Install + Native Rebuild Summary

**victory-native@41.26.0 + @shopify/react-native-skia@2.9.1 installed at exact pins and linked into a rebuilt dev client that boots clean on the physical device**

## Performance

- **Duration:** ~18 min (incl. 4m 56s native Gradle build)
- **Completed:** 2026-07-22T17:23:48Z
- **Tasks:** 3 (1 auto install + 2 human-verify checkpoints)
- **Files modified:** 2 (package.json, package-lock.json)

## Accomplishments
- Both charting packages installed at exact pins; `react-native-gesture-handler` confirmed unchanged at `3.1.0`
- Dev-client APK rebuilt via `expo run:android` (BUILD SUCCESSFUL) with the Skia native module linked
- On-device boot verified: app opens to the tab shell, no `RNSkia`/native-module crash, Stats tab still renders its "Coming soon" placeholder

## Task Commits

1. **Task 1: [SUS] package legitimacy gate (skia)** — human-verify checkpoint, no code (user approved with a version deviation — see Deviations)
2. **Task 2: Install victory-native + skia at exact pins** — `0177cc8` (build)
3. **Task 3: Native dev-client rebuild + on-device boot** — human-verify checkpoint, no code (build/install/boot confirmed on device; user typed "booted")

## Files Created/Modified
- `package.json` — added `victory-native: 41.26.0`, `@shopify/react-native-skia: 2.9.1` (exact)
- `package-lock.json` — resolved tree for both packages (+29 packages)

## Decisions Made
- Plain `npm install --save-exact` over `expo install`/`--fix` to avoid regressing pinned peers (RESEARCH.md Pitfall 1).
- Full native rebuild required (not Metro reload) because Skia ships native code (Pitfall 2).

## Deviations from Plan

**1. [User-directed override — supply-chain gate] Installed skia 2.9.1 instead of pinned 2.9.0**
- **Found during:** Task 1 (package legitimacy gate)
- **Issue:** Plan pinned `@shopify/react-native-skia@2.9.0` and explicitly forbade `2.9.1` (the same-day release flagged `[SUS] too-new`, threat T-04-SC).
- **Fix:** User instructed "install latest". Risk surfaced explicitly (bypasses the supply-chain gate + the CLAUDE.md pin; npm runs native install scripts of a track-record-free same-day release) and the user confirmed `2.9.1` via an explicit decision prompt. Official Shopify repo (`github.com/Shopify/react-native-skia`) confirmed. Installed `2.9.1` exactly (not a floating range).
- **Files modified:** package.json, package-lock.json
- **Verification:** `package.json` shows `2.9.1` exact; disk `node_modules/@shopify/react-native-skia` = `2.9.1`; gesture-handler still `3.1.0`; app boots with Skia linked, no native-module error.
- **Committed in:** `0177cc8` (Task 2 commit)

---

**Total deviations:** 1 (user-directed version override of a supply-chain checkpoint)
**Impact on plan:** Skia `2.9.1` is still inside victory-native's peer range (`>=1.2.3 <3.0.0`), so no compat break. CLAUDE.md still records `2.9.0` as the intended team pin — follow-up: reconcile CLAUDE.md/plan pin with the installed `2.9.1`, or roll back, per owner preference.

## Issues Encountered
- First on-device launch showed a redbox: `java.net.ConnectException: Failed to connect to /192.168.29.42:8081 … ENETUNREACH`. Cause: device in airplane mode (offline-UAT habit) can't reach Metro over LAN. Not a Skia issue. Resolved with `adb reverse tcp:8081 tcp:8081` + relaunching the dev-client URL on `localhost:8081`; app then bundled and booted clean.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Skia canvas + victory-native available and verified on device — Wave 2 (04-02, first per-exercise chart slice, STAT-01) is unblocked.
- Open thread: CLAUDE.md pins skia `2.9.0` but `2.9.1` is installed. Decide whether to update the pin or revert before wider team builds.

---
*Phase: 04-stats-charts*
*Completed: 2026-07-22*
