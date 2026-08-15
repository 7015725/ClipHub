import base64
import gzip
import json
import re
from pathlib import Path


def unpack(path):
    text = Path(path).read_text(encoding='utf-8')
    match = re.search(r'\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);', text, re.S)
    if match is None:
        return text
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(1))
    return gzip.decompress(
        base64.b64decode(''.join(json.loads(piece) for piece in pieces))
    ).decode('utf-8')


def print_context(label, source, patterns, radius=7):
    lines = source.splitlines()
    print('\n===== ' + label + ' =====')
    emitted = set()
    for pattern in patterns:
        for index, line in enumerate(lines):
            if pattern in line:
                start = max(0, index - radius)
                end = min(len(lines), index + radius + 1)
                key = (start, end)
                if key in emitted:
                    continue
                emitted.add(key)
                print('\n--- pattern: ' + pattern + ' @ line ' + str(index + 1) + ' ---')
                for row in range(start, end):
                    print('%05d: %s' % (row + 1, lines[row]))


filter_source = unpack('src/ch_11_filter.js')
settings_source = unpack('src/ch_13_settings.js')

print_context('HOME / PRIMARY HOST', filter_source, [
    'dragHandleWidthDp',
    'dragHandleHeightDp',
    'dragHandleTopDp',
    'dragHandleBottomDp',
    'headerTopOffsetDp',
    'headerBottomGapDp',
    'actionSizeDp',
    'headerHeightDp',
    'mountPrimaryChildPage',
    'primaryHeader',
    'closeView',
    '全局剪切板'
])

print_context('SETTINGS ROOT', settings_source, [
    'ClipHub 设置',
    'dragHandleWidthDp',
    'dragHandleHeightDp',
    'dragHandleTopDp',
    'dragHandleBottomDp',
    'headerTopOffsetDp',
    'headerBottomGapDp',
    'actionSizeDp',
    'headerHeightDp',
    'makeSettings',
    'closeView',
    'headerClose',
    'makeText("×"',
    'makeText("+"',
    'makeText("⚙"'
])
