const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// WT_DEBUGGABLE_RELEASE';

/**
 * Marks the Android *release* buildType as debuggable, opt-in via the
 * WT_DEBUGGABLE_RELEASE=1 environment variable.
 *
 * Why this exists: for multi-week on-device testing the app has to run without
 * Metro or the PC, which means the release variant (the debug variant embeds no
 * JS bundle, and expo-dev-launcher hijacks its cold start with the dev-client
 * launcher screen). But a stock release APK is not debuggable, which kills
 * `adb run-as` — currently the only way to pull files/SQLite/workout.db off the
 * device. Phase 7 (Backup & Export) will make that unnecessary; until then this
 * keeps a manual backup path open.
 *
 * Opt-in by design: without WT_DEBUGGABLE_RELEASE=1 this is a no-op, so a
 * debuggable APK can never leak into the Phase 8 Play Store release by
 * accident. To unwind for production, simply build without the variable.
 *
 * android/ is gitignored generated output, so this has to be a config plugin
 * rather than a direct edit to android/app/build.gradle.
 */
function addDebuggableToReleaseBlock(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  const buildTypesIndex = contents.indexOf('buildTypes {');
  if (buildTypesIndex === -1) {
    throw new Error(
      'withDebuggableRelease: no `buildTypes {` block found in app/build.gradle. ' +
        'Refusing to emit a silently non-debuggable release APK.'
    );
  }

  const releaseMatch = /(^[ \t]*)release\s*\{/m.exec(contents.slice(buildTypesIndex));
  if (!releaseMatch) {
    throw new Error(
      'withDebuggableRelease: no `release {` buildType found after `buildTypes {` in ' +
        'app/build.gradle. Refusing to emit a silently non-debuggable release APK.'
    );
  }

  const indent = releaseMatch[1];
  const insertAt = buildTypesIndex + releaseMatch.index + releaseMatch[0].length;

  return (
    contents.slice(0, insertAt) +
    `\n${indent}    debuggable true ${MARKER}` +
    contents.slice(insertAt)
  );
}

const withDebuggableRelease = (config) => {
  if (process.env.WT_DEBUGGABLE_RELEASE !== '1') {
    return config;
  }

  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addDebuggableToReleaseBlock(cfg.modResults.contents);
    return cfg;
  });
};

module.exports = withDebuggableRelease;
module.exports.addDebuggableToReleaseBlock = addDebuggableToReleaseBlock;
module.exports.MARKER = MARKER;
