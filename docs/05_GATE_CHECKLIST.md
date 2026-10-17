# End-of-weekend gates (complete evidence, not promises)

### Product
[ ] No-account baby onboarding, local data persists after restart
[ ] 6 core care trackers work and can edit/delete history
[ ] 6 additional record modules implemented or explicitly BLOCKED
[ ] 2 real timer paths reliably restore from timestamps
[ ] Family handoff uses accurate data and truly shares/copies
[ ] JSON export/import roundtrip, CSV supported, delete all works
[ ] Demo records cannot overwrite or be mistaken for private care history
[ ] Every screen, link, control has real behavior; no "Coming soon" disguised as feature
[ ] Clear separate free-vs-premium policy, no fake payments

### Visual/product quality
[ ] Original premium tokens and components, consistent day/night theme
[ ] UX tested 360x800 Android, 390x844, 768 and web wide
[ ] Meaningful load, empty, error, permission-denied states
[ ] Contrast, dynamic type, 48dp main touch targets and a11y labels
[ ] Does not copy PumBaby or another product's protected visual assets

### Engineering
[ ] Strict TS, dependency lock, reproducible scripts
[ ] Repo remote and HEAD SHA recorded; main branch protected if available
[ ] Typecheck, lint, unit tests and Expo web export succeed
[ ] Versioned database migration tests and safe import logic
[ ] Sensitive logs redacted; no secrets/service role API in source
[ ] Actual Android APK tested on device, not only web preview
[ ] EAS preview and production profiles; verify target API on built AAB
[ ] Privacy / health app declarations reflect observed runtime behavior

### Exit
[ ] GitHub push CONFIRMED by remote commit hash
[ ] Export full source ZIP at least once, verify it reopens independently
[ ] Preserve assets/fonts and licences, AGENTS.md, README, tests, CI
[ ] Copy HANDOFF_TO_CODEX.md and RELEASE_EVIDENCE.md into repository
[ ] Record unfinished work as blockers rather than fabricate success
