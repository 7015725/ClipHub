#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

BASELINE = "1ceceb3373049e9308877a21b02510d3a419664e"
TARGET_SET = "20260815.26"
TARGET_THEME_VERSION = 9

ICON_BLOCK = r'''
    /* panel_shortx_icon_system_v1: resolve ShortX built-in Remix drawables at runtime. */
    var SHORTX_ICON_PACKAGE = "tornaco.apps.shortx";
    var SHORTX_ICON_RESOURCES = {
        add: "ic_remix_add_line",
        close: "ic_remix_close_line",
        back: "ic_remix_arrow_left_s_line",
        forward: "ic_remix_arrow_right_s_line",
        check: "ic_remix_check_line",
        settings: "ic_remix_settings_3_line",
        search: "ic_remix_search_line",
        list: "ic_remix_list_unordered",
        more_vertical: "ic_remix_more_2_line",
        edit: "ic_remix_edit_line",
        copy: "ic_remix_file_copy_line",
        delete: "ic_remix_delete_bin_line",
        help: "ic_remix_question_mark",
        pin: "ic_remix_pushpin_line",
        globe: "ic_remix_global_line",
        input: "ic_remix_login_box_line",
        download: "ic_remix_download_line",
        up: "ic_remix_arrow_up_s_line",
        down: "ic_remix_arrow_down_s_line",
        rules: "ic_remix_braces_line"
    };
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
    var shortxIconRuntime = {
        remoteContext: null,
        resources: null,
        resourceIds: {},
        bitmaps: {}
    };

    function panelIconName(value) {
        var key = String(value === null || value === undefined ? "" : value);
        return PANEL_ICON_TOKENS.hasOwnProperty(key) ? PANEL_ICON_TOKENS[key] : null;
    }

    function isPanelIconToken(value) {
        return panelIconName(value) !== null;
    }

    function getShortXIconRuntime(context) {
        if (shortxIconRuntime.resources !== null) { return shortxIconRuntime; }
        try {
            shortxIconRuntime.remoteContext = context.createPackageContext(
                SHORTX_ICON_PACKAGE,
                Packages.android.content.Context.CONTEXT_IGNORE_SECURITY
            );
            shortxIconRuntime.resources = shortxIconRuntime.remoteContext.getResources();
        } catch (error) {
            shortxIconRuntime.remoteContext = null;
            shortxIconRuntime.resources = null;
        }
        return shortxIconRuntime;
    }

    function getShortXIconResourceId(context, resourceName) {
        var runtime = getShortXIconRuntime(context);
        var key = String(resourceName || "");
        var id;
        if (runtime.resources === null || key === "") { return 0; }
        if (runtime.resourceIds.hasOwnProperty(key)) { return Number(runtime.resourceIds[key]) || 0; }
        try {
            id = Number(runtime.resources.getIdentifier(key, "drawable", SHORTX_ICON_PACKAGE)) || 0;
        } catch (error) { id = 0; }
        runtime.resourceIds[key] = id;
        return id;
    }

    function makeShortXPanelIconDrawable(context, value, colorValue, sizeDp) {
        var semantic = panelIconName(value);
        var resourceName;
        var runtime;
        var resourceId;
        var sourceDrawable;
        var Bitmap = Packages.android.graphics.Bitmap;
        var Canvas = Packages.android.graphics.Canvas;
        var BitmapDrawable = Packages.android.graphics.drawable.BitmapDrawable;
        var density = 1;
        var logicalSize = Number(sizeDp || 18);
        var px;
        var tintColor;
        var cacheKey;
        var bitmap;
        var drawable;
        if (semantic === null || context === null || context === undefined) { return null; }
        resourceName = SHORTX_ICON_RESOURCES[semantic];
        if (!resourceName) { return null; }
        runtime = getShortXIconRuntime(context);
        if (runtime.resources === null) { return null; }
        resourceId = getShortXIconResourceId(context, resourceName);
        if (resourceId <= 0) { return null; }
        try { density = Number(context.getResources().getDisplayMetrics().density || 1); }
        catch (ignoredDensity) { density = 1; }
        if (!isFinite(density) || density <= 0) { density = 1; }
        if (!isFinite(logicalSize)) { logicalSize = 18; }
        logicalSize = clampNumber(logicalSize, 14, 22);
        px = Math.max(1, Math.round(logicalSize * density));
        tintColor = colorInt(colorValue, 0);
        cacheKey = resourceName + "|" + String(tintColor) + "|" + String(px);
        bitmap = runtime.bitmaps[cacheKey];
        if (bitmap === undefined || bitmap === null) {
            try {
                sourceDrawable = runtime.resources.getDrawable(resourceId, null);
                if (sourceDrawable === null || sourceDrawable === undefined) { return null; }
                sourceDrawable = sourceDrawable.mutate();
                safeSetTintColor(sourceDrawable, tintColor);
                bitmap = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
                sourceDrawable.setBounds(0, 0, px, px);
                sourceDrawable.draw(new Canvas(bitmap));
                runtime.bitmaps[cacheKey] = bitmap;
            } catch (error) { return null; }
        }
        drawable = new BitmapDrawable(context.getResources(), bitmap);
        drawable.setBounds(0, 0, px, px);
        return drawable;
    }

    function decoratePanelIcon(viewObj, value, colorValue, sizeDp) {
        var drawable;
        var Gravity = Packages.android.view.Gravity;
        if (viewObj === null || viewObj === undefined || !isPanelIconToken(value)) { return false; }
        drawable = makeShortXPanelIconDrawable(viewObj.getContext(), value, colorValue, sizeDp);
        if (drawable === null) { return false; }
        try { viewObj.setText(""); } catch (ignoredText) {}
        try { viewObj.setCompoundDrawables(null, null, null, null); } catch (ignoredCompound) {}
        try {
            viewObj.setForeground(drawable);
            viewObj.setForegroundGravity(Gravity.CENTER);
            try { viewObj.setGravity(Gravity.CENTER); } catch (ignoredGravity) {}
            return true;
        } catch (ignoredForeground) {}
        try {
            viewObj.setCompoundDrawables(drawable, null, null, null);
            viewObj.setGravity(Gravity.CENTER);
            return true;
        } catch (ignoredFallback) {}
        return false;
    }

    function resetShortXPanelIconRuntime() {
        shortxIconRuntime = {
            remoteContext: null,
            resources: null,
            resourceIds: {},
            bitmaps: {}
        };
    }

'''

def main():
    theme_path = Path("src/ch_07_theme.js")
    theme = theme_path.read_text(encoding="utf-8")
    assert "MODULE_VERSION: 8" in theme
    start = theme.index("    /* panel_icon_system_v1")
    end = theme.index("    function configuredMode()", start)
    theme = theme[:start] + ICON_BLOCK + theme[end:]
    theme = theme.replace("MODULE_VERSION: 8", "MODULE_VERSION: 9", 1)
    assert "panel_shortx_icon_system_v1" in theme
    assert "panel_icon_system_v1" not in theme
    assert "panel_icon_optical_p1_v1" not in theme
    assert 'settings: "ic_remix_settings_3_line"' in theme
    assert 'globe: "ic_remix_global_line"' in theme
    assert 'list: "ic_remix_list_unordered"' in theme
    old_shutdown = 'shutdown: function () { mode = "system"; return true; }'
    new_shutdown = 'shutdown: function () { mode = "system"; resetShortXPanelIconRuntime(); return true; }'
    assert old_shutdown in theme
    theme = theme.replace(old_shutdown, new_shutdown, 1)
    old_export = "        makePanelIconDrawable: makePanelIconDrawable,\n        decoratePanelIcon: decoratePanelIcon,"
    new_export = "        makePanelIconDrawable: makeShortXPanelIconDrawable,\n        getShortXPanelIconDrawable: makeShortXPanelIconDrawable,\n        decoratePanelIcon: decoratePanelIcon,"
    assert old_export in theme
    theme = theme.replace(old_export, new_export, 1)
    theme_path.write_text(theme, encoding="utf-8")

    manifest_path = Path("module-manifest.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["moduleSetVersion"] == "20260815.25"
    manifest["moduleSetVersion"] = TARGET_SET
    theme_blob = subprocess.check_output(["git", "hash-object", str(theme_path)], text=True).strip()
    matched = False
    for item in manifest["modules"]:
        if item["name"] == "ch_07_theme.js":
            item["sha"] = theme_blob
            matched = True
    assert matched
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    preflight_path = Path("scripts/release_preflight.sh")
    preflight = preflight_path.read_text(encoding="utf-8")
    assert "EXPECTED_MODULE_SET='20260815.25'" in preflight
    preflight = preflight.replace("EXPECTED_MODULE_SET='20260815.25'", "EXPECTED_MODULE_SET='20260815.26'", 1)
    assert 'expected_theme_version = 8 if mode == "--settings-tabs-beta" else 4' in preflight
    preflight = preflight.replace(
        'expected_theme_version = 8 if mode == "--settings-tabs-beta" else 4',
        'expected_theme_version = 9 if mode == "--settings-tabs-beta" else 4', 1)
    assert 'assert "panel_icon_system_v1" in theme\n' in preflight
    preflight = preflight.replace(
        'assert "panel_icon_system_v1" in theme\n',
        'assert "panel_shortx_icon_system_v1" in theme\n'
        'assert \'SHORTX_ICON_PACKAGE = "tornaco.apps.shortx"\' in theme\n'
        'assert \'settings: "ic_remix_settings_3_line"\' in theme\n'
        'assert \'list: "ic_remix_list_unordered"\' in theme\n'
        'assert \'globe: "ic_remix_global_line"\' in theme\n'
        'assert "getShortXPanelIconDrawable: makeShortXPanelIconDrawable" in theme\n', 1)
    preflight = preflight.replace('assert "panel_icon_optical_p1_v1" in theme\n', '')
    preflight_path.write_text(preflight, encoding="utf-8")

    print("Prepared ShortX reflected icon backend", TARGET_SET, "Theme", TARGET_THEME_VERSION)
    print("Theme blob", theme_blob)

if __name__ == "__main__":
    main()
