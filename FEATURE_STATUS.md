# FEATURE_STATUS.md

Last updated: 2026-10-17 (Phase B — complete essential care logging)

## Working (implemented and persisted)

| Feature | Status |
| --- | --- |
| Welcome + no-account onboarding | DONE — nickname/birth date, validated, persisted |
| Today dashboard | DONE — greeting, age, last feed/diaper/sleep band, event ribbon |
| Diaper quick log | DONE — wet/dirty/both + optional note; repeat-last prefill |
| Bottle quick log | DONE — canonical mL, mL/oz toggle with live conversion, breast milk/formula/mixed |
| Breastfeeding timers | DONE — segment-based: pause/resume, side switching, last-side memory, manual correction, history |
| Pumping | DONE — dock timer with finish sheet (amount/side/note), manual entry, editable history |
| Sleep | DONE — start/pause/resume/stop timer, manual past entry, overnight-safe (timestamp math), restart-safe |
| Tummy time | DONE — persistent stopwatch + manual entries + history |
| Solids | DONE — food, quantity, reaction (observed, not a diagnosis), notes |
| Repeat last log | DONE — newest non-note event, prefilled editable form, fresh timestamp |
| Multi-timer display | DONE — all active timers render as badges simultaneously |
| Entry editing | DONE — every event editable, including time correction (date + hh:mm, future rejected) |
| Journal ribbon | DONE — grouped by day, tap for edit/delete with confirm |
| Care handoff | DONE — 12h/24h letter from real data, copy + share |
| Night mode | DONE — day/midnight themes via Settings |
| JSON export / import (web) | DONE — validated, schema v2 |
| Demo mode | DONE — synthetic, labelled, fully isolated; exiting removes it |
| Erase all data | DONE — with confirmation |
| Bundled fonts | DONE — DM Sans + Fraunces loaded in root layout |
| Unit tests | 51 passing (time, timers/segments, validation, repeat, demo isolation) |

## Explicitly not yet built (pending future prompts)

| Feature | Status |
| --- | --- |
| Insights (7d/30d) | NOT STARTED |
| Tamil/Hindi localization | NOT STARTED (architecture documented) |
| Multiple baby profiles + switcher | NOT STARTED (isolation by babyId already enforced) |
| CSV export | NOT STARTED |
| Import on native | BLOCKED — needs file picker; web import works |
| Real-device verification (APK, timers, TalkBack) | BLOCKED — no device in this environment |
| Rendered browser smoke test | BLOCKED — no browser/screenshot tool here; bundle-level verification passed (see RELEASE_EVIDENCE.md) |

## Verification evidence

- `npm run typecheck` — exit 0 (strict, re-run after every change)
- `npm test` — exit 0, 51/51 tests pass (6 files)
- `npx expo export --platform web` — exit 0; the exported entry bundle contains the new
  Phase B flows (solids form, pump finish, repeat-last) verified by bundle string search
- No rendered-browser or device run was possible in this environment.
