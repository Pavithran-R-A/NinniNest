# CHANGELOG

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
