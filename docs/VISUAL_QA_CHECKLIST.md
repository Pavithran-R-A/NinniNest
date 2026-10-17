# Visual QA checklist — Phase F

Environment truth: **this sandbox has no browser or screenshot tooling.** Nothing in
this file was visually rendered. Every item below must be executed by a human on a
real device or the web preview after export. Check items off only when actually seen.

## Screenshot capture procedure (per screen, per theme)

1. Open the screen; wait for data (or its empty state) to settle.
2. Capture: light mode, then Settings → Night, then Night · warm, retake.
3. Repeat at device widths 360dp, 390dp, 430dp (or browser widths 360/390/430 px).
4. Increase system font scale to largest; retake one representative shot per screen.
5. Name files `<screen>-<theme>-<width>.png` into `qa/screenshots/`.

## Screens to capture

- [ ] Onboarding (light / night / nightWarm × 3 widths)
- [ ] Today — dashboard, status band, timers, dock, sheet, toast
- [ ] Journal — empty state, populated ribbon, edit/delete modal
- [ ] Handoff — 12h and 24h letter, copy and share actions
- [ ] Family — profiles list, growth, milestones, health, routines; baby switcher
- [ ] Insights — Today/7d/30d, per-metric panels, day bars
- [ ] Settings — appearance (3 themes), language & time, data, demo, about

## Interaction checks (device)

- [ ] All dock buttons ≥ 48dp; pressed states visible
- [ ] Quick links ("Log past sleep/tummy") comfortably tappable
- [ ] Sheet slides and dismisses on backdrop tap and back gesture
- [ ] Toast appears after every save/start/stop; auto-dismisses
- [ ] Rapid double-tap on any save button produces exactly one record
- [ ] Back navigation from any sheet leaves data unchanged (no partial writes)
- [ ] Keyboard never covers the active input (onboarding, note, forms)
- [ ] Long baby names and long notes truncate or wrap without breaking layout
- [ ] Night themes: no text below legible contrast; cinnamon/amber accents readable

## Accessibility checks

- [ ] Screen reader announces dock buttons, tabs, and status band
- [ ] Segmented controls announced as selectable radio group
- [ ] Error messages tied to their fields, announced on appearance
- [ ] Reduced motion: no essential information conveyed only by animation

## Known-render-limitations statement

The Phase F visual work (tokens, nightWarm theme, onboarding motif, brand assets,
localization) was verified by code review, typecheck (exit 0), and 129/129 unit tests.
**No rendered visual inspection was performed in this environment.** This checklist is
the handoff instrument for that verification.
