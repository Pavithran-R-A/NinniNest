# Device test matrix — Phase E, updated Stage 2B (2026-10-26)

Labels: **VERIFIED** = proven with real evidence in this environment; **FAILED** = ran
and failed; **NOT TESTED** = could not run here (no device, emulator, or browser
rendering tool). Nothing is labelled VERIFIED without an exit code or a unit test
behind it.

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

## NOT TESTED (needs a rendered browser — no browser tool in sandbox)

- Visual rendering of every screen (composition, spacing, safe areas).
- Web IndexedDB persistence across reloads.
- Web file-picker import flow.
