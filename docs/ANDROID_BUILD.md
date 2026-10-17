# Building the Android APK — owner instructions

The Bolt environment could not run an EAS build (no Expo account login; `eas-cli whoami`
returned "Not logged in"). All build configuration is prepared and verified locally
(`expo prebuild` for Android succeeded, exit 0; expo-doctor 21/21). The owner must run the
actual build after exporting the project.

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
