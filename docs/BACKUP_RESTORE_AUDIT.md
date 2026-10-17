# Backup & restore audit — Phase E

## What a "complete" backup means here

A backup is complete only if restoring it reproduces **records + settings + photo
media**. A records-only JSON file is explicitly NOT treated as a complete backup.

## Backup format (v4)

- `src/models/backup.ts` — `BACKUP_VERSION = 4`; envelope holds app marker, version,
  exported-at, settings (theme, active baby), and all record tables.
- `src/models/mediaBackup.ts` — `buildFullBackup` embeds every managed photo
  (`Documents/ninninest-media/<babyId>/`) as base64 with an FNV-1a `hashContent`
  fingerprint (`src/models/hash.ts`, dependency-free so vitest can test it).
- `restoreEmbeddedPhotos` writes bytes back into the per-baby media directory and
  **verifies each file's hash after writing**; a mismatch fails the restore rather
  than silently keeping a corrupt image.

## Import safety

1. **Dry-run first**: `dryRunParse` validates schema, version (older accepted with
   warning, newer rejected), duplicate ids, and orphaned references. Nothing changes.
2. **User review**: a dialog lists errors vs warnings; import proceeds only after
   explicit confirmation.
3. **Merge** adds only record ids not already present.
4. **Replace** runs `repo.replaceAll(target)` — a single transaction over all 9
   tables — then `restoreEmbeddedPhotos`. A malformed file can never partially
   overwrite existing records.

## Automated proof (all VERIFIED, exit 0 — 11/11 in tests/backupIntegrity.test.ts)

- Round-trip export → import → identical counts across all 9 tables.
- Field-level identity for every record type (ids, timestamps, segments, lastSide,
  growth measurements, doses, vaccinations, routine day/time grids).
- Photo payload hash verified on restore; corrupted photo payload detected and
  rejected.
- Truncated JSON, malformed JSON, foreign-app JSON, and newer-version files all
  rejected with no writes.
- Merge is idempotent (double import = same state as single import).
- Multi-baby backups restore each baby's records isolated and complete.

## Honest limits

| Area | Status |
| --- | --- |
| Backup logic + integrity | VERIFIED by automated tests |
| Import via Android document picker | NOT TESTED (needs device) |
| Photo restoration to media dir on device | NOT TESTED (needs device) |
| Backup across app versions (schema v3 → future v4) | NOT TESTED (no future version exists) |
| Extremely large libraries (100+ photos) | NOT TESTED — memory use of base64 embedding unmeasured |
| Web IndexedDB backup round-trip in a browser | NOT TESTED (no browser tool) |

## Recommendation to owner (first device session)

1. Create two babies, log events, add one photo each.
2. Export full backup → share to Files.
3. Erase app data → restore backup (replace) → verify records AND photos return.
4. Import the same file again with merge → verify no duplicates.
