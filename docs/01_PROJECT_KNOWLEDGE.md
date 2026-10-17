# NinniNest — persistent Project Knowledge for Bolt

You are building an original premium consumer MOBILE APP in Expo/React Native with TypeScript, not a website and not a reproduction of any competitor.

## Product definition
Working name NinniNest (renameable; not yet trademark cleared). Tagline: "Know what happened. Share what matters. Rest easier." Customers: sleep-deprived parents, partners and authorized caregivers. Goal: reliable everyday care logs, effortless night interaction, accurate handoffs, data ownership. India-first, internationally usable; English, Tamil and Hindi localization architecture.

## Nonnegotiable technical requirements
- Single Expo + Expo Router + strict TypeScript repo, portable outside Bolt. No vendor-lock-in, no Bolt Cloud critical path, no secrets in repository.
- Local-first: native expo-sqlite with schema migrations; web uses a separate IndexedDB implementation of the SAME typed repository interface. Web SQLite support is still experimental, so do not assume native adapter works in browser without specific setup.
- Source models, validation, time/date arithmetic and analytics pure TypeScript with tests. Store timestamps in UTC ISO form, render localized. Persist timers using timestamps, not interval counters.
- Data isolation by baby ID, no data loss after process restart, idempotent import/dedup, tombstones for future sync, explicit error handling; never silently fall back to in-memory storage in live mode.
- Strict separation between DEMO (synthetic) and PERSONAL (private). Demo data never syncs or overwrites personal data.
- No forced account for basic tracking. No server/internet dependency for local mode. No hidden subscriptions or adverts.
- React Native-compatible dependencies and assets only. Maintain Android/iOS portability and truthful web preview.
- Add tests, run commands and report passes/failures after every phase. Do not invent successful tests or claim device coverage from browser preview.
- Never turn working controls into nonfunctional mockups. Do not add fake buttons, stub onPress handlers or fabricated charts. Feature flags must mark not-yet-implemented functions clearly.
- No unsafe clinical claims, drug-dose suggestions, automated vaccine recommendations, diagnostic predictions or fabricated growth standards; keep health logs observational.
- Every phase must update `FEATURE_STATUS.md`, `CHANGELOG.md`, `RELEASE_EVIDENCE.md`, `AGENTS.md` and `README.md` as appropriate. Include clear remaining work.

## Premium original UI: "Quiet Observatory"
Design like an editorial instrument for loving families, not an AI dashboard. Visual metaphor: a calm paper journal by warm lamplight. Build a coherent typography/layout system and bespoke interaction language. NOT baby-pink overload, purple gradient, emoji tab icons, glassmorphism, generic frosted cards, over-rounded dashboards, stock photos, fake charts or random illustrations.

Color tokens (adjust for measured 4.5:1 accessible contrast): ivory #F7F5F0, ink #24343C, teal #286F68, cinnamon #AB6F53, pale-sage #E3ECE4, parchment #F0EBE2, muted ink #52636B; night canvas #121F24, night surface #1C2B30, night text #F6F0E6, night accent #E1B48A. Favor restrained accent usage. Age-appropriate but adult, sophisticated. No gender-coded default colors.
Typography: DM Sans (clear body, metrics and controls) and Fraunces (VERY sparing, hero/title accents); ship compatible licensed font assets for offline use, readable fallbacks. Use tabular numeral styling for durations, amounts and timestamps.
Layout: intentional vertical rhythm, generous breathing space, asymmetric editorial hierarchy with an elegant single-column Journal ribbon rather than a pile of same-size cards. Optimize one-handed thumb reach. Bottom action dock with 4 fast actions; meaningful blank space is premium, not wasted.
Signature screen Today: quiet greeting/time-of-day, current baby's nickname and age, clear most-recent care summary, compact active timer anchored within thumb reach, 4 large thumb targets, and a continuous event ribbon. Journal: beautiful but usable date rail and chronology. Handoff: 'care letter' with precise data provenance and an easy share action. Insights: a few evidence-backed trends with clear missing-data states. Night Mode: warm, dim, still fully legible.
Controls >=44x44 logical pixels (prefer 48dp mobile), distinct focused/pressed/disabled states, reduced motion, dynamic text size, screen-reader labels, large touch areas, no color-only coding, sensible haptics only when supported. Use subtle 120–220ms animations that NEVER obscure controls or delay logging. Target smooth mid-range Android hardware.
Use custom vector shapes and native primitives, not copied PumBaby artwork, mascot, screenshot, app names or page layout.

## Business and safety rules
Essential logging, data access, export and deletion stay permanently free. Advanced paid benefits (after purchase verification) can include long-term insights, expanded household convenience, family memories, themes/widgets, extra profiles; do not paywall health-critical or core history access. Do not claim sync exists unless tested end to end. Do not activate Supabase or use another product's database/credentials. Store platform billing is not a fake Stripe checkout embedded in a mobile app.

## Delivery
After each instruction execute the narrowly requested feature slice, typecheck/tests, then report (1) files changed (2) visible behavior (3) checks with exit status (4) screenshots/demo test if available (5) remaining blockers. Preserve functioning portions of the app. Do not rewrite the entire project to fix a narrow bug.
