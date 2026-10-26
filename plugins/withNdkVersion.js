const { withProjectBuildGradle } = require('expo/config-plugins');

/**
 * Pins the Android NDK version for EVERY module in the generated project.
 *
 * Why: React Native 0.86.3 declares NDK 27.1.12297006 in its gradle version
 * catalog, but library modules read `rootProject.ext.ndkVersion` while the
 * RN gradle plugin only sets the APP module's ndkVersion — some libraries
 * (e.g. react-native-worklets) resolved their own default and failed when the
 * exact NDK was not preinstalled. Pinning the version RN itself declares, at
 * the root, is deterministic on a clean checkout: the SDK manager installs
 * exactly this NDK on CI, and all library modules agree on it.
 *
 * Configured in app.json:
 *   ["./plugins/withNdkVersion", { ndkVersion: "27.1.12297006" }]
 *
 * Idempotent: prebuild --clean reruns replace the previous pin in place.
 */
const withNdkVersion = (config, props) => {
  const ndkVersion = props?.ndkVersion ?? '27.1.12297006';
  return withProjectBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') return modConfig;
    const marker = 'ndkVersionPin';
    const pinLine = `rootProject.ext.ndkVersion = "${ndkVersion}" // ${marker}`;
    let contents = modConfig.modResults.contents;
    const pinRe = new RegExp(`^rootProject\\.ext\\.ndkVersion = "[^"]+"( // ${marker})?$`, 'm');
    if (pinRe.test(contents)) {
      contents = contents.replace(pinRe, pinLine);
    } else {
      contents = `${contents.trimEnd()}\n\n// Pinned by ./plugins/withNdkVersion — see file header for rationale.\n${pinLine}\n`;
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });
};

module.exports = withNdkVersion;
