(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
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
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var TextView = Packages.android.widget.TextView;
    var TypedValue = Packages.android.util.TypedValue;
    var DisplayMetrics = Packages.android.util.DisplayMetrics;

    var androidContext = null;
    var windowManager = null;
    var density = 1;
    var rootView = null;
    var titleBar = null;
    var contentView = null;
    var statusView = null;
    var closeView = null;
    var layoutParams = null;
    var normalHeightPx = 0;
    var collapsedHeightPx = 0;
    var touchSlopPx = 0;
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
        windowType: null,
        openCount: 0,
        closeCount: 0,
        updateCount: 0,
        dragMoveCount: 0,
        dragListenerInstalled: false,
        addThreadId: null,
        addThreadName: null,
        updateThreadId: null,
        updateThreadName: null,
        removeThreadId: null,
        removeThreadName: null,
        statusText: "",
        lastError: null
    };

    function nowThread() {
        var thread = Thread.currentThread();
        return {
            id: Number(thread.getId()),
            name: String(thread.getName())
        };
    }

    function runOnMainSync(callback, timeoutMs) {
        var mainLooper = Looper.getMainLooper();
        var currentLooper = Looper.myLooper();
        var box;
        var latch;
        var handler;
        var runnable;
        var posted;
        var completed;
        if (mainLooper !== null && currentLooper !== null &&
                currentLooper === mainLooper) {
            return { ok: true, value: callback(), direct: true };
        }
        box = { ok: false, value: null, error: null };
        latch = new CountDownLatch(1);
        handler = new Handler(mainLooper);
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
        posted = handler.post(runnable);
        if (!posted) {
            return { ok: false, error: new Error("Window main handler post failed") };
        }
        completed = latch.await(Number(timeoutMs || 2500), TimeUnit.MILLISECONDS);
        if (!completed) {
            try { handler.removeCallbacks(runnable); } catch (ignored) {}
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

    function resourceDimension(name) {
        var resources;
        var id;
        if (androidContext === null) { return 0; }
        try {
            resources = androidContext.getResources();
            id = Number(resources.getIdentifier(String(name), "dimen", "android"));
            return id > 0 ? Number(resources.getDimensionPixelSize(id)) : 0;
        } catch (ignored) {
            return 0;
        }
    }

    function safeBounds() {
        var result = { left: 0, top: 0, right: 0, bottom: 0 };
        var metrics;
        var bounds;
        var insets;
        var types;
        var displayMetrics;
        if (windowManager === null) { return result; }
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                metrics = windowManager.getCurrentWindowMetrics();
                bounds = metrics.getBounds();
                types = Number(WindowInsets.Type.systemBars()) |
                    Number(WindowInsets.Type.displayCutout());
                insets = metrics.getWindowInsets().getInsetsIgnoringVisibility(types);
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
        try {
            windowManager.getDefaultDisplay().getRealMetrics(displayMetrics);
        } catch (ignoredDisplay) {
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
        if (maximum < minimum) { return minimum; }
        if (value < minimum) { return minimum; }
        if (value > maximum) { return maximum; }
        return value;
    }

    function clampPosition(x, y, width, height, bounds) {
        return {
            x: clamp(Math.floor(Number(x)), bounds.left, bounds.right - width),
            y: clamp(Math.floor(Number(y)), bounds.top, bounds.bottom - height)
        };
    }

    function isDarkMode() {
        var mode = "system";
        var config;
        try {
            if (ClipHub.Settings && typeof ClipHub.Settings.get === "function") {
                mode = String(ClipHub.Settings.get("themeMode", "system"));
            }
        } catch (ignoredSetting) {}
        if (mode === "dark") { return true; }
        if (mode === "light") { return false; }
        try {
            config = androidContext.getResources().getConfiguration();
            return (Number(config.uiMode) &
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_MASK)) ===
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_YES);
        } catch (ignoredConfig) {
            return false;
        }
    }

    function makeBackground(dark) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setColor(Color.parseColor(dark ? "#EE17191D" : "#F7FFFFFF"));
        drawable.setCornerRadius(dp(18));
        drawable.setStroke(dp(1), Color.parseColor(dark ? "#33FFFFFF" : "#19000000"));
        return drawable;
    }

    function makeText(text, sizeSp, color, bold) {
        var view = new TextView(androidContext);
        view.setText(String(text));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, Number(sizeSp));
        view.setTextColor(Color.parseColor(String(color)));
        view.setGravity(Gravity.CENTER_VERTICAL);
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
        position = clampPosition(x, y, state.width, currentHeight(), bounds);
        layoutParams.x = position.x;
        layoutParams.y = position.y;
        layoutParams.height = currentHeight();
        windowManager.updateViewLayout(rootView, layoutParams);
        state.safeBounds = bounds;
        state.x = position.x;
        state.y = position.y;
        state.height = currentHeight();
        state.updateCount += 1;
        if (countDrag) { state.dragMoveCount += 1; }
        thread = nowThread();
        state.updateThreadId = thread.id;
        state.updateThreadName = thread.name;
        return getState();
    }

    function handleTitleTouch(view, event) {
        var action = Number(event.getActionMasked());
        var rawX = Number(event.getRawX());
        var rawY = Number(event.getRawY());
        var deltaX;
        var deltaY;
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
            if (!drag.active &&
                    Math.abs(deltaX) + Math.abs(deltaY) >= touchSlopPx) {
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
            drag.active = false;
            return true;
        }
        return true;
    }

    function buildView(options) {
        var dark = isDarkMode();
        var textPrimary = dark ? "#FFF4F4F5" : "#FF171717";
        var textSecondary = dark ? "#FFB4B4BC" : "#FF5C5C66";
        var divider = dark ? "#24FFFFFF" : "#12000000";
        var row;
        var title;
        var spacer;
        var line;
        var titleParams;
        var contentParams;
        var closeParams;

        rootView = new FrameLayout(androidContext);
        rootView.setBackground(makeBackground(dark));
        rootView.setPadding(dp(14), dp(10), dp(14), dp(12));
        if (Build.VERSION.SDK_INT >= 21) { rootView.setElevation(dp(12)); }

        row = new LinearLayout(androidContext);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(dp(2), 0, 0, 0);
        titleBar = row;
        title = makeText("ClipHub", 16, textPrimary, true);
        titleParams = new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.MATCH_PARENT, 1);
        row.addView(title, titleParams);

        closeView = makeText("×", 25, textSecondary, false);
        closeView.setGravity(Gravity.CENTER);
        closeView.setClickable(true);
        closeView.setFocusable(false);
        closeView.setContentDescription("关闭 ClipHub");
        closeParams = new LinearLayout.LayoutParams(dp(38), dp(38));
        row.addView(closeView, closeParams);

        rootView.addView(row, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, collapsedHeightPx - dp(18)));

        line = new View(androidContext);
        line.setBackgroundColor(Color.parseColor(divider));
        contentParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, dp(1));
        contentParams.topMargin = collapsedHeightPx - dp(8);
        rootView.addView(line, contentParams);

        contentView = new LinearLayout(androidContext);
        contentView.setOrientation(LinearLayout.VERTICAL);
        contentView.setPadding(dp(2), dp(12), dp(2), 0);
        statusView = makeText(
            options.statusText || "WindowManager 骨架已运行\n拖动标题栏可移动窗口",
            14, textSecondary, false
        );
        statusView.setGravity(Gravity.TOP | Gravity.START);
        statusView.setLineSpacing(0, 1.12);
        contentView.addView(statusView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        spacer = new View(androidContext);
        contentView.addView(spacer, new LinearLayout.LayoutParams(1, dp(6)));
        contentParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT);
        contentParams.topMargin = collapsedHeightPx - dp(2);
        rootView.addView(contentView, contentParams);

        titleBar.setOnTouchListener(new JavaAdapter(View.OnTouchListener, {
            onTouch: handleTitleTouch
        }));
        state.dragListenerInstalled = true;
        closeView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { ClipHub.Window.close(); }
        }));
        state.statusText = String(statusView.getText());
    }

    function createLayoutParams(options) {
        var widthDp = Number(options.widthDp || 320);
        var heightDp = Number(options.heightDp || 180);
        var bounds = safeBounds();
        var safeWidth = Math.max(1, bounds.right - bounds.left);
        var safeHeight = Math.max(1, bounds.bottom - bounds.top);
        var width = Math.min(dp(Math.max(220, widthDp)), safeWidth);
        var height = Math.min(dp(Math.max(120, heightDp)), safeHeight);
        var position;
        var type = Build.VERSION.SDK_INT >= 26
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
        normalHeightPx = height;
        collapsedHeightPx = Math.min(dp(58), height);
        state.width = width;
        state.height = state.collapsed ? collapsedHeightPx : normalHeightPx;
        state.safeBounds = bounds;
        position = clampPosition(
            options.x === undefined ? bounds.right - width - dp(18) : Number(options.x),
            options.y === undefined ? bounds.top + dp(72) : Number(options.y),
            width,
            state.height,
            bounds
        );
        state.x = position.x;
        state.y = position.y;
        state.windowType = Number(type);
        layoutParams = new WindowManager.LayoutParams(
            width,
            state.height,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT
        );
        layoutParams.gravity = Gravity.TOP | Gravity.START;
        layoutParams.x = state.x;
        layoutParams.y = state.y;
        layoutParams.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING;
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
                return { ok: true, attached: true, reused: false, state: getState() };
            } catch (error) {
                state.lastError = String(error);
                state.attached = false;
                rootView = null;
                titleBar = null;
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
            return { ok: true, attached: false, alreadyClosed: true, state: getState() };
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
                contentView = null;
                statusView = null;
                closeView = null;
                layoutParams = null;
                drag.active = false;
            }
        }, 3000);
        requireMainResult(result);
        return { ok: true, attached: false, alreadyClosed: false, state: getState() };
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

    function moveTo(x, y) {
        if (!state.attached) {
            state.x = Math.floor(Number(x || 0));
            state.y = Math.floor(Number(y || 0));
            return getState();
        }
        return requireMainResult(runOnMainSync(function () {
            return updatePositionOnMain(x, y, false);
        }, 2500));
    }

    function moveBy(dx, dy) {
        return moveTo(state.x + Number(dx || 0), state.y + Number(dy || 0));
    }

    function refreshBounds() {
        if (!state.attached) {
            state.safeBounds = safeBounds();
            return getState();
        }
        return moveTo(state.x, state.y);
    }

    function setStatusText(value) {
        var text = String(value === null || value === undefined ? "" : value);
        state.statusText = text;
        if (state.attached && statusView !== null) {
            requireMainResult(runOnMainSync(function () {
                statusView.setText(text);
                return true;
            }, 2500));
        }
        return text;
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
            normalHeight: Number(normalHeightPx),
            collapsedHeight: Number(collapsedHeightPx),
            safeBounds: {
                left: Number(bounds.left || 0),
                top: Number(bounds.top || 0),
                right: Number(bounds.right || 0),
                bottom: Number(bounds.bottom || 0)
            },
            windowType: state.windowType,
            openCount: Number(state.openCount),
            closeCount: Number(state.closeCount),
            updateCount: Number(state.updateCount),
            dragMoveCount: Number(state.dragMoveCount),
            dragListenerInstalled: state.dragListenerInstalled,
            addThreadId: state.addThreadId,
            addThreadName: state.addThreadName,
            updateThreadId: state.updateThreadId,
            updateThreadName: state.updateThreadName,
            removeThreadId: state.removeThreadId,
            removeThreadName: state.removeThreadName,
            statusText: state.statusText,
            lastError: state.lastError
        };
    }

    ClipHub.Window = {
        MODULE_NAME: "ch_08_window",
        MODULE_VERSION: 2,
        init: function (context) {
            androidContext = context && context.androidContext
                ? context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable for window");
            }
            windowManager = androidContext.getSystemService(Context.WINDOW_SERVICE);
            if (windowManager === null) {
                throw new Error("WindowManager unavailable");
            }
            density = Number(androidContext.getResources().getDisplayMetrics().density || 1);
            touchSlopPx = Math.max(dp(4), Number(
                Packages.android.view.ViewConfiguration.get(androidContext)
                    .getScaledTouchSlop()
            ));
            state.safeBounds = safeBounds();
            state.attached = false;
            state.lastError = null;
            return { ok: true, ready: true, safeBounds: getState().safeBounds };
        },
        open: open,
        close: close,
        isAttached: function () { return state.attached; },
        moveTo: moveTo,
        moveBy: moveBy,
        refreshBounds: refreshBounds,
        setCollapsed: setCollapsed,
        setPinned: setPinned,
        setStatusText: setStatusText,
        getState: getState,
        shutdown: function () {
            close();
            windowManager = null;
            androidContext = null;
            return true;
        }
    };
}((function () { return this; }())));
