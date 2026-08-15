#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

BASELINE = "06dbeac91b0d27fdcefa73e4f1f37f5d403520dd"
TARGET_SET = "20260815.24"
VERSIONS = {
    "src/ch_07_theme.js": ("ch_07_theme", 6, 7),
    "src/ch_09_list.js": ("ch_09_list", 23, 24),
    "src/ch_10_editor.js": ("ch_10_editor", 34, 35),
    "src/ch_11_filter.js": ("ch_11_filter", 85, 86),
    "src/ch_12_translation.js": ("ch_12_translation", 19, 20),
    "src/ch_13_settings.js": ("ch_13_settings", 39, 40),
    "src/ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 4, 5),
}
BRIDGE_PATHS = [p for p in VERSIONS if p != "src/ch_07_theme.js"]


def read(path):
    return Path(path).read_text(encoding="utf-8")


def write(path, text):
    Path(path).write_text(text, encoding="utf-8")


def packed_parts(text):
    match = re.search(r"\bvar\s+(PACKED_[A-Z0-9_]*B64|PACKED_B64|encoded)\s*=\s*(.*?);", text, re.S)
    if match is None:
        return None
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(2))
    if not pieces:
        raise AssertionError("packed assignment contains no string pieces")
    encoded = "".join(json.loads(piece) for piece in pieces)
    raw = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    sha_match = re.search(r"\bvar\s+SOURCE_SHA256\s*=\s*['\"]([0-9a-f]{64})['\"]", text)
    if sha_match is not None:
        actual = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        assert actual == sha_match.group(1), (actual, sha_match.group(1))
    return match, raw


def load_source(path):
    wrapper = read(path)
    parts = packed_parts(wrapper)
    if parts is None:
        return wrapper, None
    return parts[1], wrapper


def save_source(path, source, wrapper):
    if wrapper is None:
        write(path, source)
        return
    match = re.search(r"\bvar\s+(PACKED_[A-Z0-9_]*B64|PACKED_B64|encoded)\s*=\s*(.*?);", wrapper, re.S)
    assert match is not None
    packed = gzip.compress(source.encode("utf-8"), compresslevel=9, mtime=0)
    encoded = base64.b64encode(packed).decode("ascii")
    chunks = [encoded[i:i + 120] for i in range(0, len(encoded), 120)]
    expression = "\n\n        " + " +\n        ".join(json.dumps(chunk) for chunk in chunks)
    wrapper = wrapper[:match.start(2)] + expression + wrapper[match.end(2):]
    new_sha = hashlib.sha256(source.encode("utf-8")).hexdigest()
    wrapper, count = re.subn(
        r"(\bvar\s+SOURCE_SHA256\s*=\s*['\"])[0-9a-f]{64}(['\"])",
        lambda m: m.group(1) + new_sha + m.group(2),
        wrapper,
        count=1,
    )
    assert count == 1, path
    write(path, wrapper)


def bump_module(source, module_name, old_version, new_version):
    pattern = r'(MODULE_NAME:\s*["\']' + re.escape(module_name) + r'["\']\s*,\s*MODULE_VERSION:\s*)' + str(old_version) + r'\b'
    source, count = re.subn(pattern, lambda m: m.group(1) + str(new_version), source, count=1, flags=re.S)
    assert count == 1, (module_name, old_version, new_version)
    return source


def find_function(source, name):
    match = re.search(r"\bfunction\s+" + re.escape(name) + r"\s*\(([^)]*)\)\s*\{", source)
    if match is None:
        return None
    brace = source.find("{", match.start())
    depth = 0
    quote = None
    escape = False
    line_comment = False
    block_comment = False
    i = brace
    while i < len(source):
        ch = source[i]
        nxt = source[i + 1] if i + 1 < len(source) else ""
        if line_comment:
            if ch == "\n": line_comment = False
        elif block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
                i += 1
        elif quote is not None:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
        else:
            if ch == "/" and nxt == "/":
                line_comment = True
                i += 1
            elif ch == "/" and nxt == "*":
                block_comment = True
                i += 1
            elif ch in ("'", '"'):
                quote = ch
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return match, brace, i + 1
        i += 1
    raise AssertionError("unterminated function " + name)


def inject_make_text_bridge(source, path):
    if "panel_icon_text_bridge_v1" in source:
        return source
    found = find_function(source, "makeText")
    assert found is not None, path
    match, brace, end = found
    params = [p.strip() for p in match.group(1).split(",") if p.strip()]
    assert len(params) >= 3, (path, params)
    text_name, size_name, color_name = params[0], params[1], params[2]
    block = source[brace:end]
    returns = list(re.finditer(r"\breturn\s+([A-Za-z_$][\w$]*)\s*;", block))
    assert returns, path
    last = returns[-1]
    view_name = last.group(1)
    insert_at = brace + last.start()
    indent_match = re.search(r"(^[ \t]*)return\s+" + re.escape(view_name) + r"\s*;", source[insert_at:end], re.M)
    indent = indent_match.group(1) if indent_match else "    "
    bridge = (
        indent + "/* panel_icon_text_bridge_v1 */\n" +
        indent + "if (ClipHub.Theme && typeof ClipHub.Theme.decoratePanelIcon === \"function\") {\n" +
        indent + "    ClipHub.Theme.decoratePanelIcon(" + view_name + ", " + text_name + ", " + color_name + ", " + size_name + ");\n" +
        indent + "}\n" + indent
    )
    source = source[:insert_at] + bridge + source[insert_at:]
    assert "panel_icon_text_bridge_v1" in source
    return source


ICON_CODE = r'''

    /* panel_icon_system_v1: font-independent semantic icons on a 24x24 logical grid. */
    var PANEL_ICON_TOKENS = {
        "+": "add",
        "＋": "add",
        "×": "close",
        "✕": "close",
        "✖": "close",
        "‹": "back",
        "←": "back",
        "›": "forward",
        "→": "forward",
        "✓": "check",
        "✔": "check",
        "⚙": "settings",
        "🔍": "search",
        "⌕": "search",
        "☰": "list",
        "⋮": "more_vertical",
        "✎": "edit",
        "✏": "edit",
        "🗑": "delete",
        "📋": "copy",
        "⧉": "copy",
        "▣": "copy",
        "?": "help",
        "↵": "input",
        "⇩": "download",
        "▲": "up",
        "▼": "down",
        "📌": "pin",
        "⚑": "pin",
        "⚐": "pin",
        "🌐": "globe",
        "◎": "globe",
        "⊙": "globe",
        "⌗": "rules"
    };

    function panelIconName(value) {
        var key = String(value === null || value === undefined ? "" : value);
        return PANEL_ICON_TOKENS.hasOwnProperty(key) ? PANEL_ICON_TOKENS[key] : null;
    }

    function isPanelIconToken(value) {
        return panelIconName(value) !== null;
    }

    function makePanelIconDrawable(context, value, colorValue, sizeDp) {
        var name = panelIconName(value);
        var Bitmap = Packages.android.graphics.Bitmap;
        var Canvas = Packages.android.graphics.Canvas;
        var Paint = Packages.android.graphics.Paint;
        var Path = Packages.android.graphics.Path;
        var RectF = Packages.android.graphics.RectF;
        var BitmapDrawable = Packages.android.graphics.drawable.BitmapDrawable;
        var density = 1;
        var logicalSize = Number(sizeDp || 18);
        var px;
        var scale;
        var bitmap;
        var canvas;
        var stroke;
        var fill;
        var path;
        var drawable;
        var i;
        var angle;
        var x1;
        var y1;
        var x2;
        var y2;
        function v(number) { return Number(number) * scale; }
        function line(ax, ay, bx, by) {
            canvas.drawLine(v(ax), v(ay), v(bx), v(by), stroke);
        }
        function circle(cx, cy, radius, paintObj) {
            canvas.drawCircle(v(cx), v(cy), v(radius), paintObj || stroke);
        }
        function rect(left, top, right, bottom, radius, paintObj) {
            canvas.drawRoundRect(new RectF(v(left), v(top), v(right), v(bottom)),
                v(radius || 0), v(radius || 0), paintObj || stroke);
        }
        if (name === null || context === null || context === undefined) { return null; }
        try { density = Number(context.getResources().getDisplayMetrics().density || 1); }
        catch (ignoredIconDensity) { density = 1; }
        if (!isFinite(density) || density <= 0) { density = 1; }
        if (!isFinite(logicalSize)) { logicalSize = 18; }
        logicalSize = clampNumber(logicalSize, 14, 22);
        px = Math.max(1, Math.round(logicalSize * density));
        scale = px / 24;
        bitmap = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        canvas = new Canvas(bitmap);
        stroke = new Paint();
        stroke.setAntiAlias(true);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(Math.max(1, v(2.05)));
        stroke.setStrokeCap(Paint.Cap.ROUND);
        stroke.setStrokeJoin(Paint.Join.ROUND);
        safeSetPaintColor(stroke, colorValue);
        fill = new Paint();
        fill.setAntiAlias(true);
        fill.setStyle(Paint.Style.FILL);
        safeSetPaintColor(fill, colorValue);

        if (name === "add") {
            line(12, 5, 12, 19); line(5, 12, 19, 12);
        } else if (name === "close") {
            line(6.5, 6.5, 17.5, 17.5); line(17.5, 6.5, 6.5, 17.5);
        } else if (name === "back") {
            line(15.5, 5.5, 9, 12); line(9, 12, 15.5, 18.5);
        } else if (name === "forward") {
            line(8.5, 5.5, 15, 12); line(15, 12, 8.5, 18.5);
        } else if (name === "check") {
            line(5.5, 12.5, 10, 17); line(10, 17, 18.5, 7.5);
        } else if (name === "search") {
            circle(10.5, 10.5, 5.5); line(14.7, 14.7, 19, 19);
        } else if (name === "settings") {
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
        } else if (name === "more_vertical") {
            circle(12, 6.5, 1.3, fill); circle(12, 12, 1.3, fill); circle(12, 17.5, 1.3, fill);
        } else if (name === "edit") {
            path = new Path();
            path.moveTo(v(6.5), v(17.5));
            path.lineTo(v(8), v(13.5));
            path.lineTo(v(15.5), v(6));
            path.lineTo(v(18), v(8.5));
            path.lineTo(v(10.5), v(16));
            path.close();
            canvas.drawPath(path, stroke);
            line(6.5, 17.5, 10.5, 16);
        } else if (name === "copy") {
            rect(8, 8, 18.5, 18.5, 1.8); rect(5.5, 5.5, 16, 16, 1.8);
        } else if (name === "delete") {
            rect(7.5, 8.5, 16.5, 19, 1.2);
            line(6, 6.5, 18, 6.5); line(9.5, 5, 14.5, 5);
            line(10.5, 10.5, 10.5, 16.8); line(13.5, 10.5, 13.5, 16.8);
        } else if (name === "help") {
            path = new Path();
            path.moveTo(v(8), v(8.3));
            path.cubicTo(v(8.5), v(4.8), v(15.8), v(4.8), v(16), v(9));
            path.cubicTo(v(16.1), v(12.2), v(12), v(12.4), v(12), v(15));
            canvas.drawPath(path, stroke);
            circle(12, 19, 1.0, fill);
        } else if (name === "pin") {
            line(8, 6, 16, 6); line(9.2, 6, 10, 11.5); line(14.8, 6, 14, 11.5);
            line(7, 11.5, 17, 11.5); line(12, 11.5, 12, 19);
        } else if (name === "globe") {
            circle(12, 12, 8);
            canvas.drawOval(new RectF(v(8.5), v(4), v(15.5), v(20)), stroke);
            line(4.5, 12, 19.5, 12);
        } else if (name === "input") {
            line(5, 12, 15.5, 12); line(12.5, 9, 15.5, 12); line(15.5, 12, 12.5, 15);
            line(18.5, 6, 18.5, 18);
        } else if (name === "download") {
            line(12, 5, 12, 15); line(8.5, 11.5, 12, 15); line(12, 15, 15.5, 11.5);
            line(6, 19, 18, 19);
        } else if (name === "up") {
            line(6, 15.5, 12, 9.5); line(12, 9.5, 18, 15.5);
        } else if (name === "down") {
            line(6, 8.5, 12, 14.5); line(12, 14.5, 18, 8.5);
        } else if (name === "rules") {
            line(8, 5, 6.5, 19); line(16.5, 5, 15, 19); line(4.5, 9.5, 19, 9.5); line(4, 14.5, 18.5, 14.5);
        }

        drawable = new BitmapDrawable(context.getResources(), bitmap);
        drawable.setBounds(0, 0, px, px);
        return drawable;
    }

    function decoratePanelIcon(viewObj, value, colorValue, sizeDp) {
        var drawable;
        if (viewObj === null || viewObj === undefined || !isPanelIconToken(value)) { return false; }
        try {
            drawable = makePanelIconDrawable(viewObj.getContext(), value, colorValue, sizeDp);
            if (drawable === null) { return false; }
            viewObj.setText("");
            viewObj.setCompoundDrawablePadding(0);
            viewObj.setCompoundDrawables(drawable, null, null, null);
            return true;
        } catch (error) {
            return false;
        }
    }
'''


def patch_theme():
    path = "src/ch_07_theme.js"
    source = read(path)
    assert "panel_icon_system_v1" not in source
    marker = "\n    function configuredMode() {"
    assert marker in source
    source = source.replace(marker, ICON_CODE + marker, 1)
    source = bump_module(source, "ch_07_theme", 6, 7)
    export_marker = "        getPanelChromeMetrics: getPanelChromeMetrics,"
    assert export_marker in source
    source = source.replace(export_marker,
        export_marker + "\n        isPanelIconToken: isPanelIconToken,\n        makePanelIconDrawable: makePanelIconDrawable,\n        decoratePanelIcon: decoratePanelIcon,", 1)
    assert "decoratePanelIcon: decoratePanelIcon" in source
    write(path, source)


def patch_bridge_module(path, module_name, old_version, new_version):
    source, wrapper = load_source(path)
    assert "panel_icon_text_bridge_v1" not in source, path
    source = inject_make_text_bridge(source, path)
    source = bump_module(source, module_name, old_version, new_version)
    save_source(path, source, wrapper)


def git_blob_sha(path):
    data = Path(path).read_bytes()
    return hashlib.sha1(("blob %d\0" % len(data)).encode("utf-8") + data).hexdigest()


def patch_manifest():
    path = Path("module-manifest.json")
    manifest = json.loads(path.read_text(encoding="utf-8"))
    assert manifest["moduleSetVersion"] == "20260815.23"
    assert manifest["entryMinVersion"] == 7
    assert manifest["sourceRef"] == "beta-regex-settings-tabs-20260814"
    manifest["moduleSetVersion"] = TARGET_SET
    changed = set(VERSIONS.keys())
    seen = set()
    for item in manifest["modules"]:
        module_path = str(item["path"])
        if module_path in changed:
            item["sha"] = git_blob_sha(module_path)
            seen.add(module_path)
    assert seen == changed, (seen, changed)
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def patch_preflight():
    path = Path("scripts/release_preflight.sh")
    text = path.read_text(encoding="utf-8")
    assert "EXPECTED_MODULE_SET='20260815.23'" in text
    text = text.replace("EXPECTED_MODULE_SET='20260815.23'", "EXPECTED_MODULE_SET='20260815.24'", 1)
    text, count = re.subn(
        r'expected_theme_version = 6 if mode == "--settings-tabs-beta" else 4',
        'expected_theme_version = 7 if mode == "--settings-tabs-beta" else 4', text, count=1)
    assert count == 1
    for filename, (module_name, old_version, new_version) in VERSIONS.items():
        if filename == "src/ch_07_theme.js":
            continue
        old = '"' + Path(filename).name + '": ("' + module_name + '", ' + str(old_version) + ')'
        new = '"' + Path(filename).name + '": ("' + module_name + '", ' + str(new_version) + ')'
        assert old in text, old
        text = text.replace(old, new, 1)
    marker = 'assert "panel_chrome_home_baseline_v1" in theme'
    assert marker in text
    text = text.replace(marker, marker + '\nassert "panel_icon_system_v1" in theme\nassert "decoratePanelIcon: decoratePanelIcon" in theme', 1)
    contract_marker = '    settings_source = actual_sources["ch_13_settings.js"]'
    assert contract_marker in text
    icon_contract = '''\n    if mode == "--settings-tabs-beta":\n        for icon_bridge_file in (\n            "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",\n            "ch_12_translation.js", "ch_13_settings.js", "ch_17_tokenizer_ui.js",\n        ):\n            assert "panel_icon_text_bridge_v1" in actual_sources[icon_bridge_file], icon_bridge_file\n'''
    text = text.replace(contract_marker, contract_marker + icon_contract, 1)
    path.write_text(text, encoding="utf-8")


def verify_result():
    theme = read("src/ch_07_theme.js")
    assert "MODULE_VERSION: 7" in theme
    assert "panel_icon_system_v1" in theme
    assert "Bitmap.createBitmap" in theme
    assert "setCompoundDrawables(drawable, null, null, null)" in theme
    for path, (module_name, old_version, new_version) in VERSIONS.items():
        source, wrapper = load_source(path)
        assert re.search(r'MODULE_NAME:\s*["\']' + re.escape(module_name) + r'["\']\s*,\s*MODULE_VERSION:\s*' + str(new_version), source, re.S), path
        if path in BRIDGE_PATHS:
            assert "panel_icon_text_bridge_v1" in source, path
    manifest = json.loads(read("module-manifest.json"))
    assert manifest["moduleSetVersion"] == TARGET_SET
    for item in manifest["modules"]:
        if item["path"] in VERSIONS:
            assert item["sha"] == git_blob_sha(item["path"]), item["path"]


patch_theme()
for path in BRIDGE_PATHS:
    name, old, new = VERSIONS[path]
    patch_bridge_module(path, name, old, new)
patch_manifest()
patch_preflight()
verify_result()
print("Icon system patch prepared:", TARGET_SET)
print("Bridged modules:", ", ".join(BRIDGE_PATHS))
