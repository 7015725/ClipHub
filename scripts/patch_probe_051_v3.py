#!/usr/bin/env python3
from pathlib import Path
import hashlib
import json


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError('%s expected once, found %d' % (label, count))
    return text.replace(old, new, 1)


def git_blob_sha(data):
    header = ('blob %d\0' % len(data)).encode('utf-8')
    return hashlib.sha1(header + data).hexdigest()


window_path = Path('src/ch_08_window.js')
window = window_path.read_text(encoding='utf-8')
window = replace_once(
    window,
    '        MODULE_VERSION: 11,',
    '        MODULE_VERSION: 12,',
    'window module version')
old_refresh = '''    function refreshPrimaryBounds(reason) {
        var geometry = computeGeometry("shared", { useSaved: true });
        var source = activeBinding || (managedWindows.length > 0 ?
            managedWindows[managedWindows.length - 1] : null);
        var index;
        if (!source) {
            state.safeBounds = copyBounds(geometry.bounds);
            state.orientation = geometry.orientation;
            state.lastBoundsReason = String(reason || "refresh");
            return false;
        }
        for (index = 0; index < managedWindows.length; index += 1) {
            applyGeometryToBinding(managedWindows[index], geometry,
                String(reason || "bounds_refresh"), false);
        }
        activateBinding(source);
        state.boundsRefreshCount += 1;
        state.lastBoundsReason = String(reason || "refresh");
        return true;
    }
'''
new_refresh = '''    function refreshPrimaryBounds(reason) {
        var geometry = computeGeometry("shared", { useSaved: true });
        var source = activeBinding || (managedWindows.length > 0 ?
            managedWindows[managedWindows.length - 1] : null);
        var index;
        if (!source) {
            state.safeBounds = copyBounds(geometry.bounds);
            state.orientation = geometry.orientation;
            state.lastBoundsReason = String(reason || "refresh");
            state.lastError = null;
            return false;
        }
        for (index = 0; index < managedWindows.length; index += 1) {
            applyGeometryToBinding(managedWindows[index], geometry,
                String(reason || "bounds_refresh"), false);
        }
        activateBinding(source);
        state.boundsRefreshCount += 1;
        state.lastBoundsReason = String(reason || "refresh");
        state.lastError = null;
        return true;
    }

    function refreshPrimaryBoundsSafe(reason) {
        var currentLooper = Looper.myLooper();
        if (currentLooper !== null && currentLooper === Looper.getMainLooper()) {
            return refreshPrimaryBounds(reason);
        }
        return requireMainResult(runOnMainSync(function () {
            return refreshPrimaryBounds(reason);
        }, 3000));
    }
'''
window = replace_once(window, old_refresh, new_refresh,
                      'thread-safe refresh boundary')
window = replace_once(
    window,
    '        refreshPrimaryBounds: refreshPrimaryBounds,',
    '        refreshPrimaryBounds: refreshPrimaryBoundsSafe,',
    'refreshPrimaryBounds export')
window = replace_once(
    window,
    '        refreshBounds: refreshPrimaryBounds,',
    '        refreshBounds: refreshPrimaryBoundsSafe,',
    'refreshBounds export')
window_path.write_text(window, encoding='utf-8')

probe_path = Path('probes/cliphub_shared_window_geometry_probe_051.js')
probe = probe_path.read_text(encoding='utf-8')
probe = replace_once(probe,
    '    var PROBE_VERSION = 2;\n    var SCENE_DURATION_MS = 9000;\n    var EXPECTED_MODULE_SET = "20260724.05";',
    '    var PROBE_VERSION = 3;\n    var SCENE_DURATION_MS = 9000;\n    var HOME_GESTURE_TIMEOUT_MS = 25000;\n    var EXPECTED_MODULE_SET = "20260724.06";',
    'probe constants')
old_scene = '''    function scene(index, title, instruction) {
        toast("场景" + String(index) + "：" + String(title) +
            "\\n" + String(instruction));
    }

'''
new_scene = '''    function scene(index, title, instruction) {
        toast("场景" + String(index) + "：" + String(title) +
            "\\n" + String(instruction));
    }

    function waitForHomeGestures(baseline) {
        var deadline = Number(System.currentTimeMillis()) +
            HOME_GESTURE_TIMEOUT_MS;
        var current = ClipHub.Window.getState();
        var dragSeen = false;
        var resizeSeen = false;
        var persisted = false;
        while (Number(System.currentTimeMillis()) < deadline) {
            dragSeen = Number(current.dragActivateCount || 0) >
                Number(baseline.dragActivateCount || 0);
            resizeSeen = Number(current.resizeActivateCount || 0) >
                Number(baseline.resizeActivateCount || 0);
            persisted = Number(current.geometryPersistCount || 0) >
                Number(baseline.geometryPersistCount || 0);
            if (dragSeen && resizeSeen && persisted) { break; }
            sleep(250);
            current = ClipHub.Window.getState();
        }
        return {
            completed: dragSeen && resizeSeen && persisted,
            timedOut: !(dragSeen && resizeSeen && persisted),
            dragSeen: dragSeen,
            resizeSeen: resizeSeen,
            persisted: persisted,
            waitedMs: HOME_GESTURE_TIMEOUT_MS - Math.max(0,
                deadline - Number(System.currentTimeMillis()))
        };
    }

    function ensureAdvancedVisible() {
        var panel = ClipHub.Filter.getPanelState();
        if (!panel || panel.advancedDrawerVisible !== true) {
            ClipHub.Filter.performAdvancedClick();
            sleep(450);
            panel = ClipHub.Filter.getPanelState();
        }
        return panel && panel.advancedDrawerVisible === true;
    }

'''
probe = replace_once(probe, old_scene, new_scene, 'probe wait helpers')
old_errors = '''            allScenesErrorFree:
                !(s1.window && s1.window.lastError) &&
                !(s2.filter && s2.filter.lastError) &&
                !(s3.editor && s3.editor.lastError) &&
                !(s4.settings && s4.settings.lastError) &&
                !(s5.detail && s5.detail.lastError)
'''
new_errors = '''            homeGestureTimedOut:
                result.homeGestureWait &&
                result.homeGestureWait.timedOut === true,
            allScenesErrorFree:
                !(s1.window && s1.window.lastError) &&
                !(s2.window && s2.window.lastError) &&
                !(s3.window && s3.window.lastError) &&
                !(s4.window && s4.window.lastError) &&
                !(s5.window && s5.window.lastError) &&
                !(s6.window && s6.window.lastError) &&
                !(s2.filter && s2.filter.lastError) &&
                !(s3.editor && s3.editor.lastError) &&
                !(s4.settings && s4.settings.lastError) &&
                !(s5.detail && s5.detail.lastError)
'''
probe = replace_once(probe, old_errors, new_errors,
                     'all-scene error boundary')
old_flow = '''        scene(1, "首页手势",
            "长按顶部手柄拖动，再长按右下角双弧线缩放；完成后截图。");
        sleep(SCENE_DURATION_MS);
        snapshot("homeGesture");

        result.compactGeometry = forceCompactGeometry();
        ClipHub.Filter.performAdvancedClick();
        sleep(500);
        scene(2, "窄窗口高级筛选",
            "窗口约320dp宽；确认筛选、重置和应用筛选均未遮挡并截图。");
        sleep(SCENE_DURATION_MS);
        snapshot("compactAdvanced");
'''
new_flow = '''        scene(1, "首页手势",
            "长按顶部手柄拖动，再长按右下角双弧线缩放；检测完成后自动进入下一场景。");
        result.homeGestureWait = waitForHomeGestures(baseline);
        scene(1, result.homeGestureWait.completed ?
            "手势已识别" : "手势检测超时",
            result.homeGestureWait.completed ?
                "保持当前窗口，3秒后记录场景1。" :
                "未检测到完整拖动和缩放，3秒后仍会继续探测。");
        sleep(3000);
        snapshot("homeGesture");

        result.compactGeometry = forceCompactGeometry();
        result.advancedOpenedInitially = ensureAdvancedVisible();
        scene(2, "窄窗口高级筛选",
            "窗口约320dp宽；确认筛选、重置和应用筛选均未遮挡并截图。");
        sleep(SCENE_DURATION_MS - 900);
        result.advancedVisibleBeforeSnapshot = ensureAdvancedVisible();
        sleep(450);
        snapshot("compactAdvanced");
'''
probe = replace_once(probe, old_flow, new_flow, 'scene timing flow')
old_gate = '''        result.ok = result.checks.moduleSetExpected &&
            result.checks.sourceRefExpected &&
            result.checks.compactWidthApplied &&
'''
new_gate = '''        result.ok = result.checks.moduleSetExpected &&
            result.checks.sourceRefExpected &&
            result.checks.manualDragObserved &&
            result.checks.manualResizeObserved &&
            result.checks.geometryPersisted &&
            !result.checks.homeGestureTimedOut &&
            result.checks.compactWidthApplied &&
'''
probe = replace_once(probe, old_gate, new_gate, 'result gate')
probe_path.write_text(probe, encoding='utf-8')

manifest_path = Path('module-manifest.json')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
if manifest.get('moduleSetVersion') != '20260724.05':
    raise RuntimeError('Unexpected moduleSetVersion: %r' %
                       manifest.get('moduleSetVersion'))
manifest['moduleSetVersion'] = '20260724.06'
window_sha = git_blob_sha(window_path.read_bytes())
updated = False
for module in manifest.get('modules', []):
    if module.get('name') == 'ch_08_window.js':
        module['sha'] = window_sha
        updated = True
        break
if not updated:
    raise RuntimeError('ch_08_window.js manifest entry missing')
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False,
                                    indent=2) + '\n', encoding='utf-8')
