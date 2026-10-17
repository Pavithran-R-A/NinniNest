# CHANGELOG

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
- Unit tests for time arithmetic, zod validation and demo isolation (27 tests).
- Documentation: README, AGENTS, PROJECT_SPEC, FEATURE_STATUS, RELEASE_EVIDENCE.
- `metro.config.js` to support the expo-sqlite web `.wasm` asset during web export.

### Fixed (preview diagnostic pass)
- DM Sans and Fraunces are now actually loaded at startup via `expo-font`; screens
  referenced them before, but no font was ever registered, so any rendered preview would
  have fallen back to system fonts.
- Removed an unused component indirection in the Today screen's imports.

### Known limitations
- Pump, tummy-time and solids flows are modelled but have no quick-log UI yet.
- Native import requires a file picker (pending); web import works.
- No device-level verification yet (timers across timezone change, TalkBack, APK).
