#!/usr/bin/env python3
import base64
import gzip
import json
import re
from pathlib import Path

TARGETS = [
    'src/ch_08_window.js',
    'src/ch_09_list.js',
    'src/ch_10_editor.js',
    'src/ch_11_filter.js',
    'src/ch_12_translation.js',
    'src/ch_13_settings.js',
    'src/ch_17_tokenizer_ui.js',
]

def unpack(path):
    text = Path(path).read_text(encoding='utf-8')
    m = re.search(r'\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);', text, re.S)
    if not m:
        return text
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', m.group(1))
    return gzip.decompress(base64.b64decode(
        ''.join(json.loads(x) for x in pieces))).decode('utf-8')

for path in TARGETS:
    src = unpack(path)
    print('\n===== %s =====' % path)
    version = re.search(r'MODULE_NAME:\s*"([^"]+)"\s*,\s*MODULE_VERSION:\s*(\d+)', src, re.S)
    if version:
        print('module=%s version=%s' % (version.group(1), version.group(2)))
    seen = set()
    for line in src.splitlines():
        stripped = line.strip()
        lower = stripped.lower()
        if any(word in lower for word in [
            'embeddedinprimary', 'attachedtowindow', 'managedwindowcount',
            'managedwindowroles', 'pendingsaferemove',
            'panelwidthdp', 'panelheightdp', 'normalpanelheightdp',
            'currentpanelheightdp', 'currentpaneltopdp', 'softinput',
            'ime', 'inputfocused', 'keyboardrequestcount', 'rootmode',
            'childattached', 'childpageid', 'homecachepreserved',
        ]):
            if ':' in stripped and stripped not in seen:
                seen.add(stripped)
                print(stripped)
