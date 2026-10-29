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

Feature-complete through 0.9.1 (2026-10-29): care logging, timers with wall-clock
restart persistence, multi-baby family features, analytics, CSV + zipped CSV export,
photo-inclusive v5 backups (genuine SHA-256 of decoded bytes, versioned hash metadata),
a staged crash-recoverable restore, and full en/Tamil form localization.

**Android is real**: an installable QA APK is built on GitHub-hosted runners from every
push to the release branch (`.github/workflows/android-qa-build.yml`, debug-signed,
SHA-256 recorded in the run summary). Device verification on an API 37 emulator covers
onboarding, quick-log, timers across force-stop, photo pick/persist, multi-baby
backup/restore with embedded photos, tampered-backup rejection, and returning-user
routing — see `docs/DEVICE_TEST_MATRIX.md` for the row-by-row VERIFIED/NOT TESTED record
and `RELEASE_EVIDENCE.md` for provenance. Remaining device rows (notification delivery,
reboot recovery, physical-hardware pass) are tracked in `docs/KNOWN_LIMITATIONS.md`.

CI runs strict typecheck, the full Vitest suite (266 tests), the web export, and a
dependency-advisory report on every push. `docs/ANDROID_BUILD.md` documents how the
NDK/toolchain is pinned via the versioned `plugins/withNdkVersion` config plugin.

## Free-forever promise

Essential tracking, history access, export and erase are free. No account, no ads, no
hidden subscription, no cloud dependency for local mode.
