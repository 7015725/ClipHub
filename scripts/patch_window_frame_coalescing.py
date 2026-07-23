#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WINDOW = ROOT / "src/ch_08_window.js"
MANIFEST = ROOT / "module-manifest.json"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("{} expected once, found {}".format(label, count))
    return text.replace(old, new, 1)


text = WINDOW.read_text(encoding="utf-8")

text = replace_once(text,
'''    var managedWindows = [];
    var nextManagedId = 1;
    var activeBinding = null;

    var drag = {''',
'''    var managedWindows = [];
    var nextManagedId = 1;
    var activeBinding = null;
    var frameUpdate = {
        scheduled: false,
        sourceBinding: null,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        reason: "",
        bounds: null,
        runnable: null
    };

    var drag = {''',
"frame update state")

text = replace_once(text,
'''        downAt: 0,
        pending: false,
        active: false,
        longPressRunnable: null
    };''',
'''        downAt: 0,
        bounds: null,
        pending: false,
        active: false,
        longPressRunnable: null
    };''',
"drag bounds cache")

text = replace_once(text,
'''        downAt: 0,
        pending: false,
        active: false,
        longPressRunnable: null
    };

    var state = {''',
'''        downAt: 0,
        bounds: null,
        pending: false,
        active: false,
        longPressRunnable: null
    };

    var state = {''',
"resize bounds cache")

text = replace_once(text,
'''        geometryBroadcastCount: 0,
        boundsRefreshCount: 0,''',
'''        geometryBroadcastCount: 0,
        frameCoalescingEnabled: true,
        frameUpdateScheduled: false,
        frameUpdateRequestCount: 0,
        frameUpdateApplyCount: 0,
        frameUpdateCoalescedCount: 0,
        frameUpdateSkippedCount: 0,
        lastFrameUpdateReason: "",
        boundsRefreshCount: 0,''',
"performance state fields")

text = replace_once(text,
'''    function applyGeometryToBinding(binding, geometry, reason, force) {
        if (!binding || !binding.rootView || !binding.layoutParams ||
                !binding.manager) {
            return false;
        }
        if (!force && binding !== activeBinding && bindingImeVisible(binding)) {
            binding.pendingSharedGeometry = copyGeometry(geometry);
            return false;
        }
        binding.layoutParams.gravity = Gravity.TOP | Gravity.START;
        binding.layoutParams.width = Math.floor(Number(geometry.width));
        binding.layoutParams.height = Math.floor(Number(geometry.height));
        binding.layoutParams.x = Math.floor(Number(geometry.x));
        binding.layoutParams.y = Math.floor(Number(geometry.y));
        try {
            if (binding.rootView.isAttachedToWindow()) {
                binding.manager.updateViewLayout(binding.rootView,
                    binding.layoutParams);
            }
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
        binding.pendingSharedGeometry = null;
        notifyBinding(binding, geometry, reason);
        return true;
    }

    function updateSharedLayout(sourceBinding, x, y, width, height, reason) {''',
'''    function applyGeometryToBinding(binding, geometry, reason, force) {
        var targetWidth;
        var targetHeight;
        var targetX;
        var targetY;
        var changed;
        if (!binding || !binding.rootView || !binding.layoutParams ||
                !binding.manager) {
            return false;
        }
        if (!force && binding !== activeBinding && bindingImeVisible(binding)) {
            binding.pendingSharedGeometry = copyGeometry(geometry);
            return false;
        }
        targetWidth = Math.floor(Number(geometry.width));
        targetHeight = Math.floor(Number(geometry.height));
        targetX = Math.floor(Number(geometry.x));
        targetY = Math.floor(Number(geometry.y));
        changed = Number(binding.layoutParams.width) !== targetWidth ||
            Number(binding.layoutParams.height) !== targetHeight ||
            Number(binding.layoutParams.x) !== targetX ||
            Number(binding.layoutParams.y) !== targetY ||
            Number(binding.layoutParams.gravity) !==
                Number(Gravity.TOP | Gravity.START);
        if (!changed) {
            binding.pendingSharedGeometry = null;
            binding.geometry = copyGeometry(geometry);
            state.frameUpdateSkippedCount += 1;
            return false;
        }
        binding.layoutParams.gravity = Gravity.TOP | Gravity.START;
        binding.layoutParams.width = targetWidth;
        binding.layoutParams.height = targetHeight;
        binding.layoutParams.x = targetX;
        binding.layoutParams.y = targetY;
        try {
            if (binding.rootView.isAttachedToWindow()) {
                binding.manager.updateViewLayout(binding.rootView,
                    binding.layoutParams);
            }
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
        binding.pendingSharedGeometry = null;
        notifyBinding(binding, geometry, reason);
        return true;
    }

    function validBounds(value) {
        return value && Number(value.right) > Number(value.left) &&
            Number(value.bottom) > Number(value.top);
    }

    function gestureBoundsSnapshot() {
        if (validBounds(state.safeBounds)) {
            return copyBounds(state.safeBounds);
        }
        return safeBounds();
    }

    function updateSharedLayout(sourceBinding, x, y, width, height, reason,
            boundsOverride) {''',
"skip unchanged and bounds helpers")

text = replace_once(text,
'''        if (!sourceBinding || !sourceBinding.layoutParams) { return false; }
        activateBinding(sourceBinding);
        bounds = safeBounds();''',
'''        if (!sourceBinding || !sourceBinding.layoutParams) { return false; }
        activateBinding(sourceBinding);
        bounds = validBounds(boundsOverride) ?
            copyBounds(boundsOverride) : safeBounds();''',
"use cached gesture bounds")

text = replace_once(text,
'''        state.geometryBroadcastCount += applied;
        return applied > 0;
    }

    function currentSharedGeometry() {''',
'''        state.geometryBroadcastCount += applied;
        return applied > 0;
    }

    function clearFrameUpdate() {
        frameUpdate.scheduled = false;
        frameUpdate.sourceBinding = null;
        frameUpdate.reason = "";
        frameUpdate.bounds = null;
        state.frameUpdateScheduled = false;
    }

    function flushFrameUpdate() {
        var source;
        var x;
        var y;
        var width;
        var height;
        var reason;
        var bounds;
        var applied;
        if (!frameUpdate.scheduled) { return false; }
        source = frameUpdate.sourceBinding;
        x = frameUpdate.x;
        y = frameUpdate.y;
        width = frameUpdate.width;
        height = frameUpdate.height;
        reason = frameUpdate.reason;
        bounds = frameUpdate.bounds;
        clearFrameUpdate();
        if (!source || !source.attached || !source.layoutParams) {
            return false;
        }
        applied = updateSharedLayout(source, x, y, width, height, reason,
            bounds);
        state.frameUpdateApplyCount += 1;
        state.lastFrameUpdateReason = String(reason || "frame_update");
        return applied;
    }

    function requestFrameUpdate(sourceBinding, x, y, width, height, reason,
            bounds) {
        var posted = false;
        if (!sourceBinding || !sourceBinding.attached) { return false; }
        state.frameUpdateRequestCount += 1;
        if (frameUpdate.scheduled) {
            state.frameUpdateCoalescedCount += 1;
        }
        frameUpdate.sourceBinding = sourceBinding;
        frameUpdate.x = Number(x);
        frameUpdate.y = Number(y);
        frameUpdate.width = Number(width);
        frameUpdate.height = Number(height);
        frameUpdate.reason = String(reason || "frame_update");
        frameUpdate.bounds = validBounds(bounds) ? copyBounds(bounds) : null;
        if (frameUpdate.scheduled) { return true; }
        frameUpdate.scheduled = true;
        state.frameUpdateScheduled = true;
        if (frameUpdate.runnable === null) {
            frameUpdate.runnable = new Packages.java.lang.Runnable({
                run: function () {
                    try { flushFrameUpdate(); }
                    catch (error) { state.lastError = String(error); }
                }
            });
        }
        try {
            if (Build.VERSION.SDK_INT >= 16 && sourceBinding.rootView) {
                sourceBinding.rootView.postOnAnimation(frameUpdate.runnable);
                posted = true;
            }
        } catch (ignoredPostOnAnimation) {}
        if (!posted && mainHandler !== null) {
            try { posted = mainHandler.post(frameUpdate.runnable); }
            catch (ignoredHandlerPost) { posted = false; }
        }
        if (!posted) {
            return flushFrameUpdate();
        }
        return true;
    }

    function cancelFrameUpdateForBinding(binding) {
        if (!binding || frameUpdate.sourceBinding !== binding) { return false; }
        clearFrameUpdate();
        return true;
    }

    function currentSharedGeometry() {''',
"frame coalescing functions")

text = replace_once(text,
'''            drag.startX = Number(binding.layoutParams.x);
            drag.startY = Number(binding.layoutParams.y);
            drag.downAt = Number(event.getEventTime());''',
'''            drag.startX = Number(binding.layoutParams.x);
            drag.startY = Number(binding.layoutParams.y);
            drag.downAt = Number(event.getEventTime());
            drag.bounds = gestureBoundsSnapshot();''',
"drag cache bounds")

text = replace_once(text,
'''                updateSharedLayout(binding, drag.startX + deltaX,
                    drag.startY + deltaY,
                    Number(binding.layoutParams.width),
                    Number(binding.layoutParams.height), "drag_shared");
                state.dragMoveCount += 1;''',
'''                requestFrameUpdate(binding, drag.startX + deltaX,
                    drag.startY + deltaY,
                    Number(binding.layoutParams.width),
                    Number(binding.layoutParams.height), "drag_shared",
                    drag.bounds);
                state.dragMoveCount += 1;''',
"drag frame update")

text = replace_once(text,
'''            completed = drag.active && drag.binding === binding;
            cancelDragActivation();
            drag.active = false;
            drag.binding = null;
            state.dragActive = false;
            if (completed && action === MotionEvent.ACTION_UP) {
                persistSharedGeometry(binding);
            }''',
'''            completed = drag.active && drag.binding === binding;
            if (completed) { flushFrameUpdate(); }
            cancelDragActivation();
            drag.active = false;
            drag.binding = null;
            drag.bounds = null;
            state.dragActive = false;
            if (completed && action === MotionEvent.ACTION_UP) {
                persistSharedGeometry(binding);
            }''',
"drag final flush")

text = replace_once(text,
'''            resize.startWidth = Number(binding.layoutParams.width);
            resize.startHeight = Number(binding.layoutParams.height);
            resize.downAt = Number(event.getEventTime());''',
'''            resize.startWidth = Number(binding.layoutParams.width);
            resize.startHeight = Number(binding.layoutParams.height);
            resize.downAt = Number(event.getEventTime());
            resize.bounds = gestureBoundsSnapshot();''',
"resize cache bounds")

text = replace_once(text,
'''                updateSharedLayout(binding, Number(binding.layoutParams.x),
                    Number(binding.layoutParams.y), width, height,
                    "resize_bottom_right_shared");
                state.resizeMoveCount += 1;''',
'''                requestFrameUpdate(binding, Number(binding.layoutParams.x),
                    Number(binding.layoutParams.y), width, height,
                    "resize_bottom_right_shared", resize.bounds);
                state.resizeMoveCount += 1;''',
"resize frame update")

text = replace_once(text,
'''            completed = resize.active && resize.binding === binding;
            cancelResizeActivation();
            resize.active = false;
            resize.binding = null;
            state.resizeActive = false;
            setResizeVisual(binding, false);
            if (completed && action === MotionEvent.ACTION_UP) {
                persistSharedGeometry(binding);
            }''',
'''            completed = resize.active && resize.binding === binding;
            if (completed) { flushFrameUpdate(); }
            cancelResizeActivation();
            resize.active = false;
            resize.binding = null;
            resize.bounds = null;
            state.resizeActive = false;
            setResizeVisual(binding, false);
            if (completed && action === MotionEvent.ACTION_UP) {
                persistSharedGeometry(binding);
            }''',
"resize final flush")

text = replace_once(text,
'''                removed = managedWindows[index];
                removed.attached = false;
                removeImeObserver(removed);''',
'''                removed = managedWindows[index];
                removed.attached = false;
                cancelFrameUpdateForBinding(removed);
                removeImeObserver(removed);''',
"detach cancels pending frame")

text = replace_once(text,
'''            geometryBroadcastCount: Number(state.geometryBroadcastCount),
            boundsRefreshCount: Number(state.boundsRefreshCount),''',
'''            geometryBroadcastCount: Number(state.geometryBroadcastCount),
            frameCoalescingEnabled: state.frameCoalescingEnabled === true,
            frameUpdateScheduled: state.frameUpdateScheduled === true,
            frameUpdateRequestCount: Number(state.frameUpdateRequestCount),
            frameUpdateApplyCount: Number(state.frameUpdateApplyCount),
            frameUpdateCoalescedCount:
                Number(state.frameUpdateCoalescedCount),
            frameUpdateSkippedCount: Number(state.frameUpdateSkippedCount),
            lastFrameUpdateReason: state.lastFrameUpdateReason,
            boundsRefreshCount: Number(state.boundsRefreshCount),''',
"expose performance state")

text = replace_once(text,
'''        MODULE_VERSION: 13,''',
'''        MODULE_VERSION: 14,''',
"module version")

text = replace_once(text,
'''            managedWindows = [];
            activeBinding = null;
            state.safeBounds = safeBounds();''',
'''            managedWindows = [];
            activeBinding = null;
            clearFrameUpdate();
            state.frameUpdateRequestCount = 0;
            state.frameUpdateApplyCount = 0;
            state.frameUpdateCoalescedCount = 0;
            state.frameUpdateSkippedCount = 0;
            state.lastFrameUpdateReason = "";
            state.safeBounds = safeBounds();''',
"init frame state")

text = replace_once(text,
'''            cancelDragActivation();
            cancelResizeActivation();
            for (index = 0; index < snapshot.length; index += 1) {''',
'''            cancelDragActivation();
            cancelResizeActivation();
            clearFrameUpdate();
            for (index = 0; index < snapshot.length; index += 1) {''',
"shutdown clears frame")

WINDOW.write_text(text, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260724.08"
for item in manifest["modules"]:
    if item["name"] == "ch_08_window.js":
        data = WINDOW.read_bytes()
        item["sha"] = hashlib.sha1(
            b"blob " + str(len(data)).encode("ascii") + b"\0" + data
        ).hexdigest()
        break
else:
    raise RuntimeError("ch_08_window.js missing from manifest")
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
