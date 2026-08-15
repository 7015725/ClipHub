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


def unpack(path):
    loader = path.read_text(encoding='utf-8')
    match = re.search(r'\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);', loader, re.S)
    assert match is not None
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(2))
    source = gzip.decompress(base64.b64decode(''.join(json.loads(p) for p in pieces))).decode('utf-8')
    sha_match = re.search(r'\bvar\s+SOURCE_SHA256\s*=\s*["\']([0-9a-fA-F]{64})["\']', loader)
    assert sha_match is not None
    assert hashlib.sha256(source.encode('utf-8')).hexdigest() == sha_match.group(1).lower()
    return loader, match.group(1), source


def repack(path, loader, variable, source):
    raw = gzip.compress(source.encode('utf-8'), compresslevel=9, mtime=0)
    packed = base64.b64encode(raw).decode('ascii')
    chunks = [packed[i:i + 120] for i in range(0, len(packed), 120)]
    expression = '\n        ' + ' +\n        '.join(json.dumps(chunk) for chunk in chunks) + '\n    '
    pattern = re.compile(r'(\bvar\s+' + re.escape(variable) + r'\s*=\s*)(.*?)(;)', re.S)
    match = pattern.search(loader)
    assert match is not None
    loader = loader[:match.start(2)] + expression + loader[match.end(2):]
    source_sha = hashlib.sha256(source.encode('utf-8')).hexdigest()
    loader, count = re.subn(
        r'(\bvar\s+SOURCE_SHA256\s*=\s*["\'])[0-9a-fA-F]{64}(["\'])',
        lambda value: value.group(1) + source_sha + value.group(2),
        loader,
        count=1
    )
    assert count == 1
    path.write_text('\n'.join(line.rstrip() for line in loader.splitlines()) + '\n', encoding='utf-8')


def function_span(source, name):
    match = re.search(r'(^|\n)([ \t]*)function\s+' + re.escape(name) + r'\s*\(', source, re.M)
    assert match is not None, name
    start = match.start(2)
    brace = source.find('{', match.end())
    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    index = brace
    while index < len(source):
        char = source[index]
        nxt = source[index + 1] if index + 1 < len(source) else ''
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
    raise RuntimeError('unterminated ' + name)


def replace_once(text, old, new, label):
    count = text.count(old)
    assert count == 1, (label, count)
    return text.replace(old, new, 1)


loader, variable, source = unpack(SETTINGS)
assert source.count('MODULE_VERSION: 37') == 1
start, end = function_span(source, 'buildRootPage')
root_page = source[start:end]

old_handle = '''        (function () {
            var handleRow = new LinearLayout(appContext);
            var handle = new View(appContext);
            if (!embeddedInPrimary) {
        handleRow.setGravity(Gravity.CENTER);
            handle.setBackground(roundedBackground(colors.accentBorder,
                null, 3));
            handleRow.addView(handle,
                new LinearLayout.LayoutParams(dp(42), dp(4)));
            content.addView(handleRow, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));
            }
        }());'''

new_handle = '''        (function () {
            var handleSlot = new FrameLayout(appContext);
            var handle = new View(appContext);
            var handleParams;
            if (!embeddedInPrimary) {
                /* settings_root_home_header_baseline_v1 */
                handle.setBackground(roundedBackground(colors.accentBorder,
                    null, 3));
                handleParams = new FrameLayout.LayoutParams(
                    dp(layoutTokens.dragHandleWidthDp || 42),
                    dp(layoutTokens.dragHandleHeightDp || 4));
                handleParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
                handleParams.topMargin = dp(6);
                handleSlot.addView(handle, handleParams);
                content.addView(handleSlot, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, dp(12)));
            }
        }());'''
root_page = replace_once(root_page, old_handle, new_handle, 'settings root 12dp handle slot')
root_page = replace_once(
    root_page,
    '        closeView.setBackground(roundedBackground(colors.surfaceMuted,\n            null, 18));',
    '        closeView.setBackground(roundedBackground(colors.surfaceMuted,\n            null, layoutMetrics.actionSizeDp / 2));\n'
    '        closeView.setContentDescription("关闭 ClipHub 设置");',
    'settings close dynamic circle'
)
root_page = replace_once(
    root_page,
    '        params.topMargin = dp(layoutTokens.headerTopOffsetDp);',
    '        /* Home header follows the 12dp drag slot directly. */\n'
    '        params.topMargin = 0;',
    'settings root header top baseline'
)
source = source[:start] + root_page + source[end:]
source = replace_once(source, 'MODULE_VERSION: 37', 'MODULE_VERSION: 38', 'settings version')

assert 'settings_root_home_header_baseline_v1' in source
assert 'handleParams.topMargin = dp(6);' in root_page
assert 'LinearLayout.LayoutParams.MATCH_PARENT, dp(12))' in root_page
assert 'params.topMargin = 0;' in root_page
assert 'params.bottomMargin = dp(layoutTokens.headerBottomGapDp);' in root_page
assert 'layoutMetrics.actionSizeDp / 2' in root_page
assert 'closeView.setContentDescription("关闭 ClipHub 设置")' in root_page
repack(SETTINGS, loader, variable, source)

manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
assert manifest['sourceRef'] == 'beta-regex-settings-tabs-20260814'
assert manifest['moduleSetVersion'] == '20260815.21'
manifest['moduleSetVersion'] = '20260815.22'
found = False
for item in manifest['modules']:
    if item['name'] == 'ch_13_settings.js':
        item['sha'] = blob_sha(SETTINGS.read_bytes())
        found = True
assert found
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

preflight = PREFLIGHT.read_text(encoding='utf-8')
preflight = replace_once(preflight,
    "EXPECTED_MODULE_SET='20260815.21'",
    "EXPECTED_MODULE_SET='20260815.22'", 'module set contract')
preflight = replace_once(preflight,
    '"ch_13_settings.js": ("ch_13_settings", 37),',
    '"ch_13_settings.js": ("ch_13_settings", 38),', 'settings contract')
anchor = '        assert "settings_regex_card_home_density_v1" in settings_source\n'
if anchor in preflight:
    preflight = replace_once(preflight, anchor,
        anchor + '        assert "settings_root_home_header_baseline_v1" in settings_source\n',
        'settings header preflight contract')
else:
    anchor = '        assert "standalone_subpage_home_drag_baseline" in settings_source\n'
    preflight = replace_once(preflight, anchor,
        anchor + '        assert "settings_root_home_header_baseline_v1" in settings_source\n',
        'settings header preflight fallback contract')
PREFLIGHT.write_text(preflight, encoding='utf-8')

print('Settings root header baseline patch generated')
