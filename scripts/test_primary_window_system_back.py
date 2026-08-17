\
#!/usr/bin/env python3
import base64
import gzip
import json
import re
from pathlib import Path


def expanded(path):
    text = Path(path).read_text(encoding='utf-8')
    match = re.search(r'\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);', text, re.S)
    if match is None:
        return text
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(1))
    encoded = ''.join(json.loads(piece) for piece in pieces)
    return gzip.decompress(base64.b64decode(encoded)).decode('utf-8')


def function_block(source, name):
    match = re.search(r'function\s+' + re.escape(name) + r'\s*\([^\n]*\)\s*\{', source)
    assert match is not None, name
    start = match.start()
    next_match = re.search(r'\n\s*function\s+[A-Za-z_$]', source[match.end():])
    end = len(source) if next_match is None else match.end() + next_match.start()
    return source[start:end]


nav = expanded('src/ch_12_translation.js')
flt = expanded('src/ch_11_filter.js')
shell = expanded('src/ch_16_ui_shell.js')

assert 'MODULE_NAME: "ch_14_navigation_embedded"' in nav
assert 'MODULE_VERSION: 9' in nav
assert 'PRIORITY_OVERLAY' in nav
assert 'PRIORITY_DEFAULT' in nav
assert 'OnBackInvokedCallback' in nav
assert 'OnBackAnimationCallback' in nav
assert 'KeyEvent.KEYCODE_BACK' in nav
assert 'ClipHub.UIShell.dispatchBack(' in nav
assert '"navigation_system_back", request' in nav
assert 'function beginSystemBackGesture(reason)' in nav
assert 'function resolveSystemBackGesture(reason)' in nav
assert 'function consumeSystemBackGesture(gestureId)' in nav
refresh = function_block(nav, 'refreshSystemBackCapture')
assert 'refreshEntryBackCallback' in refresh
assert 'requestFocus' not in refresh
entry_refresh = function_block(nav, 'refreshEntryBackCallback')
assert 'requestFocus' not in entry_refresh
assert 'unregisterOnBackInvokedCallback' in entry_refresh
assert 'registerOnBackInvokedCallback' in entry_refresh
assert 'refreshSystemBackCapture: refreshSystemBackCapture' in nav

mount = function_block(flt, 'mountPrimaryChildPage')
unmount = function_block(flt, 'unmountPrimaryChildPage')
assert 'refreshPrimarySystemBack("primary_child_mount")' in mount
assert 'refreshPrimarySystemBack("primary_child_unmount")' in unmount

for page_id in (
    'settings', 'regex_rules', 'editor', 'translation',
    'tokenizer', 'tokenizer_rules', 'tokenizer_rule_editor', 'detail'
):
    assert 'id: "' + page_id + '"' in shell, page_id
assert 'function dispatchBack(reason, request)' in shell
assert 'duplicateBackRequestCount' in shell
print('Primary window system Back contracts: passed')
