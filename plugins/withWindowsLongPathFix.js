const { withAppBuildGradle } = require('@expo/config-plugins');

const MARKER = '// WT_WINDOWS_LONG_PATH_FIX';

/**
 * Works around the Windows MAX_PATH limit when building the Android release
 * variant on this machine.
 *
 * CMake mirrors each source file's absolute path underneath the target's .dir
 * directory, so an autolinked codegen source such as
 * react-native-gesture-handler's RNGestureHandlerDetectorShadowNode.cpp yields
 * an object path around 379 characters. The ninja bundled with the Android SDK
 * cmake packages is 1.10.2 and carries no `longPathAware` manifest, so it
 * refuses anything over 260 regardless of the OS LongPathsEnabled setting, and
 * the build dies with "Filename longer than 260 characters".
 *
 * Shortening the repo path cannot fix this: the irreducible part of the object
 * path (the CMakeFiles/<target>.dir prefix plus the source tail) is already 248
 * characters, leaving no usable headroom. CMAKE_OBJECT_PATH_MAX instead makes
 * CMake hash-shorten any object path that exceeds the limit, which is precisely
 * what the variable is documented to do.
 *
 * Windows-only, so Linux/macOS and EAS Build are unaffected. android/ is
 * gitignored generated output, hence a config plugin rather than a direct edit.
 */
function addCmakeObjectPathMax(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  const match = /(^[ \t]*)defaultConfig\s*\{/m.exec(contents);
  if (!match) {
    throw new Error(
      'withWindowsLongPathFix: no `defaultConfig {` block found in app/build.gradle. ' +
        'Refusing to leave the MAX_PATH workaround silently unapplied.'
    );
  }

  const indent = match[1];
  const insertAt = match.index + match[0].length;
  const block =
    `\n${indent}    externalNativeBuild { ${MARKER}` +
    `\n${indent}        cmake {` +
    `\n${indent}            arguments "-DCMAKE_OBJECT_PATH_MAX=200"` +
    `\n${indent}        }` +
    `\n${indent}    }`;

  return contents.slice(0, insertAt) + block + contents.slice(insertAt);
}

const withWindowsLongPathFix = (config) => {
  if (process.platform !== 'win32') {
    return config;
  }

  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addCmakeObjectPathMax(cfg.modResults.contents);
    return cfg;
  });
};

module.exports = withWindowsLongPathFix;
module.exports.addCmakeObjectPathMax = addCmakeObjectPathMax;
module.exports.MARKER = MARKER;
