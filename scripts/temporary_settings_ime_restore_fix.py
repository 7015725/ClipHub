#!/usr/bin/env python3
from pathlib import Path
import json
import re
import subprocess

TARGET = Path('src/ch_13_settings.js')
MANIFEST = Path('module-manifest.json')
text = TARGET.read_text(encoding='utf-8')


def insert_after(source, marker, addition, label):
    if addition.strip() in source:
        return source
    index = source.find(marker)
    if index < 0:
        raise SystemExit('missing marker for ' + label)
    index += len(marker)
    return source[:index] + addition + source[index:]


text = insert_after(
    text,
    '    var focusedVisibilityScheduled = false;\n',
    '    var imeRestoreLayout = null;\n',
    'IME restore state')

if '        imeRestoreSnapshotCount: 0,\n' not in text:
    text = insert_after(
        text,
        '        keyboardAvoidanceRestoreCount: 0,\n',
        '        imeRestoreSnapshotCount: 0,\n'
        '        imeRestoreFallbackCount: 0,\n'
        '        imeStaleSignalIgnoredCount: 0,\n',
        'IME restore diagnostics')

new_read = r'''    function imeVisibilityThresholdPx(metrics) {
        var heightPx = metrics === null || metrics === undefined ? 0 :
            Number(metrics.heightPixels || 0);
        var lowerPx = dp(72);
        var upperPx = dp(180);
        var proportionalPx = heightPx > 0 ? heightPx * 0.12 : dp(120);
        return Math.max(lowerPx,
            Math.min(upperPx, Math.round(proportionalPx)));
    }

    function readSettingsImeState() {
        var metrics = displayMetrics();
        var thresholdPx = imeVisibilityThresholdPx(metrics);
        var output = {
            visible: false,
            bottomPx: 0,
            topInsetPx: statusBarHeightPx(),
            source: "none",
            supported: false,
            screenHeightPx: Number(metrics.heightPixels),
            visibleBottomPx: Number(metrics.heightPixels)
        };
        var rootInsets;
        var imeMask;
        var systemMask;
        var imeInsets;
        var systemInsets;
        var rootAvailable = false;
        var rootVisible = false;
        var rootBottomPx = 0;
        var immHeight = 0;
        var frame;
        var frameGap = 0;
        var frameAvailable = false;
        var frameVisible = false;
        if (panelRoot === null) { return output; }
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                rootInsets = panelRoot.getRootWindowInsets();
                if (rootInsets !== null) {
                    imeMask = WindowInsets.Type.ime();
                    systemMask = WindowInsets.Type.systemBars();
                    imeInsets = rootInsets.getInsets(imeMask);
                    systemInsets = rootInsets.getInsets(systemMask);
                    rootAvailable = true;
                    rootBottomPx = Math.max(0, Number(imeInsets.bottom));
                    rootVisible = rootInsets.isVisible(imeMask) === true ||
                        rootBottomPx >= thresholdPx;
                    output.topInsetPx = Math.max(output.topInsetPx,
                        Number(systemInsets.top));
                    output.supported = true;
                }
            } catch (ignoredInsets) {}
        }
        try {
            frame = new Rect();
            panelRoot.getWindowVisibleDisplayFrame(frame);
            frameAvailable = true;
            output.topInsetPx = Math.max(output.topInsetPx,
                Number(frame.top));
            frameGap = Math.max(0,
                Number(metrics.heightPixels) - Number(frame.bottom));
            frameVisible = frameGap >= thresholdPx;
        } catch (ignoredFrame) {}
        immHeight = inputMethodVisibleHeightPx();

        if (rootVisible) {
            output.visible = true;
            output.bottomPx = Math.max(rootBottomPx,
                frameVisible ? frameGap : 0,
                immHeight >= thresholdPx ? immHeight : 0);
            output.source = "root_window_insets";
            output.supported = true;
        } else if (frameVisible) {
            output.visible = true;
            output.bottomPx = Math.max(frameGap,
                immHeight >= thresholdPx ? immHeight : 0);
            output.source = "visible_display_frame";
            output.supported = true;
        } else if (!rootAvailable && !frameAvailable &&
                immHeight >= thresholdPx) {
            output.visible = true;
            output.bottomPx = immHeight;
            output.source = "input_method_visible_height";
            output.supported = true;
        } else {
            output.visible = false;
            output.bottomPx = 0;
            if (rootAvailable) {
                output.source = "root_window_insets_hidden";
                output.supported = true;
            } else if (frameAvailable) {
                output.source = "visible_display_frame_hidden";
                output.supported = true;
            }
            if (immHeight >= thresholdPx) {
                uiState.imeStaleSignalIgnoredCount += 1;
            }
        }
        output.visibleBottomPx = Number(metrics.heightPixels) -
            Number(output.bottomPx);
        return output;
    }
'''

read_pattern = re.compile(
    r'    function (?:imeVisibilityThresholdPx\(metrics\) \{.*?\n    \}\n\n    function )?'
    r'readSettingsImeState\(\) \{.*?\n    \}\n(?=\n    function applySettingsImeLayout)',
    re.S)
text, count = read_pattern.subn(new_read.rstrip('\n'), text, count=1)
if count != 1:
    raise SystemExit('unable to replace readSettingsImeState')

new_apply = r'''    function applySettingsImeLayout(ime) {
        var metrics;
        var geometry = null;
        var restore = imeRestoreLayout;
        var normalHeightPx;
        var targetWidthPx;
        var targetHeightPx;
        var targetTopPx;
        var targetGravity;
        var targetX;
        var targetY;
        var keyboardTopPx;
        var topSafePx;
        var availablePx;
        var thresholdPx;
        var changed = false;
        var wasApplied;
        var targetRoot;
        if (panelRoot === null || panelParams === null) { return false; }
        metrics = displayMetrics();
        thresholdPx = imeVisibilityThresholdPx(metrics);
        wasApplied = uiState.keyboardAvoidanceApplied === true;
        if (ime.visible && Number(ime.bottomPx) >= thresholdPx) {
            if (!wasApplied || imeRestoreLayout === null) {
                imeRestoreLayout = {
                    width: Number(panelParams.width),
                    height: Number(panelParams.height),
                    gravity: Number(panelParams.gravity),
                    x: Number(panelParams.x),
                    y: Number(panelParams.y)
                };
                restore = imeRestoreLayout;
                uiState.imeRestoreSnapshotCount += 1;
            }
            normalHeightPx = Math.max(dp(1), Number(restore.height));
            keyboardTopPx = Math.max(0,
                Number(metrics.heightPixels) - Number(ime.bottomPx));
            topSafePx = Math.max(dp(6), Number(ime.topInsetPx));
            availablePx = Math.max(dp(280),
                keyboardTopPx - topSafePx - dp(6));
            targetWidthPx = Number(restore.width);
            targetHeightPx = Math.min(normalHeightPx, availablePx);
            targetTopPx = Math.max(topSafePx,
                keyboardTopPx - dp(6) - targetHeightPx);
            targetGravity = Gravity.TOP | Gravity.START;
            targetX = Number(restore.x);
            targetY = targetTopPx;
            uiState.availableAboveImeDp = pxToDp(availablePx);
            uiState.keyboardAvoidanceApplied = true;
            if (!wasApplied) { uiState.keyboardAvoidanceApplyCount += 1; }
            uiState.panelGravity = "ime_top";
            uiState.panelBottomMarginDp = 6;
        } else {
            restore = imeRestoreLayout;
            if (restore === null && wasApplied && ClipHub.Window &&
                    typeof ClipHub.Window.computeGeometry === "function") {
                try {
                    geometry = ClipHub.Window.computeGeometry("settings", {
                        useSaved: true
                    });
                    restore = {
                        width: Number(geometry.width),
                        height: Number(geometry.height),
                        gravity: Number(Gravity.TOP | Gravity.START),
                        x: Number(geometry.x || 0),
                        y: Number(geometry.y || 0)
                    };
                    uiState.imeRestoreFallbackCount += 1;
                } catch (ignoredGeometry) { restore = null; }
            }
            if (restore === null) {
                restore = {
                    width: Number(panelParams.width),
                    height: Number(panelParams.height),
                    gravity: Number(panelParams.gravity),
                    x: Number(panelParams.x),
                    y: Number(panelParams.y)
                };
            }
            targetWidthPx = Number(restore.width);
            targetHeightPx = Number(restore.height);
            targetGravity = Number(restore.gravity);
            targetX = Number(restore.x);
            targetY = Number(restore.y);
            targetTopPx = targetY;
            uiState.availableAboveImeDp = pxToDp(Number(metrics.heightPixels));
            uiState.keyboardAvoidanceApplied = false;
            if (wasApplied) { uiState.keyboardAvoidanceRestoreCount += 1; }
            uiState.panelGravity = "shared";
            uiState.panelBottomMarginDp = 0;
        }
        if (Number(panelParams.width) !== Number(targetWidthPx)) {
            panelParams.width = targetWidthPx;
            changed = true;
        }
        if (Number(panelParams.height) !== Number(targetHeightPx)) {
            panelParams.height = targetHeightPx;
            changed = true;
        }
        if (Number(panelParams.gravity) !== Number(targetGravity)) {
            panelParams.gravity = targetGravity;
            changed = true;
        }
        if (Number(panelParams.x) !== Number(targetX)) {
            panelParams.x = targetX;
            changed = true;
        }
        if (Number(panelParams.y) !== Number(targetY)) {
            panelParams.y = targetY;
            changed = true;
        }
        uiState.currentPanelHeightDp = pxToDp(targetHeightPx);
        uiState.currentPanelTopDp = pxToDp(targetTopPx);
        targetRoot = panelWindowRoot !== null ? panelWindowRoot : panelRoot;
        if (changed && uiState.attached && targetRoot !== null &&
                targetRoot.isAttachedToWindow()) {
            windowManager.updateViewLayout(targetRoot, panelParams);
            uiState.windowLayoutUpdateCount += 1;
        }
        if (!ime.visible || Number(ime.bottomPx) < thresholdPx) {
            imeRestoreLayout = null;
        }
        return changed;
    }
'''
apply_pattern = re.compile(
    r'    function applySettingsImeLayout\(ime\) \{.*?\n    \}\n'
    r'(?=\n    function resetImeAnchorSpacer)', re.S)
text, count = apply_pattern.subn(new_apply.rstrip('\n'), text, count=1)
if count != 1:
    raise SystemExit('unable to replace applySettingsImeLayout')

if '            imeRestoreLayout = null;\n            uiState.lastError = null;\n' not in text:
    text = text.replace(
        '            uiState.panelBottomMarginDp = 0;\n'
        '            uiState.lastError = null;\n'
        '            buildPage();\n',
        '            uiState.panelBottomMarginDp = 0;\n'
        '            imeRestoreLayout = null;\n'
        '            uiState.lastError = null;\n'
        '            buildPage();\n',
        1)

if '                imeRestoreLayout = null;\n                translationStatusView = null;\n' not in text:
    text = text.replace(
        '                focusedVisibilityScheduled = false;\n'
        '                translationStatusView = null;\n',
        '                focusedVisibilityScheduled = false;\n'
        '                imeRestoreLayout = null;\n'
        '                translationStatusView = null;\n',
        1)

if '            imeRestoreSnapshotCount:\n' not in text:
    text = text.replace(
        '            keyboardAvoidanceRestoreCount:\n'
        '                Number(uiState.keyboardAvoidanceRestoreCount),\n',
        '            keyboardAvoidanceRestoreCount:\n'
        '                Number(uiState.keyboardAvoidanceRestoreCount),\n'
        '            imeRestoreSnapshotCount:\n'
        '                Number(uiState.imeRestoreSnapshotCount),\n'
        '            imeRestoreFallbackCount:\n'
        '                Number(uiState.imeRestoreFallbackCount),\n'
        '            imeStaleSignalIgnoredCount:\n'
        '                Number(uiState.imeStaleSignalIgnoredCount),\n',
        1)

text, count = re.subn(
    r'(MODULE_NAME: "ch_13_settings",\n\s*MODULE_VERSION:)\s*17,',
    r'\1 18,', text, count=1)
if count != 1 and 'MODULE_VERSION: 18,' not in text:
    raise SystemExit('unable to update settings module version')

required = [
    'var imeRestoreLayout = null;',
    'function imeVisibilityThresholdPx(metrics)',
    'root_window_insets_hidden',
    'imeStaleSignalIgnoredCount',
    'imeRestoreSnapshotCount',
    'MODULE_VERSION: 18'
]
for marker in required:
    if marker not in text:
        raise SystemExit('missing patched marker: ' + marker)
if 'ClipHub.Window.refreshWindow(panelWindowRoot' in text:
    raise SystemExit('legacy self-derived restore remains')

TARGET.write_text(text, encoding='utf-8')
manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
manifest['moduleSetVersion'] = '20260724.23'
blob = subprocess.check_output(
    ['git', 'hash-object', str(TARGET)], text=True).strip()
for item in manifest.get('modules', []):
    if item.get('path') == str(TARGET):
        item['sha'] = blob
        break
else:
    raise SystemExit('settings module missing from manifest')
MANIFEST.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8')
