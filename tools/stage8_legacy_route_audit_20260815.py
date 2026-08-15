#!/usr/bin/env python3
from pathlib import Path
import base64
import gzip
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'


def expand(path):
    text = path.read_text(encoding='utf-8')
    m = re.search(r'\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);', text, re.S)
    if not m:
        return text
    parts = re.findall(r'"(?:\\.|[^"\\])*"', m.group(1))
    if not parts:
        raise SystemExit('packed payload parse failed: ' + path.name)
    payload = ''.join(json.loads(p) for p in parts)
    return gzip.decompress(base64.b64decode(payload)).decode('utf-8')


def contexts(text, pattern, radius=5):
    lines = text.splitlines()
    out = []
    regex = re.compile(pattern)
    for i, line in enumerate(lines):
        if regex.search(line):
            lo = max(0, i - radius)
            hi = min(len(lines), i + radius + 1)
            out.append((i + 1, '\n'.join('%5d | %s' % (j + 1, lines[j]) for j in range(lo, hi))))
    return out

sources = {p.name: expand(p) for p in sorted(SRC.glob('ch_*.js'))}

checks = []

def need(name, condition, detail):
    checks.append((name, bool(condition), detail))
    if not condition:
        raise SystemExit('FAIL ' + name + ': ' + detail)

list_src = sources['ch_09_list.js']
editor_src = sources['ch_10_editor.js']
filter_src = sources['ch_11_filter.js']
translation_src = sources['ch_12_translation.js']
settings_src = sources['ch_13_settings.js']
app_src = sources['ch_15_app.js']
shell_src = sources['ch_16_ui_shell.js']

need('detail_primary_guard', 'ClipHub.UIShell.canEmbed("detail") === true' in list_src, 'Detail must prefer UIShell')
need('detail_primary_mount', 'ClipHub.UIShell.mountPage("detail"' in list_src, 'Detail must mount Primary child')
need('detail_legacy_exists', 'detailWindowManager.addView(detailWindowRoot, detailParams)' in list_src, 'Detail legacy fallback unexpectedly absent')

need('editor_primary_guard', 'ClipHub.UIShell.canEmbed("editor") === true' in editor_src, 'Editor must prefer UIShell')
need('editor_primary_mount', 'function mountPrimaryEditorPage()' in editor_src, 'Editor primary mount helper missing')
need('editor_legacy_exists', 'windowManager.addView(panelWindowRoot, panelParams)' in editor_src, 'Editor legacy fallback unexpectedly absent')

need('translation_primary_guard', 'ClipHub.UIShell.canEmbed("translation") === true' in translation_src, 'Translation must prefer UIShell')
need('translation_primary_mount', 'ClipHub.UIShell.mountPage("translation"' in translation_src, 'Translation primary mount missing')
need('translation_legacy_exists', 'windowManager.addView(translationWindowRoot, translationParams)' in translation_src, 'Translation legacy fallback unexpectedly absent')

need('settings_primary_guard', 'ClipHub.UIShell.canEmbed("settings") === true' in settings_src, 'Settings must prefer UIShell')
need('settings_primary_mount', 'ClipHub.UIShell.mountPage("settings"' in settings_src, 'Settings primary mount missing')
need('settings_legacy_exists', '.addView(settingsWindowRoot, settingsParams)' in settings_src or 'windowManager.addView(settingsWindowRoot, settingsParams)' in settings_src, 'Settings legacy fallback unexpectedly absent')

need('filter_public_root_forced', re.search(r'showPanel:\s*function\s*\(options\).*?options\.rootMode\s*=\s*true;.*?return\s+showPanel\(options\);', filter_src, re.S), 'Public Filter.showPanel must force rootMode=true')
need('filter_showroot_root_forced', re.search(r'function\s+showRoot\s*\(options\).*?rootMode\s*=\s*true', filter_src, re.S), 'Filter.showRoot must force rootMode=true')
need('filter_legacy_internal_exists', 'filter_overlay' in filter_src, 'Internal filter legacy role unexpectedly absent')
need('uishell_filter_page_absent', 'registerPage({ id: "filter"' not in shell_src, 'Filter must not be a UIShell page')

external_show_panel = []
for name, source in sources.items():
    if name == 'ch_11_filter.js':
        continue
    for line_no, ctx in contexts(source, r'ClipHub\.Filter\.showPanel\s*\('):
        external_show_panel.append((name, line_no, ctx))

unsafe_external = []
for name, line_no, ctx in external_show_panel:
    window = ctx.replace(' ', '')
    if 'rootMode:true' not in window:
        unsafe_external.append((name, line_no, ctx))

need('no_external_filter_overlay_route', len(unsafe_external) == 0, 'External Filter.showPanel caller without rootMode:true exists')
need('app_prefers_showroot', 'typeof ClipHub.Filter.showRoot === "function"' in app_src, 'App must prefer Filter.showRoot')

print('=== Stage8 legacy route audit ===')
for name, ok, detail in checks:
    print('%-36s %s' % (name, 'PASS' if ok else 'FAIL'))

print('\n=== External Filter.showPanel callsites ===')
if not external_show_panel:
    print('none')
else:
    for name, line_no, ctx in external_show_panel:
        print('\n[%s:%d]\n%s' % (name, line_no, ctx))

for module, pattern in [
    ('ch_09_list.js', r'addView\(detailWindowRoot'),
    ('ch_10_editor.js', r'addView\(panelWindowRoot'),
    ('ch_12_translation.js', r'addView\(translationWindowRoot'),
    ('ch_13_settings.js', r'addView\(settingsWindowRoot'),
    ('ch_11_filter.js', r'addView\(panelWindowRoot'),
]:
    print('\n=== %s standalone addView context ===' % module)
    hits = contexts(sources[module], pattern, 12)
    if not hits:
        print('none')
    for line_no, ctx in hits:
        print('\nline %d\n%s' % (line_no, ctx))

print('\n=== Filter rootMode=false contexts ===')
for line_no, ctx in contexts(filter_src, r'rootMode\s*=\s*false|rootMode:\s*false', 10):
    print('\nline %d\n%s' % (line_no, ctx))

print('\nSTAGE8_AUDIT_PASS')
