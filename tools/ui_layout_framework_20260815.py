#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "module-manifest.json"
THEME = ROOT / "src/ch_07_theme.js"
FILTER = ROOT / "src/ch_11_filter.js"
SETTINGS = ROOT / "src/ch_13_settings.js"
SETTINGS_FRAGMENT = ROOT / "tools/regex_beta_patches/settings_regex_feature.jsfrag"
PREFLIGHT = ROOT / "scripts/release_preflight.sh"

OLD_SET = "20260815.08"
NEW_SET = "20260815.09"
SOURCE_REF = "beta-regex-settings-tabs-20260814"
OLD_FILTER_VERSION = 82
NEW_FILTER_VERSION = 83
OLD_SETTINGS_VERSION = 31
NEW_SETTINGS_VERSION = 32


def fail(message):
    raise RuntimeError(message)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        fail("%s: expected one anchor, got %d" % (label, count))
    return text.replace(old, new, 1)


def blob_sha(data):
    return hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()


def unpack_loader(path):
    loader = path.read_text(encoding="utf-8")
    assignment = re.search(
        r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", loader, re.S
    )
    if assignment is None:
        fail(str(path) + ": packed assignment missing")
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(2))
    if not pieces:
        fail(str(path) + ": packed chunks missing")
    encoded = "".join(json.loads(piece) for piece in pieces)
    canonical = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    expected = re.search(
        r"\bvar\s+SOURCE_SHA256\s*=\s*[\"']([0-9a-fA-F]{64})[\"']",
        loader,
    )
    if expected is not None:
        actual = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        if actual != expected.group(1).lower():
            fail(str(path) + ": SOURCE_SHA256 mismatch")
    return loader, assignment.group(1), canonical


def repack_loader(path, loader, variable, canonical):
    raw = gzip.compress(canonical.encode("utf-8"), compresslevel=9, mtime=0)
    encoded = base64.b64encode(raw).decode("ascii")
    chunks = [encoded[i:i + 120] for i in range(0, len(encoded), 120)]
    expression = "\n        " + " +\n        ".join(
        json.dumps(chunk) for chunk in chunks
    ) + "\n    "
    pattern = re.compile(
        r"(\bvar\s+" + re.escape(variable) + r"\s*=\s*)(.*?)(;)", re.S
    )
    match = pattern.search(loader)
    if match is None:
        fail(str(path) + ": packed replacement anchor missing")
    loader = loader[:match.start(2)] + expression + loader[match.end(2):]
    source_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    loader, count = re.subn(
        r"(\bvar\s+SOURCE_SHA256\s*=\s*[\"'])[0-9a-fA-F]{64}([\"'])",
        lambda m: m.group(1) + source_sha + m.group(2),
        loader,
        count=1,
    )
    if count != 1:
        fail(str(path) + ": SOURCE_SHA256 replacement failed")
    loader = "\n".join(line.rstrip() for line in loader.splitlines()) + "\n"
    path.write_text(loader, encoding="utf-8")
    return loader


def function_span(text, name):
    match = re.search(
        r"(^|\n)([ \t]*)function\s+" + re.escape(name) + r"\s*\(",
        text,
        re.M,
    )
    if match is None:
        fail("function missing: " + name)
    start = match.start(2)
    brace = text.find("{", match.end())
    if brace < 0:
        fail("function brace missing: " + name)
    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    index = brace
    while index < len(text):
        char = text[index]
        next_char = text[index + 1] if index + 1 < len(text) else ""
        if line_comment:
            if char == "\n":
                line_comment = False
        elif block_comment:
            if char == "*" and next_char == "/":
                block_comment = False
                index += 1
        elif quote is not None:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
        else:
            if char == "/" and next_char == "/":
                line_comment = True
                index += 1
            elif char == "/" and next_char == "*":
                block_comment = True
                index += 1
            elif char in ('"', "'"):
                quote = char
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return start, index + 1
        index += 1
    fail("unterminated function: " + name)


def replace_function(text, name, replacement):
    start, end = function_span(text, name)
    return text[:start] + replacement.rstrip() + text[end:]


def patch_theme():
    text = THEME.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "        searchHeightDp: 44,\n        minTouchDp: 40\n",
        "        searchHeightDp: 44,\n"
        "        minTouchDp: 40,\n"
        "        pageRadiusDp: 24,\n"
        "        pagePaddingTopDp: 8,\n"
        "        pagePaddingBottomDp: 10,\n"
        "        sectionPaddingHorizontalDp: 11,\n"
        "        sectionPaddingVerticalDp: 10,\n"
        "        headerTopOffsetDp: -2,\n"
        "        headerBottomGapDp: 8,\n"
        "        tabMinHeightDp: 38,\n"
        "        tabBottomGapDp: 8\n",
        "theme layout tokens",
    )
    helper = '''    function clampNumber(value, minValue, maxValue) {
        return Math.max(minValue, Math.min(maxValue, value));
    }

    function getLayoutMetrics(widthDp, fontScale, touchSlopDp) {
        var width = Number(widthDp || 0);
        var scale = Number(fontScale || 1);
        var touch = Number(touchSlopDp || 1);
        var baseDp;
        var actionSizeDp;
        var controlHeightDp;
        var gapDp;
        var titleSp;
        var iconSp;
        var statusSp;
        var searchSp;
        var radiusDp;
        var inputPaddingDp;
        var badgeSizeDp;
        var badgeSp;
        if (!isFinite(width) || width <= 0) { width = 390; }
        if (!isFinite(scale) || scale <= 0) { scale = 1; }
        if (!isFinite(touch) || touch <= 0) { touch = 1; }
        baseDp = Math.max(touch, width * 0.018);
        actionSizeDp = clampNumber(width * 0.092,
            baseDp * 4.4, width * 0.12);
        controlHeightDp = clampNumber(actionSizeDp * 1.02,
            baseDp * 4.6, width * 0.125);
        gapDp = clampNumber(width * 0.014,
            baseDp * 0.65, actionSizeDp * 0.24);
        titleSp = clampNumber(width / (scale * 23),
            actionSizeDp / (scale * 2.45),
            actionSizeDp / (scale * 1.85));
        iconSp = clampNumber(actionSizeDp / (scale * 2.05),
            titleSp * 0.86, titleSp * 1.18);
        statusSp = clampNumber(titleSp * 0.60,
            iconSp * 0.58, titleSp * 0.72);
        searchSp = clampNumber(titleSp * 0.70,
            statusSp, titleSp * 0.82);
        radiusDp = Math.max(baseDp * 1.3, controlHeightDp * 0.44);
        inputPaddingDp = Math.max(baseDp * 0.65, gapDp);
        badgeSizeDp = Math.max(baseDp * 2.0, actionSizeDp * 0.38);
        badgeSp = Math.max(statusSp * 0.64,
            badgeSizeDp / (scale * 3.4));
        return {
            widthDp: width,
            fontScale: scale,
            baseDp: baseDp,
            actionSizeDp: actionSizeDp,
            controlHeightDp: controlHeightDp,
            gapDp: gapDp,
            titleSp: titleSp,
            iconSp: iconSp,
            statusSp: statusSp,
            searchSp: searchSp,
            radiusDp: radiusDp,
            inputPaddingDp: inputPaddingDp,
            badgeSizeDp: badgeSizeDp,
            badgeSp: badgeSp
        };
    }

'''
    text = replace_once(
        text,
        "    function configuredMode() {",
        helper + "    function configuredMode() {",
        "theme layout helper",
    )
    text = replace_once(
        text, "        MODULE_VERSION: 4,", "        MODULE_VERSION: 5,",
        "theme module version",
    )
    text = replace_once(
        text,
        "        getMetrics: function () { return copy(METRICS); },\n",
        "        getMetrics: function () { return copy(METRICS); },\n"
        "        getLayoutMetrics: getLayoutMetrics,\n",
        "theme layout api",
    )
    THEME.write_text(text, encoding="utf-8")


def patch_filter():
    loader, variable, source = unpack_loader(FILTER)
    new_header = '''    function headerMetrics() {
        var widthDp = Number(state.panelWidthDp || 0);
        var fontScale = resourceFontScale();
        var touchDp = Math.max(1, Number(touchSlop || 1) / density);
        var metrics;
        if (widthDp <= 0 && Number(state.panelWidthPx || 0) > 0) {
            widthDp = Number(state.panelWidthPx) / density;
        }
        if (widthDp <= 0) {
            widthDp = Number(appContext.getResources()
                .getDisplayMetrics().widthPixels) / density;
        }
        metrics = ClipHub.Theme.getLayoutMetrics(
            widthDp, fontScale, touchDp);
        state.headerHeightDp = metrics.actionSizeDp +
            metrics.gapDp + metrics.controlHeightDp;
        state.headerControlHeightDp = metrics.controlHeightDp;
        state.headerActionSizeDp = metrics.actionSizeDp;
        state.headerGapDp = metrics.gapDp;
        return metrics;
    }'''
    source = replace_function(source, "headerMetrics", new_header)

    start, end = function_span(source, "createPanelCache")
    fn = source[start:end]
    fn = replace_once(
        fn,
        "    function createPanelCache(size, type, colors) {\n"
        "        panelRoot = new LinearLayout(appContext);",
        "    function createPanelCache(size, type, colors) {\n"
        "        var layout = ClipHub.Theme.getMetrics();\n"
        "        panelRoot = new LinearLayout(appContext);",
        "filter panel layout local",
    )
    fn = replace_once(
        fn,
        "        panelRoot.setPadding(dp(12), dp(8), dp(12), dp(10));",
        "        panelRoot.setPadding(dp(layout.screenPaddingDp),\n"
        "            dp(layout.pagePaddingTopDp),\n"
        "            dp(layout.screenPaddingDp),\n"
        "            dp(layout.pagePaddingBottomDp));",
        "filter panel padding",
    )
    fn = replace_once(
        fn,
        "        panelRoot.setBackground(roundedBackground(colors.surface,\n"
        "            colors.stroke, 24));",
        "        panelRoot.setBackground(roundedBackground(colors.surface,\n"
        "            colors.stroke, layout.pageRadiusDp));",
        "filter panel radius",
    )
    source = source[:start] + fn + source[end:]
    source = replace_once(
        source,
        "MODULE_VERSION: %d" % OLD_FILTER_VERSION,
        "MODULE_VERSION: %d" % NEW_FILTER_VERSION,
        "filter module version",
    )
    loader = repack_loader(FILTER, loader, variable, source)
    loader = loader.replace(
        "Filter%d ES5 loader" % OLD_FILTER_VERSION,
        "Filter%d ES5 loader" % NEW_FILTER_VERSION,
        1,
    )
    FILTER.write_text(loader, encoding="utf-8")


def settings_subpage_header_source():
    return '''    function makeSettingsSubpageHeader(content, titleText, colors) {
        var header = new LinearLayout(appContext);
        var metrics = settingsLayoutMetrics();
        var layout = ClipHub.Theme.getMetrics();
        var back = makeText("‹", Math.max(22, metrics.iconSp * 1.25),
            colors.icon, true);
        var title = makeText(titleText, metrics.titleSp,
            colors.textPrimary, true);
        var close = makeText("×", metrics.iconSp, colors.icon, false);
        var params;
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        back.setGravity(Gravity.CENTER);
        back.setClickable(true);
        back.setBackground(roundedBackground(colors.surfaceMuted, null,
            metrics.actionSizeDp / 2));
        back.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { handleSettingsBack(); }
        }));
        header.addView(back, new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp)));
        params = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        params.leftMargin = dp(metrics.gapDp);
        header.addView(title, params);
        close.setGravity(Gravity.CENTER);
        close.setClickable(true);
        close.setBackground(roundedBackground(colors.surfaceMuted, null,
            metrics.actionSizeDp / 2));
        close.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { closePage("button"); }
        }));
        header.addView(close, new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(metrics.actionSizeDp));
        params.topMargin = dp(layout.headerTopOffsetDp);
        params.bottomMargin = dp(layout.headerBottomGapDp);
        content.addView(header, params);
        return header;
    }'''


def patch_settings():
    loader, variable, source = unpack_loader(SETTINGS)
    metrics_helper = '''    function settingsLayoutMetrics() {
        var widthDp = 390;
        var fontScale = 1;
        var filterState = null;
        try {
            if (ClipHub.Filter && typeof ClipHub.Filter.getState === "function") {
                filterState = ClipHub.Filter.getState();
                if (filterState && Number(filterState.panelWidthDp || 0) > 0) {
                    widthDp = Number(filterState.panelWidthDp);
                }
            }
        } catch (ignoredSettingsFilterMetrics) {}
        try {
            fontScale = Number(appContext.getResources()
                .getConfiguration().fontScale || 1);
        } catch (ignoredSettingsFontScale) { fontScale = 1; }
        return ClipHub.Theme.getLayoutMetrics(widthDp, fontScale, 1);
    }

'''
    tab_start, _ = function_span(source, "makeSettingsTabBar")
    if "function settingsLayoutMetrics()" in source:
        fail("settingsLayoutMetrics already exists")
    source = source[:tab_start] + metrics_helper + source[tab_start:]

    tab_bar = '''    function makeSettingsTabBar(parent, colors) {
        var bar = new LinearLayout(appContext);
        var metrics = settingsLayoutMetrics();
        var tabHeight = Math.max(ClipHub.Theme.getMetrics().tabMinHeightDp,
            metrics.controlHeightDp);
        var params;
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        settingsGeneralTabButton = makeButton("常规", colors, false, false);
        settingsHomeTabButton = makeButton("首页", colors, false, false);
        settingsTranslationTabButton = makeButton("翻译", colors, false, false);
        settingsFilterTabButton = makeButton("筛选", colors, false, false);
        settingsGeneralTabButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setSettingsTab("general", "tab_click");
            }}));
        settingsHomeTabButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setSettingsTab("home", "tab_click");
            }}));
        settingsTranslationTabButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setSettingsTab("translation", "tab_click");
            }}));
        settingsFilterTabButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setSettingsTab("filter", "tab_click");
            }}));
        bar.addView(settingsGeneralTabButton,
            new LinearLayout.LayoutParams(0, dp(tabHeight), 1));
        params = new LinearLayout.LayoutParams(0, dp(tabHeight), 1);
        params.leftMargin = dp(metrics.gapDp);
        bar.addView(settingsHomeTabButton, params);
        params = new LinearLayout.LayoutParams(0, dp(tabHeight), 1);
        params.leftMargin = dp(metrics.gapDp);
        bar.addView(settingsTranslationTabButton, params);
        params = new LinearLayout.LayoutParams(0, dp(tabHeight), 1);
        params.leftMargin = dp(metrics.gapDp);
        bar.addView(settingsFilterTabButton, params);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(tabHeight + 2));
        params.bottomMargin = dp(ClipHub.Theme.getMetrics().tabBottomGapDp);
        parent.addView(bar, params);
        uiState.settingsTabBarPresent = true;
        return bar;
    }'''
    source = replace_function(source, "makeSettingsTabBar", tab_bar)
    source = replace_function(
        source, "makeSettingsSubpageHeader", settings_subpage_header_source()
    )

    section = '''    function makeSection(colors) {
        var section = new LinearLayout(appContext);
        var layout = ClipHub.Theme.getMetrics();
        section.setOrientation(LinearLayout.VERTICAL);
        section.setPadding(dp(layout.sectionPaddingHorizontalDp),
            dp(layout.sectionPaddingVerticalDp),
            dp(layout.sectionPaddingHorizontalDp),
            dp(layout.sectionPaddingVerticalDp));
        section.setBackground(roundedBackground(colors.surface,
            colors.stroke, layout.cardRadiusDp));
        return section;
    }'''
    source = replace_function(source, "makeSection", section)

    root_start, root_end = function_span(source, "buildRootPage")
    root_fn = source[root_start:root_end]
    root_fn = replace_once(
        root_fn,
        '        var title = makeText("ClipHub 设置", 17, colors.textPrimary, true);',
        '        var layoutMetrics = settingsLayoutMetrics();\n'
        '        var layoutTokens = ClipHub.Theme.getMetrics();\n'
        '        var title = makeText("ClipHub 设置", layoutMetrics.titleSp,\n'
        '            colors.textPrimary, true);',
        "settings root title",
    )
    root_fn = replace_once(
        root_fn,
        '        closeView = makeText("×", 17, colors.icon, false);',
        '        closeView = makeText("×", layoutMetrics.iconSp, colors.icon, false);',
        "settings root close icon",
    )
    root_fn = replace_once(
        root_fn,
        "        header.addView(closeView, new LinearLayout.LayoutParams(dp(36), dp(36)));",
        "        header.addView(closeView, new LinearLayout.LayoutParams(\n"
        "            dp(layoutMetrics.actionSizeDp), dp(layoutMetrics.actionSizeDp)));",
        "settings root close size",
    )
    root_fn = replace_once(
        root_fn,
        "        params = new LinearLayout.LayoutParams(\n"
        "            LinearLayout.LayoutParams.MATCH_PARENT, dp(36));\n"
        "        params.topMargin = -dp(2);\n"
        "        params.bottomMargin = dp(8);",
        "        params = new LinearLayout.LayoutParams(\n"
        "            LinearLayout.LayoutParams.MATCH_PARENT,\n"
        "            dp(layoutMetrics.actionSizeDp));\n"
        "        params.topMargin = dp(layoutTokens.headerTopOffsetDp);\n"
        "        params.bottomMargin = dp(layoutTokens.headerBottomGapDp);",
        "settings root header geometry",
    )
    source = source[:root_start] + root_fn + source[root_end:]
    source = replace_once(
        source,
        "MODULE_VERSION: %d" % OLD_SETTINGS_VERSION,
        "MODULE_VERSION: %d" % NEW_SETTINGS_VERSION,
        "settings module version",
    )
    loader = repack_loader(SETTINGS, loader, variable, source)
    loader = loader.replace(
        "Settings%d source SHA mismatch" % OLD_SETTINGS_VERSION,
        "Settings%d source SHA mismatch" % NEW_SETTINGS_VERSION,
        1,
    )
    SETTINGS.write_text(loader, encoding="utf-8")

    fragment = SETTINGS_FRAGMENT.read_text(encoding="utf-8")
    fragment = replace_function(
        fragment, "makeSettingsSubpageHeader", settings_subpage_header_source()
    )
    SETTINGS_FRAGMENT.write_text(fragment, encoding="utf-8")


def patch_preflight():
    text = PREFLIGHT.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "EXPECTED_MODULE_SET='20260814.05'",
        "EXPECTED_MODULE_SET='20260815.09'",
        "settings-tabs module set",
    )
    text = replace_once(
        text,
        'assert len(manifest.get("modules", [])) == 15, len(manifest.get("modules", []))',
        'expected_module_count = 16 if mode == "--settings-tabs-beta" else 15\n'
        'assert len(manifest.get("modules", [])) == expected_module_count, len(manifest.get("modules", []))',
        "preflight module count",
    )
    text = replace_once(
        text,
        'assert re.search(r"MODULE_NAME:\\s*\\\"ch_07_theme\\\"\\s*,\\s*MODULE_VERSION:\\s*4", theme, re.S)',
        'expected_theme_version = 5 if mode == "--settings-tabs-beta" else 4\n'
        'assert re.search(\n'
        '    r"MODULE_NAME:\\s*\\\"ch_07_theme\\\"\\s*,\\s*MODULE_VERSION:\\s*" +\n'
        '    str(expected_theme_version), theme, re.S)',
        "preflight theme version",
    )
    text = replace_once(
        text,
        'print("Theme: 4")',
        'print("Theme: " + str(expected_theme_version))',
        "preflight theme output",
    )
    text = replace_once(
        text,
        '"ch_11_filter.js": ("ch_11_filter", 81),',
        '"ch_11_filter.js": ("ch_11_filter", 83),',
        "preflight filter version",
    )
    text = replace_once(
        text,
        '"ch_13_settings.js": ("ch_13_settings", 30),',
        '"ch_13_settings.js": ("ch_13_settings", 32),',
        "preflight settings version",
    )
    text = replace_once(
        text,
        '    assert len(manifest.get("modules", [])) == 15\n'
        '    if mode == "--settings-tabs-beta":',
        '    assert len(manifest.get("modules", [])) == '\
        '(16 if mode == "--settings-tabs-beta" else 15)\n'
        '    if mode == "--settings-tabs-beta":',
        "preflight regex module count",
    )
    PREFLIGHT.write_text(text, encoding="utf-8")


def update_manifest():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("moduleSetVersion") != OLD_SET:
        fail("unexpected moduleSetVersion=" + str(manifest.get("moduleSetVersion")))
    if manifest.get("sourceRef") != SOURCE_REF:
        fail("unexpected sourceRef=" + str(manifest.get("sourceRef")))
    if len(manifest.get("modules", [])) != 16:
        fail("unexpected module count=" + str(len(manifest.get("modules", []))))
    by_path = {item["path"]: item for item in manifest["modules"]}
    for item in manifest["modules"]:
        path = ROOT / item["path"]
        if not path.is_file():
            fail("manifest path missing: " + item["path"])
        if blob_sha(path.read_bytes()) != item["sha"]:
            fail("manifest baseline mismatch: " + item["path"])
    # Source files are patched after baseline verification, so return the object.
    return manifest, by_path


def main():
    manifest, by_path = update_manifest()
    patch_theme()
    patch_filter()
    patch_settings()
    patch_preflight()

    manifest["moduleSetVersion"] = NEW_SET
    for relative in (
        "src/ch_07_theme.js",
        "src/ch_11_filter.js",
        "src/ch_13_settings.js",
    ):
        by_path[relative]["sha"] = blob_sha((ROOT / relative).read_bytes())
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("UI layout framework generated")
    print("moduleSetVersion=" + NEW_SET)
    print("Theme=5 Filter=83 Settings=32")


if __name__ == "__main__":
    main()
