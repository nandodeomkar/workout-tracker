const path = require('path');
const fs = require('fs');
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// WT_WINDOWS_NINJA';
const NINJA_RELATIVE_PATH = path.join('tools', 'ninja', 'ninja.exe');

/**
 * Points the Android native build at a newer ninja on Windows.
 *
 * The ninja bundled with both installed Android SDK cmake packages (3.22.1 and
 * 3.31.4) is 1.10.2, which refuses any path over 260 characters. CMake mirrors
 * each source file's absolute path under the target's .dir directory, so
 * react-native-gesture-handler's autolinked codegen produces object paths of
 * ~288 characters before any prefix, and the release build dies with
 * "Filename longer than 260 characters".
 *
 * Path shortening cannot solve this: the irreducible part of the object path is
 * already 248 characters, and CMAKE_OBJECT_PATH_MAX does not shorten mirrored
 * absolute source paths under the Ninja generator (verified at 200, 160 and
 * 128 -- all still emit 288). The OS LongPathsEnabled flag is already set, so
 * the limit is ninja's own, not the platform's.
 *
 * ninja 1.11+ is long-path aware. 1.13.2 was verified to compile the exact
 * object file 1.10.2 rejected.
 *
 * Windows-only and skipped when the binary is absent, so Linux/macOS and EAS
 * Build are unaffected. android/ is gitignored generated output, hence a config
 * plugin rather than a direct edit to app/build.gradle.
 */
function addCmakeMakeProgram(contents, ninjaPath) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  const match = /(^[ \t]*)defaultConfig\s*\{/m.exec(contents);
  if (!match) {
    throw new Error(
      'withWindowsNinja: no `defaultConfig {` block found in app/build.gradle. ' +
        'Refusing to leave the build pointed at a ninja that cannot handle long paths.'
    );
  }

  // CMake accepts forward slashes on Windows and they avoid Groovy escaping.
  const cmakePath = ninjaPath.split(path.sep).join('/');
  const indent = match[1];
  const insertAt = match.index + match[0].length;
  const block =
    `\n${indent}    externalNativeBuild { ${MARKER}` +
    `\n${indent}        cmake {` +
    `\n${indent}            arguments "-DCMAKE_MAKE_PROGRAM=${cmakePath}"` +
    `\n${indent}        }` +
    `\n${indent}    }`;

  return contents.slice(0, insertAt) + block + contents.slice(insertAt);
}

const withWindowsNinja = (config) => {
  if (process.platform !== 'win32') {
    return config;
  }

  return withAppBuildGradle(config, (cfg) => {
    const ninjaPath = path.join(cfg.modRequest.projectRoot, NINJA_RELATIVE_PATH);
    if (!fs.existsSync(ninjaPath)) {
      // Not fatal: a machine without the vendored ninja falls back to the SDK
      // one, which is fine unless it hits the 260-character limit. See
      // docs/device-testing.md for how to fetch it.
      console.warn(
        `withWindowsNinja: ${NINJA_RELATIVE_PATH} not found, leaving the SDK ninja in place. ` +
          'Long release builds may fail with "Filename longer than 260 characters".'
      );
      return cfg;
    }
    cfg.modResults.contents = addCmakeMakeProgram(cfg.modResults.contents, ninjaPath);
    return cfg;
  });
};

module.exports = withWindowsNinja;
module.exports.addCmakeMakeProgram = addCmakeMakeProgram;
module.exports.MARKER = MARKER;
module.exports.NINJA_RELATIVE_PATH = NINJA_RELATIVE_PATH;
