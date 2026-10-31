# Device test matrix — consolidated 2026-10-31 (historical sections below)

Labels: **VERIFIED** = proven with real evidence in this environment; **FAILED** = ran
and failed; **NOT TESTED** = could not run here (no device, emulator, or browser
rendering tool). Nothing is labelled VERIFIED without an exit code or a unit test
behind it.

## Consolidated Android state (2026-10-31, Pixel_10 API 37 emulator + cloud API 34 KVM runner)

Evidence: `qa/screenshots/android-*`, `b*`, `c*`, `d*`, `u*` (local device passes),
`qa/cloud/evidence-*/` (cloud artifacts). APK provenance: every installed APK was
SHA-256-verified locally against its exact-SHA CI run before install.

| Capability | Status | Evidence |
| --- | --- | --- |
| Cold start lands on Today (returning) / welcome (first run) | VERIFIED | android-11; cloud run 4 welcome PASS |
| Onboarding → profile → Today | VERIFIED | android-05/06; cloud run 4 through name+DOB typing |
| Quick-log diaper → dashboard + ribbon | VERIFIED | android-08; cloud run 4 section 2 |
| Timer start/pause/resume/finish; single journal entry | VERIFIED | Test C (c02–c06) |
| Breastfeed L/R switch mid-timer with segments | VERIFIED | Test C (c02–c06) |
| Timer wall-clock persistence across force-stop | VERIFIED | 65 s force-stop → 2:33/3m continued (Test C) |
| Timer + data across full OS reboot | VERIFIED | c01 |
| Photo pick → managed copy → force-stop → renders | VERIFIED | u-series screenshots |
| Export via share sheet | VERIFIED | b20 (share sheet presented) |
| Import merge, same install | VERIFIED | b28 (2 → 4 events) |
| Merge idempotence (re-import → no duplicates) | VERIFIED | ui4 dump |
| Fresh-install import restore + embedded photo renders | VERIFIED | b49/b50 |
| Tampered photo byte → rejection dialog, nothing written | VERIFIED | b39 + ui9 |
| Multi-baby isolation after restore | VERIFIED | b31/b33 |
| Routine alarm SCHEDULED (RTC_WAKEUP) | VERIFIED | dumpsys alarm (d-series) |
| Notification DELIVERED to tray, app backgrounded | VERIFIED (cloud API 34) | run 41197666104: routine → RTC_WAKEUP alarm → app backgrounded → `NotificationRecord pkg=app.ninninest.journal` in dumpsys tray; foreground occurrence suppressed (documented expo behavior) |
| Malformed-JSON import rejection via real picker | VERIFIED (cloud API 34) | run 41197666104: Downloads → malformed.json → "This backup cannot be imported" dialog, records untouched |
| Notification permission denial path | NOT TESTED (grant path verified android-02) |
| Alarm re-fires after reboot | NOT TESTED (data persistence across reboot verified c01) |
| Import replace-all (erase) semantics | NOT TESTED on device (merge proven; replace unit-tested) |
| Malformed-JSON import rejection via real picker | NOT TESTED on device (tampered case proven; cloud run 5 section 6 targets malformed case) |
| CSV export capture on device | NOT TESTED |
| Delete-baby cascade (9 tables) | NOT TESTED on device (unit-tested) |
| 320–412dp widths on device | NOT TESTED (360px web verified; cloud density pass candidate) |
| Physical hardware pass | NOT TESTED |

## Historical: Phase E automated table (2026-10-26; test counts superseded — 266/266 as of 2026-10-31)

## Verified in this environment (automated)

| Item | Evidence | Status |
| --- | --- | --- |
| Strict TypeScript, whole app | `npx tsc --noEmit` exit 0 | VERIFIED |
| Unit/integration suite | `npm test` exit 0 — **225/225 tests, 17 files** (Stage 2B, 2026-10-26) | VERIFIED |
| Strict v5 media integrity | `tests/v5Integrity.test.ts` (17): canonical base64, version-matched verifiers, digest/length validation, combination rejection, zero mutation on rejection | VERIFIED (pure logic) |
| Media port state machine | `tests/mediaPort.test.ts` (11) against the REAL `createManagedMediaPort` with failure-injected io: track-before-write, unique names, partial-promote rollback, failure counting | VERIFIED (injected fakes — NOT a real filesystem) |
| Atomic timer completion | `tests/timerAtomic.test.ts` (5): atomic preferred, failure commits nothing, fallback preserved | VERIFIED (contract level) |
| Staged backup restore logic | 25 tests in `tests/backupRestore.test.ts` incl. post-import hygiene sweeps | VERIFIED (in-memory media port + contract-level repository — NOT a real device filesystem test) |
| Backup round-trip integrity | 11 backupIntegrity tests: counts, identities, fields, photo hash verify, corrupt-payload rejection, truncated/malformed/newer-version rejection, double-import merge idempotence | VERIFIED |
| Calendar validation | tests reject 2026-02-30, April 31, non-leap Feb 29, bad birth dates | VERIFIED |
| Analytics math | window aggregation, mixed milk, sides, night/nap split, empty days, multi-baby isolation | VERIFIED |
| CSV structure | RFC 4180 escaping + round-trip tests | VERIFIED |
| Android prebuild | `npx expo prebuild --platform android --no-install --clean` exit 0; manifest contained POST_NOTIFICATIONS + RECEIVE_BOOT_COMPLETED; gradle `applicationId 'app.ninninest.journal'` | VERIFIED (config only — no APK produced) |
| expo-doctor | 21/21, exit 0 | VERIFIED |
| Web export | `npx expo export --platform web` exit 0 | VERIFIED |
| Lockfile completeness | `npm ci --dry-run` exit 0 | VERIFIED |
| EAS CLI | `npx eas-cli whoami` → "Not logged in" | FAILED to authenticate (expected — no account in sandbox) |

## NOT TESTED (needs a real Android device/emulator after `eas build`)

Run after installing the APK; tick each row honestly.

| Item | How to test |
| --- | --- |
| Real `expo-sqlite` exclusive transactions (Stage 2B) | On device: hold the import modal open while a timer finishes; verify the timer write waits (EXCLUSIVE) and no record vanishes; kill mid-`replaceAll` and relaunch — old state intact |
| Real `expo-file-system` staging + hygiene (Stage 2B) | Import with photos; inspect `Documents/ninninest-media/`: `.staging` empty, promoted files under per-baby dirs, pre-import orphans swept after a replace |
| Photo pipeline end-to-end | BLOCKED until the picker is wired into FamilyForms (media.ts has no producer — see KNOWN_LIMITATIONS); then: pick → managed copy → backup → restore → photo visible after restart |
| Staged backup restore on real filesystem (Stage 2) | Export a backup with baby + milestone photos on device A; wipe app data (or use device B); import; verify photos appear, survive restart, and only `Documents/ninninest-media/<babyId>/` was written |
| Interrupted import recovery on device | Start a replace import, force-stop the app mid-import, relaunch, verify staging debris swept and records intact |
| Corrupt backup rejection on device | Tamper a photo byte inside the backup JSON, import, verify rejection dialog and zero changes |
| App launches from cold start | Install APK, tap icon, reach Today screen |
| Onboarding → first baby → Today | Fresh install, complete onboarding |
| Timer start / pause / resume / finish | Start sleep timer, pause, resume, finish; verify journal entry duration matches wall-clock |
| Breastfeed side switch mid-timer | Start left, switch to right, finish; check segments recorded |
| Timer survives app kill | Start timer, swipe app away, reopen; elapsed time continues from timestamp |
| Timer across timezone change | Start timer, change device timezone, verify no negative/duplicated duration |
| Photo pick → managed copy → restart persistence | Add baby or milestone photo, force-stop app, reopen, confirm photo still shows |
| Routine reminder notification | Create routine, grant POST_NOTIFICATIONS, verify notification fires on schedule day/time |
| Notification permission denial path | Deny permission, verify graceful in-app message, no crash |
| Notification after reboot | Schedule routine, reboot device, verify reminder re-fires (RECEIVE_BOOT_COMPLETED) |
| Full backup export → share | Settings → backup → share/save the JSON |
| Backup import merge on device | Pick exported file, choose merge, verify counts grow, no duplicates |
| Backup import replace on device | Choose replace, verify full state matches file; verify photos restored to media dir |
| Corrupt file import rejected | Rename a random file to .json, import, verify review dialog shows errors and nothing changes |
| CSV opens in spreadsheet app | Export CSV, open in Google Sheets/Excel, check column alignment and quoting |
| Demo mode isolation | Enable demo, log events, disable, verify personal records untouched |
| Multi-baby switching | Create second baby, switch chips, verify records never cross |
| Night mode contrast | Toggle night mode on every tab; check text legibility at 3 AM brightness |
| Small screen (360dp width) | Verify Today dock (6 buttons), Insights bars, Family sheets fit without clipping |
| Delete baby cascades | Delete a baby, verify all 9 record tables lose only that baby's rows |

## Web rendering — VERIFIED in-browser (2026-10-26, qa/screenshots/web-*.png)

- Onboarding → profile creation → Today dashboard: VERIFIED (360px, real browser).
- Quick-log diaper → dashboard + ribbon update: VERIFIED.
- Reload persistence (IndexedDB across full page reload): VERIFIED.
- Night theme switch: VERIFIED (screenshot).
- 320/393/412dp widths, Tamil long strings, dynamic font scale: NOT TESTED.

## NOT TESTED (needs a rendered browser — no browser tool in sandbox)

- Web file-picker import flow (browser automation cannot drive native pickers).
