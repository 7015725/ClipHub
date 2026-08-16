#!/usr/bin/env python3
from pathlib import Path
import base64
import gzip
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'


def expand(path):
    text = path.read_text(encoding='utf-8')
    match = re.search(r'\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);', text, re.S)
    if match is None:
        return text
    literals = re.findall(r'"(?:\\.|[^"\\])*"', match.group(1))
    if not literals:
        raise AssertionError('packed payload missing: ' + path.name)
    payload = ''.join(json.loads(value) for value in literals)
    return gzip.decompress(base64.b64decode(payload)).decode('utf-8')


def fail(message):
    raise AssertionError(message)


sources = {path.name: expand(path) for path in sorted(SRC.glob('ch_*.js'))}

list_source = sources['ch_09_list.js']
editor_source = sources['ch_10_editor.js']
filter_source = sources['ch_11_filter.js']
translation_source = sources['ch_12_translation.js']
settings_source = sources['ch_13_settings.js']
app_source = sources['ch_15_app.js']
shell_source = sources['ch_16_ui_shell.js']

# Normal product routes must prefer the Primary Window UIShell.
assert 'ClipHub.UIShell.canEmbed("detail") === true' in list_source
assert 'ClipHub.UIShell.mountPage("detail"' in list_source
assert 'ClipHub.UIShell.canEmbed("editor") === true' in editor_source
assert 'function mountPrimaryEditorPage()' in editor_source
assert 'ClipHub.UIShell.canEmbed("translation") === true' in translation_source
assert 'ClipHub.UIShell.mountPage("translation"' in translation_source
assert 'ClipHub.UIShell.canEmbed("settings") === true' in settings_source
assert 'ClipHub.UIShell.mountPage("settings"' in settings_source

# The four standalone windows are deliberate compatibility bridges. Keep them
# guarded; do not let them become the normal navigation route again.
assert 'detailWindowManager.addView(detailWindowRoot, detailParams)' in list_source
assert 'windowManager.addView(panelWindowRoot, panelParams)' in editor_source
assert 'windowManager.addView(translationWindowRoot, translationParams)' in translation_source
assert 'windowManager.addView(panelWindowRoot, panelParams)' in settings_source
assert 'role: "settings"' in settings_source

# Filter is the Primary Home host. Both public entry points must force rootMode.
assert re.search(
    r'showPanel:\s*function\s*\(options\)\s*\{\s*'
    r'options\s*=\s*options\s*\|\|\s*\{\};\s*'
    r'options\.rootMode\s*=\s*true;\s*'
    r'return\s+showPanel\(options\);\s*\}',
    filter_source,
    re.S,
)
assert re.search(
    r'showRoot:\s*function\s*\(options\)\s*\{\s*'
    r'options\s*=\s*options\s*\|\|\s*\{\};\s*'
    r'options\.rootMode\s*=\s*true;',
    filter_source,
    re.S,
)
assert 'filter_overlay' in filter_source
assert 'registerPage({ id: "filter"' not in shell_source

# Primary child header icon controls must use the existing ShortX Remix drawable bridge.
assert 'primary_child_shortx_icon_args_v1' in filter_source
assert 'makeHeaderAction("×", "关闭", colors, metrics, false)' in filter_source
assert 'makeHeaderAction("‹", "返回", colors, metrics, false)' in filter_source
assert 'makeHeaderAction("×", colors, metrics, false)' not in filter_source
assert 'makeHeaderAction("‹", colors, metrics, false)' not in filter_source
assert 'var view = makeIcon(iconText, metrics.iconSp,' in filter_source
assert 'decoratePanelIcon(view, text, view.getCurrentTextColor(), sizeSp, true)' in filter_source

# No external product caller may reopen the historical filter overlay route.
external_calls = []
for name, source in sources.items():
    if name == 'ch_11_filter.js':
        continue
    lines = source.splitlines()
    for index, line in enumerate(lines):
        if 'ClipHub.Filter.showPanel(' not in line:
            continue
        start = max(0, index - 3)
        end = min(len(lines), index + 8)
        context = '\n'.join(lines[start:end]).replace(' ', '')
        external_calls.append((name, index + 1, context))
        if 'rootMode:true' not in context:
            fail('unsafe external Filter.showPanel caller: %s:%d' %
                 (name, index + 1))

assert 'typeof ClipHub.Filter.showRoot === "function"' in app_source
assert 'runtimeDiagnostics: runtimeDiagnostics' in app_source
assert 'legacyFallbackActive' in shell_source

print('Primary Window legacy route contracts: passed')
print('External Filter.showPanel callers: %d (all rootMode=true)' % len(external_calls))
print('Legacy compatibility bridges: detail, editor/tags, translation, settings')
