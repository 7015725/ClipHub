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
    var WindowManager = Packages.android.view.WindowManager;
    var WindowInsets = Packages.android.view.WindowInsets;
    var ViewConfiguration = Packages.android.view.ViewConfiguration;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var TextView = Packages.android.widget.TextView;
    var TypedValue = Packages.android.util.TypedValue;
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
    var rootView = null;
    var titleBar = null;
    var dragHandle = null;
    var contentView = null;
    var statusView = null;
    var closeView = null;
    var layoutParams = null;
    var desiredWidthPx = 0;
    var desiredHeightPx = 0;
    var normalHeightPx = 0;
    var collapsedHeightPx = 0;
    var touchSlopPx = 0;
    var metrics = {};
    var drag = {
        downRawX: 0,
        downRawY: 0,
        startX: 0,
        startY: 0,
        active: false
    };
    var state = {
        attached: false,
        collapsed: false,
        pinned: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        safeBounds: { left: 0, top: 0, right: 0, bottom: 0 },
        positionRatios: { xRatio: 0.5, yRatio: 1 },
        savedPosition: null,
        windowType: null,
        openCount: 0,
        closeCount: 0,
        updateCount: 0,
        dragMoveCount: 0,
        persistenceWriteCount: 0,
        boundsRefreshCount: 0,
        configurationChangeCount: 0,
        displayChangeCount: 0,
        contentReplaceCount: 0,
        contentMode: "status",
        dragListenerInstalled: false,
        componentCallbacksRegistered: false,
        displayListenerRegistered: false,
        addThreadId: null,
        addThreadName: null,
        updateThreadId: null,
        updateThreadName: null,
        removeThreadId: null,
        removeThreadName: null,
        statusText: "",
        lastBoundsReason: "",
        sheetStyle: "bottom_sheet",
        dragHandlePresent: false,
        dimAmount: 0.38,
        contentTopInsetDp: 24,
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
            return { ok: false, error: new Error("Window main handler post failed") };
        }
        completed = latch.await(Number(timeoutMs || 2500), TimeUnit.MILLISECONDS);
        if (!completed) {
            try { mainHandler.removeCallbacks(runnable); } catch (ignored) {}
            return { ok: false, error: new Error("Window main handler timeout") };
        }
        return box;
    }

    function requireMainResult(result) {
        if (!result || result.ok !== true) {
            throw result && result.error ? result.error :
                new Error("Window main-thread operation failed");
        }
        return result.value;
    }

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function palette() {
        if (ClipHub.Theme && typeof ClipHub.Theme.getPalette === "function") {
            return ClipHub.Theme.getPalette(appContext || androidContext);
        }
        return {
            dark: false,
            sheet: "#FFF9F8FF",
            surfaceMuted: "#FFF5F3FB",
            stroke: "#FFE5E0EF",
            textSecondary: "#FF6F697A"
        };
    }

    function themeMetrics() {
        if (ClipHub.Theme && typeof ClipHub.Theme.getMetrics === "function") {
            return ClipHub.Theme.getMetrics();
        }
        return {
            sheetRadiusDp: 26,
            dragHandleWidthDp: 42,
            dragHandleHeightDp: 4,
            dragHandleTopDp: 8,
            dragHandleBottomDp: 7,
            screenPaddingDp: 12
        };
    }

    function roundedBackground(fill, stroke, radiusDp) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        ClipHub.Theme.applyGradientColor(drawable, fill);
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke !== null && stroke !== undefined) {
            ClipHub.Theme.applyGradientStroke(drawable, dp(1), stroke);
        }
        return drawable;
    }

    function resourceDimension(name) {
        var resources;
        var id;
        if (androidContext === null) { return 0; }
        try {
            resources = androidContext.getResources();
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
            displayMetrics = androidContext.getResources().getDisplayMetrics();
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

    function clamp(value, minimum, maximum) {
        value = Number(value);
        if (!isFinite(value)) { value = minimum; }
        if (maximum < minimum) { return minimum; }
        if (value < minimum) { return minimum; }
        if (value > maximum) { return maximum; }
        return value;
    }

    function clamp01(value) { return clamp(Number(value), 0, 1); }

    function clampPosition(x, y, width, height, bounds) {
        return {
            x: Math.floor(clamp(x, bounds.left, bounds.right - width)),
            y: Math.floor(clamp(y, bounds.top, bounds.bottom - height))
        };
    }

    function ratiosForPosition(x, y, width, height, bounds) {
        var travelX = Math.max(0, Number(bounds.right) - Number(bounds.left) - width);
        var travelY = Math.max(0, Number(bounds.bottom) - Number(bounds.top) - height);
        return {
            xRatio: travelX > 0 ?
                clamp01((Number(x) - Number(bounds.left)) / travelX) : 0.5,
            yRatio: travelY > 0 ?
                clamp01((Number(y) - Number(bounds.top)) / travelY) : 1
        };
    }

    function positionForRatios(ratios, width, height, bounds) {
        var travelX = Math.max(0, Number(bounds.right) - Number(bounds.left) - width);
        var travelY = Math.max(0, Number(bounds.bottom) - Number(bounds.top) - height);
        return clampPosition(
            Number(bounds.left) + travelX * clamp01(ratios.xRatio),
            Number(bounds.top) + travelY * clamp01(ratios.yRatio),
            width, height, bounds
        );
    }

    function copyPosition(value) {
        if (!value || typeof value !== "object") { return null; }
        return { xRatio: clamp01(value.xRatio), yRatio: clamp01(value.yRatio) };
    }

    function readSavedPosition() {
        var value = null;
        try {
            if (ClipHub.Settings && typeof ClipHub.Settings.get === "function") {
                value = ClipHub.Settings.get("windowPosition", null);
            }
        } catch (ignored) {}
        state.savedPosition = copyPosition(value);
        return copyPosition(state.savedPosition);
    }

    function persistCurrentPosition() {
        var ratios;
        if (!state.attached || !ClipHub.Settings ||
                typeof ClipHub.Settings.set !== "function" ||
                typeof ClipHub.Settings.isReady !== "function" ||
                !ClipHub.Settings.isReady()) {
            return false;
        }
        ratios = ratiosForPosition(
            state.x, state.y, state.width, currentHeight(), state.safeBounds
        );
        try {
            ClipHub.Settings.set("windowPosition", ratios, { cleanup: false });
            state.savedPosition = copyPosition(ratios);
            state.positionRatios = copyPosition(ratios);
            state.persistenceWriteCount += 1;
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function makeText(text, sizeSp, color, bold) {
        var view = new TextView(appContext || androidContext);
        view.setText(String(text));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, Number(sizeSp));
        ClipHub.Theme.applyTextColor(view, color);
        view.setIncludeFontPadding(false);
        if (bold) {
            view.setTypeface(Packages.android.graphics.Typeface.DEFAULT,
                Packages.android.graphics.Typeface.BOLD);
        }
        return view;
    }

    function currentHeight() {
        return state.collapsed ? collapsedHeightPx : normalHeightPx;
    }

    function fitDimensions(bounds) {
        var safeWidth = Math.max(1, bounds.right - bounds.left);
        var safeHeight = Math.max(1, bounds.bottom - bounds.top);
        state.width = Math.min(Math.max(1, desiredWidthPx), safeWidth);
        normalHeightPx = Math.min(Math.max(1, desiredHeightPx), safeHeight);
        collapsedHeightPx = Math.min(dp(28), normalHeightPx);
        state.height = currentHeight();
    }

    function updatePositionOnMain(x, y, countDrag) {
        var bounds;
        var position;
        var thread;
        if (!state.attached || layoutParams === null || rootView === null) {
            state.x = Math.floor(Number(x || 0));
            state.y = Math.floor(Number(y || 0));
            return getState();
        }
        bounds = safeBounds();
        fitDimensions(bounds);
        position = clampPosition(x, y, state.width, currentHeight(), bounds);
        layoutParams.width = state.width;
        layoutParams.height = currentHeight();
        layoutParams.x = position.x;
        layoutParams.y = position.y;
        windowManager.updateViewLayout(rootView, layoutParams);
        state.safeBounds = bounds;
        state.x = position.x;
        state.y = position.y;
        state.height = currentHeight();
        state.positionRatios = ratiosForPosition(
            state.x, state.y, state.width, state.height, bounds
        );
        state.updateCount += 1;
        if (countDrag) { state.dragMoveCount += 1; }
        thread = nowThread();
        state.updateThreadId = thread.id;
        state.updateThreadName = thread.name;
        return getState();
    }

    function refreshBoundsOnMain(reason) {
        var oldBounds = state.safeBounds;
        var ratios;
        var bounds;
        var position;
        var thread;
        if (!state.attached || layoutParams === null || rootView === null) {
            state.safeBounds = safeBounds();
            state.lastBoundsReason = String(reason || "refresh");
            return getState();
        }
        ratios = ratiosForPosition(
            state.x, state.y, state.width, currentHeight(), oldBounds
        );
        bounds = safeBounds();
        fitDimensions(bounds);
        position = positionForRatios(ratios, state.width, currentHeight(), bounds);
        layoutParams.width = state.width;
        layoutParams.height = currentHeight();
        layoutParams.x = position.x;
        layoutParams.y = position.y;
        windowManager.updateViewLayout(rootView, layoutParams);
        state.safeBounds = bounds;
        state.x = position.x;
        state.y = position.y;
        state.height = currentHeight();
        state.positionRatios = ratiosForPosition(
            state.x, state.y, state.width, state.height, bounds
        );
        state.boundsRefreshCount += 1;
        state.updateCount += 1;
        state.lastBoundsReason = String(reason || "refresh");
        thread = nowThread();
        state.updateThreadId = thread.id;
        state.updateThreadName = thread.name;
        return getState();
    }

    function scheduleBoundsRefresh(reason) {
        if (mainHandler === null) { return false; }
        pendingRefreshReason = String(reason || "configuration");
        if (refreshRunnable === null) {
            refreshRunnable = new Packages.java.lang.Runnable({
                run: function () {
                    var reasonValue = pendingRefreshReason;
                    pendingRefreshReason = "";
                    if (!state.attached) { return; }
                    try { refreshBoundsOnMain(reasonValue); }
                    catch (error) { state.lastError = String(error); }
                }
            });
        }
        try { mainHandler.removeCallbacks(refreshRunnable); } catch (ignored) {}
        return mainHandler.postDelayed(refreshRunnable, 180);
    }

    function handleTitleTouch(view, event) {
        var action = Number(event.getActionMasked());
        var rawX = Number(event.getRawX());
        var rawY = Number(event.getRawY());
        var deltaX;
        var deltaY;
        var completedDrag;
        if (state.pinned) { return true; }
        if (action === MotionEvent.ACTION_DOWN) {
            drag.downRawX = rawX;
            drag.downRawY = rawY;
            drag.startX = state.x;
            drag.startY = state.y;
            drag.active = false;
            return true;
        }
        if (action === MotionEvent.ACTION_MOVE) {
            deltaX = rawX - drag.downRawX;
            deltaY = rawY - drag.downRawY;
            if (!drag.active && Math.abs(deltaX) + Math.abs(deltaY) >= touchSlopPx) {
                drag.active = true;
            }
            if (drag.active) {
                updatePositionOnMain(drag.startX + deltaX,
                    drag.startY + deltaY, true);
            }
            return true;
        }
        if (action === MotionEvent.ACTION_UP ||
                action === MotionEvent.ACTION_CANCEL) {
            completedDrag = drag.active;
            drag.active = false;
            if (completedDrag) { persistCurrentPosition(); }
            return true;
        }
        return true;
    }

    function showStatusOnMain(text) {
        var colors = palette();
        if (contentView === null) { return false; }
        contentView.removeAllViews();
        statusView = makeText(text, 13, colors.textSecondary, false);
        statusView.setGravity(Gravity.TOP | Gravity.START);
        statusView.setLineSpacing(0, 1.12);
        statusView.setPadding(dp(4), dp(8), dp(4), dp(4));
        contentView.addView(statusView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        state.statusText = String(text);
        state.contentMode = "status";
        state.contentReplaceCount += 1;
        return true;
    }

    function replaceContentOnMain(view) {
        if (contentView === null || view === null || view === undefined) {
            throw new Error("Window content host is unavailable");
        }
        contentView.removeAllViews();
        statusView = null;
        contentView.addView(view, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.MATCH_PARENT));
        state.contentMode = "custom";
        state.contentReplaceCount += 1;
        return true;
    }

    function buildView(options) {
        var colors = palette();
        var handleHost;
        var handleParams;
        var contentParams;

        metrics = themeMetrics();
        rootView = new FrameLayout(appContext || androidContext);
        rootView.setBackground(roundedBackground(colors.sheet,
            colors.stroke, Number(metrics.sheetRadiusDp || 26)));
        if (Build.VERSION.SDK_INT >= 21) { rootView.setElevation(dp(20)); }

        handleHost = new FrameLayout(appContext || androidContext);
        titleBar = handleHost;
        dragHandle = new View(appContext || androidContext);
        dragHandle.setBackground(roundedBackground(colors.strokeStrong,
            null, 3));
        handleParams = new FrameLayout.LayoutParams(
            dp(Number(metrics.dragHandleWidthDp || 42)),
            dp(Number(metrics.dragHandleHeightDp || 4)));
        handleParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        handleParams.topMargin = dp(Number(metrics.dragHandleTopDp || 8));
        handleHost.addView(dragHandle, handleParams);
        rootView.addView(handleHost, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, collapsedHeightPx));

        contentView = new LinearLayout(appContext || androidContext);
        contentView.setOrientation(LinearLayout.VERTICAL);
        contentView.setPadding(dp(12), 0, dp(12), dp(10));
        contentParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT);
        contentParams.topMargin = collapsedHeightPx;
        rootView.addView(contentView, contentParams);

        titleBar.setOnTouchListener(new JavaAdapter(View.OnTouchListener, {
            onTouch: handleTitleTouch
        }));
        state.dragListenerInstalled = true;
        state.dragHandlePresent = true;
        showStatusOnMain(options.statusText || "正在加载剪贴板历史");
    }

    function createLayoutParams(options) {
        var widthDp = Number(options.widthDp || 340);
        var heightDp = Number(options.heightDp || 500);
        var bounds = safeBounds();
        var saved;
        var position;
        var type = Build.VERSION.SDK_INT >= 26 ?
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
            WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
        var margin = dp(Number(themeMetrics().screenPaddingDp || 12));
        desiredWidthPx = dp(Math.max(240, widthDp));
        desiredHeightPx = dp(Math.max(180, heightDp));
        fitDimensions(bounds);
        state.safeBounds = bounds;
        saved = readSavedPosition();
        if (options.x !== undefined || options.y !== undefined) {
            position = clampPosition(
                options.x === undefined ?
                    bounds.left + (bounds.right - bounds.left - state.width) / 2 :
                    Number(options.x),
                options.y === undefined ?
                    bounds.bottom - state.height - margin : Number(options.y),
                state.width, state.height, bounds
            );
        } else if (saved !== null) {
            position = positionForRatios(saved, state.width, state.height, bounds);
        } else {
            position = clampPosition(
                bounds.left + (bounds.right - bounds.left - state.width) / 2,
                bounds.bottom - state.height - margin,
                state.width, state.height, bounds
            );
        }
        state.x = position.x;
        state.y = position.y;
        state.positionRatios = ratiosForPosition(
            state.x, state.y, state.width, state.height, bounds
        );
        state.windowType = Number(type);
        layoutParams = new WindowManager.LayoutParams(
            state.width,
            state.height,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
                WindowManager.LayoutParams.FLAG_DIM_BEHIND,
            PixelFormat.TRANSLUCENT
        );
        layoutParams.gravity = Gravity.TOP | Gravity.START;
        layoutParams.x = state.x;
        layoutParams.y = state.y;
        layoutParams.dimAmount = Number(options.dimAmount || state.dimAmount);
        state.dimAmount = Number(layoutParams.dimAmount);
        layoutParams.softInputMode =
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING;
        try { layoutParams.setTitle("ClipHub Window"); } catch (ignoredTitle) {}
        if (Build.VERSION.SDK_INT >= 28) {
            layoutParams.layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
        }
    }

    function open(options) {
        var result;
        options = options || {};
        if (state.attached) {
            return { ok: true, attached: true, reused: true, state: getState() };
        }
        result = runOnMainSync(function () {
            var thread;
            try {
                createLayoutParams(options);
                buildView(options);
                if (state.collapsed && contentView !== null) {
                    contentView.setVisibility(View.GONE);
                }
                windowManager.addView(rootView, layoutParams);
                state.attached = true;
                state.openCount += 1;
                state.lastError = null;
                thread = nowThread();
                state.addThreadId = thread.id;
                state.addThreadName = thread.name;
                return { ok: true, attached: true, reused: false,
                    state: getState() };
            } catch (error) {
                state.lastError = String(error);
                state.attached = false;
                rootView = null;
                titleBar = null;
                dragHandle = null;
                contentView = null;
                statusView = null;
                closeView = null;
                layoutParams = null;
                throw error;
            }
        }, 3000);
        return requireMainResult(result);
    }

    function close() {
        var result;
        if (!state.attached && rootView === null) {
            return { ok: true, attached: false, alreadyClosed: true,
                state: getState() };
        }
        result = runOnMainSync(function () {
            var thread = nowThread();
            var removed = false;
            try {
                if (rootView !== null) {
                    try {
                        windowManager.removeViewImmediate(rootView);
                        removed = true;
                    } catch (error) {
                        if (rootView.isAttachedToWindow()) { throw error; }
                    }
                }
                if (removed || state.attached) { state.closeCount += 1; }
                state.attached = false;
                state.removeThreadId = thread.id;
                state.removeThreadName = thread.name;
                state.lastError = null;
                return { ok: true, attached: false, alreadyClosed: false };
            } finally {
                rootView = null;
                titleBar = null;
                dragHandle = null;
                contentView = null;
                statusView = null;
                closeView = null;
                layoutParams = null;
                drag.active = false;
                state.contentMode = "status";
                state.dragHandlePresent = false;
            }
        }, 3000);
        requireMainResult(result);
        return { ok: true, attached: false, alreadyClosed: false,
            state: getState() };
    }

    function setCollapsed(value) {
        var collapsed = value === true;
        state.collapsed = collapsed;
        if (!state.attached) { return collapsed; }
        requireMainResult(runOnMainSync(function () {
            if (contentView !== null) {
                contentView.setVisibility(collapsed ? View.GONE : View.VISIBLE);
            }
            updatePositionOnMain(state.x, state.y, false);
            return true;
        }, 2500));
        return collapsed;
    }

    function setPinned(value) {
        state.pinned = value === true;
        return state.pinned;
    }

    function moveTo(x, y, options) {
        var result;
        options = options || {};
        if (!state.attached) {
            state.x = Math.floor(Number(x || 0));
            state.y = Math.floor(Number(y || 0));
            return getState();
        }
        result = requireMainResult(runOnMainSync(function () {
            return updatePositionOnMain(x, y, false);
        }, 2500));
        if (options.persist === true) { persistCurrentPosition(); }
        return result;
    }

    function moveBy(dx, dy, options) {
        return moveTo(state.x + Number(dx || 0),
            state.y + Number(dy || 0), options);
    }

    function refreshBounds(reason) {
        return requireMainResult(runOnMainSync(function () {
            return refreshBoundsOnMain(reason || "manual");
        }, 2500));
    }

    function setStatusText(value) {
        var text = String(value === null || value === undefined ? "" : value);
        state.statusText = text;
        if (state.attached && contentView !== null) {
            requireMainResult(runOnMainSync(function () {
                if (state.contentMode === "status" && statusView !== null) {
                    statusView.setText(text);
                    return true;
                }
                return showStatusOnMain(text);
            }, 2500));
        }
        return text;
    }

    function setContentView(view) {
        if (!state.attached) { throw new Error("Window is not open"); }
        return requireMainResult(runOnMainSync(function () {
            return replaceContentOnMain(view);
        }, 2500));
    }

    function getState() {
        var bounds = state.safeBounds || {};
        var attachedToWindow = false;
        try {
            attachedToWindow = rootView !== null && rootView.isAttachedToWindow();
        } catch (ignored) {}
        return {
            attached: state.attached,
            attachedToWindow: attachedToWindow,
            collapsed: state.collapsed,
            pinned: state.pinned,
            x: Number(state.x),
            y: Number(state.y),
            width: Number(state.width),
            height: Number(state.height),
            desiredWidth: Number(desiredWidthPx),
            desiredHeight: Number(desiredHeightPx),
            normalHeight: Number(normalHeightPx),
            collapsedHeight: Number(collapsedHeightPx),
            safeBounds: {
                left: Number(bounds.left || 0),
                top: Number(bounds.top || 0),
                right: Number(bounds.right || 0),
                bottom: Number(bounds.bottom || 0)
            },
            positionRatios: copyPosition(state.positionRatios),
            savedPosition: copyPosition(state.savedPosition),
            windowType: state.windowType,
            openCount: Number(state.openCount),
            closeCount: Number(state.closeCount),
            updateCount: Number(state.updateCount),
            dragMoveCount: Number(state.dragMoveCount),
            persistenceWriteCount: Number(state.persistenceWriteCount),
            boundsRefreshCount: Number(state.boundsRefreshCount),
            configurationChangeCount: Number(state.configurationChangeCount),
            displayChangeCount: Number(state.displayChangeCount),
            contentReplaceCount: Number(state.contentReplaceCount),
            contentMode: state.contentMode,
            dragListenerInstalled: state.dragListenerInstalled,
            dragHandlePresent: state.dragHandlePresent,
            sheetStyle: state.sheetStyle,
            dimAmount: Number(state.dimAmount),
            contentTopInsetDp: Number(state.contentTopInsetDp),
            componentCallbacksRegistered: state.componentCallbacksRegistered,
            displayListenerRegistered: state.displayListenerRegistered,
            addThreadId: state.addThreadId,
            addThreadName: state.addThreadName,
            updateThreadId: state.updateThreadId,
            updateThreadName: state.updateThreadName,
            removeThreadId: state.removeThreadId,
            removeThreadName: state.removeThreadName,
            statusText: state.statusText,
            lastBoundsReason: state.lastBoundsReason,
            lastError: state.lastError
        };
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
                displayListener = new JavaAdapter(DisplayManager.DisplayListener, {
                    onDisplayAdded: function () {},
                    onDisplayRemoved: function () {},
                    onDisplayChanged: function () {
                        state.displayChangeCount += 1;
                        scheduleBoundsRefresh("display");
                    }
                });
                displayManager.registerDisplayListener(displayListener, mainHandler);
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
            try { mainHandler.removeCallbacks(refreshRunnable); } catch (ignored) {}
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

    ClipHub.Window = {
        MODULE_NAME: "ch_08_window",
        MODULE_VERSION: 6,
        init: function (context) {
            androidContext = context && context.androidContext ?
                context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable for WindowManager");
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
            metrics = themeMetrics();
            state.contentTopInsetDp = 28;
            state.safeBounds = safeBounds();
            readSavedPosition();
            registerObservers();
            return {
                ok: true,
                initialized: true,
                componentCallbacksRegistered:
                    state.componentCallbacksRegistered,
                displayListenerRegistered: state.displayListenerRegistered,
                savedPosition: copyPosition(state.savedPosition),
                sheetStyle: state.sheetStyle
            };
        },
        open: open,
        close: close,
        setCollapsed: setCollapsed,
        setPinned: setPinned,
        isAttached: function () { return state.attached; },
        moveTo: moveTo,
        moveBy: moveBy,
        refreshBounds: refreshBounds,
        persistPosition: persistCurrentPosition,
        setStatusText: setStatusText,
        setContentView: setContentView,
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
            try { close(); } catch (ignoredClose) {}
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
