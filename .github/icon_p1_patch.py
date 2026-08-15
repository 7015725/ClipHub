#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess

BASELINE = 'c59e6af071888ae8396d7b3e2d412165b8b09c63'
TARGET_SET = '20260815.25'

def replace_once(text, old, new, label):
    count = text.count(old)
    assert count == 1, (label, count)
    return text.replace(old, new, 1)

current = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
changed = set(filter(None, subprocess.check_output(
    ['git', 'diff', '--name-only', BASELINE + '..' + current], text=True).splitlines()))
allowed_temp = {
    '.github/workflows/icon_p1_optical_once.yml',
    '.github/icon_p1_patch.py',
}
assert changed == allowed_temp, {'expected': sorted(allowed_temp), 'actual': sorted(changed)}

theme_path = Path('src/ch_07_theme.js')
theme = theme_path.read_text(encoding='utf-8')
assert 'MODULE_VERSION: 7' in theme

old_settings_list = '''        } else if (name === "settings") {
            circle(12, 12, 3.2);
            for (i = 0; i < 8; i += 1) {
                angle = Math.PI * i / 4;
                x1 = 12 + Math.cos(angle) * 6.0;
                y1 = 12 + Math.sin(angle) * 6.0;
                x2 = 12 + Math.cos(angle) * 8.2;
                y2 = 12 + Math.sin(angle) * 8.2;
                line(x1, y1, x2, y2);
            }
        } else if (name === "list") {
            for (i = 0; i < 3; i += 1) {
                circle(5.5, 7 + i * 5, 0.9, fill);
                line(9, 7 + i * 5, 19, 7 + i * 5);
            }
'''
new_settings_list = '''        } else if (name === "settings") {
            /* panel_icon_optical_p1_v1: toothed outline instead of sun-like spokes. */
            path = new Path();
            for (i = 0; i < 24; i += 1) {
                angle = (-Math.PI / 2) + (Math.PI * 2 * i / 24);
                x1 = 12 + Math.cos(angle) * ((i % 3 === 1) ? 8.4 : 6.9);
                y1 = 12 + Math.sin(angle) * ((i % 3 === 1) ? 8.4 : 6.9);
                if (i === 0) { path.moveTo(v(x1), v(y1)); }
                else { path.lineTo(v(x1), v(y1)); }
            }
            path.close();
            canvas.drawPath(path, stroke);
            circle(12, 12, 2.8);
        } else if (name === "list") {
            /* panel_icon_optical_p1_v1: lighter bullets and clearer bullet-to-line gap. */
            for (i = 0; i < 3; i += 1) {
                circle(5.2, 7 + i * 5, 0.65, fill);
                line(9.5, 7 + i * 5, 18.5, 7 + i * 5);
            }
'''
theme = replace_once(theme, old_settings_list, new_settings_list, 'settings/list')

old_globe = '''        } else if (name === "globe") {
            circle(12, 12, 8);
            canvas.drawOval(new RectF(v(8.5), v(4), v(15.5), v(20)), stroke);
            line(4.5, 12, 19.5, 12);
'''
new_globe = '''        } else if (name === "globe") {
            /* panel_icon_optical_p1_v1: sparse longitude curves for small-size clarity. */
            circle(12, 12, 7.6);
            path = new Path();
            path.moveTo(v(12), v(4.4));
            path.cubicTo(v(8.8), v(7.1), v(8.8), v(16.9), v(12), v(19.6));
            canvas.drawPath(path, stroke);
            path = new Path();
            path.moveTo(v(12), v(4.4));
            path.cubicTo(v(15.2), v(7.1), v(15.2), v(16.9), v(12), v(19.6));
            canvas.drawPath(path, stroke);
            line(4.8, 12, 19.2, 12);
'''
theme = replace_once(theme, old_globe, new_globe, 'globe')
theme = replace_once(theme, 'MODULE_VERSION: 7', 'MODULE_VERSION: 8', 'theme version')
assert theme.count('panel_icon_optical_p1_v1') == 3
theme_path.write_text(theme, encoding='utf-8')

manifest_path = Path('module-manifest.json')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260815.24'
manifest['moduleSetVersion'] = TARGET_SET
blob = subprocess.check_output(['git', 'hash-object', 'src/ch_07_theme.js'], text=True).strip()
matched = 0
for item in manifest['modules']:
    if item['name'] == 'ch_07_theme.js':
        item['sha'] = blob
        matched += 1
assert matched == 1
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

preflight_path = Path('scripts/release_preflight.sh')
preflight = preflight_path.read_text(encoding='utf-8')
preflight = replace_once(
    preflight,
    "EXPECTED_MODULE_SET='20260815.24'",
    "EXPECTED_MODULE_SET='20260815.25'",
    'module set')
preflight = replace_once(
    preflight,
    'expected_theme_version = 7 if mode == "--settings-tabs-beta" else 4',
    'expected_theme_version = 8 if mode == "--settings-tabs-beta" else 4',
    'theme preflight version')
preflight = replace_once(
    preflight,
    'assert "panel_icon_system_v1" in theme\n',
    'assert "panel_icon_system_v1" in theme\nassert "panel_icon_optical_p1_v1" in theme\n',
    'icon optical contract')
preflight_path.write_text(preflight, encoding='utf-8')

print('Icon P1 optical patch prepared:', TARGET_SET)
print('Theme blob:', blob)
