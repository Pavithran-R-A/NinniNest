# CHANGELOG

## 0.2.0 — 2026-10-17 (Phase B — complete essential care logging)

### Added
- Segment-based timers (`TimerSegment[]`): pause/resume, side switching, overnight and
  restart-safe elapsed time computed from timestamps only.
- Breastfeeding: side switching closes the current segment and starts a new one,
  last-used-side memory, manual correction form, session history.
- Pumping: dock timer with a finish sheet capturing amount (mL), side and note; manual
  pumping form; pump events carry optional side; editable history.
- Tummy time: persistent stopwatch timer + manual entries + history.
- Solids: food, quantity, observed reaction (explicitly not a diagnosis), notes.
- Sleep: pause/resume supported by segment timers, manual past-sleep entry, overnight
  sessions measured correctly across midnight.
- Repeat last log: duplicates the newest non-note event into a prefilled editable form
  with a fresh timestamp.
- Multi-timer display: all of a baby's running/paused timers render simultaneously.
- Entry time correction: the edit sheet now lets you fix date and clock time; future
  timestamps and malformed dates are rejected.
- Live timer badges: pause/resume, side switch, finish controls (44dp targets).
- Unit tests for segment timers (pause/resume/side-switch/sanitisation), unit conversion,
  repeat-last logic and extended validation — 51 tests total, all passing.

### Changed
- Data schema v2: active timers persist `segments` JSON + `lastSide`; SQLite migration
  v1→v2 backfills existing timers as a single running segment (no data loss).
- Canonical mL enforced at every save boundary; oz is input/display-only.
- `stopTimer` accepts extras (duration override, amount, side, note) used by the pump
  finish flow; timer stop always derives duration from segments.

### Fixed
- Side-switch memory now updates on both switch paths; timers always carry ≥1 valid
  segment after sanitisation.

### Known limitations
- No rendered-browser or device verification in this environment (see RELEASE_EVIDENCE.md).
- Insights, multi-profile switcher, CSV export and native import remain unbuilt.

## 0.1.0 — 2026-10-17 (PROMPT A vertical slice)

### Added
- Welcome screen and no-account onboarding (nickname + birth date).
- Today dashboard: greeting, baby age, last-feed/diaper/sleep status band, live timer ring,
  quick-log dock (diaper, bottle, breast left/right, sleep), note button, confirmation toasts.
- Persistent storage: expo-sqlite on native, IndexedDB on web, behind one `CareRepository`
  interface; validated loads, corrupt rows skipped safely.
- Journal ribbon grouped by day with tap-to-edit and delete-with-confirmation.
- Care handoff letter (12 h / 24 h) built from real recorded events, with copy and share.
- Settings: night mode, JSON export, JSON import (web), demo mode, erase all.
- Demo mode with clearly-marked synthetic data, isolated from personal records.
- Unit tests for time arithmetic, zod validation and demo isolation.
- Documentation: README, AGENTS, PROJECT_SPEC, FEATURE_STATUS, RELEASE_EVIDENCE.
- `metro.config.js` to support the expo-sqlite web `.wasm` asset during web export.

### Fixed (preview diagnostic pass)
- DM Sans and Fraunces are now actually loaded at startup via `expo-font`.
- Removed an unused component indirection in the Today screen's imports.

### Known limitations
- Native import requires a file picker (pending); web import works.
- No device-level verification yet (timers across timezone change, TalkBack, APK).
