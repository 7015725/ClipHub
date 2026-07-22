#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-probe040-fix"
WORKFLOW_PATH=".github/workflows/cliphub-probe040-fix.yml"

if [ "$(git hash-object probes/cliphub_editor_keyboard_probe_040_impl.js)" != "9ae4ba891ac386b82bf3619ba5a56ab4f65ffe53" ]; then
  echo "Unexpected probe 040 impl base" >&2
  exit 1
fi
if [ "$(git hash-object probes/cliphub_editor_keyboard_probe_040.js)" != "684175c09817138943aa2979000b02c1b992f39d" ]; then
  echo "Unexpected probe 040 loader base" >&2
  exit 1
fi

python3 - <<'PY'
from pathlib import Path

path = Path('probes/cliphub_editor_keyboard_probe_040_impl.js')
text = path.read_text(encoding='utf-8')
text = text.replace(
    '/* ClipHub new and edit visual probe 040. Rhino ES5 only. */',
    '/* ClipHub editor keyboard and long-text probe 040. Rhino ES5 only. */', 1)
old = '''            result.setShortText = global.ClipHub.Editor.setInputText(shortText);
            if (!waitFor(function () {
                    var current = global.ClipHub.Editor.getState();
                    if (!current.keyboardVisible &&
                            current.keyboardRequestedOnOpen === true) {
                        global.ClipHub.Editor.requestKeyboard();
                    }
                    return current.attachedToWindow === true &&'''
new = '''            result.setShortText = global.ClipHub.Editor.setInputText(shortText);
            result.keyboardRetry = global.ClipHub.Editor.requestKeyboard();
            if (!waitFor(function () {
                    var current = global.ClipHub.Editor.getState();
                    return current.attachedToWindow === true &&'''
if text.count(old) != 1:
    raise SystemExit('keyboard wait marker not found')
text = text.replace(old, new, 1)
text = text.replace(
    'probe: "cliphub_editor_ui_probe_040",',
    'probe: "cliphub_editor_keyboard_probe_040",', 1)
path.write_text(text, encoding='utf-8')
PY

node --check probes/cliphub_editor_keyboard_probe_040_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add probes/cliphub_editor_keyboard_probe_040_impl.js
git commit -m "fix: stabilize editor keyboard probe 040"
implementation_commit="$(git rev-parse HEAD)"

python3 - "$implementation_commit" <<'PY'
from pathlib import Path
import sys

path = Path('probes/cliphub_editor_keyboard_probe_040.js')
text = path.read_text(encoding='utf-8')
text = text.replace(
    '/* ClipHub new and edit visual probe 040 loader. Rhino ES5 only. */',
    '/* ClipHub editor keyboard and long-text probe 040 loader. Rhino ES5 only. */', 1)
text = text.replace(
    '05a7db5ec2aa7822d59417750df97ad0f034c1c9',
    sys.argv[1], 1)
text = text.replace(
    'source.indexOf("cliphub_editor_ui_probe_040") < 0',
    'source.indexOf("cliphub_editor_keyboard_probe_040") < 0', 1)
path.write_text(text, encoding='utf-8')
PY

node --check probes/cliphub_editor_keyboard_probe_040.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git add probes/cliphub_editor_keyboard_probe_040.js
git rm -rf "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "fix: pin corrected editor keyboard probe 040"
git push origin "HEAD:$BRANCH"
