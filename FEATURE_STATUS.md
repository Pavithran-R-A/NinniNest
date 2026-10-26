# FEATURE_STATUS.md

Last updated: 2026-10-26 (Stage 2 — staged, crash-recoverable backup restore; genuine SHA-256)

## Stage 2 — safe media-inclusive backup restore (2026-10-26)
| Aspect | Status |
| --- | --- |
| Staged restore ordering | DONE — embedded photos are integrity-verified, quarantined under the managed media area's `.staging` directory, and promoted into final per-baby locations BEFORE the single transactional `replaceAll` database commit. |
| Failure rollback | DONE — unwritable media, mid-stage/mid-promote failures, and rejected database writes all leave previous records and previously existing photos byte-identical; only files the failed import created are removed. |
| Photo re-linking | DONE — restored files are mapped back onto baby/milestone `photoUri` fields at import time; the Stage 1 "re-linking not included" limitation is closed. |
| Crash recovery | DONE — staging debris is swept at launch (`AppProvider` init) and before every import; promoted-but-uncommitted files are unique-named orphans reclaimed by per-baby cleanup. File/DB operations are documented as NOT one atomic transaction by design. |
| Genuine SHA-256 | DONE — v5 backups embed `hashAlgo: 'sha256'` + FIPS 180-4 digest of decoded original bytes (dependency-free implementation, cross-checked against Node crypto in tests); `bytes` is the decoded byte count. |
| Legacy v4 compatibility | DONE — v4-and-older checksums verified with the original noncryptographic algorithm (`legacy-fnv`), never reinterpreted; a v4 file whose checksum matches only as SHA-256 is rejected. |
| Manifest validation | DONE — orphan manifest refs, duplicate refs, and traversal-style file names are hard errors at plan time; ports sanitize to bare file names as defense in depth. |
| Export completeness | DONE — `buildFullBackupWithReport` records unreadable photos in `mediaComplete: false` + `missingPhotos`; the export message states incompleteness instead of claiming success. |
| Records-only honesty | DONE — imports without media clear dangling foreign photo references on records new to the device and say so; merge mode never rewrites existing records. |
| Messaging | DONE — Settings distinguishes complete / incomplete-photos / records-only / storage-failed (nothing written) / rolled-back outcomes in English and Tamil. |
| Verification | `npm run typecheck` exit 0; full suite **188/188, 14 files** (21 new in `tests/backupRestore.test.ts`); `npx expo export --platform web` exit 0. |

## Stage 1 fix — media restore gated on successful import (2026-10-18)
| Aspect | Status |
| --- | --- |
| Failed write stops workflow | DONE — the full import now runs through one workflow: database write first; media restoration and refresh run only on success. The actual failure is displayed. |
| Honest messaging | DONE — failed imports no longer claim records were "untouched"; photo-restore results explicitly state re-linking to records is not included (Stage 2). |
| Regression coverage | DONE — test proving that on a rejected write the media-restoration function is never invoked (and refresh is not called). |
| Unchanged | Merge/replace confirmation, strict `planImport` validation, and Demo Mode isolation untouched. |
| Verification | `npm run typecheck` exit 0; focused suites 38/38; full suite **167/167, 13 files**. |

## Stage 1 — unified backup import validation (2026-10-18)
| Aspect | Status |
| --- | --- |
| Single validated import path | DONE — Settings no longer runs its own `dryRunParse` flow; it now calls `planImport` (same validator the provider uses), so malformed records, duplicate event ids, orphaned references, unsupported backup versions and corrupted embedded photos are rejected before any write. |
| Transactional apply | DONE — apply goes through `applyImportPlan` (single `replaceAll` write). Merge and replace modes preserved with explicit confirmation. |
| Honest photo messaging | DONE — the import result reports restored photo *files* but never claims record re-linking; URI remap (`remapEmbeddedPhotos`) remains Stage 2. |
| Regression coverage | DONE — `tests/importSafety.test.ts`: 9 tests proving every rejection path (newer version, malformed records, duplicate ids, orphans, corrupted photo hash, mid-write failure) leaves existing records byte-identical. |
| Verification | `npm run typecheck` exit 0; `npx vitest run tests/importSafety.test.ts` 9/9; full suite **166/166, 13 files** (was 157). |

## Working (implemented and persisted)

### P0-1 Demo Mode isolation (GitHub issue #1, defect 1) — FIXED
| Aspect | Status |
| --- | --- |
| Enter demo keeps personal records | FIXED — the storage adapter now swaps between two isolated realms (`setDemoMode(true)`); personal rows are never read or written while demo mode is on. SQLite uses a separate database file (`ninninest-demo.db`); web uses a separate IndexedDB record. The old behavior (`replaceAll(buildDemoData())` over live data) is gone. |
| Exit demo restores personal state | FIXED — swapping back re-exposes the untouched personal realm, including the previously selected baby (active-baby preference is stored outside the realms). No `replaceAll(EMPTY)` wipe on exit. |
| Persistence across restart | FIXED — the demo flag is persisted; a restart while in demo reopens the demo realm, so personal data is never exposed or mutated mid-demo. Regression-tested with a shared store across two adapter instances. |
| Multi-baby / timers / failure handling | FIXED — regression tests cover multiple personal babies, active timers surviving entry/exit, and `replaceAll` failure inside demo leaving the personal realm untouched. |
| Verification | 7 dedicated demo-isolation tests against the real adapter contract (in-memory realm adapter) in `tests/p0.test.ts`; full suite 157/157; strict typecheck exit 0. |

### Carried from earlier phases (all regression-tested)
| Feature | Status |
| --- | --- |
| Onboarding, Today dashboard, Phase A/B logging + timers, entry editing, handoff | DONE |
| Multiple baby profiles, growth, milestones, medications, vaccinations, routines | DONE |

### Phase D additions
| Feature | Status |
| --- | --- |
| **Strict calendar validation** | DONE — `2026-02-30`, impossible months/days, non-leap Feb 29, and future/absurd birth dates are rejected at every entry point (zod schema refined with real calendar math) |
| **Photo durability (native)** | DONE — picker URIs are copied into `Documents/ninninest-media/<babyId>/`; replacement removes the old managed file; orphan cleanup and profile deletion are scoped to a single baby's directory so other children's files are unreachable |
| **Routine reminders (native)** | DONE — weekly local notifications scheduled from active routines with permission flow, cancellation on re-sync, no web support (explicit), and reminders never write medication administrations or journal records |
| **Insights (analytics screen)** | DONE — Today / 7-day / 30-day windows, baby-profile selector; feeding (breast by side, bottle by milk type incl. mixed, solids), pumping (count/mL/time), sleep (total/night/nap + per-day bars), diapers by category, tummy time, day-by-day activity, growth history, medication doses, milestone timeline. Gaps stay empty; nothing interpolated or interpreted medically |
| **CSV export** | DONE — RFC 4180 escaping (commas, quotes, newlines), CRLF rows, one full care-history file plus growth/medications/vaccinations/milestones/routines files |
| **Versioned JSON backup** | DONE — v4 envelope with app marker, backup version, settings, photo manifest; dry-run validation reports errors vs warnings before anything changes |
| **Import with merge/replace** | DONE — native document picker (Android/iOS) and web file picker; duplicate ids detected inside files; merge adds only new record ids; replace is a single transactional write — a malformed file never overwrites existing records |
| **Share sheet / download** | DONE — native share via files in cache; web uses blob downloads |
| **No auto-cloud** | CONFIRMED — nothing is transmitted anywhere automatically |

## Part 1 (Phase C risk corrections) evidence

- Migration ladder re-audited: v1→v2 timer backfill and v2→v3 additive widening are
  idempotent (CREATE IF NOT EXISTS, PRAGMA-guarded ALTERs), with meta schema-version
  updated only after success. Interrupted initialization re-runs safely.
- Honest risk statement: these are additive migrations; the automated tests prove the
  upgrade logic and preservation of records/segments/lastSide, but **interrupted-during-
  write recovery on real hardware was not tested** (no device). SQLite WAL is enabled.
- Calendar-date bug class fixed: previously `2026-02-30` passed shape validation.
- Photos: previously milestone/baby photos kept raw picker URIs that the OS can reclaim;
  now copied to managed storage (native) with replacement + orphan cleanup.

## Explicitly not implemented
| Feature | Status |
| --- | --- |
| Growth percentile curves | OMITTED (no validated licensed WHO dataset) |
| Notifications on web | NOT POSSIBLE (platform limitation, surfaced in UI flow) |
| Photo restore into media library after import | DONE — Phase E: full backups embed photos as base64 with hash verification; restore writes files back into the managed media directory |
| Cloud sync, payments | OUT OF SCOPE per instructions |

## Phase E additions
| Feature | Status |
| --- | --- |
| **Android build readiness** | DONE (config) — package `app.ninninest.journal`, APK `preview` / AAB `production` EAS profiles, prebuild verified (exit 0, permissions + applicationId confirmed). **No APK produced**: EAS not authenticated in sandbox — owner commands in `docs/ANDROID_BUILD.md` |
| **Media-inclusive backup** | DONE — v4 backup embeds photos (base64 + FNV-1a hash); restore re-writes files and verifies hashes; 11 integrity tests green |
| **Handoff documentation** | DONE — `docs/ANDROID_BUILD.md`, `DEVICE_TEST_MATRIX.md`, `BACKUP_RESTORE_AUDIT.md`, `EXPORT_HANDOFF.md`, `KNOWN_LIMITATIONS.md` |
| **Visual QA** | PARTIAL — code-review pass only (no rendered browser); touch-target fix applied to Today quick links |

## Phase F additions
| Feature | Status |
| --- | --- |
| **Localization foundation** | DONE — typed i18n module (en + ta). English complete; Tamil complete for nav, common, onboarding, Today, Journal, Handoff, Settings; deeper strings fall back to English (documented). Locale persisted. |
| **12/24-hour setting** | DONE — persisted preference; handoff letter and clock displays honor it via `formatClock(iso, clock)` |
| **Warm Night theme** | DONE — third theme `nightWarm` (amber-shifted, lower luminance); 3-way picker in Settings |
| **Brand identity** | DONE — original vector icon/adaptive-foreground SVG sources rendered to PNG via ImageMagick; wired into app.json (icon, adaptive icon, splash, favicon); central `BRAND` constant for trademark-pending rename |
| **Duplicate-save guard** | DONE — in-flight write locks on event persist and timer stop prevent double-tap duplicates |
| **Screen localization** | DONE for tabs, onboarding, Today, Journal, Handoff, Insights, Settings, Family tab bar |
| **Visual QA** | NOT RENDERED — no browser in sandbox; `docs/VISUAL_QA_CHECKLIST.md` prepared with capture procedure |

## Verification evidence (this phase)
- `npx tsc --noEmit` (strict): exit 0
- `npm test`: exit 0 — **157/157 tests, 12 files** (28 P0 regression tests, incl. 7 demo-isolation tests)
- Rendered browser / device runs: impossible in this environment; demo isolation is verified at the adapter contract level, not on a physical device. SQLite realm behavior was verified against the in-memory realm adapter that mirrors the SQLite/IndexedDB contracts; the real `expo-sqlite` path was not exercised on a device.
