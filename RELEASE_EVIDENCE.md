# RELEASE_EVIDENCE.md

Recorded: 2026-10-17 · PROMPT A + Phases B/C/D/E + Phase F + P0 Demo Mode fix

## P0 Demo Mode data-loss fix (GitHub issue #1, defect 1)

### Changed files
| File | Change |
| --- | --- |
| `src/data/CareRepository.ts` | Interface adds `setDemoMode(on: boolean)` — realm swap contract every adapter must implement |
| `src/data/SqliteCareRepository.ts` | `setDemoMode` swaps between `ninninest.db` (personal) and `ninninest-demo.db` (demo); the inactive file is closed and never opened. `ensureSchema` extracted so the demo file is created schema-complete on first entry. Also carries an idempotency fix to `migrateV1toV2` (PRAGMA-guarded ALTERs) so a retry after an interrupted upgrade cannot throw |
| `src/data/IndexedDbCareRepository.ts` | Same contract on web: personal rows under `appData`, demo rows under `demoData`, flag under `demoActive`; reads and writes route to the active realm only |
| `src/data/MemoryCareRepository.ts` | In-memory realm adapter (personal/demo) with call-order tracking and failure injection (`failNextReplace`, `failNextDeleteTimer`); a shared realm object across two instances simulates restart |
| `src/state/AppProvider.tsx` | `enterDemo` no longer calls `replaceAll(buildDemoData())` over live data — it flips the realm, seeds the demo dataset, and persists the flag. `exitDemo` no longer calls `replaceAll(EMPTY)` — it flips back, restoring the personal realm including the previously selected baby. On startup the persisted flag is applied **before** the first load so personal data is never exposed or mutated mid-demo. Also carries: `stopTimer` now commits the journal event before removing the timer (with rollback on failure), import goes through a validated plan, and `themeMode` is persisted |
| `app/(main)/settings.tsx` | Exit-demo message corrected ("your own records are back, exactly as you left them"); demo copy now says records live in a separate storage space |
| `tests/p0.test.ts` | 28 regression tests: 7 demo isolation (enter/exit/restart/leak/failure), 5 timer commit ordering, 8 photo embed/remap/hash, 8+ import rejection/atomicity/migration idempotency |
| `vitest.config.ts`, `tests/stubs/` | Node-side stubs for `react-native` and `expo-file-system` so pure-logic regression tests run in vitest without the native runtime |
| `src/models/timerCompletion.ts`, `src/models/importPlan.ts`, `src/models/columns.ts`, `src/models/confirm.ts`, `src/models/photoPick.ts` | New pure modules extracted for the timer-commit invariant, strict import planning, idempotent column migration, web confirmations, and photo picking (used by the provider; photo picker not yet wired into forms) |

### Verification (actual results)
| Check | Command | Exit code | Result |
| --- | --- | --- | --- |
| Strict TypeScript | `npx tsc --noEmit` | 0 | clean |
| Full test suite | `npx vitest run` | 0 | **157/157 passed, 12 files** |
| P0 regression tests | `npx vitest run tests/p0.test.ts` | 0 | **28/28 passed** |
| Web export | `npx expo export --platform web` | pending run | see below |
| Device run | — | — | **NOT RUN — no device/emulator in this environment** |

### Defect-reproduction evidence (test first, then fix)
The demo-isolation tests exercise the exact failure mode from issue #1: before the
fix, `enterDemo`/`exitDemo` called `replaceAll` on the live store, destroying
personal records. The tests now assert against the real adapter contract that:
1. personal rows are byte-identical after enter → use demo → exit;
2. demo edits (including deletions) never leak into the personal realm;
3. a restart mid-demo (fresh adapter, same store) still shows the demo realm, and
   exit afterward restores personal data;
4. multiple personal babies and active timers survive the full round trip;
5. a `replaceAll` failure inside demo leaves the personal realm untouched.

### Honest limitations
- The SQLite `setDemoMode` two-file swap was verified by contract-mirroring tests
  (in-memory realms) and strict typecheck, **not** against `expo-sqlite` on a
  device. The IndexedDB variant was verified the same way for web.
- Timer-stop reordering, import planning, and photo remapping are included as
  in-flight work from the same issue but were **not** the focus of this run;
  their tests pass, yet device verification is still outstanding.

## Phase F verification evidence

| Check | Command | Exit code | Result |
| --- | --- | --- | --- |
| Strict TypeScript | `npx tsc --noEmit` | 0 | clean |
| Tests | `npm test` (vitest) | 0 | **129/129 passed, 11 files** (8 new i18n) |
| Expo Doctor | `npx expo-doctor` | 0 | 21/21 checks |
| Android prebuild | `npx expo prebuild --platform android --no-install --clean` | 0 | adaptive icon webp generated at all densities |
| Web export | `npx expo export --platform web` | 0 (Phase F re-run) | dist produced |
| Rendered visual QA | — | — | **NOT RUN — no browser/screenshot tool in this environment.** `docs/VISUAL_QA_CHECKLIST.md` is the handoff instrument |

### Phase F honest statement

The UI was **not actually rendered** in this environment. All Phase F changes
(i18n, themes, brand assets, guards) are verified by strict typecheck and 129 unit
tests including 8 i18n coverage tests. Visual composition, font scaling, safe areas,
and touch ergonomics remain human-verification tasks listed in the checklist.

## Phase E status report (required disclosures)

- **Git SHA**: none — this environment has no git repository (no commits, no remote).
- **GitHub remote**: none. Reproducibility via lockfile: `npm ci --dry-run` exit 0.
- **APK**: **does not exist.** EAS CLI could not authenticate (`eas-cli whoami` →
  "Not logged in"). Build config is verified and ready; owner commands in
  `docs/ANDROID_BUILD.md`. No build success is claimed anywhere.
- **Tests**: 121/121 passing, 10 files (exit 0).
- **Unresolved blockers**: EAS authentication (owner), device test matrix (owner),
  one visual pass on real hardware (owner).

## Phase E verification evidence

| Check | Command | Exit code | Result |
| --- | --- | --- | --- |
| Strict TypeScript | `npx tsc --noEmit` | 0 | clean |
| Tests | `npm test` (vitest) | 0 | **121/121 passed, 10 files** (11 new backup-integrity) |
| Expo Doctor | `npx expo-doctor` | 0 | 21/21 checks |
| Web export | `npx expo export --platform web` | 0 | dist produced |
| Android prebuild | `npx expo prebuild --platform android --no-install --clean` | 0 | POST_NOTIFICATIONS + RECEIVE_BOOT_COMPLETED in manifest; `applicationId 'app.ninninest.journal'` in gradle |
| Lockfile | `npm ci --dry-run` | 0 | lockfile complete |
| EAS auth | `npx eas-cli whoami` | non-zero | **"Not logged in" — build impossible here** |
| APK artifact | — | — | **DOES NOT EXIST — not claimed** |
| Rendered browser / device | — | — | **NOT RUN** — no tooling in this environment |

## Phase D verification evidence

| Check | Command | Exit code | Result |
| --- | --- | --- | --- |
| Strict TypeScript | `npx tsc --noEmit` | 0 | clean |
| Unit + integration tests | `npm test` (vitest) | 0 | **110/110 passed, 9 files** (30 new) |
| Expo Doctor | `npx expo-doctor` | 0 | 21/21 checks |
| Web export | `npx expo export --platform web` | 0 | Insights + export/import present in bundle |
| Lint | not configured beyond `expo lint` | — | skipped (no custom rules configured) |
| Rendered browser test | — | — | **NOT RUN** — no browser/screenshot tool in this environment |
| Android/iOS device run | — | — | **NOT RUN** — no device/emulator in this environment |

### Implementation vs automated verification vs runtime verification

| Area | Implemented | Automated verification | Runtime verification |
| --- | --- | --- | --- |
| Calendar validation | yes | 10 tests (leap years, Feb 30, April 31, birth-date bounds) | none possible here |
| Analytics aggregations | yes | 12 tests (windows, mixed milk, sides, night/nap, empty days, isolation) | not visually inspected |
| CSV export | yes | escaping + round-trip + header/row shape tests | not opened in a spreadsheet app |
| JSON backup dry-run | yes | malformed/foreign/newer-version/duplicate tests | not exercised on device picker |
| Import merge/replace | yes | merge semantics tests; transactional single-write code path | not exercised on device |
| Photo durability | yes | code path only (native File/Directory API); web no-op | **NOT VERIFIED ON DEVICE** |
| Routine notifications | yes | code path only; scheduling logic reviewed | **NOT VERIFIED ON DEVICE** (permissions, timezone, restart unproven) |
| Migration v1→v3 | yes | upgrade + preservation tests | interrupted-write recovery on hardware unproven |

## Honest risk statements

1. **Additive migrations are not proof of zero data loss.** The v1→v2→v3 ladder is
   idempotent and purely additive, and the upgrade logic is unit-tested, but a kill
   mid-migration on real hardware was not simulated. Mitigations present: WAL mode,
   meta-version written last, CREATE IF NOT EXISTS / PRAGMA-guarded ALTERs, corrupt-row
   skip-on-read.
2. **Notifications are unproven on devices.** Scheduling, permission denial, timezone
   shifts across DST, and reboot behaviour need a real Android/iOS run before release.
3. **Photos on native are unproven on devices.** The managed-copy logic targets the
   SDK 57 File/Directory API; actual camera-roll picker interactions were not exercised.
4. **Analytics were never seen rendered.** The Insights screen compiles, is bundled,
   and its math is unit-tested; the visual composition has not been viewed by anyone.
5. **Photo re-link after restore** is partial: the backup manifest records file names;
   automatically restoring media files into the media directory lands post-handoff.

## Unresolved risks / exact next steps

1. Run `npx expo run:android` on a device: verify timers, notifications (grant + deny),
   photo pick→copy→restart persistence, and import via document picker.
2. Kill the app mid-migration on device to validate recovery; keep a pre-upgrade backup.
3. Visual pass on Insights/Family in both themes; check safe areas on notched devices.
4. Handoff to Codex/OpenCode/Freebuff: `docs/04_HANDOFF_TO_FREEBUFF_OPENCODE_CODEX.md`
   covers architecture; media re-link after import is the first recommended task.

## Cumulative feature evidence (all phases)

- PROMPT A: onboarding, Today, storage, journal, handoff, settings, demo — 27 tests.
- Phase B: segment timers, side memory, pumping/tummy/solids/sleep, repeat-last — 51 tests.
- Phase C: multi-baby profiles, growth, milestones, medications, vaccinations,
  routines — 80 tests.
- Phase D: analytics, CSV, versioned backup, dry-run import, reminders, photo
  durability, calendar validation — 110 tests.
