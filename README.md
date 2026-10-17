# NinniNest

**Know what happened. Share what matters. Rest easier.**

A local-first baby-care journal and caregiver handoff app built with Expo, React Native and
Expo Router in strict TypeScript. Original "Quiet Observatory" design — a calm, editorial
paper-journal feel with a warm night mode for 3 AM use.

## What works in this vertical slice

- **No-account onboarding** — nickname + date of birth only, stored on the device.
- **Today dashboard** — greeting, baby age, last feed / diaper / sleep band, live timers
  with pause/resume/side-switch.
- **Quick logging** — diaper (wet/dirty/both), bottle (mL + milk type), breastfeed
  left/right timers, sleep, pumping, tummy time, solids, free-text notes. Everything
  persists.
- **Journal** — full chronological ribbon grouped by day, with edit and delete (with confirm).
- **Family features** — multiple baby profiles, growth tracking, milestones & memories
  with photos, medication administration records, vaccinations, weekly routine reminders.
- **Insights** — Today/7-day/30-day analytics built only from real records; no
  interpolation, no medical interpretation.
- **Care handoff** — a letter-style summary built only from recorded events for a 12 h or
  24 h window, with copy and share.
- **Data portability** — CSV export, and a versioned JSON backup that includes photos
  (hash-verified on restore), with dry-run validation and merge/replace import.
- **Settings** — night mode, exports, imports, demo mode, erase all.
- **Demo mode** — clearly-labelled synthetic data, fully isolated from personal records.

## Architecture

- `app/` — Expo Router screens (`index`, `onboarding`, `(main)/today|journal|handoff|family|insights|settings`).
- `src/design` — design tokens and the day/night ThemeProvider.
- `src/models` — types, zod validation, pure time/date helpers, synthetic demo data.
- `src/data` — `CareRepository` interface with a native **expo-sqlite** adapter and a web
  **IndexedDB** adapter. Same typed contract on both platforms.
- `src/state` — `AppProvider` glues repository, theme mode, and demo-mode isolation.
- `src/components`, `src/screens` — shared UI (event ribbon, live timer, forms, edit sheets).

Timers persist as timestamps, so elapsed time is computed on resume — never from an interval
counter. Invalid or corrupted records are skipped at load time rather than crashing the app.

## Commands

```bash
npm run typecheck   # strict TypeScript
npm test            # vitest unit tests
npm run lint        # expo lint
npm run build:web   # static web export (dist/)
```

Web export requires the bundled `metro.config.js` (adds `.wasm` asset support for expo-sqlite).

## Honest status

Feature-complete through Phase E: care logging, timers, multi-baby family features,
analytics, CSV export, and photo-inclusive v4 backups with hash-verified restore.
Remaining work is tracked in `FEATURE_STATUS.md` and `docs/KNOWN_LIMITATIONS.md`.
No APK has been produced (EAS authentication unavailable in the build environment) —
owner build commands are in `docs/ANDROID_BUILD.md`, and the device verification
checklist is `docs/DEVICE_TEST_MATRIX.md`. Sleep/breast timers restore from persisted
timestamps and were unit-tested for the underlying maths, but cross-timezone behaviour
on a real device still needs manual verification.

## Free-forever promise

Essential tracking, history access, export and erase are free. No account, no ads, no
hidden subscription, no cloud dependency for local mode.
