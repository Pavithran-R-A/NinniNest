# FEATURE_STATUS.md

Last updated: 2026-10-17 (Phase C — family and child development)

## Working (implemented and persisted)

| Feature | Status |
| --- | --- |
| Welcome + no-account onboarding | DONE |
| Today dashboard + Phase A/B logging | DONE — diaper, bottle (mL/oz), breast timers, pump, sleep, tummy time, solids, notes, repeat-last, multi-timer badges |
| Entry editing incl. time correction | DONE |
| Journal ribbon + Care handoff | DONE |
| Night mode, JSON export/import (web), demo mode, erase all | DONE |
| **Multiple baby profiles** | DONE — create/edit/switch/delete via the Family tab; optional photo field; per-baby preferred units; deletion erases all 9 tables for that baby with confirmation; active-baby choice persists across restarts; switching never touches other babies' timers |
| **Growth tracking** | DONE — weight (canonical grams), length/height and head circumference (canonical cm), kg/lb and cm/in toggle per profile, dated editable history, descriptive trends. Percentile curves explicitly NOT implemented (no validated licensed WHO dataset wired in) |
| **Milestones and memories** | DONE — 6 categories incl. custom, custom titles/notes, editable dates, photo attachment persisted (app-managed file URI on native / data URL on web), chronological year-grouped journal |
| **Medication administration records** | DONE — user-entered names/instructions/doses (mL/mg/drops/tablets), explicit "Given now" recording, today's doses shown per medication, last 5 doses listed and individually correctable. No dose calculation or suggestions |
| **Vaccination history** | DONE — name, date given, optional next appointment, provider, notes. No schedule claims |
| **Daily routines** | DONE — recurring templates for feed/nap/pump/tummy time/reminders with day-of-week chips and 24h local time; templates never create journal entries (explicit contract in UI and code) |
| **Quiet Observatory composition** | DONE — Family hub with segmented tab panel (Profiles/Growth/Milestones/Health/Routines), baby switcher chips, cards on surface tints, Fraunces display headline, ≥44dp targets, full night-mode support |
| Unit tests | **80 passing** (8 files): time, timers/segments, validation ×2, repeat, demo, phase C (isolation, growth units, milestones, meds, vaccines, routines/timezone), migration (fresh install, v1→v2 backfill, v2→v3 preservation) |

## Part A audit results (this pass)

- `npx expo-doctor` — initially 1 failure: expo-sqlite 58.0.13 vs expected ~57.0.4. Fixed by
  installing expo-sqlite@~57.0.4; now **21/21 checks passed**.
- Web bundle audit — entry JS contains IndexedDB repo and zero WASM; the wa-sqlite/worker
  asset is emitted as a separate lazily-fetched file and never imported by the web entry.
  IndexedDB remains a genuinely independent implementation.
- Migration testing — verified via `tests/migration.test.ts` (fresh v3 install; legacy
  single-start timer backfill to one running segment; v2→v3 preserves babies, timer
  segments and lastSide) and by the SQLite `init()` migration ladder (v1→v2→v3, idempotent
  `CREATE TABLE IF NOT EXISTS`, `PRAGMA table_info` column checks before ALTER).
- Web preview — still not possible in this environment (no browser/screenshot tool; see
  RELEASE_EVIDENCE.md). Documented as a limitation, not claimed as a visual test.

## Explicitly not yet built (pending future prompts)

| Feature | Status |
| --- | --- |
| Growth percentile reference curves | INTENTIONALLY OMITTED — requires validated, correctly licensed WHO dataset and age/sex logic; descriptive trends provided instead |
| Insights (7d/30d) | NOT STARTED |
| Tamil/Hindi localization | NOT STARTED (architecture documented) |
| CSV export | NOT STARTED |
| Import on native | BLOCKED — needs file picker; web import works |
| Real-device verification (APK, timers, TalkBack) | BLOCKED — no device in this environment |
| Rendered browser smoke test | BLOCKED — no browser/screenshot tool here; bundle-level verification passed (see RELEASE_EVIDENCE.md) |

## Verification evidence

- `npm run typecheck` — exit 0 (strict)
- `npm test` — exit 0, **80/80 tests pass** (8 files)
- `npx expo export --platform web` — exit 0
- `npx expo-doctor` — exit 0, 21/21 checks
- No rendered-browser or device run was possible in this environment.
