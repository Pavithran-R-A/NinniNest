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

## TEST D — NOTIFICATIONS (2026-10-30 continuation, Pixel_10, disposable data)
| Row | Status | Evidence |
| --- | --- | --- |
| Permission granted at launch | VERIFIED | system dialog captured (android-02), Allow tapped |
| Notification channel created | VERIFIED | `dumpsys notification`: `NotificationChannel{mId='routine-reminders', mName='Routine reminders', importance=3}` registered in system settings |
| Routine saved with correct time | VERIFIED | "01:09 · Delivery", "01:20 · Deliver2", "12:58 · Nap" — all in the Routines list with correct HH:mm (screenshots d12/d16) |
| Actual reminder SCHEDULED | VERIFIED | `dumpsys alarm`: `RTC_WAKEUP origWhen=2026-10-30 01:20:00` exact alarm for Deliver2, plus next-occurrence alarms Oct 31/Nov 1 per routine; 33 expo notification alarm entries |
| Actual notification DELIVERED | NOT TESTED | the 01:20 alarm FIRED (fired-section in dumpsys; rescheduled to Oct 31/Nov 1) **while the app was in the FOREGROUND** — expo-notifications suppresses tray delivery for foreground occurrences (documented platform behavior). The backgrounded-delivery pass was then blocked: disk exhaustion (737 MB free) killed the emulator mid-session |
| Reboot persistence of app data | VERIFIED | full OS reboot → app launches to Today with all records intact (c01) |
| Demo isolation of scheduling | VERIFIED (code) | resync skips demo realm (src/state/AppProvider.tsx) |
| Informational-only | VERIFIED (code) | syncRoutineNotifications never writes records |

## REMAINING FOR FULL RELEASE
- Device: notification delivery with the app BACKGROUNDED (needs ≥2 GB free disk for the emulator), CSV export capture on device, malformed-JSON rejection on device.
- UI matrix: 320–412dp, Tamil long strings, dynamic type (360px web done).
- Play declarations (owner-level).


## EXACT-HEAD ARTIFACT & DOCS (2026-10-29, final)
- Exact-HEAD APK for `82abf95`: run `40930579278` SUCCESS (25m54s), artifact `ninninest-qa-apk-82abf9502a6045fe6b22fac49689b65df248a050`, SHA-256 `c88da4bf502cccfeb151e349bcb0d70093902b4fa4f9b9e06e01accc23201c07` — local download verified byte-for-byte against the runner. (App code identical to the device-verified `79b48a02…`/`3209bc97…` builds; `82abf95` differs only in en/ta form strings, the 64 MB import cap, and docs.)
- README "Honest status" rewritten to current reality (APK pipeline, device-verified rows, 266 tests); issue #1 evidence comment posted (github.com/Pavithran-R-A/NinniNest/issues/1#issuecomment-6505133496) — issue kept OPEN pending notification-delivery + physical-device verification.
- Discarded: the 300 MB import cap (replaced by 64 MB); unused `expo-build-properties` dev install.

## TEST B — DEVICE BACKUP/RESTORE VERIFIED (2026-10-29, Pixel_10, disposable data)
Exact-HEAD APK `79b48a02…dade` (commit `57cb01d`, run `40903498502`) — SHA-256 verified locally before install.
- Dataset on device: TestAru (photo + 2 events) + TestIni (photo + medication + administration) — multi-baby.
- **Export**: Settings → Export backup (JSON) → share sheet presented `ninninest-backup-2026-10-29.json` (screenshot b20). No local "save to Files" target exists on this emulator image, so restore used a crafted v5 backup with identical schema (babies, events, growth, milestone, medication, administration, vaccination + embedded photo with genuine SHA-256 `20ab423d…`, pushed via adb to Downloads).
- **Import on the SAME installation (merge)**: plan-time validation passed on device ("2 profiles, 2 events, 1 growth record, 1 milestone, 1 recorded dose, 1 vaccination") → committed; care-event count 2 → 4 (b28).
- **Import on a FRESH INSTALL** (`pm clear` + reinstall → onboarding → Settings → Import → Downloads → merge): all records restored — TestCloud1/TestCloud2 appear with their events (b49), TestCloud2's embedded photo renders from the new managed path with Replace/Remove controls (b50).
- **Merge idempotence**: re-importing the identical file left the count at 4 care events — zero duplicates (ui4 dump).
- **Tampered rejection**: one flipped byte in the embedded base64 → on-device dialog "This backup cannot be imported / 1 embedded photo(s) failed their integrity check. The import was stopped rather than restore corrupted media." (b39 + ui9).
- **Malformed rejection on device**: NOT TESTED — the emulator's package manager wedged mid-test (activity resolution failures; repaired by reinstall). The rejection path is unit-tested and the rejection UX was device-proven via the tampered case.
- Multi-baby isolation with restored data: records and photos stayed attached to their own babies while switching chips (b31/b33).
- Note: the owner's other app (`com.projecttwo.app`, Couples) is installed on this emulator and repeatedly steals foreground; force-stopping it between steps was required. Not a NinniNest defect.

## REMAINING FOR FULL RELEASE
- Device: notification delivery + reboot (needs a stable UI-automation pass), CSV export on device.
- UI matrix: 320–412dp, Tamil long strings, dynamic type (360px web done).
- Play declarations (owner-level).




## CLOUD-EMULATOR ACCEPTANCE (TASK 1, 2026-10-31, workflow_dispatch + scoped push trigger)
Reuses the exact-source QA APK artifact (run 41092946811, SHA 33f1c3a70f…) — no rebuild; KVM ubuntu runner; synthetic data only; 7-day-retention evidence artifacts.
| Run | Commit | Result | Diagnosis → fix (each fix committed before the next run) |
| --- | --- | --- | --- |
| 41179307910 | 63e0917 | FAIL onboarding | GBoard stays shown after Enter on API 34 → second tap used pre-keyboard bounds; DOB text landed in Nickname. Fix: `kb_visible`/`hide_kb` guard (005e47f) |
| 41180088266 | 005e47f | FAIL onboarding | DOB bounds captured mid-reflow after keyboard dismissal. Fix: `stable_edit` two-identical-dumps poll (6512f3e) |
| 41180941210 | 6512f3e | FAIL welcome | **"Pixel Launcher isn't responding" ANR dialog** covered the app at cold boot (cloud-runner slowness, not an app defect — app visible and correct behind the dialog). Fix: `wait_for_text` now detects ANR dialogs and taps "Wait" (c263c2a) |
| 41182670787 | c263c2a | FAIL onboarding | ANR guard worked (welcome PASS). Two residual defects: (1) script waited for "Create profile" — a label that exists only on the Family new-baby sheet (`FamilyForms.tsx:232`), while onboarding's button is "Begin the journal" (`strings.ts` 'onb.begin'); (2) `stable_edit` returned a silent EMPTY coordinate when its python crashed (empty == initial prev → instant return; log gap 2.7 s proves the poll loop never ran), so the DOB tap never happened and the date was appended to Nickname. Fix: verified every scripted label against source ("Begin the journal", "Add a baby", "Create profile" only on family sheet), folded stability polling into `type_edit` with explicit ABSENT handling, `errors='replace'` in all dump readers (536af77) |
| 41183726027 | 536af77 | FAIL 3/7 PASS | Screenshots prove the onboarding form rendered, empty, no overlay — yet 12 consecutive `uiautomator dump` calls found zero EditTexts, then a dump 9 s later succeeded → **silent uiautomator dump failures serving stale content**; the script's "profile created" was a false PASS (tapped "Begin the journal" on the empty form; validation blocked navigation; all 7 FAILs cascade from there). Fix: dump() now verifies the tool's success marker, retries ×3, saves every dump (gzipped) to the artifact; real post-save verification (Today screen reached); restart-recovery path (5c6f0e8) |
| 41184669058 | 5c6f0e8 | FAIL welcome | Saved dumps exposed the mechanism: **`uiautomator dump` captures only the ACTIVE window** — dump 008 is `package="com.google.android.permissioncontroller"`: the POST_NOTIFICATIONS dialog rendered late (after the script's single-shot "Allow" tap), then held the active window for the whole wait, hiding the app. Same mechanism explains run 5's "invisible EditTexts" (dialog popped at onboarding mount). Fix: `dismiss_system_dialogs` guard in `wait_for_text`/`type_edit` polls — taps "Allow" (permission) / "Wait" (ANR) whenever that window is active; section 1 now polls for the dialog (afc4763) |
| 41185290188 | afc4763 | FAIL baby-name | ANR chronic: dumps show the "Pixel Launcher isn't responding" dialog recurring every ~20-30 s (014 = app+2 EditTexts, 018/022/026/030 = ANR). Fix: `settings put secure hide_error_dialogs 1` at launch (978029b) |
| 41185867978 | 978029b | FAIL baby-name | Dumps 011-016 show the app window with BOTH EditTexts rendered and the regex matching when run manually → the harness python itself was broken: **`re.findall` with capture groups returns tuples; `re.findall(r'\d+', <tuple>)` threw TypeError, output empty → "ABSENT" every poll**. This one line made every EditText-index step fail in runs 1-8 (tap_text always worked: `re.search().groups()` returns strings). Fix verified against the saved failing dump (2e30c73) |
| 41186548949 | 2e30c73 | CANCELLED at 60 min | Tuple fix unlocked the flow: **onboarding (name+DOB), profile creation with real post-save verification, and diaper quick-log all PASSED on the cloud emulator**; section 3 failed on a wrong label (real button is hardcoded "Add another child", family.tsx:570 — the 'family.addBaby' key is dead); section 4's time entry had the same m.group(1)-None crash class; then a wedged adb call hung the run until the job timeout. Fix: timeout 30/60 on every adb call, correct label, time entry via EditText[1]+clear, device-clock wait, delivery check gated on save (65a440c) |
| (run 10) | 65a440c | (in flight) | full instrumented flow, adb timeouts, gated waits |

Harness capability proven so far: cold launch, system-permission grant, ANR recovery, text-bound tapping, keyboard-aware typing, dumpsys alarm/notification inspection, force-stop, push-file + picker navigation.

## BLOCKED / NOT EXECUTABLE
- Local Gradle builds (disk); EAS (no account); real expo-sqlite runtime (needs device/APK).
