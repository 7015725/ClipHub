#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'module-manifest.json'
EDITOR = ROOT / 'src/ch_10_editor.js'
TRANSLATION = ROOT / 'src/ch_12_translation.js'
SETTINGS = ROOT / 'src/ch_13_settings.js'


def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit('%s anchor count=%d' % (label, count))
    return text.replace(old, new, 1)


def replace_in_region(text, start_marker, end_marker, old, new, label):
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(label + ' start marker missing')
    end = text.find(end_marker, start)
    if end < 0:
        raise SystemExit(label + ' end marker missing')
    region = text[start:end]
    region = replace_once(region, old, new, label)
    return text[:start] + region + text[end:]


def verify_baseline(manifest):
    if manifest.get('moduleSetVersion') != '20260815.03':
        raise SystemExit('unexpected moduleSetVersion=' + str(manifest.get('moduleSetVersion')))
    if manifest.get('sourceRef') != 'beta-regex-settings-tabs-20260814':
        raise SystemExit('unexpected sourceRef')
    by_path = {item['path']: item for item in manifest['modules']}
    for rel in ('src/ch_10_editor.js', 'src/ch_12_translation.js', 'src/ch_13_settings.js'):
        actual = blob_sha((ROOT / rel).read_bytes())
        if by_path[rel]['sha'] != actual:
            raise SystemExit('baseline manifest mismatch ' + rel)


def patch_editor():
    text = EDITOR.read_text(encoding='utf-8')
    text = replace_in_region(
        text,
        '    function buildTextContent(',
        '    function buildTagContent(',
        '        header.setOrientation(LinearLayout.HORIZONTAL);\n        header.setGravity(Gravity.CENTER_VERTICAL);\n        titleStack.setOrientation(LinearLayout.VERTICAL);',
        '        header.setOrientation(LinearLayout.HORIZONTAL);\n        header.setGravity(Gravity.CENTER_VERTICAL);\n        header.setClipChildren(false);\n        titleStack.setOrientation(LinearLayout.VERTICAL);',
        'editor text header clip')
    text = replace_in_region(
        text,
        '    function buildTextContent(',
        '    function buildTagContent(',
        '        headerCloseView.setGravity(Gravity.CENTER);\n        headerCloseView.setContentDescription("关闭编辑窗口");',
        '        headerCloseView.setGravity(Gravity.CENTER);\n        headerCloseView.setTranslationY(-dp(3));\n        headerCloseView.setContentDescription("关闭编辑窗口");',
        'editor close vertical alignment')
    m = re.search(r'MODULE_NAME:\s*"ch_10_editor",\s*\n\s*MODULE_VERSION:\s*(\d+),', text)
    if not m or int(m.group(1)) != 26:
        raise SystemExit('unexpected editor module version')
    text = text[:m.start(1)] + '27' + text[m.end(1):]
    EDITOR.write_text(text, encoding='utf-8')


def patch_translation():
    text = TRANSLATION.read_text(encoding='utf-8')
    text = replace_in_region(
        text,
        '    function buildTranslationPanel()',
        '    function openTranslationForItem(',
        '        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(36));\n        params.bottomMargin = dp(6);\n        root.addView(header, params);',
        '        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(36));\n        params.topMargin = -dp(4);\n        params.bottomMargin = dp(6);\n        root.addView(header, params);',
        'translation header vertical alignment')
    m = re.search(r'MODULE_NAME:\s*"ch_12_translation",\s*\n\s*MODULE_VERSION:\s*(\d+),', text)
    if not m or int(m.group(1)) != 15:
        raise SystemExit('unexpected translation module version')
    text = text[:m.start(1)] + '16' + text[m.end(1):]
    TRANSLATION.write_text(text, encoding='utf-8')


def unpack_settings(loader):
    expected = re.search(r'var\s+SOURCE_SHA256\s*=\s*"([0-9a-f]+)";', loader)
    assignment = re.search(r'var\s+PACKED_B64\s*=\s*(.*?);\s*\n\s*function\s+bytesToHex', loader, re.S)
    if not expected or not assignment:
        raise SystemExit('settings packed loader contract missing')
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(1))
    encoded = ''.join(json.loads(piece) for piece in pieces)
    source = gzip.decompress(base64.b64decode(encoded)).decode('utf-8')
    actual = hashlib.sha256(source.encode('utf-8')).hexdigest()
    if actual != expected.group(1):
        raise SystemExit('settings source SHA mismatch')
    return source


def repack_settings(loader, source):
    source_sha = hashlib.sha256(source.encode('utf-8')).hexdigest()
    packed = gzip.compress(source.encode('utf-8'), compresslevel=9, mtime=0)
    b64 = base64.b64encode(packed).decode('ascii')
    chunks = [b64[i:i + 120] for i in range(0, len(b64), 120)]
    assignment = 'var PACKED_B64 =\n' + ' +\n'.join('        ' + json.dumps(c) for c in chunks) + '\n    ;'
    loader = re.sub(r'var\s+SOURCE_SHA256\s*=\s*"[0-9a-f]+";',
                    'var SOURCE_SHA256 = "%s";' % source_sha, loader, count=1)
    loader, count = re.subn(r'var\s+PACKED_B64\s*=\s*.*?;\s*\n(?=\s*function\s+bytesToHex)',
                            assignment + '\n\n', loader, count=1, flags=re.S)
    if count != 1:
        raise SystemExit('settings packed assignment replacement failed')
    loader = loader.replace('Settings27 source SHA mismatch', 'Settings31 source SHA mismatch', 1)
    return loader, source_sha


def patch_settings():
    loader = SETTINGS.read_text(encoding='utf-8')
    source = unpack_settings(loader)
    source = replace_in_region(
        source,
        '    function buildRootPage()',
        '    function build',
        '        var title = makeText("ClipHub 设置", 18, colors.textPrimary, true);',
        '        var title = makeText("ClipHub 设置", 17, colors.textPrimary, true);',
        'settings root title size')
    source = replace_in_region(
        source,
        '    function buildRootPage()',
        '    function build',
        '        header.addView(closeView, new LinearLayout.LayoutParams(dp(38), dp(38)));\n        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));\n        params.bottomMargin = dp(8);\n        content.addView(header, params);',
        '        header.addView(closeView, new LinearLayout.LayoutParams(dp(36), dp(36)));\n        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(36));\n        params.topMargin = -dp(2);\n        params.bottomMargin = dp(8);\n        content.addView(header, params);',
        'settings root header geometry')
    m = re.search(r'MODULE_NAME:\s*"ch_13_settings",\s*\n\s*MODULE_VERSION:\s*(\d+),', source)
    if not m or int(m.group(1)) != 30:
        raise SystemExit('unexpected settings module version')
    source = source[:m.start(1)] + '31' + source[m.end(1):]
    loader, source_sha = repack_settings(loader, source)
    SETTINGS.write_text(loader, encoding='utf-8')
    pathlib.Path('/tmp/settings_header_source.js').write_text(source, encoding='utf-8')
    return source_sha


def main():
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    verify_baseline(manifest)
    patch_editor()
    patch_translation()
    settings_source_sha = patch_settings()
    manifest['moduleSetVersion'] = '20260815.04'
    for item in manifest['modules']:
        if item['path'] in ('src/ch_10_editor.js', 'src/ch_12_translation.js', 'src/ch_13_settings.js'):
            item['sha'] = blob_sha((ROOT / item['path']).read_bytes())
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('moduleSetVersion=20260815.04')
    print('settings_source_sha256=' + settings_source_sha)


if __name__ == '__main__':
    main()
