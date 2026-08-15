import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path('.')
SETTINGS = ROOT / 'src/ch_13_settings.js'
EDITOR = ROOT / 'src/ch_10_editor.js'
MANIFEST = ROOT / 'module-manifest.json'
PREFLIGHT = ROOT / 'scripts/release_preflight.sh'


def blob_sha(data):
    return hashlib.sha1(
        b'blob ' + str(len(data)).encode('ascii') + b'\0' + data
    ).hexdigest()


def unpack(path):
    loader = path.read_text(encoding='utf-8')
    match = re.search(
        r'\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);', loader, re.S
    )
    if match is None:
        return loader, None, loader
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(2))
    source = gzip.decompress(
        base64.b64decode(''.join(json.loads(piece) for piece in pieces))
    ).decode('utf-8')
    expected = re.search(
        r'\bvar\s+SOURCE_SHA256\s*=\s*["\']([0-9a-fA-F]{64})["\']',
        loader
    )
    assert expected is not None
    actual = hashlib.sha256(source.encode('utf-8')).hexdigest()
    assert actual == expected.group(1).lower(), (path, actual, expected.group(1))
    return loader, match.group(1), source


def repack(path, loader, variable, source):
    raw = gzip.compress(source.encode('utf-8'), compresslevel=9, mtime=0)
    packed = base64.b64encode(raw).decode('ascii')
    chunks = [packed[i:i + 120] for i in range(0, len(packed), 120)]
    expression = '\n        ' + ' +\n        '.join(
        json.dumps(chunk) for chunk in chunks
    ) + '\n    '
    pattern = re.compile(
        r'(\bvar\s+' + re.escape(variable) + r'\s*=\s*)(.*?)(;)', re.S
    )
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
    path.write_text(
        '\n'.join(line.rstrip() for line in loader.splitlines()) + '\n',
        encoding='utf-8'
    )


def function_span(text, name):
    match = re.search(
        r'(^|\n)([ \t]*)function\s+' + re.escape(name) + r'\s*\(',
        text,
        re.M
    )
    assert match is not None, name
    start = match.start(2)
    brace = text.find('{', match.end())
    assert brace >= 0
    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    index = brace
    while index < len(text):
        char = text[index]
        next_char = text[index + 1] if index + 1 < len(text) else ''
        if line_comment:
            if char == '\n':
                line_comment = False
        elif block_comment:
            if char == '*' and next_char == '/':
                block_comment = False
                index += 1
        elif quote is not None:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = None
        else:
            if char == '/' and next_char == '/':
                line_comment = True
                index += 1
            elif char == '/' and next_char == '*':
                block_comment = True
                index += 1
            elif char in ('"', "'"):
                quote = char
            elif char == '{':
                depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0:
                    return start, index + 1
        index += 1
    raise RuntimeError('unterminated function: ' + name)


def replace_once(text, old, new, label):
    count = text.count(old)
    assert count == 1, (label, count)
    return text.replace(old, new, 1)


# Settings / Regex: preserve compact visuals while keeping >=40dp touch owners.
settings_loader, settings_variable, settings = unpack(SETTINGS)
assert settings_variable is not None
assert settings.count('MODULE_VERSION: 35') == 1

start, end = function_span(settings, 'makeSettingsSubpageHeader')
header = settings[start:end]
header = replace_once(
    header,
    '        var header = new LinearLayout(appContext);\n',
    '        var handleRow = new LinearLayout(appContext);\n'
    '        var dragHandle = new View(appContext);\n'
    '        var header = new LinearLayout(appContext);\n',
    'regex standalone handle vars'
)
header = replace_once(
    header,
    '        var params;\n        header.setOrientation(LinearLayout.HORIZONTAL);',
    '        var params;\n'
    '        /* standalone_subpage_home_drag_baseline */\n'
    '        handleRow.setGravity(Gravity.CENTER);\n'
    '        dragHandle.setBackground(roundedBackground(\n'
    '            colors.accentBorder, null, 3));\n'
    '        handleRow.addView(dragHandle, new LinearLayout.LayoutParams(\n'
    '            dp(layout.dragHandleWidthDp || 42),\n'
    '            dp(layout.dragHandleHeightDp || 4)));\n'
    '        content.addView(handleRow, new LinearLayout.LayoutParams(\n'
    '            LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));\n'
    '        header.setOrientation(LinearLayout.HORIZONTAL);',
    'regex standalone handle insertion'
)
settings = settings[:start] + header + settings[end:]

wrapper = (
    '    function makeRegexTouchWrapper(view, visualHeightDp) {\n'
    '        var hit = new FrameLayout(appContext);\n'
    '        var visualParams = new FrameLayout.LayoutParams(\n'
    '            FrameLayout.LayoutParams.MATCH_PARENT, dp(visualHeightDp));\n'
    '        visualParams.gravity = Gravity.CENTER;\n'
    '        hit.addView(view, visualParams);\n'
    '        hit.setClickable(true);\n'
    '        hit.setFocusable(false);\n'
    '        hit.setOnClickListener(new JavaAdapter(View.OnClickListener, {\n'
    '            onClick: function () { view.performClick(); }\n'
    '        }));\n'
    '        return hit;\n'
    '    }\n\n'
)
anchor = '    function makeRegexRuleRow(rule, colors) {'
assert settings.count(anchor) == 1
settings = settings.replace(anchor, wrapper + anchor, 1)

start, end = function_span(settings, 'makeRegexRuleRow')
row = settings[start:end]
row = replace_once(
    row,
    '        titleRow.addView(toggleView, new LinearLayout.LayoutParams(dp(64), dp(40)));',
    '        titleRow.addView(makeRegexTouchWrapper(toggleView, 32),\n'
    '            new LinearLayout.LayoutParams(dp(64), dp(40)));',
    'regex toggle compact visual'
)
row = replace_once(
    row,
    '        actions.addView(edit, new LinearLayout.LayoutParams(0, dp(40), 1));',
    '        actions.addView(makeRegexTouchWrapper(edit, 34),\n'
    '            new LinearLayout.LayoutParams(0, dp(40), 1));',
    'regex edit compact visual'
)
row = replace_once(
    row,
    '        actions.addView(duplicate, params);',
    '        actions.addView(makeRegexTouchWrapper(duplicate, 34), params);',
    'regex duplicate compact visual'
)
row = replace_once(
    row,
    '        actions.addView(deleteView, params);',
    '        actions.addView(makeRegexTouchWrapper(deleteView, 34), params);',
    'regex delete compact visual'
)
settings = settings[:start] + row + settings[end:]

start, end = function_span(settings, 'buildRegexTestPage')
test_page = settings[start:end]
test_page = replace_once(
    test_page,
    '        sourceRow.addView(manual, new LinearLayout.LayoutParams(0, dp(40), 1));',
    '        sourceRow.addView(makeRegexTouchWrapper(manual, 34),\n'
    '            new LinearLayout.LayoutParams(0, dp(40), 1));',
    'regex test manual compact visual'
)
test_page = replace_once(
    test_page,
    '        sourceRow.addView(clipboard, params);',
    '        sourceRow.addView(makeRegexTouchWrapper(clipboard, 34), params);',
    'regex test clipboard compact visual'
)
test_page = replace_once(
    test_page,
    '        sourceRow.addView(latest, params);',
    '        sourceRow.addView(makeRegexTouchWrapper(latest, 34), params);',
    'regex test latest compact visual'
)
settings = settings[:start] + test_page + settings[end:]
settings = replace_once(
    settings, 'MODULE_VERSION: 35', 'MODULE_VERSION: 36', 'settings version'
)
assert 'standalone_subpage_home_drag_baseline' in settings
assert 'function makeRegexTouchWrapper(view, visualHeightDp)' in settings
assert 'bindRegexRuleDrag(handleHit, root, rule.id);' in settings
assert 'Math.abs(delta) >= dp(28)' in settings
assert 'Math.min(dp(64)' in settings
repack(SETTINGS, settings_loader, settings_variable, settings)


# Editor: move only the visible standalone handle inside the same 12dp budget.
editor = EDITOR.read_text(encoding='utf-8')
assert editor.count('MODULE_VERSION: 32') == 1
start, end = function_span(editor, 'buildTextContent')
text_builder = editor[start:end]
text_builder = replace_once(
    text_builder,
    '        var dragHandle = new View(appContext);\n',
    '        var dragSlot = new FrameLayout(appContext);\n'
    '        var dragHandle = new View(appContext);\n',
    'editor drag slot var'
)
old_drag = (
    '        dragHandle.setBackground(roundedBackground(\n'
    '            colors.accentBorder, null, 3));\n'
    '        params = new LinearLayout.LayoutParams(dp(42), dp(4));\n'
    '        params.gravity = Gravity.CENTER_HORIZONTAL;\n'
    '        params.bottomMargin = dp(8);\n'
    '        panelRoot.addView(dragHandle, params);\n'
    '        if (embeddedInPrimary) { dragHandle.setVisibility(View.GONE); }\n'
    '        state.dragHandlePresent = embeddedInPrimary !== true;'
)
new_drag = (
    '        dragHandle.setBackground(roundedBackground(\n'
    '            colors.accentBorder, null, 3));\n'
    '        params = new FrameLayout.LayoutParams(dp(42), dp(4));\n'
    '        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;\n'
    '        params.topMargin = dp(6);\n'
    '        dragSlot.addView(dragHandle, params);\n'
    '        panelRoot.addView(dragSlot, new LinearLayout.LayoutParams(\n'
    '            LinearLayout.LayoutParams.MATCH_PARENT, dp(12)));\n'
    '        if (embeddedInPrimary) { dragSlot.setVisibility(View.GONE); }\n'
    '        state.dragHandlePresent = embeddedInPrimary !== true;'
)
text_builder = replace_once(
    text_builder, old_drag, new_drag, 'editor home handle baseline'
)
editor = editor[:start] + text_builder + editor[end:]
editor = replace_once(
    editor, 'MODULE_VERSION: 32', 'MODULE_VERSION: 33', 'editor version'
)
EDITOR.write_text(editor, encoding='utf-8')


# Manifest and preflight contracts.
manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
assert manifest['sourceRef'] == 'beta-regex-settings-tabs-20260814'
assert manifest['moduleSetVersion'] == '20260815.19'
manifest['moduleSetVersion'] = '20260815.20'
found_settings = False
found_editor = False
for item in manifest['modules']:
    if item['name'] == 'ch_13_settings.js':
        item['sha'] = blob_sha(SETTINGS.read_bytes())
        found_settings = True
    if item['name'] == 'ch_10_editor.js':
        item['sha'] = blob_sha(EDITOR.read_bytes())
        found_editor = True
assert found_settings and found_editor
MANIFEST.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8'
)

preflight = PREFLIGHT.read_text(encoding='utf-8')
preflight = replace_once(
    preflight,
    "EXPECTED_MODULE_SET='20260815.19'",
    "EXPECTED_MODULE_SET='20260815.20'",
    'module set contract'
)
preflight = replace_once(
    preflight,
    '"ch_10_editor.js": ("ch_10_editor", 32),',
    '"ch_10_editor.js": ("ch_10_editor", 33),',
    'editor module contract'
)
preflight = replace_once(
    preflight,
    '"ch_13_settings.js": ("ch_13_settings", 35),',
    '"ch_13_settings.js": ("ch_13_settings", 36),',
    'settings module contract'
)
preflight = replace_once(
    preflight,
    '        assert "Math.abs(delta) >= dp(28)" in settings_source\n',
    '        assert "Math.abs(delta) >= dp(28)" in settings_source\n'
    '        assert "standalone_subpage_home_drag_baseline" in settings_source\n'
    '        assert "function makeRegexTouchWrapper(view, visualHeightDp)" in settings_source\n',
    'settings visual contracts'
)
preflight = replace_once(
    preflight,
    '        editor_source = actual_sources["ch_10_editor.js"]\n',
    '        editor_source = actual_sources["ch_10_editor.js"]\n'
    '        assert "var dragSlot = new FrameLayout(appContext);" in editor_source\n'
    '        assert "dragSlot.addView(dragHandle, params);" in editor_source\n',
    'editor visual contracts'
)
PREFLIGHT.write_text(preflight, encoding='utf-8')

print('Home baseline patch generated: Settings36 / Editor33 / 20260815.20')
