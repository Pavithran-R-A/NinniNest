# Building the Android APK — owner instructions

The Bolt environment could not run an EAS build (no Expo account login; `eas-cli whoami`
returned "Not logged in"). All build configuration is prepared and verified locally
(`expo prebuild` for Android succeeded, exit 0; expo-doctor 21/21). The owner must run the
actual build after exporting the project.

## 2026-10-26 local build attempts (final status: config CORRECT, disk-blocked)

Three `./gradlew assembleRelease` attempts, three distinct causes — all fixed in
configuration except the last:

1. **Autolinking failure** (`Field 'version' is required ... Publication`):
   SDK-58 `expo-image-picker` in an SDK 57 project. **Fixed in source**
   (`~57.0.20`).
2. **NDK mismatch for library modules**: `react-native-worklets` reads
   `rootProject.ext.ndkVersion` (RN default 27.1) while only 27.2 is installed;
   a partial 27.1 download stub also had to be removed. **Fixed**: the version
   is now overridden at the ROOT `android/build.gradle`
   (`rootProject.ext.ndkVersion = "27.2.12479018"`) in addition to the
   app-module override — the configuration phase completes cleanly.
3. **Disk exhaustion**: the drive hit 0 bytes during dependency transforms.
   The build needs ≥6 GB free over the ~2 GB of cached dependencies
   (`~/.gradle/caches/modules-2` is kept and reused). **This is the only
   remaining blocker.**

Ready-to-run (after freeing ≥6 GB):

```bash
npx expo prebuild --platform android --no-install --clean   # regenerates android/
# re-apply the two ndkVersion overrides (see git history of docs/ANDROID_BUILD.md)
cd android && JAVA_HOME="C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot" \
  ANDROID_HOME="C:\Users\<you>\AppData\Local\Android\Sdk" ./gradlew assembleRelease
# APK at android/app/build/outputs/apk/release/app-release.apk
```

## Prerequisites

1. Node.js 20 or newer and npm.
2. An Expo account (free at https://expo.dev). The first EAS build requires a paid plan
   only if you need concurrent builds; the free tier includes build minutes via the
   "Free" plan queue.

## Steps

```bash
# from the exported project root
npm install
npm install -g eas-cli
eas login
eas whoami        # must print your username

# build the installable APK for side-loading / internal testing
eas build --platform android --profile preview
```

The `preview` profile (in `eas.json`) produces an **APK** with
`distribution: internal` — installable directly on any Android device.

For a Play Store release use the production profile instead:

```bash
eas build --platform android --profile production
# produces an .aab app-bundle with versionCode auto-increment
```

## What is already configured

- `app.json`: Android package `app.ninninest.journal`, versionCode 1, adaptive icon on
  background `#F7F5F0`, `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED` permissions,
  iOS bundle identifier and photo-library plist strings.
- `eas.json`: preview profile = APK / internal distribution; production = app-bundle.
- `npx expo prebuild --platform android --no-install --clean` was run and exited 0;
  the generated `AndroidManifest.xml` contained both permission entries and
  `build.gradle` contained `applicationId 'app.ninninest.journal'`.
- expo-doctor: 21/21 checks passed (exit 0).

## If EAS is not desired

Prebuild and build locally with Android Studio / SDK installed:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# APK at android/app/build/outputs/apk/release/app-release.apk
```

A keystore is required for release signing; EAS manages one automatically
(`eas credentials`), local Gradle builds need `app-signing` config in
`android/app/build.gradle`.
