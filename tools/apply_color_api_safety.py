#!/usr/bin/env python3
"""Harden ClipHub Android color calls against Rhino overload ambiguity."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME = ROOT / "src/ch_07_theme.js"
TARGETS = [
    THEME,
    ROOT / "src/ch_08_window.js",
    ROOT / "src/ch_09_list.js",
    ROOT / "src/ch_10_editor.js",
    ROOT / "src/ch_11_filter.js",
    ROOT / "src/ch_12_translation.js",
    ROOT / "src/ch_13_settings.js",
]
MANIFEST = ROOT / "module-manifest.json"
MODULE_SET_VERSION = "20260723.13"
EXPECTED_REPLACEMENTS = 35

METHOD_HELPERS = {
    "setTextColor": "setTextColor",
    "setHintTextColor": "setHintTextColor",
    "setLinkTextColor": "setLinkTextColor",
    "setColor": "setGradientColor",
    "setStroke": "setGradientStroke",
    "setBackgroundColor": "setBackgroundColor",
}


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def scan_balanced_call(text: str, open_paren: int) -> tuple[str, int] | None:
    depth = 0
    quote = ""
    escaped = False
    index = open_paren
    while index < len(text):
        ch = text[index]
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = ""
            index += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            index += 1
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return text[open_paren + 1:index], index + 1
        index += 1
    return None


def top_level_args(args: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    quote = ""
    escaped = False
    for index, ch in enumerate(args):
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = ""
            continue
        if ch in ("'", '"'):
            quote = ch
            continue
        if ch in "([{":
            depth += 1
        elif ch in ")]}" and depth > 0:
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(args[start:index].strip())
            start = index + 1
    parts.append(args[start:].strip())
    return parts


def unwrap_call(expression: str, function_name: str) -> str | None:
    value = expression.strip()
    prefix = function_name + "("
    if not value.startswith(prefix):
        return None
    open_paren = len(function_name)
    scanned = scan_balanced_call(value, open_paren)
    if scanned is None or scanned[1] != len(value):
        return None
    return scanned[0].strip()


def unwrap_color_expression(expression: str) -> str | None:
    inner = unwrap_call(expression, "Color.parseColor")
    if inner is None:
        return None
    string_inner = unwrap_call(inner, "String")
    return string_inner if string_inner is not None else inner


def rewrite_unsafe_color_calls(source: str, path: Path) -> tuple[str, int]:
    methods = "|".join(re.escape(name) for name in METHOD_HELPERS)
    pattern = re.compile(
        r"(?P<receiver>\b[A-Za-z_$][A-Za-z0-9_$]*)\s*\.\s*"
        r"(?P<method>" + methods + r")\s*\("
    )
    replacements: list[tuple[int, int, str]] = []
    position = 0
    while True:
        match = pattern.search(source, position)
        if match is None:
            break
        open_paren = source.find("(", match.start())
        scanned = scan_balanced_call(source, open_paren)
        if scanned is None:
            raise SystemExit(f"cannot parse color call in {path}: offset {match.start()}")
        args_text, end = scanned
        receiver = match.group("receiver")
        method = match.group("method")
        replacement = None

        if method == "setStroke":
            parts = top_level_args(args_text)
            if len(parts) >= 2:
                color_expr = unwrap_color_expression(parts[1])
                if color_expr is not None:
                    replacement = (
                        "ClipHub.Theme.setGradientStroke(" + receiver + ", " +
                        parts[0] + ", " + color_expr + ")"
                    )
        else:
            color_expr = unwrap_color_expression(args_text)
            if color_expr is not None:
                replacement = (
                    "ClipHub.Theme." + METHOD_HELPERS[method] + "(" +
                    receiver + ", " + color_expr + ")"
                )

        if replacement is not None:
            replacements.append((match.start(), end, replacement))
        position = end

    for start, end, replacement in reversed(replacements):
        source = source[:start] + replacement + source[end:]
    return source, len(replacements)


def increment_module_version(source: str, path: Path) -> tuple[str, int, int]:
    pattern = re.compile(r"(MODULE_VERSION:\s*)(\d+)(\s*,)")
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise SystemExit(
            f"{path}: expected one MODULE_VERSION, found {len(matches)}"
        )
    old_version = int(matches[0].group(2))
    new_version = old_version + 1
    source = pattern.sub(
        lambda match: match.group(1) + str(new_version) + match.group(3),
        source,
        count=1,
    )
    return source, old_version, new_version


def git_blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    header = f"blob {len(data)}\0".encode("utf-8")
    return hashlib.sha1(header + data).hexdigest()


def install_theme_bridge(source: str) -> str:
    if (
        "function safeColorStateList(" in source
        and "setGradientStroke: safeSetGradientStroke" in source
        and "setPaintColor: safeSetPaintColor" in source
    ):
        return source

    source = replace_once(
        source,
        "    var Configuration = Packages.android.content.res.Configuration;\n"
        "    var mode = \"system\";\n",
        "    var Configuration = Packages.android.content.res.Configuration;\n"
        "    var ColorStateList = Packages.android.content.res.ColorStateList;\n"
        "    var Color = Packages.android.graphics.Color;\n"
        "    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;\n"
        "    var JavaArray = Packages.java.lang.reflect.Array;\n"
        "    var JavaClass = Packages.java.lang.Class;\n"
        "    var JavaInteger = Packages.java.lang.Integer;\n"
        "    var mode = \"system\";\n",
        "Theme color imports",
    )

    helpers = r'''
    function colorInt(value, fallback) {
        var source = value;
        var text;
        var number;
        if (source === null || source === undefined || source === "") {
            source = fallback;
        }
        if (typeof source === "string") {
            text = String(source).replace(/^\s+|\s+$/g, "");
            if (text.length > 0) {
                try { return Number(Color.parseColor(text)) | 0; }
                catch (ignoredParse) {}
            }
        }
        number = Number(source);
        if (!isFinite(number)) {
            try { number = Number(Color.parseColor(String(fallback || "#00000000"))); }
            catch (ignoredFallback) { number = 0; }
        }
        return number | 0;
    }

    function jintArray(values) {
        var source = values || [];
        var output = JavaArray.newInstance(JavaInteger.TYPE, source.length);
        var index;
        for (index = 0; index < source.length; index += 1) {
            output[index] = colorInt(source[index], 0);
        }
        return output;
    }

    function jint2Array(rows) {
        var source = rows || [];
        var output = JavaArray.newInstance(JavaClass.forName("[I"), source.length);
        var index;
        for (index = 0; index < source.length; index += 1) {
            output[index] = jintArray(source[index]);
        }
        return output;
    }

    function safeColorStateList(colorValue) {
        return new ColorStateList(jint2Array([[]]), jintArray([
            colorInt(colorValue, 0)
        ]));
    }

    function safeSetTextColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        viewObj.setTextColor(safeColorStateList(colorValue));
        return true;
    }

    function safeSetHintTextColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        viewObj.setHintTextColor(safeColorStateList(colorValue));
        return true;
    }

    function safeSetLinkTextColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        viewObj.setLinkTextColor(safeColorStateList(colorValue));
        return true;
    }

    function safeSetGradientColor(drawableObj, colorValue) {
        if (drawableObj === null || drawableObj === undefined) { return false; }
        drawableObj.setColor(safeColorStateList(colorValue));
        return true;
    }

    function safeSetGradientStroke(drawableObj, widthPx, colorValue) {
        if (drawableObj === null || drawableObj === undefined) { return false; }
        drawableObj.setStroke(Math.max(0, Math.round(Number(widthPx) || 0)),
            safeColorStateList(colorValue));
        return true;
    }

    function safeSetBackgroundColor(viewObj, colorValue) {
        var background;
        if (viewObj === null || viewObj === undefined) { return false; }
        background = new GradientDrawable();
        background.setShape(GradientDrawable.RECTANGLE);
        safeSetGradientColor(background, colorValue);
        viewObj.setBackground(background);
        return true;
    }

    function safeSetTintColor(drawableObj, colorValue) {
        if (drawableObj === null || drawableObj === undefined) { return false; }
        drawableObj.setTintList(safeColorStateList(colorValue));
        return true;
    }

    function safeSetPaintColor(paintObj, colorValue) {
        var color;
        if (paintObj === null || paintObj === undefined) { return false; }
        color = colorInt(colorValue, 0);
        paintObj.setARGB(
            (color >>> 24) & 255,
            (color >>> 16) & 255,
            (color >>> 8) & 255,
            color & 255
        );
        return true;
    }

'''
    source = replace_once(
        source,
        "    function copy(value) {\n",
        helpers + "    function copy(value) {\n",
        "Theme color bridge helpers",
    )

    source = replace_once(
        source,
        "        getMode: function () { return configuredMode(); },\n"
        "        isDark: isDark,\n",
        "        getMode: function () { return configuredMode(); },\n"
        "        toColorInt: colorInt,\n"
        "        safeColorStateList: safeColorStateList,\n"
        "        setTextColor: safeSetTextColor,\n"
        "        setHintTextColor: safeSetHintTextColor,\n"
        "        setLinkTextColor: safeSetLinkTextColor,\n"
        "        setGradientColor: safeSetGradientColor,\n"
        "        setGradientStroke: safeSetGradientStroke,\n"
        "        setBackgroundColor: safeSetBackgroundColor,\n"
        "        setTintColor: safeSetTintColor,\n"
        "        setPaintColor: safeSetPaintColor,\n"
        "        isDark: isDark,\n",
        "Theme color bridge exports",
    )
    return source


def main() -> int:
    changed_sources: dict[Path, str] = {}
    versions: dict[str, tuple[int, int]] = {}
    total_replacements = 0

    for path in TARGETS:
        source = path.read_text(encoding="utf-8")
        if path == THEME:
            source = install_theme_bridge(source)
        else:
            source, count = rewrite_unsafe_color_calls(source, path)
            total_replacements += count
        source, old_version, new_version = increment_module_version(source, path)
        changed_sources[path] = source
        versions[path.name] = (old_version, new_version)

    if total_replacements != EXPECTED_REPLACEMENTS:
        raise SystemExit(
            "expected " + str(EXPECTED_REPLACEMENTS) +
            " unsafe color replacements, found " + str(total_replacements)
        )

    for path, source in changed_sources.items():
        path.write_text(source, encoding="utf-8")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if str(manifest.get("moduleSetVersion")) not in (
        "20260723.12", MODULE_SET_VERSION
    ):
        raise SystemExit(
            "unexpected moduleSetVersion: " +
            str(manifest.get("moduleSetVersion"))
        )
    manifest["moduleSetVersion"] = MODULE_SET_VERSION

    sha_by_name = {
        path.name: git_blob_sha(source)
        for path, source in changed_sources.items()
    }
    seen: set[str] = set()
    for item in manifest.get("modules", []):
        name = str(item.get("name") or "")
        if name in sha_by_name:
            item["sha"] = sha_by_name[name]
            seen.add(name)
    missing = sorted(set(sha_by_name) - seen)
    if missing:
        raise SystemExit("manifest modules missing: " + ", ".join(missing))

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("Rhino color overload safety patch applied.")
    print("unsafeCallsReplaced: " + str(total_replacements))
    print("moduleSetVersion: " + MODULE_SET_VERSION)
    for name in sorted(versions):
        old_version, new_version = versions[name]
        print(name + ": " + str(old_version) + " -> " + str(new_version))
    for name in sorted(sha_by_name):
        print(name + " sha: " + sha_by_name[name])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
