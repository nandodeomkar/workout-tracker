# Pitfalls Research

**Domain:** Offline-first React Native + Expo fitness/workout tracker (SQLite + Drizzle, Google Drive appDataFolder backup, EAS sideload distribution)
**Researched:** 2026-07-19
**Confidence:** MEDIUM-HIGH (web-sourced: official docs, GitHub issues/discussions, and practitioner write-ups; no curated/paid docs provider available in this environment, so treat specifics like exact deprecation dates as directional, not gospel)

## Critical Pitfalls

### Pitfall 1: Drizzle/expo-sqlite migrations that crash on existing users' devices

**What goes wrong:**
A schema change ships without a migration path, or the migration file isn't actually bundled into the JS bundle (Metro doesn't know how to import `.sql` files by default), and the app crashes on launch for every user who already has a database on-device. Because there's no server, there's no way to inspect or fix a broken installed DB remotely — the only recovery is another app update, which the crashed app may not even be able to receive if the crash happens before any UI renders.

**Why it happens:**
Drizzle generates migrations as `.sql` files; Expo/Metro needs explicit config (metro.config.js / babel plugin, or drizzle's `expo-sqlite` migrator helper) to inline them into the bundle. It's easy to test only against a fresh install (empty DB) during development and never exercise "upgrade from schema v1 to v2 with real data in it."

**How to avoid:**
- Use the official `drizzle-orm/expo-sqlite/migrator` + `useMigrations` hook pattern, and wrap the app root in a "migration gate" that shows a loading state until migrations finish, before rendering any screen that touches the DB.
- Every time the schema changes, generate the migration, then manually test upgrading a device/emulator that already has seed data — not just a fresh install.
- Keep a `schema_version` value in the `settings` table (already planned) and check it against the app's expected version defensively, independent of Drizzle's own bookkeeping.
- Never hand-edit a generated migration; regenerate from schema diffs only.

**Warning signs:**
- Migration tests only ever run against an empty DB in CI/dev.
- `.sql` migration files aren't visible inside the built JS bundle (check with `npx expo export` and inspect output, or watch for a "no such table" runtime error only in production builds, never in dev).
- No manual "upgrade path" test step exists in the release checklist.

**Phase to address:** Phase 1 (Scaffold) — set up the migration gate and bundling correctly from day one; re-verify at every phase that touches the schema (2, 3, 5, 6).

---

### Pitfall 2: Treating in-memory (Zustand) state as if it were crash-safe

**What goes wrong:**
The design correctly writes every completed set to SQLite immediately, but it's easy to let *derived* or *session* state — elapsed workout timer, current rest-timer countdown, which set row is "active/being edited," unsaved weight/rep values typed but not yet confirmed — live only in Zustand memory. Android can and does kill the JS process/Activity in the background (low memory, user swipes app away, long backgrounding). On relaunch, React Native "doesn't resume state — it starts everything from scratch," so any value that was never written to SQLite is gone, even though the spec's screens assume "reopening the app returns to the in-progress workout."

**Why it happens:**
It feels wasteful to hit SQLite for every keystroke of a stepper, so developers naturally cache "in-progress, not-yet-confirmed" input in memory only — but that's exactly the data most likely to be lost at the worst moment (mid-set, gym, phone locks and Android reclaims memory).

**How to avoid:**
- Draw a hard line: anything the user would be upset to retype must be persisted to SQLite (or at minimum AsyncStorage/MMKV) on every meaningful change, not just on "set completed."
- Reconstruct *all* active-workout UI state from the DB on app foreground/relaunch: `started_at`, which `workout_exercises`/`sets` rows exist, elapsed time computed as `now - started_at` (not a ticking JS timer that assumes continuous execution).
- For the rest timer specifically, don't rely on a JS `setInterval` counting down — compute remaining time from a stored absolute "rest ends at" timestamp plus a scheduled local notification (see Pitfall 3); redraw the countdown UI from that timestamp on every resume.
- Add an explicit manual test: start a workout, force-stop the app via Android settings (not just backgrounding), relaunch, verify the exact same state reappears.

**Warning signs:**
- Any countdown/timer UI computed by decrementing a number in a `setInterval` rather than by diffing against a stored timestamp.
- No test in the manual QA pass that force-kills the app mid-workout.
- Weight/rep steppers whose typed-but-unconfirmed value only lives in component state.

**Phase to address:** Phase 2 (Core logging) — this is the core promise of the app ("never lose data"); must be solid before templates/programs build on top of it.

---

### Pitfall 3: Rest-timer notifications that silently don't fire

**What goes wrong:**
The rest timer works perfectly in dev (screen on, app foregrounded) but in real gym use — phone in a pocket, screen off, Doze mode active — the local notification either fires late or never fires. Android 12+ requires the `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` permission for precise timing; without it, `expo-notifications` scheduled triggers degrade to inexact and can be delayed arbitrarily by Doze. Users lose trust in the single most-used real-time feature of the app within the first workout.

**Why it happens:**
Simulator/emulator testing rarely reproduces Doze mode, battery optimization, or OEM background-kill policies (aggressive on Xiaomi/Samsung/OnePlus). Expo's notification scheduling API "looks" reliable because it works when the phone is actively being used, which is most of dev testing.

**How to avoid:**
- Request exact-alarm capability explicitly (`SCHEDULE_EXACT_ALARM` in the Android manifest via app.json/expo plugin config) and use a date-based trigger (`{ type: 'date', date }`) rather than a relative-seconds trigger.
- On first use of the rest timer, prompt the user to disable battery optimization for the app (Android's per-app battery settings), with a short explanation — don't bury this in settings only.
- Treat the in-app countdown UI and the OS notification as two independent, both-required layers: the notification is the guarantee that fires even if the app is backgrounded; the in-app UI is cosmetic and reconstructed from the same stored "ends at" timestamp (ties to Pitfall 2).
- Test on at least one aggressive-OEM device (Xiaomi/Samsung), not just a Pixel emulator, before beta.
- Cancel/reschedule stale notifications when a set's rest timer is skipped or restarted — orphaned notifications firing after the user already moved on erode trust just as much as missed ones.

**Warning signs:**
- Rest timer only tested with the phone screen on and app foregrounded.
- No exact-alarm permission requested/declared.
- QA never leaves the phone locked/pocketed for a full rest period during testing.

**Phase to address:** Phase 2 (Core logging) for the base implementation; Phase 7 (Polish/beta) explicitly calls out "notification hardening" — treat that as non-negotiable, not optional polish, since friends will notice immediately.

---

### Pitfall 4: Google Drive backup auth breaks because there's no server to hold a real refresh token

**What goes wrong:**
"Optional Google sign-in, no server" sounds simple, but Google's OAuth model is built around a token-exchange step that's meant to happen on a backend: the `serverAuthCode`/refresh token exchange is documented as something you should do server-side. Two failure modes are common in server-less mobile apps: (1) using a client-side flow that only yields short-lived access tokens (~1 hour) with no way to silently refresh them, forcing a re-login every hour, which will look like "backup randomly stops working"; or (2) picking a Google Sign-In library that is mid-deprecation. The classic `@react-native-google-signin/google-signin` free tier is built on the legacy Google Play Services Auth SDK, which Google announced (April 2024) will be removed from Play Services in 2025 — with the Credential Manager replacement gated behind that library's paid tier at time of writing. Building on the wrong primitive now means a forced rewrite of the entire auth layer later, likely under Play Store policy pressure.

**Why it happens:**
Docs and tutorials for Google Sign-In on mobile are overwhelmingly written for the "you have a backend" case (exchange auth code for tokens server-side). "No server" apps are a minority use case and the native, on-device token-refresh path (using Android's native Google Sign-In / Credential Manager flow, which *does* support silent token refresh without a backend, via the OS-level account and native SDK) is less documented than the generic OAuth web-flow approach.

**How to avoid:**
- Do NOT use a generic OAuth authorization-code web flow (e.g. raw `expo-auth-session` AuthRequest) expecting to refresh tokens client-side without a backend — that pattern assumes a confidential client secret, which a mobile app can't safely hold, and access tokens from that flow expire without a supported silent-refresh path unless the code-exchange happens somewhere trusted.
- Prefer the native Android Google Sign-In flow (via a maintained library) that returns tokens tied to the on-device Google account, which the OS can silently refresh without any server involvement — this is the intended "no backend" path Google supports for the `drive.appdata` scope.
- Explicitly decide, before writing this phase, whether to accept the legacy `@react-native-google-signin/google-signin` free tier (works today, will need a future migration) or invest earlier in Credential Manager / an alternative — don't let this decision happen by accident via whatever tutorial is closest at hand. Given this is a personal/friends app with a long tail before public release, the legacy library is a reasonable calculated-risk choice for v1, but flag it as revisit-before-Play-Store-launch.
- Handle "signed in but token refresh silently failed" as a first-class state: auto-backup failures must degrade gracefully (per spec) and re-prompt sign-in rather than fail silently forever.

**Warning signs:**
- Backup works in the first test session but silently stops ~1 hour later without re-auth.
- Play Console (once published) shows a "legacy Google Sign-In deprecated" warning.
- No handling for "refresh token revoked/expired" distinct from "network unavailable."

**Phase to address:** Phase 6 (Backup) for implementation; flag explicitly for extra research time at phase-start given the moving deprecation target — this is the phase most likely to need its own focused research spike.

---

### Pitfall 5: Copying the live SQLite file for backup while it's mid-write (WAL corruption)

**What goes wrong:**
The spec's backup approach is "upload the SQLite file... to the hidden appDataFolder." If the DB is in WAL mode (the expo-sqlite/Drizzle default for decent write performance) and the backup step does a naive `expo-file-system` copy of just the `.db` file, it silently omits the `.db-wal` and `.db-shm` files that hold not-yet-checkpointed data — producing an inconsistent snapshot. Restoring from that snapshot later can look fine at first and then throw "database disk image is malformed" or silently drop recently-written data.

**Why it happens:**
Naive file-copy-as-backup is the first thing that comes to mind and often "works" in casual testing because writes happen to be fully checkpointed at the moment of the test copy — the failure is timing-dependent and doesn't show up until a copy happens to race a real write (e.g., auto-backup firing right after the finish-workout screen writes PR/volume data).

**How to avoid:**
- Never copy the raw `.db` file directly for backup. Use SQLite's own `VACUUM INTO 'backup-path'` (safe to run while the DB is in use) to produce a consistent single-file snapshot, then upload that file.
- Alternatively, force a full WAL checkpoint (`PRAGMA wal_checkpoint(TRUNCATE)`) immediately before copying, and copy all three files (`.db`, `.db-wal`, `.db-shm`) atomically — `VACUUM INTO` is simpler and less error-prone, prefer it.
- On restore, validate the downloaded snapshot (basic integrity check / expected schema_version read) before swapping it in, and keep the spec's planned "copy current DB aside first" safety net.

**Warning signs:**
- Backup code does `FileSystem.copyAsync` on the `.db` path with no mention of WAL/checkpoint.
- No restore round-trip test that specifically triggers a backup immediately after a write-heavy operation (finishing a workout, per the auto-backup trigger).

**Phase to address:** Phase 6 (Backup) — must use `VACUUM INTO` (or equivalent) from the first implementation, not retrofitted after a corruption report.

---

### Pitfall 6: EAS sideload APK triggers Play Protect "unrecognized app" warnings that scare beta friends off

**What goes wrong:**
Friends install the APK, Android's Play Protect (which scans apps regardless of source) shows a blocking-feeling "this app is not recognized and could harm your device" warning, and non-technical friends stop the install rather than continuing past it — killing the beta before it starts, or generating "is this a virus?" messages that erode trust.

**Why it happens:**
Any APK not installed via Play Store gets this treatment by default on stock Android, especially from a brand-new, low-install-count package; this is a Google Play Protect heuristic, not something fixable purely through app code, though internal/ad-hoc distribution channels (e.g. registering testers and building via EAS "internal distribution") reduce friction somewhat.

**How to avoid:**
- Prepare friends in advance with a short "how to install" doc/message that explains the warning is expected for any sideloaded app and shows the "install anyway" tap sequence — don't let them hit it cold.
- Use EAS's `internal` distribution profile (`buildType: apk`, `distribution: internal`) which also gives an installable link page, rather than emailing a raw APK.
- Seriously consider enrolling in Play Console's free "Internal testing" track instead of/in addition to raw sideload once there's a Play Console account anyway (needed eventually for public release) — internal testing tracks skip most Play Protect friction and give crash reporting for free.
- Sign builds consistently (same keystore across builds) so repeat installs are treated as updates, not new unknown apps each time.

**Warning signs:**
- No onboarding message sent to friends before first APK link.
- Different signing keys used between builds (forces uninstall/reinstall, loses local data).

**Phase to address:** Phase 7 (Polish and beta) — but the *decision* between raw sideload vs. Play Console internal testing track should be made early since it affects signing/versioning setup from Phase 1.

---

### Pitfall 7: Chart library choice that looks fine with mock data, chokes on real history

**What goes wrong:**
`victory-native`'s original SVG-based renderer pushes every data point across the JS↔native bridge and re-renders on every interaction/animation frame; it holds up fine in early testing with a handful of mock points but degrades once a real user has months of workout history (a single exercise's estimated-1RM-over-time chart, or weekly-volume-by-muscle-group with dozens of weeks) — janky pans/zooms, slow initial paint, especially on friends' older Android phones (not everyone has a flagship).

**Why it happens:**
Chart libraries are usually prototyped with 10-20 sample points, which looks great regardless of underlying rendering approach; the SVG-bridge architecture's cost only becomes visible past roughly 1,000-5,000 points or with frequent re-renders (live-updating during a session), which won't show up until real usage accumulates.

**How to avoid:**
- Use `victory-native-xl` (the Skia-based rewrite, same "victory-native" branding but a different underlying package/architecture) rather than the legacy SVG `victory-native`, since it renders via GPU/Skia and bypasses the bridge — this is very likely already what's meant by "victory-native" in current tooling given the SDK's latest versions, but confirm the exact package/version pinned in package.json points to the Skia-based library, not the legacy one.
- Downsample before charting: for a "1 year of estimated 1RM" view, aggregate to weekly/monthly points server-side (client-side, since there's no server) rather than plotting every single logged set.
- Keep chart data queries indexed and paginated by date range (don't `SELECT *` an entire exercise's history into a chart component); only load the visible time window.
- Load-test with a synthetic dataset representing a "power user after 2 years" (thousands of sets) during Phase 4, not just with a few seed workouts.

**Warning signs:**
- Charts only ever tested against the freshly-seeded exercise library with zero/few logged sets.
- `package.json` pins a `victory-native` version without confirming it's the Skia-based (`@shopify/react-native-skia`-dependent) release line.

**Phase to address:** Phase 4 (Stats) — verify the chart package choice and test with realistic data volume before considering this phase done.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Skip WAL-safe backup (`VACUUM INTO`) and just copy the `.db` file | Faster to implement | Silent, timing-dependent corruption of user backups | Never |
| Cache PR/estimated-1RM values instead of computing from `sets` | Feels faster to build | Stale-cache bugs the spec explicitly warned against; reintroduces the exact bug class avoided by design | Only after profiling shows a real, measured slowdown (per spec's own stated exception) |
| Use legacy `@react-native-google-signin` free tier now | Ships backup feature quickly, works today | Facing a forced auth-layer rewrite when Google removes legacy Play Services Auth SDK | Acceptable for friends-beta phase; must be revisited before Play Store submission |
| Skip the migration-gate pattern, run migrations "inline" wherever DB is first touched | Less boilerplate initially | Race conditions where a screen queries before migrations finish; crashes on slower devices | Never past Phase 1 |
| Rely on a running `setInterval` for rest timer / elapsed workout time instead of timestamp math | Simpler mental model | Timer drifts or resets wrong after backgrounding/killing; breaks the "crash-safe" promise | Never for anything user-visible in duration-critical UI |
| Raw APK link for beta instead of EAS internal distribution / Play internal testing | Zero setup | Play Protect friction scares off non-technical friends; no crash telemetry | Acceptable only for the very first 1-2 sanity installs among technical friends |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|------------------|--------------------|
| Google Drive `drive.appdata` | Assuming the access token from a generic OAuth library silently refreshes forever without a backend | Use the native on-device Google Sign-In flow (OS account-backed silent refresh); treat token expiry/revocation as an explicit error state, not "network offline" |
| expo-notifications (Android) | Scheduling with a relative-seconds trigger and no exact-alarm permission | Schedule with an absolute date trigger + request `SCHEDULE_EXACT_ALARM`; prompt to disable battery optimization on first rest-timer use |
| Drizzle + expo-sqlite migrations | Assuming Metro bundles `.sql` migration files automatically | Use Drizzle's documented Expo migrator + bundler config; test upgrade path with non-empty seed data before every release |
| EAS Build / distribution | Emailing a raw signed APK with no context | Use `internal` distribution profile + installable link, prep friends for the Play Protect prompt, keep signing key consistent across builds |
| SQLite backup file | Copying `.db` only, ignoring `.db-wal`/`.db-shm` | `VACUUM INTO` a clean snapshot file before upload |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Legacy SVG-bridge charting on full history | Janky pan/zoom, slow chart mount | Use Skia-based charting (victory-native-xl) + downsample/aggregate by date range | Roughly 1,000-5,000+ raw points (a couple years of regular logging across sets) |
| Unindexed queries on `sets`/`workouts` for history & stats screens | History list and per-exercise charts slow down as workouts accumulate | Index on `workout_exercises.exercise_id`, `sets.workout_exercise_id`, `workouts.started_at`; paginate history list | Noticeable past a few hundred workouts / low thousands of sets |
| Full-list re-render on every set-row edit during active workout | Stepper taps feel laggy on lower-end Android phones | Isolate per-row state so editing one set doesn't re-render the whole exercise card list | Immediately on budget/older Android devices, even with modest data |
| Un-batched writes (e.g., seeding ~250 exercises with individual inserts) | Slow first-launch seeding, janky splash | Wrap bulk inserts (exercise seed, migrations) in a single transaction | First-launch seed of ~250 rows is enough to be noticeable unbatched |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Requesting broader Drive scopes than `drive.appdata` "just in case" | Google's OAuth verification/consent-screen requirements escalate sharply for broader Drive scopes (can require app verification review before Play Store launch); also erodes the "we can't see your files" trust promise | Request only `drive.appdata`, which is a non-sensitive scope with a lighter verification bar; never widen it without a real reason |
| Storing OAuth tokens in plain AsyncStorage | Tokens readable by any code with storage access on a rooted device | Use `expo-secure-store` (Keychain/Keystore-backed) for tokens, not AsyncStorage |
| No confirmation before "restore over local data" | One wrong tap wipes real logged workouts irreversibly | Spec already requires confirmation + copy-aside; keep this non-negotiable in implementation, don't let it get cut for time |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Rest timer notification with no distinct sound/vibration pattern from other app notifications | User misses timer end while phone is in a gym bag/pocket, mid-set | Use a dedicated notification channel with a distinct, attention-grabbing sound + strong vibration pattern for the rest timer specifically |
| Charts/stats that silently show nothing for new users with little history | Feels broken ("why is my chart empty?") | Explicit empty states on every stats/chart screen explaining "log a few more workouts to see this" |
| Auto-backup failing silently forever with no visible signal | User believes they have a backup; loses everything on phone loss | Per spec, banner only after repeated failures — good; ensure this actually renders and isn't the kind of state easy to forget to wire up |
| Restoring a snapshot from a newer schema version accepted anyway | Corrupts local DB on a device with an older app build | Enforce the spec's planned schema-version check on restore, refuse with a clear "update the app first" message — do not skip this to save time |

## "Looks Done But Isn't" Checklist

- [ ] **Migrations:** Only tested against a fresh empty DB — verify an upgrade path from a populated v1 DB to v2+ schema is tested before every schema-changing release.
- [ ] **Crash-safe active workout:** Only tested via backgrounding, not via Android "Force stop" — verify force-stop + relaunch reconstructs the exact in-progress workout, including rest timer state.
- [ ] **Rest timer:** Only tested with screen on/app foregrounded — verify it fires correctly with screen off, phone locked, for at least 10+ minutes, and on a non-Pixel/aggressive-OEM device if possible.
- [ ] **Google Drive backup:** Only tested for the initial sign-in + immediate backup — verify a backup succeeds after the access token has expired (wait an hour, or force-expire) without requiring a fresh manual sign-in.
- [ ] **Backup file integrity:** Only tested with a small/idle DB — verify a backup taken immediately after finishing a workout (heavy write right before the snapshot) restores cleanly.
- [ ] **Charts/stats:** Only tested with a handful of seeded workouts — verify with a synthetic dataset of hundreds/thousands of sets across many exercises for pan/zoom smoothness and load time.
- [ ] **EAS sideload install:** Only tested by the developer's own already-trusted device — verify a friend with no prior context can get through the Play Protect warning using only the instructions provided.
- [ ] **PR/estimated-1RM computation:** Verify it's genuinely computed live from `sets` (per spec) and no cache table has crept in without an invalidation strategy.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|------------------|
| Migration crash on upgrade for already-installed users | HIGH | Ship an emergency patch build with a corrected migration path; if data-destructive, may require asking affected friends to restore from their last Drive backup — reinforces why backup must work independently of app health |
| Backup snapshot corrupted (naive file copy) | MEDIUM | Switch to `VACUUM INTO`, invalidate/delete previously-uploaded bad snapshots, communicate to beta users that older backups may be unreliable |
| Legacy Google Sign-In library removed/broken by Google | MEDIUM-HIGH | Isolate the auth call behind a small internal interface from day one (sign-in, get-valid-token, sign-out) so swapping the underlying library/Credential Manager later doesn't ripple through the backup feature's business logic |
| Chart library performance collapse on real data | LOW-MEDIUM | Because charts are read-only derived views, swapping rendering approach or adding aggregation is a contained, non-data-destructive fix |
| Play Protect friction kills beta adoption | LOW | Switch distribution channel to Play Console internal testing track (free, fast to set up) instead of raw APK links |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| Migration crashes on upgrade | Phase 1 (Scaffold) | Manual test: seed DB at schema vN, apply migration to vN+1, confirm no crash and data intact |
| Ephemeral state loss on app kill | Phase 2 (Core logging) | Manual test: force-stop mid-workout, relaunch, confirm exact resume including rest timer |
| Rest timer unreliable in background | Phase 2 (implement) / Phase 7 (harden) | Manual test: screen off + locked for full rest period, on 2+ device types |
| Google auth token refresh without server | Phase 6 (Backup) | Manual test: backup succeeds after token naturally expires (~1hr+) with no re-login prompt |
| Backup file corruption (WAL) | Phase 6 (Backup) | Manual test: trigger auto-backup immediately after finishing a workout, then restore and diff data |
| Play Protect sideload friction | Phase 7 (Polish and beta) | Onboarding doc sent to friends before rollout; at least one non-technical friend completes install unassisted |
| Chart performance at scale | Phase 4 (Stats) | Load test with synthetic multi-year dataset before marking phase complete |

## Sources

- [Drizzle for Expo SQLite discussion #2447](https://github.com/drizzle-team/drizzle-orm/discussions/2447) — MEDIUM confidence (community discussion)
- [Drizzle ORM - Expo SQLite official docs](https://orm.drizzle.team/docs/sqlite/connect-expo-sqlite) — HIGH confidence (official docs)
- [Understanding App States in React Native (Medium)](https://medium.com/@vectoreman67/understanding-app-states-in-react-native-active-background-and-killed-c746afbdb554) — MEDIUM confidence
- [React Native AppState official docs](https://reactnative.dev/docs/appstate) — HIGH confidence
- [Android Notifications Reliability Guide - nek12.dev](https://nek12.dev/blog/en/how-to-make-android-notifications-100-reliable/) — MEDIUM confidence
- [Expo Notifications official docs](https://docs.expo.dev/versions/latest/sdk/notifications/) — HIGH confidence
- [FCM notifications not received in doze mode - expo/expo#2194](https://github.com/expo/expo/issues/2194) — MEDIUM confidence (GitHub issue)
- [Google Drive appdata guide - developers.google.com](https://developers.google.com/workspace/drive/api/guides/appdata) — HIGH confidence (official docs)
- [Google Drive API scopes guide](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) — HIGH confidence
- [Using OAuth 2.0 for Web Server Applications - Google](https://developers.google.com/identity/protocols/oauth2/web-server) — HIGH confidence
- [AuthSession for Google can't change scope - expo/expo#12793](https://github.com/expo/expo/issues/12793) — MEDIUM confidence
- [Migrate from Google Sign-in APIs to Credential Manager - react-native-google-signin#1373](https://github.com/react-native-google-signin/google-signin/issues/1373) — MEDIUM confidence
- [Streamlining Android authentication - Android Developers Blog](https://android-developers.googleblog.com/2024/09/streamlining-android-authentication-credential-manager-replaces-legacy-apis.html) — HIGH confidence (official)
- [About the migration from legacy Google Sign-In - developer.android.com](https://developer.android.com/identity/sign-in/legacy-gsi-migration) — HIGH confidence (official)
- [Developer Guidance for Google Play Protect Warnings](https://developers.google.com/android/play-protect/warning-dev-guidance) — HIGH confidence (official)
- [APK Sideloading Safety Checklist 2026 - alphonsolabs.com](https://www.alphonsolabs.com/apk-sideloading-safety-checklist-2026/) — LOW-MEDIUM confidence (blog)
- [Victory Native XL GitHub - FormidableLabs](https://github.com/FormidableLabs/victory-native-xl) — HIGH confidence (official repo)
- [Victory issue #287 - Very poor performance](https://github.com/FormidableLabs/victory/issues/287) — MEDIUM confidence
- [React Native Database Performance Comparison - PowerSync](https://powersync.com/blog/react-native-database-performance-comparison) — MEDIUM confidence
- [How To Corrupt An SQLite Database File - sqlite.org](https://www.sqlite.org/howtocorrupt.html) — HIGH confidence (official)
- [SQLite Write-Ahead Logging - sqlite.org](https://sqlite.org/wal.html) — HIGH confidence (official)
- [SQLite Corruption with fs.copyFile() in WAL Mode - Scott Spence](https://scottspence.com/posts/sqlite-corruption-fs-copyfile-issue) — MEDIUM confidence (practitioner post, corroborates official docs)
- [Runtime versions and updates - Expo docs](https://docs.expo.dev/eas-update/runtime-versions/) — HIGH confidence (official)
- [EAS Update Strategy 2026 - 72Technologies](https://www.72technologies.com/blog/eas-update-ota-strategy-channels-rollouts-rollbacks) — MEDIUM confidence

---
*Pitfalls research for: offline-first RN/Expo workout tracker with Google Drive backup*
*Researched: 2026-07-19*
