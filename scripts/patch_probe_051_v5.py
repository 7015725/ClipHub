#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROBE = ROOT / "probes/cliphub_shared_window_geometry_probe_051.js"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("{} expected once, found {}".format(label, count))
    return text.replace(old, new, 1)


text = PROBE.read_text(encoding="utf-8")
text = replace_once(text,
'''    var PROBE_VERSION = 4;
    var SCENE_DURATION_MS = 9000;
    var HOME_GESTURE_TIMEOUT_MS = 35000;''',
'''    var PROBE_VERSION = 5;
    var SCENE_DURATION_MS = 9000;
    var HOME_GESTURE_TIMEOUT_MS = 35000;
    var GESTURE_SAMPLE_MS = 120;''',
"probe version")

old_wait = '''    function waitForHomeGestures(baseline) {
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
'''

new_wait = '''    function copyPlain(value) {
        try { return JSON.parse(JSON.stringify(value)); }
        catch (ignoredCopy) { return value; }
    }

    function geometrySample(windowState) {
        var geometry = windowState && windowState.geometry ?
            windowState.geometry : null;
        if (!geometry) { return null; }
        return {
            x: Number(geometry.x || 0),
            y: Number(geometry.y || 0),
            width: Number(geometry.width || 0),
            height: Number(geometry.height || 0),
            widthDp: Number(geometry.widthDp || 0),
            heightDp: Number(geometry.heightDp || 0)
        };
    }

    function positionDistance(left, right) {
        var dx;
        var dy;
        if (!left || !right) { return 0; }
        dx = Number(right.x) - Number(left.x);
        dy = Number(right.y) - Number(left.y);
        return Math.sqrt(dx * dx + dy * dy);
    }

    function sizeDistance(left, right) {
        var dw;
        var dh;
        if (!left || !right) { return 0; }
        dw = Number(right.width) - Number(left.width);
        dh = Number(right.height) - Number(left.height);
        return Math.sqrt(dw * dw + dh * dh);
    }

    function waitForHomeGestures(baseline) {
        var deadline = Number(System.currentTimeMillis()) +
            HOME_GESTURE_TIMEOUT_MS;
        var environment = ClipHub.Window.getEnvironment();
        var thresholdPx = Math.max(8,
            Math.round(Number(environment.density || 1) * 6));
        var current = ClipHub.Window.getState();
        var baselineGeometry = geometrySample(baseline);
        var previousAttachedGeometry = baseline && baseline.attached === true ?
            baselineGeometry : null;
        var previousPersistedGeometry = baselineGeometry;
        var baselinePersistCount = Number(
            baseline.geometryPersistCount || 0);
        var previousPersistCount = baselinePersistCount;
        var currentPersistCount = baselinePersistCount;
        var dragCounterSeen = false;
        var resizeCounterSeen = false;
        var dragGeometrySeen = false;
        var resizeGeometrySeen = false;
        var dragSeen = false;
        var resizeSeen = false;
        var persisted = false;
        var announcedDrag = false;
        var announcedResize = false;
        var currentGeometry;
        var positionStep;
        var sizeStep;
        var persistedPositionStep;
        var persistedSizeStep;
        var maxPositionStepPx = 0;
        var maxSizeStepPx = 0;
        var lastAttachedWindow = baseline && baseline.attached === true ?
            copyPlain(baseline) : null;
        var persistedSamples = [];
        while (Number(System.currentTimeMillis()) < deadline) {
            currentGeometry = geometrySample(current);
            if (current && current.attached === true) {
                lastAttachedWindow = copyPlain(current);
                if (previousAttachedGeometry && currentGeometry) {
                    positionStep = positionDistance(previousAttachedGeometry,
                        currentGeometry);
                    sizeStep = sizeDistance(previousAttachedGeometry,
                        currentGeometry);
                    maxPositionStepPx = Math.max(maxPositionStepPx,
                        positionStep);
                    maxSizeStepPx = Math.max(maxSizeStepPx, sizeStep);
                    if (positionStep >= thresholdPx &&
                            sizeStep < thresholdPx) {
                        dragGeometrySeen = true;
                    }
                    if (sizeStep >= thresholdPx) {
                        resizeGeometrySeen = true;
                    }
                }
                previousAttachedGeometry = currentGeometry;
            }

            dragCounterSeen = Number(current.dragActivateCount || 0) >
                Number(baseline.dragActivateCount || 0);
            resizeCounterSeen = Number(current.resizeActivateCount || 0) >
                Number(baseline.resizeActivateCount || 0);
            currentPersistCount = Number(
                current.geometryPersistCount || 0);
            persisted = currentPersistCount > baselinePersistCount;

            if (currentPersistCount > previousPersistCount &&
                    currentGeometry) {
                persistedPositionStep = positionDistance(
                    previousPersistedGeometry, currentGeometry);
                persistedSizeStep = sizeDistance(
                    previousPersistedGeometry, currentGeometry);
                persistedSamples.push({
                    count: currentPersistCount,
                    at: Number(System.currentTimeMillis()),
                    positionDeltaPx: persistedPositionStep,
                    sizeDeltaPx: persistedSizeStep,
                    geometry: copyPlain(currentGeometry)
                });
                if (persistedPositionStep >= thresholdPx &&
                        persistedSizeStep < thresholdPx) {
                    dragGeometrySeen = true;
                }
                if (persistedSizeStep >= thresholdPx) {
                    resizeGeometrySeen = true;
                }
                previousPersistedGeometry = currentGeometry;
                previousPersistCount = currentPersistCount;
            }

            dragSeen = dragCounterSeen || dragGeometrySeen;
            resizeSeen = resizeCounterSeen || resizeGeometrySeen;
            if (dragSeen && !announcedDrag) {
                announcedDrag = true;
                scene(1, "顶部拖动已识别",
                    dragCounterSeen ? "已收到拖动事件计数。" :
                        "已根据窗口位置变化识别拖动。" );
            }
            if (resizeSeen && !announcedResize) {
                announcedResize = true;
                scene(1, "右下角缩放已识别",
                    resizeCounterSeen ? "已收到缩放事件计数。" :
                        "已根据窗口尺寸变化识别缩放。" );
            }
            if (dragSeen && resizeSeen && persisted) { break; }
            sleep(GESTURE_SAMPLE_MS);
            current = ClipHub.Window.getState();
        }
        return {
            completed: dragSeen && resizeSeen && persisted,
            timedOut: !(dragSeen && resizeSeen && persisted),
            dragSeen: dragSeen,
            resizeSeen: resizeSeen,
            persisted: persisted,
            dragCounterSeen: dragCounterSeen,
            resizeCounterSeen: resizeCounterSeen,
            dragGeometrySeen: dragGeometrySeen,
            resizeGeometrySeen: resizeGeometrySeen,
            maxPositionStepPx: maxPositionStepPx,
            maxSizeStepPx: maxSizeStepPx,
            thresholdPx: thresholdPx,
            persistedSamples: persistedSamples,
            lastAttachedWindow: lastAttachedWindow,
            waitedMs: HOME_GESTURE_TIMEOUT_MS - Math.max(0,
                deadline - Number(System.currentTimeMillis()))
        };
    }
'''
text = replace_once(text, old_wait, new_wait, "gesture wait")

text = replace_once(text,
'''        var g3 = s3.window && s3.window.geometry ? s3.window.geometry : {};
        var g4 = s4.window && s4.window.geometry ? s4.window.geometry : {};''',
'''        var gestureEvidence = result.homeGestureWait || {};
        var homeWindow = gestureEvidence.lastAttachedWindow || s1.window || {};
        var g3 = s3.window && s3.window.geometry ? s3.window.geometry : {};
        var g4 = s4.window && s4.window.geometry ? s4.window.geometry : {};''',
"build checks gesture evidence")

text = replace_once(text,
'''            manualDragObserved:
                Number(s1.window && s1.window.dragActivateCount || 0) >
                    Number(baseline.dragActivateCount || 0),
            manualResizeObserved:
                Number(s1.window && s1.window.resizeActivateCount || 0) >
                    Number(baseline.resizeActivateCount || 0),
            geometryPersisted:
                Number(s1.window && s1.window.geometryPersistCount || 0) >
                    Number(baseline.geometryPersistCount || 0),''',
'''            manualDragObserved:
                gestureEvidence.dragSeen === true,
            manualResizeObserved:
                gestureEvidence.resizeSeen === true,
            geometryPersisted:
                gestureEvidence.persisted === true,
            manualDragCounterObserved:
                gestureEvidence.dragCounterSeen === true,
            manualDragGeometryObserved:
                gestureEvidence.dragGeometrySeen === true,
            manualResizeCounterObserved:
                gestureEvidence.resizeCounterSeen === true,
            manualResizeGeometryObserved:
                gestureEvidence.resizeGeometrySeen === true,''',
"gesture checks")

text = replace_once(text,
'''            allScenesErrorFree:
                !(s1.window && s1.window.lastError) &&''',
'''            allScenesErrorFree:
                !(homeWindow && homeWindow.lastError) &&''',
"home error source")

text = replace_once(text,
'''        sleep(3000);
        snapshot("homeGesture");

        ClipHub.Filter.closePanel({''',
'''        sleep(3000);
        snapshot("homeGesture");
        result.scenes.homeGesture.observedWindow =
            result.homeGestureWait.lastAttachedWindow;

        ClipHub.Filter.closePanel({''',
"store observed window")

PROBE.write_text(text, encoding="utf-8")
