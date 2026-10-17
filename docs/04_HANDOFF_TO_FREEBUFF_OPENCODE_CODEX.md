# Agent handoff once Bolt promotion ends

The project MUST remain an Expo React Native source repository. Save GitHub state plus a complete ZIP independent of Bolt before offer deadline; repo must contain package.json, lockfile, app.json/app.config.ts, app/, src/, assets/, tests/, docs, eas.json, and workflow/test configuration. A web dist/ export is NOT the source project. Secrets are separate.

## Initial offline-safe verification on Windows PowerShell 7
```powershell
git clone <your-new-repo-url>
cd ninninest-mobile
node --version
npm ci
npx expo-doctor
npm run typecheck
npm run lint
npm test -- --runInBand
npx expo export --platform web
```
Adjust only to actual package.json scripts. `npm ci` verifies lockfile parity. Avoid blindly upgrading major Expo/RN packages. `npx expo-doctor` is diagnostic and version-specific.

## Starter prompt to Freebuff / OpenCode / Codex
"Continue the NinniNest app in this repository; do NOT restart or recreate it. First read AGENTS.md, PROJECT_SPEC.md, FEATURE_STATUS.md, RELEASE_EVIDENCE.md and git log. Verify git status, branch, commit and origin; identify runnable scripts and test results. Audit the current Expo/React Native implementation, compare it to all 8 Bolt phase acceptance criteria, reproduce highest-severity defects, and fix them incrementally without modifying another repository or backend. Do not claim completion without real device and artifact evidence. Preserve original Quiet Observatory design, data integrity, offline-first guarantee and baby-level isolation. Provide branch, SHA, commands, exit codes, APK/AAB artifacts and blockers after each verified slice. Never invent a production deployment."

## Real mobile acceptance
- Android device: fresh install + offline use + process killed/reopened; ensure data survived.
- Timer resume across 2h background, power cycle, midnight and timezone; no fabricated duration.
- Database migration preserves history, export/import idempotence, child isolation.
- Long French/Hindi/Tamil/English text and large-font accessibility; dark/night mode.
- App in weak/no network, storage-full, permissions denied, clock changed; no data loss.
- Android build and APK signed; AAB ready for closed test; release signing keys secured.
- Need current Play Store declarations and testing approval before public release.

## Deployment priority
1. Dedicated GitHub repository CI.
2. Expo EAS Free (verify account free quota; currently advertised 15 Android and 15 iOS builds/month, low-priority queue) and local build if quotas exhausted.
3. Web demo: Bolt host or Expo web static export to distinct Vercel project, verify plan limitations and domain use.
4. Cloud sync only with new project and verified RLS. Supabase organizations presently Free; available project slots/credits are NOT established.
5. No Apple App Store launch until actual Apple developer membership, signing and review requirements satisfied.
6. Purchases: store billing & server verification after real paid feature availability; no fake local subscription toggle.

## Avoid regressions and vendor lock-in
No Bolt Cloud DB, no hardcoded bolt.host URL, no recreated project from screenshots, no dependency on a transient trial token, no newly generated secrets in repository. Protect other projects completely. Make independent brand assets and legally compliant user-facing copy.
