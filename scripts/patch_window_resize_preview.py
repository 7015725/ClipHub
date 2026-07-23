#!/usr/bin/env python3
import hashlib
import json
import re
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
'''    var MotionEvent = Packages.android.view.MotionEvent;
    var Gravity = Packages.android.view.Gravity;
    var WindowInsets = Packages.android.view.WindowInsets;''',
'''    var MotionEvent = Packages.android.view.MotionEvent;
    var Gravity = Packages.android.view.Gravity;
    var WindowManager = Packages.android.view.WindowManager;
    var WindowInsets = Packages.android.view.WindowInsets;''',
"WindowManager import")

text = replace_once(text,
'''    var Paint = Packages.android.graphics.Paint;
    var Path = Packages.android.graphics.Path;
    var Color = Packages.android.graphics.Color;''',
'''    var Paint = Packages.android.graphics.Paint;
    var Path = Packages.android.graphics.Path;
    var RectF = Packages.android.graphics.RectF;
    var Color = Packages.android.graphics.Color;''',
"RectF import")

text = replace_once(text,
'''    var frameUpdate = {
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
'''    var frameUpdate = {
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
    var resizePreview = {
        attached: false,
        sourceBinding: null,
        manager: null,
        rootView: null,
        layoutParams: null,
        visual: null,
        geometry: null,
        bounds: null
    };

    var drag = {''',
"resize preview state")

text = replace_once(text,
'''        downAt: 0,
        bounds: null,
        pending: false,
        active: false,
        longPressRunnable: null
    };

    var state = {''',
'''        downAt: 0,
        bounds: null,
        targetGeometry: null,
        pending: false,
        active: false,
        longPressRunnable: null
    };

    var state = {''',
"resize target geometry")

text = replace_once(text,
'''        resizeActivateCount: 0,
        resizeMoveCount: 0,
        geometryComputeCount: 0,''',
'''        resizeActivateCount: 0,
        resizeMoveCount: 0,
        resizePreviewEnabled: true,
        resizeLiveLayoutEnabled: false,
        resizePreviewAttached: false,
        resizePreviewShowCount: 0,
        resizePreviewUpdateCount: 0,
        resizePreviewCloseCount: 0,
        resizeCommitCount: 0,
        geometryComputeCount: 0,''',
"resize preview metrics")

pattern = re.compile(
    r'''    function updateSharedLayout\(sourceBinding, x, y, width, height, reason,\n            boundsOverride\) \{.*?\n    \}\n\n    function clearFrameUpdate\(\) \{''',
    re.S)
match = pattern.search(text)
if not match:
    raise RuntimeError("updateSharedLayout block not found")

replacement = r'''    function buildSharedGeometry(x, y, width, height, boundsOverride) {
        var bounds = validBounds(boundsOverride) ?
            copyBounds(boundsOverride) : safeBounds();
        var policy = sharedPolicy();
        var safeWidth = Math.max(1,
            Number(bounds.right) - Number(bounds.left));
        var safeHeight = Math.max(1,
            Number(bounds.bottom) - Number(bounds.top));
        var minWidth = Math.min(dp(policy.minWidthDp), safeWidth);
        var minHeight = Math.min(dp(policy.minHeightDp), safeHeight);
        var maxWidth = Math.min(dp(policy.maxWidthDp), safeWidth);
        var maxHeight = Math.min(dp(policy.maxHeightDp), safeHeight);
        var maxX;
        var maxY;
        width = clamp(Number(width), minWidth, maxWidth);
        height = clamp(Number(height), minHeight, maxHeight);
        maxX = Math.max(Number(bounds.left), Number(bounds.right) - width);
        maxY = Math.max(Number(bounds.top), Number(bounds.bottom) - height);
        x = clamp(Number(x), Number(bounds.left), maxX);
        y = clamp(Number(y), Number(bounds.top), maxY);
        return {
            role: "shared",
            orientation: orientationForBounds(bounds),
            bounds: copyBounds(bounds),
            x: Math.floor(x),
            y: Math.floor(y),
            width: Math.floor(width),
            height: Math.floor(height),
            widthDp: pxToDp(width),
            heightDp: pxToDp(height),
            minWidth: minWidth,
            minHeight: minHeight,
            maxWidth: maxWidth,
            maxHeight: maxHeight,
            xRatio: maxX > Number(bounds.left) ?
                clamp01((x - Number(bounds.left)) /
                    (maxX - Number(bounds.left))) : 0.5,
            yRatio: maxY > Number(bounds.top) ?
                clamp01((y - Number(bounds.top)) /
                    (maxY - Number(bounds.top))) : 1,
            widthRatio: clamp01(width / safeWidth),
            heightRatio: clamp01(height / safeHeight)
        };
    }

    function updateSharedLayout(sourceBinding, x, y, width, height, reason,
            boundsOverride) {
        var geometry;
        var index;
        var applied = 0;
        if (!sourceBinding || !sourceBinding.layoutParams) { return false; }
        activateBinding(sourceBinding);
        geometry = buildSharedGeometry(x, y, width, height, boundsOverride);
        for (index = 0; index < managedWindows.length; index += 1) {
            if (applyGeometryToBinding(managedWindows[index], geometry,
                    reason, managedWindows[index] === sourceBinding)) {
                applied += 1;
            }
        }
        sourceBinding.geometry = copyGeometry(geometry);
        state.primaryX = geometry.x;
        state.primaryY = geometry.y;
        state.primaryWidth = geometry.width;
        state.primaryHeight = geometry.height;
        state.safeBounds = copyBounds(geometry.bounds);
        state.orientation = geometry.orientation;
        state.geometryBroadcastCount += applied;
        return applied > 0;
    }

    function previewAccentColor() {
        var colors;
        try {
            if (ClipHub.Theme &&
                    typeof ClipHub.Theme.getPalette === "function") {
                colors = ClipHub.Theme.getPalette(appContext);
                return String(colors.accentStrong || colors.accent ||
                    "#7C5CFC");
            }
        } catch (ignoredPalette) {}
        return "#7C5CFC";
    }

    function createResizePreviewVisual() {
        var visual = { geometry: null, bounds: null };
        var fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        var strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        var drawable;
        var view;
        fillPaint.setStyle(Paint.Style.FILL);
        fillPaint["setColor(int)"](parseColor(previewAccentColor(),
            "#7C5CFC"));
        fillPaint.setAlpha(18);
        strokePaint.setStyle(Paint.Style.STROKE);
        strokePaint.setStrokeCap(Paint.Cap.ROUND);
        strokePaint.setStrokeJoin(Paint.Join.ROUND);
        strokePaint.setStrokeWidth(dp(1.4));
        strokePaint["setColor(int)"](parseColor(previewAccentColor(),
            "#7C5CFC"));
        strokePaint.setAlpha(168);
        drawable = new JavaAdapter(Drawable, {
            draw: function (canvas) {
                var geometry = visual.geometry;
                var bounds = visual.bounds;
                var inset = dp(1.5);
                var rect;
                if (!geometry || !bounds) { return; }
                rect = new RectF(
                    Number(geometry.x) - Number(bounds.left) + inset,
                    Number(geometry.y) - Number(bounds.top) + inset,
                    Number(geometry.x) - Number(bounds.left) +
                        Number(geometry.width) - inset,
                    Number(geometry.y) - Number(bounds.top) +
                        Number(geometry.height) - inset);
                canvas.drawRoundRect(rect, dp(24), dp(24), fillPaint);
                canvas.drawRoundRect(rect, dp(24), dp(24), strokePaint);
            },
            setAlpha: function () {},
            setColorFilter: function (filter) {
                fillPaint.setColorFilter(filter);
                strokePaint.setColorFilter(filter);
            },
            getOpacity: function () {
                return PixelFormat.TRANSLUCENT;
            }
        });
        view = new View(appContext);
        view.setBackground(drawable);
        return {
            view: view,
            setGeometry: function (geometry, bounds) {
                visual.geometry = copyGeometry(geometry);
                visual.bounds = copyBounds(bounds);
                try { view.invalidate(); } catch (ignoredInvalidate) {}
            }
        };
    }

    function clearResizePreviewState() {
        resizePreview.attached = false;
        resizePreview.sourceBinding = null;
        resizePreview.manager = null;
        resizePreview.rootView = null;
        resizePreview.layoutParams = null;
        resizePreview.visual = null;
        resizePreview.geometry = null;
        resizePreview.bounds = null;
        state.resizePreviewAttached = false;
    }

    function removeResizePreview() {
        var manager = resizePreview.manager;
        var root = resizePreview.rootView;
        var wasAttached = resizePreview.attached === true;
        if (manager !== null && root !== null) {
            try { manager.removeViewImmediate(root); }
            catch (error) {
                try {
                    if (root.isAttachedToWindow()) {
                        state.lastError = String(error);
                    }
                } catch (ignoredAttached) {}
            }
        }
        clearResizePreviewState();
        if (wasAttached) { state.resizePreviewCloseCount += 1; }
        return wasAttached;
    }

    function showResizePreview(binding, geometry) {
        var bounds;
        var width;
        var height;
        var type;
        var flags;
        var visual;
        var params;
        var manager;
        if (!binding || !geometry) { return false; }
        removeResizePreview();
        bounds = copyBounds(geometry.bounds);
        width = Math.max(1, Number(bounds.right) - Number(bounds.left));
        height = Math.max(1, Number(bounds.bottom) - Number(bounds.top));
        manager = binding.manager || windowManager;
        type = Number(binding.layoutParams && binding.layoutParams.type ||
            (Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT));
        flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE |
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED;
        visual = createResizePreviewVisual();
        params = new WindowManager.LayoutParams(width, height, type, flags,
            PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = Number(bounds.left);
        params.y = Number(bounds.top);
        try { params.setTitle("ClipHub Resize Preview"); }
        catch (ignoredTitle) {}
        try {
            manager.addView(visual.view, params);
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
        resizePreview.attached = true;
        resizePreview.sourceBinding = binding;
        resizePreview.manager = manager;
        resizePreview.rootView = visual.view;
        resizePreview.layoutParams = params;
        resizePreview.visual = visual;
        resizePreview.geometry = copyGeometry(geometry);
        resizePreview.bounds = copyBounds(bounds);
        state.resizePreviewAttached = true;
        state.resizePreviewShowCount += 1;
        visual.setGeometry(geometry, bounds);
        return true;
    }

    function updateResizePreview(geometry) {
        if (!geometry) { return false; }
        if (!resizePreview.attached || !resizePreview.visual) {
            return showResizePreview(resize.binding, geometry);
        }
        resizePreview.geometry = copyGeometry(geometry);
        resizePreview.bounds = copyBounds(geometry.bounds);
        resizePreview.visual.setGeometry(geometry, geometry.bounds);
        state.resizePreviewUpdateCount += 1;
        return true;
    }

    function clearFrameUpdate() {'''

text = text[:match.start()] + replacement + text[match.end():]

text = replace_once(text,
'''        state.resizeActive = true;
        state.resizeActivateCount += 1;
        setResizeVisual(binding, true);
        performHaptic(view, "resize_activate");
        return true;''',
'''        state.resizeActive = true;
        state.resizeActivateCount += 1;
        setResizeVisual(binding, true);
        if (resize.targetGeometry === null) {
            resize.targetGeometry = buildSharedGeometry(
                Number(binding.layoutParams.x),
                Number(binding.layoutParams.y),
                Number(binding.layoutParams.width),
                Number(binding.layoutParams.height), resize.bounds);
        }
        showResizePreview(binding, resize.targetGeometry);
        performHaptic(view, "resize_activate");
        return true;''',
"activate preview")

text = replace_once(text,
'''            resize.downAt = Number(event.getEventTime());
            resize.bounds = gestureBoundsSnapshot();
            resize.active = false;''',
'''            resize.downAt = Number(event.getEventTime());
            resize.bounds = gestureBoundsSnapshot();
            resize.targetGeometry = buildSharedGeometry(
                Number(binding.layoutParams.x),
                Number(binding.layoutParams.y),
                resize.startWidth, resize.startHeight, resize.bounds);
            resize.active = false;''',
"resize initial target")

text = replace_once(text,
'''            if (resize.active && resize.binding === binding) {
                width = resize.startWidth + deltaX;
                height = resize.startHeight + deltaY;
                requestFrameUpdate(binding, Number(binding.layoutParams.x),
                    Number(binding.layoutParams.y), width, height,
                    "resize_bottom_right_shared", resize.bounds);
                state.resizeMoveCount += 1;
            }''',
'''            if (resize.active && resize.binding === binding) {
                width = resize.startWidth + deltaX;
                height = resize.startHeight + deltaY;
                resize.targetGeometry = buildSharedGeometry(
                    Number(binding.layoutParams.x),
                    Number(binding.layoutParams.y), width, height,
                    resize.bounds);
                updateResizePreview(resize.targetGeometry);
                state.resizeMoveCount += 1;
            }''',
"preview resize movement")

text = replace_once(text,
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
            }
            return true;''',
'''            completed = resize.active && resize.binding === binding;
            if (completed && action === MotionEvent.ACTION_UP &&
                    resize.targetGeometry !== null) {
                updateSharedLayout(binding,
                    Number(resize.targetGeometry.x),
                    Number(resize.targetGeometry.y),
                    Number(resize.targetGeometry.width),
                    Number(resize.targetGeometry.height),
                    "resize_preview_commit",
                    resize.targetGeometry.bounds);
                state.resizeCommitCount += 1;
            }
            removeResizePreview();
            cancelResizeActivation();
            resize.active = false;
            resize.binding = null;
            resize.bounds = null;
            resize.targetGeometry = null;
            state.resizeActive = false;
            setResizeVisual(binding, false);
            if (completed && action === MotionEvent.ACTION_UP) {
                persistSharedGeometry(binding);
            }
            return true;''',
"resize commit")

text = replace_once(text,
'''                removed = managedWindows[index];
                removed.attached = false;
                cancelFrameUpdateForBinding(removed);
                removeImeObserver(removed);''',
'''                removed = managedWindows[index];
                removed.attached = false;
                cancelFrameUpdateForBinding(removed);
                if (resizePreview.sourceBinding === removed) {
                    removeResizePreview();
                }
                removeImeObserver(removed);''',
"detach preview cleanup")

text = replace_once(text,
'''            resizeActivateCount: Number(state.resizeActivateCount),
            resizeMoveCount: Number(state.resizeMoveCount),
            geometryComputeCount: Number(state.geometryComputeCount),''',
'''            resizeActivateCount: Number(state.resizeActivateCount),
            resizeMoveCount: Number(state.resizeMoveCount),
            resizePreviewEnabled: state.resizePreviewEnabled === true,
            resizeLiveLayoutEnabled: state.resizeLiveLayoutEnabled === true,
            resizePreviewAttached: state.resizePreviewAttached === true,
            resizePreviewShowCount: Number(state.resizePreviewShowCount),
            resizePreviewUpdateCount: Number(state.resizePreviewUpdateCount),
            resizePreviewCloseCount: Number(state.resizePreviewCloseCount),
            resizeCommitCount: Number(state.resizeCommitCount),
            geometryComputeCount: Number(state.geometryComputeCount),''',
"state preview metrics")

text = replace_once(text,
'''        MODULE_NAME: "ch_08_window",
        MODULE_VERSION: 14,''',
'''        MODULE_NAME: "ch_08_window",
        MODULE_VERSION: 15,''',
"module version")

text = replace_once(text,
'''            managedWindows = [];
            activeBinding = null;
            clearFrameUpdate();''',
'''            managedWindows = [];
            activeBinding = null;
            clearFrameUpdate();
            clearResizePreviewState();
            resize.targetGeometry = null;''',
"init preview reset")

text = replace_once(text,
'''            cancelDragActivation();
            cancelResizeActivation();
            clearFrameUpdate();''',
'''            cancelDragActivation();
            cancelResizeActivation();
            removeResizePreview();
            clearFrameUpdate();''',
"shutdown preview cleanup")

WINDOW.write_text(text, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260724.09"
for item in manifest["modules"]:
    path = ROOT / item["path"]
    data = path.read_bytes()
    item["sha"] = hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
