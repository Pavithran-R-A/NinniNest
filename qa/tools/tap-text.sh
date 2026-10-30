#!/bin/bash
# Deterministic tap: dumps the UI, finds the exact text, taps its center.
# Usage: tap-text.sh <serial> <exact-text>
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
SERIAL="$1"
TEXT="$2"
"$ADB" -s "$SERIAL" shell uiautomator dump //sdcard/tapdump.xml >/dev/null 2>&1
"$ADB" -s "$SERIAL" shell cat //sdcard/tapdump.xml > "$TEMP/tapdump.xml" 2>/dev/null
python - "$TEXT" "$TEMP/tapdump.xml" <<'PYEOF'
import re, sys
text = sys.argv[1]
s = open(sys.argv[2], encoding='utf-8').read()
m = re.search(r'text="' + re.escape(text) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
if not m:
    print('NOT_FOUND')
    sys.exit(2)
x1, y1, x2, y2 = map(int, m.groups())
print((x1 + x2) // 2, (y1 + y2) // 2)
PYEOF
