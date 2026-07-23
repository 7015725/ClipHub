#!/usr/bin/env python3
"""Run the Rhino color-safety patch with embedded-module-aware versioning."""

from __future__ import annotations

import importlib.util
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE_PATH = ROOT / "tools/apply_color_api_safety.py"

spec = importlib.util.spec_from_file_location("cliphub_color_patch_base", BASE_PATH)
if spec is None or spec.loader is None:
    raise SystemExit("cannot load base color-safety patcher")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)

MODULE_NAMES = {
    "ch_07_theme.js": "ch_07_theme",
    "ch_08_window.js": "ch_08_window",
    "ch_09_list.js": "ch_09_list",
    "ch_10_editor.js": "ch_10_editor",
    "ch_11_filter.js": "ch_11_filter",
    "ch_12_translation.js": "ch_12_translation",
    "ch_13_settings.js": "ch_13_settings",
}

# Do not reuse Android API method names for the JavaScript bridge. This keeps
# the strict auditor focused on the actual Android calls inside ch_07_theme.js.
base.METHOD_HELPERS.update({
    "setTextColor": "applyTextColor",
    "setHintTextColor": "applyHintTextColor",
    "setLinkTextColor": "applyLinkTextColor",
    "setColor": "applyGradientColor",
    "setStroke": "applyGradientStroke",
    "setBackgroundColor": "applyBackgroundColor",
})

_original_install_theme_bridge = base.install_theme_bridge
_original_rewrite_unsafe_color_calls = base.rewrite_unsafe_color_calls


def install_theme_bridge(source: str) -> str:
    output = _original_install_theme_bridge(source)
    replacements = {
        "        setTextColor: safeSetTextColor,\n":
            "        applyTextColor: safeSetTextColor,\n",
        "        setHintTextColor: safeSetHintTextColor,\n":
            "        applyHintTextColor: safeSetHintTextColor,\n",
        "        setLinkTextColor: safeSetLinkTextColor,\n":
            "        applyLinkTextColor: safeSetLinkTextColor,\n",
        "        setGradientColor: safeSetGradientColor,\n":
            "        applyGradientColor: safeSetGradientColor,\n",
        "        setGradientStroke: safeSetGradientStroke,\n":
            "        applyGradientStroke: safeSetGradientStroke,\n",
        "        setBackgroundColor: safeSetBackgroundColor,\n":
            "        applyBackgroundColor: safeSetBackgroundColor,\n",
        "        setTintColor: safeSetTintColor,\n":
            "        applyTintColor: safeSetTintColor,\n",
        "        setPaintColor: safeSetPaintColor,\n":
            "        applyPaintColor: safeSetPaintColor,\n",
    }
    for old, new in replacements.items():
        count = output.count(old)
        if count != 1:
            raise SystemExit(
                "Theme bridge export replacement failed for " + old.strip() +
                ": found " + str(count)
            )
        output = output.replace(old, new, 1)
    return output


def rewrite_unsafe_color_calls(source: str, path: Path) -> tuple[str, int]:
    output, count = _original_rewrite_unsafe_color_calls(source, path)
    output = output.replace(
        "ClipHub.Theme.setGradientStroke(",
        "ClipHub.Theme.applyGradientStroke(",
    )
    return output, count


def increment_module_version(source: str, path: Path) -> tuple[str, int, int]:
    module_name = MODULE_NAMES.get(path.name)
    if module_name is None:
        raise SystemExit("missing module-name mapping for " + str(path))
    pattern = re.compile(
        r'(MODULE_NAME:\s*"' + re.escape(module_name) +
        r'"\s*,\s*MODULE_VERSION:\s*)(\d+)(\s*,)',
        re.S,
    )
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise SystemExit(
            str(path) + ": expected one MODULE_VERSION for " + module_name +
            ", found " + str(len(matches))
        )
    old_version = int(matches[0].group(2))
    new_version = old_version + 1
    output = pattern.sub(
        lambda match: match.group(1) + str(new_version) + match.group(3),
        source,
        count=1,
    )
    return output, old_version, new_version


base.install_theme_bridge = install_theme_bridge
base.rewrite_unsafe_color_calls = rewrite_unsafe_color_calls
base.increment_module_version = increment_module_version

raise SystemExit(base.main())
