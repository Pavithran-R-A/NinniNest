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

4. **Photos: web has no durable copy.** The picker is wired on native with
   managed-storage copies; on web the picker is not offered (photo controls
   hide behind the same demo flag) and photo durability remains a documented
   platform limitation. Backup imports on web are records-only (the no-op
   media port), stated in the result message.
5. **No growth percentiles.** No validated, licensed WHO dataset is bundled; the app
   shows descriptive trends only, never invented medical interpretation.
6. **Routine reminders never create records.** Notifications are informational only —
   they cannot write medication administrations or journal entries. Reminder
   delivery after reboot is asserted by the RECEIVE_BOOT_COMPLETED manifest
   entry but NOT TESTED on a device.
7. **No medication dose calculation.** The app records what was given; it never
   suggests or computes doses.
8. **Notifications are Android/iOS only.** Web cannot schedule them (platform
   limitation, surfaced in the UI).
9. **Large photo libraries: envelope measured, untested on-device.** 100 ×
   192 KB photos produce a ~25 MB backup JSON (linear scaling, measured);
   on-device export/import behaviour at that size is untested.
10. **No cloud sync, no accounts, no payments** — by design, per project rules.
11. **Real-adapter SQLite not executed.** IndexedDB runs against a real
    spec-compliant store in tests; `expo-sqlite` exclusive transactions and
    the atomic timer completion still need a device run.
12. **Milestone photos cannot be edited or removed after creation.** The
    create flow attaches a photo; there is no milestone edit sheet yet, so
    replace/remove for an existing milestone photo (and the baby-photo change
    flows) need the milestone-edit slice. Baby photos support full
    replace/remove via profile edit.
13. **Form-level strings outside Family photo flows remain English-only**
    (Growth/Medication/Vaccination/Routine forms and Settings dialogs use
    hardcoded English); the en/ta packs cover navigation, Today, Journal,
    Handoff, Insights labels and the new photo/import messages, with runtime
    English fallback documented. Completing the sweep is backlog.
14. **APK**: not produced this session — the build configuration is correct
    and ~2 GB of dependencies are cached; ≥6 GB free disk is the sole blocker
    (see docs/ANDROID_BUILD.md). No device QA has therefore run.

## Unresolved before calling it "release-ready"

- Owner: free disk space, then run the local Gradle build (or EAS) — until then
  there is no installable artifact.
- Full device test matrix must be executed and honestly ticked (staged media
  restore on real filesystem included).
- One visual pass on a real screen (safe areas, 360dp width, night mode).
