#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WINDOW = ROOT / "src/ch_08_window.js"
PROBE = ROOT / "probes/cliphub_shared_window_geometry_probe_051.js"
MANIFEST = ROOT / "module-manifest.json"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("{} expected once, found {}".format(label, count))
    return text.replace(old, new, 1)


window = WINDOW.read_text(encoding="utf-8")
window = replace_once(window,
'''        startY: 0,
        pending: false,''',
'''        startY: 0,
        downAt: 0,
        pending: false,''',
"drag downAt")
window = replace_once(window,
'''        startHeight: 0,
        pending: false,''',
'''        startHeight: 0,
        downAt: 0,
        pending: false,''',
"resize downAt")

window = replace_once(window,
'''    function scheduleDragActivation(view, binding) {
        cancelDragActivation();
        drag.binding = binding;
        drag.pending = true;
        state.dragPending = true;
        drag.longPressRunnable = new Packages.java.lang.Runnable({
            run: function () {
                if (!binding || !binding.attached || !drag.pending ||
                        binding.pinned || bindingImeVisible(binding)) {
                    cancelDragActivation();
                    return;
                }
                activateBinding(binding);
                drag.pending = false;
                drag.active = true;
                state.dragPending = false;
                state.dragActive = true;
                state.dragActivateCount += 1;
                performHaptic(view, "drag_activate");
            }
        });
        mainHandler.postDelayed(drag.longPressRunnable, longPressTimeoutMs);
    }
''',
'''    function pendingActivationSlopPx() {
        return Math.max(dp(12), Math.floor(touchSlopPx * 2));
    }

    function activateDragGesture(view, binding) {
        if (!binding || !binding.attached || !drag.pending ||
                binding.pinned || bindingImeVisible(binding)) {
            cancelDragActivation();
            return false;
        }
        if (mainHandler !== null && drag.longPressRunnable !== null) {
            try { mainHandler.removeCallbacks(drag.longPressRunnable); }
            catch (ignoredRemove) {}
        }
        drag.longPressRunnable = null;
        activateBinding(binding);
        drag.pending = false;
        drag.active = true;
        state.dragPending = false;
        state.dragActive = true;
        state.dragActivateCount += 1;
        performHaptic(view, "drag_activate");
        return true;
    }

    function scheduleDragActivation(view, binding) {
        cancelDragActivation();
        drag.binding = binding;
        drag.pending = true;
        state.dragPending = true;
        drag.longPressRunnable = new Packages.java.lang.Runnable({
            run: function () {
                activateDragGesture(view, binding);
            }
        });
        mainHandler.postDelayed(drag.longPressRunnable, longPressTimeoutMs);
    }
''',
"drag activation helper")

window = replace_once(window,
'''        var deltaX;
        var deltaY;
        var completed;''',
'''        var deltaX;
        var deltaY;
        var distanceSquared;
        var pendingLimit;
        var elapsed;
        var completed;''',
"drag locals")
window = replace_once(window,
'''            drag.startX = Number(binding.layoutParams.x);
            drag.startY = Number(binding.layoutParams.y);
            drag.active = false;''',
'''            drag.startX = Number(binding.layoutParams.x);
            drag.startY = Number(binding.layoutParams.y);
            drag.downAt = Number(event.getEventTime());
            drag.active = false;''',
"drag down time")
window = replace_once(window,
'''            deltaX = rawX - drag.downRawX;
            deltaY = rawY - drag.downRawY;
            if (drag.pending && Math.abs(deltaX) + Math.abs(deltaY) >
                    touchSlopPx) {
                cancelDragActivation();
                return true;
            }
            if (drag.active && drag.binding === binding) {''',
'''            deltaX = rawX - drag.downRawX;
            deltaY = rawY - drag.downRawY;
            elapsed = Number(event.getEventTime()) - Number(drag.downAt || 0);
            pendingLimit = pendingActivationSlopPx();
            distanceSquared = deltaX * deltaX + deltaY * deltaY;
            if (drag.pending && elapsed >= longPressTimeoutMs) {
                activateDragGesture(view, binding);
            }
            if (drag.pending && distanceSquared >
                    pendingLimit * pendingLimit) {
                cancelDragActivation();
                return true;
            }
            if (drag.active && drag.binding === binding) {''',
"drag move tolerance")

window = replace_once(window,
'''    function scheduleResizeActivation(view, binding) {
        cancelResizeActivation();
        resize.binding = binding;
        resize.pending = true;
        state.resizePending = true;
        resize.longPressRunnable = new Packages.java.lang.Runnable({
            run: function () {
                if (!binding || !binding.attached || !resize.pending ||
                        binding.pinned || bindingImeVisible(binding)) {
                    cancelResizeActivation();
                    return;
                }
                activateBinding(binding);
                resize.pending = false;
                resize.active = true;
                state.resizePending = false;
                state.resizeActive = true;
                state.resizeActivateCount += 1;
                setResizeVisual(binding, true);
                performHaptic(view, "resize_activate");
            }
        });
        mainHandler.postDelayed(resize.longPressRunnable,
            longPressTimeoutMs);
    }
''',
'''    function activateResizeGesture(view, binding) {
        if (!binding || !binding.attached || !resize.pending ||
                binding.pinned || bindingImeVisible(binding)) {
            cancelResizeActivation();
            return false;
        }
        if (mainHandler !== null && resize.longPressRunnable !== null) {
            try { mainHandler.removeCallbacks(resize.longPressRunnable); }
            catch (ignoredRemove) {}
        }
        resize.longPressRunnable = null;
        activateBinding(binding);
        resize.pending = false;
        resize.active = true;
        state.resizePending = false;
        state.resizeActive = true;
        state.resizeActivateCount += 1;
        setResizeVisual(binding, true);
        performHaptic(view, "resize_activate");
        return true;
    }

    function scheduleResizeActivation(view, binding) {
        cancelResizeActivation();
        resize.binding = binding;
        resize.pending = true;
        state.resizePending = true;
        resize.longPressRunnable = new Packages.java.lang.Runnable({
            run: function () {
                activateResizeGesture(view, binding);
            }
        });
        mainHandler.postDelayed(resize.longPressRunnable,
            longPressTimeoutMs);
    }
''',
"resize activation helper")
window = replace_once(window,
'''        var width;
        var height;
        var completed;''',
'''        var width;
        var height;
        var distanceSquared;
        var pendingLimit;
        var elapsed;
        var completed;''',
"resize locals")
window = replace_once(window,
'''            resize.startWidth = Number(binding.layoutParams.width);
            resize.startHeight = Number(binding.layoutParams.height);
            resize.active = false;''',
'''            resize.startWidth = Number(binding.layoutParams.width);
            resize.startHeight = Number(binding.layoutParams.height);
            resize.downAt = Number(event.getEventTime());
            resize.active = false;''',
"resize down time")
window = replace_once(window,
'''            deltaX = rawX - resize.downRawX;
            deltaY = rawY - resize.downRawY;
            if (resize.pending && Math.abs(deltaX) + Math.abs(deltaY) >
                    touchSlopPx) {
                cancelResizeActivation();
                return true;
            }
            if (resize.active && resize.binding === binding) {''',
'''            deltaX = rawX - resize.downRawX;
            deltaY = rawY - resize.downRawY;
            elapsed = Number(event.getEventTime()) - Number(resize.downAt || 0);
            pendingLimit = pendingActivationSlopPx();
            distanceSquared = deltaX * deltaX + deltaY * deltaY;
            if (resize.pending && elapsed >= longPressTimeoutMs) {
                activateResizeGesture(view, binding);
            }
            if (resize.pending && distanceSquared >
                    pendingLimit * pendingLimit) {
                cancelResizeActivation();
                return true;
            }
            if (resize.active && resize.binding === binding) {''',
"resize move tolerance")
window = replace_once(window,
'''        MODULE_VERSION: 12,''',
'''        MODULE_VERSION: 13,''',
"window module version")
WINDOW.write_text(window, encoding="utf-8")

probe = PROBE.read_text(encoding="utf-8")
probe = replace_once(probe,
'''    var PROBE_VERSION = 3;
    var SCENE_DURATION_MS = 9000;
    var HOME_GESTURE_TIMEOUT_MS = 25000;
    var EXPECTED_MODULE_SET = "20260724.06";''',
'''    var PROBE_VERSION = 4;
    var SCENE_DURATION_MS = 9000;
    var HOME_GESTURE_TIMEOUT_MS = 35000;
    var EXPECTED_MODULE_SET = "20260724.07";''',
"probe version constants")

probe = replace_once(probe,
'''    function waitForHomeGestures(baseline) {
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
''',
'''    function waitForHomeGestures(baseline) {
        var deadline = Number(System.currentTimeMillis()) +
            HOME_GESTURE_TIMEOUT_MS;
        var current = ClipHub.Window.getState();
        var dragSeen = false;
        var resizeSeen = false;
        var persisted = false;
        var announcedDrag = false;
        var announcedResize = false;
        while (Number(System.currentTimeMillis()) < deadline) {
            dragSeen = Number(current.dragActivateCount || 0) >
                Number(baseline.dragActivateCount || 0);
            resizeSeen = Number(current.resizeActivateCount || 0) >
                Number(baseline.resizeActivateCount || 0);
            persisted = Number(current.geometryPersistCount || 0) >
                Number(baseline.geometryPersistCount || 0);
            if (dragSeen && !announcedDrag) {
                announcedDrag = true;
                scene(1, "顶部拖动已识别",
                    resizeSeen ? "等待几何保存。" :
                        "继续按住右下角双弧线，震动后再拖动。" );
            }
            if (resizeSeen && !announcedResize) {
                announcedResize = true;
                scene(1, "右下角缩放已识别",
                    dragSeen ? "等待几何保存。" :
                        "继续按住顶部手柄，震动后再拖动。" );
            }
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
''',
"probe live gesture status")

probe = replace_once(probe,
'''        scene(1, "首页手势",
            "长按顶部手柄拖动，再长按右下角双弧线缩放；检测完成后自动进入下一场景。");''',
'''        scene(1, "首页手势",
            "先按住顶部手柄不动，震动后再拖动；松手后，再按住右下角双弧线，震动后缩放。" );''',
"scene1 instruction")

probe = replace_once(probe,
'''        result.compactGeometry = forceCompactGeometry();
        result.advancedOpenedInitially = ensureAdvancedVisible();
        scene(2, "窄窗口高级筛选",
            "窗口约320dp宽；确认筛选、重置和应用筛选均未遮挡并截图。");''',
'''        ClipHub.Filter.closePanel({
            restoreList: false,
            reason: "probe_compact_reopen"
        });
        sleep(350);
        result.compactGeometry = forceCompactGeometry();
        ClipHub.Filter.showRoot({
            requestKeyboard: false,
            showAdvanced: true
        });
        sleep(700);
        result.advancedOpenedInitially = ensureAdvancedVisible();
        scene(2, "窄窗口高级筛选",
            "窗口约320dp宽；确认筛选、重置和应用筛选均未遮挡并截图。");''',
"compact reopen sequence")

probe = replace_once(probe,
'''            compactWidthApplied:
                Number(s2.filter && s2.filter.panelWidthDp || 0) <= 340,
            compactAdvancedVisible:''',
'''            compactWidthApplied:
                Number(s2.filter && s2.filter.panelWidthDp || 0) <= 340,
            compactPanelAttached:
                s2.window && s2.window.attached === true &&
                s2.filter && s2.filter.attached === true,
            compactAdvancedVisible:''',
"compact attachment check")
probe = replace_once(probe,
'''            result.checks.compactWidthApplied &&
            result.checks.compactAdvancedVisible &&''',
'''            result.checks.compactWidthApplied &&
            result.checks.compactPanelAttached &&
            result.checks.compactAdvancedVisible &&''',
"compact attachment gate")
PROBE.write_text(probe, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260724.07"
for item in manifest["modules"]:
    path = ROOT / item["path"]
    data = path.read_bytes()
    item["sha"] = hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
