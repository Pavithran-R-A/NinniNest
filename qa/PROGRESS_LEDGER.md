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

## DONE this mission (continued)
- Phase 1 VERIFIED: **CI GREEN on the public repo** (run 40378760597, 1m20s) — typecheck + 260 tests + web export + security-severity report, real executed steps. The earlier failures were pre-visibility billing blocks; the owner's public change fixed Actions.
- Phase 3 VERIFIED: **real installable APK from CI** — run 40385288846 (release, debug-signed, 134 MB), SHA-256 `4a1cc31f…` verified locally byte-for-byte; superseded by run 40390218128 (`68493da8…`, includes the UUID fix) and the pending 1252c02 build (routing fix). Workflow path bug (empty locate step uploaded android/ tree, 1 GB) found and fixed.
- Phase 8 device QA (Pixel_10 emulator, API 37, disposable data):
  - FOUND+FIXED **P0 native blocker**: Hermes has no `crypto.randomUUID` and no polyfill existed — onboarding save hung forever in release builds (silent TypeError). Fixed via src/models/uuid.ts (3 tests, all 13 call sites migrated). Verified: onboarding → Today now works on device (screenshots android-05/06).
  - VERIFIED: quick-log diaper on device → metrics card + ribbon update (android-08).
  - VERIFIED: **SQLite persistence across force-stop** — profile + diaper survived (android-10 deep-link check).
  - FOUND+FIXED **P1 routing defect**: cold start always landed on the static welcome (web SPA reload masked it); returning users were one tap from a duplicate profile. Root route now replaces to Today when a profile exists (1252c02); final verification build in flight.
- Web QA (browser, 360px): onboarding E2E, diaper log, reload persistence, night theme — screenshots in qa/screenshots/web-*.png.

## NEXT → DONE
1. ✅ 1252c02 APK (SHA 31d97e02…, run 40395296894) downloaded, verified, installed.
2. ✅ Device verification: cold start lands on Today with prior-session data (android-11 screenshot).
3. ✅ Final docs committed (CHANGELOG 0.9.1, FEATURE_STATUS, RELEASE_EVIDENCE final section).

## FINAL CERTIFICATION SESSION (2026-10-29)
- Checkpoint `761f46d`: completed the interrupted Family sheet ScrollView fix; typecheck 0; **266/266 tests, 25 files**; pushed and remote-verified; CI run `40828923950` GREEN; android-qa-build run `40828923940` produced the exact-HEAD APK, SHA-256 `3209bc97…41cb56` verified locally byte-for-byte.
- Device verification (Pixel_10, API 37, disposable data, APK 3209bc97…):
  - **Timer schema repair works in place**: fresh-install-broken `active_timers` table repaired by the unconditional init pass; sleep timer starts (was "Could not start the timer").
  - **Timer wall-clock persistence**: force-stop + 65 s → timer continued 2:33/3m from the persisted timestamp.
  - **Single journal entry** on completion ("Sleep 3m" in Journal).
  - **Photo persistence**: picker → crop → preview → save → force-stop → relaunch → preview renders from the managed file; Replace/Remove controls present.
  - **Sheet ScrollView fix verified**: sheet scrolls to Save with a photo preview attached.
- Notification DELIVERY on device: NOT TESTED this session — adb form automation was unreliable against the routine sheet (GBoard autocorrect + modal coordinate drift); scheduling logic is unit-tested and permission grant is device-verified. Recommend UI Automator/Appium for the delivery pass.

## REMAINING FOR FULL RELEASE
- Device: reminder delivery + reboot, device backup/restore with photos, timer L/R side-switch + double-tap specifics, photo capture end-to-end.
- UI matrix: 320–412dp, Tamil long strings, dynamic type (360px web done).
- Play declarations (owner-level).



## BLOCKED / NOT EXECUTABLE
- Local Gradle builds (disk); EAS (no account); real expo-sqlite runtime (needs device/APK).
