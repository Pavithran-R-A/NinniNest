# Known limitations — current as of the 2026-10-31 certification pass

Honest list of what this build does NOT do. Nothing here is hidden behind marketing
language. Historical sections at the end are labelled and superseded.

## Current status snapshot (2026-10-31)

- Installable QA APKs are produced per push by CI (`android-qa-build`),
  debug-signed and (since commit `bbc6c59`) debuggable for `run-as` QA
  instrumentation — they are test artifacts, not production-signed builds.
- Cloud-emulator acceptance (API 34, KVM hosted runner) runs the app end to
  end; run `41197666104` completed 14/14 PASS on the exact-source APK of
  commit `8e89683`. The corrected certification workflow (`bbc6c59`+) adds an
  exit-status gate (FAIL>0 ⇒ red run), a self-test proving that mechanism,
  exact-HEAD artifact resolution without fallback, strict notification-record
  matching, a true exported-backup roundtrip via `run-as` capture, CSV bundle
  capture, a delete-baby cascade pass, and an environment job (reboot,
  permission denial, 320/360/393/412dp, themes, Tamil, font scale).
- Local Gradle builds remain unused; the hosted-runner route is the release
  build path. `docs/ANDROID_BUILD.md` documents why.
- Milestone editing (0.9.0) and milestone/baby photo replace/remove are done;
  item 12 of the old list is closed.
- Routine reminders: scheduling, backgrounded tray delivery, and alarm
  rescheduling are cloud-verified; the delivery channel is the dedicated
  `routine-reminders` channel as of the SDK-57 trigger-`channelId` fix
  (regression-tested; device-level delivery proof in cloud run 41197666104
  used the expo fallback channel — the fix landed after that run).

## Dependency advisories — reachability analysis (2026-10-31, npm audit)

27 findings (1 critical, 11 high, 13 moderate, 2 low). **None of the
critical/high findings is in the shipped app runtime bundle**; they sit in the
Expo SDK 57 build/dev toolchain, traced with `npm ls`:

| Package | Severity | Actual path | Runtime-reachable? |
| --- | --- | --- | --- |
| shell-quote | critical | react-devtools-core, @expo/cli | No — dev tooling only |
| node-forge | high | @expo/code-signing-certificates, @expo/cli | No — build tooling |
| ws | high | @expo/metro, metro (dev server) | No — dev tooling |
| @xmldom/xmldom | high | @expo/plist, sf-symbols-typescript | No — build-time plist/symbol processing |
| picomatch | high | @expo/metro-config, expo-camera→barcode-detector | No — build tooling; camera module unused |
| decode-uri-component | high | expo-router → query-string | Borderline — the router parses URLs at runtime, but the app defines no deep-link query surface (root route reads no params); ReDoS needs attacker-controlled query input |
| zod (transitive 3.25.76) | high | @expo/cli internal | No — build tooling; the app's direct zod is 4.6.7, NOT in the vulnerable <4.6.6 range |
| uuid (transitive 7.0.3) | moderate | @expo/code-signing-certificates | No — build tooling |

Remediation state: the available fixes for most findings require the Expo SDK
58 major upgrade (breaking; out of scope for this release line). A non-forced
`npm audit fix` was attempted on 2026-10-31 and **failed on toolchain disk
exhaustion without applying any change** (package-lock.json unchanged; the
toolchain was restored with `npm ci` and re-verified: typecheck 0, 272/272).
No exploitable critical/high runtime finding is being suppressed; the CI
advisory step reports these as warnings with this document as the accepted
risk record.

## Product limits (intentional or pending)

5. **No growth percentiles.** No validated, licensed WHO dataset is bundled; the app
   shows descriptive trends only, never invented medical interpretation.
6. **Routine reminders never create records.** Notifications are informational only —
   they cannot write medication administrations or journal entries.
7. **No medication dose calculation.** The app records what was given; it never
   suggests or computes doses.
8. **Notifications are Android/iOS only.** Web cannot schedule them (platform
   limitation, surfaced in the UI).
9. **Large photo libraries: envelope measured.** 100 × 192 KB photos produce a
   ~25 MB backup JSON (linear, measured); on-device export/import at that size
   is untested.
10. **No cloud sync, no accounts, no payments** — by design, per project rules.
11. **Physical-hardware pass remains NOT TESTED.** No explicitly authorized
    physical test device was provided; the release-candidate verdict treats
    emulator/cloud evidence as emulator evidence, never as hardware proof.
12. **Web photo durability**: web picker flows remain limited vs native
    (records-only photo behavior documented in the result messages).
13. **QuickLog and EventEditSheet strings remain English-only** (the diaper/
    bottle/pump quick-log sheets and the entry edit sheet use hardcoded
    English). COMPLETED in the 2026-11-04 sweep (`59d2509`, 4 i18n regression
    tests): Growth, Medication, Vaccination and Routine forms, the baby/
    milestone form furniture, weekday accessibility labels, and every
    Settings/family confirmation dialog (delete-profile, remove, erase,
    demo, import review/rejection) are fully en+ta. English fallback for any
    future key remains documented runtime behavior.

## Unresolved before store submission (owner-level)

- Production signing keystore + Play Console declarations (owner actions).
- Physical-device pass on an explicitly authorized device.
- Expo SDK 58 upgrade line for the toolchain advisories above.

## Historical checkpoint (2026-10-26) — SUPERSEDED, kept for the record

1. "No APK was produced yet" — true then; CI APKs exist since run 40385288846.
2. "No device or emulator run yet" — true then; extensive device and cloud
   verification has since run (see `docs/DEVICE_TEST_MATRIX.md`).
3. Git branch establishment — closed long since.
14. (old numbering) "APK: not produced this session" — superseded as above.
