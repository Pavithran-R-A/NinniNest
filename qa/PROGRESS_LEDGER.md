# Progress ledger — 100% consumer release mission (2026-10-26, resumable)

Source of truth for the current mission; historical evidence lives in
RELEASE_EVIDENCE.md. Update after every milestone.

## Verified starting state
- Branch `release/ninninest-safety-zcode-20261026` at `439eeca` (= origin), `main` at `4902b47e` (protected).
- Repo now PUBLIC (owner change, for free Actions runners). Run `40374094635` still failed BEFORE steps with the account-billing annotation — timing vs the visibility change is unknown; the next push (this mission's first) is the controlled retry.
- Disk 3.1 GB → cloud builds are the path; local Gradle stays off unless space recovers.

## DONE this mission
- Phase 2: `plugins/withNdkVersion` config plugin (pins RN 0.86.3's declared NDK 27.1.12297006 at `rootProject.ext`). Verified from a clean temporary checkout: prebuild generates the pin; second run proves idempotency. This closes the "untracked android/ fixes" defect permanently.
- `expo-notifications` mode `expo-push-notifications` → `broadcast` (local-only reminders; removes remote-push capability from a local-first app).
- Phase 1+3 workflows: `.github/workflows/android-qa-build.yml` (ubuntu-latest, Node 22, JDK 17, npm ci → prebuild --clean → assembleDebug → aapt badging → SHA-256 → artifact, 7-day retention, contents:read permissions); ci.yml gains explicit security-severity reporting (runtime-deps audit gate + full-tree report) and an informational expo-doctor step.
- Phase 4A: milestone editing — MilestoneForm edits title/date/category/notes with photo replace/remove (durability via persistRecordWithPhoto edit path: previous file survives failed saves; reclaimed after commit); provider exposes updateMilestone (INSERT OR REPLACE); cards gain edit action + photo thumbnail.
- Phase 7: bounded imports (300 MB JSON cap; per-collection caps; photo count cap) checked BEFORE parse/validation — mitigation for the unpatched-in-4.x zod oversized-collection advisory (zod 4.6.7 is latest 4.x; bump checked, none available). 5 tests.
- Version alignment: app.json version 0.9.0, versionCode 2 (was 1.0.0/1); changelog 0.9.0.
- Suite at last gate: **260/260, 23 files; typecheck 0.**

## NEXT (in order)
1. Commit + push (ONE controlled CI attempt → answers whether public visibility fixed Actions; android-qa-build produces the APK if so).
2. If Actions works: download APK artifact, boot emulator (exists, no downloads), run the device matrix with disposable data, scope adb to `-s emulator-5554`.
3. If Actions still account-blocked: produce the GitHub Support escalation note; keep APK/device gates BLOCKED; continue with localization sweep + browser UI QA (node_repl browser may now be available).
4. Localization sweep (Growth/Med/Vax/Routine forms + Settings dialogs hardcoded English).
5. Doc consistency: latest-certified numbers everywhere (260/260/23) with historical checkpoints preserved.

## BLOCKED / NOT EXECUTABLE
- Local Gradle builds (disk); EAS (no account); real expo-sqlite runtime (needs device/APK).
