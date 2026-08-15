#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path('.')
SETTINGS = ROOT / 'src/ch_13_settings.js'
MANIFEST = ROOT / 'module-manifest.json'
PREFLIGHT = ROOT / 'scripts/release_preflight.sh'


def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode('ascii') + b'\0' + data).hexdigest()


def replace_once(text, old, new, label):
    count = text.count(old)
    assert count == 1, (label, count)
    return text.replace(old, new, 1)


def unpack(path):
    loader = path.read_text(encoding='utf-8')
    match = re.search(r'\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);', loader, re.S)
    assert match is not None
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(2))
    source = gzip.decompress(base64.b64decode(''.join(json.loads(x) for x in pieces))).decode('utf-8')
    expected = re.search(r'\bvar\s+SOURCE_SHA256\s*=\s*["\']([0-9a-fA-F]{64})["\']', loader)
    assert expected is not None
    actual = hashlib.sha256(source.encode('utf-8')).hexdigest()
    assert actual == expected.group(1).lower(), (actual, expected.group(1))
    return loader, match.group(1), source


def repack(path, loader, variable, source):
    raw = gzip.compress(source.encode('utf-8'), compresslevel=9, mtime=0)
    encoded = base64.b64encode(raw).decode('ascii')
    chunks = [encoded[i:i + 120] for i in range(0, len(encoded), 120)]
    expression = '\n        ' + ' +\n        '.join(json.dumps(c) for c in chunks) + '\n    '
    pattern = re.compile(r'(\bvar\s+' + re.escape(variable) + r'\s*=\s*)(.*?)(;)', re.S)
    match = pattern.search(loader)
    assert match is not None
    loader = loader[:match.start(2)] + expression + loader[match.end(2):]
    source_sha = hashlib.sha256(source.encode('utf-8')).hexdigest()
    loader, count = re.subn(
        r'(\bvar\s+SOURCE_SHA256\s*=\s*["\'])[0-9a-fA-F]{64}(["\'])',
        lambda m: m.group(1) + source_sha + m.group(2), loader, count=1)
    assert count == 1
    path.write_text('\n'.join(line.rstrip() for line in loader.splitlines()) + '\n', encoding='utf-8')


def function_span(text, name):
    match = re.search(r'(^|\n)([ \t]*)function\s+' + re.escape(name) + r'\s*\(', text, re.M)
    assert match is not None, name
    start = match.start(2)
    brace = text.find('{', match.end())
    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    index = brace
    while index < len(text):
        char = text[index]
        nxt = text[index + 1] if index + 1 < len(text) else ''
        if line_comment:
            if char == '\n': line_comment = False
        elif block_comment:
            if char == '*' and nxt == '/': block_comment = False; index += 1
        elif quote is not None:
            if escaped: escaped = False
            elif char == '\\': escaped = True
            elif char == quote: quote = None
        else:
            if char == '/' and nxt == '/': line_comment = True; index += 1
            elif char == '/' and nxt == '*': block_comment = True; index += 1
            elif char in ('"', "'"): quote = char
            elif char == '{': depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0: return start, index + 1
        index += 1
    raise RuntimeError('unterminated function: ' + name)


loader, variable, source = unpack(SETTINGS)
assert source.count('MODULE_VERSION: 36') == 1
start, end = function_span(source, 'makeRegexRuleRow')
row = source[start:end]

# Behavior/touch contracts must already exist and remain intact.
for required in (
    'toggleRegexRuleEnabledFromSettings(rule.id, !enabled);',
    'openRegexEditor(rule.id);',
    'duplicateRegexRuleFromSettings(rule.id);',
    'deleteRegexRuleConfirmed(rule.id, deleteView);',
    'bindRegexRuleDrag(handleHit, root, rule.id);',
    'new LinearLayout.LayoutParams(dp(40), dp(40))',
    'makeRegexTouchWrapper(toggleView, 32)',
    'makeRegexTouchWrapper(edit, 34)',
    'makeRegexTouchWrapper(duplicate, 34)',
    'makeRegexTouchWrapper(deleteView, 34)'
):
    assert required in row, required

row = replace_once(
    row,
    '        root.setPadding(dp(9), dp(8), dp(9), dp(8));',
    '        /* regex_rule_card_home_density_v1 */\n'
    '        root.setPadding(dp(9), dp(6), dp(9), dp(6));',
    'rule card vertical padding')
row = replace_once(
    row,
    '        root.setBackground(roundedBackground(colors.surfaceMuted,\n'
    '            colors.stroke, layout.cardRadiusDp));',
    '        root.setBackground(roundedBackground(colors.surface,\n'
    '            colors.stroke, layout.cardRadiusDp));',
    'rule card surface')
row = replace_once(row, '            params.topMargin = dp(3);', '            params.topMargin = dp(2);', 'note gap')
row = replace_once(row, '        params.topMargin = dp(7);', '        params.topMargin = dp(5);', 'actions gap')

for required in (
    'toggleRegexRuleEnabledFromSettings(rule.id, !enabled);',
    'openRegexEditor(rule.id);',
    'duplicateRegexRuleFromSettings(rule.id);',
    'deleteRegexRuleConfirmed(rule.id, deleteView);',
    'bindRegexRuleDrag(handleHit, root, rule.id);',
    'new LinearLayout.LayoutParams(dp(40), dp(40))',
    'makeRegexTouchWrapper(toggleView, 32)',
    'makeRegexTouchWrapper(edit, 34)',
    'makeRegexTouchWrapper(duplicate, 34)',
    'makeRegexTouchWrapper(deleteView, 34)'
):
    assert required in row, required

source = source[:start] + row + source[end:]
source = replace_once(source, 'MODULE_VERSION: 36', 'MODULE_VERSION: 37', 'settings version')
repack(SETTINGS, loader, variable, source)

manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
assert manifest['sourceRef'] == 'beta-regex-settings-tabs-20260814'
assert manifest['moduleSetVersion'] == '20260815.20'
manifest['moduleSetVersion'] = '20260815.21'
found = False
for item in manifest['modules']:
    if item['name'] == 'ch_13_settings.js':
        item['sha'] = blob_sha(SETTINGS.read_bytes())
        found = True
assert found
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

preflight = PREFLIGHT.read_text(encoding='utf-8')
preflight = replace_once(preflight, "EXPECTED_MODULE_SET='20260815.20'", "EXPECTED_MODULE_SET='20260815.21'", 'module set')
preflight = replace_once(preflight,
    '"ch_13_settings.js": ("ch_13_settings", 36),',
    '"ch_13_settings.js": ("ch_13_settings", 37),', 'settings contract')
anchor = '        assert "function makeRegexTouchWrapper(view, visualHeightDp)" in settings_source\n'
preflight = replace_once(preflight, anchor,
    anchor + '        assert "regex_rule_card_home_density_v1" in settings_source\n',
    'density visual contract')
PREFLIGHT.write_text(preflight, encoding='utf-8')

print('Regex card density patch generated: Settings37 / 20260815.21')
