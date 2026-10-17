# RELEASE_EVIDENCE.md

Recorded: 2026-10-17 · PROMPT A slice + Phase B + Phase C (family & development)

## Phase C verification evidence

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` (strict) | exit 0 |
| `npm test` (vitest) | exit 0 — **80/80 tests passed** (8 files) |
| `npx expo export --platform web` | exit 0 |
| `npx expo-doctor` | exit 0 — 21/21 checks (after fixing expo-sqlite version) |

### Part A audit findings (with evidence)

1. **Dependency audit:** expo-doctor initially failed on expo-sqlite 58.0.13 (expected
   ~57.0.4 for SDK 57). Fixed by `npm install expo-sqlite@~57.0.4`; re-run shows 21/21.
2. **Web bundle independence:** searched the exported entry JS for `wa-sqlite`,
   `.wasm`, `openDatabaseAsync`, `expo-sqlite` — zero matches in the web entry. The
   IndexedDB repository class is bundled standalone and the SQLite worker/wasm asset is
   emitted as a separate lazily-fetched file only. Genuinely independent web storage.
3. **Migration testing:** `tests/migration.test.ts` covers (a) fresh v3 install shape,
   (b) legacy single-start timer backfill to one running segment, (c) v2→v3 preserving
   baby profiles, timer segments, `side` and `lastSide` values. The SQLite `init()`
   implements the real ladder: v1→v2 (ALTER + backfill), v2→v3 (`PRAGMA table_info`
   before ALTER, idempotent `CREATE TABLE IF NOT EXISTS`), meta version updated once.
   The IndexedDB adapter upgrades v1/v2 backups in place on `loadAll()`.
4. **Data-loss bugs found and fixed:** one — stopping a pump timer used to save
   `amountMl: 0`, discarding nothing only because no amount was captured at all; Phase B
   already added the finish sheet. No migration data-loss bugs found in this pass: the
   v2→v3 migration is additive only (new columns/tables; no DROP/DELETE/RENAME).
5. **Web preview:** not achievable here — this environment has no browser or screenshot
   tool and Bolt's preview pane is not reachable from the sandbox (same environmental
   blocker diagnosed in the PROMPT A pass). Recorded as a limitation, not claimed.

### Phase C features — implemented, with test evidence

- **Multiple baby profiles** (`app/(main)/family.tsx`, Profiles tab): creation, editing,
  switching, deletion. Tests: `phaseC.test.ts` — events/growth scoped by babyId; malformed
  birth date rejected; deletion contract lists all 9 tables touched.
- **Growth tracking** (`src/models/growth.ts`, Growth tab): canonical grams/cm with
  kg·lb and cm·in conversion at input/display only. Tests: weight-only record accepted;
  measurement-less record rejected; absurd values rejected; bad dates rejected; gram↔lb
  and cm↔in round trips; metric/imperial formatting; sorted trend construction; age-in-days.
- **Milestones & memories** (Milestones tab): categories incl. custom, editable dates,
  notes, photoUri persistence, year-grouped SectionList. Tests: acceptance, empty-title
  rejection, bad-date rejection, photoUri round trip.
- **Medication records** (Health tab): explicit administration only. Tests: user-entered
  med accepted; empty name rejected; administration references its medication; deleting a
  medication cascades to its administrations (prevents orphaned dose history).
- **Vaccination history** (Health tab): tests cover complete record acceptance and
  invalid-name/date rejection.
- **Daily routines** (Routines tab): tests cover day-of-week recurrence (2026-10-17 =
  Saturday), paused routines never firing, local-time sorting, and the template contract
  (routines never create journal records).
- **Demo-mode isolation** regression: `validation.test.ts` + `demoData.test.ts` still
  green — demo events flagged and isolated, personal events untouched.
- **Phase A/B regression**: all 51 prior tests remain passing unchanged.

### Honest limitations

- **No runtime/device claims:** no Android APK, iOS build, or real-device run was
  possible. All 80 passing tests prove the pure logic (maths, validation, upgrade
  paths) — they do not prove Android or iOS behaviour.
- **No rendered browser test:** the UI was verified by code review and by confirming the
  exported web bundle contains the Family screen code paths; no human clicked through it.
- Navigation journeys (Family tab switching, baby chip switching, sheets) are
  code-verified only.

---

# Earlier: Phase B (2026-10-17)

## Phase B verification evidence

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` (strict) | exit 0, no errors |
| `npm test` (vitest) | exit 0 — **51/51 tests passed** (6 files) |
| `npx expo export --platform web` | exit 0 — `dist/` produced; entry JS contains the new Phase B code (solids form, pump finish flow, repeat-last logic verified by string search in the bundle) |

### Per-feature evidence (code + tests, no device run)

- **Breastfeeding** — segment-based timers: side switching closes the running segment and
  opens a new one (`switchSideFrom`, covered by 2 unit tests), last-side memory persisted
  in `active_timers.lastSide` (SQLite migration v1→v2 backfills legacy rows), pause/resume
  across segments tested. Manual correction via the "Manual" dock button (h/m inputs).
  History: journal entries show side and duration; edit sheet allows side/duration/time fixes.
- **Bottle feeding** — mL/oz toggle converts oz→mL at save (canonical mL, `ozToMl` unit
  tested), live conversion line, breast milk/formula/mixed.
- **Pumping** — dock timer + finish sheet that captures amount (mL, 0–2000), side, note;
  `stopTimer` accepts extras so the timer duration is used with the captured amount; manual
  PumpForm (validated); pump events now carry optional `side` (schema + zod tested).
- **Sleep** — start/pause/resume/stop via segment timers (unit tested: paused math ignores
  wall clock; resume opens a new segment); manual past-sleep entry (max 1440 min);
  overnight span measured purely from timestamps (unit tested 23:00→07:00 = 480 min).
- **Tummy time** — persistent stopwatch (segment timer survives restart via persisted
  segments) + manual entry + history, unit-tested max 240 min.
- **Solids** — food, quantity appended to description, reaction (liked/neutral/refused)
  labelled "as observed, not a diagnosis", optional note; repeat-last prefills it.
- **Restart/suspension safety** — timers restore from persisted `segments` JSON
  (SQLite `loadAll` + legacy fallback tested in the v1→v2 migration block); elapsed always
  derived from timestamps, never counters.
- **Repeat last log** — `lastRepeatable` picks the newest non-note event (unit tested);
  opens the matching form prefilled with all previous values and saves with a fresh timestamp.
- **Editing** — every journal entry can now be edited including **time correction**
  (date + hh:mm, validated: rejects malformed dates, future timestamps).
- **Invalid-input guards** — zod rejects negative amounts/durations, absurd quantities,
  inverted timer segments; `sanitizeSegments` drops NaN/inverted/future segments and always
  leaves ≥1 (unit tested); forms enforce 0–2000 mL, 1–240/1440 min bounds.
- **Baby isolation** — Today screen filters events and timers by `babyId === currentBaby.id`.
- **Adapters** — SQLite (native) and IndexedDB (web) both persist `segments` + `lastSide`
  with schemaVersion 2; the native v1→v2 migration preserves existing timers as a single
  running segment.

### Honest limitations of this pass

- No rendered-browser or device run: UI journeys verified by code review + the static
  bundle check described above, not by clicking through a live app in this environment.
- Breast "both"-side summary is simplified to the currently-active side.
- `npm run typecheck` and `npm test` were re-run after every failure until both were clean.

---

# Earlier: PROMPT A vertical slice (2026-10-17)

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
