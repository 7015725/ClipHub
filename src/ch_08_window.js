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
    var ViewGroup = Packages.android.view.ViewGroup;
    var MotionEvent = Packages.android.view.MotionEvent;
    var InputMethodManager = Packages.android.view.inputmethod.InputMethodManager;
    var Gravity = Packages.android.view.Gravity;
    var WindowManager = Packages.android.view.WindowManager;
    var WindowInsets = Packages.android.view.WindowInsets;
    var ViewConfiguration = Packages.android.view.ViewConfiguration;
    var HapticFeedbackConstants = Packages.android.view.HapticFeedbackConstants;
    var DisplayMetrics = Packages.android.util.DisplayMetrics;
    var DisplayManager = Packages.android.hardware.display.DisplayManager;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var Paint = Packages.android.graphics.Paint;
    var Path = Packages.android.graphics.Path;
    var RectF = Packages.android.graphics.RectF;
    var Color = Packages.android.graphics.Color;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Drawable = Packages.android.graphics.drawable.Drawable;

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
    var managedWindows = [];
    var preparedFrames = [];
    var pendingSafeRemovals = [];
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

    var drag = {
        binding: null,
        downRawX: 0,
        downRawY: 0,
        startX: 0,
        startY: 0,
        downAt: 0,
        bounds: null,
        pending: false,
        active: false,
        longPressRunnable: null
    };

    var resize = {
        binding: null,
        downRawX: 0,
        downRawY: 0,
        startWidth: 0,
        startHeight: 0,
        downAt: 0,
        bounds: null,
        targetGeometry: null,
        pending: false,
        active: false,
        longPressRunnable: null
    };

    var state = {
        geometryService: true,
        sharedGeometryService: true,
        legacyHomeRemoved: true,
        primaryAttached: false,
        primaryPinned: false,
        primaryX: 0,
        primaryY: 0,
        primaryWidth: 0,
        primaryHeight: 0,
        safeBounds: { left: 0, top: 0, right: 0, bottom: 0 },
        orientation: "portrait",
        dragPending: false,
        dragActive: false,
        resizePending: false,
        resizeActive: false,
        dragActivateCount: 0,
        dragMoveCount: 0,
        resizeActivateCount: 0,
        resizeMoveCount: 0,
        resizePreviewEnabled: true,
        resizeLiveLayoutEnabled: false,
        resizePreviewAttached: false,
        resizePreviewShowCount: 0,
        resizePreviewUpdateCount: 0,
        resizePreviewCloseCount: 0,
        resizeCommitCount: 0,
        geometryComputeCount: 0,
        geometryPersistCount: 0,
        geometryBroadcastCount: 0,
        frameCoalescingEnabled: true,
        frameUpdateScheduled: false,
        frameUpdateRequestCount: 0,
        frameUpdateApplyCount: 0,
        frameUpdateCoalescedCount: 0,
        frameUpdateSkippedCount: 0,
        lastFrameUpdateReason: "",
        boundsRefreshCount: 0,
        configurationChangeCount: 0,
        displayChangeCount: 0,
        componentCallbacksRegistered: false,
        displayListenerRegistered: false,
        lastBoundsReason: "",
        lastPersistedGeometry: null,
        singleHostEnabled: true,
        singleHostAttachCount: 0,
        outsideTapCount: 0,
        outsideImeDismissCount: 0,
        outsideDismissCount: 0,
        outsideGestureCancelCount: 0,
        lastOutsideRole: "",
        lastOutsideAction: "",
        safeRemoveRequestCount: 0,
        safeRemoveQueuedCount: 0,
        safeRemoveCompleteCount: 0,
        safeRemoveAlreadyDetachedCount: 0,
        safeRemoveFailureCount: 0,
        safeRemoveTimeoutCount: 0,
        pendingSafeRemoveCount: 0,
        lastSafeRemoveRole: "",
        lastSafeRemoveReason: "",
        lastSafeRemoveError: null,
        lastError: null
    };

    function nowThread() {
        var thread = Thread.currentThread();
        return { id: Number(thread.getId()), name: String(thread.getName()) };
    }

    function isMainThread() {
        var mainLooper = Looper.getMainLooper();
        var mainThread;
        if (mainLooper === null) { return false; }
        try {
            if (Build.VERSION.SDK_INT >= 23) {
                return mainLooper.isCurrentThread();
            }
        } catch (ignoredCurrentThread) {}
        try {
            mainThread = mainLooper.getThread();
            return mainThread !== null &&
                Number(Thread.currentThread().getId()) ===
                Number(mainThread.getId());
        } catch (ignoredThread) {
            return false;
        }
    }

    function runOnMainSync(callback, timeoutMs) {
        var box;
        var latch;
        var runnable;
        var posted;
        var completed;
        if (isMainThread()) {
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

    function findPendingSafeRemoval(view) {
        var index;
        for (index = 0; index < pendingSafeRemovals.length; index += 1) {
            if (pendingSafeRemovals[index].view === view) {
                return pendingSafeRemovals[index];
            }
        }
        return null;
    }

    function finishSafeRemoval(entry, result) {
        var kept = [];
        var callbacks;
        var index;
        if (!entry || entry.completed === true) { return false; }
        entry.completed = true;
        try { entry.handler.removeCallbacks(entry.timeoutRunnable); }
        catch (ignoredTimeout) {}
        try { entry.view.removeOnAttachStateChangeListener(entry.listener); }
        catch (ignoredListener) {}
        for (index = 0; index < pendingSafeRemovals.length; index += 1) {
            if (pendingSafeRemovals[index] !== entry) {
                kept.push(pendingSafeRemovals[index]);
            }
        }
        pendingSafeRemovals = kept;
        state.pendingSafeRemoveCount = pendingSafeRemovals.length;
        if (result && result.ok === true) {
            state.safeRemoveCompleteCount += 1;
            state.lastSafeRemoveError = null;
        } else {
            state.safeRemoveFailureCount += 1;
            state.lastSafeRemoveError = String(result && result.error ?
                result.error : "safe removal failed");
            state.lastError = state.lastSafeRemoveError;
        }
        callbacks = entry.callbacks.slice(0);
        for (index = 0; index < callbacks.length; index += 1) {
            try { callbacks[index](result || { ok: false }); }
            catch (callbackError) {
                state.lastSafeRemoveError = String(callbackError);
                state.lastError = state.lastSafeRemoveError;
            }
        }
        return true;
    }

    function requestViewRemoval(options) {
        var manager;
        var view;
        var handler;
        var existing;
        var attached = false;
        var entry;
        var runnable;
        var timeoutPosted;
        options = options || {};
        manager = options.manager || windowManager;
        view = options.view || null;
        if (manager === null || manager === undefined || view === null) {
            state.safeRemoveFailureCount += 1;
            state.lastSafeRemoveError = "Safe removal manager/view unavailable";
            return { ok: false, queued: false,
                error: state.lastSafeRemoveError };
        }
        state.safeRemoveRequestCount += 1;
        state.lastSafeRemoveRole = String(options.role || "unknown");
        state.lastSafeRemoveReason = String(options.reason || "remove");
        existing = findPendingSafeRemoval(view);
        if (existing !== null) {
            if (typeof options.onDetached === "function") {
                existing.callbacks.push(options.onDetached);
            }
            return { ok: true, queued: true, reused: true,
                generation: existing.generation };
        }
        handler = mainHandler || new Handler(Looper.getMainLooper());
        try { attached = view.isAttachedToWindow() === true; }
        catch (ignoredAttached) {}
        entry = {
            manager: manager,
            view: view,
            handler: handler,
            role: String(options.role || "unknown"),
            reason: String(options.reason || "remove"),
            generation: Number(options.generation || 0),
            callbacks: typeof options.onDetached === "function" ?
                [options.onDetached] : [],
            listener: null,
            timeoutRunnable: null,
            completed: false
        };
        entry.listener = new JavaAdapter(View.OnAttachStateChangeListener, {
            onViewAttachedToWindow: function () {},
            onViewDetachedFromWindow: function (detachedView) {
                finishSafeRemoval(entry, { ok: true, detached: true,
                    generation: entry.generation });
            }
        });
        entry.timeoutRunnable = new Packages.java.lang.Runnable({
            run: function () {
                if (entry.completed === true) { return; }
                state.safeRemoveTimeoutCount += 1;
                finishSafeRemoval(entry, { ok: false, timeout: true,
                    detached: false, generation: entry.generation,
                    error: new Error("Safe removal detach timeout: " +
                        entry.role) });
            }
        });
        pendingSafeRemovals.push(entry);
        state.pendingSafeRemoveCount = pendingSafeRemovals.length;
        try { view.addOnAttachStateChangeListener(entry.listener); }
        catch (listenerError) {
            finishSafeRemoval(entry, { ok: false,
                error: listenerError });
            return { ok: false, queued: false, error: listenerError };
        }
        runnable = new Packages.java.lang.Runnable({
            run: function () {
                var stillAttached = false;
                if (entry.completed === true) { return; }
                try {
                    entry.manager.removeView(entry.view);
                } catch (removeError) {
                    try { stillAttached = entry.view.isAttachedToWindow(); }
                    catch (ignoredStillAttached) {}
                    if (stillAttached) {
                        finishSafeRemoval(entry, { ok: false,
                            error: removeError, generation: entry.generation });
                        return;
                    }
                }
                try { stillAttached = entry.view.isAttachedToWindow(); }
                catch (ignoredAfterRemove) {}
                if (!stillAttached) {
                    finishSafeRemoval(entry, { ok: true, detached: true,
                        generation: entry.generation });
                }
            }
        });
        if (!attached) {
            state.safeRemoveAlreadyDetachedCount += 1;
        }
        if (!handler.post(runnable)) {
            finishSafeRemoval(entry, { ok: false,
                error: new Error("Safe removal post failed") });
            return { ok: false, queued: false };
        }
        state.safeRemoveQueuedCount += 1;
        timeoutPosted = handler.postDelayed(entry.timeoutRunnable,
            Math.max(250, Number(options.timeoutMs || 2000)));
        if (!timeoutPosted) {
            try { handler.removeCallbacks(runnable); } catch (ignoredPost) {}
            finishSafeRemoval(entry, { ok: false,
                error: new Error("Safe removal timeout post failed") });
            return { ok: false, queued: false };
        }
        return { ok: true, queued: true, reused: false,
            generation: entry.generation };
    }

    function getRemovalState() {
        return {
            safeRemoveRequestCount: Number(state.safeRemoveRequestCount),
            safeRemoveQueuedCount: Number(state.safeRemoveQueuedCount),
            safeRemoveCompleteCount: Number(state.safeRemoveCompleteCount),
            safeRemoveAlreadyDetachedCount:
                Number(state.safeRemoveAlreadyDetachedCount),
            safeRemoveFailureCount: Number(state.safeRemoveFailureCount),
            safeRemoveTimeoutCount: Number(state.safeRemoveTimeoutCount),
            pendingSafeRemoveCount: Number(state.pendingSafeRemoveCount),
            lastSafeRemoveRole: state.lastSafeRemoveRole,
            lastSafeRemoveReason: state.lastSafeRemoveReason,
            lastSafeRemoveError: state.lastSafeRemoveError
        };
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
            role: String(value.role || "shared"),
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

    function sharedPolicy() {
        return {
            widthRatio: 0.94,
            heightRatio: 0.82,
            minWidthDp: 280,
            minHeightDp: 320,
            maxWidthDp: 420,
            maxHeightDp: 720
        };
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

    function computeGeometry(role, options) {
        var bounds = safeBounds();
        var orientation = orientationForBounds(bounds);
        var policy = sharedPolicy();
        var safeWidth = Math.max(1,
            Number(bounds.right) - Number(bounds.left));
        var safeHeight = Math.max(1,
            Number(bounds.bottom) - Number(bounds.top));
        var safeWidthDp = pxToDp(safeWidth);
        var safeHeightDp = pxToDp(safeHeight);
        var marginDp;
        var usableWidthDp;
        var usableHeightDp;
        var minWidthDp;
        var minHeightDp;
        var maxWidthDp;
        var maxHeightDp;
        var widthRatio = policy.widthRatio;
        var heightRatio = policy.heightRatio;
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
        marginDp = Math.max(0, Number(options.marginDp !== undefined ?
            options.marginDp : 10));
        usableWidthDp = Math.max(1, safeWidthDp - marginDp * 2);
        usableHeightDp = Math.max(1, safeHeightDp - marginDp * 2);
        minWidthDp = Math.min(policy.minWidthDp, usableWidthDp);
        minHeightDp = Math.min(policy.minHeightDp, usableHeightDp);
        maxWidthDp = Math.min(policy.maxWidthDp, usableWidthDp);
        maxHeightDp = Math.min(policy.maxHeightDp, usableHeightDp);
        if (options.useSaved !== false) {
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
        widthDp = options.preferredWidthDp !== undefined ?
            Number(options.preferredWidthDp) : safeWidthDp * widthRatio;
        heightDp = options.preferredHeightDp !== undefined ?
            Number(options.preferredHeightDp) : safeHeightDp * heightRatio;
        widthDp = clamp(widthDp, minWidthDp, maxWidthDp);
        heightDp = clamp(heightDp, minHeightDp, maxHeightDp);
        width = dp(widthDp);
        height = dp(heightDp);
        travelX = Math.max(0, safeWidth - width);
        travelY = Math.max(0, safeHeight - height);
        if (options.xRatio !== undefined) { xRatio = clamp01(options.xRatio); }
        if (options.yRatio !== undefined) { yRatio = clamp01(options.yRatio); }
        x = Math.floor(Number(bounds.left) + travelX * xRatio);
        y = Math.floor(Number(bounds.top) + travelY * yRatio);
        state.geometryComputeCount += 1;
        state.safeBounds = copyBounds(bounds);
        state.orientation = orientation;
        return {
            role: String(role || "shared"),
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

    function createResizeVisual(colorText) {
        var visual = { active: false, alpha: 1 };
        var paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        var drawable;
        var view;
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        ClipHub.Theme.applyPaintColor(paint,
            String(colorText || "#7C5CFC"));
        drawable = new JavaAdapter(Drawable, {
            draw: function (canvas) {
                var width = Number(canvas.getWidth());
                var height = Number(canvas.getHeight());
                var right = width - dp(11);
                var bottom = height - dp(11);
                var outerPath = new Path();
                var innerPath = new Path();

                paint.setStrokeWidth(dp(visual.active ? 1.4 : 0.9));
                paint.setAlpha(Math.floor((visual.active ? 158 : 48) *
                    Number(visual.alpha || 1)));

                outerPath.moveTo(right - dp(14), bottom - dp(3));
                outerPath.cubicTo(right - dp(10.4), bottom - dp(4.2),
                    right - dp(4.2), bottom - dp(10.4),
                    right - dp(3), bottom - dp(14));
                innerPath.moveTo(right - dp(9.5), bottom - dp(3));
                innerPath.cubicTo(right - dp(7.1), bottom - dp(3.9),
                    right - dp(3.9), bottom - dp(7.1),
                    right - dp(3), bottom - dp(9.5));

                canvas.drawPath(outerPath, paint);
                canvas.drawPath(innerPath, paint);
            },
            setAlpha: function (alpha) {
                visual.alpha = clamp(Number(alpha) / 255, 0, 1);
            },
            setColorFilter: function (filter) {
                paint.setColorFilter(filter);
            },
            getOpacity: function () {
                return PixelFormat.TRANSLUCENT;
            }
        });
        view = new View(appContext);
        view.setBackground(drawable);
        view.setClickable(true);
        view.setFocusable(true);
        view.setContentDescription("长按并拖动调整窗口大小");
        return {
            view: view,
            setActive: function (active) {
                visual.active = active === true;
                try { view.invalidate(); } catch (ignored) {}
            }
        };
    }

    function removePreparedFrame(rootView) {
        var kept = [];
        var removed = null;
        var index;
        for (index = 0; index < preparedFrames.length; index += 1) {
            if (preparedFrames[index].rootView === rootView) {
                removed = preparedFrames[index];
            } else {
                kept.push(preparedFrames[index]);
            }
        }
        preparedFrames = kept;
        return removed;
    }

    function findPreparedFrame(rootView) {
        var index;
        for (index = preparedFrames.length - 1; index >= 0; index -= 1) {
            if (preparedFrames[index].rootView === rootView) {
                return preparedFrames[index];
            }
        }
        return null;
    }

    function createManagedFrame(contentView, options) {
        var hostRoot;
        var panelRoot;
        var panelParams;
        var contentParams;
        var dragView;
        var dragParams;
        var resizeVisual;
        var resizeParams;
        options = options || {};
        if (contentView === null || contentView === undefined) {
            throw new Error("Managed window content view is required");
        }
        hostRoot = new FrameLayout(appContext);
        hostRoot.setClipChildren(false);
        hostRoot.setClipToPadding(false);
        hostRoot.setClickable(true);
        hostRoot.setFocusable(true);
        hostRoot.setFocusableInTouchMode(true);

        panelRoot = new FrameLayout(appContext);
        panelRoot.setClipChildren(false);
        panelRoot.setClipToPadding(false);
        panelParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT);
        hostRoot.addView(panelRoot, panelParams);

        contentParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT);
        panelRoot.addView(contentView, contentParams);
        if (Build.VERSION.SDK_INT >= 21) {
            try { contentView.setElevation(0); } catch (ignoredElevation) {}
            try { contentView.setClipToOutline(true); } catch (ignoredClip) {}
        }
        dragView = new View(appContext);
        dragView.setClickable(true);
        dragView.setFocusable(true);
        dragView.setContentDescription("长按并拖动移动窗口");
        dragParams = new FrameLayout.LayoutParams(dp(86), dp(24));
        dragParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        panelRoot.addView(dragView, dragParams);
        resizeVisual = createResizeVisual(options.accentColor || "#7C5CFC");
        resizeParams = new FrameLayout.LayoutParams(dp(40), dp(40));
        resizeParams.gravity = Gravity.END | Gravity.BOTTOM;
        panelRoot.addView(resizeVisual.view, resizeParams);
        preparedFrames.push({
            rootView: hostRoot,
            panelView: panelRoot,
            contentView: contentView
        });
        return {
            rootView: hostRoot,
            panelView: panelRoot,
            contentView: contentView,
            dragView: dragView,
            resizeView: resizeVisual.view,
            resizeVisual: resizeVisual,
            singleHost: true
        };
    }

    function bindingImeVisible(binding) {
        var insets;
        if (!binding || !binding.rootView || Build.VERSION.SDK_INT < 30) {
            return false;
        }
        try {
            insets = binding.rootView.getRootWindowInsets();
            return insets !== null &&
                insets.isVisible(WindowInsets.Type.ime()) === true;
        } catch (ignored) { return false; }
    }

    function findBinding(rootView) {
        var index;
        for (index = 0; index < managedWindows.length; index += 1) {
            if (managedWindows[index].rootView === rootView) {
                return managedWindows[index];
            }
        }
        return null;
    }

    function findPrimaryBinding() {
        var index;
        for (index = managedWindows.length - 1; index >= 0; index -= 1) {
            if (managedWindows[index].role === "primary") {
                return managedWindows[index];
            }
        }
        return managedWindows.length > 0 ?
            managedWindows[managedWindows.length - 1] : null;
    }

    function activateBinding(binding) {
        if (!binding) { return false; }
        activeBinding = binding;
        state.primaryAttached = true;
        state.primaryPinned = binding.pinned === true;
        return true;
    }

    function geometryFromBinding(binding) {
        var bounds;
        var width;
        var height;
        var safeWidth;
        var safeHeight;
        var travelX;
        var travelY;
        var geometry;
        if (!binding || !binding.layoutParams) { return null; }
        bounds = safeBounds();
        width = Number(binding.layoutParams.width);
        height = Number(binding.layoutParams.height);
        safeWidth = Math.max(1, Number(bounds.right) - Number(bounds.left));
        safeHeight = Math.max(1, Number(bounds.bottom) - Number(bounds.top));
        travelX = Math.max(0, safeWidth - width);
        travelY = Math.max(0, safeHeight - height);
        geometry = copyGeometry(binding.geometry || computeGeometry("shared", {
            useSaved: false
        }));
        geometry.role = String(binding.role || "shared");
        geometry.bounds = copyBounds(bounds);
        geometry.orientation = orientationForBounds(bounds);
        geometry.x = Number(binding.layoutParams.x);
        geometry.y = Number(binding.layoutParams.y);
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

    function notifyBinding(binding, geometry, reason) {
        binding.geometry = copyGeometry(geometry);
        if (typeof binding.onGeometryChanged === "function") {
            try {
                binding.onGeometryChanged(copyGeometry(geometry),
                    String(reason || "update"));
            } catch (error) {
                state.lastError = String(error);
            }
        }
    }

    function fullScreenLayoutParams(source) {
        var params = new WindowManager.LayoutParams();
        params.copyFrom(source);
        params.width = ViewGroup.LayoutParams.MATCH_PARENT;
        params.height = ViewGroup.LayoutParams.MATCH_PARENT;
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = 0;
        params.y = 0;
        return params;
    }

    function applyPanelLayout(binding, params) {
        var panelParams;
        var width;
        var height;
        if (!binding || !binding.panelView || !params) { return false; }
        width = Math.max(1, Math.floor(Number(params.width)));
        height = Math.max(1, Math.floor(Number(params.height)));
        panelParams = binding.panelView.getLayoutParams();
        if (panelParams === null || panelParams === undefined) {
            panelParams = new FrameLayout.LayoutParams(width, height);
        } else {
            panelParams.width = width;
            panelParams.height = height;
        }
        binding.panelView.setLayoutParams(panelParams);
        binding.panelView.setX(Number(params.x || 0));
        binding.panelView.setY(Number(params.y || 0));
        try { binding.panelView.requestLayout(); } catch (ignoredLayout) {}
        return true;
    }

    function panelContainsPoint(binding, x, y) {
        var left;
        var top;
        var width;
        var height;
        if (!binding || !binding.panelView) { return true; }
        left = Number(binding.panelView.getX());
        top = Number(binding.panelView.getY());
        width = Number(binding.panelView.getWidth());
        height = Number(binding.panelView.getHeight());
        if (width <= 0 && binding.layoutParams) {
            width = Number(binding.layoutParams.width);
        }
        if (height <= 0 && binding.layoutParams) {
            height = Number(binding.layoutParams.height);
        }
        return Number(x) >= left && Number(x) < left + width &&
            Number(y) >= top && Number(y) < top + height;
    }

    function topAttachedBinding() {
        var index;
        var binding;
        for (index = managedWindows.length - 1; index >= 0; index -= 1) {
            binding = managedWindows[index];
            if (!binding || binding.attached !== true || !binding.rootView) {
                continue;
            }
            try {
                if (binding.rootView.isAttachedToWindow()) { return binding; }
            } catch (ignored) {}
        }
        return null;
    }

    function hideBindingIme(binding) {
        var manager;
        var token;
        if (!binding || !binding.rootView || appContext === null) {
            return false;
        }
        try {
            manager = appContext.getSystemService(Context.INPUT_METHOD_SERVICE);
            if (manager === null) { return false; }
            token = binding.contentView && binding.contentView.getWindowToken() ?
                binding.contentView.getWindowToken() :
                binding.rootView.getWindowToken();
            if (token === null) { return false; }
            manager.hideSoftInputFromWindow(token, 0);
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function invokeBindingDismiss(binding, reason, outside) {
        var callback = outside === true ?
            binding.onRequestOutsideDismiss : binding.onRequestBack;
        var role = String(binding.role || "shared");
        if (typeof callback === "function") {
            try { return callback(String(reason || "window_request")) !== false; }
            catch (callbackError) {
                state.lastError = String(callbackError);
                return false;
            }
        }
        if ((role === "primary" || role === "filter_overlay") &&
                ClipHub.Filter &&
                typeof ClipHub.Filter.handleBack === "function") {
            try { return ClipHub.Filter.handleBack() !== false; }
            catch (filterError) {
                state.lastError = String(filterError);
                return false;
            }
        }
        if ((role === "editor" || role === "tag_selector") &&
                ClipHub.Editor &&
                typeof ClipHub.Editor.handleBack === "function") {
            try { return ClipHub.Editor.handleBack() !== false; }
            catch (editorError) {
                state.lastError = String(editorError);
                return false;
            }
        }
        if (typeof binding.onRequestClose === "function") {
            try { return binding.onRequestClose(String(reason ||
                "window_request")) !== false; }
            catch (closeError) {
                state.lastError = String(closeError);
                return false;
            }
        }
        return false;
    }

    function requestBindingOutsideDismiss(binding, reason) {
        var visible;
        if (!binding || binding !== topAttachedBinding()) { return false; }
        visible = bindingImeVisible(binding);
        if (visible) {
            hideBindingIme(binding);
            binding.imeDismissPending = true;
            state.outsideImeDismissCount += 1;
            state.lastOutsideRole = String(binding.role || "shared");
            state.lastOutsideAction = "hide_ime";
            return true;
        }
        if (binding.imeDismissPending === true) {
            binding.imeDismissPending = false;
        }
        state.outsideDismissCount += 1;
        state.lastOutsideRole = String(binding.role || "shared");
        state.lastOutsideAction = "dismiss";
        return invokeBindingDismiss(binding,
            String(reason || "outside_tap"), true);
    }

    function installOutsideTouch(binding) {
        var gesture = {
            tracking: false,
            canceled: false,
            downX: 0,
            downY: 0
        };
        var listener;
        if (!binding || !binding.singleHost || !binding.rootView) {
            return false;
        }
        listener = new JavaAdapter(View.OnTouchListener, {
            onTouch: function (view, event) {
                var action = Number(event.getActionMasked());
                var x = Number(event.getX());
                var y = Number(event.getY());
                var dx;
                var dy;
                if (action === MotionEvent.ACTION_DOWN) {
                    if (panelContainsPoint(binding, x, y)) {
                        gesture.tracking = false;
                        gesture.canceled = false;
                        return false;
                    }
                    gesture.tracking = true;
                    gesture.canceled = false;
                    gesture.downX = x;
                    gesture.downY = y;
                    state.outsideTapCount += 1;
                    return true;
                }
                if (!gesture.tracking) { return false; }
                if (action === MotionEvent.ACTION_MOVE) {
                    dx = x - gesture.downX;
                    dy = y - gesture.downY;
                    if (Math.sqrt(dx * dx + dy * dy) > touchSlopPx) {
                        gesture.canceled = true;
                    }
                    return true;
                }
                if (action === MotionEvent.ACTION_CANCEL) {
                    gesture.tracking = false;
                    gesture.canceled = true;
                    state.outsideGestureCancelCount += 1;
                    return true;
                }
                if (action === MotionEvent.ACTION_UP) {
                    if (!gesture.canceled &&
                            !panelContainsPoint(binding, x, y)) {
                        requestBindingOutsideDismiss(binding, "outside_tap");
                    }
                    gesture.tracking = false;
                    gesture.canceled = false;
                    return true;
                }
                return true;
            }
        });
        binding.outsideTouchListener = listener;
        binding.rootView.setOnTouchListener(listener);
        return true;
    }

    function applyExternalLayout(rootView, params, reason) {
        var binding = findBinding(rootView);
        var geometry;
        if (!binding || binding.singleHost !== true || !params) {
            return false;
        }
        binding.layoutParams.width = Number(params.width);
        binding.layoutParams.height = Number(params.height);
        binding.layoutParams.gravity = Number(params.gravity);
        binding.layoutParams.x = Number(params.x);
        binding.layoutParams.y = Number(params.y);
        if (!applyPanelLayout(binding, binding.layoutParams)) { return false; }
        geometry = geometryFromBinding(binding);
        notifyBinding(binding, geometry, String(reason || "external_layout"));
        return true;
    }

    function applyGeometryToBinding(binding, geometry, reason, force) {
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
            if (binding.singleHost === true) {
                applyPanelLayout(binding, binding.layoutParams);
            }
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
            if (binding.singleHost === true) {
                applyPanelLayout(binding, binding.layoutParams);
            } else if (binding.rootView.isAttachedToWindow()) {
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

    function buildSharedGeometry(x, y, width, height, boundsOverride) {
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
        ClipHub.Theme.applyPaintColor(fillPaint, previewAccentColor());
        fillPaint.setAlpha(18);
        strokePaint.setStyle(Paint.Style.STROKE);
        strokePaint.setStrokeCap(Paint.Cap.ROUND);
        strokePaint.setStrokeJoin(Paint.Join.ROUND);
        strokePaint.setStrokeWidth(dp(1.4));
        ClipHub.Theme.applyPaintColor(strokePaint, previewAccentColor());
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
        clearResizePreviewState();
        if (manager !== null && root !== null) {
            requestViewRemoval({ manager: manager, view: root,
                role: "resize_preview", reason: "gesture_end" });
        }
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

    function currentSharedGeometry() {
        if (activeBinding) { return geometryFromBinding(activeBinding); }
        if (managedWindows.length > 0) {
            return geometryFromBinding(managedWindows[managedWindows.length - 1]);
        }
        return computeGeometry("shared", { useSaved: true });
    }

    function persistSharedGeometry(binding) {
        var geometry;
        var stored;
        var bucket;
        binding = binding || activeBinding;
        if (!binding || !ClipHub.Settings ||
                typeof ClipHub.Settings.set !== "function" ||
                typeof ClipHub.Settings.isReady !== "function" ||
                !ClipHub.Settings.isReady()) {
            return false;
        }
        geometry = geometryFromBinding(binding);
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
        stored.version = 2;
        stored[geometry.orientation] = bucket;
        try {
            ClipHub.Settings.set("windowGeometry", stored, { cleanup: false });
            state.geometryPersistCount += 1;
            state.lastPersistedGeometry = {
                version: 2,
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
            } else if (String(kind || "") === "drag_activate" &&
                    Build.VERSION.SDK_INT >= 30) {
                constant = Number(HapticFeedbackConstants.GESTURE_START);
            }
        } catch (ignoredConstant) {
            constant = Number(HapticFeedbackConstants.LONG_PRESS);
        }
        try { return view.performHapticFeedback(constant) === true; }
        catch (ignoredHaptic) { return false; }
    }

    function cancelDragActivation() {
        if (mainHandler !== null && drag.longPressRunnable !== null) {
            try { mainHandler.removeCallbacks(drag.longPressRunnable); }
            catch (ignored) {}
        }
        drag.longPressRunnable = null;
        drag.pending = false;
        state.dragPending = false;
    }

    function pendingActivationSlopPx() {
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

    function handleDragTouch(binding, view, event) {
        var action = Number(event.getActionMasked());
        var rawX = Number(event.getRawX());
        var rawY = Number(event.getRawY());
        var deltaX;
        var deltaY;
        var distanceSquared;
        var pendingLimit;
        var elapsed;
        var completed;
        activateBinding(binding);
        if (!binding || !binding.attached || binding.pinned || resize.pending ||
                resize.active) {
            return true;
        }
        if (action === MotionEvent.ACTION_DOWN) {
            if (bindingImeVisible(binding)) { return true; }
            drag.downRawX = rawX;
            drag.downRawY = rawY;
            drag.startX = Number(binding.layoutParams.x);
            drag.startY = Number(binding.layoutParams.y);
            drag.downAt = Number(event.getEventTime());
            drag.bounds = gestureBoundsSnapshot();
            drag.active = false;
            state.dragActive = false;
            scheduleDragActivation(view, binding);
            return true;
        }
        if (action === MotionEvent.ACTION_MOVE) {
            deltaX = rawX - drag.downRawX;
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
            if (drag.active && drag.binding === binding) {
                requestFrameUpdate(binding, drag.startX + deltaX,
                    drag.startY + deltaY,
                    Number(binding.layoutParams.width),
                    Number(binding.layoutParams.height), "drag_shared",
                    drag.bounds);
                state.dragMoveCount += 1;
            }
            return true;
        }
        if (action === MotionEvent.ACTION_UP ||
                action === MotionEvent.ACTION_CANCEL) {
            completed = drag.active && drag.binding === binding;
            if (completed) { flushFrameUpdate(); }
            cancelDragActivation();
            drag.active = false;
            drag.binding = null;
            drag.bounds = null;
            state.dragActive = false;
            if (completed && action === MotionEvent.ACTION_UP) {
                persistSharedGeometry(binding);
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

    function setResizeVisual(binding, active) {
        if (binding && binding.resizeVisual &&
                typeof binding.resizeVisual.setActive === "function") {
            binding.resizeVisual.setActive(active === true);
        }
    }

    function activateResizeGesture(view, binding) {
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
        if (resize.targetGeometry === null) {
            resize.targetGeometry = buildSharedGeometry(
                Number(binding.layoutParams.x),
                Number(binding.layoutParams.y),
                Number(binding.layoutParams.width),
                Number(binding.layoutParams.height), resize.bounds);
        }
        showResizePreview(binding, resize.targetGeometry);
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

    function handleResizeTouch(binding, view, event) {
        var action = Number(event.getActionMasked());
        var rawX = Number(event.getRawX());
        var rawY = Number(event.getRawY());
        var deltaX;
        var deltaY;
        var width;
        var height;
        var distanceSquared;
        var pendingLimit;
        var elapsed;
        var completed;
        activateBinding(binding);
        if (!binding || !binding.attached || binding.pinned || drag.active) {
            return true;
        }
        if (action === MotionEvent.ACTION_DOWN) {
            if (bindingImeVisible(binding)) { return true; }
            resize.downRawX = rawX;
            resize.downRawY = rawY;
            resize.startWidth = Number(binding.layoutParams.width);
            resize.startHeight = Number(binding.layoutParams.height);
            resize.downAt = Number(event.getEventTime());
            resize.bounds = gestureBoundsSnapshot();
            resize.targetGeometry = buildSharedGeometry(
                Number(binding.layoutParams.x),
                Number(binding.layoutParams.y),
                resize.startWidth, resize.startHeight, resize.bounds);
            resize.active = false;
            state.resizeActive = false;
            scheduleResizeActivation(view, binding);
            return true;
        }
        if (action === MotionEvent.ACTION_MOVE) {
            deltaX = rawX - resize.downRawX;
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
            if (resize.active && resize.binding === binding) {
                width = resize.startWidth + deltaX;
                height = resize.startHeight + deltaY;
                resize.targetGeometry = buildSharedGeometry(
                    Number(binding.layoutParams.x),
                    Number(binding.layoutParams.y), width, height,
                    resize.bounds);
                updateResizePreview(resize.targetGeometry);
                state.resizeMoveCount += 1;
            }
            return true;
        }
        if (action === MotionEvent.ACTION_UP ||
                action === MotionEvent.ACTION_CANCEL) {
            completed = resize.active && resize.binding === binding;
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
            return true;
        }
        return true;
    }

    function bindDragView(binding, view) {
        binding.dragView = view || null;
        if (binding.dragView !== null) {
            binding.dragView.setOnTouchListener(new JavaAdapter(
                View.OnTouchListener, {
                    onTouch: function (target, event) {
                        return handleDragTouch(binding, target, event);
                    }
                }));
        }
        return binding.dragView !== null;
    }

    function bindResizeView(binding, view) {
        binding.resizeView = view || null;
        if (binding.resizeView !== null) {
            binding.resizeView.setOnTouchListener(new JavaAdapter(
                View.OnTouchListener, {
                    onTouch: function (target, event) {
                        return handleResizeTouch(binding, target, event);
                    }
                }));
        }
        return binding.resizeView !== null;
    }

    function bindingImeFocusManaged(binding) {
        var role = binding ? String(binding.role || "") : "";
        return role !== "editor" && role !== "tag_selector";
    }

    function requestBindingRootFocus(binding, verifyLater) {
        var root;
        var target = null;
        var previous = -1;
        var requested = false;
        var focused = false;
        if (!binding || !binding.rootView || !binding.attached ||
                !bindingImeFocusManaged(binding)) {
            return false;
        }
        root = binding.rootView;
        try { target = root.findFocus(); }
        catch (ignoredFind) { target = null; }
        try { previous = Number(root.getDescendantFocusability()); }
        catch (ignoredPrevious) {}
        try {
            root.setFocusable(true);
            root.setFocusableInTouchMode(true);
            root.setDescendantFocusability(
                ViewGroup.FOCUS_BLOCK_DESCENDANTS);
            if (target !== null && target !== root) {
                try {
                    if (target.onCheckIsTextEditor() === true) {
                        target.clearFocus();
                    }
                } catch (ignoredEditor) {}
            }
            requested = root.requestFocus();
            focused = root.isFocused();
        } catch (focusError) {
            state.lastError = String(focusError);
        } finally {
            if (previous >= 0) {
                try { root.setDescendantFocusability(previous); }
                catch (ignoredRestore) {}
            }
        }
        if (verifyLater === true && mainHandler !== null) {
            mainHandler.postDelayed(
                new Packages.java.lang.Runnable({
                    run: function () {
                        if (!binding.attached ||
                                binding !== topAttachedBinding()) {
                            return;
                        }
                        requestBindingRootFocus(binding, false);
                    }
                }), 180);
        }
        return focused || requested;
    }

    function installImeObserver(binding) {
        var observer;
        if (!binding || !binding.rootView) { return false; }
        try {
            observer = binding.rootView.getViewTreeObserver();
            binding.imeVisible = bindingImeVisible(binding);
            binding.layoutObserver = observer;
            binding.layoutListener = new JavaAdapter(
                Packages.android.view.ViewTreeObserver.OnGlobalLayoutListener, {
                    onGlobalLayout: function () {
                        var visible = bindingImeVisible(binding);
                        var wasVisible = binding.imeVisible === true;
                        binding.imeVisible = visible;
                        if (wasVisible && !visible && binding.attached) {
                            requestBindingRootFocus(binding, true);
                            mainHandler.postDelayed(
                                new Packages.java.lang.Runnable({
                                    run: function () {
                                        if (binding.attached) {
                                            refreshWindow(binding.rootView,
                                                "ime_hidden_restore");
                                        }
                                    }
                                }), 100);
                        }
                    }
                });
            observer.addOnGlobalLayoutListener(binding.layoutListener);
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function removeImeObserver(binding) {
        try {
            if (binding && binding.layoutObserver && binding.layoutListener &&
                    binding.layoutObserver.isAlive()) {
                binding.layoutObserver.removeOnGlobalLayoutListener(
                    binding.layoutListener);
            }
        } catch (ignored) {}
        if (binding) {
            binding.layoutObserver = null;
            binding.layoutListener = null;
        }
    }

    function attachWindow(options) {
        var geometry;
        var binding;
        var prepared;
        var hostParams;
        options = options || {};
        if (!options.rootView || !options.layoutParams ||
                !options.windowManager) {
            throw new Error("Managed window binding is incomplete");
        }
        detachWindow(options.rootView);
        geometry = options.geometry || computeGeometry("shared", {
            useSaved: true
        });
        prepared = findPreparedFrame(options.rootView);
        binding = {
            id: nextManagedId,
            role: String(options.role || "shared"),
            attached: true,
            rootView: options.rootView,
            contentView: options.contentView || null,
            panelView: prepared ? prepared.panelView : null,
            singleHost: prepared !== null,
            layoutParams: options.layoutParams,
            windowLayoutParams: null,
            manager: options.windowManager,
            dragView: null,
            resizeView: null,
            resizeVisual: options.resizeVisual || null,
            onGeometryChanged: options.onGeometryChanged || null,
            onRequestClose: options.onRequestClose || null,
            onRequestBack: options.onRequestBack || null,
            onRequestOutsideDismiss: options.onRequestOutsideDismiss || null,
            geometry: copyGeometry(geometry),
            pendingSharedGeometry: null,
            pinned: options.pinned === true,
            layoutObserver: null,
            layoutListener: null,
            outsideTouchListener: null,
            imeDismissPending: false,
            imeVisible: false
        };
        if (binding.singleHost) {
            hostParams = fullScreenLayoutParams(options.layoutParams);
            binding.windowLayoutParams = hostParams;
            try {
                if (binding.rootView.isAttachedToWindow()) {
                    binding.manager.updateViewLayout(binding.rootView,
                        hostParams);
                }
            } catch (hostError) {
                state.lastError = String(hostError);
                throw hostError;
            }
            state.singleHostAttachCount += 1;
        }
        nextManagedId += 1;
        managedWindows.push(binding);
        activateBinding(binding);
        bindDragView(binding, options.dragView || null);
        bindResizeView(binding, options.resizeView || null);
        if (binding.singleHost) { installOutsideTouch(binding); }
        installImeObserver(binding);
        updateSharedLayout(binding, Number(geometry.x), Number(geometry.y),
            Number(geometry.width), Number(geometry.height), "attach_shared");
        try {
            if (ClipHub.Navigation &&
                    typeof ClipHub.Navigation.registerWindow === "function") {
                ClipHub.Navigation.registerWindow(binding.rootView,
                    binding.role);
            }
        } catch (navigationError) {
            state.lastError = String(navigationError);
        }
        return getState();
    }

    function detachWindow(rootView, options) {
        var kept = [];
        var removed = null;
        var index;
        options = options || {};
        if (!rootView) { return false; }
        for (index = 0; index < managedWindows.length; index += 1) {
            if (managedWindows[index].rootView === rootView) {
                removed = managedWindows[index];
                removed.attached = false;
                cancelFrameUpdateForBinding(removed);
                if (resizePreview.sourceBinding === removed) {
                    removeResizePreview();
                }
                removeImeObserver(removed);
                try {
                    if (removed.dragView) {
                        removed.dragView.setOnTouchListener(null);
                    }
                } catch (ignoredDrag) {}
                try {
                    if (removed.resizeView) {
                        removed.resizeView.setOnTouchListener(null);
                    }
                } catch (ignoredResize) {}
                try {
                    if (removed.rootView) {
                        removed.rootView.setOnTouchListener(null);
                    }
                } catch (ignoredOutside) {}
                if (options.preservePreparedFrame !== true) {
                    removePreparedFrame(removed.rootView);
                }
                setResizeVisual(removed, false);
            } else {
                kept.push(managedWindows[index]);
            }
        }
        managedWindows = kept;
        if (activeBinding === removed) {
            activeBinding = managedWindows.length > 0 ?
                managedWindows[managedWindows.length - 1] : null;
        }
        state.primaryAttached = activeBinding !== null;
        state.primaryPinned = activeBinding !== null &&
            activeBinding.pinned === true;
        if (options.preservePreparedFrame !== true) {
            removePreparedFrame(rootView);
        }
        return removed !== null;
    }

    function installPrimaryWindow(options) {
        options = options || {};
        options.role = "primary";
        return attachWindow(options);
    }

    function detachPrimaryWindow() {
        var binding = findPrimaryBinding();
        return binding ? detachWindow(binding.rootView) : false;
    }

    function setWindowDragView(rootView, view) {
        var binding = findBinding(rootView);
        return binding ? bindDragView(binding, view) : false;
    }

    function setWindowResizeView(rootView, view, resizeVisual) {
        var binding = findBinding(rootView);
        if (!binding) { return false; }
        if (resizeVisual) { binding.resizeVisual = resizeVisual; }
        return bindResizeView(binding, view);
    }

    function setPrimaryDragView(view) {
        var binding = findPrimaryBinding();
        return binding ? bindDragView(binding, view) : false;
    }

    function setPrimaryResizeView(view) {
        var binding = findPrimaryBinding();
        return binding ? bindResizeView(binding, view) : false;
    }

    function setPrimaryPinned(value) {
        var binding = findPrimaryBinding();
        if (!binding) { return false; }
        binding.pinned = value === true;
        state.primaryPinned = binding.pinned;
        return binding.pinned;
    }

    function refreshWindow(rootView, reason) {
        var binding = findBinding(rootView);
        var geometry;
        if (!binding) { return false; }
        geometry = currentSharedGeometry();
        return applyGeometryToBinding(binding, geometry,
            String(reason || "refresh_window"), true);
    }

    function refreshPrimaryBounds(reason) {
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
        if (isMainThread()) {
            return refreshPrimaryBounds(reason);
        }
        return requireMainResult(runOnMainSync(function () {
            return refreshPrimaryBounds(reason);
        }, 3000));
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
        var binding = activeBinding;
        options = options || {};
        if (!binding || !binding.layoutParams) { return false; }
        updateSharedLayout(binding, x, y,
            Number(binding.layoutParams.width),
            Number(binding.layoutParams.height), "api_move");
        if (options.persist === true) { persistSharedGeometry(binding); }
        return true;
    }

    function moveBy(dx, dy, options) {
        var binding = activeBinding;
        if (!binding || !binding.layoutParams) { return false; }
        return moveTo(Number(binding.layoutParams.x) + Number(dx || 0),
            Number(binding.layoutParams.y) + Number(dy || 0), options);
    }

    function requestClose(reason) {
        var binding = topAttachedBinding() || activeBinding;
        if (!binding || typeof binding.onRequestClose !== "function") {
            return false;
        }
        try { return binding.onRequestClose(String(reason || "window_service")); }
        catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function requestBack(reason) {
        var binding = topAttachedBinding() || activeBinding;
        if (!binding) { return false; }
        return invokeBindingDismiss(binding,
            String(reason || "system_back"), false);
    }

    function requestOutsideDismiss(reason) {
        var binding = topAttachedBinding() || activeBinding;
        return requestBindingOutsideDismiss(binding,
            String(reason || "outside_tap"));
    }

    function getState() {
        var geometry = currentSharedGeometry();
        var thread = nowThread();
        var roles = [];
        var index;
        for (index = 0; index < managedWindows.length; index += 1) {
            roles.push(String(managedWindows[index].role || "shared"));
        }
        return {
            geometryService: true,
            sharedGeometryService: true,
            legacyHomeRemoved: true,
            attached: managedWindows.length > 0,
            attachedToWindow: activeBinding !== null &&
                activeBinding.rootView !== null ?
                activeBinding.rootView.isAttachedToWindow() : false,
            primaryAttached: findPrimaryBinding() !== null,
            primaryPinned: activeBinding !== null && activeBinding.pinned === true,
            moving: drag.active,
            dragPending: drag.pending,
            resizing: resize.active,
            resizePending: resize.pending,
            resizeCorner: "bottom_right",
            geometry: copyGeometry(geometry),
            safeBounds: copyBounds(state.safeBounds),
            orientation: state.orientation,
            managedWindowCount: managedWindows.length,
            managedWindowRoles: roles,
            activeRole: activeBinding ? String(activeBinding.role) : null,
            dragActivateCount: Number(state.dragActivateCount),
            dragMoveCount: Number(state.dragMoveCount),
            resizeActivateCount: Number(state.resizeActivateCount),
            resizeMoveCount: Number(state.resizeMoveCount),
            resizePreviewEnabled: state.resizePreviewEnabled === true,
            resizeLiveLayoutEnabled: state.resizeLiveLayoutEnabled === true,
            resizePreviewAttached: state.resizePreviewAttached === true,
            resizePreviewShowCount: Number(state.resizePreviewShowCount),
            resizePreviewUpdateCount: Number(state.resizePreviewUpdateCount),
            resizePreviewCloseCount: Number(state.resizePreviewCloseCount),
            resizeCommitCount: Number(state.resizeCommitCount),
            geometryComputeCount: Number(state.geometryComputeCount),
            geometryPersistCount: Number(state.geometryPersistCount),
            geometryBroadcastCount: Number(state.geometryBroadcastCount),
            frameCoalescingEnabled: state.frameCoalescingEnabled === true,
            frameUpdateScheduled: state.frameUpdateScheduled === true,
            frameUpdateRequestCount: Number(state.frameUpdateRequestCount),
            frameUpdateApplyCount: Number(state.frameUpdateApplyCount),
            frameUpdateCoalescedCount:
                Number(state.frameUpdateCoalescedCount),
            frameUpdateSkippedCount: Number(state.frameUpdateSkippedCount),
            lastFrameUpdateReason: state.lastFrameUpdateReason,
            boundsRefreshCount: Number(state.boundsRefreshCount),
            configurationChangeCount:
                Number(state.configurationChangeCount),
            displayChangeCount: Number(state.displayChangeCount),
            componentCallbacksRegistered:
                state.componentCallbacksRegistered === true,
            displayListenerRegistered:
                state.displayListenerRegistered === true,
            singleHostEnabled: true,
            singleHostAttachCount: Number(state.singleHostAttachCount),
            outsideTapCount: Number(state.outsideTapCount),
            outsideImeDismissCount: Number(state.outsideImeDismissCount),
            outsideDismissCount: Number(state.outsideDismissCount),
            outsideGestureCancelCount:
                Number(state.outsideGestureCancelCount),
            lastOutsideRole: state.lastOutsideRole,
            lastOutsideAction: state.lastOutsideAction,
            safeRemoveRequestCount: Number(state.safeRemoveRequestCount),
            safeRemoveQueuedCount: Number(state.safeRemoveQueuedCount),
            safeRemoveCompleteCount: Number(state.safeRemoveCompleteCount),
            safeRemoveAlreadyDetachedCount:
                Number(state.safeRemoveAlreadyDetachedCount),
            safeRemoveFailureCount: Number(state.safeRemoveFailureCount),
            safeRemoveTimeoutCount: Number(state.safeRemoveTimeoutCount),
            pendingSafeRemoveCount: Number(state.pendingSafeRemoveCount),
            lastSafeRemoveRole: state.lastSafeRemoveRole,
            lastSafeRemoveReason: state.lastSafeRemoveReason,
            lastSafeRemoveError: state.lastSafeRemoveError,
            lastBoundsReason: state.lastBoundsReason,
            lastPersistedGeometry: state.lastPersistedGeometry,
            stateThreadId: thread.id,
            stateThreadName: thread.name,
            lastError: state.lastError
        };
    }

    ClipHub.Window = {
        MODULE_NAME: "ch_08_window",
        MODULE_VERSION: 19,
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
            managedWindows = [];
            preparedFrames = [];
            pendingSafeRemovals = [];
            activeBinding = null;
            clearFrameUpdate();
            clearResizePreviewState();
            resize.targetGeometry = null;
            state.frameUpdateRequestCount = 0;
            state.frameUpdateApplyCount = 0;
            state.frameUpdateCoalescedCount = 0;
            state.frameUpdateSkippedCount = 0;
            state.lastFrameUpdateReason = "";
            state.safeBounds = safeBounds();
            state.orientation = orientationForBounds(state.safeBounds);
            registerObservers();
            return {
                ok: true,
                initialized: true,
                geometryService: true,
                sharedGeometryService: true,
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
        createManagedFrame: createManagedFrame,
        attachWindow: attachWindow,
        detachWindow: detachWindow,
        refreshWindow: refreshWindow,
        applyExternalLayout: applyExternalLayout,
        requestBack: requestBack,
        requestOutsideDismiss: requestOutsideDismiss,
        requestViewRemoval: requestViewRemoval,
        isMainThread: isMainThread,
        getRemovalState: getRemovalState,
        getTopRole: function () {
            var binding = topAttachedBinding();
            return binding ? String(binding.role || "shared") : null;
        },
        setWindowDragView: setWindowDragView,
        setWindowResizeView: setWindowResizeView,
        installPrimaryWindow: installPrimaryWindow,
        detachPrimaryWindow: detachPrimaryWindow,
        setPrimaryDragView: setPrimaryDragView,
        setPrimaryResizeView: setPrimaryResizeView,
        setPrimaryPinned: setPrimaryPinned,
        refreshPrimaryBounds: refreshPrimaryBoundsSafe,
        persistPrimaryGeometry: persistSharedGeometry,
        persistSharedGeometry: persistSharedGeometry,
        performHaptic: performHaptic,
        isMoving: function () { return drag.active === true; },
        isResizing: function () { return resize.active === true; },
        isAttached: function () { return managedWindows.length > 0; },
        moveTo: moveTo,
        moveBy: moveBy,
        refreshBounds: refreshPrimaryBoundsSafe,
        persistPosition: persistSharedGeometry,
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
            var snapshot = managedWindows.slice(0);
            var index;
            cancelDragActivation();
            cancelResizeActivation();
            removeResizePreview();
            clearFrameUpdate();
            for (index = 0; index < snapshot.length; index += 1) {
                detachWindow(snapshot[index].rootView);
                requestViewRemoval({
                    manager: snapshot[index].manager,
                    view: snapshot[index].rootView,
                    role: snapshot[index].role,
                    reason: "window_shutdown"
                });
            }
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
