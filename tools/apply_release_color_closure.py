#!/usr/bin/env python3
"""Finalize ClipHub Rhino/ColorOS color safety before formal release."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
THEME = ROOT / "src/ch_07_theme.js"
AUDIT = ROOT / "scripts/audit_color_api.py"
MANIFEST = ROOT / "module-manifest.json"
CURRENT_SET = "20260723.13"
NEXT_SET = "20260723.14"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def git_blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    return hashlib.sha1(f"blob {len(data)}\0".encode("utf-8") + data).hexdigest()


def patch_theme(source: str) -> str:
    pattern = re.compile(
        r"    function safeColorStateList\(colorValue\) \{.*?"
        r"\n    function copy\(value\) \{",
        re.S,
    )
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise SystemExit(
            "Theme safe-color helper section: expected one match, found " +
            str(len(matches))
        )

    helpers = r'''    var colorSafetyState = {
        applyCount: 0,
        failureCount: 0,
        lastError: null
    };

    function safeColorStateList(colorValue) {
        var color = colorInt(colorValue, 0);
        return new ColorStateList(jint2Array([
            [Packages.android.R.attr.state_pressed],
            [Packages.android.R.attr.state_focused],
            [Packages.android.R.attr.state_selected],
            []
        ]), jintArray([color, color, color, color]));
    }

    function safeApply(callback) {
        try {
            callback();
            colorSafetyState.applyCount += 1;
            colorSafetyState.lastError = null;
            return true;
        } catch (error) {
            colorSafetyState.failureCount += 1;
            colorSafetyState.lastError = String(error);
            return false;
        }
    }

    function safeSetTextColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        return safeApply(function () {
            viewObj.setTextColor(safeColorStateList(colorValue));
        });
    }

    function safeSetHintTextColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        return safeApply(function () {
            viewObj.setHintTextColor(safeColorStateList(colorValue));
        });
    }

    function safeSetLinkTextColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        return safeApply(function () {
            viewObj.setLinkTextColor(safeColorStateList(colorValue));
        });
    }

    function safeSetGradientColor(drawableObj, colorValue) {
        if (drawableObj === null || drawableObj === undefined) { return false; }
        return safeApply(function () {
            drawableObj.setColor(safeColorStateList(colorValue));
        });
    }

    function safeSetGradientStroke(drawableObj, widthPx, colorValue) {
        if (drawableObj === null || drawableObj === undefined) { return false; }
        return safeApply(function () {
            drawableObj.setStroke(
                Math.max(0, Math.round(Number(widthPx) || 0)),
                safeColorStateList(colorValue)
            );
        });
    }

    function safeSetBackgroundColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        return safeApply(function () {
            var background = new GradientDrawable();
            background.setShape(GradientDrawable.RECTANGLE);
            background.setColor(safeColorStateList(colorValue));
            viewObj.setBackground(background);
        });
    }

    function safeSetTintColor(drawableObj, colorValue) {
        if (drawableObj === null || drawableObj === undefined) { return false; }
        return safeApply(function () {
            drawableObj.setTintList(safeColorStateList(colorValue));
        });
    }

    function safeSetPaintColor(paintObj, colorValue) {
        if (paintObj === null || paintObj === undefined) { return false; }
        return safeApply(function () {
            var color = colorInt(colorValue, 0);
            paintObj.setARGB(
                (color >>> 24) & 255,
                (color >>> 16) & 255,
                (color >>> 8) & 255,
                color & 255
            );
        });
    }

    function getColorSafetyState() {
        return {
            applyCount: Number(colorSafetyState.applyCount),
            failureCount: Number(colorSafetyState.failureCount),
            lastError: colorSafetyState.lastError
        };
    }

    function copy(value) {'''
    source = pattern.sub(helpers, source, count=1)

    version_pattern = re.compile(
        r'(MODULE_NAME:\s*"ch_07_theme"\s*,\s*MODULE_VERSION:\s*)3(\s*,)',
        re.S,
    )
    source, count = version_pattern.subn(r"\g<1>4\g<2>", source, count=1)
    if count != 1:
        raise SystemExit("Theme MODULE_VERSION 3 -> 4 replacement failed")

    source = replace_once(
        source,
        "        applyPaintColor: safeSetPaintColor,\n"
        "        isDark: isDark,\n",
        "        applyPaintColor: safeSetPaintColor,\n"
        "        getColorSafetyState: getColorSafetyState,\n"
        "        isDark: isDark,\n",
        "Theme color-safety state export",
    )
    return source


def patch_audit(source: str) -> str:
    source = replace_once(
        source,
        '    "setHighlightColor",\n)\n',
        '    "setHighlightColor",\n'
        '    "setColors",\n'
        '    "drawColor",\n'
        '    "setShadowLayer",\n'
        ')\n',
        "Audit extra color methods",
    )

    source = replace_once(
        source,
        '        elif method == "setHighlightColor":\n'
        '            reason = "TextView.setHighlightColor(int) 为直接数值颜色调用"\n',
        '        elif method == "setHighlightColor":\n'
        '            reason = "TextView.setHighlightColor(int) 为直接数值颜色调用"\n'
        '        elif method == "setColors":\n'
        '            reason = "GradientDrawable.setColors(int[]) 为直接数值颜色数组调用"\n'
        '        elif method == "drawColor":\n'
        '            reason = "Canvas.drawColor 的数值颜色重载禁止用于正式 Rhino UI"\n'
        '        elif method == "setShadowLayer":\n'
        '            reason = "Paint.setShadowLayer 的颜色参数为直接数值颜色"\n',
        "Audit extra method reasons",
    )

    source = replace_once(
        source,
        '        (re.compile(r"new\\s+(?:Packages\\.android\\.graphics\\.)?PorterDuffColorFilter\\s*\\("),\n'
        '         "PorterDuffColorFilter", "WARN",\n'
        '         "ColorFilter 构造函数直接接收数值颜色，需实机确认或改为 tintList"),\n',
        '        (re.compile(r"new\\s+(?:Packages\\.android\\.graphics\\.)?PorterDuffColorFilter\\s*\\("),\n'
        '         "PorterDuffColorFilter", "WARN",\n'
        '         "ColorFilter 构造函数直接接收数值颜色，需实机确认或改为 tintList"),\n'
        '        (re.compile(r"new\\s+(?:Packages\\.android\\.graphics\\.drawable\\.)?PaintDrawable\\s*\\("),\n'
        '         "PaintDrawable", "WARN",\n'
        '         "PaintDrawable(int) 直接接收数值颜色，应改为安全 GradientDrawable"),\n',
        "Audit PaintDrawable constructor",
    )

    source = replace_once(
        source,
        '    parser.add_argument("--strict", action="store_true",\n'
        '                        help="exit non-zero when HIGH findings exist")\n',
        '    parser.add_argument("--strict", action="store_true",\n'
        '                        help="exit non-zero when HIGH findings exist")\n'
        '    parser.add_argument("--release-strict", action="store_true",\n'
        '                        help="exit non-zero when HIGH or WARN findings exist")\n',
        "Audit release-strict argument",
    )

    source = replace_once(
        source,
        '    high_count = sum(1 for item in findings if item.severity == "HIGH")\n'
        '    return 1 if args.strict and high_count > 0 else 0\n',
        '    high_count = sum(1 for item in findings if item.severity == "HIGH")\n'
        '    warn_count = sum(1 for item in findings if item.severity == "WARN")\n'
        '    if args.release_strict and (high_count > 0 or warn_count > 0):\n'
        '        return 1\n'
        '    return 1 if args.strict and high_count > 0 else 0\n',
        "Audit release-strict result",
    )
    return source


def main() -> int:
    theme_before = THEME.read_text(encoding="utf-8")
    audit_before = AUDIT.read_text(encoding="utf-8")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    if str(manifest.get("moduleSetVersion")) != CURRENT_SET:
        raise SystemExit(
            "expected moduleSetVersion " + CURRENT_SET + ", actual " +
            str(manifest.get("moduleSetVersion"))
        )

    theme_after = patch_theme(theme_before)
    audit_after = patch_audit(audit_before)
    theme_sha = git_blob_sha(theme_after)

    found_theme = False
    for item in manifest.get("modules", []):
        if str(item.get("name")) == "ch_07_theme.js":
            item["sha"] = theme_sha
            found_theme = True
    if not found_theme:
        raise SystemExit("manifest is missing ch_07_theme.js")
    manifest["moduleSetVersion"] = NEXT_SET

    THEME.write_text(theme_after, encoding="utf-8")
    AUDIT.write_text(audit_after, encoding="utf-8")
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("Formal release color closure applied.")
    print("moduleSetVersion: " + CURRENT_SET + " -> " + NEXT_SET)
    print("Theme MODULE_VERSION: 3 -> 4")
    print("Theme sha: " + theme_sha)
    print("ColorStateList states: pressed, focused, selected, default")
    print("Color bridge fallback to numeric overload: disabled")
    print("Release audit gate: HIGH=0 and WARN=0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
