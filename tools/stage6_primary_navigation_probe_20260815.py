#!/usr/bin/env python3
import base64
import gzip
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = [
    "src/ch_09_list.js",
    "src/ch_10_editor.js",
    "src/ch_11_filter.js",
    "src/ch_12_translation.js",
    "src/ch_13_settings.js",
    "src/ch_15_app.js",
    "src/ch_16_ui_shell.js",
    "src/ch_17_tokenizer_ui.js",
]


def source_for(path):
    text = (ROOT / path).read_text(encoding="utf-8")
    m = re.search(r"\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);", text, re.S)
    if m is None:
        return text
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', m.group(1))
    return gzip.decompress(base64.b64decode(
        "".join(json.loads(piece) for piece in pieces))).decode("utf-8")


def module_version(src, module_name):
    m = re.search(r'MODULE_NAME:\s*"' + re.escape(module_name) +
                  r'"\s*,\s*MODULE_VERSION:\s*(\d+)', src, re.S)
    return int(m.group(1)) if m else None


def context(src, marker, radius=800):
    pos = src.find(marker)
    if pos < 0:
        return "<missing>"
    lo = max(0, pos - radius)
    hi = min(len(src), pos + len(marker) + radius)
    return src[lo:hi]

sources = {path: source_for(path) for path in TARGETS}
print("=== STAGE6 PRIMARY NAVIGATION PROBE ===")
expected_versions = {
    "src/ch_09_list.js": ("ch_09_list", 22),
    "src/ch_10_editor.js": ("ch_10_editor", 32),
    "src/ch_11_filter.js": ("ch_11_filter", 85),
    "src/ch_12_translation.js": ("ch_12_translation", 17),
    "src/ch_13_settings.js": ("ch_13_settings", 34),
    "src/ch_15_app.js": ("ch_15_app", 21),
    "src/ch_16_ui_shell.js": ("ch_16_ui_shell", 5),
    "src/ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 3),
}
for path, (name, expected) in expected_versions.items():
    actual = module_version(sources[path], name)
    print("%s=%s" % (name, actual))
    assert actual == expected, (path, expected, actual)

ui = sources["src/ch_16_ui_shell.js"]
assert 'registerPage({ id: "filter"' not in ui
assert 'legacyWindowBridge: true' in ui
assert 'primaryWindowMode: true' in ui
assert 'MODULE_VERSION: 5' in ui

contracts = {
    "src/ch_09_list.js": [
        'ClipHub.UIShell.canEmbed("detail")',
        'ClipHub.UIShell.mountPage("detail"',
        'ClipHub.UIShell.unmountPage("detail"',
        'detailEmbeddedInPrimary',
    ],
    "src/ch_10_editor.js": [
        'ClipHub.UIShell.canEmbed("editor")',
        'ClipHub.UIShell.mountPage("editor"',
        'ClipHub.UIShell.syncEmbeddedPage',
        'embeddedInPrimary',
        'panelOverlayHost',
    ],
    "src/ch_12_translation.js": [
        'ClipHub.UIShell.canEmbed("translation")',
        'ClipHub.UIShell.mountPage("translation"',
        'translationEmbeddedInPrimary',
    ],
    "src/ch_13_settings.js": [
        'ClipHub.UIShell.canEmbed("settings")',
        'ClipHub.UIShell.mountPage("settings"',
        'ClipHub.UIShell.syncEmbeddedPage',
        'embeddedInPrimary',
    ],
    "src/ch_17_tokenizer_ui.js": [
        'ClipHub.UIShell.canEmbed("tokenizer")',
        'syncTokenizerShell("tokenizer"',
        'editorEmbeddedInPrimary',
    ],
}
for path, markers in contracts.items():
    for marker in markers:
        assert marker in sources[path], (path, marker)

print("\n=== WINDOW ADDVIEW FALLBACK COUNTS ===")
for path in TARGETS:
    src = sources[path]
    count = src.count(".addView(")
    wm_count = len(re.findall(r'windowManager\.addView\(|detailWindowManager\.addView\(', src))
    if wm_count:
        print("%s window_add=%d all_add=%d" % (path, wm_count, count))

print("\n=== UISHELL CALL COUNTS ===")
for path in TARGETS:
    src = sources[path]
    if "UIShell" in src:
        print("%s canEmbed=%d mount=%d sync=%d unmount=%d dispatchBack=%d dispatchClose=%d" % (
            path,
            src.count("UIShell.canEmbed"),
            src.count("UIShell.mountPage"),
            src.count("UIShell.syncEmbeddedPage"),
            src.count("UIShell.unmountPage"),
            src.count("UIShell.dispatchBack"),
            src.count("UIShell.dispatchClose"),
        ))

print("\n=== NAVIGATION / FILTER LEGACY REFERENCES ===")
nav = sources["src/ch_12_translation.js"]
for marker in [
    'wrapMethod(ClipHub.Filter, "showPanel"',
    'wrapMethod(ClipHub.Filter, "showRoot"',
    'owner: "filter"',
    'backFilter',
    'closeFilter',
]:
    print("%r count=%d" % (marker, nav.count(marker)))
    if marker in nav:
        print(context(nav, marker, 500))

print("\n=== EMBEDDED BACK/CLOSE CONTEXTS ===")
checks = [
    ("src/ch_09_list.js", 'ClipHub.UIShell.mountPage("detail"'),
    ("src/ch_10_editor.js", 'ClipHub.UIShell.mountPage("editor"'),
    ("src/ch_10_editor.js", 'function handleBack('),
    ("src/ch_12_translation.js", 'ClipHub.UIShell.mountPage("translation"'),
    ("src/ch_13_settings.js", 'ClipHub.UIShell.mountPage("settings"'),
    ("src/ch_13_settings.js", 'function performSettingsBack('),
    ("src/ch_17_tokenizer_ui.js", 'syncTokenizerShell("tokenizer"'),
]
for path, marker in checks:
    print("\n--- %s :: %s ---" % (path, marker))
    print(context(sources[path], marker, 1100))

filter_src = sources["src/ch_11_filter.js"]
assert 'showPanel: showPanel,' not in filter_src
assert re.search(r'showPanel:\s*function\s*\(options\).*?options\.rootMode\s*=\s*true;.*?return\s+showPanel\(options\);', filter_src, re.S)
assert 'resultBodyFrame.addView(nextBundle.container' in filter_src
print("\nStage6 static contracts: passed")
