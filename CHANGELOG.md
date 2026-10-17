# CHANGELOG

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
