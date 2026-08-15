#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path('.')
SRC = ROOT / 'src'
BRIDGE_FILES = (
    'ch_09_list.js', 'ch_10_editor.js', 'ch_11_filter.js',
    'ch_12_translation.js', 'ch_13_settings.js', 'ch_17_tokenizer_ui.js',
)
VERSIONS = {
    'ch_06_repository.js': ('ch_06_repository', 19, 20),
    'ch_07_theme.js': ('ch_07_theme', 9, 10),
    'ch_09_list.js': ('ch_09_list', 24, 25),
    'ch_10_editor.js': ('ch_10_editor', 35, 36),
    'ch_11_filter.js': ('ch_11_filter', 86, 87),
    'ch_12_translation.js': ('ch_12_translation', 20, 21),
    'ch_13_settings.js': ('ch_13_settings', 40, 41),
    'ch_17_tokenizer_ui.js': ('ch_17_tokenizer_ui', 5, 6),
}


def packed(text):
    m = re.search(r'\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);', text, re.S)
    if not m:
        return None
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', m.group(2))
    raw = gzip.decompress(base64.b64decode(''.join(json.loads(x) for x in pieces))).decode('utf-8')
    return m, raw


def load(path):
    wrapper = path.read_text(encoding='utf-8')
    info = packed(wrapper)
    return wrapper, info[1] if info else wrapper, bool(info)


def repack(wrapper, source):
    info = packed(wrapper)
    if not info:
        return source
    m = info[0]
    data = gzip.compress(source.encode('utf-8'), compresslevel=9, mtime=0)
    encoded = base64.b64encode(data).decode('ascii')
    chunks = [encoded[i:i + 120] for i in range(0, len(encoded), 120)]
    expression = '\n' + '\n'.join(
        '        ' + json.dumps(chunk) + (' +' if i + 1 < len(chunks) else '')
        for i, chunk in enumerate(chunks)
    ) + '\n    '
    wrapper = wrapper[:m.start(2)] + expression + wrapper[m.end(2):]
    digest = hashlib.sha256(source.encode('utf-8')).hexdigest()
    wrapper = re.sub(
        r'(\bvar\s+SOURCE_SHA256\s*=\s*")[0-9a-fA-F]{64}(";)',
        r'\g<1>' + digest + r'\2', wrapper, count=1,
    )
    return wrapper


def save(path, wrapper, source, was_packed):
    path.write_text(repack(wrapper, source) if was_packed else source, encoding='utf-8')


def bump(source, name, old, new):
    pattern = r'(MODULE_NAME:\s*"' + re.escape(name) + r'"\s*,\s*MODULE_VERSION:\s*)' + str(old) + r'\b'
    source, count = re.subn(pattern, r'\g<1>' + str(new), source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit('version anchor mismatch: ' + name)
    return source


def match_brace(source, start):
    depth = 0
    quote = None
    esc = False
    line = False
    block = False
    i = start
    while i < len(source):
        ch = source[i]
        nxt = source[i + 1] if i + 1 < len(source) else ''
        if line:
            if ch == '\n': line = False
            i += 1; continue
        if block:
            if ch == '*' and nxt == '/': block = False; i += 2; continue
            i += 1; continue
        if quote:
            if esc: esc = False
            elif ch == '\\': esc = True
            elif ch == quote: quote = None
            i += 1; continue
        if ch == '/' and nxt == '/': line = True; i += 2; continue
        if ch == '/' and nxt == '*': block = True; i += 2; continue
        if ch in ('"', "'"): quote = ch; i += 1; continue
        if ch == '{': depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0: return i
        i += 1
    raise SystemExit('unbalanced braces')


def functions(source):
    out = []
    for m in re.finditer(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*\{', source):
        brace = source.find('{', m.start())
        end = match_brace(source, brace)
        out.append((m.group(1), m, brace, end))
    return out


def function_at(source, pos):
    found = None
    for item in functions(source):
        if item[2] < pos < item[3]: found = item
    return found


def call_end(source, open_paren):
    depth = 0
    quote = None
    esc = False
    i = open_paren
    while i < len(source):
        ch = source[i]
        if quote:
            if esc: esc = False
            elif ch == '\\': esc = True
            elif ch == quote: quote = None
        else:
            if ch in ('"', "'"): quote = ch
            elif ch == '(': depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0: return i
        i += 1
    raise SystemExit('unbalanced call')


def mark_make_icon_calls(source):
    edits = []
    for name, m, brace, end in functions(source):
        if not re.match(r'makeIcon[A-Za-z0-9_]*$', name):
            continue
        body = source[brace + 1:end]
        for call in re.finditer(r'\bmakeText\s*\(', body):
            absolute_open = brace + 1 + body.find('(', call.start())
            close = call_end(source, absolute_open)
            inside = source[absolute_open + 1:close]
            if re.search(r',\s*true\s*$', inside):
                continue
            edits.append(close)
    for pos in sorted(edits, reverse=True):
        source = source[:pos] + ', true' + source[pos:]
    return source, len(edits)


BRIDGE = re.compile(
    r'/\*\s*panel_icon_text_bridge_v1\s*\*/\s*'
    r'if\s*\(ClipHub\.Theme\s*&&\s*typeof\s+ClipHub\.Theme\.decoratePanelIcon\s*===\s*"function"\)\s*\{\s*'
    r'ClipHub\.Theme\.decoratePanelIcon\(([^;]+?)\);\s*\}', re.S,
)


def patch_bridge(source, filename):
    m = BRIDGE.search(source)
    if not m:
        raise SystemExit('bridge missing: ' + filename)
    owner = function_at(source, m.start())
    if not owner:
        raise SystemExit('bridge owner missing: ' + filename)
    name, header, brace, end = owner
    args = m.group(1).strip()
    if name != 'makeText':
        replacement = (
            '/* panel_icon_explicit_v2 */\n'
            'if (ClipHub.Theme && typeof ClipHub.Theme.decoratePanelIcon === "function") {\n'
            '    ClipHub.Theme.decoratePanelIcon(' + args + ', true);\n'
            '}'
        )
        return source[:m.start()] + replacement + source[m.end():], name, 1

    params = [x.strip() for x in header.group(2).split(',') if x.strip()]
    params.append('semanticIcon')
    new_header = 'function makeText(' + ', '.join(params) + ') {'
    source = source[:header.start()] + new_header + source[brace + 1:]
    # Re-find the bridge after the header length change.
    m = BRIDGE.search(source)
    args = m.group(1).strip()
    replacement = (
        '/* panel_icon_explicit_v2 */\n'
        'if (semanticIcon === true && ClipHub.Theme &&\n'
        '        typeof ClipHub.Theme.decoratePanelIcon === "function") {\n'
        '    ClipHub.Theme.decoratePanelIcon(' + args + ', true);\n'
        '}'
    )
    source = source[:m.start()] + replacement + source[m.end():]
    source, count = mark_make_icon_calls(source)
    if count < 1:
        raise SystemExit('no makeIcon -> makeText call patched: ' + filename)
    return source, name, count


report = []
for filename in BRIDGE_FILES:
    path = SRC / filename
    wrapper, source, was_packed = load(path)
    source, owner, count = patch_bridge(source, filename)
    mod, old, new = VERSIONS[filename]
    source = bump(source, mod, old, new)
    save(path, wrapper, source, was_packed)
    report.append((filename, owner, count))

# Theme only accepts explicit icon intent.
path = SRC / 'ch_07_theme.js'
wrapper, source, was_packed = load(path)
old = 'function decoratePanelIcon(viewObj, value, colorValue, sizeDp) {'
if source.count(old) != 1:
    raise SystemExit('theme signature mismatch')
source = source.replace(old, 'function decoratePanelIcon(viewObj, value, colorValue, sizeDp, explicitIcon) {', 1)
guard = 'if (viewObj === null || viewObj === undefined || !isPanelIconToken(value)) { return false; }'
if source.count(guard) != 1:
    raise SystemExit('theme guard mismatch')
source = source.replace(
    guard,
    'if (viewObj === null || viewObj === undefined || explicitIcon !== true ||\n'
    '                !isPanelIconToken(value)) { return false; }', 1,
)
source = bump(source, 'ch_07_theme', 9, 10)
save(path, wrapper, source, was_packed)

# Visible warning for skipped >768 KiB candidates.
path = SRC / 'ch_11_filter.js'
wrapper, source, was_packed = load(path)
needle = '        regexScanState.oversizeSkipped = Number(oversizeSkipped || 0);'
if source.count(needle) != 1:
    raise SystemExit('oversize publish anchor mismatch')
notice = needle + '''\n        if (complete === true && regexScanState.oversizeSkipped > 0 &&\n                Number(regexScanState.oversizeNoticeGeneration || -1) !== Number(generation)) {\n            regexScanState.oversizeNoticeGeneration = Number(generation);\n            try {\n                Packages.android.widget.Toast.makeText(\n                    androidContext,\n                    "有 " + regexScanState.oversizeSkipped + " 条超大内容未参与正则扫描",\n                    Packages.android.widget.Toast.LENGTH_LONG\n                ).show();\n            } catch (ignoredOversizeNotice) {}\n        }'''
source = source.replace(needle, notice, 1)
save(path, wrapper, source, was_packed)

# Repository packed canonical-source SHA-256 verification.
path = SRC / 'ch_06_repository.js'
wrapper, source, was_packed = load(path)
if not was_packed:
    raise SystemExit('repository unexpectedly unpacked')
source = bump(source, 'ch_06_repository', 19, 20)
wrapper = repack(wrapper, source)
digest = hashlib.sha256(source.encode('utf-8')).hexdigest()
if 'var SOURCE_SHA256' not in wrapper:
    anchor = '    var JavaString = Packages.java.lang.String;\n'
    wrapper = wrapper.replace(
        anchor,
        anchor + '    var MessageDigest = Packages.java.security.MessageDigest;\n' +
        '    var SOURCE_SHA256 = "' + digest + '";\n', 1,
    )
    helper = '''    function bytesToHex(bytes) {\n        var parts = [];\n        var index;\n        var value;\n        var hex;\n        for (index = 0; index < bytes.length; index += 1) {\n            value = Number(bytes[index]);\n            if (value < 0) { value += 256; }\n            hex = value.toString(16);\n            parts.push(hex.length === 1 ? "0" + hex : hex);\n        }\n        return parts.join("");\n    }\n\n'''
    wrapper = wrapper.replace('    var input = null;\n', helper + '    var input = null;\n', 1)
    wrapper = wrapper.replace('    var source;\n', '    var source;\n    var expandedBytes;\n', 1)
    old_eval = '        source = String(new JavaString(output.toByteArray(), "UTF-8"));\n        eval(source);'
    new_eval = '''        expandedBytes = output.toByteArray();\n        if (bytesToHex(MessageDigest.getInstance("SHA-256").digest(expandedBytes)) !== SOURCE_SHA256) {\n            throw new Error("ch_06_repository.js source SHA mismatch");\n        }\n        source = String(new JavaString(expandedBytes, "UTF-8"));\n        (0, eval)(source);'''
    if wrapper.count(old_eval) != 1:
        raise SystemExit('repository eval anchor mismatch')
    wrapper = wrapper.replace(old_eval, new_eval, 1)
path.write_text(wrapper, encoding='utf-8')

# Focused regression test.
(ROOT / 'scripts/test_review_regressions.py').write_text('''#!/usr/bin/env python3\nimport base64,gzip,hashlib,json,re\nfrom pathlib import Path\ndef ex(p):\n t=Path(p).read_text(encoding="utf-8");m=re.search(r"\\bvar\\s+(?:PACKED_B64|encoded)\\s*=\\s*(.*?);",t,re.S)\n if not m:return t,t\n q=re.findall(r'"(?:\\\\.|[^"\\\\])*"',m.group(1));s=gzip.decompress(base64.b64decode("".join(json.loads(x) for x in q))).decode("utf-8");return t,s\n_,theme=ex("src/ch_07_theme.js");assert "explicitIcon !== true" in theme\nfor n in ''' + repr(BRIDGE_FILES) + ''':\n _,s=ex("src/"+n);assert "panel_icon_text_bridge_v1" not in s,n;assert "panel_icon_explicit_v2" in s,n\n_,ls=ex("src/ch_09_list.js");_,ed=ex("src/ch_10_editor.js");assert "makeText(String(row.content)" in ls;assert "makeText(String(tag.name)" in ed\nl,r=ex("src/ch_06_repository.js");m=re.search(r'var SOURCE_SHA256 = "([0-9a-f]{64})";',l);assert m;assert hashlib.sha256(r.encode()).hexdigest()==m.group(1);assert "(0, eval)(source);" in l\n_,f=ex("src/ch_11_filter.js");assert "条超大内容未参与正则扫描" in f;assert "oversizeNoticeGeneration" in f\nprint("Review regression checks: passed")\n''', encoding='utf-8')

# Preflight contract updates.
preflight = ROOT / 'scripts/release_preflight.sh'
text = preflight.read_text(encoding='utf-8')
for old, new in (
    ("EXPECTED_MODULE_SET='20260815.26'", "EXPECTED_MODULE_SET='20260815.27'"),
    ('"ch_06_repository.js": ("ch_06_repository", 19),', '"ch_06_repository.js": ("ch_06_repository", 20),'),
    ('"ch_09_list.js": ("ch_09_list", 24),', '"ch_09_list.js": ("ch_09_list", 25),'),
    ('"ch_10_editor.js": ("ch_10_editor", 35),', '"ch_10_editor.js": ("ch_10_editor", 36),'),
    ('"ch_11_filter.js": ("ch_11_filter", 86),', '"ch_11_filter.js": ("ch_11_filter", 87),'),
    ('"ch_12_translation.js": ("ch_12_translation", 20),', '"ch_12_translation.js": ("ch_12_translation", 21),'),
    ('"ch_13_settings.js": ("ch_13_settings", 40),', '"ch_13_settings.js": ("ch_13_settings", 41),'),
    ('"ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 5),', '"ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 6),'),
    ('expected_theme_version = 9 if mode == "--settings-tabs-beta" else 4', 'expected_theme_version = 10 if mode == "--settings-tabs-beta" else 4'),
):
    if text.count(old) != 1:
        raise SystemExit('preflight anchor mismatch: ' + old)
    text = text.replace(old, new, 1)
old_block = '''        for icon_bridge_file in (\n            "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",\n            "ch_12_translation.js", "ch_13_settings.js", "ch_17_tokenizer_ui.js",\n        ):\n            assert "panel_icon_text_bridge_v1" in actual_sources[icon_bridge_file], icon_bridge_file\n'''
new_block = '''        for icon_bridge_file in (\n            "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",\n            "ch_12_translation.js", "ch_13_settings.js", "ch_17_tokenizer_ui.js",\n        ):\n            assert "panel_icon_explicit_v2" in actual_sources[icon_bridge_file], icon_bridge_file\n            assert "panel_icon_text_bridge_v1" not in actual_sources[icon_bridge_file], icon_bridge_file\n        assert "explicitIcon !== true" in theme\n        assert "条超大内容未参与正则扫描" in filter_source\n        repository_loader = (root / "src/ch_06_repository.js").read_text(encoding="utf-8")\n        assert "var SOURCE_SHA256" in repository_loader\n'''
if text.count(old_block) != 1:
    raise SystemExit('preflight bridge block mismatch')
text = text.replace(old_block, new_block, 1)
anchor = '  python3 scripts/test_primary_window_legacy_routes.py\n'
if text.count(anchor) != 1:
    raise SystemExit('preflight test anchor mismatch')
text = text.replace(anchor, anchor + '  python3 scripts/test_review_regressions.py\n', 1)
preflight.write_text(text, encoding='utf-8')

# Manifest module set and Git blob SHAs.
manifest_path = ROOT / 'module-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
assert manifest['sourceRef'] == 'beta-regex-settings-tabs-20260814'
manifest['moduleSetVersion'] = '20260815.27'
for item in manifest['modules']:
    data = (ROOT / item['path']).read_text(encoding='utf-8').encode('utf-8')
    item['sha'] = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('bridge report:', report)
