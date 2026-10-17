# RELEASE_EVIDENCE.md

Recorded: 2026-10-17 · PROMPT A vertical slice + preview diagnostic pass

## Commands actually run (with exit codes)

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` (strict) | exit 0, no errors (re-run after every change in this pass) |
| `npm test` (vitest) | exit 0 — 27/27 tests passed (3 files) |
| `npx expo export --platform web` | exit 0 — `dist/` produced: entry JS, sqlite worker 137 KB, wa-sqlite.wasm 641 KB, index.html, bundled DM Sans + Fraunces TTFs |
| `npx expo start --web` (dev server probe) | server boots, root serves HTTP 200, Metro bundles the entry (2614–2688 modules) with no bundling errors |

## "No preview available" — diagnosis

Findings from inspecting and running the actual dev server in this environment:

1. The app itself starts: `npx expo start --web` boots Metro, serves `index.html` (HTTP 200),
   and compiles the full bundle without a single bundling or module-resolution error.
2. The one recurring error in the dev-server log is `React Native DevTools` failing to
   install (Chromium sandbox crash: `zygote_host_impl_linux.cc` / `proc_util.cc`). This is
   the sandboxed container refusing to launch Expo's local Chromium for devtools — it is
   not an app defect and does not affect the served bundle.
3. Static verification of the exported production bundle confirms every screen's content is
   present: welcome, onboarding, Today, Journal, Handoff, Settings, the IndexedDB repository,
   demo data, and zod validation strings all appear in the entry JS.
4. Conclusion: **the code builds and serves; the blocker is environmental.** Bolt's browser
   preview for Expo projects drives the dev server from its own WebContainer session. When
   that session is not attached (as in this headless environment, and whenever the WebContainer
   fails or is still starting), the preview pane shows "No preview available" regardless of
   app correctness. Per Bolt's own docs, remedies on the user side are: hard refresh
   (Cmd/Ctrl+Shift+R), open the project in a new tab, retry after the terminal finishes
   booting, or re-prompt "The preview is not showing, fix this." The Expo Device Preview
   (Expo Go QR code) is the documented alternative path for Expo projects.

No code defect was demonstrated. The only preview-relevant code fixes made were defensive:
removed an unused import indirection in the Today screen and — importantly — the Google
fonts (DM Sans, Fraunces) that every screen references were never actually loaded at
runtime. That would have rendered fallback system fonts in any working preview. Fonts are
now loaded in the root layout via `expo-font`, and the export emits the TTFs.

## Browser smoke test — honest status

**Not performed.** This environment has no browser and no screenshot tool; background
long-lived dev servers cannot be kept alive for interactive testing, and the Bolt preview
pane is not reachable from here. The user-journey checks requested (onboarding → Today,
log/edit/delete persistence, refresh persistence, handoff agreement, JSON export schema,
night mode, demo isolation) therefore remain **manually unverified**. What was verified
instead, by static inspection of the production bundle: every screen's code and strings are
present, the IndexedDB persistence layer is bundled, and no module failed to resolve.
The 27 unit tests cover the pure logic (time maths, validation, demo isolation) but not the
UI journeys.

## Visual inspection — honest status

**Not performed against a rendered screen.** Reviewed at the code level instead:

- Fraunces is now genuinely applied to display headlines (it previously was not loaded).
- Spacing uses the 8pt rhythm, primary controls are ≥48dp, tab bar and dock follow the
  Quiet Observatory tokens.
- Day/night palettes keep 4.5:1+ body contrast by design (ink #24343C on ivory #F7F5F0;
  cream #F6F0E6 on #121F24), but pixel-level contrast verification did not happen.

## What was NOT verified (honest blockers)

- No Android APK or iOS build was produced; no real-device testing occurred.
- Timer behaviour across background kill, power cycle and timezone changes is implemented
  via timestamps and covered by unit tests of the underlying maths, but not device-tested.
- Screen-reader (TalkBack/VoiceOver) semantics were written into the controls but never
  exercised with an actual screen reader.
- 360×800 / 390×844 / 768 / 1440 layout audit not performed on a rendered screen.
- Share sheet behaviour on native uses `Share.share` without device verification.

## Manual acceptance checks for a human with the preview or a device

1. Fresh start → onboarding → log a diaper → reload: the diaper event and the baby profile
   must still be there (IndexedDB on web, SQLite on native).
2. Start a breastfeeding timer → wait → stop: saved duration must match wall-clock time.
3. Journal → tap an entry → edit → verify the change appears immediately and persists.
4. Handoff → copy → paste: contents must match recorded events only.
5. Settings → enable night mode → reload: mode must persist and every screen stay legible.
6. Settings → start demo mode → records labelled demo → exit demo → journal empty again.
7. If the preview pane still shows "No preview available": reload the browser tab, reopen
   the project, or use the Device Preview (Expo Go) path.
