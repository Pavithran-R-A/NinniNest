# CHANGELOG

## 0.3.0 — 2026-10-17 (Phase C — family and child development)

### Added
- Multiple baby profiles: create, edit, switch and delete multiple children from a new
  Family tab; optional photo field; per-baby preferred units (kg·cm / lb·in); deletion
  with confirmation removes every entity belonging to that baby across all 9 storage
  tables; the active-baby selection persists across restarts; switching babies never
  disturbs other babies' active timers.
- Growth tracking: weight, length/height, head circumference with per-profile unit
  preference, dated and editable history, descriptive trend lines. Percentile reference
  curves intentionally omitted pending a validated licensed WHO dataset.
- Milestones and memories: six categories (motor, social, language, cognitive, feeding,
  custom), custom titles, editable dates, notes, persisted photo attachments, and a
  chronological year-grouped memory journal.
- Medication administration records: user-entered medications with prescribed
  instructions and doses (mL/mg/drops/tablets), one-tap "Given now" recording, per-day
  dose listings, individually removable historical doses. No calculation or advice.
- Vaccination history: vaccine name, date given, optional next appointment, provider,
  notes — a personal record with no schedule recommendations.
- Daily routines: recurring templates (feed, nap, pump, tummy time, reminder) with
  day-of-week selection and 24-hour local time. Templates never create journal entries.
- Phase C test suite: multi-baby isolation, profile deletion contract, growth validation
  and unit conversion, milestone/photo persistence, medication dose integrity,
  vaccination data integrity, routine recurrence and timezone handling — 80 tests total.

### Changed
- Data schema v3: six new tables on native (growth_records, milestones, medications,
  medication_administrations, vaccinations, routines) and six new arrays on web; babies
  widened with photoUri and preferredUnits; migration ladder v1→v2→v3 is idempotent and
  column-checked before ALTER.
- Web adapter upgrades v1/v2 IndexedDB backups to v3 in place on load.

### Fixed (Part A audit)
- expo-sqlite version mismatch (58.0.13 → ~57.0.4) — expo-doctor now 21/21.
- Verified web bundle independence: no WASM/native SQLite in the web entry; IndexedDB
  repo is fully standalone.

### Known limitations
- No rendered-browser or device verification in this environment (see RELEASE_EVIDENCE.md).
- Insights, localization, CSV export and native import remain unbuilt.

## 0.2.0 — 2026-10-17 (Phase B — complete essential care logging)

### Added
- Segment-based timers (`TimerSegment[]`): pause/resume, side switching, overnight and
  restart-safe elapsed time computed from timestamps only.
- Breastfeeding: side switching with segment closure, last-used-side memory, manual
  correction form, session history.
- Pumping: dock timer with finish sheet (amount/side/note); manual pumping form; editable history.
- Tummy time: persistent stopwatch + manual entries + history.
- Solids: food, quantity, observed reaction (explicitly not a diagnosis), notes.
- Sleep: pause/resume, manual past entry, overnight-safe measurement.
- Repeat last log: prefilled editable form with a fresh timestamp.
- Multi-timer display, entry time correction, live timer badge controls.
- Unit tests for segment timers, unit conversion, repeat-last and extended validation — 51 tests.

### Changed
- Data schema v2: active timers persist `segments` JSON + `lastSide`; SQLite migration
  v1→v2 backfills existing timers as a single running segment.
- Canonical mL enforced at every save boundary; oz is input/display-only.

## 0.1.0 — 2026-10-17 (PROMPT A vertical slice)

### Added
- Welcome screen and no-account onboarding, Today dashboard, persistent storage
  (expo-sqlite native / IndexedDB web behind one `CareRepository`), journal ribbon,
  care handoff letter, settings (night mode, JSON export/import, demo mode, erase all),
  bundled fonts, 27 unit tests, documentation set.
