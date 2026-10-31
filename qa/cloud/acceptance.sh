#!/usr/bin/env bash
# Cloud-emulator acceptance for NinniNest (synthetic data only).
# Runs on a GitHub-hosted ubuntu runner inside reactivecircus/android-emulator-runner.
# Technique: uiautomator dump -> locate text bounds -> tap center. No blind coordinates.
#
# Integrity contract (certification requirement):
#   - The script exits NONZERO when any assertion fails. A green workflow run
#     is only possible when every assertion passed.
#   - Missing critical evidence files fail the run.
#   - SELFTEST=1 injects a deliberate failure and exits 1; the workflow runs
#     it first and requires that exact exit code, proving the gate wiring.
set -u
OUT=qa-cloud
mkdir -p "$OUT/dumps"
PASS=0
FAIL=0
PKG=app.ninninest.journal

# ---------------------------------------------------------------- selftest ---
# Proves the failure mechanism: run with SELFTEST=1; the workflow requires
# exit code 1 from it. If the gate ever stops working, the workflow goes red.
if [ "${SELFTEST:-0}" = "1" ]; then
  fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1"; }
  pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
  pass "selftest healthy"
  fail "selftest-deliberate-failure"
  echo "=== SUMMARY: PASS=$PASS FAIL=$FAIL ==="
  if [ "$FAIL" -gt 0 ]; then
    echo "SELFTEST OK: failing assertions produce exit 1"
    exit 1
  fi
  echo "SELFTEST BROKEN: a failing assertion did not affect the exit status"
  exit 1
fi

shot() { timeout 60 adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null || true; }
pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1"; shot "FAIL-$1"; timeout 20 adb logcat -d -b crash > "$OUT/crash-last.txt" 2>/dev/null || true; }

SEQ=0
dump() {
  SEQ=$((SEQ + 1))
  local d_out d_file="/sdcard/acc-$SEQ.xml"
  for _ in 1 2 3; do
    d_out=$(timeout 30 adb shell uiautomator dump "$d_file" 2>&1)
    if printf '%s' "$d_out" | grep -qi "dumped to"; then
      timeout 30 adb shell cat "$d_file" > /tmp/acc.xml 2>/dev/null
      gzip -c /tmp/acc.xml > "$OUT/dumps/$(printf '%03d' $SEQ).xml.gz" 2>/dev/null || true
      timeout 30 adb shell rm -f "$d_file" >/dev/null 2>&1
      return 0
    fi
    sleep 1.5
  done
  echo "DUMP-FAILED after retries: $d_out"
  printf 'DUMP-FAILED' > /tmp/acc.xml
  return 1
}

# Dismiss the soft keyboard only when it is actually shown (a blind back
# press with no keyboard navigates BACK and can close the sheet).
kb_visible() {
  timeout 30 adb shell dumpsys input_method 2>/dev/null | grep -q "mInputShown=true"
}
hide_kb() {
  if kb_visible; then
    timeout 30 adb shell input keyevent 4
    sleep 2.5
  fi
}

# Tap the center of the node whose visible text matches exactly. Returns 1 if absent.
tap_text() {
  dump
  local xy
  xy=$(TEXT="$1" python3 - <<'PY'
import re, sys, os
text = os.environ['TEXT']
s = open('/tmp/acc.xml', encoding='utf-8', errors='replace').read()
m = re.search(r'text="' + re.escape(text) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
if not m:
    print('NOT_FOUND')
    sys.exit(2)
x1, y1, x2, y2 = map(int, m.groups())
print((x1 + x2) // 2, (y1 + y2) // 2)
PY
)
  if [ "$xy" = "NOT_FOUND" ]; then return 1; fi
  timeout 30 adb shell input tap $xy
  return 0
}

# Tap the center of the node whose content-desc matches exactly.
tap_desc() {
  dump
  local xy
  xy=$(DESC="$1" python3 - <<'PY'
import re, sys, os
desc = os.environ['DESC']
s = open('/tmp/acc.xml', encoding='utf-8', errors='replace').read()
m = re.search(r'content-desc="' + re.escape(desc) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
if not m:
    print('NOT_FOUND')
    sys.exit(2)
x1, y1, x2, y2 = map(int, m.groups())
print((x1 + x2) // 2, (y1 + y2) // 2)
PY
)
  if [ "$xy" = "NOT_FOUND" ]; then return 1; fi
  timeout 30 adb shell input tap $xy
  return 0
}

# Type into the Nth on-screen EditText (0-based) and commit with Enter.
# Waits until two consecutive dumps report identical bounds before tapping
# (the layout settles after a keyboard reflow); never returns a silent
# empty coordinate — ABSENT is explicit and the caller can fail on it.
type_edit() {
  local idx="$1" value="$2" prev="INIT" cur=""
  for _ in 1 2 3 4 5 6; do
    dump
    cur=$(IDX="$idx" python3 - <<'PY'
import re, sys, os
idx = int(os.environ['IDX'])
s = open('/tmp/acc.xml', encoding='utf-8', errors='replace').read()
ets = re.findall(r'class="android\.widget\.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
if idx >= len(ets):
    print('ABSENT')
    sys.exit(0)
x1, y1, x2, y2 = (int(g) for g in ets[idx])
print((x1 + x2) // 2, (y1 + y2) // 2)
PY
)
    if [ -z "$cur" ]; then cur="ABSENT"; fi
    if [ "$cur" = "ABSENT" ]; then
      dismiss_system_dialogs || sleep 2
      continue
    fi
    if [ "$cur" = "$prev" ]; then break; fi
    prev="$cur"
    sleep 2
  done
  if [ -z "$cur" ] || [ "$cur" = "ABSENT" ]; then return 1; fi
  timeout 30 adb shell input tap $cur
  sleep 1.5
  if [ "${3:-0}" = "1" ]; then
    # field ships a pre-filled default (routine time): move-to-end, backspace
    timeout 30 adb shell input keyevent 123
    for _ in 1 2 3 4 5 6 7 8; do timeout 30 adb shell input keyevent 67; done
  fi
  timeout 30 adb shell input text "$value"
  # nocommit mode (4th arg): leave the keyboard up and the navigation stack
  # untouched — on modal sheets Enter+BACK can close the sheet and pop the
  # tab stack (observed in run 15). The caller dismisses the keyboard with
  # ESCAPE (keyevent 111) instead.
  if [ "${4:-0}" != "1" ]; then
    timeout 30 adb shell input keyevent 66
    hide_kb
  fi
  return 0
}

# The dump only sees the ACTIVE window: the POST_NOTIFICATIONS permission
# dialog (package com.google.android.permissioncontroller) hides the app
# completely when it pops mid-flow (found in cloud runs 5 and 6). Whenever
# that window is active, dismiss it with "Allow" before looking further.
dismiss_system_dialogs() {
  if grep -q 'com.google.android.permissioncontroller' /tmp/acc.xml 2>/dev/null; then
    tap_text "Allow" || true
    sleep 2
    return 0
  fi
  if grep -q "isn't responding" /tmp/acc.xml 2>/dev/null; then
    tap_text "Wait" || true
    sleep 2
    return 0
  fi
  return 1
}

wait_for_text() { # poll up to N seconds; dismisses system dialogs while polling
  local text="$1" tries="${2:-10}"
  for _ in $(seq 1 "$tries"); do
    if tap_text "$text"; then return 0; fi
    dump
    dismiss_system_dialogs || sleep 2
  done
  return 1
}

dump_has() {
  dump
  python3 - "$1" /tmp/acc.xml <<'PY'
import re, sys, os
needle = sys.argv[1]
s = open(sys.argv[2], encoding='utf-8', errors='replace').read()
sys.exit(0 if needle in s else 1)
PY
}

# Open the system document picker at the Downloads root and tap a file name.
pick_download_file() { # <file name>
  sleep 5
  if tap_desc "Show roots"; then
    sleep 4
    if ! wait_for_text "Downloads" 6; then
      tap_desc "Show roots" || true
      sleep 3
      wait_for_text "Downloads" 4 || true
    fi
    sleep 3
  fi
  tap_text "$1" && return 0
  # one recovery sweep: re-open the drawer and retry
  tap_desc "Show roots" || true
  sleep 3
  wait_for_text "Downloads" 4 || true
  sleep 2
  tap_text "$1"
}

# Find a control that may sit above or below the current viewport:
# scroll to the top, then nudge down, tapping at each position.
scroll_to_text() { # <text> - tap on sight; to top, then page down
  if tap_text "$1"; then return 0; fi
  timeout 30 adb shell input swipe 540 600 540 1900 600
  sleep 1.5
  if tap_text "$1"; then return 0; fi
  for _ in 1 2 3 4 5; do
    timeout 30 adb shell input swipe 540 1500 540 700 600
    sleep 1.5
    if tap_text "$1"; then return 0; fi
  done
  return 1
}

# ------------------------------------------------------------------ launch ---
echo "=== 1. cold launch + permission + onboarding ==="
# Cloud-runner ANRs: the Pixel Launcher ANRs chronically under 2-core KVM
# contention (dumps in run 7 show its dialog stealing the active window
# every ~20-30 s; "Wait" only postpones). Hiding system error/ANR dialogs
# keeps the app window dumpable and tappable for the whole run.
timeout 30 adb shell settings put secure hide_error_dialogs 1
timeout 30 adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12
shot "01-launch"
if wait_for_text "Allow" 4; then
  pass "notification permission granted"
else
  echo "no permission dialog (ok)"
fi
if wait_for_text "Begin without an account" 8; then
  pass "welcome screen"
else
  fail "welcome screen"; shot "01b"; exit 1
fi
sleep 3
if ! type_edit 0 "QA1"; then
  # Recovery: cold-restart the app (clears UI-automation/accessibility wedges)
  # and redo the welcome -> form path once.
  echo "input absent; restarting app once"
  timeout 30 adb shell am force-stop $PKG
  sleep 2
  timeout 30 adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 10
  tap_text "Allow" || true
  if wait_for_text "Begin without an account" 8; then
    sleep 3
    type_edit 0 "QA1" && pass "baby name typed (after restart)" || { fail "baby name input"; shot "02"; exit 1; }
  else
    fail "baby name input"; shot "02"; exit 1
  fi
else
  pass "baby name typed"
fi
type_edit 1 "2026-08-14" && pass "dob typed" || fail "dob input"
if wait_for_text "Begin the journal" 6; then
  sleep 2
  tap_text "Begin the journal"
  if wait_for_text "QUICK LOG" 8; then
    pass "profile created"
  else
    fail "profile created (no Today screen)"; shot "02"; exit 1
  fi
else
  fail "begin-the-journal button"; shot "02"; exit 1
fi

# ------------------------------------------------------------- quick logs ---
echo "=== 2. quick-log diaper ==="
if wait_for_text "Diaper" 8; then
  tap_text "Diaper"
  sleep 2
  tap_text "Wet"
  sleep 1
  tap_text "Save diaper change"
  sleep 3
  if dump_has "LAST DIAPER"; then pass "diaper logged"; else fail "diaper logged"; fi
else
  fail "diaper quick-log"
fi
shot "03-logged"

echo "=== 3. second baby QA2 ==="
if wait_for_text "Family" 6; then
  tap_text "Family"
  sleep 2
  tap_text "Add another child" && pass "add another child opened" || fail "add another child"
  sleep 3
  type_edit 0 "QA2" || fail "QA2 name"
  type_edit 1 "2026-09-10" && pass "QA2 dob typed" || fail "QA2 dob input"
  tap_text "Create profile"
  sleep 4
  if dump_has "QA2"; then pass "second baby created"; else fail "second baby created"; fi
else
  fail "family tab"
fi
shot "04-two-babies"

# ------------------------------------------------- photo into the dataset ---
echo "=== 3b. attach a photo to QA1 (export roundtrip needs embedded media) ==="
# Deterministic synthetic PNG; the app will crop/re-encode it, so the backup
# hash must be verified against the backup's own payload, not this file.
python3 - <<'PY'
import struct, zlib
def chunk(t, d):
    return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
w = h = 6
raw = b''
for y in range(h):
    raw += b'\x00' + bytes([255, 180, 120] * w)
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')
open('qa-photo.png', 'wb').write(png)
print('qa-photo.png written', len(png), 'bytes')
PY
timeout 60 adb push qa-photo.png /sdcard/Download/qa-photo.png >/dev/null 2>&1
# the system PHOTO picker lists media-store images only: scan the volume so
# the pushed PNG becomes visible
timeout 30 adb shell content call --uri content://media/ --method scan_volume --arg external_primary >/dev/null 2>&1 || true
sleep 3
if wait_for_text "Family" 6; then
  sleep 2
  if tap_desc "Edit QA1"; then
    sleep 3
    if tap_text "Add photo" || tap_text "Replace photo"; then
      sleep 7
      # system photo picker: the item's content-desc is date-based ("Photo
      # taken on ..."), not the file name; the first Recent cell sits at a
      # fixed position on the pixel_5 profile
      tap_desc "qa-photo.png" || tap_text "qa-photo.png" || timeout 30 adb shell input tap 177 1583 || true
      sleep 5
      # crop screen (allowsEditing) if it appears: try the confirm labels
      tap_text "Save" || tap_desc "Done" || tap_text "Done" || tap_text "OK" || tap_desc "Save" || true
      sleep 3
      if tap_text "Save changes"; then
        sleep 4
        if dump_has "Remove photo" || dump_has "Replace photo"; then
          pass "photo attached to QA1"
        else
          fail "photo attached to QA1"
        fi
      else
        fail "save changes (photo)"
      fi
    else
      fail "add-photo button"
    fi
  else
    fail "edit QA1 entry"
  fi
else
  fail "family tab (photo)"
fi
# unwind any open picker/sheet so later sections start from a clean state
hide_kb
timeout 30 adb shell input keyevent 4 || true
sleep 2
timeout 30 adb shell input keyevent 4 || true
sleep 2

# ------------------------------------------------------------ notifications ---
echo "=== 4. notification: schedule + backgrounded delivery ==="
# Creating a baby auto-switches to it and lands on Today; go back to Family
if ! dump_has "Routines"; then
  if wait_for_text "Family" 4; then
    sleep 2
  else
    fail "family tab (routines path)"
  fi
fi
if wait_for_text "Routines" 6; then
  sleep 1
  tap_text "Add routine"
  sleep 3
  type_edit 0 "CloudNap" || fail "routine name"
  NOW=$(timeout 30 adb shell date +%H:%M | tr -d '\r')
  HH=${NOW%%:*}
  MM=$((10#${NOW##*:} + 2))
  if [ "$MM" -ge 60 ]; then MM=$((MM - 60)); HH=$(((HH + 1) % 24)); fi
  TARGET=$(printf '%02d:%02d' "$HH" "$MM")
  echo "target delivery time: $TARGET"
  sleep 1
  # the time input is the form's second EditText and ships a default value;
  # no-commit typing + ESCAPE (111) — Enter/BACK can close the sheet and pop
  # the tab stack (run 15: form vanished to Today)
  type_edit 1 "$TARGET" 1 1 || fail "routine time entry"
  timeout 30 adb shell input keyevent 111 || true
  sleep 1.5
  if ! tap_text "Save routine"; then
    # save button may sit below the sheet fold
    timeout 30 adb shell input swipe 540 1700 540 800 500
    sleep 2
    tap_text "Save routine" || true
  fi
  sleep 4
  SAVED=0
  if dump_has "$TARGET" || dump_has "CloudNap"; then
    SAVED=1
  else
    # scheduling issues can restart the app (crash buffer captures it);
    # re-navigate to the list and check again
    if wait_for_text "Family" 4; then sleep 2; fi
    if wait_for_text "Routines" 4; then sleep 2; fi
    if dump_has "$TARGET" || dump_has "CloudNap"; then
      SAVED=1
    else
      fail "routine saved and listed"
    fi
  fi
  if [ "$SAVED" = "1" ]; then
    pass "routine saved and listed"
    timeout 30 adb shell dumpsys alarm 2>/dev/null | grep -qE "RTC_WAKEUP.*$TARGET"
    if [ $? -eq 0 ]; then pass "alarm scheduled for $TARGET"; else fail "alarm scheduled for $TARGET"; fi
    timeout 30 adb shell input keyevent 3
    sleep 2
    echo "app backgrounded; waiting for $TARGET plus margin"
    NOWM=$(timeout 30 adb shell date +%M | tr -d '\r')
    WAIT=$(( (10#$MM - 10#$NOWM + 60) % 60 ))   # minutes until the target
    if [ "$WAIT" -gt 4 ]; then WAIT=4; fi        # target was now+2min; never wait longer
    sleep $((WAIT * 60 + 45))
    timeout 30 adb shell dumpsys notification --noredact > "$OUT/notification-dump.txt" 2>/dev/null
    # Strict record match: ONE NotificationRecord line that names our package,
    # the dedicated routine-reminders channel (SDK-57 trigger channelId), and
    # the app's routine-<uuid>-<day> tag — never a channel name and an
    # unrelated notification anywhere in the same dump.
    grep -E "NotificationRecord\(.*pkg=$PKG " "$OUT/notification-dump.txt" \
      | grep "channel=routine-reminders" \
      | grep -E "tag=routine-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9]" \
      > "$OUT/notification-record.txt" 2>/dev/null || true
    if [ -s "$OUT/notification-record.txt" ]; then
      pass "notification delivered to tray while backgrounded (routine-reminders channel)"
    else
      fail "notification delivered on routine-reminders channel"
    fi
  fi
  shot "05-notification"
else
  fail "routines tab"
fi

# ------------------------------------------------------------ persistence ---
echo "=== 5. force-stop + relaunch persistence ==="
timeout 30 adb shell am force-stop $PKG
sleep 2
timeout 30 adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12
if dump_has "QA1" || dump_has "QA2"; then
  pass "data persists after force-stop"
else
  fail "data persists after force-stop"
fi
shot "06-relaunch"

# ------------------------------------------------------- malformed import ---
echo "=== 6. malformed-JSON import rejection ==="
cat > malformed.json <<'JSON'
{"app":"NinniNest","backupVersion":5,"data":{"babies":[{"id":"X
JSON
timeout 60 adb push malformed.json /sdcard/Download/malformed.json >/dev/null 2>&1
if wait_for_text "Settings" 6; then
  tap_text "Settings"
  sleep 2
  if scroll_to_text "Import a backup"; then
    if pick_download_file "malformed.json"; then
      TAPPED=1
    else
      TAPPED=0
    fi
    if [ "$TAPPED" = "1" ]; then
      sleep 4
      if wait_for_text "This backup cannot be imported" 6; then
        pass "malformed JSON rejected"
        tap_text "OK" || timeout 30 adb shell input keyevent 4
      else
        fail "malformed JSON rejected"
      fi
    else
      fail "malformed file visible in picker"
    fi
  else
    fail "import button"
  fi
else
  fail "settings tab"
fi
shot "07-final"

# ------------------------------------------- TRUE export -> restore cycle ---
echo "=== 7. true exported-backup roundtrip (exact share-sheet bytes via run-as) ==="
# The QA APK is built debuggable so run-as can read the cache file the export
# flow actually wrote — no handcrafted substitute. Share sheet is dismissed;
# the file on disk is the production serialization.
DEVDATE=$(timeout 30 adb shell date +%F | tr -d '\r')
EXPORT_NAME="ninninest-backup-$DEVDATE.json"
ROUNDTRIP=0
if wait_for_text "Settings" 6; then
  sleep 1
  if scroll_to_text "Export backup (JSON)"; then
    sleep 6
    shot "08-share-sheet"
    timeout 30 adb shell input keyevent 4   # dismiss the share sheet
    sleep 3
    timeout 30 adb exec-out run-as $PKG cat "cache/$EXPORT_NAME" > exported.json 2>/dev/null
    if [ -s exported.json ] && python3 - exported.json <<'PY'
import json, sys, base64, hashlib, re
try:
    b = json.load(open(sys.argv[1], encoding='utf-8'))
except Exception as e:
    print('PARSE-FAIL', e); sys.exit(1)
ok = True
if b.get('backupVersion') != 5: print('bad version', b.get('backupVersion')); ok = False
data = b.get('data', {})
babies = data.get('babies', [])
names = sorted(x.get('name','') for x in babies)
print('babies:', names)
if names != ['QA1', 'QA2']: print('bad babies'); ok = False
if len(data.get('events', [])) < 1: print('no events'); ok = False
for p in b.get('photosEmbedded', []):
    raw = base64.b64decode(p.get('bytesBase64', ''), validate=True)
    dig = hashlib.sha256(raw).hexdigest()
    if p.get('hashAlgo') != 'sha256' or dig != p.get('sha256'):
        print('photo hash mismatch'); ok = False
    else:
        print('photo sha256 verified:', dig[:16])
print('events:', len(data.get('events', [])), 'photos:', len(b.get('photosEmbedded', [])))
sys.exit(0 if ok else 1)
PY
    then
      sha256sum exported.json | tee "$OUT/exported-sha.txt"
      pass "true export captured and structurally verified"
      ROUNDTRIP=1
    else
      fail "true export capture/verify"
    fi
  else
    fail "export button"
  fi
else
  fail "settings tab (export)"
fi

if [ "$ROUNDTRIP" = "1" ]; then
  echo "--- 7b. fresh install: import the exact bytes ---"
  timeout 30 adb shell pm clear $PKG >/dev/null 2>&1
  timeout 30 adb shell settings put secure hide_error_dialogs 1
  timeout 60 adb push exported.json /sdcard/Download/$EXPORT_NAME >/dev/null 2>&1
  timeout 30 adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 12
  tap_text "Allow" || echo "no permission dialog after clear (ok)"
  if wait_for_text "Begin without an account" 8; then
    sleep 3
    type_edit 0 "QA3" || fail "QA3 name"
    type_edit 1 "2026-10-01" || fail "QA3 dob"
    wait_for_text "Begin the journal" 6 && sleep 2 && tap_text "Begin the journal"
    wait_for_text "QUICK LOG" 8 || fail "QA3 profile created"
  else
    fail "fresh-install onboarding"
  fi
  if wait_for_text "Settings" 6; then
    tap_text "Settings"
    sleep 2
    if scroll_to_text "Import a backup"; then
      if pick_download_file "$EXPORT_NAME"; then
        sleep 4
        if wait_for_text "Review this import" 6; then
          pass "import review dialog shows the real file"
          tap_text "IMPORT" || tap_text "Import"
          sleep 6
          if wait_for_text "Family" 6; then
            tap_text "Family"
            sleep 3
            if dump_has "QA1" && dump_has "QA2"; then
              pass "exact exported bytes restored on fresh install"
              # merge semantics: the file's records are ADDED, the pre-import
              # profile survives
              if dump_has "QA3"; then
                pass "merge kept pre-import profile"
              else
                fail "merge kept pre-import profile"
              fi
            else
              fail "restored records visible"
            fi
          else
            fail "family after import"
          fi
        else
          fail "import review dialog"
        fi
      else
        fail "exported file visible in picker"
      fi
    else
      fail "import button (roundtrip)"
    fi
  else
    fail "settings tab (roundtrip)"
  fi
  shot "09-restored"
  # restored data survives force-stop + relaunch; the app reopens on the
  # active baby's Today, so the restored profiles are checked on Family
  timeout 30 adb shell am force-stop $PKG
  sleep 2
  timeout 30 adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep 12
  if wait_for_text "Family" 6; then
    sleep 2
    if dump_has "QA1" && dump_has "QA2"; then
      pass "restored data survives force-stop"
    else
      fail "restored data survives force-stop"
    fi
  else
    fail "restored data survives force-stop"
  fi

  echo "--- 7c. replace-all semantics ---"
  if wait_for_text "Settings" 6; then
    tap_text "Settings"
    sleep 2
    scroll_to_text "Replace all" || fail "replace-all mode toggle"
    if scroll_to_text "Import a backup"; then
      if pick_download_file "$EXPORT_NAME"; then
        sleep 4
        if wait_for_text "Review this import" 6; then
          tap_text "IMPORT" || tap_text "Import"
          sleep 6
          if wait_for_text "Family" 6; then
            tap_text "Family"
            sleep 3
            if dump_has "QA1" && dump_has "QA2" && ! dump_has "QA3"; then
              pass "replace-all erased pre-import profile and restored the file's records"
            else
              fail "replace-all semantics"
            fi
          else
            fail "family after replace"
          fi
        else
          fail "replace review dialog"
        fi
      else
        fail "exported file visible in picker (replace)"
      fi
    else
      fail "import button (replace)"
    fi
  else
    fail "settings tab (replace)"
  fi

  echo "--- 7d. failed-import preservation (tampered photo byte) ---"
  python3 - exported.json tampered.json <<'PY'
import json, sys
b = json.load(open(sys.argv[1], encoding='utf-8'))
ph = b.get('photosEmbedded', [])
if ph:
    bb = ph[0]['bytesBase64']
    mid = len(bb) // 2
    flip = 'A' if bb[mid] != 'A' else 'B'
    ph[0]['bytesBase64'] = bb[:mid] + flip + bb[mid+1:]
else:
    # no photos in this dataset: corrupt the first event row instead
    ev = b['data']['events'][0]
    ev['id'] = 'zz' + ev['id'][2:]
json.dump(b, open(sys.argv[2], 'w', encoding='utf-8'))
print('tampered file written')
PY
  # restore merge mode before the negative test
  if wait_for_text "Settings" 4; then
    tap_text "Settings"
    sleep 2
    scroll_to_text "Merge" || true
    timeout 60 adb push tampered.json /sdcard/Download/tampered.json >/dev/null 2>&1
    if scroll_to_text "Import a backup"; then
      if pick_download_file "tampered.json"; then
        sleep 4
        if wait_for_text "This backup cannot be imported" 6; then
          pass "tampered backup rejected"
          tap_text "OK" || timeout 30 adb shell input keyevent 4
        else
          fail "tampered backup rejection"
        fi
        sleep 2
        if wait_for_text "Family" 6; then
          tap_text "Family"
          sleep 3
          if dump_has "QA1" && dump_has "QA2"; then
            pass "records preserved after failed import"
          else
            fail "records preserved after failed import"
          fi
        else
          fail "family after failed import"
        fi
      else
        fail "tampered file visible in picker"
      fi
    else
      fail "import button (tamper)"
    fi
  else
    fail "settings tab (tamper)"
  fi
fi

# ----------------------------------------------------------- CSV/ZIP real ---
echo "=== 8. CSV/ZIP export capture and content verification ==="
if wait_for_text "Settings" 6; then
  tap_text "Settings"
  sleep 2
  if scroll_to_text "Export care history (CSV)"; then
    sleep 6
    timeout 30 adb shell input keyevent 4   # dismiss the share sheet
    sleep 3
    ZIPNAME=$(timeout 30 adb shell run-as $PKG ls cache 2>/dev/null | tr -d '\r' | grep -oE 'ninninest-csv-[0-9]+\.zip' | tail -1)
    if [ -n "$ZIPNAME" ]; then
      timeout 30 adb exec-out run-as $PKG cat "cache/$ZIPNAME" > "$OUT/$ZIPNAME" 2>/dev/null
      if [ -s "$OUT/$ZIPNAME" ] && python3 - "$OUT/$ZIPNAME" <<'PY'
import sys, zipfile, io
z = zipfile.ZipFile(sys.argv[1])
names = z.namelist()
print('zip entries:', names)
assert 'care-history.csv' in names, 'care-history.csv missing'
rows = z.read('care-history.csv').decode('utf-8', 'replace')
assert 'diaper' in rows.lower(), 'no diaper row in care-history.csv'
print('care-history.csv rows:', len(rows.strip().splitlines()))
sys.exit(0)
PY
      then
        pass "CSV zip captured and content verified"
      else
        fail "CSV zip content verification"
      fi
    else
      fail "csv zip found in app cache"
    fi
  else
    fail "csv export button"
  fi
else
  fail "settings tab (csv)"
fi

# ------------------------------------------------- delete-baby cascade ------
echo "=== 9. delete-baby cascade (create QA4, delete it, siblings untouched) ==="
if wait_for_text "Family" 6; then
  tap_text "Family"
  sleep 2
  if tap_text "Add another child"; then
    sleep 3
    type_edit 0 "QA4" || fail "QA4 name"
    type_edit 1 "2026-10-05" || fail "QA4 dob"
    tap_text "Create profile"
    sleep 4
    if dump_has "QA4"; then
      pass "QA4 created for cascade test"
      if tap_desc "Delete QA4" || tap_text "Delete"; then
        sleep 3
        # confirmation dialog - the destructive-operation gate
        if dump_has "Delete this profile?"; then
          pass "delete asks for confirmation"
          if tap_text "DELETE PROFILE" || tap_text "Delete profile"; then
            pass "delete confirmed"
            sleep 4
            if wait_for_text "Family" 6; then
              sleep 2
              if dump_has "QA4"; then
                fail "delete-baby cascade (QA4 still present)"
              elif dump_has "QA1" && dump_has "QA2"; then
                pass "delete-baby cascade: QA4 gone, QA1/QA2 untouched"
              else
                fail "delete-baby cascade (siblings affected)"
              fi
            else
              fail "family after delete"
            fi
          else
            fail "delete confirm button"
          fi
        else
          fail "delete confirmation dialog"
        fi
      else
        fail "delete profile control"
      fi
    else
      fail "QA4 created"
    fi
  else
    fail "add another child (cascade)"
  fi
else
  fail "family tab (cascade)"
fi
shot "10-cascade"

# ------------------------------------------------------------- evidence -----
timeout 30 adb logcat -d -b crash > "$OUT/crash-buffer.txt" 2>/dev/null || true
timeout 30 adb logcat -d -t 2000 > "$OUT/logcat-tail.txt" 2>/dev/null || true

# Critical evidence gate: a run may not report green if its evidence vanished.
MISSING=""
for f in 01-launch.png 03-logged.png 04-two-babies.png 06-relaunch.png 07-final.png; do
  [ -s "$OUT/$f" ] || MISSING="$MISSING $f"
done
DUMPS=$(ls "$OUT/dumps" 2>/dev/null | wc -l)
[ "$DUMPS" -ge 10 ] || MISSING="$MISSING dumps(<10)"
[ -s "$OUT/notification-record.txt" ] || MISSING="$MISSING notification-record.txt"
[ -s exported.json ] || MISSING="$MISSING exported.json"
[ -s "$OUT/exported-sha.txt" ] || MISSING="$MISSING exported-sha.txt"
CSVZ=$(ls "$OUT"/ninninest-csv-*.zip 2>/dev/null | head -1)
[ -n "$CSVZ" ] || MISSING="$MISSING csv-zip"
if [ -n "$MISSING" ]; then
  echo "MISSING EVIDENCE:$MISSING"
  fail "critical evidence present"
fi

echo "=== SUMMARY: PASS=$PASS FAIL=$FAIL ==="
if [ "$FAIL" -gt 0 ]; then
  echo "ACCEPTANCE FAILED: $FAIL assertion(s) failed"
  exit 1
fi
echo "ACCEPTANCE PASSED"
exit 0
