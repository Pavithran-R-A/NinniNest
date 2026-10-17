# Known limitations — Phase E checkpoint

Honest list of what this build does NOT do. Nothing here is hidden behind marketing
language.

## Platform / environment limits (not fixable inside Bolt)

1. **No APK was produced.** EAS CLI could not authenticate ("Not logged in"); the
   environment has no Expo account. All configuration is ready — see
   `docs/ANDROID_BUILD.md` for the exact owner commands.
2. **No device, emulator, or browser rendering** was available. Every screen compiled,
   is unit-tested where logic exists, and bundles, but was never *seen* rendered.
   `docs/DEVICE_TEST_MATRIX.md` lists every unverified device behaviour.
3. **No git repository / GitHub remote.** The project was never a git repo in this
   environment (git init is possible but no commits/SHA exist). Reproducibility comes
   from the lockfile (`npm ci --dry-run` exit 0) and the export procedure.

## Product limits (intentional or pending)

4. **No growth percentiles.** No validated, licensed WHO dataset is bundled; the app
   shows descriptive trends only, never invented medical interpretation.
5. **Routine reminders never create records.** Notifications are informational only —
   they cannot write medication administrations or journal entries.
6. **No medication dose calculation.** The app records what was given; it never
   suggests or computes doses.
7. **Notifications are Android/iOS only.** Web cannot schedule them (platform
   limitation, surfaced in the UI).
8. **Photos: web has no managed copy.** Durability copying is native-only; web keeps
   blob references for the session's data.
9. **Large photo libraries unmeasured.** Full backups embed photos as base64 in one
   JSON file; memory and file size with dozens of photos is untested.
10. **No cloud sync, no accounts, no payments** — by design, per project rules.

## Unresolved before calling it "release-ready"

- Owner must run `eas build` (or a local Gradle build) — until then there is no
  installable artifact.
- Full device test matrix must be executed and honestly ticked.
- One visual pass on a real screen (safe areas, 360dp width, night mode).
