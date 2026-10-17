# AGENTS.md — working rules for coding agents

Read `docs/01_PROJECT_KNOWLEDGE.md` first. Key operational rules:

1. **Do not restart or recreate the project.** Extend the existing Expo app incrementally.
2. Preserve the `CareRepository` interface. Native changes go in `SqliteCareRepository`,
   web changes in `IndexedDbCareRepository`; never let one break the other.
3. Keep the app local-first. Do not add accounts, cloud sync, analytics, ads, or medical
   advice. Demo data (`src/models/demoData.ts`) must stay marked `isDemo: true` and isolated.
4. All timestamps are UTC ISO strings; all display is local. Timer durations always derive
   from timestamps (`elapsedMinutes`), never from interval counters.
5. Validation lives in `src/models/validation.ts` (zod). Corrupt rows are skipped, never fatal.
6. After every slice run: `npm run typecheck`, `npm test`, and (when UI changed)
   `npx expo export --platform web`. Report real exit codes. Never invent passing checks.
7. Keep the "Quiet Observatory" design language: tokens from `src/design/tokens.ts`,
   DM Sans for UI, Fraunces only for display headlines, 48dp+ primary targets.
8. Update `FEATURE_STATUS.md` and `CHANGELOG.md` when features change.
9. Never claim device behaviour that was only verified in the browser preview.
10. Photos on native must be copied into `Documents/ninninest-media/<babyId>/` via
   `src/models/media.ts`; never store raw picker URIs. Cleanup is scoped per baby.
11. Backups are versioned (`src/models/backup.ts`, v4). Imports must dry-run validate
   first and use merge or a single transactional replace — never partial writes.
12. Dates must pass `isCalendarValid` (`src/models/calendar.ts`) — shape alone is not
   enough. Analytics live in `src/models/analytics.ts` and must stay deterministic.
13. Routine reminders (`src/models/notifications.ts`) are informational only and must
   never create medication administrations or journal entries.
14. Android build commands live in `docs/ANDROID_BUILD.md`; never claim an APK or
    device result that was not actually produced — record it in
    `docs/DEVICE_TEST_MATRIX.md` with VERIFIED/FAILED/NOT TESTED instead.
