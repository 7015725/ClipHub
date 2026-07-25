#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).with_name("apply_release_review_p1.py")
text = path.read_text(encoding="utf-8")

text = text.replace("old_save = '''    function saveFromInput() {", "old_save = r'''    function saveFromInput() {", 1)
text = text.replace("new_save = '''    function saveFromInput() {", "new_save = r'''    function saveFromInput() {", 1)

old = '''replace_once(
    "src/ch_15_app.js",
    '            after = closeUi();\\n            return { ok: true, command: command, action: "hidden",',
    '            after = closeUi("control_hide");\\n'
    '            return { ok: true, command: command, action: "hidden",'
)
replace_once(
    "src/ch_15_app.js",
    '            after = closeUi();\\n            return { ok: true, command: command, action: "hidden",\\n'
    '                status: after };\\n        }\\n        after = showUi().status;',
    '            after = closeUi("control_toggle_hide");\\n'
    '            return { ok: true, command: command, action: "hidden",\\n'
    '                status: after };\\n        }\\n        after = showUi().status;'
)
'''

new = '''replace_once(
    "src/ch_15_app.js",
    '        if (command === "hide") {\\n'
    '            after = closeUi();\\n'
    '            return { ok: true, command: command, action: "hidden",\\n'
    '                status: after };\\n'
    '        }',
    '        if (command === "hide") {\\n'
    '            after = closeUi("control_hide");\\n'
    '            return { ok: true, command: command, action: "hidden",\\n'
    '                status: after };\\n'
    '        }'
)
replace_once(
    "src/ch_15_app.js",
    '        before = uiStatus();\\n'
    '        if (before.uiVisible) {\\n'
    '            after = closeUi();\\n'
    '            return { ok: true, command: command, action: "hidden",\\n'
    '                status: after };\\n'
    '        }\\n'
    '        after = showUi().status;',
    '        before = uiStatus();\\n'
    '        if (before.uiVisible) {\\n'
    '            after = closeUi("control_toggle_hide");\\n'
    '            return { ok: true, command: command, action: "hidden",\\n'
    '                status: after };\\n'
    '        }\\n'
    '        after = showUi().status;'
)
'''

if text.count(old) != 1:
    raise RuntimeError("P1 correction target count=%d" % text.count(old))
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("corrected P1 patch script")
