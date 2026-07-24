#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit("%s marker count: %d" % (label, count))
    return text.replace(old, new, 1)


def patch_file(path, replacements):
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    for old, new, label in replacements:
        text = replace_once(text, old, new, label)
    file_path.write_text(text, encoding="utf-8")


patch_file("src/ch_11_filter.js", [
    (
        '        MODULE_VERSION: 33,',
        '        MODULE_VERSION: 34,',
        'filter module version'
    ),
    (
        '        FILTER_IME_AVOIDANCE: "formal_v33",',
        '        FILTER_IME_AVOIDANCE: "formal_v34",',
        'filter ime contract'
    ),
    (
'''            var keyboardTop;
            var topSafe;
            var available;
            var minimumHeight;
            var target;''',
'''            var keyboardTop;
            var topSafe;
            var minimumHeight;
            var minimumTop;
            var bottomLimit;
            var originalTop;
            var availableAtOriginalTop;
            var targetHeight;
            var target;''',
        'filter ime declarations'
    ),
    (
'''            keyboardTop = Math.max(0,
                screenHeight - Number(ime.bottomPx));
            topSafe = Math.max(0, Number(ime.topInsetPx || 0));
            minimumHeight = Math.max(touchSlop * 18,
                Math.round(screenHeight * 0.22));
            available = Math.max(minimumHeight,
                keyboardTop - topSafe - adaptiveGap * 2);
            target = {
                width: Number(stateValue.restore.width),
                height: Math.min(Number(stateValue.restore.height), available),
                gravity: Number(Gravity.TOP | Gravity.START),
                x: Number(stateValue.restore.x),
                y: Math.max(topSafe + adaptiveGap,
                    keyboardTop - adaptiveGap -
                    Math.min(Number(stateValue.restore.height), available))
            };''',
'''            keyboardTop = Math.max(0,
                screenHeight - Number(ime.bottomPx));
            topSafe = Math.max(0, Number(ime.topInsetPx || 0));
            minimumHeight = Math.max(touchSlop * 18,
                Math.round(screenHeight * 0.22));
            minimumTop = topSafe;
            bottomLimit = Math.max(minimumTop + 1,
                keyboardTop - adaptiveGap);
            originalTop = Math.max(minimumTop,
                Number(stateValue.restore.y));
            availableAtOriginalTop = Math.max(1,
                bottomLimit - originalTop);
            targetHeight = Math.min(
                Number(stateValue.restore.height),
                availableAtOriginalTop);
            if (targetHeight < minimumHeight) {
                targetHeight = Math.min(
                    Number(stateValue.restore.height),
                    Math.max(1, bottomLimit - minimumTop));
            }
            target = {
                width: Number(stateValue.restore.width),
                height: targetHeight,
                gravity: Number(Gravity.TOP | Gravity.START),
                x: Number(stateValue.restore.x),
                y: Math.max(minimumTop,
                    Math.min(originalTop,
                        bottomLimit - targetHeight))
            };''',
        'filter ime geometry'
    )
])

patch_file("src/ch_10_editor.js", [
    (
        '        MODULE_VERSION: 16,',
        '        MODULE_VERSION: 17,',
        'editor module version'
    ),
    (
'''        var keyboardTopPx;
        var topSafePx;
        var availablePx;
        var changed = false;''',
'''        var keyboardTopPx;
        var topSafePx;
        var availablePx;
        var minimumHeightPx;
        var minimumTopPx;
        var bottomLimitPx;
        var originalTopPx;
        var availableAtOriginalTopPx;
        var changed = false;''',
        'editor ime declarations'
    ),
    (
'''        keyboardTopPx = Math.max(0,
            Number(metrics.heightPixels) - Number(ime.bottomPx));
        topSafePx = Math.max(dp(6), Number(ime.topInsetPx));
        availablePx = Math.max(dp(280),
            keyboardTopPx - topSafePx - dp(6));
        targetHeightPx = Math.min(normalHeightPx, availablePx);
        targetTopPx = Math.max(topSafePx,
            keyboardTopPx - dp(6) - targetHeightPx);
        targetGravity = Gravity.TOP | Gravity.START;
        targetY = targetTopPx;''',
'''        keyboardTopPx = Math.max(0,
            Number(metrics.heightPixels) - Number(ime.bottomPx));
        topSafePx = Math.max(0, Number(ime.topInsetPx));
        minimumHeightPx = dp(280);
        minimumTopPx = topSafePx;
        bottomLimitPx = Math.max(minimumTopPx + 1,
            keyboardTopPx - dp(6));
        originalTopPx = Math.max(minimumTopPx,
            Number(imeRestoreGeometry.y));
        availableAtOriginalTopPx = Math.max(1,
            bottomLimitPx - originalTopPx);
        targetHeightPx = Math.min(normalHeightPx,
            availableAtOriginalTopPx);
        if (targetHeightPx < minimumHeightPx) {
            targetHeightPx = Math.min(normalHeightPx,
                Math.max(1, bottomLimitPx - minimumTopPx));
        }
        targetTopPx = Math.max(minimumTopPx,
            Math.min(originalTopPx,
                bottomLimitPx - targetHeightPx));
        availablePx = Math.max(1,
            bottomLimitPx - minimumTopPx);
        targetGravity = Gravity.TOP | Gravity.START;
        targetY = targetTopPx;''',
        'editor ime geometry'
    )
])

patch_file("src/ch_13_settings.js", [
    (
        '        MODULE_VERSION: 19,',
        '        MODULE_VERSION: 20,',
        'settings module version'
    ),
    (
'''        var keyboardTopPx;
        var topSafePx;
        var availablePx;
        var thresholdPx;''',
'''        var keyboardTopPx;
        var topSafePx;
        var availablePx;
        var minimumHeightPx;
        var minimumTopPx;
        var bottomLimitPx;
        var originalTopPx;
        var availableAtOriginalTopPx;
        var thresholdPx;''',
        'settings ime declarations'
    ),
    (
'''            normalHeightPx = Math.max(dp(1), Number(restore.height));
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
            targetY = targetTopPx;''',
'''            normalHeightPx = Math.max(dp(1), Number(restore.height));
            keyboardTopPx = Math.max(0,
                Number(metrics.heightPixels) - Number(ime.bottomPx));
            topSafePx = Math.max(0, Number(ime.topInsetPx));
            minimumHeightPx = dp(280);
            minimumTopPx = topSafePx;
            bottomLimitPx = Math.max(minimumTopPx + 1,
                keyboardTopPx - dp(6));
            originalTopPx = Math.max(minimumTopPx,
                Number(restore.y));
            availableAtOriginalTopPx = Math.max(1,
                bottomLimitPx - originalTopPx);
            targetWidthPx = Number(restore.width);
            targetHeightPx = Math.min(normalHeightPx,
                availableAtOriginalTopPx);
            if (targetHeightPx < minimumHeightPx) {
                targetHeightPx = Math.min(normalHeightPx,
                    Math.max(1, bottomLimitPx - minimumTopPx));
            }
            targetTopPx = Math.max(minimumTopPx,
                Math.min(originalTopPx,
                    bottomLimitPx - targetHeightPx));
            availablePx = Math.max(1,
                bottomLimitPx - minimumTopPx);
            targetGravity = Gravity.TOP | Gravity.START;
            targetX = Number(restore.x);
            targetY = targetTopPx;''',
        'settings ime geometry'
    )
])

manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("moduleSetVersion") != "20260724.33":
    raise SystemExit("unexpected module set version")
if len(manifest.get("modules", [])) != 15:
    raise SystemExit("ENTRY_VERSION 5 requires 15 modules")
manifest["moduleSetVersion"] = "20260724.34"
for module in manifest["modules"]:
    module_path = module["path"]
    module["sha"] = subprocess.check_output(
        ["git", "hash-object", module_path], text=True
    ).strip()
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)
