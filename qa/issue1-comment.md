## Evidence update — 2026-10-29 (release branch `release/ninninest-safety-zcode-20261026` @ `82abf95`)

**Closed from this issue's list:**
- Fresh-install timer failure (P0): the `active_timers` CREATE TABLE lacked the v2 `segments`/`lastSide` columns — fixed in the DDL plus an unconditional PRAGMA-guarded repair; verified on device (timer starts and persists).
- Silent TypeError on native record creation (P0): Hermes has no `crypto.randomUUID`; a cross-runtime `uuid()` helper was added and all 13 call sites migrated; onboarding verified on device.
- Settings import UX (P0 family): plan-time validation, staged media restore with URI re-linking, bounded imports (64 MB cap), tampered-media rejection — merge import, merge idempotence, tampered rejection, and fresh-install restore with embedded photo rendering were all verified on an API 37 emulator with the exact-HEAD APK (SHA-256 `3209bc97…` from `761f46d` and `79b48a02…` from `57cb01d`, each byte-verified against the runner-reported hash).
- Removed-Clipboard crash in Handoff Copy → migrated to `expo-clipboard`.
- Return-user routing: cold start now opens Today when a profile exists (previously one tap away from a duplicate profile).

**Still open (kept honestly, not claimed fixed):**
- Notification delivery on a device is NOT yet verified: scheduling logic is unit-tested and the permission grant is device-verified, but adb-driven form automation proved unreliable for the delivery pass — recommend UI Automator/Appium.
- On-device CSV export capture, reboot recovery, and a physical-hardware pass remain untested.
- Zod 4.6.7 oversized-collection advisory: no 4.x fix exists; mitigated by bounded imports (64 MB cap + per-collection caps, covered by dedicated regression tests). Build-toolchain advisories (shell-quote / node-forge / ws via the expo CLI) are not runtime-reachable.

CI is green on the public repo's hosted runners (strict typecheck + 266/266 tests + web export + advisory report); every push to the release branch produces a SHA-256-verified QA APK artifact. Evidence: `RELEASE_EVIDENCE.md`, `qa/PROGRESS_LEDGER.md`, screenshots in `qa/screenshots/`. Keeping this issue open until notification delivery and a physical-device pass are verified.
