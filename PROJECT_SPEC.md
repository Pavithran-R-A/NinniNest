# PROJECT_SPEC.md

## Product
NinniNest (working name, centrally configurable) — a premium, local-first baby-care journal
and caregiver handoff app. Customers: sleep-deprived parents, partners and authorized
caregivers. India-first, internationally usable.

## Core functional requirements
1. No-account onboarding (nickname + birth date), persisted locally.
2. Today dashboard with greeting, baby age, care-status band and live timer.
3. Quick logging: diaper (wet/dirty/both), bottle (mL + milk type), breastfeed L/R timers,
   sleep timer, pump, tummy time, solids, notes — every save persists.
4. Persistent journal ribbon with edit/delete and confirmation for destructive actions.
5. Care handoff letter derived strictly from recorded events (12 h / 24 h window), copy + share.
6. Night mode (day + midnight theme families).
7. JSON export / import with validation; erase-all.
8. Demo mode: clearly synthetic, isolated, never mixes with personal data.
9. Future modules planned: growth, milestones, medication log (observational only),
   vaccination history (user-entered), insights with missing-data states.

## Non-functional requirements
- Strict TypeScript; pure logic unit-tested (models, time arithmetic, validation).
- Local-first: expo-sqlite (native) and IndexedDB (web) behind one repository interface.
- UTC timestamps, local rendering; timers computed from timestamps.
- 48dp+ primary touch targets, accessibility labels, distinct empty/error states.
- No accounts, no cloud dependency, no ads, no fake sync, no medical claims.
