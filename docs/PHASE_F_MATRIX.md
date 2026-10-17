# Phase F implementation matrix — screen audit with code evidence

Audit date: 2026-10-17 · Phase F kickoff. Every major surface, its current state, and
its Phase F disposition. "Localized" means strings come from `src/i18n/strings.ts`.

## Screens & routes

| Surface | Route / file | State at F-start | Phase F disposition |
| --- | --- | --- | --- |
| Entry gate | `app/index.tsx` | routes to onboarding or main | unchanged (works) |
| Onboarding | `app/onboarding.tsx` | nickname + birth date; brand-less header | Localized; brand wordmark + night-arc motif added; error strings from i18n |
| Today | `app/(main)/today.tsx` | dashboard, status band, 9 dock buttons, timers, FAB, repeat sheet | Localized (greetings, status band, dock labels, toasts); repeat-last retained; duplicate-save guard added in provider |
| Journal | `app/(main)/journal.tsx` | SectionList ribbon + edit/delete modal | Localized; unchanged visually (ribbon already editorial) |
| Handoff | `app/(main)/handoff.tsx` | 12/24h letter, copy/share | Localized; letter now honors the 12/24h clock setting; brand signature centralized |
| Family | `app/(main)/family.tsx` | 5 tabs: profiles/growth/milestones/health/routines; sheets | Localized tab labels deferred (deep strings fall back to en) — documented |
| Insights | `app/(main)/insights.tsx` | ranges, per-metric cards, bars | Localized section titles; charts unchanged (already real-data driven) |
| Settings | `app/(main)/settings.tsx` | night toggle, data, demo, about | Localized; **new Language & time section** (en/ta + 12/24h); night toggle → 3-way theme picker (day / night / nightWarm) |
| Tabs | `app/(main)/_layout.tsx` | lucide icons | Localized tab titles |

## Cross-cutting

| Concern | File | Disposition |
| --- | --- | --- |
| i18n foundation | `src/i18n/strings.ts`, `useI18n.ts`, `brand.ts` | NEW — en full, ta complete for nav/common/onboarding/Today/Journal/Handoff/Settings; graceful en fallback; typed TFunc; {param} interpolation |
| Locale + clock persistence | `src/state/AppProvider.tsx` | NEW state: locale ('en'\|'ta'), clockFormat ('12h'\|'24h'), AsyncStorage-backed |
| Clock-aware display | `src/models/time.ts` | `formatClock(iso, clock?)` — explicit hour12 override |
| Theme elevation | `src/design/tokens.ts` | NEW `nightWarm` theme (amber-shifted, lower luminance); 3 selectable modes |
| Duplicate-save guard | `src/state/AppProvider.tsx` | in-flight event/timer write sets stop double-tap duplicates |
| Touch targets | today quick links | 44dp+ effective (padding-expanded), audited |
| Brand identity | `src/i18n/brand.ts`, app.json assets | NEW central BRAND constant; wordmark on onboarding |

## Explicitly deferred (documented, not hidden)

- Family/Insights deep-strings: Tamil falls back to English at runtime.
- No rendered-browser visual QA possible in this environment — checklist prepared
  instead (see `docs/VISUAL_QA_CHECKLIST.md`).
- No cloud anything, per project rules.
