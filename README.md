# NinniNest

**Know what happened. Share what matters. Rest easier.**

A local-first baby-care journal and caregiver handoff app built with Expo, React Native and
Expo Router in strict TypeScript. Original "Quiet Observatory" design — a calm, editorial
paper-journal feel with a warm night mode for 3 AM use.

## What works in this vertical slice

- **No-account onboarding** — nickname + date of birth only, stored on the device.
- **Today dashboard** — greeting, baby age, last feed / diaper / sleep band, live timer.
- **Quick logging** — diaper (wet/dirty/both), bottle (mL + milk type), breastfeed left/right
  timers, sleep timer, free-text notes. Everything persists.
- **Journal** — full chronological ribbon grouped by day, with edit and delete (with confirm).
- **Care handoff** — a letter-style summary built only from recorded events for a 12 h or 24 h
  window, with copy and share.
- **Settings** — night mode, JSON export, JSON import (web), demo mode, erase all.
- **Demo mode** — clearly-labelled synthetic data, fully isolated from personal records.

## Architecture

- `app/` — Expo Router screens (`index`, `onboarding`, `(main)/today|journal|handoff|settings`).
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

This is the first working vertical slice (PROMPT A). Remaining work is tracked in
`FEATURE_STATUS.md`. Native Android/iOS behaviour is unverified — no device build has been
made from this environment. Sleep/breast timers restore from persisted timestamps and were
unit-tested for the underlying maths, but cross-timezone behaviour on a real device still
needs manual verification.

## Free-forever promise

Essential tracking, history access, export and erase are free. No account, no ads, no
hidden subscription, no cloud dependency for local mode.
