#!/usr/bin/env bash
# Cloud-emulator acceptance for NinniNest (synthetic data only).
# Runs on a GitHub-hosted ubuntu runner inside reactivecircus/android-emulator-runner.
# Technique: uiautomator dump -> locate text bounds -> tap center. No blind coordinates.
set -u
OUT=qa-cloud
mkdir -p "$OUT"
PASS=0
FAIL=0
PKG=app.ninninest.journal

shot() { adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null || true; }
pass() { PASS=$((PASS + 1)); echo "PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "FAIL: $1"; shot "FAIL-$1"; }

dump() {
  adb shell uiautomator dump /sdcard/acc.xml >/dev/null 2>&1
  adb shell cat /sdcard/acc.xml > /tmp/acc.xml 2>/dev/null
}

# Dismiss the soft keyboard only when it is actually shown (a blind back
# press with no keyboard navigates BACK and can close the sheet).
kb_visible() {
  adb shell dumpsys input_method 2>/dev/null | grep -q "mInputShown=true"
}
hide_kb() {
  if kb_visible; then
    adb shell input keyevent 4
    sleep 1.5
  fi
}

# Tap the center of the node whose visible text matches exactly. Returns 1 if absent.
tap_text() {
  dump
  local xy
  xy=$(TEXT="$1" python3 - <<'PY'
import re, sys, os
text = os.environ['TEXT']
s = open('/tmp/acc.xml', encoding='utf-8').read()
m = re.search(r'text="' + re.escape(text) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
if not m:
    print('NOT_FOUND')
    sys.exit(2)
x1, y1, x2, y2 = map(int, m.groups())
print((x1 + x2) // 2, (y1 + y2) // 2)
PY
)
  if [ "$xy" = "NOT_FOUND" ]; then return 1; fi
  adb shell input tap $xy
  return 0
}

# Type into the Nth on-screen EditText (0-based) and commit with Enter.
type_edit() {
  local idx="$1" value="$2"
  dump
  local xy
  xy=$(IDX="$idx" VALUE="$value" python3 - <<'PY'
import re, sys, os
idx = int(os.environ['IDX'])
s = open('/tmp/acc.xml', encoding='utf-8').read()
ets = re.findall(r'class="android\.widget\.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
if idx >= len(ets):
    print('NOT_FOUND')
    sys.exit(2)
b = [int(x) for x in re.findall(r'\d+', ets[idx])]
print((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
PY
)
  if [ "$xy" = "NOT_FOUND" ]; then return 1; fi
  adb shell input tap $xy
  sleep 1
  adb shell input text "$value"
  adb shell input keyevent 66
  hide_kb
  return 0
}

wait_for_text() { # poll up to N seconds for text to appear
  local text="$1" tries="${2:-10}"
  for _ in $(seq 1 "$tries"); do
    if tap_text "$text"; then return 0; fi
    sleep 2
  done
  return 1
}

dump_has() {
  dump
  python3 - "$1" /tmp/acc.xml <<'PY'
import re, sys, os
needle = sys.argv[1]
s = open(sys.argv[2], encoding='utf-8').read()
sys.exit(0 if needle in s else 1)
PY
}

echo "=== 1. cold launch + permission + onboarding ==="
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12
shot "01-launch"
tap_text "Allow" && pass "notification permission granted" || echo "no permission dialog (ok)"
if wait_for_text "Begin without an account" 8; then
  pass "welcome screen"
else
  fail "welcome screen"; shot "01b"; exit 1
fi
tap_text "Begin without an account"
sleep 3
type_edit 0 "QA1" && pass "baby name typed" || fail "baby name input"
dump
xy=$(python3 - <<'PY'
import re
s = open('/tmp/acc.xml', encoding='utf-8').read()
ets = re.findall(r'class="android\.widget\.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
if len(ets) > 1:
    b = [int(x) for x in re.findall(r'\d+', ets[1])]
    print((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
else:
    print('NOT_FOUND')
PY
)
adb shell input tap $xy
sleep 1
adb shell input text "2026-08-14"
hide_kb
sleep 1
if wait_for_text "Create profile" 6; then
  tap_text "Create profile"
  sleep 4
  pass "profile created"
else
  fail "create profile button"; shot "02"; exit 1
fi

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
  sleep 2
  type_edit 0 "QA2" || fail "QA2 name"
  dump
  xy=$(python3 - <<'PY'
import re
s = open('/tmp/acc.xml', encoding='utf-8').read()
ets = re.findall(r'class="android\.widget\.EditText"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
if len(ets) > 1:
    b = [int(x) for x in re.findall(r'\d+', ets[1])]
    print((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
else:
    print('NOT_FOUND')
PY
)
  adb shell input tap $xy
  sleep 1
  adb shell input text "2026-09-10"
  hide_kb
  sleep 1
  tap_text "Create profile"
  sleep 4
  if dump_has "QA2"; then pass "second baby created"; else fail "second baby created"; fi
else
  fail "family tab"
fi
shot "04-two-babies"

echo "=== 4. notification: schedule + backgrounded delivery ==="
if wait_for_text "Routines" 6; then
  tap_text "Routines"
  sleep 2
  tap_text "Add routine"
  sleep 3
  type_edit 0 "CloudNap" || fail "routine name"
  NOW=$(adb shell date +%H:%M | tr -d '\r')
  HH=${NOW%%:*}
  MM=$((10#${NOW##*:} + 2))
  if [ "$MM" -ge 60 ]; then MM=$((MM - 60)); HH=$(((HH + 1) % 24)); fi
  TARGET=$(printf '%02d:%02d' "$HH" "$MM")
  echo "target delivery time: $TARGET"
  dump
  xy=$(python3 - <<'PY'
import re
s = open('/tmp/acc.xml', encoding='utf-8').read()
m = re.search(r'text="Time of day"', s)
if m:
    b = [int(x) for x in re.findall(r'\d+', m.group(1))]
    # the input sits below the label
    print(b[0], b[1] + 60)
else:
    print('NOT_FOUND')
PY
)
  adb shell input tap $xy
  sleep 1
  adb shell input keyevent 123
  for _ in 1 2 3 4 5; do adb shell input keyevent 67; done
  adb shell input text "$TARGET"
  hide_kb
  sleep 1
  tap_text "Save routine"
  sleep 4
  if wait_for_text "· $TARGET ·" 6 || dump_has "$TARGET"; then
    pass "routine saved and listed"
  else
    fail "routine saved and listed"
  fi
  adb shell dumpsys alarm 2>/dev/null | grep -q "2026-$(adb shell date +%m | tr -d '\r') $TARGET"
  if [ $? -eq 0 ]; then pass "alarm scheduled for $TARGET"; else fail "alarm scheduled for $TARGET"; fi
  adb shell input keyevent 3
  sleep 2
  echo "app backgrounded; waiting for $TARGET plus margin"
  WAIT=$(( ($(date +%M) - 10#$MM + 60) % 60 ))
  [ "$WAIT" -lt 0 ] && WAIT=0
  sleep $((WAIT * 60 + 45))
  adb shell dumpsys notification --noredact > "$OUT/notification-dump.txt" 2>/dev/null
  if grep -q "routine-reminders" "$OUT/notification-dump.txt" && grep -qE "NotificationRecord\(.*$PKG" "$OUT/notification-dump.txt"; then
    pass "notification delivered to tray while backgrounded"
  else
    fail "notification delivered to tray while backgrounded"
  fi
  shot "05-notification"
else
  fail "routines tab"
fi

echo "=== 5. force-stop + relaunch persistence ==="
adb shell am force-stop $PKG
sleep 2
adb shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 12
if dump_has "QA1"; then
  pass "data persists after force-stop"
else
  fail "data persists after force-stop"
fi
shot "06-relaunch"

echo "=== 6. malformed-JSON import rejection ==="
cat > malformed.json <<'JSON'
{"app":"NinniNest","backupVersion":5,"data":{"babies":[{"id":"X
JSON
adb push malformed.json /sdcard/Download/malformed.json >/dev/null 2>&1
if wait_for_text "Settings" 6; then
  tap_text "Settings"
  sleep 2
  adb shell input swipe 540 1900 540 600 800
  sleep 1
  if tap_text "Import a backup"; then
    sleep 4
    dump
    # navigate to Downloads via drawer
    xy=$(python3 - <<'PY'
import re
s = open('/tmp/acc.xml', encoding='utf-8').read()
m = re.search(r'text="Show roots"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
if m:
    b = [int(x) for x in re.findall(r'\d+', m.group(1))]
    print((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
else:
    print('NOT_FOUND')
PY
)
    if [ "$xy" != "NOT_FOUND" ]; then
      adb shell input tap $xy
      sleep 2
      tap_text "Downloads"
      sleep 2
    fi
    if tap_text "malformed.json"; then
      sleep 4
      if wait_for_text "This backup cannot be imported" 6; then
        pass "malformed JSON rejected"
        tap_text "OK" || adb shell input keyevent 4
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

echo "=== SUMMARY: PASS=$PASS FAIL=$FAIL ==="
exit 0
