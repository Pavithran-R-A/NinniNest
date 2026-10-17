# RELEASE_EVIDENCE.md

Recorded: 2026-10-17 · PROMPT A + Phases B/C/D + Phase E (build readiness, restore integrity, handoff)

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
