# FEATURE_STATUS.md

Last updated: 2026-10-17 (PROMPT A slice + preview diagnostic pass)

## Working (implemented and persisted)

| Feature | Status |
| --- | --- |
| Welcome + no-account onboarding | DONE — nickname/birth date, validated, persisted |
| Today dashboard | DONE — greeting, age, last feed/diaper/sleep band, event ribbon |
| Diaper quick log | DONE — wet/dirty/both + optional note |
| Bottle quick log | DONE — mL + milk type, validated |
| Breastfeed L/R timers | DONE — timestamp-based, persisted across restart |
| Sleep timer | DONE — timestamp-based |
| Notes | DONE |
| Journal ribbon | DONE — grouped by day, tap for edit/delete with confirm |
| Care handoff | DONE — 12h/24h letter from real data, copy + share |
| Night mode | DONE — day/midnight themes via Settings |
| JSON export | DONE — web download; native uses share sheet (long-history caveat) |
| JSON import (web) | DONE — validated, rejects malformed files |
| Demo mode | DONE — synthetic, labelled, fully isolated; exiting removes it |
| Erase all data | DONE — with confirmation |
| Bundled fonts (DM Sans + Fraunces) | DONE — loaded in root layout; previously referenced but never loaded |
| Unit tests | 27 passing (time, validation, demo isolation) |

## Explicitly not yet built (BLOCKED / pending future prompts)

| Feature | Status |
| --- | --- |
| Pump logging UI (timer restore exists in model) | PENDING — model supports it, no sheet yet |
| Tummy-time quick log | PENDING — model supports it, no button yet |
| Solids quick log | PENDING — model supports it, no button yet |
| Repeat previous log | NOT STARTED |
| mL/oz toggle in forms | NOT STARTED (conversion helpers exist + tested) |
| Insights (7d/30d) | NOT STARTED |
| Tamil/Hindi localization | NOT STARTED (architecture documented) |
| Multiple baby profiles + switcher | NOT STARTED (isolation by babyId already enforced) |
| CSV export | NOT STARTED |
| Import on native | BLOCKED — needs file picker; web import works |
| Real-device verification (APK, timers, TalkBack) | BLOCKED — no device in this environment |
| Rendered browser smoke test (journeys, refresh persistence, night mode) | BLOCKED — this environment has no browser/screenshot tool; bundle-level static verification passed. See RELEASE_EVIDENCE.md |

## Verification evidence

- `npm run typecheck` — exit 0 (re-verified after every change)
- `npm test` — exit 0, 27/27 tests pass
- `npx expo export --platform web` — exit 0, bundles produced in `dist/`, including font TTFs
- `npx expo start --web` probe — server boots, HTTP 200 on root, bundle compiles clean
- Bundle content check — all 6 screens' code present in exported JS, IndexedDB repo included
- No browser-rendered or device run was possible in this environment.
