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

def function_context(src, marker, radius=5000):
    pos = src.find(marker)
    if pos < 0:
        return '<missing>'
    return src[pos:min(len(src), pos + radius)]

for path in TARGETS:
    src = unpack(path)
    print('\n===== %s =====' % path)
    for marker in [
        'function getState()',
        'function getDetailState()',
        'function getPanelState()',
        'function getPrimaryHostState()',
        'function getTranslationState()',
        'function getRemovalState()',
    ]:
        if marker in src:
            print('\n--- %s ---' % marker)
            print(function_context(src, marker))
