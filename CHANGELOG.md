# CHANGELOG

## 0.9.0 — 2026-10-26 (reproducible Android builds; milestone editing; import bounds)

### Added
- **Milestone editing**: title, date, category and notes are editable; the
  photo can be replaced or removed with the same durability ordering as
  creation (previous file survives a failed save; replaced/removed files are
  reclaimed only after the commit). Milestone cards gain an edit action and a
  photo thumbnail.
- **Versioned Android NDK configuration** (`plugins/withNdkVersion`, wired in
  app.json): a clean checkout now reproduces the native build — prebuild pins
  `rootProject.ext.ndkVersion = 27.1.12297006` (the exact NDK React Native
  0.86.3 declares) so every library module resolves the same toolchain.
  Verified twice from a clean temporary checkout (idempotent across
  `prebuild --clean` reruns). Previously the fix lived only in the untracked
  generated `android/` folder and was lost on every regeneration.
- **Bounded backup imports** (untrusted-input hardening): plan-time limits on
  JSON size (300 MB cap ≈ 12× the measured 100-photo envelope) and per-
  collection record counts, checked before parsing/validation — an
  adversarial or accidentally huge file can no longer exhaust memory (the
  installed zod 4.6.7 is the newest 4.x and carries a known oversized-
  collection advisory; bounding input is the mitigation). 5 tests.
- `expo-notifications` plugin mode switched from `expo-push-notifications`
  (remote push infrastructure) to `broadcast` (local scheduled reminders
  only) — a local-first app should not declare push capabilities.
- GitHub Actions: `android-qa-build` workflow producing an installable
  debug-signed QA APK artifact from the exact pushed SHA; CI gains explicit
  dependency-security severity reporting and minimally scoped permissions.

### Verification
- Full suite: **260/260 (23 files)** · strict typecheck exit 0.

## 0.8.0 — 2026-10-26 (final completion mission — product gaps closed)

### Added
- **Photo picker, wired end to end** (the photo pipeline previously had no UI
  producer): baby create/edit and milestone create offer select, preview,
  replace and remove via `expo-image-picker`. Durability ordering is a tested
  pure workflow (`persistRecordWithPhoto`, 11 tests): copy into
  `Documents/ninninest-media/<babyId>/` BEFORE persisting; delete the previous
  photo only AFTER a successful commit; on copy or database failure remove
  only files the operation created. Photo controls are disabled in demo mode;
  permission/cancel/error states are localized (en + ta).
- **Routine reminders, wired** (previously never scheduled despite being
  claimed done): scheduling decisions extracted into a pure
  `planRoutineTriggers()` (4 tests — day→weekday mapping, unique ids, bad-time
  skipping); dedicated Android notification channel; provider reschedules from
  persisted routines after every routine add/delete and on app start; demo
  mode never seeds device notifications; reminders remain informational only.
- **Real-adapter IndexedDB integration tests** (6, via dev-only
  `fake-indexeddb`): round-trip, restart durability with a fresh adapter over
  the same store, atomic timer completion, physically isolated demo realm
  swap, merge import, failed-write survival.
- **Backup size envelope measured** with ~192 KB synthetic photos: 0 → 0.00
  MB, 1 → 0.25 MB, 20 → 5.01 MB, 100 → 25.04 MB of JSON (linear); records-only
  stays under 200 KB for 50 babies. Previously unmeasured.

### Fixed
- **Web confirmations existed as dead code**: `confirmDialog` (a real
  `window.confirm` fallback for `Alert.alert`, which is a no-op on web) had
  zero callers — destructive deletes and imports in Settings and Family
  silently proceeded without confirmation in the browser. All destructive
  flows now use it.
- **Handoff Copy** called the removed `react-native` Clipboard API (guaranteed
  device crash); now `expo-clipboard` `setStringAsync`.
- **CSV bundle sharing** passed a directory URI to Android's share sheet
  (unsupported); new dependency-free stored-zip writer (`src/models/zip.ts`,
  4 tests incl. CRC-32 check vector) bundles the CSVs into one `application/zip`
  file.
- Settings About showed a hardcoded stale version; it now reads the app config.

### Housekeeping
- CI runtime Node 22 (SDK 57 ≥ 22.13 requirement).
- Local Android build: the last configuration blocker is fixed — library
  modules (react-native-worklets) read `rootProject.ext.ndkVersion`, so the
  installed NDK 27.2 is now declared at the root (with the app-module override
  from 0.7.1). The build still requires ≥6 GB free disk; three attempts this
  session ended in transient plugin resolution, the NDK mismatch, and disk
  exhaustion — see `docs/ANDROID_BUILD.md`.

### Verification
- Full suite: **255/255 (20 files)** · strict typecheck exit 0 · web export 0.

## 0.7.1 — 2026-10-26 (Stage 2B — independent safety hardening)

### Fixed
- **Strict v5 photo integrity.** Entries claiming bytes now require
  `hashAlgo: 'sha256'`, a well-formed 64-hex digest, integer byte-length
  metadata that matches the decoded payload, and **canonical base64** (new
  `decodeBase64Strict` rejects missing/excess/mid-string padding, whitespace,
  and nonzero trailing bits). Unsupported algorithms and version/algorithm
  combinations are rejected; v4 media without any checksum is rejected as
  unverifiable rather than trusted. A malformed backup still can never mutate
  existing records.
- **Media port hardening.** The native port's state machine
  (`createManagedMediaPort`) is now driven by injected filesystem primitives
  and runs in tests with failure injection. Staged files are tracked BEFORE
  the fallible write (a partial write is still rolled back), staged/promoted
  names use `crypto.randomUUID()` (no same-millisecond collision), hostile
  owner ids are sanitized, and rollback returns the count of files it could
  not delete instead of swallowing silently.
- **Post-import media hygiene (real leak closed).** A replace import used to
  strand every photo the previous records referenced — the per-baby orphan
  cleanup in `media.ts` existed but had **zero callers**. The import now
  sweeps unreferenced files in imported babies' directories and removes whole
  directories only for profiles the user's confirmed replace erased. Merge
  mode cleans nothing. Cleanup failures surface in the result, never vanish.
- **Exclusive import transaction.** `replaceAll` moved from DEFERRED to
  `withExclusiveTransactionAsync` with the transaction handle used throughout:
  under DEFERRED a concurrent quick-log or timer finish could JOIN the import's
  open transaction and silently vanish on rollback. A failed UI refresh after
  a successful commit is now reported ("reopen the app if something looks
  stale") instead of being silently swallowed.
- **Atomic timer completion.** New optional `CareRepository.completeTimerAtomic`
  commits a stopped timer's journal event and the timer removal in ONE storage
  transaction (SQLite exclusive transaction; IndexedDB single keyed put),
  closing the process-death window that duplicated events on retry. Adapters
  without the capability keep the compensating event-first ordering.

### Changed
- CI runtime bumped Node 20 → 22 (Expo SDK 57 requires ≥ 22.13).
- `pnpm-lock.yaml` (a tool-generated duplicate of package.json resolutions,
  created by an npx invocation) was investigated and removed; npm remains the
  only package manager via `package-lock.json`.

### Known gaps recorded (not fixed in this stage)
- The photo picker is **not wired into any screen** — `media.ts` (durability
  copies) and the entire backup photo pipeline have no UI producer on native,
  so device backups contain no photos until the picker slice lands.
- Real SQLite/IndexedDB execution of the new transaction paths remains
  NOT TESTED (no device/emulator in this environment).

### Test coverage
- 37 new tests: strict v5 integrity (`tests/v5Integrity.test.ts`, 17),
  media-port state machine (`tests/mediaPort.test.ts`, 11), atomic timer
  completion (`tests/timerAtomic.test.ts`, 5), post-import hygiene
  (4 in `tests/backupRestore.test.ts`).
- Full suite: **225/225 (17 files)** · strict typecheck exit 0 · web export 0.

## 0.7.0 — 2026-10-26 (Stage 2 — staged, crash-recoverable backup restore; genuine SHA-256)

### Fixed
- Backup import is now staged and crash-recoverable. Embedded photos are
  decoded, integrity-verified, quarantined under the managed media area and
  promoted into their final per-baby locations **before** the single
  transactional database write. A failure at any point — unwritable media
  directory, simulated storage failure, rejected database write — leaves the
  previous records and previously existing photos byte-identical, and removes
  only the files the failed import created.
- Restored photos are now **re-linked to their records** (baby and milestone
  `photoUri` fields point at the restored managed files). The old "re-linking
  is not part of this restore" limitation is gone.
- Milestone photos are restored under the owning baby's managed directory, so
  the existing per-baby orphan cleanup covers them (they previously landed in
  a per-milestone directory the cleanup never swept).
- Interrupted imports recover: staging debris is swept at the next launch and
  before every import; promoted-but-uncommitted files are unique-named orphans
  that per-baby cleanup reclaims. No committed state is ever inconsistent.
- Records-only or partial backups no longer leave dangling photo references:
  records new to the device have foreign `photoUri` values cleared, with the
  loss stated in the result message. Existing records in merge mode are never
  rewritten.

### Changed
- Backup format **v5**: every embedded photo carries `hashAlgo: 'sha256'` plus
  a genuine FIPS 180-4 SHA-256 hex digest of the **decoded original bytes**
  (dependency-free implementation, cross-checked against Node's crypto in
  tests) and the decoded byte count. The `bytes` field no longer reports the
  base64 length.
- Legacy v4 (and older) archives still import: their checksums are verified
  with the original noncryptographic algorithm, explicitly labelled
  `legacy-fnv`, and are **never** reinterpreted as SHA-256. A v4 file whose
  checksum only matches as SHA-256 is correctly rejected.
- Strict photo-manifest validation at plan time: entries referencing records
  not in the file, duplicate entries for the same record/field, and
  traversal-style or unsafe file names are hard errors; the media port also
  sanitizes to a bare file name as defense in depth.
- Exports report completeness: `buildFullBackupWithReport` lists every
  referenced photo that could not be read, writes `mediaComplete: false` plus
  the missing-photo manifest, and the Settings message states the backup is
  incomplete instead of claiming success.
- Settings import/export messages distinguish complete success, incomplete
  media, records-only imports, storage failure (nothing written), and
  rollback (previous data preserved) — in English and Tamil.

### Housekeeping (environment recovery)
- `vitest.config.ts` resolves test stubs with `fileURLToPath` (the previous
  `URL.pathname` alias broke all stubbed suites on Windows) and pins the test
  timezone to UTC so analytics day-window tests are machine-independent.
- `expo-image-picker` pinned back to the SDK 57 line (`~57.0.20`); the
  `^58.0.10` requirement broke Android gradle autolinking.
- Unused `@supabase/supabase-js` dependency removed (no source imports; the
  app is and stays local-first).
- GitHub Actions CI added (typecheck + unit tests + web export).

### Test coverage
- New suite `tests/backupRestore.test.ts` (21 tests) covers the staged
  workflow end to end against an in-memory media port: fresh-device photo
  restore with URI re-linking, unwritable media, mid-stage and mid-promote
  failures, database-failure rollback that preserves pre-existing media,
  interrupted-import recovery, merge-vs-replace photo semantics, identical
  file names across babies, duplicate/invalid/traversal manifest entries,
  legacy v4 checksum semantics, repeated imports, and SHA-256 vectors
  cross-checked against Node crypto.
- Full suite: **188/188 passing (14 files)** · strict typecheck exit 0 ·
  web export exit 0.

## 0.6.2 — 2026-10-18 (Stage 1 fix — media restore gated on successful import)

### Fixed
- A failed database import no longer proceeds to media restoration: the import
  workflow stops immediately on write failure and shows the actual failure.
- Failed-import messages no longer claim records were "untouched" — an
  unverified claim — and now simply ask the user to try again.
- Successful imports with embedded photos state explicitly that photo
  re-linking to records is not part of this restore (Stage 2 work).

### Test coverage
- New regression test proves that when the repository rejects a write, the
  media-restoration and refresh functions are never invoked.
- Full suite: 167/167 passing (13 files) · strict typecheck exit 0.

## 0.6.1 — 2026-10-18 (Stage 1 — unified backup import validation)

### Changed
- Settings import now uses the strict `planImport` validator (the same path the
  provider already used): malformed records, duplicate event ids, orphaned
  references, unsupported backup versions and corrupted embedded photos are all
  rejected before anything is written.
- Import applies through `applyImportPlan` — one transactional write, no
  hand-built merge/replace logic left in Settings. Merge and replace modes
  preserved, each gated behind explicit user confirmation.
- The import summary describes all record types and never claims photo re-linking
  is complete: photo files restore best-effort; URI re-linking onto records is
  the Stage 2 follow-up.

### Test coverage
- New suite `tests/importSafety.test.ts` (9 tests) proves every rejection path
  leaves existing records byte-identical, including a simulated mid-write failure.
- Full suite: 166/166 passing (13 files) · typecheck exit 0.

## 0.6.0 — 2026-10-17 (Phase F — consumer experience, i18n, identity)

### Added
- Localization foundation: typed string packs with English complete and Tamil
  covering navigation, onboarding, Today, Journal, Handoff and Settings; runtime
  English fallback for untranslated keys; language picker in Settings; locale
  persisted across launches.
- 12/24-hour time display preference, persisted; the handoff letter and all clock
  renderings honor it.
- Third theme "Night · warm" — a dimmer, amber-shifted variant for 3 AM use —
  selectable alongside Day and Night.
- Original vector brand assets: night-arc icon and Android adaptive-icon foreground
  (SVG sources + rendered PNGs), wired into app.json icon/splash/adaptive config.
- Central brand constant so the product name can be renamed in one place while
  trademark clearance is pending.
- Duplicate-save protection: rapid double-taps on save/stop actions can no longer
  create duplicate records.
- Phase F implementation matrix and visual QA checklist documents.

### Fixed
- Family tab labels, Insights headings, Settings controls and all Today strings now
  localize; English pack verified complete against Tamil keys by unit test.

### Verification
- 129/129 tests (11 files, 8 new i18n tests) · typecheck exit 0 · expo-doctor 21/21 ·
  prebuild exit 0 with adaptive icons verified. No rendered visual QA was possible in
  this environment — a checklist with capture instructions is provided instead.

## 0.5.0 — 2026-10-17 (Phase E — build readiness, restore integrity, handoff)

### Added
- Media-inclusive backups: full backup now embeds every managed photo as base64 with
  an FNV-1a content hash; restore writes files back into the per-baby media directory
  and verifies each hash, failing loudly on corruption. Records-only JSON is no longer
  presented as a complete backup.
- Android build configuration finalized: `eas.json` preview (APK, internal) and
  production (app-bundle, auto-increment) profiles; Android package
  `app.ninninest.journal`; prebuild verified (permissions and applicationId confirmed).
- Handoff documentation: `docs/ANDROID_BUILD.md`, `docs/DEVICE_TEST_MATRIX.md`,
  `docs/BACKUP_RESTORE_AUDIT.md`, `docs/EXPORT_HANDOFF.md`, `docs/KNOWN_LIMITATIONS.md`.

### Fixed
- "Log past sleep / past tummy time" quick links on Today now meet the 44dp+ touch
  target (expanded tap area, no layout shift).

### Verification
- 121/121 tests (10 files) · typecheck exit 0 · expo-doctor 21/21 · web export exit 0 ·
  Android prebuild exit 0. **No APK produced** — EAS authentication unavailable in the
  sandbox; owner commands documented, no success claimed.

## 0.4.0 — 2026-10-17 (Phase D — data safety, reporting, portability)

### Added
- Insights tab: editorial analytics built only from real records — feeding summaries
  (breast by side, bottle by milk type including mixed, solids), pumping totals, sleep
  split night/nap with per-day bars, diaper categories, tummy time, day-by-day activity,
  growth history, medication dose history, milestone timeline; Today/7-day/30-day
  filters and baby-profile selection; graceful empty states, no interpolation.
- CSV export: full care history plus per-category files (growth, medications,
  vaccinations, milestones, routines) with RFC 4180 escaping and CRLF rows.
- Versioned JSON backup (v4) with dry-run validation: schema/version detection, orphan
  and duplicate-id reporting, and a review dialog before anything changes.
- Import via native document picker (Android/iOS) or web file picker, with merge (adds
  only new ids) or replace-all (single transactional write) modes.
- Share sheet on Android/iOS and browser downloads on web for all exports.
- Routine reminders on Android/iOS: weekly local notifications scheduled from active
  routine templates, with permission handling, re-sync cancellation, and a hard rule
  that reminders never create medication or journal records.

### Fixed
- Date validation now rejects impossible calendar dates (e.g. 2026-02-30, April 31,
  non-leap Feb 29) and impossible birth dates (future dates, pre-1900).
- Baby/milestone photos on native are copied into durable app-managed storage
  (`Documents/ninninest-media/<babyId>/`) instead of relying on reclaimable picker
  URIs; photo replacement and orphan cleanup are scoped per baby.

### Security/privacy
- Confirmed zero automatic network transmission of user data; export/import is fully
  user-initiated and local.

### Test coverage
- 30 new tests (110 total): calendar edge cases, cross-boundary aggregation, mixed-milk
  totals, sleep day attribution, empty-day handling, CSV escaping/round-trips, malformed
  and foreign backups, duplicate detection, merge semantics, multi-baby isolation.

## 0.3.0 — 2026-10-17 (Phase C — family and child development)
- Multiple baby profiles (create/edit/switch/delete, per-baby units, confirmed
  deletion across all 9 tables, persistent active-baby choice).
- Growth tracking (kg·cm / lb·in, descriptive trends; percentiles intentionally omitted).
- Milestones & memories with photos; medication administration records ("Given now",
  correctable history, no dose calculation); vaccination records; daily routine
  templates that never auto-write journal entries.
- Data schema v3 with six new tables; idempotent v1→v2→v3 migration.
- expo-sqlite version fix (58.0.13 → ~57.0.4); web-bundle independence verified.

## 0.2.0 — 2026-10-17 (Phase B — complete essential care logging)
- Segment-based timers (pause/resume/side switching), breastfeeding side memory,
  pumping finish sheet, tummy time, solids, sleep, repeat-last, entry correction.

## 0.1.0 — 2026-10-17 (PROMPT A vertical slice)
- Onboarding, Today dashboard, local-first storage (SQLite/IndexedDB), journal,
  handoff, settings, demo mode, JSON export/import.
