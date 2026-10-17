# FEATURE_STATUS.md

Last updated: 2026-10-17 (Phase F — consumer experience, i18n, brand identity)

## Working (implemented and persisted)

### Carried from earlier phases (all regression-tested, 110 tests green)
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
- `npm test`: exit 0 — **129/129 tests, 11 files** (8 new i18n tests)
- `npx expo-doctor`: exit 0 — 21/21
- `npx expo prebuild --platform android`: exit 0 — adaptive icon assets verified in generated res/
- Rendered browser / device runs: impossible in this environment; checklist prepared instead of claiming visual QA
