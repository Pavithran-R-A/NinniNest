# RELEASE_EVIDENCE.md

Recorded: 2026-10-26 · Stage 2B (independent safety hardening) · prior: Stage 2 (staged backup restore + SHA-256, same day), Stage 1 fix (2026-10-18), Phases B/C/D/E/F + P0 Demo Mode fix

## Stage 2B — independent safety hardening (this run)

Base: `88a7689ba4e2803912b93f8a18ed60996d1a0507` (remote-verified equal to origin
before work started; `main` untouched at `4902b47e`). Four validated commits,
pushed and re-verified after each push.

### Defects reproduced and repaired
1. **Digest checked only when present** (`planImport`): a v5 entry with bytes
   but NO `sha256`, or with a legacy-style checksum and no `hashAlgo`, was
   accepted unverified. Now: v5 requires `hashAlgo:'sha256'` + 64-hex digest +
   integer byte length matching the decoded payload + canonical base64
   (`decodeBase64Strict` — rejects padding/whitespace/nonzero-trailing-bit
   variants); unsupported algorithms and version/algorithm combinations are
   hard errors; v4 media without any checksum is rejected as unverifiable.
2. **Partial-write orphans in `createMediaPort`**: staged files were tracked
   AFTER the fallible write, so a failed `write()` left an untracked file (only
   the next launch sweep would catch it). Now tracked BEFORE the write;
   rollback reaches partial writes.
3. **Same-millisecond name collisions**: staged/promoted names used
   `Date.now()` + `Math.random()` fragments; now `crypto.randomUUID()`.
4. **Silent rollback failures**: `rollback()` swallowed delete errors; it now
   returns a failure count surfaced to the user.
5. **Orphaned media accumulated forever**: `cleanupOrphansForBaby` /
   `collectBabyMediaUris` in `media.ts` had **zero callers** — the Stage 2
   comment claiming crashed imports' promoted files "are reclaimed by per-baby
   cleanup" promised recovery that did not exist. Replace imports now sweep
   unreferenced files in imported babies' directories and remove directories
   of profiles the user's confirmed replace erased (computed from pre-import
   data, so concurrently-created records are untouched); merge cleans nothing;
   failures surface on the result.
6. **DEFERRED import transaction**: a concurrent quick-log/timer write could
   join the open import transaction and vanish on rollback. `replaceAll` now
   runs `withExclusiveTransactionAsync` with the transaction handle throughout
   (insert helpers refactored onto a shared Runner type).
7. **Timer completion kill-window**: event insert and timer delete were two
   separate writes with only best-effort compensation. New optional
   `completeTimerAtomic` (SQLite exclusive tx; IndexedDB single keyed put) is
   preferred by `commitTimerCompletion`; the compensating fallback remains for
   adapters without the capability.
8. **Silent refresh failure**: a failed post-commit UI refresh was swallowed;
   now reported (en+ta: "reopen the app if something looks stale").

### Environment findings
- `pnpm-lock.yaml` appeared during the previous session (created 21:07 IST by
  an npx invocation; a mechanical mirror of the current package.json
  resolutions — no hand-authored content). Investigated and deleted; npm via
  `package-lock.json` remains the only package manager.
- **Photo producer gap**: no image picker is wired into any screen. `media.ts`
  (durability copies per AGENTS.md rule 12) and the whole backup photo
  pipeline have no UI producer on native — real-device backups would contain
  zero photos. Recorded as the top product backlog item (does not affect the
  safety properties of the restore path itself).
- CI: run `40351509389` remains **FAILED before any step executed** — GitHub
  reports the account's payments/spending-limit status as the blocker. This is
  an infrastructure blocker; CI must NOT be labelled green. Workflow updated
  to Node 22 (SDK 57 requirement) so the next enabled run is correct.

### Verification (actual results, this machine)
| Check | Command | Exit code | Result |
| --- | --- | --- | --- |
| Strict TypeScript | `npm run typecheck` | 0 | clean |
| Full test suite | `npm test` | 0 | **225/225 passed, 17 files** (was 188 — 37 new) |
| Focused new suites | `v5Integrity` 17, `mediaPort` 11, `timerAtomic` 5, hygiene 4 | 0 | all confirmed failing before their fixes (or testing new behaviour) |
| Web export | `npx expo export --platform web` | 0 | dist/ regenerated |
| SDK compatibility | `npx expo-doctor` | 1 | 1 informational failure only: CNG sync notice because the locally generated (uncommitted) `android/` dir exists — expected for the prebuild workflow; version-drift check passes |
| Remote parity | `git ls-remote origin` after each push | 0 | verified equal to local HEAD after every push |
| Real SQLite/IndexedDB execution | — | — | **NOT TESTED** — no device/emulator in this environment; SQLite paths are typechecked, contract-tested via in-memory adapters, and require `expo-sqlite` at runtime |
| Android APK | — | — | **NOT PRODUCED.** Feasibility: NDK 27.2 installed, wrapper 9.3.1 present, prebuild + local.properties ready — but only ~2.4 GB free (gradle needs ≥6 GB headroom). No build attempted this phase per instructions. |
| Emulator/device run | — | — | **NOT RUN** (instructions: no emulator launches this phase) |

### Honest scope statement
- All filesystem/transaction behaviour is verified through the real state
  machines with injected fakes plus contract-level repository adapters. That
  is NOT device evidence: real `expo-sqlite` exclusive transactions, real
  `expo-file-system` staging, permission denial and low-storage behaviour stay
  in `docs/DEVICE_TEST_MATRIX.md` as NOT TESTED.
- DB + files are still not one atomic transaction (impossible); recovery
  remains staged and is now *actually* wired: staging sweeps at
  launch/import-start, hygiene sweep after commit, rollback failure counts.
- No crash-recovery claim rests on a comment alone anymore: every recovery
  path named here has a test asserting the file/record outcome.

## Stage 2 — staged, crash-recoverable backup restore (2026-10-26)

Environment: recovery session on the owner's Windows machine (ZCode, GLM-5.3-Flash
via zai-start-plan). The repository was cloned fresh from
`https://github.com/Pavithran-R-A/NinniNest.git` at the independently verified
`main` HEAD `4902b47e482523dbd7e2b1e5116fb381eb691df3`; all work below was
committed on the dedicated branch
`release/ninninest-safety-zcode-20261026` (base = that SHA) and pushed with the
remote commit SHA verified afterwards. No force push; `main` untouched.

### Defects closed (GitHub issue #1 Stage 2 residuals)
1. `runBackupImport` committed the database BEFORE restoring media → replaced by
   `runStagedBackupImport` (new `src/models/backupRestore.ts`): verify → stage →
   promote → single transactional DB commit → cleanup.
2. Photo URI mappings never applied back to records → restored files are now
   re-linked onto baby/milestone `photoUri` fields; milestone photos land in the
   owning baby's managed directory (per-baby orphan cleanup scope).
3. Individual photo failures silently skipped → every payload is verified and
   staged before any write; a failure aborts the whole import with nothing
   written, and the UI distinguishes storage-failure from rollback.
4. `sha256` metadata was a noncryptographic FNV-style checksum of the base64
   TEXT → v5 backups carry `hashAlgo: 'sha256'` with a genuine SHA-256 of the
   decoded original bytes (pure-TS FIPS 180-4, cross-checked against Node
   `node:crypto` in tests). v4 archives verify under explicit `legacy-fnv`
   semantics and are never reinterpreted.
5. Export could silently omit unreadable media → `buildFullBackupWithReport`
   returns per-photo missing references, writes `mediaComplete: false` +
   `missingPhotos` into the JSON, and the Settings message declares the backup
   incomplete.

### Changed files
| File | Change |
| --- | --- |
| `src/models/hash.ts` | Added dependency-free `sha256Hex` (FIPS 180-4) + base64 codecs; `hashContent` documented as the legacy checksum kept only for v4 verification. |
| `src/models/backup.ts` | `BACKUP_VERSION` 4 → 5; `hashAlgo`/decoded `bytes` on photo entries; `mediaComplete` + `missingPhotos` on the backup envelope. |
| `src/models/mediaBackup.ts` | `buildFullBackupWithReport` (completeness report, injectable reader for tests); `MediaPort` contract + native expo-file-system port (quarantine `.staging`, promote into per-baby dirs, rollback only created files, `isManagedUri`) + web no-op port; v5 exports use genuine SHA-256; legacy restore helpers marked deprecated. |
| `src/models/importPlan.ts` | Versioned hash verification (`sha256` vs `legacy-fnv`); hard errors for orphan/duplicate/unsafe manifest entries; warnings for media-incomplete backups and records-only dangling references; `runBackupImport` kept as the deprecated records-only path. |
| `src/models/backupRestore.ts` | NEW: staged workflow (`runStagedBackupImport`) + `sweepImportStaging` launch recovery; documented crash semantics (staging wiped, promoted orphans reclaimed by per-baby cleanup; DB and files are explicitly NOT one atomic transaction). |
| `app/(main)/settings.tsx` | Export uses the completeness report; import runs the staged workflow with the native media port and maps outcomes to honest localized messages (complete / incomplete / records-only / storage-failed / rolled-back). |
| `src/state/AppProvider.tsx` | Launch-time staging sweep on native. |
| `src/i18n/strings.ts` | 9 new Settings message keys in English and Tamil. |
| `tests/backupRestore.test.ts` | NEW: 21 regression tests covering the 16 milestone scenarios (fresh-device restore + re-linking, URI remap ownership, export missing-photo report, corrupted bytes, SHA-256 vectors + tamper rejection, unwritable dir, staged/promote failure, DB-failure rollback preserving pre-existing media, cleanup scope, interrupted-import recovery, merge vs replace, identical names across babies, duplicate/invalid refs, traversal names, legacy v4 semantics, repeated imports). |
| `tests/p0.test.ts` | Two photo fixtures now include the milestone record they reference (orphan manifest entries are hard errors as of this stage). |
| `vitest.config.ts` | `fileURLToPath` alias resolution (Windows fix) + `TZ: UTC` pin for deterministic day-window tests. |
| `package.json` / lockfile | `expo-image-picker` `^58.0.10` → `~57.0.20` (SDK 57 alignment; `^58` broke Android gradle autolinking with `Field 'version' is required ... Publication`); removed unused `@supabase/supabase-js`. |
| `.github/workflows/ci.yml` | NEW: typecheck + unit tests + web export on push/PR. |
| `FEATURE_STATUS.md`, `CHANGELOG.md`, `KNOWN_LIMITATIONS.md`, `DEVICE_TEST_MATRIX.md`, `docs/ANDROID_BUILD.md` | Status, notes and honest environment records updated. |

### Verification (actual results, this machine)
| Check | Command | Exit code | Result |
| --- | --- | --- | --- |
| Strict TypeScript | `npm run typecheck` | 0 | clean |
| Full test suite | `npm test` | 0 | **188/188 passed, 14 files** (was 167/167 — 21 new) |
| Focused new suite | `npx vitest run tests/backupRestore.test.ts` | 0 | 21/21 (confirmed failing before implementation) |
| Web export | `npx expo export --platform web` | 0 | dist/ regenerated |
| Remote parity (pre-work) | `git ls-remote origin refs/heads/main` | 0 | `4902b47e…` matched local HEAD exactly |
| Remote parity (post-push) | `git ls-remote origin refs/heads/release/ninninest-safety-zcode-20261026` | 0 | see commit note below — verified equal to local push |
| Android APK | `gradlew assembleRelease` | 1 | **NOT PRODUCED.** First failure: SDK-58 `expo-image-picker` broke autolinking (fixed in source). Second attempt aborted: gradle tried to download NDK 27.1 (~2.5 GB) while the drive had <3 GB free; project pointed at installed NDK 27.2, but disk headroom ran out before completion. Build steps and cleanup recorded in `docs/ANDROID_BUILD.md`. |
| Device/emulator run | — | — | **NOT RUN.** An emulator was booted for visual QA but the milestone pivoted to the backup-safety P0; visual QA remains on the device matrix. |

### Honest scope statement
- The media side of the workflow is exercised through an in-memory `MediaPort`
  in tests; the native `expo-file-system` port follows the exact same contract
  but **has not executed against a real device filesystem yet**. Real-SQLite +
  real-filesystem restore, permission denial and low-storage behaviour remain
  in `docs/DEVICE_TEST_MATRIX.md` as NOT TESTED.
- DB + file operations are documented as NOT a single atomic transaction (they
  cannot be); recovery is staged: pre-commit aborts leave old state untouched,
  post-commit crash leaves reclaimable orphans, staging sweeps at launch.
- Expo SQLite audit: `replaceAll` runs inside `withTransactionAsync` (single
  serialized connection, WAL). The import is the only writer while its modal
  confirmation is open, so a deferred transaction is sufficient; no exclusive
  transaction was added.
- `commitTimerCompletion` was audited, not changed: event-first, timer-second,
  compensating rollback — already regression-tested (P0-2).
- Known follow-up from issue #1 (not this milestone): native Copy in
  `handoff.tsx` uses the removed `react-native` Clipboard API and should move
  to `expo-clipboard` after the P0 safety items.

## Stage 1 fix — media restoration guard (2026-10-18)

### Defect
`app/(main)/settings.tsx` called `restoreEmbeddedPhotos(plan.photos)` unconditionally
after `applyImportPlan`, so a failed database write still triggered media restoration
and a UI refresh. Two failed-import messages also claimed records were "untouched" —
a claim the code could not verify.

### Changed files
| File | Change |
| --- | --- |
| `src/models/importPlan.ts` | Added `runBackupImport` workflow: database write first; photo restore + refresh run only if the write succeeded. Failed-import message no longer claims records were untouched. Success message states photo re-linking is not part of the restore. |
| `app/(main)/settings.tsx` | Import button now delegates to `runBackupImport`; removed the unconditional `restoreEmbeddedPhotos` call and the unverified catch-block claim. |
| `tests/importSafety.test.ts` | New regression test: with a rejected write, the media-restoration and refresh spies are never invoked; message reports the write failure. Updated the mid-write assertion to the new wording. |
| `tests/p0.test.ts` | Updated one assertion pinned to the old "untouched" wording. |
| `CHANGELOG.md`, `FEATURE_STATUS.md`, `RELEASE_EVIDENCE.md` | Release notes (0.6.2), status and this evidence updated. |

### Verification (actual results)
| Check | Command | Exit code | Result |
| --- | --- | --- | --- |
| Strict TypeScript | `npm run typecheck` | 0 | clean |
| Focused tests | `npx vitest run tests/importSafety.test.ts tests/p0.test.ts` | 0 | **38/38 passed** |
| Full test suite | `npm test` | 0 | **167/167 passed, 13 files** |
| Device run | — | — | **NOT RUN — no device/emulator in this environment** |

### Honest scope statement
- Media restoration is now correctly gated, but **photo relinking is still not
  implemented** (Stage 2): restored files land in the media directory, and records
  are not pointed at them; the UI says so explicitly on success.
- No git repository or GitHub remote exists in this environment (working directory
  is not a git repo), so no commit SHA can be produced here. This matches the
  Phase E disclosure; the change is delivered as file evidence in this repo
  snapshot for the owner to synchronize to Pavithran-R-A/NinniNest.

## Stage 1 — backup import validation repair (this run)

### Changed files
| File | Change |
| --- | --- |
| `app/(main)/settings.tsx` | Import flow rewritten: `dryRunParse` + hand-built merge/replace replaced by `planImport` + `applyImportPlan` (single transactional write). Explicit confirmation preserved for both modes. Embedded-photo file restore kept best-effort; result message no longer implies record re-linking. Removed dead imports (`dryRunParse`, `mergeData`, `buildBackup`, `localKeyOf`). |
| `tests/importSafety.test.ts` | New: 9 regression tests proving malformed imports (newer version, malformed records, duplicate event ids, orphaned references, corrupted photo hash) and a simulated mid-write `replaceAll` failure all leave existing records byte-identical; replace/merge success semantics asserted. |
| `FEATURE_STATUS.md`, `CHANGELOG.md`, `RELEASE_EVIDENCE.md` | Status, release notes (0.6.1) and this evidence updated. |

### Verification (actual results)
| Check | Command | Exit code | Result |
| --- | --- | --- | --- |
| Strict TypeScript | `npm run typecheck` | 0 | clean |
| Focused tests | `npx vitest run tests/importSafety.test.ts` | 0 | **9/9 passed** |
| Full test suite | `npm test` | 0 | **166/166 passed, 13 files** |
| Device run | — | — | **NOT RUN — no device/emulator in this environment** |

### Honest scope statement
- This stage closed the divergence between the two import paths: validation is now
  identical wherever an import happens, and rejection paths are proven
  non-destructive. **Photo restoration is still not end-to-end**: `applyImportPlan`
  writes records only, embedded photo files are written best-effort by
  `restoreEmbeddedPhotos`, and `remapEmbeddedPhotos` (pointing records at restored
  files) is not yet called on this path — that is Stage 2. No photo re-link claim is
  made anywhere in the UI.
- No git repository exists in this environment, so no branch or commit SHA can be
  reported; this matches the prior Phase E disclosure.

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
