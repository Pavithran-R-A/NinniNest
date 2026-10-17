# Export & handoff — how to take NinniNest out of Bolt

## Why an export procedure

This environment has no git repository (no commits, no SHA, no remote). Reproducibility
comes from the dependency lockfile plus this procedure.

## Reproducibility evidence

- `package-lock.json` present; `npm ci --dry-run` exits 0 (lockfile complete).
- `npm run typecheck` exit 0 · `npm test` exit 0 (121/121) · `expo-doctor` 21/21
  exit 0 · `npx expo export --platform web` exit 0 (all run 2026-10-17, Phase E).

## Export steps (owner)

1. Use Bolt's **Export / Download** action to download the project ZIP (or connect a
   GitHub repository from the Bolt project page, which creates the missing remote).
2. Unzip locally; then:

```bash
npm ci            # exact dependency install from the lockfile
npm run typecheck # must exit 0
npm test          # must be 121/121
npx expo-doctor   # must be 21/21
```

If all four pass, the export is faithful. Then follow `docs/ANDROID_BUILD.md` for the
APK.

## What the receiving developer needs to know first

- Read `AGENTS.md` (working rules) and `docs/01_PROJECT_KNOWLEDGE.md`.
- Architecture: `app/` routes · `src/data` repository pattern (SQLite native /
  IndexedDB web behind `CareRepository`) · `src/models` pure logic + zod validation ·
  `src/design` tokens/ThemeProvider · `src/state` AppProvider.
- Tests use vitest and must never import React Native modules; pure logic lives in
  dependency-free files (e.g. `src/models/hash.ts`).
- First recommended tasks: run the device matrix (`docs/DEVICE_TEST_MATRIX.md`),
  then photo re-link edge cases after import, then Play Store signing.
- Non-negotiables: local-first (no accounts/cloud/ads), no medical advice or dose
  math, timestamps always UTC ISO, demo data stays isolated, backup imports always
  dry-run first and replace is a single transaction.

## Tool guidance for Codex / OpenCode / Freebuff

- Keep the existing conventions; do not introduce a second styling system.
- Extend the migration ladder (schema v3 → v4+) additively; never rewrite tables.
- Run the three gates after every slice and report real exit codes.
