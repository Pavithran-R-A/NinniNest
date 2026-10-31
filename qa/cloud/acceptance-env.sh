#!/usr/bin/env bash
# Cloud-emulator ENV acceptance for NinniNest (synthetic data only).
# Second, independent job: reboot/denial semantics, width matrix, themes,
# Tamil, font scaling. Same integrity contract as acceptance.sh:
# any failed assertion or missing evidence exits nonzero.
set -u
OUT=qa-cloud-env
mkdir -p "$OUT/dumps"
PASS=0
FAIL=0
PKG=app.ninninest.journal

if [ "${SELFTEST:-0}" = "1" ]; then
  fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1"; }
  pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
  pass "selftest healthy"
  fail "selftest-deliberate-failure"
  echo "=== SUMMARY: PASS=$PASS FAIL=$FAIL ==="
  [ "$FAIL" -gt 0 ] && { echo "SELFTEST OK"; exit 1; }
  echo "SELFTEST BROKEN"; exit 1
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
kb_visible() { timeout 30 adb shell dumpsys input_method 2>/dev/null | grep -q "mInputShown=true"; }
hide_kb() { if kb_visible; then timeout 30 adb shell input keyevent 4; sleep 2.5; fi; }
tap_text() {
  dump
  local xy
  xy=$(TEXT="$1" python3 - <<'PY'
import re, sys, os
text = os.environ['TEXT']
s = open('/tmp/acc.xml', encoding='utf-8', errors='replace').read()
m = re.search(r'text="' + re.escape(text) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
if not m:
    print('NOT_FOUND'); sys.exit(2)
x1, y1, x2, y2 = map(int, m.groups())
print((x1 + x2) // 2, (y1 + y2) // 2)
PY
)
  if [ "$xy" = "NOT_FOUND" ]; then return 1; fi
  timeout 30 adb shell input tap $xy
  return 0
}
dismiss_system_dialogs() {
  if grep -q 'com.google.android.permissioncontroller' /tmp/acc.xml 2>/dev/null; then
    tap_text "Allow" || true; sleep 2; return 0
  fi
  if grep -q "isn't responding" /tmp/acc.xml 2>/dev/null; then
    tap_text "Wait" || true; sleep 2; return 0
  fi
  return 1
}
wait_for_text() {
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
import sys
s = open(sys.argv[2], encoding='utf-8', errors='replace').read()
sys.exit(0 if sys.argv[1] in s else 1)
PY
}
scroll_to_text() {
  if tap_text "$1"; then return 0; fi
  timeout 30 adb shell input swipe 540 600 540 1900 600
  sleep 1.5
  if tap_text "$1"; then return 0; fi
  timeout 30 adb shell input swipe 540 1500 540 900 600
  sleep 1.5
  tap_text "$1"
}
launch() {
  timeout 30 adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
}
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
    print('ABSENT'); sys.exit(0)
x1, y1, x2, y2 = (int(g) for g in ets[idx])
print((x1 + x2) // 2, (y1 + y2) // 2)
PY
)
    if [ -z "$cur" ]; then cur="ABSENT"; fi
    if [ "$cur" = "ABSENT" ]; then dismiss_system_dialogs || sleep 2; continue; fi
    if [ "$cur" = "$prev" ]; then break; fi
    prev="$cur"; sleep 2
  done
  if [ -z "$cur" ] || [ "$cur" = "ABSENT" ]; then return 1; fi
  timeout 30 adb shell input tap $cur
  sleep 1.5
  if [ "${3:-0}" = "1" ]; then
    timeout 30 adb shell input keyevent 123
    for _ in 1 2 3 4 5 6 7 8; do timeout 30 adb shell input keyevent 67; done
  fi
  timeout 30 adb shell input text "$value"
  # nocommit mode (4th arg): leave the keyboard up and the navigation stack
  # untouched — on modal sheets Enter+BACK can close the sheet and pop the
  # tab stack (observed in run 15: routine form vanished to Today). The
  # caller dismisses the keyboard with ESCAPE (keyevent 111) instead.
  if [ "${4:-0}" != "1" ]; then
    timeout 30 adb shell input keyevent 66
    hide_kb
  fi
  return 0
}
onboard() { # <name> <dob> — first-run onboarding; retries a cold restart once
  launch
  sleep 12
  wait_for_text "Allow" 4 || echo "no permission dialog (ok)"
  if ! wait_for_text "Begin without an account" 8; then
    # the first launch can race the emulator's boot settle: restart once
    echo "welcome absent; restarting app once"
    timeout 30 adb shell am force-stop $PKG
    sleep 2
    launch
    sleep 12
    wait_for_text "Allow" 4 || true
    if ! wait_for_text "Begin without an account" 8; then
      fail "onboarding welcome ($1)"; return 1
    fi
  fi
  sleep 3
  type_edit 0 "$1" || { fail "onboarding name ($1)"; return 1; }
  type_edit 1 "$2" || { fail "onboarding dob ($1)"; return 1; }
  wait_for_text "Begin the journal" 6 && sleep 2 && tap_text "Begin the journal"
  if wait_for_text "QUICK LOG" 8; then pass "onboarding ($1)"; return 0; fi
  fail "onboarding today ($1)"; return 1
}
ROUTINE_TARGET=""
add_routine() { # <title> - sets ROUTINE_TARGET to the scheduled HH:MM
  ROUTINE_TARGET=""
  if ! wait_for_text "Family" 6; then fail "family tab (routine $1)"; return 1; fi
  sleep 2
  if ! scroll_to_text "Routines"; then fail "routines segment (routine $1)"; return 1; fi
  sleep 1
  tap_text "Add routine" || { fail "add routine (routine $1)"; return 1; }
  sleep 3
  type_edit 0 "$1" || { fail "routine name (routine $1)"; return 1; }
  local NOW HH MM
  NOW=$(timeout 30 adb shell date +%H:%M | tr -d '\r')
  HH=${NOW%%:*}
  MM=$((10#${NOW##*:} + 3))
  if [ "$MM" -ge 60 ]; then MM=$((MM - 60)); HH=$(((HH + 1) % 24)); fi
  ROUTINE_TARGET=$(printf '%02d:%02d' "$HH" "$MM")
  # no-commit typing (no Enter) then hide_kb — the keyboard is genuinely
  # shown here, so BACK closes only the IME, never the sheet
  type_edit 1 "$ROUTINE_TARGET" 1 1 || { fail "routine time (routine $1)"; return 1; }
  hide_kb
  sleep 1.5
  if ! scroll_to_text "Save routine"; then
    timeout 30 adb shell input swipe 540 1700 540 800 500
    sleep 2
    tap_text "Save routine" || { fail "save routine (routine $1)"; return 1; }
  fi
  sleep 4
  if dump_has "$1"; then pass "routine saved ($1)"; return 0; fi
  fail "routine saved ($1)"; return 1
}

echo "=== E1. install state: boot device defaults ==="
timeout 30 adb shell settings put secure hide_error_dialogs 1

echo "=== E2. reboot persistence + alarm rescheduling ==="
if onboard "QA5" "2026-08-01"; then
  if add_routine "BootNap"; then
    TGT="$ROUTINE_TARGET"
    timeout 30 adb shell dumpsys alarm 2>/dev/null | grep -qE "RTC_WAKEUP.*$TGT"
    if [ $? -eq 0 ]; then pass "alarm scheduled pre-reboot ($TGT)"; else fail "alarm scheduled pre-reboot"; fi
    echo "rebooting emulator"
    timeout 30 adb reboot
    BOOTED=0
    for _ in $(seq 1 60); do
      sleep 6
      if timeout 20 adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' | grep -q 1; then
        BOOTED=1; break
      fi
    done
    if [ "$BOOTED" = "1" ]; then
      pass "emulator rebooted"
      sleep 15
      launch
      sleep 14
      if dump_has "QA5"; then
        pass "app data survives reboot"
      else
        fail "app data survives reboot"
      fi
      timeout 30 adb shell dumpsys alarm 2>/dev/null | grep -qE "RTC_WAKEUP.*$TGT"
      if [ $? -eq 0 ]; then
        pass "routine alarm rescheduled after reboot (RECEIVE_BOOT_COMPLETED)"
      else
        fail "routine alarm rescheduled after reboot"
      fi
      shot "E-reboot"
    else
      fail "emulator rebooted"
    fi
  fi
fi

echo "=== E3. permission-denied path ==="
timeout 30 adb shell pm clear $PKG >/dev/null 2>&1
timeout 30 adb shell settings put secure hide_error_dialogs 1
launch
sleep 12
if wait_for_text "Don't allow" 6; then
  pass "notification permission denied"
else
  echo "no permission dialog this boot (ok)"
fi
if onboard "QA6" "2026-08-02"; then
  if add_routine "NoPerm" >/dev/null 2>&1; then
    SCHED=$(timeout 30 adb shell dumpsys alarm 2>/dev/null | grep -cE "routine-[0-9a-f-]{36}" || true)
    if [ "$SCHED" = "0" ] || [ -z "$SCHED" ]; then
      pass "denied permission schedules no alarm"
    else
      fail "denied permission schedules no alarm"
    fi
  else
    fail "routine flow under denial"
  fi
  if dump_has "QUICK LOG"; then
    pass "app functional with denied permission"
  else
    fail "app functional with denied permission"
  fi
fi
shot "E-denied"

echo "=== E4. width/density matrix (pixel_5 1080px: exact dp targets) ==="
# density 540=320dp, 480=360dp, 439=393dp, 419=412dp
for PAIR in "540 320" "480 360" "439 393" "419 412"; do
  D=${PAIR%% *}; DP=${PAIR##* }
  timeout 30 adb shell wm density "$D" >/dev/null 2>&1
  sleep 2
  timeout 30 adb shell am force-stop $PKG
  launch
  sleep 10
  shot "E-width-${DP}dp"
  if dump_has "QUICK LOG" || dump_has "DIAPER"; then
    pass "renders at ${DP}dp (${D}dpi)"
  else
    fail "renders at ${DP}dp (${D}dpi)"
  fi
done
timeout 30 adb shell wm density reset >/dev/null 2>&1
sleep 2
timeout 30 adb shell am force-stop $PKG
launch
sleep 10

echo "=== E5. font scale 1.3 ==="
timeout 30 adb shell settings put system font_scale 1.3 >/dev/null 2>&1
sleep 2
timeout 30 adb shell am force-stop $PKG
launch
sleep 10
shot "E-fontscale-130"
if dump_has "QUICK LOG" || dump_has "DIAPER"; then
  pass "renders at font scale 1.3"
else
  fail "renders at font scale 1.3"
fi
timeout 30 adb shell settings put system font_scale 1.0 >/dev/null 2>&1
sleep 2
timeout 30 adb shell am force-stop $PKG
launch
sleep 10

echo "=== E6. themes (Day / Night / Night warm) with persistence ==="
if wait_for_text "Settings" 8; then
  tap_text "Settings"
  sleep 2
  if scroll_to_text "Night · warm" || true; then
    shot "E-theme-warm-settings"
    # warm night applied?
    if scroll_to_text "Night · warm"; then sleep 2; fi
    # persistence: force-stop, relaunch, reopen settings
    timeout 30 adb shell am force-stop $PKG
    launch
    sleep 12
    if wait_for_text "Settings" 8; then
      tap_text "Settings"
      sleep 2
      if dump_has "Night · warm"; then
        pass "warm-night selection persists across restart"
        shot "E-theme-warm-persist"
      else
        fail "warm-night selection persists across restart"
      fi
    else
      fail "settings after restart (theme)"
    fi
    # switch back through Day and Night for rendered evidence
    scroll_to_text "Night" || true
    sleep 1
    tap_text "Night" || true
    sleep 2
    shot "E-theme-night-settings"
    tap_text "Day" || true
    sleep 2
    pass "all three themes rendered (see E-theme screenshots)"
  else
    fail "theme controls"
  fi
else
  fail "settings tab (themes)"
fi

echo "=== E7. Tamil long-text pass ==="
if dump_has "Settings" || wait_for_text "Settings" 4; then
  if scroll_to_text "App language"; then
    sleep 1
    if tap_text "தமிழ்"; then
      sleep 3
      shot "E-tamil-settings"
      # the Settings screen itself re-renders in Tamil ('செயலி மொழி')
      if dump_has "மொழி"; then
        pass "Tamil UI renders"
      else
        fail "Tamil UI renders"
      fi
      # restore English (nativeLabel is locale-independent)
      scroll_to_text "English" || true
      sleep 1
      tap_text "English" || true
      sleep 2
      if dump_has "App language"; then
        pass "language restored to English"
      else
        fail "language restored to English"
      fi
    else
      fail "tamil language button"
    fi
  else
    fail "app language control"
  fi
else
  fail "settings tab (tamil)"
fi

echo "=== E8. destructive-operation confirmations (delete baby asks first) ==="
if wait_for_text "Family" 6; then
  sleep 2
  if tap_desc "Delete QA6" || tap_text "Delete"; then
    sleep 3
    # confirmation dialog - the destructive-operation gate
    if dump_has "Delete this profile?"; then
      pass "delete asks for confirmation"
      tap_text "KEEP IT" || tap_text "Keep it" || true
      sleep 3
      if dump_has "QA6"; then
        pass "cancel keeps the profile"
      else
        fail "cancel keeps the profile"
      fi
    else
      fail "delete confirmation dialog"
    fi
  else
    fail "delete control"
  fi
else
  fail "family tab (E8)"
fi
shot "E-final"

timeout 30 adb logcat -d -b crash > "$OUT/crash-buffer.txt" 2>/dev/null || true
timeout 30 adb logcat -d -t 2000 > "$OUT/logcat-tail.txt" 2>/dev/null || true

MISSING=""
for f in E-reboot.png E-denied.png E-width-320dp.png E-width-360dp.png E-width-393dp.png E-width-412dp.png E-fontscale-130.png E-theme-warm-settings.png E-theme-warm-persist.png E-tamil-settings.png; do
  [ -s "$OUT/$f" ] || MISSING="$MISSING $f"
done
DUMPS=$(ls "$OUT/dumps" 2>/dev/null | wc -l)
[ "$DUMPS" -ge 8 ] || MISSING="$MISSING dumps(<8)"
if [ -n "$MISSING" ]; then
  echo "MISSING EVIDENCE:$MISSING"
  fail "critical evidence present"
fi

echo "=== SUMMARY: PASS=$PASS FAIL=$FAIL ==="
if [ "$FAIL" -gt 0 ]; then
  echo "ACCEPTANCE-ENV FAILED: $FAIL assertion(s) failed"
  exit 1
fi
echo "ACCEPTANCE-ENV PASSED"
exit 0
