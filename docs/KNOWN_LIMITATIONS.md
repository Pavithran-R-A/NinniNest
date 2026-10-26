# Known limitations — Stage 2 checkpoint (2026-10-26)

Honest list of what this build does NOT do. Nothing here is hidden behind marketing
language.

## Platform / environment limits (as of the 2026-10-26 recovery session)

1. **No APK was produced yet.** The Bolt sandbox could not authenticate EAS. The
   2026-10-26 local Gradle attempt on the owner's machine failed twice: first on
   an SDK-mismatched `expo-image-picker` (fixed in source), then on disk
   exhaustion — the drive had <3 GB free while Gradle wanted to download NDK
   27.1 (~2.5 GB). All build configuration is ready and the dependency mismatch
   is fixed; free disk space (≥6 GB recommended beyond current usage) is the
   remaining blocker for a local build. See `docs/ANDROID_BUILD.md`.
2. **No device or emulator run yet.** Every screen compiles and is unit-tested
   where logic exists, but has not been *seen* rendered on Android.
   `docs/DEVICE_TEST_MATRIX.md` lists every unverified device behaviour,
   including the staged media restore on a real filesystem.
3. **Git is now established.** The repository is cloned at
   `Pavithran-R-A/NinniNest` with work on the branch
   `release/ninninest-safety-zcode-20261026` (this limitation is closed as of
   2026-10-26; kept here for the record).

## Product limits (intentional or pending)

4. **No photo producer is wired in.** `media.ts` (durability copies) and the
   entire backup/restore photo pipeline exist and are tested, but **no screen
   imports a photo** — `expo-image-picker` is a dependency with zero imports.
   Until the picker slice lands, native backups contain no embedded photos and
   baby/milestone photo fields stay empty. Restore-side behaviour is verified;
   the missing piece is the producer UI.
5. **No growth percentiles.** No validated, licensed WHO dataset is bundled; the app
   shows descriptive trends only, never invented medical interpretation.
6. **Routine reminders never create records.** Notifications are informational only —
   they cannot write medication administrations or journal entries.
7. **No medication dose calculation.** The app records what was given; it never
   suggests or computes doses.
8. **Notifications are Android/iOS only.** Web cannot schedule them (platform
   limitation, surfaced in the UI).
9. **Photos: web has no managed copy.** Durability copying is native-only; web keeps
   blob references for the session's data. Backup imports on web are records-only
   (the no-op media port), stated in the result message.
10. **Large photo libraries unmeasured.** Full backups embed photos as base64 in one
    JSON file; memory and file size with dozens of photos is untested.
11. **No cloud sync, no accounts, no payments** — by design, per project rules.
12. **Native Copy button (Handoff) is broken on devices.** `handoff.tsx` calls the
    removed `react-native` Clipboard API; migrate to `expo-clipboard`
    (`Clipboard.setStringAsync`) — next code task after the backup-safety items,
    per GitHub issue #1.
13. **Real-adapter transactions not executed.** The Stage 2B exclusive
    transactions and atomic timer completion are typechecked and
    contract-tested (in-memory adapters, injected-io state machine) but have
    never run against real `expo-sqlite`/IndexedDB — a device is required.

## Unresolved before calling it "release-ready"

- Owner: free disk space, then run the local Gradle build (or EAS) — until then
  there is no installable artifact.
- Full device test matrix must be executed and honestly ticked (staged media
  restore on real filesystem included).
- One visual pass on a real screen (safe areas, 360dp width, night mode).
