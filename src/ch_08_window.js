(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var ComponentCallbacks = Packages.android.content.ComponentCallbacks;
    var Build = Packages.android.os.Build;
    var Looper = Packages.android.os.Looper;
    var Handler = Packages.android.os.Handler;
    var CountDownLatch = Packages.java.util.concurrent.CountDownLatch;
    var TimeUnit = Packages.java.util.concurrent.TimeUnit;
    var Thread = Packages.java.lang.Thread;
    var View = Packages.android.view.View;
    var MotionEvent = Packages.android.view.MotionEvent;
    var Gravity = Packages.android.view.Gravity;
    var WindowInsets = Packages.android.view.WindowInsets;
    var ViewConfiguration = Packages.android.view.ViewConfiguration;
    var HapticFeedbackConstants = Packages.android.view.HapticFeedbackConstants;
    var DisplayMetrics = Packages.android.util.DisplayMetrics;
    var DisplayManager = Packages.android.hardware.display.DisplayManager;

    var androidContext = null;
    var appContext = null;
    var windowManager = null;
    var displayManager = null;
    var mainHandler = null;
    var componentCallbacks = null;
    var displayListener = null;
    var refreshRunnable = null;
    var pendingRefreshReason = "";
    var density = 1;
    var touchSlopPx = 0;
    var longPressTimeoutMs = 500;

    var primary = {
        attached: false,
        rootView: null,
        layoutParams: null,
        manager: null,
        dragView: null,
        resizeView: null,
        onGeometryChanged: null,
        onRequestClose: null,
        geometry: null,
        pinned: false
    };

    var drag = {
        downRawX: 0,
        downRawY: 0,
        startX: 0,
        startY: 0,
        active: false
    };

    var resize = {
        downRawX: 0,
        downRawY: 0,
        startWidth: 0,
        startHeight: 0,
        pending: false,
        active: false,
        longPressRunnable: null
    };

    var state = {
        geometryService: true,
        legacyHomeRemoved: true,
        primaryAttached: false,
        primaryPinned: false,
        primaryX: 0,
        primaryY: 0,
        primaryWidth: 0,
        primaryHeight: 0,
        safeBounds: { left: 0, top: 0, right: 0, bottom: 0 },
        orientation: "portrait",
        dragActive: false,
        resizePending: false,
        resizeActive: false,
        dragMoveCount: 0,
        resizeActivateCount: 0,
        resizeMoveCount: 0,
        geometryComputeCount: 0,
        geometryPersistCount: 0,
        boundsRefreshCount: 0,
        configurationChangeCount: 0,
        displayChangeCount: 0,
        componentCallbacksRegistered: false,
        displayListenerRegistered: false,
        lastBoundsReason: "",
        lastPersistedGeometry: null,
        lastError: null
    };

    function nowThread() {
        var thread = Thread.currentThread();
        return { id: Number(thread.getId()), name: String(thread.getName()) };
    }

    function runOnMainSync(callback, timeoutMs) {
        var mainLooper = Looper.getMainLooper();
        var currentLooper = Looper.myLooper();
        var box;
        var latch;
        var runnable;
        var posted;
        var completed;
        if (mainLooper !== null && currentLooper !== null &&
                currentLooper === mainLooper) {
            return { ok: true, value: callback(), direct: true };
        }
        box = { ok: false, value: null, error: null };
        latch = new CountDownLatch(1);
        runnable = new Packages.java.lang.Runnable({
            run: function () {
                try {
                    box.value = callback();
                    box.ok = true;
                } catch (error) {
                    box.error = error;
                } finally {
                    latch.countDown();
                }
            }
        });
        posted = mainHandler.post(runnable);
        if (!posted) {
            return { ok: false,
                error: new Error("Window geometry main handler post failed") };
        }
        completed = latch.await(Number(timeoutMs || 2500),
            TimeUnit.MILLISECONDS);
        if (!completed) {
            try { mainHandler.removeCallbacks(runnable); } catch (ignored) {}
            return { ok: false,
                error: new Error("Window geometry main handler timeout") };
        }
        return box;
    }

    function requireMainResult(result) {
        if (!result || result.ok !== true) {
            throw result && result.error ? result.error :
                new Error("Window geometry main-thread operation failed");
        }
        return result.value;
    }

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function pxToDp(value) {
        return density > 0 ? Number(value) / density : Number(value);
    }

    function clamp(value, minimum, maximum) {
        value = Number(value);
        minimum = Number(minimum);
        maximum = Number(maximum);
        if (!isFinite(value)) { value = minimum; }
        if (!isFinite(minimum)) { minimum = 0; }
        if (!isFinite(maximum) || maximum < minimum) { maximum = minimum; }
        if (value < minimum) { return minimum; }
        if (value > maximum) { return maximum; }
        return value;
    }

    function clamp01(value) {
        return clamp(Number(value), 0, 1);
    }

    function copyBounds(bounds) {
        bounds = bounds || {};
        return {
            left: Number(bounds.left || 0),
            top: Number(bounds.top || 0),
            right: Number(bounds.right || 0),
            bottom: Number(bounds.bottom || 0)
        };
    }

    function copyGeometry(value) {
        if (!value || typeof value !== "object") { return null; }
        return {
            role: String(value.role || "primary"),
            orientation: String(value.orientation || "portrait"),
            x: Number(value.x || 0),
            y: Number(value.y || 0),
            width: Number(value.width || 0),
            height: Number(value.height || 0),
            widthDp: Number(value.widthDp || 0),
            heightDp: Number(value.heightDp || 0),
            minWidth: Number(value.minWidth || 0),
            minHeight: Number(value.minHeight || 0),
            maxWidth: Number(value.maxWidth || 0),
            maxHeight: Number(value.maxHeight || 0),
            xRatio: clamp01(value.xRatio === undefined ? 0.5 : value.xRatio),
            yRatio: clamp01(value.yRatio === undefined ? 1 : value.yRatio),
            widthRatio: clamp01(value.widthRatio === undefined ? 1 :
                value.widthRatio),
            heightRatio: clamp01(value.heightRatio === undefined ? 1 :
                value.heightRatio),
            bounds: copyBounds(value.bounds)
        };
    }

    function resourceDimension(name) {
        var resources;
        var id;
        if (appContext === null) { return 0; }
        try {
            resources = appContext.getResources();
            id = Number(resources.getIdentifier(String(name), "dimen", "android"));
            return id > 0 ? Number(resources.getDimensionPixelSize(id)) : 0;
        } catch (ignored) { return 0; }
    }

    function safeBounds() {
        var result = { left: 0, top: 0, right: 0, bottom: 0 };
        var currentMetrics;
        var bounds;
        var insets;
        var types;
        var displayMetrics;
        if (windowManager === null) { return result; }
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                currentMetrics = windowManager.getCurrentWindowMetrics();
                bounds = currentMetrics.getBounds();
                types = Number(WindowInsets.Type.systemBars()) |
                    Number(WindowInsets.Type.displayCutout());
                insets = currentMetrics.getWindowInsets()
                    .getInsetsIgnoringVisibility(types);
                result.left = Number(bounds.left) + Number(insets.left);
                result.top = Number(bounds.top) + Number(insets.top);
                result.right = Number(bounds.right) - Number(insets.right);
                result.bottom = Number(bounds.bottom) - Number(insets.bottom);
                if (result.right > result.left && result.bottom > result.top) {
                    return result;
                }
            } catch (ignoredMetrics) {}
        }
        displayMetrics = new DisplayMetrics();
        try { windowManager.getDefaultDisplay().getRealMetrics(displayMetrics); }
        catch (ignoredDisplay) {
            displayMetrics = appContext.getResources().getDisplayMetrics();
        }
        result.left = 0;
        result.top = resourceDimension("status_bar_height");
        result.right = Number(displayMetrics.widthPixels);
        result.bottom = Number(displayMetrics.heightPixels) -
            resourceDimension("navigation_bar_height");
        if (result.bottom <= result.top) {
            result.top = 0;
            result.bottom = Number(displayMetrics.heightPixels);
        }
        return result;
    }

    function orientationForBounds(bounds) {
        return Number(bounds.right) - Number(bounds.left) >
            Number(bounds.bottom) - Number(bounds.top) ?
            "landscape" : "portrait";
    }

    function rolePolicy(role) {
        role = String(role || "primary");
        if (role === "detail") {
            return { widthRatio: 0.94, heightRatio: 0.76,
                minWidthDp: 300, minHeightDp: 320,
                maxWidthDp: 420, maxHeightDp: 650, bottomMarginDp: 10 };
        }
        if (role === "editor") {
            return { widthRatio: 0.94, heightRatio: 0.76,
                minWidthDp: 300, minHeightDp: 300,
                maxWidthDp: 390, maxHeightDp: 590, bottomMarginDp: 10 };
        }
        if (role === "tag_selector") {
            return { widthRatio: 0.94, heightRatio: 0.72,
                minWidthDp: 300, minHeightDp: 360,
                maxWidthDp: 390, maxHeightDp: 590, bottomMarginDp: 10 };
        }
        if (role === "translation") {
            return { widthRatio: 0.94, heightRatio: 0.72,
                minWidthDp: 300, minHeightDp: 340,
                maxWidthDp: 390, maxHeightDp: 650, bottomMarginDp: 10 };
        }
        if (role === "settings") {
            return { widthRatio: 0.94, heightRatio: 0.84,
                minWidthDp: 300, minHeightDp: 360,
                maxWidthDp: 390, maxHeightDp: 720, bottomMarginDp: 10 };
        }
        if (role === "filter_overlay") {
            return { widthRatio: 0.94, heightRatio: 0.82,
                minWidthDp: 300, minHeightDp: 360,
                maxWidthDp: 390, maxHeightDp: 720, bottomMarginDp: 10 };
        }
        return { widthRatio: 0.94, heightRatio: 0.82,
            minWidthDp: 300, minHeightDp: 420,
            maxWidthDp: 420, maxHeightDp: 720, bottomMarginDp: 10 };
    }

    function normalizeStoredBucket(value) {
        if (!value || typeof value !== "object") { return null; }
        return {
            xRatio: clamp01(value.xRatio === undefined ? 0.5 : value.xRatio),
            yRatio: clamp01(value.yRatio === undefined ? 1 : value.yRatio),
            widthRatio: clamp01(value.widthRatio === undefined ? 0.94 :
                value.widthRatio),
            heightRatio: clamp01(value.heightRatio === undefined ? 0.82 :
                value.heightRatio)
        };
    }

    function readStoredGeometry() {
        var value = null;
        try {
            if (ClipHub.Settings && typeof ClipHub.Settings.get === "function") {
                value = ClipHub.Settings.get("windowGeometry", null);
            }
        } catch (ignored) {}
        if (!value || typeof value !== "object") { return null; }
        return {
            version: Number(value.version || 1),
            portrait: normalizeStoredBucket(value.portrait),
            landscape: normalizeStoredBucket(value.landscape)
        };
    }

    function usableDimensionDp(safeDp, marginDp) {
        return Math.max(1, Number(safeDp) - Number(marginDp || 0) * 2);
    }

    function computeGeometry(role, options) {
        var bounds = safeBounds();
        var orientation = orientationForBounds(bounds);
        var policy = rolePolicy(role);
        var safeWidthDp = pxToDp(Number(bounds.right) - Number(bounds.left));
        var safeHeightDp = pxToDp(Number(bounds.bottom) - Number(bounds.top));
        var marginDp = Math.max(0, Number(options && options.marginDp !== undefined ?
            options.marginDp : 10));
        var usableWidthDp = usableDimensionDp(safeWidthDp, marginDp);
        var usableHeightDp = usableDimensionDp(safeHeightDp, marginDp);
        var minWidthDp = Math.min(Number(policy.minWidthDp), usableWidthDp);
        var minHeightDp = Math.min(Number(policy.minHeightDp), usableHeightDp);
        var maxWidthDp = Math.min(Number(policy.maxWidthDp), usableWidthDp);
        var maxHeightDp = Math.min(Number(policy.maxHeightDp), usableHeightDp);
        var widthRatio = Number(policy.widthRatio);
        var heightRatio = Number(policy.heightRatio);
        var xRatio = 0.5;
        var yRatio = 1;
        var stored;
        var bucket;
        var widthDp;
        var heightDp;
        var width;
        var height;
        var travelX;
        var travelY;
        var x;
        var y;
        options = options || {};
        if (role === "primary" && options.useSaved !== false) {
            stored = readStoredGeometry();
            bucket = stored ? stored[orientation] : null;
            if (bucket) {
                widthRatio = bucket.widthRatio;
                heightRatio = bucket.heightRatio;
                xRatio = bucket.xRatio;
                yRatio = bucket.yRatio;
            }
        }
        if (options.widthRatio !== undefined) {
            widthRatio = clamp01(options.widthRatio);
        }
        if (options.heightRatio !== undefined) {
            heightRatio = clamp01(options.heightRatio);
        }
        if (options.preferredWidthDp !== undefined) {
            widthDp = Number(options.preferredWidthDp);
        } else {
            widthDp = safeWidthDp * widthRatio;
        }
        if (options.preferredHeightDp !== undefined) {
            heightDp = Number(options.preferredHeightDp);
        } else {
            heightDp = safeHeightDp * heightRatio;
        }
        widthDp = clamp(widthDp, minWidthDp, maxWidthDp);
        heightDp = clamp(heightDp, minHeightDp, maxHeightDp);
        width = dp(widthDp);
        height = dp(heightDp);
        travelX = Math.max(0,
            Number(bounds.right) - Number(bounds.left) - width);
        travelY = Math.max(0,
            Number(bounds.bottom) - Number(bounds.top) - height);
        if (options.xRatio !== undefined) { xRatio = clamp01(options.xRatio); }
        if (options.yRatio !== undefined) { yRatio = clamp01(options.yRatio); }
        x = Math.floor(Number(bounds.left) + travelX * xRatio);
        y = Math.floor(Number(bounds.top) + travelY * yRatio);
        if (role !== "primary" && options.centerVertically === true) {
            yRatio = 0.5;
            y = Math.floor(Number(bounds.top) + travelY * 0.5);
        }
        state.geometryComputeCount += 1;
        state.safeBounds = copyBounds(bounds);
        state.orientation = orientation;
        return {
            role: String(role || "primary"),
            orientation: orientation,
            bounds: copyBounds(bounds),
            x: x,
            y: y,
            width: width,
            height: height,
            widthDp: pxToDp(width),
            heightDp: pxToDp(height),
            minWidth: dp(minWidthDp),
            minHeight: dp(minHeightDp),
            maxWidth: dp(maxWidthDp),
            maxHeight: dp(maxHeightDp),
            xRatio: xRatio,
            yRatio: yRatio,
            widthRatio: safeWidthDp > 0 ? widthDp / safeWidthDp : 1,
            heightRatio: safeHeightDp > 0 ? heightDp / safeHeightDp : 1
        };
    }

    function currentPrimaryGeometry() {
        var bounds;
        var width;
        var height;
        var travelX;
        var travelY;
        var safeWidth;
        var safeHeight;
        var geometry;
        if (!primary.attached || primary.layoutParams === null) {
            return copyGeometry(primary.geometry);
        }
        bounds = safeBounds();
        width = Number(primary.layoutParams.width);
        height = Number(primary.layoutParams.height);
        travelX = Math.max(0,
            Number(bounds.right) - Number(bounds.left) - width);
        travelY = Math.max(0,
            Number(bounds.bottom) - Number(bounds.top) - height);
        safeWidth = Math.max(1, Number(bounds.right) - Number(bounds.left));
        safeHeight = Math.max(1, Number(bounds.bottom) - Number(bounds.top));
        geometry = primary.geometry || computeGeometry("primary", {
            useSaved: false
        });
        geometry = copyGeometry(geometry);
        geometry.bounds = copyBounds(bounds);
        geometry.orientation = orientationForBounds(bounds);
        geometry.x = Number(primary.layoutParams.x);
        geometry.y = Number(primary.layoutParams.y);
        geometry.width = width;
        geometry.height = height;
        geometry.widthDp = pxToDp(width);
        geometry.heightDp = pxToDp(height);
        geometry.xRatio = travelX > 0 ? clamp01(
            (geometry.x - Number(bounds.left)) / travelX) : 0.5;
        geometry.yRatio = travelY > 0 ? clamp01(
            (geometry.y - Number(bounds.top)) / travelY) : 1;
        geometry.widthRatio = clamp01(width / safeWidth);
        geometry.heightRatio = clamp01(height / safeHeight);
        return geometry;
    }

    function notifyGeometryChanged(reason) {
        var geometry = currentPrimaryGeometry();
        primary.geometry = copyGeometry(geometry);
        state.primaryX = geometry ? Number(geometry.x) : 0;
        state.primaryY = geometry ? Number(geometry.y) : 0;
        state.primaryWidth = geometry ? Number(geometry.width) : 0;
        state.primaryHeight = geometry ? Number(geometry.height) : 0;
        state.safeBounds = geometry ? copyBounds(geometry.bounds) : safeBounds();
        state.orientation = geometry ? String(geometry.orientation) :
            orientationForBounds(state.safeBounds);
        if (typeof primary.onGeometryChanged === "function") {
            try {
                primary.onGeometryChanged(copyGeometry(geometry),
                    String(reason || "update"));
            } catch (error) {
                state.lastError = String(error);
            }
        }
        return geometry;
    }

    function updatePrimaryLayout(x, y, width, height, reason) {
        var bounds;
        var maxX;
        var maxY;
        if (!primary.attached || primary.rootView === null ||
                primary.layoutParams === null || primary.manager === null) {
            return false;
        }
        bounds = safeBounds();
        width = clamp(Number(width),
            Number(primary.geometry.minWidth),
            Math.min(Number(primary.geometry.maxWidth),
                Number(bounds.right) - Number(bounds.left)));
        height = clamp(Number(height),
            Number(primary.geometry.minHeight),
            Math.min(Number(primary.geometry.maxHeight),
                Number(bounds.bottom) - Number(bounds.top)));
        maxX = Math.max(Number(bounds.left), Number(bounds.right) - width);
        maxY = Math.max(Number(bounds.top), Number(bounds.bottom) - height);
        x = clamp(Number(x), Number(bounds.left), maxX);
        y = clamp(Number(y), Number(bounds.top), maxY);
        primary.layoutParams.gravity = Gravity.TOP | Gravity.START;
        primary.layoutParams.width = Math.floor(width);
        primary.layoutParams.height = Math.floor(height);
        primary.layoutParams.x = Math.floor(x);
        primary.layoutParams.y = Math.floor(y);
        primary.manager.updateViewLayout(primary.rootView,
            primary.layoutParams);
        notifyGeometryChanged(reason);
        return true;
    }

    function persistPrimaryGeometry() {
        var geometry;
        var stored;
        var bucket;
        if (!primary.attached || !ClipHub.Settings ||
                typeof ClipHub.Settings.set !== "function" ||
                typeof ClipHub.Settings.isReady !== "function" ||
                !ClipHub.Settings.isReady()) {
            return false;
        }
        geometry = currentPrimaryGeometry();
        if (!geometry) { return false; }
        stored = readStoredGeometry() || {
            version: 1,
            portrait: null,
            landscape: null
        };
        bucket = {
            xRatio: clamp01(geometry.xRatio),
            yRatio: clamp01(geometry.yRatio),
            widthRatio: clamp01(geometry.widthRatio),
            heightRatio: clamp01(geometry.heightRatio)
        };
        stored.version = 1;
        stored[geometry.orientation] = bucket;
        try {
            ClipHub.Settings.set("windowGeometry", stored, {
                cleanup: false
            });
            state.geometryPersistCount += 1;
            state.lastPersistedGeometry = {
                version: 1,
                portrait: stored.portrait,
                landscape: stored.landscape
            };
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function performHaptic(view, kind) {
        var constant = Number(HapticFeedbackConstants.LONG_PRESS);
        if (view === null || view === undefined) { return false; }
        try {
            if (String(kind || "") === "confirm" &&
                    Build.VERSION.SDK_INT >= 30) {
                constant = Number(HapticFeedbackConstants.CONFIRM);
            } else if (String(kind || "") === "resize_activate" &&
                    Build.VERSION.SDK_INT >= 34) {
                constant = Number(
                    HapticFeedbackConstants.GESTURE_THRESHOLD_ACTIVATE);
            }
        } catch (ignoredConstant) {
            constant = Number(HapticFeedbackConstants.LONG_PRESS);
        }
        try { return view.performHapticFeedback(constant) === true; }
        catch (ignoredHaptic) { return false; }
    }

    function imeVisible() {
        var insets;
        var mask;
        if (!primary.attached || primary.rootView === null ||
                Build.VERSION.SDK_INT < 30) {
            return false;
        }
        try {
            insets = primary.rootView.getRootWindowInsets();
            if (insets === null) { return false; }
            mask = WindowInsets.Type.ime();
            return insets.isVisible(mask) === true;
        } catch (ignored) { return false; }
    }

    function handleDragTouch(view, event) {
        var action = Number(event.getActionMasked());
        var rawX = Number(event.getRawX());
        var rawY = Number(event.getRawY());
        var deltaX;
        var deltaY;
        var completed;
        if (!primary.attached || primary.pinned || resize.pending ||
                resize.active) {
            return true;
        }
        if (action === MotionEvent.ACTION_DOWN) {
            drag.downRawX = rawX;
            drag.downRawY = rawY;
            drag.startX = Number(primary.layoutParams.x);
            drag.startY = Number(primary.layoutParams.y);
            drag.active = false;
            state.dragActive = false;
            return true;
        }
        if (action === MotionEvent.ACTION_MOVE) {
            deltaX = rawX - drag.downRawX;
            deltaY = rawY - drag.downRawY;
            if (!drag.active && Math.abs(deltaX) + Math.abs(deltaY) >=
                    touchSlopPx) {
                drag.active = true;
                state.dragActive = true;
            }
            if (drag.active) {
                updatePrimaryLayout(drag.startX + deltaX,
                    drag.startY + deltaY,
                    Number(primary.layoutParams.width),
                    Number(primary.layoutParams.height), "drag");
                state.dragMoveCount += 1;
            }
            return true;
        }
        if (action === MotionEvent.ACTION_UP ||
                action === MotionEvent.ACTION_CANCEL) {
            completed = drag.active;
            drag.active = false;
            state.dragActive = false;
            if (completed && action === MotionEvent.ACTION_UP) {
                persistPrimaryGeometry();
            }
            return true;
        }
        return true;
    }

    function cancelResizeActivation() {
        if (mainHandler !== null && resize.longPressRunnable !== null) {
            try { mainHandler.removeCallbacks(resize.longPressRunnable); }
            catch (ignored) {}
        }
        resize.longPressRunnable = null;
        resize.pending = false;
        state.resizePending = false;
    }

    function scheduleResizeActivation(view) {
        cancelResizeActivation();
        resize.pending = true;
        state.resizePending = true;
        resize.longPressRunnable = new Packages.java.lang.Runnable({
            run: function () {
                if (!primary.attached || !resize.pending ||
                        primary.pinned || imeVisible()) {
                    cancelResizeActivation();
                    return;
                }
                resize.pending = false;
                resize.active = true;
                state.resizePending = false;
                state.resizeActive = true;
                state.resizeActivateCount += 1;
                performHaptic(view, "resize_activate");
            }
        });
        mainHandler.postDelayed(resize.longPressRunnable,
            longPressTimeoutMs);
    }

    function handleResizeTouch(view, event) {
        var action = Number(event.getActionMasked());
        var rawX = Number(event.getRawX());
        var rawY = Number(event.getRawY());
        var deltaX;
        var deltaY;
        var width;
        var height;
        var completed;
        if (!primary.attached || primary.pinned || drag.active) {
            return true;
        }
        if (action === MotionEvent.ACTION_DOWN) {
            if (imeVisible()) { return true; }
            resize.downRawX = rawX;
            resize.downRawY = rawY;
            resize.startWidth = Number(primary.layoutParams.width);
            resize.startHeight = Number(primary.layoutParams.height);
            resize.active = false;
            state.resizeActive = false;
            scheduleResizeActivation(view);
            return true;
        }
        if (action === MotionEvent.ACTION_MOVE) {
            deltaX = rawX - resize.downRawX;
            deltaY = rawY - resize.downRawY;
            if (resize.pending && Math.abs(deltaX) + Math.abs(deltaY) >
                    touchSlopPx) {
                cancelResizeActivation();
                return true;
            }
            if (resize.active) {
                width = resize.startWidth + deltaX;
                height = resize.startHeight + deltaY;
                updatePrimaryLayout(Number(primary.layoutParams.x),
                    Number(primary.layoutParams.y), width, height,
                    "resize_bottom_right");
                state.resizeMoveCount += 1;
            }
            return true;
        }
        if (action === MotionEvent.ACTION_UP ||
                action === MotionEvent.ACTION_CANCEL) {
            completed = resize.active;
            cancelResizeActivation();
            resize.active = false;
            state.resizeActive = false;
            if (completed && action === MotionEvent.ACTION_UP) {
                persistPrimaryGeometry();
            }
            return true;
        }
        return true;
    }

    function bindDragView(view) {
        primary.dragView = view || null;
        if (primary.dragView !== null) {
            primary.dragView.setOnTouchListener(new JavaAdapter(
                View.OnTouchListener, { onTouch: handleDragTouch }));
        }
        return primary.dragView !== null;
    }

    function bindResizeView(view) {
        primary.resizeView = view || null;
        if (primary.resizeView !== null) {
            primary.resizeView.setOnTouchListener(new JavaAdapter(
                View.OnTouchListener, { onTouch: handleResizeTouch }));
        }
        return primary.resizeView !== null;
    }

    function installPrimaryWindow(options) {
        var geometry;
        options = options || {};
        if (options.rootView === null || options.rootView === undefined ||
                options.layoutParams === null ||
                options.layoutParams === undefined ||
                options.windowManager === null ||
                options.windowManager === undefined) {
            throw new Error("Primary window binding is incomplete");
        }
        detachPrimaryWindow();
        primary.rootView = options.rootView;
        primary.layoutParams = options.layoutParams;
        primary.manager = options.windowManager;
        primary.onGeometryChanged = options.onGeometryChanged || null;
        primary.onRequestClose = options.onRequestClose || null;
        primary.pinned = options.pinned === true;
        geometry = options.geometry || computeGeometry("primary", {
            useSaved: true
        });
        primary.geometry = copyGeometry(geometry);
        primary.attached = true;
        state.primaryAttached = true;
        state.primaryPinned = primary.pinned;
        bindDragView(options.dragView || null);
        bindResizeView(options.resizeView || null);
        updatePrimaryLayout(Number(geometry.x), Number(geometry.y),
            Number(geometry.width), Number(geometry.height), "install");
        return getState();
    }

    function detachPrimaryWindow() {
        cancelResizeActivation();
        drag.active = false;
        resize.active = false;
        state.dragActive = false;
        state.resizeActive = false;
        primary.attached = false;
        primary.rootView = null;
        primary.layoutParams = null;
        primary.manager = null;
        primary.dragView = null;
        primary.resizeView = null;
        primary.onGeometryChanged = null;
        primary.onRequestClose = null;
        primary.geometry = null;
        primary.pinned = false;
        state.primaryAttached = false;
        state.primaryPinned = false;
        return true;
    }

    function setPrimaryDragView(view) {
        if (!primary.attached) { return false; }
        return bindDragView(view);
    }

    function setPrimaryResizeView(view) {
        if (!primary.attached) { return false; }
        return bindResizeView(view);
    }

    function setPrimaryPinned(value) {
        primary.pinned = value === true;
        state.primaryPinned = primary.pinned;
        return primary.pinned;
    }

    function refreshPrimaryBounds(reason) {
        var before;
        var bounds;
        var orientation;
        var safeWidth;
        var safeHeight;
        var policy;
        var width;
        var height;
        var x;
        var y;
        if (!primary.attached || primary.layoutParams === null) {
            state.safeBounds = safeBounds();
            state.orientation = orientationForBounds(state.safeBounds);
            state.lastBoundsReason = String(reason || "refresh");
            return false;
        }
        before = currentPrimaryGeometry();
        bounds = safeBounds();
        orientation = orientationForBounds(bounds);
        safeWidth = Math.max(1, Number(bounds.right) - Number(bounds.left));
        safeHeight = Math.max(1, Number(bounds.bottom) - Number(bounds.top));
        policy = rolePolicy("primary");
        primary.geometry.bounds = copyBounds(bounds);
        primary.geometry.orientation = orientation;
        primary.geometry.minWidth = Math.min(dp(policy.minWidthDp), safeWidth);
        primary.geometry.minHeight = Math.min(dp(policy.minHeightDp), safeHeight);
        primary.geometry.maxWidth = Math.min(dp(policy.maxWidthDp), safeWidth);
        primary.geometry.maxHeight = Math.min(dp(policy.maxHeightDp), safeHeight);
        width = clamp(safeWidth * before.widthRatio,
            primary.geometry.minWidth, primary.geometry.maxWidth);
        height = clamp(safeHeight * before.heightRatio,
            primary.geometry.minHeight, primary.geometry.maxHeight);
        x = Number(bounds.left) + Math.max(0, safeWidth - width) *
            before.xRatio;
        y = Number(bounds.top) + Math.max(0, safeHeight - height) *
            before.yRatio;
        updatePrimaryLayout(x, y, width, height,
            String(reason || "bounds_refresh"));
        state.boundsRefreshCount += 1;
        state.lastBoundsReason = String(reason || "refresh");
        return true;
    }

    function scheduleBoundsRefresh(reason) {
        if (mainHandler === null) { return false; }
        pendingRefreshReason = String(reason || "configuration");
        if (refreshRunnable === null) {
            refreshRunnable = new Packages.java.lang.Runnable({
                run: function () {
                    var reasonValue = pendingRefreshReason;
                    pendingRefreshReason = "";
                    try { refreshPrimaryBounds(reasonValue); }
                    catch (error) { state.lastError = String(error); }
                }
            });
        }
        try { mainHandler.removeCallbacks(refreshRunnable); } catch (ignored) {}
        return mainHandler.postDelayed(refreshRunnable, 180);
    }

    function registerObservers() {
        if (appContext === null) { return false; }
        componentCallbacks = new JavaAdapter(ComponentCallbacks, {
            onConfigurationChanged: function () {
                state.configurationChangeCount += 1;
                scheduleBoundsRefresh("configuration");
            },
            onLowMemory: function () {}
        });
        try {
            appContext.registerComponentCallbacks(componentCallbacks);
            state.componentCallbacksRegistered = true;
        } catch (error) {
            componentCallbacks = null;
            state.componentCallbacksRegistered = false;
            state.lastError = String(error);
        }
        try {
            displayManager = appContext.getSystemService(Context.DISPLAY_SERVICE);
            if (displayManager !== null) {
                displayListener = new JavaAdapter(
                    DisplayManager.DisplayListener, {
                        onDisplayAdded: function () {},
                        onDisplayRemoved: function () {},
                        onDisplayChanged: function () {
                            state.displayChangeCount += 1;
                            scheduleBoundsRefresh("display");
                        }
                    });
                displayManager.registerDisplayListener(displayListener,
                    mainHandler);
                state.displayListenerRegistered = true;
            }
        } catch (displayError) {
            displayListener = null;
            state.displayListenerRegistered = false;
            state.lastError = String(displayError);
        }
        return state.componentCallbacksRegistered ||
            state.displayListenerRegistered;
    }

    function unregisterObservers() {
        if (mainHandler !== null && refreshRunnable !== null) {
            try { mainHandler.removeCallbacks(refreshRunnable); }
            catch (ignored) {}
        }
        if (appContext !== null && componentCallbacks !== null) {
            try { appContext.unregisterComponentCallbacks(componentCallbacks); }
            catch (ignoredComponent) {}
        }
        if (displayManager !== null && displayListener !== null) {
            try { displayManager.unregisterDisplayListener(displayListener); }
            catch (ignoredDisplay) {}
        }
        componentCallbacks = null;
        displayListener = null;
        displayManager = null;
        state.componentCallbacksRegistered = false;
        state.displayListenerRegistered = false;
        return true;
    }

    function moveTo(x, y, options) {
        options = options || {};
        if (!primary.attached || primary.layoutParams === null) {
            return false;
        }
        updatePrimaryLayout(x, y,
            Number(primary.layoutParams.width),
            Number(primary.layoutParams.height), "api_move");
        if (options.persist === true) { persistPrimaryGeometry(); }
        return true;
    }

    function moveBy(dx, dy, options) {
        if (!primary.attached || primary.layoutParams === null) {
            return false;
        }
        return moveTo(Number(primary.layoutParams.x) + Number(dx || 0),
            Number(primary.layoutParams.y) + Number(dy || 0), options);
    }

    function requestClose(reason) {
        if (typeof primary.onRequestClose !== "function") { return false; }
        try { return primary.onRequestClose(String(reason || "window_service")); }
        catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function getState() {
        var geometry = currentPrimaryGeometry();
        var thread = nowThread();
        return {
            geometryService: true,
            legacyHomeRemoved: true,
            attached: primary.attached,
            attachedToWindow: primary.attached && primary.rootView !== null ?
                primary.rootView.isAttachedToWindow() : false,
            primaryAttached: primary.attached,
            primaryPinned: primary.pinned,
            moving: drag.active,
            resizing: resize.active,
            resizePending: resize.pending,
            resizeCorner: "bottom_right",
            geometry: copyGeometry(geometry),
            safeBounds: copyBounds(state.safeBounds),
            orientation: state.orientation,
            dragMoveCount: Number(state.dragMoveCount),
            resizeActivateCount: Number(state.resizeActivateCount),
            resizeMoveCount: Number(state.resizeMoveCount),
            geometryComputeCount: Number(state.geometryComputeCount),
            geometryPersistCount: Number(state.geometryPersistCount),
            boundsRefreshCount: Number(state.boundsRefreshCount),
            configurationChangeCount:
                Number(state.configurationChangeCount),
            displayChangeCount: Number(state.displayChangeCount),
            componentCallbacksRegistered:
                state.componentCallbacksRegistered === true,
            displayListenerRegistered:
                state.displayListenerRegistered === true,
            lastBoundsReason: state.lastBoundsReason,
            lastPersistedGeometry: state.lastPersistedGeometry,
            stateThreadId: thread.id,
            stateThreadName: thread.name,
            lastError: state.lastError
        };
    }

    ClipHub.Window = {
        MODULE_NAME: "ch_08_window",
        MODULE_VERSION: 7,
        init: function (context) {
            androidContext = context && context.androidContext ?
                context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable for window geometry");
            }
            appContext = androidContext.getApplicationContext();
            if (appContext === null) { appContext = androidContext; }
            windowManager = appContext.getSystemService(Context.WINDOW_SERVICE);
            if (windowManager === null) {
                throw new Error("WindowManager service unavailable");
            }
            mainHandler = new Handler(Looper.getMainLooper());
            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
            touchSlopPx = Number(ViewConfiguration.get(appContext)
                .getScaledTouchSlop());
            longPressTimeoutMs = Number(ViewConfiguration.getLongPressTimeout());
            state.safeBounds = safeBounds();
            state.orientation = orientationForBounds(state.safeBounds);
            registerObservers();
            return {
                ok: true,
                initialized: true,
                geometryService: true,
                legacyHomeRemoved: true,
                safeBounds: copyBounds(state.safeBounds),
                orientation: state.orientation
            };
        },
        getEnvironment: function () {
            var bounds = safeBounds();
            return {
                density: density,
                bounds: copyBounds(bounds),
                widthPx: Number(bounds.right) - Number(bounds.left),
                heightPx: Number(bounds.bottom) - Number(bounds.top),
                widthDp: pxToDp(Number(bounds.right) - Number(bounds.left)),
                heightDp: pxToDp(Number(bounds.bottom) - Number(bounds.top)),
                orientation: orientationForBounds(bounds)
            };
        },
        computeGeometry: computeGeometry,
        installPrimaryWindow: installPrimaryWindow,
        detachPrimaryWindow: detachPrimaryWindow,
        setPrimaryDragView: setPrimaryDragView,
        setPrimaryResizeView: setPrimaryResizeView,
        setPrimaryPinned: setPrimaryPinned,
        refreshPrimaryBounds: refreshPrimaryBounds,
        persistPrimaryGeometry: persistPrimaryGeometry,
        performHaptic: performHaptic,
        isMoving: function () { return drag.active === true; },
        isResizing: function () { return resize.active === true; },
        isAttached: function () { return primary.attached === true; },
        moveTo: moveTo,
        moveBy: moveBy,
        refreshBounds: refreshPrimaryBounds,
        persistPosition: persistPrimaryGeometry,
        close: requestClose,
        runOnMain: function (callback, timeoutMs) {
            if (typeof callback !== "function") {
                throw new Error("Window main callback must be a function");
            }
            return requireMainResult(runOnMainSync(callback,
                timeoutMs || 2500));
        },
        getAndroidContext: function () { return appContext; },
        getState: getState,
        shutdown: function () {
            detachPrimaryWindow();
            unregisterObservers();
            androidContext = null;
            appContext = null;
            windowManager = null;
            mainHandler = null;
            refreshRunnable = null;
            pendingRefreshReason = "";
            return true;
        }
    };
}((function () { return this; }())));
