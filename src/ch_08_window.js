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
    var FrameLayout = Packages.android.widget.FrameLayout;
    var Paint = Packages.android.graphics.Paint;
    var Path = Packages.android.graphics.Path;
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
    var nextManagedId = 1;
    var activeBinding = null;

    var drag = {
        binding: null,
        downRawX: 0,
        downRawY: 0,
        startX: 0,
        startY: 0,
        downAt: 0,
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
        geometryComputeCount: 0,
        geometryPersistCount: 0,
        geometryBroadcastCount: 0,
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

    function parseColor(value, fallback) {
        try { return Number(Color.parseColor(String(value))); }
        catch (ignored) {
            try { return Number(Color.parseColor(String(fallback))); }
            catch (ignoredFallback) { return Number(Color.WHITE); }
        }
    }

    function createResizeVisual(colorText) {
        var visual = { active: false, alpha: 1 };
        var paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        var drawable;
        var view;
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint["setColor(int)"](parseColor(colorText, "#7C5CFC"));
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

    function createManagedFrame(contentView, options) {
        var root;
        var contentParams;
        var dragView;
        var dragParams;
        var resizeVisual;
        var resizeParams;
        options = options || {};
        if (contentView === null || contentView === undefined) {
            throw new Error("Managed window content view is required");
        }
        root = new FrameLayout(appContext);
        root.setClipChildren(false);
        root.setClipToPadding(false);
        contentParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT);
        root.addView(contentView, contentParams);
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
        root.addView(dragView, dragParams);
        resizeVisual = createResizeVisual(options.accentColor || "#7C5CFC");
        resizeParams = new FrameLayout.LayoutParams(dp(40), dp(40));
        resizeParams.gravity = Gravity.END | Gravity.BOTTOM;
        root.addView(resizeVisual.view, resizeParams);
        return {
            rootView: root,
            contentView: contentView,
            dragView: dragView,
            resizeView: resizeVisual.view,
            resizeVisual: resizeVisual
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

    function applyGeometryToBinding(binding, geometry, reason, force) {
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

    function updateSharedLayout(sourceBinding, x, y, width, height, reason) {
        var bounds;
        var policy = sharedPolicy();
        var safeWidth;
        var safeHeight;
        var minWidth;
        var minHeight;
        var maxWidth;
        var maxHeight;
        var maxX;
        var maxY;
        var geometry;
        var index;
        var applied = 0;
        if (!sourceBinding || !sourceBinding.layoutParams) { return false; }
        activateBinding(sourceBinding);
        bounds = safeBounds();
        safeWidth = Math.max(1, Number(bounds.right) - Number(bounds.left));
        safeHeight = Math.max(1, Number(bounds.bottom) - Number(bounds.top));
        minWidth = Math.min(dp(policy.minWidthDp), safeWidth);
        minHeight = Math.min(dp(policy.minHeightDp), safeHeight);
        maxWidth = Math.min(dp(policy.maxWidthDp), safeWidth);
        maxHeight = Math.min(dp(policy.maxHeightDp), safeHeight);
        width = clamp(Number(width), minWidth, maxWidth);
        height = clamp(Number(height), minHeight, maxHeight);
        maxX = Math.max(Number(bounds.left), Number(bounds.right) - width);
        maxY = Math.max(Number(bounds.top), Number(bounds.bottom) - height);
        x = clamp(Number(x), Number(bounds.left), maxX);
        y = clamp(Number(y), Number(bounds.top), maxY);
        geometry = {
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
        state.safeBounds = copyBounds(bounds);
        state.orientation = geometry.orientation;
        state.geometryBroadcastCount += applied;
        return applied > 0;
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
                updateSharedLayout(binding, drag.startX + deltaX,
                    drag.startY + deltaY,
                    Number(binding.layoutParams.width),
                    Number(binding.layoutParams.height), "drag_shared");
                state.dragMoveCount += 1;
            }
            return true;
        }
        if (action === MotionEvent.ACTION_UP ||
                action === MotionEvent.ACTION_CANCEL) {
            completed = drag.active && drag.binding === binding;
            cancelDragActivation();
            drag.active = false;
            drag.binding = null;
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
                updateSharedLayout(binding, Number(binding.layoutParams.x),
                    Number(binding.layoutParams.y), width, height,
                    "resize_bottom_right_shared");
                state.resizeMoveCount += 1;
            }
            return true;
        }
        if (action === MotionEvent.ACTION_UP ||
                action === MotionEvent.ACTION_CANCEL) {
            completed = resize.active && resize.binding === binding;
            cancelResizeActivation();
            resize.active = false;
            resize.binding = null;
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
        options = options || {};
        if (!options.rootView || !options.layoutParams ||
                !options.windowManager) {
            throw new Error("Managed window binding is incomplete");
        }
        detachWindow(options.rootView);
        geometry = options.geometry || computeGeometry("shared", {
            useSaved: true
        });
        binding = {
            id: nextManagedId,
            role: String(options.role || "shared"),
            attached: true,
            rootView: options.rootView,
            contentView: options.contentView || null,
            layoutParams: options.layoutParams,
            manager: options.windowManager,
            dragView: null,
            resizeView: null,
            resizeVisual: options.resizeVisual || null,
            onGeometryChanged: options.onGeometryChanged || null,
            onRequestClose: options.onRequestClose || null,
            geometry: copyGeometry(geometry),
            pendingSharedGeometry: null,
            pinned: options.pinned === true,
            layoutObserver: null,
            layoutListener: null,
            imeVisible: false
        };
        nextManagedId += 1;
        managedWindows.push(binding);
        activateBinding(binding);
        bindDragView(binding, options.dragView || null);
        bindResizeView(binding, options.resizeView || null);
        installImeObserver(binding);
        updateSharedLayout(binding, Number(geometry.x), Number(geometry.y),
            Number(geometry.width), Number(geometry.height), "attach_shared");
        return getState();
    }

    function detachWindow(rootView) {
        var kept = [];
        var removed = null;
        var index;
        if (!rootView) { return false; }
        for (index = 0; index < managedWindows.length; index += 1) {
            if (managedWindows[index].rootView === rootView) {
                removed = managedWindows[index];
                removed.attached = false;
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
        var currentLooper = Looper.myLooper();
        if (currentLooper !== null && currentLooper === Looper.getMainLooper()) {
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
        var binding = activeBinding || (managedWindows.length > 0 ?
            managedWindows[managedWindows.length - 1] : null);
        if (!binding || typeof binding.onRequestClose !== "function") {
            return false;
        }
        try { return binding.onRequestClose(String(reason || "window_service")); }
        catch (error) {
            state.lastError = String(error);
            return false;
        }
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
            geometryComputeCount: Number(state.geometryComputeCount),
            geometryPersistCount: Number(state.geometryPersistCount),
            geometryBroadcastCount: Number(state.geometryBroadcastCount),
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
        MODULE_VERSION: 13,
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
            activeBinding = null;
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
            for (index = 0; index < snapshot.length; index += 1) {
                detachWindow(snapshot[index].rootView);
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
