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
    var ViewGroup = Packages.android.view.ViewGroup;
    var Gravity = Packages.android.view.Gravity;
    var WindowManager = Packages.android.view.WindowManager;
    var WindowInsets = Packages.android.view.WindowInsets;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Color = Packages.android.graphics.Color;
    var Rect = Packages.android.graphics.Rect;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var TextView = Packages.android.widget.TextView;
    var EditText = Packages.android.widget.EditText;
    var TypedValue = Packages.android.util.TypedValue;
    var InputType = Packages.android.text.InputType;
    var TextWatcher = Packages.android.text.TextWatcher;
    var TextUtils = Packages.android.text.TextUtils;
    var InputMethodManager = Packages.android.view.inputmethod.InputMethodManager;
    var DisplayMetrics = Packages.android.util.DisplayMetrics;

    var androidContext = null;
    var appContext = null;
    var windowManager = null;
    var inputMethodManager = null;
    var mainHandler = null;
    var density = 1;
    var panelRoot = null;
    var panelParams = null;
    var contentInput = null;
    var tagNameInput = null;
    var saveView = null;
    var cancelView = null;
    var headerCloseView = null;
    var titleIconView = null;
    var titleTextView = null;
    var subtitleTextView = null;
    var contentLabelView = null;
    var characterCountView = null;
    var metadataSourceView = null;
    var metadataTypeView = null;
    var editorFooterView = null;
    var contentScrollView = null;
    var layoutObserver = null;
    var layoutListener = null;
    var imePollRunnable = null;
    var imePollGeneration = 0;
    var createTagView = null;
    var tagViews = {};
    var tagDeleteViews = {};
    var tagSelectionSaveView = null;
    var tagSelectionCancelView = null;
    var editorDraftTagIds = [];
    var tagSelectorOriginalIds = [];
    var tagReturnMode = null;
    var tagReturnText = "";
    var tagReturnRow = null;
    var ready = false;
    var state = {
        open: false,
        attached: false,
        mode: "new",
        itemId: null,
        inputFocused: false,
        keyboardRequestCount: 0,
        openCount: 0,
        closeCount: 0,
        saveCount: 0,
        createCount: 0,
        updateCount: 0,
        cancelCount: 0,
        tagCreateCount: 0,
        tagToggleCount: 0,
        tagDeleteCount: 0,
        tagRenameCount: 0,
        tagSelectionOpenCount: 0,
        tagSelectionSaveCount: 0,
        tagSelectionCancelCount: 0,
        tagSelectionDirty: false,
        tagDraftCount: 0,
        tagOriginalCount: 0,
        tagColorPreviewCount: 0,
        tagFooterActionCount: 0,
        tagSelectorStyle: "reference_tag_selector_v1",
        tagOptionCount: 0,
        attachedTagCount: 0,
        lastSavedId: null,
        lastSaveAction: null,
        lastTagId: null,
        lastTagAction: null,
        windowType: null,
        windowFlags: null,
        panelWidthPx: null,
        panelHeightPx: null,
        panelWidthDp: null,
        panelHeightDp: null,
        dimAmount: 0,
        modalWindow: false,
        opaqueBackground: false,
        editorStyle: "legacy_editor_v1",
        dragHandlePresent: false,
        headerIconPresent: false,
        headerCloseButtonPresent: false,
        contentLabelPresent: false,
        characterCountPresent: false,
        metadataRowPresent: false,
        sourceMetaText: "",
        typeMetaText: "",
        contentLength: 0,
        contentMinLines: 0,
        footerActionCount: 0,
        editorFooterHeightDp: 0,
        cancelButtonPresent: false,
        saveButtonPresent: false,
        requestKeyboardOnOpen: true,
        keyboardRequestedOnOpen: false,
        softInputMode: 0,
        softInputAdjustResize: false,
        keyboardVisible: false,
        keyboardInsetDp: 0,
        visibleFrameHeightDp: 0,
        visibleFrameBottomDp: 0,
        rootMeasuredHeightDp: 0,
        inputViewportHeightDp: 0,
        inputMeasuredHeightDp: 0,
        footerTopDp: 0,
        footerBottomDp: 0,
        footerScreenBottomDp: 0,
        footerVisibleInRoot: false,
        footerAboveKeyboard: false,
        inputViewportAboveFooter: false,
        inputCanScrollUp: false,
        inputCanScrollDown: false,
        selectionStart: 0,
        selectionEnd: 0,
        cursorAtEnd: false,
        layoutMeasureCount: 0,
        keyboardShowCount: 0,
        keyboardHideCount: 0,
        lastKeyboardVisible: false,
        imeInsetsSupported: false,
        imeInsetSource: "none",
        imeInsetBottomDp: 0,
        systemTopInsetDp: 0,
        availableAboveImeDp: 0,
        keyboardAvoidanceApplied: false,
        keyboardAvoidanceApplyCount: 0,
        keyboardAvoidanceRestoreCount: 0,
        windowLayoutUpdateCount: 0,
        imePollCount: 0,
        normalPanelHeightDp: 0,
        currentPanelHeightDp: 0,
        currentPanelTopDp: 0,
        focusReleasedAfterImeHide: false,
        focusReleaseCount: 0,
        rootFocusRequestedAfterImeHide: false,
        rootFocusedAfterImeHide: false,
        panelGravity: "center",
        panelBottomMarginDp: 0,
        addThreadId: null,
        addThreadName: null,
        removeThreadId: null,
        removeThreadName: null,
        saveThreadId: null,
        saveThreadName: null,
        tagThreadId: null,
        tagThreadName: null,
        delayedCallbackPostCount: 0,
        delayedCallbackRunCount: 0,
        delayedCallbackCancelCount: 0,
        delayedCallbackErrorCount: 0,
        pendingDelayedCallbackCount: 0,
        postShutdownCallbackAttemptCount: 0,
        lastDelayedCallbackError: null,
        lastError: null
    };

    function nowThread() {
        var thread = Thread.currentThread();
        return { id: Number(thread.getId()), name: String(thread.getName()) };
    }

    function runOnMainSync(callback, timeoutMs) {
        var mainLooper = Looper.getMainLooper();
        if (mainHandler === null) {
            return { ok: false,
                error: new Error("Editor main handler unavailable") };
        }
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
                error: new Error("Editor main handler post failed") };
        }
        completed = latch.await(Number(timeoutMs || 2500),
            TimeUnit.MILLISECONDS);
        if (!completed) {
            try { mainHandler.removeCallbacks(runnable); } catch (ignored) {}
            return { ok: false,
                error: new Error("Editor main handler timeout") };
        }
        return box;
    }

    function requireMain(result) {
        if (!result || result.ok !== true) {
            throw result && result.error ? result.error :
                new Error("Editor main-thread operation failed");
        }
        return result.value;
    }

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function pxToDp(value) {
        return Math.round(Number(value) / density);
    }

    function postEditorDelayed(callback, delayMs, requireAttached) {
        var generation = imePollGeneration;
        var handler = mainHandler;
        var runnable;
        var posted;
        if (handler === null || !ready || typeof callback !== "function") {
            return false;
        }
        state.delayedCallbackPostCount += 1;
        state.pendingDelayedCallbackCount += 1;
        runnable = new Packages.java.lang.Runnable({
            run: function () {
                state.pendingDelayedCallbackCount = Math.max(0,
                    Number(state.pendingDelayedCallbackCount) - 1);
                if (generation !== imePollGeneration || !ready ||
                        appContext === null || windowManager === null ||
                        (requireAttached === true &&
                            (!state.attached || panelRoot === null))) {
                    state.delayedCallbackCancelCount += 1;
                    if (!ready) {
                        state.postShutdownCallbackAttemptCount += 1;
                    }
                    return;
                }
                try {
                    callback();
                    state.delayedCallbackRunCount += 1;
                } catch (error) {
                    state.delayedCallbackErrorCount += 1;
                    state.lastDelayedCallbackError = String(error);
                    state.lastError = String(error);
                }
            }
        });
        try { posted = handler.postDelayed(runnable, Number(delayMs || 0)); }
        catch (postError) {
            posted = false;
            state.lastDelayedCallbackError = String(postError);
        }
        if (!posted) {
            state.pendingDelayedCallbackCount = Math.max(0,
                Number(state.pendingDelayedCallbackCount) - 1);
            state.delayedCallbackErrorCount += 1;
            return false;
        }
        return true;
    }

    function isDarkMode() {
        var mode = "system";
        var config;
        try {
            if (ClipHub.Settings && typeof ClipHub.Settings.get === "function") {
                mode = String(ClipHub.Settings.get("themeMode", "system"));
            }
        } catch (ignored) {}
        if (mode === "dark") { return true; }
        if (mode === "light") { return false; }
        try {
            config = appContext.getResources().getConfiguration();
            return (Number(config.uiMode) &
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_MASK)) ===
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_YES);
        } catch (ignoredConfig) { return false; }
    }

    function roundedBackground(fill, stroke, radiusDp) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setColor(Color.parseColor(String(fill)));
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke !== null) {
            drawable.setStroke(dp(1), Color.parseColor(String(stroke)));
        }
        return drawable;
    }

    function makeText(text, sizeSp, color, bold) {
        var view = new TextView(appContext);
        view.setText(String(text));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, Number(sizeSp));
        view.setTextColor(Color.parseColor(String(color)));
        view.setIncludeFontPadding(false);
        if (bold) {
            view.setTypeface(Packages.android.graphics.Typeface.DEFAULT,
                Packages.android.graphics.Typeface.BOLD);
        }
        return view;
    }

    function makeButton(text, dark, primary, danger, selected, compact) {
        var color;
        var fill;
        var stroke;
        var view;
        if (danger) {
            color = dark ? "#FFFFB0B0" : "#FFB42323";
            fill = dark ? "#2AD75D66" : "#14D92D36";
            stroke = dark ? "#4FD75D66" : "#30D92D36";
        } else if (selected || primary) {
            color = dark ? "#FFE5F1FC" : "#FF285777";
            fill = dark ? "#FF2C4356" : "#FFE8F1F8";
            stroke = dark ? "#556F9FC7" : "#40799DBB";
        } else {
            color = dark ? "#FFD8D8DC" : "#FF45454D";
            fill = dark ? "#FF292C31" : "#FFF3F3F5";
            stroke = dark ? "#28FFFFFF" : "#14000000";
        }
        view = makeText(text, compact ? 11 : 12, color,
            primary || danger || selected);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(compact ? 9 : 11), dp(compact ? 6 : 7),
            dp(compact ? 9 : 11), dp(compact ? 6 : 7));
        view.setBackground(roundedBackground(fill, stroke, compact ? 9 : 10));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function makeCloseButton(dark) {
        var view = makeText("×", 22,
            dark ? "#FFC7C7CE" : "#FF5A5A63", true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(8), dp(2), dp(8), dp(2));
        view.setBackground(roundedBackground(
            dark ? "#FF272A2F" : "#FFF2F2F4",
            dark ? "#24FFFFFF" : "#14000000", 10));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function editorPalette() {
        var dark = isDarkMode();
        try {
            if (ClipHub.Theme &&
                    typeof ClipHub.Theme.getPalette === "function") {
                return ClipHub.Theme.getPalette(appContext);
            }
        } catch (ignored) {}
        return {
            dark: dark,
            accentStrong: dark ? "#FF9476F8" : "#FF5A37E6",
            accentSoft: dark ? "#FF302946" : "#FFF0ECFF",
            accentBorder: dark ? "#FF6F5A9D" : "#FFBBAAF8",
            surface: dark ? "#FF211E2A" : "#FFFFFFFF",
            surfaceMuted: dark ? "#FF292532" : "#FFF5F3FB",
            stroke: dark ? "#FF3D3748" : "#FFE5E0EF",
            textPrimary: dark ? "#FFF7F3FF" : "#FF1F1C28",
            textSecondary: dark ? "#FFC8C0D1" : "#FF6F697A",
            textTertiary: dark ? "#FF968DA1" : "#FF9992A3",
            icon: dark ? "#FFE7DFF1" : "#FF3D3748"
        };
    }

    function makeEditorPill(text, colors, accent) {
        var view = makeText(text, 10,
            accent ? colors.accentStrong : colors.textSecondary,
            accent === true);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setMaxLines(1);
        view.setEllipsize(TextUtils.TruncateAt.END);
        view.setPadding(dp(9), dp(5), dp(9), dp(5));
        view.setBackground(roundedBackground(
            accent ? colors.accentSoft : colors.surfaceMuted,
            accent ? colors.accentBorder : colors.stroke, 9));
        return view;
    }

    function makeEditorAction(text, colors, primary) {
        var view = makeText(text, 12,
            primary ? "#FFFFFFFF" : colors.accentStrong, true);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setBackground(roundedBackground(
            primary ? colors.accentStrong : colors.surface,
            primary ? colors.accentStrong : colors.accentBorder, 13));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function contentTypeLabel(value) {
        value = String(value || "text").toLowerCase();
        if (value === "url" || value === "link") { return "链接"; }
        if (value === "code") { return "代码"; }
        if (value === "email") { return "邮件"; }
        if (value === "phone") { return "电话"; }
        return "文本";
    }

    function updateCharacterCount() {
        var length = 0;
        try {
            length = contentInput === null ? 0 :
                String(contentInput.getText()).length;
        } catch (ignored) {}
        state.contentLength = length;
        if (characterCountView !== null) {
            characterCountView.setText(String(length) + " / 200000");
        }
        return length;
    }

    function statusBarHeightPx() {
        var resources;
        var resourceId;
        try {
            resources = appContext.getResources();
            resourceId = Number(resources.getIdentifier(
                "status_bar_height", "dimen", "android"));
            if (resourceId > 0) {
                return Number(resources.getDimensionPixelSize(resourceId));
            }
        } catch (ignored) {}
        return dp(24);
    }

    function inputMethodVisibleHeightPx() {
        var height = 0;
        var method;
        var parameterTypes;
        var argumentsArray;
        if (inputMethodManager === null) { return 0; }
        try {
            height = Number(inputMethodManager
                .getInputMethodWindowVisibleHeight());
            if (isFinite(height) && height > 0) { return height; }
        } catch (ignoredDirect) {}
        try {
            parameterTypes = Packages.java.lang.reflect.Array.newInstance(
                Packages.java.lang.Class, 0);
            argumentsArray = Packages.java.lang.reflect.Array.newInstance(
                Packages.java.lang.Object, 0);
            method = inputMethodManager.getClass().getDeclaredMethod(
                "getInputMethodWindowVisibleHeight", parameterTypes);
            method.setAccessible(true);
            height = Number(method.invoke(inputMethodManager, argumentsArray));
            return isFinite(height) && height > 0 ? height : 0;
        } catch (ignoredReflection) { return 0; }
    }

    function readImeState() {
        var metrics = displayMetrics();
        var output = {
            visible: false,
            bottomPx: 0,
            topInsetPx: statusBarHeightPx(),
            source: "none",
            supported: false,
            screenHeightPx: Number(metrics.heightPixels),
            visibleBottomPx: Number(metrics.heightPixels)
        };
        var rootInsets;
        var imeMask;
        var systemMask;
        var imeInsets;
        var systemInsets;
        var immHeight;
        var frame;
        var frameGap;
        if (panelRoot === null) { return output; }
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                rootInsets = panelRoot.getRootWindowInsets();
                if (rootInsets !== null) {
                    imeMask = WindowInsets.Type.ime();
                    systemMask = WindowInsets.Type.systemBars();
                    imeInsets = rootInsets.getInsets(imeMask);
                    systemInsets = rootInsets.getInsets(systemMask);
                    output.bottomPx = Math.max(0,
                        Number(imeInsets.bottom));
                    output.topInsetPx = Math.max(output.topInsetPx,
                        Number(systemInsets.top));
                    output.visible = rootInsets.isVisible(imeMask) ||
                        output.bottomPx >= dp(120);
                    output.source = "root_window_insets";
                    output.supported = true;
                }
            } catch (ignoredInsets) {}
        }
        immHeight = inputMethodVisibleHeightPx();
        if (immHeight > output.bottomPx) {
            output.bottomPx = immHeight;
            output.visible = immHeight >= dp(120);
            output.source = "input_method_visible_height";
            output.supported = true;
        }
        try {
            frame = new Rect();
            panelRoot.getWindowVisibleDisplayFrame(frame);
            output.topInsetPx = Math.max(output.topInsetPx,
                Number(frame.top));
            frameGap = Math.max(0,
                Number(metrics.heightPixels) - Number(frame.bottom));
            if (frameGap > output.bottomPx && frameGap >= dp(120)) {
                output.bottomPx = frameGap;
                output.visible = true;
                output.source = "visible_display_frame";
                output.supported = true;
            }
        } catch (ignoredFrame) {}
        if (!output.visible) { output.bottomPx = 0; }
        output.visibleBottomPx = Number(metrics.heightPixels) -
            Number(output.bottomPx);
        return output;
    }

    function applyEditorImeLayout(ime) {
        var metrics;
        var normalHeightPx;
        var targetHeightPx;
        var targetTopPx;
        var targetGravity;
        var targetY;
        var keyboardTopPx;
        var topSafePx;
        var availablePx;
        var changed = false;
        var wasApplied;
        if (panelRoot === null || panelParams === null ||
                state.mode === "tags") {
            return false;
        }
        metrics = displayMetrics();
        normalHeightPx = dp(Math.max(300,
            Number(state.normalPanelHeightDp || state.panelHeightDp || 590)));
        wasApplied = state.keyboardAvoidanceApplied === true;
        if (ime.visible && Number(ime.bottomPx) >= dp(120)) {
            keyboardTopPx = Math.max(0,
                Number(metrics.heightPixels) - Number(ime.bottomPx));
            topSafePx = Math.max(dp(6), Number(ime.topInsetPx));
            availablePx = Math.max(dp(280),
                keyboardTopPx - topSafePx - dp(6));
            targetHeightPx = Math.min(normalHeightPx, availablePx);
            targetTopPx = Math.max(topSafePx,
                keyboardTopPx - dp(6) - targetHeightPx);
            targetGravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            targetY = targetTopPx;
            state.availableAboveImeDp = pxToDp(availablePx);
            state.keyboardAvoidanceApplied = true;
            if (!wasApplied) { state.keyboardAvoidanceApplyCount += 1; }
            state.panelGravity = "ime_top";
            state.panelBottomMarginDp = 6;
        } else {
            targetHeightPx = normalHeightPx;
            targetGravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            targetY = dp(10);
            targetTopPx = Math.max(0,
                Number(metrics.heightPixels) - targetHeightPx - targetY);
            state.availableAboveImeDp = pxToDp(Number(metrics.heightPixels));
            state.keyboardAvoidanceApplied = false;
            if (wasApplied) { state.keyboardAvoidanceRestoreCount += 1; }
            state.panelGravity = "bottom";
            state.panelBottomMarginDp = 10;
        }
        if (Number(panelParams.height) !== Number(targetHeightPx)) {
            panelParams.height = targetHeightPx;
            changed = true;
        }
        if (Number(panelParams.gravity) !== Number(targetGravity)) {
            panelParams.gravity = targetGravity;
            changed = true;
        }
        if (Number(panelParams.y) !== Number(targetY)) {
            panelParams.y = targetY;
            changed = true;
        }
        state.currentPanelHeightDp = pxToDp(targetHeightPx);
        state.currentPanelTopDp = pxToDp(targetTopPx);
        if (changed && state.attached && panelRoot.isAttachedToWindow()) {
            windowManager.updateViewLayout(panelRoot, panelParams);
            state.windowLayoutUpdateCount += 1;
        }
        return changed;
    }

    function handoffEditorFocusAfterImeHide() {
        var previousDescendantFocusability = -1;
        var released = false;
        var requested = false;
        var focused = false;
        if (panelRoot === null || contentInput === null ||
                state.mode === "tags") {
            return false;
        }
        state.focusReleaseCount += 1;
        try {
            previousDescendantFocusability =
                Number(panelRoot.getDescendantFocusability());
        } catch (ignoredDescendantRead) {}
        try {
            panelRoot.setFocusable(true);
            panelRoot.setFocusableInTouchMode(true);
            panelRoot.setDescendantFocusability(
                ViewGroup.FOCUS_BLOCK_DESCENDANTS);
            contentInput.clearFocus();
            released = !contentInput.hasFocus();
            requested = panelRoot.requestFocus();
            focused = panelRoot.isFocused();
        } catch (error) {
            state.lastError = String(error);
        } finally {
            if (previousDescendantFocusability >= 0) {
                try {
                    panelRoot.setDescendantFocusability(
                        previousDescendantFocusability);
                } catch (ignoredDescendantRestore) {}
            }
        }
        state.focusReleasedAfterImeHide = released;
        state.rootFocusRequestedAfterImeHide = requested || focused;
        state.rootFocusedAfterImeHide = focused;
        if (!focused && mainHandler !== null) {
            postEditorDelayed(function () {
                var previous = -1;
                var retried = false;
                if (!state.attached || state.keyboardVisible ||
                        panelRoot === null || contentInput === null) {
                    return;
                }
                try {
                    previous = Number(panelRoot.getDescendantFocusability());
                } catch (ignoredPrevious) {}
                try {
                    panelRoot.setFocusable(true);
                    panelRoot.setFocusableInTouchMode(true);
                    panelRoot.setDescendantFocusability(
                        ViewGroup.FOCUS_BLOCK_DESCENDANTS);
                    contentInput.clearFocus();
                    retried = panelRoot.requestFocus();
                    state.focusReleasedAfterImeHide = !contentInput.hasFocus();
                    state.rootFocusRequestedAfterImeHide =
                        state.rootFocusRequestedAfterImeHide || retried;
                    state.rootFocusedAfterImeHide = panelRoot.isFocused();
                } finally {
                    if (previous >= 0 && panelRoot !== null) {
                        try { panelRoot.setDescendantFocusability(previous); }
                        catch (ignoredRestore) {}
                    }
                }
            }, 80, true);
        }
        return released && (requested || focused);
    }

    function measureEditorLayout(imeSnapshot) {
        var ime = imeSnapshot || readImeState();
        var metrics;
        var visibleHeightPx = 0;
        var rootHeightPx = 0;
        var viewportHeightPx = 0;
        var inputHeightPx = 0;
        var footerTopPx = 0;
        var footerBottomPx = 0;
        var footerScreenBottomPx = 0;
        var keyboardTopPx = 0;
        var location;
        var length = 0;
        var selectionStart = 0;
        var selectionEnd = 0;
        var keyboardWasVisible = state.lastKeyboardVisible === true;
        if (panelRoot === null || state.mode === "tags") { return false; }
        try {
            metrics = displayMetrics();
            visibleHeightPx = Math.max(0,
                Number(metrics.heightPixels) - Number(ime.bottomPx) -
                    Number(ime.topInsetPx));
            keyboardTopPx = Number(metrics.heightPixels) -
                Number(ime.bottomPx);
            rootHeightPx = Number(panelRoot.getHeight());
            if (contentScrollView !== null) {
                viewportHeightPx = Number(contentScrollView.getHeight());
            }
            if (contentInput !== null) {
                inputHeightPx = Number(contentInput.getHeight());
                length = String(contentInput.getText()).length;
                selectionStart = Number(contentInput.getSelectionStart());
                selectionEnd = Number(contentInput.getSelectionEnd());
            }
            if (editorFooterView !== null) {
                footerTopPx = Number(editorFooterView.getTop());
                footerBottomPx = Number(editorFooterView.getBottom());
                location = Packages.java.lang.reflect.Array.newInstance(
                    Packages.java.lang.Integer.TYPE, 2);
                editorFooterView.getLocationOnScreen(location);
                footerScreenBottomPx = Number(location[1]) +
                    Number(editorFooterView.getHeight());
            }
            if (state.layoutMeasureCount > 0 &&
                    state.lastKeyboardVisible !== ime.visible) {
                if (ime.visible) {
                    state.keyboardShowCount += 1;
                } else {
                    state.keyboardHideCount += 1;
                    if (keyboardWasVisible) {
                        handoffEditorFocusAfterImeHide();
                    }
                }
            }
            state.lastKeyboardVisible = ime.visible;
            if (!ime.visible && state.focusReleasedAfterImeHide === true &&
                    panelRoot !== null) {
                try {
                    state.rootFocusedAfterImeHide = panelRoot.isFocused();
                } catch (ignoredRootFocus) {}
            }
            state.keyboardVisible = ime.visible;
            state.keyboardInsetDp = pxToDp(Number(ime.bottomPx));
            state.imeInsetBottomDp = pxToDp(Number(ime.bottomPx));
            state.imeInsetSource = String(ime.source || "none");
            state.imeInsetsSupported = ime.supported === true;
            state.systemTopInsetDp = pxToDp(Number(ime.topInsetPx));
            state.visibleFrameHeightDp = pxToDp(visibleHeightPx);
            state.visibleFrameBottomDp = pxToDp(keyboardTopPx);
            state.rootMeasuredHeightDp = pxToDp(rootHeightPx);
            state.inputViewportHeightDp = pxToDp(viewportHeightPx);
            state.inputMeasuredHeightDp = pxToDp(inputHeightPx);
            state.footerTopDp = pxToDp(footerTopPx);
            state.footerBottomDp = pxToDp(footerBottomPx);
            state.footerScreenBottomDp = pxToDp(footerScreenBottomPx);
            state.footerVisibleInRoot = editorFooterView !== null &&
                footerTopPx >= 0 && footerBottomPx <= rootHeightPx + dp(2);
            state.footerAboveKeyboard = editorFooterView !== null &&
                footerScreenBottomPx <= keyboardTopPx + dp(2);
            state.inputViewportAboveFooter =
                contentScrollView !== null && editorFooterView !== null &&
                Number(contentScrollView.getBottom()) <= footerTopPx + dp(1);
            state.inputCanScrollUp = contentInput !== null &&
                (contentInput.canScrollVertically(-1) ||
                    (contentScrollView !== null &&
                        contentScrollView.canScrollVertically(-1)));
            state.inputCanScrollDown = contentInput !== null &&
                (contentInput.canScrollVertically(1) ||
                    (contentScrollView !== null &&
                        contentScrollView.canScrollVertically(1)));
            state.selectionStart = selectionStart;
            state.selectionEnd = selectionEnd;
            state.cursorAtEnd = contentInput !== null &&
                selectionStart === length && selectionEnd === length;
            state.layoutMeasureCount += 1;
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function pollEditorIme(generation) {
        var ime;
        if (generation !== imePollGeneration || !ready ||
                appContext === null || windowManager === null ||
                !state.attached || panelRoot === null ||
                state.mode === "tags") {
            return false;
        }
        state.imePollCount += 1;
        ime = readImeState();
        applyEditorImeLayout(ime);
        measureEditorLayout(ime);
        return true;
    }

    function stopEditorImePolling() {
        imePollGeneration += 1;
        if (mainHandler !== null && imePollRunnable !== null) {
            try { mainHandler.removeCallbacks(imePollRunnable); }
            catch (ignored) {}
        }
        imePollRunnable = null;
        return true;
    }

    function startEditorImePolling() {
        var generation;
        stopEditorImePolling();
        generation = imePollGeneration;
        imePollRunnable = new Packages.java.lang.Runnable({
            run: function () {
                if (!pollEditorIme(generation)) { return; }
                if (mainHandler !== null && imePollRunnable !== null) {
                    mainHandler.postDelayed(imePollRunnable, 90);
                }
            }
        });
        mainHandler.post(imePollRunnable);
        return true;
    }

    function installEditorLayoutObserver() {
        if (panelRoot === null || state.mode === "tags") { return false; }
        try {
            layoutObserver = panelRoot.getViewTreeObserver();
            layoutListener = new JavaAdapter(
                Packages.android.view.ViewTreeObserver.OnGlobalLayoutListener, {
                    onGlobalLayout: function () {
                        var ime;
                        if (!ready || !state.attached || panelRoot === null ||
                                appContext === null || windowManager === null) {
                            return;
                        }
                        try {
                            ime = readImeState();
                            applyEditorImeLayout(ime);
                            measureEditorLayout(ime);
                        } catch (error) {
                            state.delayedCallbackErrorCount += 1;
                            state.lastDelayedCallbackError = String(error);
                            state.lastError = String(error);
                        }
                    }
                });
            layoutObserver.addOnGlobalLayoutListener(layoutListener);
            startEditorImePolling();
            postEditorDelayed(function () {
                var ime = readImeState();
                applyEditorImeLayout(ime);
                measureEditorLayout(ime);
            }, 180, true);
            return true;
        } catch (error) {
            state.lastError = String(error);
            startEditorImePolling();
            return false;
        }
    }

    function scrollInputToEndOnMain() {
        var length;
        if (contentInput === null) { return false; }
        length = Number(contentInput.getText().length());
        contentInput.requestFocus();
        contentInput.setSelection(length);
        if (contentScrollView !== null) {
            contentScrollView.post(new Packages.java.lang.Runnable({
                run: function () {
                    try {
                        contentScrollView.fullScroll(View.FOCUS_DOWN);
                        contentInput.setSelection(contentInput.getText().length());
                        measureEditorLayout();
                    } catch (ignored) {}
                }
            }));
        }
        postEditorDelayed(function () {
            measureEditorLayout();
        }, 120, true);
        return true;
    }

    function emitMutation(name, id, mutation, extra) {
        var thread = nowThread();
        var payload = {
            id: Number(id),
            manual: true,
            mutation: String(mutation),
            threadId: thread.id,
            threadName: thread.name
        };
        var key;
        extra = extra || {};
        for (key in extra) {
            if (extra.hasOwnProperty(key)) { payload[key] = extra[key]; }
        }
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                return ClipHub.EventBus.emit(String(name), payload);
            }
        } catch (ignored) {}
        return 0;
    }

    function emitTagChanged(action, itemId, tagId) {
        var thread = nowThread();
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                return ClipHub.EventBus.emit("tags_changed", {
                    action: String(action),
                    itemId: itemId === null || itemId === undefined ?
                        null : Number(itemId),
                    tagId: tagId === null || tagId === undefined ?
                        null : Number(tagId),
                    threadId: thread.id,
                    threadName: thread.name
                });
            }
        } catch (ignored) {}
        return 0;
    }

    function displayMetrics() {
        var metrics = new DisplayMetrics();
        if (windowManager !== null) {
            try {
                windowManager.getDefaultDisplay().getRealMetrics(metrics);
                if (Number(metrics.widthPixels) > 0 &&
                        Number(metrics.heightPixels) > 0) {
                    return metrics;
                }
            } catch (ignoredWindow) {}
        }
        if (appContext !== null) {
            try { return appContext.getResources().getDisplayMetrics(); }
            catch (ignoredContext) {}
        }
        return metrics;
    }

    function panelDimensions(mode) {
        var metrics = displayMetrics();
        var tagsMode = String(mode) === "tags";
        var maxWidthDp = 390;
        var minWidthDp = 300;
        var width = Math.min(dp(maxWidthDp), Math.max(dp(minWidthDp),
            Number(metrics.widthPixels) - dp(20)));
        var availableHeight = Math.max(dp(300),
            Number(metrics.heightPixels) - dp(86));
        var heightDp;
        var count;
        if (tagsMode) {
            count = 0;
            try { count = ClipHub.Repository.listTags().length; }
            catch (ignoredCount) {}
            heightDp = 274 + Math.min(5, Math.max(1, count)) * 52;
            heightDp = Math.max(430, Math.min(590, heightDp));
        } else {
            heightDp = 590;
        }
        return {
            width: width,
            height: Math.min(dp(heightDp), availableHeight),
            widthDp: pxToDp(width),
            heightDp: Math.min(heightDp, pxToDp(availableHeight))
        };
    }

    function activeInput() {
        return state.mode === "tags" ? tagNameInput : contentInput;
    }

    function requestKeyboardOnMain() {
        var target = activeInput();
        if (target === null) { return false; }
        target.requestFocus();
        state.inputFocused = target.hasFocus();
        state.keyboardRequestCount += 1;
        state.keyboardRequestedOnOpen = true;
        postEditorDelayed(function () {
            if (target !== null && inputMethodManager !== null) {
                inputMethodManager.showSoftInput(
                    target, InputMethodManager.SHOW_IMPLICIT);
                state.inputFocused = target.hasFocus();
            }
        }, 120, true);
        return state.inputFocused;
    }

    function hideKeyboardOnMain() {
        var target = activeInput();
        try {
            if (target !== null && inputMethodManager !== null) {
                inputMethodManager.hideSoftInputFromWindow(
                    target.getWindowToken(), 0);
            }
        } catch (ignored) {}
    }

    function clearViews() {
        stopEditorImePolling();
        try {
            if (layoutObserver !== null && layoutListener !== null &&
                    layoutObserver.isAlive()) {
                layoutObserver.removeOnGlobalLayoutListener(layoutListener);
            }
        } catch (ignoredLayoutObserver) {}
        layoutObserver = null;
        layoutListener = null;
        contentScrollView = null;
        panelRoot = null;
        panelParams = null;
        contentInput = null;
        tagNameInput = null;
        saveView = null;
        cancelView = null;
        headerCloseView = null;
        titleIconView = null;
        titleTextView = null;
        subtitleTextView = null;
        contentLabelView = null;
        characterCountView = null;
        metadataSourceView = null;
        metadataTypeView = null;
        editorFooterView = null;
        createTagView = null;
        tagViews = {};
        tagDeleteViews = {};
        tagSelectionSaveView = null;
        tagSelectionCancelView = null;
        editorDraftTagIds = [];
        tagSelectorOriginalIds = [];
        tagReturnMode = null;
        tagReturnText = "";
        tagReturnRow = null;
        state.dragHandlePresent = false;
        state.headerIconPresent = false;
        state.headerCloseButtonPresent = false;
        state.contentLabelPresent = false;
        state.characterCountPresent = false;
        state.metadataRowPresent = false;
        state.cancelButtonPresent = false;
        state.saveButtonPresent = false;
        state.footerActionCount = 0;
        state.editorFooterHeightDp = 0;
        state.keyboardVisible = false;
        state.keyboardInsetDp = 0;
        state.visibleFrameHeightDp = 0;
        state.visibleFrameBottomDp = 0;
        state.rootMeasuredHeightDp = 0;
        state.inputViewportHeightDp = 0;
        state.inputMeasuredHeightDp = 0;
        state.footerTopDp = 0;
        state.footerBottomDp = 0;
        state.footerScreenBottomDp = 0;
        state.footerVisibleInRoot = false;
        state.footerAboveKeyboard = false;
        state.inputViewportAboveFooter = false;
        state.inputCanScrollUp = false;
        state.inputCanScrollDown = false;
        state.selectionStart = 0;
        state.selectionEnd = 0;
        state.cursorAtEnd = false;
        state.imeInsetsSupported = false;
        state.imeInsetSource = "none";
        state.imeInsetBottomDp = 0;
        state.systemTopInsetDp = 0;
        state.availableAboveImeDp = 0;
        state.keyboardAvoidanceApplied = false;
        state.currentPanelHeightDp = 0;
        state.currentPanelTopDp = 0;
        state.focusReleasedAfterImeHide = false;
        state.rootFocusRequestedAfterImeHide = false;
        state.rootFocusedAfterImeHide = false;
    }

    function closePanel(reason) {
        if (state.mode === "tags" && tagReturnMode !== null &&
                String(reason || "") !== "shutdown" &&
                String(reason || "") !== "replace" &&
                String(reason || "") !== "save") {
            requireMain(runOnMainSync(function () {
                return restoreTextEditorOnMain(false);
            }, 2500));
            return { ok: true, attached: true, returnedToEditor: true,
                state: getState() };
        }
        if (!state.attached && panelRoot === null) {
            state.open = false;
            state.itemId = null;
            return { ok: true, attached: false, alreadyClosed: true,
                state: getState() };
        }
        requireMain(runOnMainSync(function () {
            var thread = nowThread();
            try {
                hideKeyboardOnMain();
                if (panelRoot !== null) {
                    try { windowManager.removeViewImmediate(panelRoot); }
                    catch (error) {
                        if (panelRoot.isAttachedToWindow()) { throw error; }
                    }
                }
                state.closeCount += 1;
                if (String(reason || "") === "cancel") {
                    state.cancelCount += 1;
                }
                state.removeThreadId = thread.id;
                state.removeThreadName = thread.name;
                state.lastError = null;
                return true;
            } finally {
                state.open = false;
                state.attached = false;
                state.inputFocused = false;
                state.itemId = null;
                clearViews();
            }
        }, 3000));
        return { ok: true, attached: false, alreadyClosed: false,
            state: getState() };
    }

    function saveFromInput() {
        var thread = nowThread();
        var content;
        var id;
        var changed;
        var delivered;
        if (contentInput === null) { return false; }
        try {
            content = String(contentInput.getText());
            if (content.replace(/^\s+|\s+$/g, "").length === 0) {
                throw new Error("内容不能为空");
            }
            if (content.length > 200000) {
                throw new Error("内容长度不能超过 200000 字符");
            }
            if (state.mode === "new") {
                id = Number(ClipHub.Repository.insertItem({
                    content: content,
                    contentType: "text",
                    sourcePackage: null,
                    sourceLabel: "ClipHub 手动",
                    sourceUid: Number(Packages.android.os.Process.myUid()),
                    sourceConfidence: 100,
                    isSensitive: false,
                    isPinned: false
                }));
                state.createCount += 1;
                state.lastSaveAction = "created";
                delivered = emitMutation("clipboard_added", id, "created", {});
            } else {
                id = Number(state.itemId);
                changed = ClipHub.Repository.updateItem(id, { content: content });
                if (Number(changed) < 1) {
                    throw new Error("编辑目标不存在或未更新");
                }
                state.updateCount += 1;
                state.lastSaveAction = "updated";
                delivered = emitMutation("clipboard_merged", id, "updated", {});
            }
            ClipHub.Repository.setItemTags(id, editorDraftTagIds);
            emitTagChanged("item_tags_saved", id, null);
            state.saveCount += 1;
            state.lastSavedId = id;
            state.saveThreadId = thread.id;
            state.saveThreadName = thread.name;
            state.lastError = null;
            if (delivered < 1 && ClipHub.List &&
                    typeof ClipHub.List.refresh === "function") {
                ClipHub.List.refresh();
            }
            closePanel("save");
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function copyTagIds(input) {
        var output = [];
        var seen = {};
        var index;
        var id;
        input = input || [];
        for (index = 0; index < input.length; index += 1) {
            id = Number(input[index]);
            if (id > 0 && !seen[String(id)]) {
                seen[String(id)] = true;
                output.push(id);
            }
        }
        return output;
    }

    function loadItemTagIds(itemId) {
        var tags;
        var output = [];
        var index;
        if (itemId === null || itemId === undefined) { return output; }
        tags = ClipHub.Repository.listItemTags(Number(itemId));
        for (index = 0; index < tags.length; index += 1) {
            output.push(Number(tags[index].id));
        }
        return output;
    }

    function tagIndex(tagId) {
        var index;
        for (index = 0; index < editorDraftTagIds.length; index += 1) {
            if (Number(editorDraftTagIds[index]) === Number(tagId)) {
                return index;
            }
        }
        return -1;
    }

    function itemHasTag(tagId) {
        return tagIndex(tagId) >= 0;
    }

    function recordTagAction(action, tagId) {
        var thread = nowThread();
        state.lastTagAction = String(action);
        state.lastTagId = Number(tagId);
        state.tagThreadId = thread.id;
        state.tagThreadName = thread.name;
        state.lastError = null;
        emitTagChanged(action, state.itemId, tagId);
    }

    function updatePanelSizeForMode() {
        var size;
        if (panelRoot === null || panelParams === null) { return false; }
        size = panelDimensions(state.mode);
        if (Number(panelParams.width) === Number(size.width) &&
                Number(panelParams.height) === Number(size.height)) {
            return false;
        }
        panelParams.width = size.width;
        panelParams.height = size.height;
        state.panelWidthPx = size.width;
        state.panelHeightPx = size.height;
        state.panelWidthDp = size.widthDp;
        state.panelHeightDp = size.heightDp;
        try { windowManager.updateViewLayout(panelRoot, panelParams); }
        catch (ignoredUpdate) {}
        return true;
    }

    function createTagFromInput() {
        var name;
        var tagId;
        if (tagNameInput === null || state.mode !== "tags") { return false; }
        try {
            name = ClipHub.Repository.normalizeTagName(
                String(tagNameInput.getText()));
            if (name.length === 0) {
                throw new Error("标签名称不能为空");
            }
            tagId = Number(ClipHub.Repository.ensureTag(name,
                Number(Color.parseColor("#7C5CFC"))));
            if (!itemHasTag(tagId)) {
                editorDraftTagIds.push(tagId);
            }
            state.tagCreateCount += 1;
            state.tagSelectionDirty = true;
            state.tagDraftCount = editorDraftTagIds.length;
            recordTagAction("tag_created_draft", tagId);
            tagNameInput.setText("");
            buildTagContent(false);
            updatePanelSizeForMode();
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function toggleTag(tagId) {
        var index;
        if (state.mode !== "tags") { return false; }
        try {
            index = tagIndex(tagId);
            if (index >= 0) {
                editorDraftTagIds.splice(index, 1);
                recordTagAction("tag_draft_detached", tagId);
            } else {
                editorDraftTagIds.push(Number(tagId));
                recordTagAction("tag_draft_attached", tagId);
            }
            state.tagToggleCount += 1;
            state.tagSelectionDirty = true;
            state.tagDraftCount = editorDraftTagIds.length;
            buildTagContent(false);
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function deleteTag(tagId) {
        var changed;
        if (state.mode !== "tags") { return false; }
        try {
            changed = ClipHub.Repository.deleteTag(Number(tagId));
            if (Number(changed) < 1) { return false; }
            state.tagDeleteCount += 1;
            recordTagAction("tag_deleted", tagId);
            buildTagContent(false);
            updatePanelSizeForMode();
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function renameTag(tagId, name) {
        var changed;
        try {
            changed = ClipHub.Repository.updateTag(Number(tagId), { name: name });
            if (Number(changed) < 1) { return false; }
            state.tagRenameCount += 1;
            recordTagAction("tag_renamed", tagId);
            if (state.mode === "tags" && state.attached) {
                requireMain(runOnMainSync(function () {
                    buildTagContent(false);
                    return true;
                }, 2500));
            }
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function tagColorText(tag, fallback) {
        var value;
        var hex;
        if (!tag || tag.color_value === null || tag.color_value === undefined) {
            return String(fallback || "#7C5CFC");
        }
        value = Number(tag.color_value) >>> 0;
        hex = value.toString(16).toUpperCase();
        while (hex.length < 8) { hex = "0" + hex; }
        return "#" + hex;
    }

    function openTagSelectorOnMain() {
        if (state.mode !== "new" && state.mode !== "edit") { return false; }
        tagReturnMode = state.mode;
        tagReturnText = contentInput === null ? "" :
            String(contentInput.getText());
        tagReturnRow = state.itemId === null ? null :
            ClipHub.Repository.getItem(Number(state.itemId), false);
        tagSelectorOriginalIds = copyTagIds(editorDraftTagIds);
        state.tagOriginalCount = tagSelectorOriginalIds.length;
        state.tagDraftCount = editorDraftTagIds.length;
        state.tagSelectionDirty = false;
        state.tagSelectionOpenCount += 1;
        state.mode = "tags";
        hideKeyboardOnMain();
        buildTagContent(false);
        updatePanelSizeForMode();
        return true;
    }

    function restoreTextEditorOnMain(commit) {
        var parentMode = tagReturnMode ||
            (state.itemId === null ? "new" : "edit");
        if (commit === true) {
            tagSelectorOriginalIds = copyTagIds(editorDraftTagIds);
            state.tagSelectionSaveCount += 1;
        } else {
            editorDraftTagIds = copyTagIds(tagSelectorOriginalIds);
            state.tagSelectionCancelCount += 1;
        }
        state.tagSelectionDirty = false;
        state.tagDraftCount = editorDraftTagIds.length;
        state.mode = parentMode;
        buildTextContent(tagReturnText, tagReturnRow, {
            requestKeyboard: false
        });
        updatePanelSizeForMode();
        tagReturnMode = null;
        return true;
    }

    function saveTagSelectionDraft() {
        return requireMain(runOnMainSync(function () {
            return restoreTextEditorOnMain(true);
        }, 2500));
    }

    function cancelTagSelectionDraft() {
        return requireMain(runOnMainSync(function () {
            return restoreTextEditorOnMain(false);
        }, 2500));
    }

    function addTitle(titleText, subtitleText) {
        var dark = isDarkMode();
        var primary = dark ? "#FFF1F1F3" : "#FF1B1B1F";
        var secondary = dark ? "#FFA9A9B2" : "#FF6A6A73";
        var titleRow = new LinearLayout(appContext);
        var title = makeText(titleText, 15, primary, true);
        var subtitle;
        var params;
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        titleRow.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        cancelView = makeCloseButton(dark);
        cancelView.setContentDescription("关闭编辑窗口");
        cancelView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { closePanel("cancel"); }
        }));
        titleRow.addView(cancelView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(5);
        panelRoot.addView(titleRow, params);
        subtitle = makeText(subtitleText, 11, secondary, false);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(9);
        panelRoot.addView(subtitle, params);
    }

    function buildTextContent(initialText, row, options) {
        var colors = editorPalette();
        var isNew = state.mode === "new";
        var sourceText = isNew ? "ClipHub 手动" :
            String(row && row.source_label ? row.source_label : "未知来源");
        var dragRow = new LinearLayout(appContext);
        var dragHandle = new View(appContext);
        var header = new LinearLayout(appContext);
        var titleStack = new LinearLayout(appContext);
        var metaRow = new LinearLayout(appContext);
        var sectionRow = new LinearLayout(appContext);
        var scroll = new ScrollView(appContext);
        var footer = new LinearLayout(appContext);
        var params;
        options = options || {};

        panelRoot.removeAllViews();
        state.editorStyle = "reference_editor_v5";
        state.sourceMetaText = sourceText;
        state.typeMetaText = "";
        state.contentMinLines = 10;
        state.contentLength = String(initialText || "").length;

        dragRow.setGravity(Gravity.CENTER);
        dragHandle.setBackground(roundedBackground(
            colors.accentBorder, null, 3));
        dragRow.addView(dragHandle,
            new LinearLayout.LayoutParams(dp(42), dp(4)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(16));
        params.bottomMargin = dp(4);
        panelRoot.addView(dragRow, params);
        state.dragHandlePresent = true;

        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        titleIconView = makeText(isNew ? "+" : "✎", 19,
            colors.accentStrong, true);
        titleIconView.setGravity(Gravity.CENTER);
        titleIconView.setBackground(roundedBackground(
            colors.accentSoft, colors.accentBorder, 10));
        params = new LinearLayout.LayoutParams(dp(38), dp(38));
        params.rightMargin = dp(9);
        header.addView(titleIconView, params);

        titleStack.setOrientation(LinearLayout.VERTICAL);
        titleTextView = makeText(isNew ? "新增剪贴板" : "编辑剪贴板",
            18, colors.textPrimary, true);
        subtitleTextView = makeText(isNew ?
            "手动添加一条本地剪贴板记录" :
            "修改正文并管理当前记录的自定义标签",
            10, colors.textSecondary, false);
        titleStack.addView(titleTextView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(2);
        titleStack.addView(subtitleTextView, params);
        header.addView(titleStack, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        headerCloseView = makeText("×", 22, colors.icon, true);
        headerCloseView.setGravity(Gravity.CENTER);
        headerCloseView.setContentDescription("关闭编辑窗口");
        headerCloseView.setBackground(roundedBackground(
            colors.surfaceMuted, null, 18));
        headerCloseView.setClickable(true);
        headerCloseView.setFocusable(true);
        headerCloseView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { closePanel("cancel"); }
            }));
        header.addView(headerCloseView,
            new LinearLayout.LayoutParams(dp(38), dp(38)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(10);
        panelRoot.addView(header, params);
        state.headerIconPresent = true;
        state.headerCloseButtonPresent = true;

        metaRow.setOrientation(LinearLayout.HORIZONTAL);
        metaRow.setGravity(Gravity.CENTER_VERTICAL);
        metadataSourceView = makeEditorPill("来源  " + sourceText,
            colors, false);
        params = new LinearLayout.LayoutParams(0, dp(32), 1);
        params.rightMargin = dp(7);
        metaRow.addView(metadataSourceView, params);
        metadataTypeView = makeEditorPill(
            editorDraftTagIds.length > 0 ?
                "标签  " + String(editorDraftTagIds.length) + " 个" :
                "标签  未设置", colors, editorDraftTagIds.length > 0);
        metadataTypeView.setClickable(true);
        metadataTypeView.setFocusable(true);
        metadataTypeView.setContentDescription("选择当前记录标签");
        metadataTypeView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { openTagSelectorOnMain(); }
            }));
        metaRow.addView(metadataTypeView,
            new LinearLayout.LayoutParams(dp(116), dp(32)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(32));
        params.bottomMargin = dp(10);
        panelRoot.addView(metaRow, params);
        state.metadataRowPresent = true;

        sectionRow.setOrientation(LinearLayout.HORIZONTAL);
        sectionRow.setGravity(Gravity.CENTER_VERTICAL);
        contentLabelView = makeText("内容", 12,
            colors.textPrimary, true);
        sectionRow.addView(contentLabelView,
            new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        characterCountView = makeText("0 / 200000", 9,
            colors.textTertiary, false);
        sectionRow.addView(characterCountView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(6);
        panelRoot.addView(sectionRow, params);
        state.contentLabelPresent = true;
        state.characterCountPresent = true;

        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        contentScrollView = scroll;
        contentInput = new EditText(appContext);
        contentInput.setText(String(initialText || ""));
        contentInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        contentInput.setTextColor(Color.parseColor(colors.textPrimary));
        contentInput.setHintTextColor(Color.parseColor(colors.textTertiary));
        contentInput.setHint("输入剪贴板内容");
        contentInput.setGravity(Gravity.TOP | Gravity.START);
        contentInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_MULTI_LINE |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        contentInput.setSingleLine(false);
        contentInput.setMinLines(10);
        contentInput.setHorizontallyScrolling(false);
        contentInput.setPadding(dp(12), dp(11), dp(12), dp(11));
        contentInput.setBackground(roundedBackground(
            colors.surface, colors.stroke, 15));
        contentInput.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function () { updateCharacterCount(); },
            afterTextChanged: function () {}
        }));
        if (contentInput.getText().length() > 0) {
            contentInput.setSelection(contentInput.getText().length());
        }
        scroll.addView(contentInput,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        params.bottomMargin = dp(8);
        panelRoot.addView(scroll, params);
        updateCharacterCount();

        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.CENTER_VERTICAL);
        cancelView = makeEditorAction("取消", colors, false);
        cancelView.setContentDescription("取消编辑");
        cancelView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { closePanel("cancel"); }
            }));
        saveView = makeEditorAction("保存", colors, true);
        saveView.setContentDescription("保存记录");
        saveView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { saveFromInput(); }
            }));
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(8);
        footer.addView(cancelView, params);
        footer.addView(saveView,
            new LinearLayout.LayoutParams(0, dp(42), 1));
        editorFooterView = footer;
        panelRoot.addView(footer,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        state.footerActionCount = 2;
        state.editorFooterHeightDp = 50;
        state.cancelButtonPresent = true;
        state.saveButtonPresent = true;
        installEditorLayoutObserver();

        if (options.requestKeyboard !== false) {
            requestKeyboardOnMain();
        }
        return true;
    }

    function buildTagContent(requestFocus) {
        var colors = editorPalette();
        var dragRow = new LinearLayout(appContext);
        var dragHandle = new View(appContext);
        var header = new LinearLayout(appContext);
        var titleStack = new LinearLayout(appContext);
        var title;
        var subtitle;
        var inputRow = new LinearLayout(appContext);
        var scroll = new ScrollView(appContext);
        var list = new LinearLayout(appContext);
        var footer = new LinearLayout(appContext);
        var allTags = ClipHub.Repository.listTags();
        var index;
        var tag;
        var row;
        var dot;
        var labels;
        var name;
        var count;
        var check;
        var params;
        var inputParams;

        panelRoot.removeAllViews();
        tagViews = {};
        tagDeleteViews = {};
        state.editorStyle = "reference_tag_selector_v1";
        state.tagSelectorStyle = "reference_tag_selector_v1";
        state.tagColorPreviewCount = 0;
        state.tagFooterActionCount = 2;

        dragRow.setGravity(Gravity.CENTER);
        dragHandle.setBackground(roundedBackground(
            colors.accentBorder, null, 3));
        dragRow.addView(dragHandle,
            new LinearLayout.LayoutParams(dp(42), dp(4)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(16));
        params.bottomMargin = dp(4);
        panelRoot.addView(dragRow, params);

        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        titleStack.setOrientation(LinearLayout.VERTICAL);
        title = makeText("选择标签", 18, colors.textPrimary, true);
        subtitle = makeText("已选择 " + String(editorDraftTagIds.length) +
            " 个 · 取消不会保存更改", 10, colors.textSecondary, false);
        titleStack.addView(title, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(2);
        titleStack.addView(subtitle, params);
        header.addView(titleStack, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        headerCloseView = makeText("×", 22, colors.icon, true);
        headerCloseView.setGravity(Gravity.CENTER);
        headerCloseView.setBackground(roundedBackground(
            colors.surfaceMuted, null, 18));
        headerCloseView.setClickable(true);
        headerCloseView.setFocusable(true);
        headerCloseView.setContentDescription("取消标签选择");
        headerCloseView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { cancelTagSelectionDraft(); }
            }));
        header.addView(headerCloseView,
            new LinearLayout.LayoutParams(dp(38), dp(38)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(10);
        panelRoot.addView(header, params);

        inputRow.setOrientation(LinearLayout.HORIZONTAL);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);
        tagNameInput = new EditText(appContext);
        tagNameInput.setSingleLine(true);
        tagNameInput.setHint("新标签名称");
        tagNameInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        tagNameInput.setTextColor(Color.parseColor(colors.textPrimary));
        tagNameInput.setHintTextColor(Color.parseColor(colors.textTertiary));
        tagNameInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        tagNameInput.setPadding(dp(10), dp(7), dp(10), dp(7));
        tagNameInput.setBackground(roundedBackground(
            colors.surfaceMuted, colors.stroke, 11));
        inputParams = new LinearLayout.LayoutParams(
            0, dp(42), 1);
        inputParams.rightMargin = dp(7);
        inputRow.addView(tagNameInput, inputParams);
        createTagView = makeEditorAction("新增", colors, true);
        createTagView.setContentDescription("创建并选择新标签");
        createTagView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { createTagFromInput(); }
            }));
        inputRow.addView(createTagView,
            new LinearLayout.LayoutParams(dp(70), dp(42)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.bottomMargin = dp(9);
        panelRoot.addView(inputRow, params);

        scroll.setFillViewport(false);
        scroll.setVerticalScrollBarEnabled(false);
        list.setOrientation(LinearLayout.VERTICAL);
        if (allTags.length === 0) {
            row = makeText("暂无标签\n可在上方创建第一个标签", 12,
                colors.textSecondary, false);
            row.setGravity(Gravity.CENTER);
            row.setPadding(dp(12), dp(28), dp(12), dp(28));
            list.addView(row, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        } else {
            for (index = 0; index < allTags.length; index += 1) {
                tag = allTags[index];
                row = new LinearLayout(appContext);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.CENTER_VERTICAL);
                row.setPadding(dp(10), dp(8), dp(9), dp(8));
                row.setBackground(roundedBackground(
                    itemHasTag(tag.id) ? colors.accentSoft : colors.surfaceMuted,
                    itemHasTag(tag.id) ? colors.accentBorder : colors.stroke, 12));
                row.setClickable(true);
                row.setFocusable(true);
                row.setContentDescription((itemHasTag(tag.id) ?
                    "取消选择标签 " : "选择标签 ") + String(tag.name));
                dot = new View(appContext);
                dot.setBackground(roundedBackground(
                    tagColorText(tag, colors.accentStrong), null, 99));
                params = new LinearLayout.LayoutParams(dp(14), dp(14));
                params.rightMargin = dp(9);
                row.addView(dot, params);
                state.tagColorPreviewCount += 1;
                labels = new LinearLayout(appContext);
                labels.setOrientation(LinearLayout.VERTICAL);
                name = makeText(String(tag.name), 12,
                    colors.textPrimary, itemHasTag(tag.id));
                name.setSingleLine(true);
                name.setMaxLines(1);
                name.setEllipsize(TextUtils.TruncateAt.END);
                count = makeText(String(Number(tag.item_count || 0)) +
                    " 条记录", 9, colors.textSecondary, false);
                labels.addView(name, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
                labels.addView(count, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
                row.addView(labels, new LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
                check = makeText(itemHasTag(tag.id) ? "✓" : "+", 15,
                    itemHasTag(tag.id) ? colors.accentStrong :
                        colors.textTertiary, true);
                check.setGravity(Gravity.CENTER);
                row.addView(check,
                    new LinearLayout.LayoutParams(dp(34), dp(34)));
                (function (tagId, view) {
                    view.setOnClickListener(new JavaAdapter(
                        View.OnClickListener, {
                            onClick: function () { toggleTag(tagId); }
                        }));
                    tagViews[String(tagId)] = view;
                }(Number(tag.id), row));
                params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, dp(54));
                params.bottomMargin = dp(6);
                list.addView(row, params);
            }
        }
        state.tagOptionCount = allTags.length;
        state.attachedTagCount = editorDraftTagIds.length;
        state.tagDraftCount = editorDraftTagIds.length;
        scroll.addView(list,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        params.bottomMargin = dp(8);
        panelRoot.addView(scroll, params);

        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.CENTER_VERTICAL);
        tagSelectionCancelView = makeEditorAction("取消", colors, false);
        tagSelectionCancelView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { cancelTagSelectionDraft(); }
            }));
        tagSelectionSaveView = makeEditorAction(
            "完成（" + String(editorDraftTagIds.length) + "）", colors, true);
        tagSelectionSaveView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { saveTagSelectionDraft(); }
            }));
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(8);
        footer.addView(tagSelectionCancelView, params);
        footer.addView(tagSelectionSaveView,
            new LinearLayout.LayoutParams(0, dp(42), 1));
        panelRoot.addView(footer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        if (requestFocus) { requestKeyboardOnMain(); }
        return true;
    }

    function openPanel(mode, itemId, options) {
        var row = null;
        var initialText = "";
        var requestKeyboard;
        options = options || {};
        if (!ready) { throw new Error("ClipHub editor is not ready"); }
        mode = String(mode || "new");
        if (mode === "edit" || mode === "tags") {
            row = ClipHub.Repository.getItem(Number(itemId), false);
            if (row === null || row === undefined) {
                throw new Error("编辑目标不存在");
            }
            initialText = String(row.content);
        }
        if (state.attached) { closePanel("replace"); }
        state.mode = mode === "edit" ? "edit" :
            (mode === "tags" ? "tags" : "new");
        state.itemId = state.mode === "new" ? null : Number(itemId);
        if (state.mode === "new" || state.mode === "edit") {
            editorDraftTagIds = state.mode === "edit" ?
                loadItemTagIds(state.itemId) : [];
            tagSelectorOriginalIds = copyTagIds(editorDraftTagIds);
            state.tagDraftCount = editorDraftTagIds.length;
            state.tagOriginalCount = editorDraftTagIds.length;
            state.tagSelectionDirty = false;
            tagReturnMode = null;
            tagReturnText = initialText;
            tagReturnRow = row;
        }
        requestKeyboard = options.requestKeyboard !== false;
        state.requestKeyboardOnOpen = requestKeyboard;
        state.keyboardRequestedOnOpen = false;
        state.focusReleasedAfterImeHide = false;
        state.rootFocusRequestedAfterImeHide = false;
        state.rootFocusedAfterImeHide = false;
        return requireMain(runOnMainSync(function () {
            var size = panelDimensions(state.mode);
            var type = Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
            var thread = nowThread();
            var dark = isDarkMode();
            var colors = editorPalette();
            panelRoot = new LinearLayout(appContext);
            panelRoot.setOrientation(LinearLayout.VERTICAL);
            if (state.mode === "tags") {
                panelRoot.setPadding(dp(14), dp(12), dp(14), dp(12));
                panelRoot.setBackground(roundedBackground(
                    dark ? "#FF181A1F" : "#FFFFFFFF",
                    dark ? "#30FFFFFF" : "#1A000000", 17));
            } else {
                panelRoot.setPadding(dp(12), dp(8), dp(12), dp(10));
                panelRoot.setBackground(roundedBackground(
                    colors.surface, colors.stroke, 24));
            }
            if (Build.VERSION.SDK_INT >= 21) {
                panelRoot.setElevation(dp(20));
            }
            panelParams = new WindowManager.LayoutParams(
                size.width, size.height, type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
                    WindowManager.LayoutParams.FLAG_DIM_BEHIND,
                PixelFormat.TRANSLUCENT);
            if (state.mode === "tags") {
                panelParams.gravity = Gravity.CENTER;
                panelParams.y = 0;
                panelParams.dimAmount = 0.72;
                state.panelGravity = "center";
                state.panelBottomMarginDp = 0;
            } else {
                panelParams.gravity = Gravity.BOTTOM |
                    Gravity.CENTER_HORIZONTAL;
                panelParams.y = dp(10);
                panelParams.dimAmount = 0.44;
                state.panelGravity = "bottom";
                state.panelBottomMarginDp = 10;
            }
            panelParams.softInputMode =
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
                (requestKeyboard ?
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE :
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
            state.softInputMode = Number(panelParams.softInputMode);
            state.softInputAdjustResize =
                (Number(panelParams.softInputMode) &
                    Number(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)) !== 0;
            try { panelParams.setTitle("ClipHub Editor Panel"); }
            catch (ignoredTitle) {}
            windowManager.addView(panelRoot, panelParams);
            state.open = true;
            state.attached = true;
            state.openCount += 1;
            state.windowType = Number(type);
            state.windowFlags = Number(panelParams.flags);
            state.panelWidthPx = size.width;
            state.panelHeightPx = size.height;
            state.panelWidthDp = size.widthDp;
            state.panelHeightDp = size.heightDp;
            state.normalPanelHeightDp = size.heightDp;
            state.currentPanelHeightDp = size.heightDp;
            state.currentPanelTopDp = state.mode === "tags" ? 0 :
                Math.max(0, pxToDp(Number(displayMetrics().heightPixels) -
                    Number(size.height) - dp(10)));
            state.dimAmount = Number(panelParams.dimAmount);
            state.modalWindow = true;
            state.opaqueBackground = true;
            state.addThreadId = thread.id;
            state.addThreadName = thread.name;
            state.lastError = null;
            if (state.mode === "tags") {
                state.editorStyle = "legacy_tags_v1";
                buildTagContent(requestKeyboard);
            } else {
                buildTextContent(initialText, row, {
                    requestKeyboard: requestKeyboard
                });
            }
            return { ok: true, attached: true, mode: state.mode,
                itemId: state.itemId, state: getState() };
        }, 3000));
    }

    function getState() {
        var attachedToWindow = false;
        var input = activeInput();
        var inputLength = 0;
        var notFocusable = false;
        var rootFocused = false;
        try {
            rootFocused = panelRoot !== null && panelRoot.isFocused();
        } catch (ignoredRootFocus) {}
        try {
            attachedToWindow = panelRoot !== null &&
                panelRoot.isAttachedToWindow();
        } catch (ignoredAttached) {}
        try {
            inputLength = input !== null ?
                String(input.getText()).length : 0;
        } catch (ignoredInput) {}
        if (panelParams !== null) {
            notFocusable = (Number(panelParams.flags) &
                Number(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)) !== 0;
        }
        return {
            ready: ready,
            open: state.open,
            attached: state.attached,
            attachedToWindow: attachedToWindow,
            mode: state.mode,
            itemId: state.itemId,
            inputPresent: input !== null,
            inputLength: inputLength,
            inputFocused: input !== null ? input.hasFocus() : false,
            keyboardRequestCount: Number(state.keyboardRequestCount),
            focusableWindow: !notFocusable,
            openCount: Number(state.openCount),
            closeCount: Number(state.closeCount),
            saveCount: Number(state.saveCount),
            createCount: Number(state.createCount),
            updateCount: Number(state.updateCount),
            cancelCount: Number(state.cancelCount),
            tagCreateCount: Number(state.tagCreateCount),
            tagToggleCount: Number(state.tagToggleCount),
            tagDeleteCount: Number(state.tagDeleteCount),
            tagRenameCount: Number(state.tagRenameCount),
            tagSelectionOpenCount: Number(state.tagSelectionOpenCount),
            tagSelectionSaveCount: Number(state.tagSelectionSaveCount),
            tagSelectionCancelCount: Number(state.tagSelectionCancelCount),
            tagSelectionDirty: state.tagSelectionDirty === true,
            tagDraftCount: Number(state.tagDraftCount),
            tagOriginalCount: Number(state.tagOriginalCount),
            tagColorPreviewCount: Number(state.tagColorPreviewCount),
            tagFooterActionCount: Number(state.tagFooterActionCount),
            tagSelectorStyle: state.tagSelectorStyle,
            tagOptionCount: Number(state.tagOptionCount),
            attachedTagCount: Number(state.attachedTagCount),
            tagButtonCount: Object.keys(tagViews).length,
            tagDeleteButtonCount: Object.keys(tagDeleteViews).length,
            lastSavedId: state.lastSavedId,
            lastSaveAction: state.lastSaveAction,
            lastTagId: state.lastTagId,
            lastTagAction: state.lastTagAction,
            windowType: state.windowType,
            windowFlags: state.windowFlags,
            panelWidthPx: state.panelWidthPx,
            panelHeightPx: state.panelHeightPx,
            panelWidthDp: state.panelWidthDp,
            panelHeightDp: state.panelHeightDp,
            dimAmount: state.dimAmount,
            modalWindow: state.modalWindow,
            opaqueBackground: state.opaqueBackground,
            editorStyle: state.editorStyle,
            dragHandlePresent: state.dragHandlePresent === true,
            headerIconPresent: state.headerIconPresent === true,
            headerCloseButtonPresent:
                state.headerCloseButtonPresent === true,
            contentLabelPresent: state.contentLabelPresent === true,
            characterCountPresent: state.characterCountPresent === true,
            metadataRowPresent: state.metadataRowPresent === true,
            sourceMetaText: state.sourceMetaText,
            typeMetaText: state.typeMetaText,
            contentLength: Number(state.contentLength),
            contentMinLines: Number(state.contentMinLines),
            footerActionCount: Number(state.footerActionCount),
            editorFooterHeightDp: Number(state.editorFooterHeightDp),
            cancelButtonPresent: cancelView !== null,
            saveButtonPresent: saveView !== null,
            headerCloseViewPresent: headerCloseView !== null,
            requestKeyboardOnOpen: state.requestKeyboardOnOpen === true,
            keyboardRequestedOnOpen:
                state.keyboardRequestedOnOpen === true,
            softInputMode: Number(state.softInputMode),
            softInputAdjustResize: state.softInputAdjustResize === true,
            keyboardVisible: state.keyboardVisible === true,
            keyboardInsetDp: Number(state.keyboardInsetDp),
            visibleFrameHeightDp: Number(state.visibleFrameHeightDp),
            visibleFrameBottomDp: Number(state.visibleFrameBottomDp),
            rootMeasuredHeightDp: Number(state.rootMeasuredHeightDp),
            inputViewportHeightDp: Number(state.inputViewportHeightDp),
            inputMeasuredHeightDp: Number(state.inputMeasuredHeightDp),
            footerTopDp: Number(state.footerTopDp),
            footerBottomDp: Number(state.footerBottomDp),
            footerScreenBottomDp: Number(state.footerScreenBottomDp),
            footerVisibleInRoot: state.footerVisibleInRoot === true,
            footerAboveKeyboard: state.footerAboveKeyboard === true,
            inputViewportAboveFooter:
                state.inputViewportAboveFooter === true,
            inputCanScrollUp: state.inputCanScrollUp === true,
            inputCanScrollDown: state.inputCanScrollDown === true,
            selectionStart: Number(state.selectionStart),
            selectionEnd: Number(state.selectionEnd),
            cursorAtEnd: state.cursorAtEnd === true,
            layoutMeasureCount: Number(state.layoutMeasureCount),
            keyboardShowCount: Number(state.keyboardShowCount),
            keyboardHideCount: Number(state.keyboardHideCount),
            imeInsetsSupported: state.imeInsetsSupported === true,
            imeInsetSource: state.imeInsetSource,
            imeInsetBottomDp: Number(state.imeInsetBottomDp),
            systemTopInsetDp: Number(state.systemTopInsetDp),
            availableAboveImeDp: Number(state.availableAboveImeDp),
            keyboardAvoidanceApplied:
                state.keyboardAvoidanceApplied === true,
            keyboardAvoidanceApplyCount:
                Number(state.keyboardAvoidanceApplyCount),
            keyboardAvoidanceRestoreCount:
                Number(state.keyboardAvoidanceRestoreCount),
            windowLayoutUpdateCount:
                Number(state.windowLayoutUpdateCount),
            imePollCount: Number(state.imePollCount),
            delayedCallbackPostCount:
                Number(state.delayedCallbackPostCount),
            delayedCallbackRunCount:
                Number(state.delayedCallbackRunCount),
            delayedCallbackCancelCount:
                Number(state.delayedCallbackCancelCount),
            delayedCallbackErrorCount:
                Number(state.delayedCallbackErrorCount),
            pendingDelayedCallbackCount:
                Number(state.pendingDelayedCallbackCount),
            postShutdownCallbackAttemptCount:
                Number(state.postShutdownCallbackAttemptCount),
            lastDelayedCallbackError: state.lastDelayedCallbackError,
            normalPanelHeightDp: Number(state.normalPanelHeightDp),
            currentPanelHeightDp: Number(state.currentPanelHeightDp),
            currentPanelTopDp: Number(state.currentPanelTopDp),
            focusReleasedAfterImeHide:
                state.focusReleasedAfterImeHide === true,
            focusReleaseCount: Number(state.focusReleaseCount),
            rootFocusRequestedAfterImeHide:
                state.rootFocusRequestedAfterImeHide === true,
            rootFocusedAfterImeHide:
                state.rootFocusedAfterImeHide === true,
            rootFocused: rootFocused,
            panelGravity: state.panelGravity,
            panelBottomMarginDp: Number(state.panelBottomMarginDp),
            addThreadId: state.addThreadId,
            addThreadName: state.addThreadName,
            removeThreadId: state.removeThreadId,
            removeThreadName: state.removeThreadName,
            saveThreadId: state.saveThreadId,
            saveThreadName: state.saveThreadName,
            tagThreadId: state.tagThreadId,
            tagThreadName: state.tagThreadName,
            lastError: state.lastError
        };
    }

    function resetState() {
        var defaults = {
            open: false, attached: false, mode: "new", itemId: null,
            inputFocused: false, keyboardRequestCount: 0, openCount: 0,
            closeCount: 0, saveCount: 0, createCount: 0,
            updateCount: 0, cancelCount: 0, tagCreateCount: 0,
            tagToggleCount: 0, tagDeleteCount: 0, tagRenameCount: 0,
            tagSelectionOpenCount: 0, tagSelectionSaveCount: 0,
            tagSelectionCancelCount: 0, tagSelectionDirty: false,
            tagDraftCount: 0, tagOriginalCount: 0,
            tagColorPreviewCount: 0, tagFooterActionCount: 0,
            tagSelectorStyle: "reference_tag_selector_v1",
            tagOptionCount: 0, attachedTagCount: 0, lastSavedId: null,
            lastSaveAction: null, lastTagId: null, lastTagAction: null,
            windowType: null, windowFlags: null, panelWidthPx: null,
            panelHeightPx: null, panelWidthDp: null, panelHeightDp: null,
            dimAmount: 0, modalWindow: false, opaqueBackground: false,
            editorStyle: "legacy_editor_v1", dragHandlePresent: false,
            headerIconPresent: false, headerCloseButtonPresent: false,
            contentLabelPresent: false, characterCountPresent: false,
            metadataRowPresent: false, sourceMetaText: "", typeMetaText: "",
            contentLength: 0, contentMinLines: 0, footerActionCount: 0,
            editorFooterHeightDp: 0, cancelButtonPresent: false,
            saveButtonPresent: false, requestKeyboardOnOpen: true,
            keyboardRequestedOnOpen: false, softInputMode: 0,
            softInputAdjustResize: false, keyboardVisible: false,
            keyboardInsetDp: 0, visibleFrameHeightDp: 0,
            visibleFrameBottomDp: 0, rootMeasuredHeightDp: 0,
            inputViewportHeightDp: 0, inputMeasuredHeightDp: 0,
            footerTopDp: 0, footerBottomDp: 0, footerScreenBottomDp: 0,
            footerVisibleInRoot: false, footerAboveKeyboard: false,
            inputViewportAboveFooter: false, inputCanScrollUp: false,
            inputCanScrollDown: false, selectionStart: 0, selectionEnd: 0,
            cursorAtEnd: false, layoutMeasureCount: 0,
            keyboardShowCount: 0, keyboardHideCount: 0,
            lastKeyboardVisible: false, imeInsetsSupported: false,
            imeInsetSource: "none", imeInsetBottomDp: 0,
            systemTopInsetDp: 0, availableAboveImeDp: 0,
            keyboardAvoidanceApplied: false,
            keyboardAvoidanceApplyCount: 0,
            keyboardAvoidanceRestoreCount: 0,
            windowLayoutUpdateCount: 0, imePollCount: 0,
            delayedCallbackPostCount: 0, delayedCallbackRunCount: 0,
            delayedCallbackCancelCount: 0, delayedCallbackErrorCount: 0,
            pendingDelayedCallbackCount: 0,
            postShutdownCallbackAttemptCount: 0,
            lastDelayedCallbackError: null,
            normalPanelHeightDp: 0, currentPanelHeightDp: 0,
            currentPanelTopDp: 0, focusReleasedAfterImeHide: false,
            focusReleaseCount: 0,
            rootFocusRequestedAfterImeHide: false,
            rootFocusedAfterImeHide: false, panelGravity: "center",
            panelBottomMarginDp: 0,
            addThreadId: null, addThreadName: null, removeThreadId: null,
            removeThreadName: null, saveThreadId: null,
            saveThreadName: null, tagThreadId: null, tagThreadName: null,
            lastError: null
        };
        var key;
        for (key in defaults) {
            if (defaults.hasOwnProperty(key)) { state[key] = defaults[key]; }
        }
    }

    ClipHub.Editor = {
        MODULE_NAME: "ch_10_editor",
        MODULE_VERSION: 11,
        init: function (context) {
            androidContext = context && context.androidContext ?
                context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable for editor");
            }
            appContext = androidContext.getApplicationContext() || androidContext;
            windowManager = appContext.getSystemService(Context.WINDOW_SERVICE);
            inputMethodManager = appContext.getSystemService(
                Context.INPUT_METHOD_SERVICE);
            if (windowManager === null) {
                throw new Error("WindowManager service unavailable for editor");
            }
            mainHandler = new Handler(Looper.getMainLooper());
            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
            clearViews();
            resetState();
            ready = true;
            return true;
        },
        isReady: function () { return ready; },
        isOpen: function () { return state.attached; },
        openNew: function (options) {
            return openPanel("new", null, options || {});
        },
        openItem: function (id, options) {
            return openPanel("edit", Number(id), options || {});
        },
        openTags: function (id, options) {
            var opened = openPanel("edit", Number(id), options || {
                requestKeyboard: false
            });
            requireMain(runOnMainSync(function () {
                return openTagSelectorOnMain();
            }, 2500));
            return opened;
        },
        close: function () { return closePanel("close"); },
        getState: getState,
        refreshLayoutMetrics: function () {
            return requireMain(runOnMainSync(function () {
                return measureEditorLayout();
            }, 2500));
        },
        requestKeyboard: function () {
            return requireMain(runOnMainSync(function () {
                return requestKeyboardOnMain();
            }, 2500));
        },
        hideKeyboard: function () {
            return requireMain(runOnMainSync(function () {
                hideKeyboardOnMain();
                postEditorDelayed(function () {
                    measureEditorLayout();
                }, 160, true);
                return true;
            }, 2500));
        },
        scrollInputToEnd: function () {
            return requireMain(runOnMainSync(function () {
                return scrollInputToEndOnMain();
            }, 2500));
        },
        setInputText: function (text) {
            return requireMain(runOnMainSync(function () {
                var input = activeInput();
                if (input === null) { return false; }
                input.setText(String(text === null || text === undefined ?
                    "" : text));
                input.setSelection(input.getText().length());
                return true;
            }, 2500));
        },
        performSaveClick: function () {
            return requireMain(runOnMainSync(function () {
                return saveView !== null ? saveView.performClick() : false;
            }, 2500));
        },
        performCancelClick: function () {
            return requireMain(runOnMainSync(function () {
                return cancelView !== null ? cancelView.performClick() : false;
            }, 2500));
        },
        performHeaderCloseClick: function () {
            return requireMain(runOnMainSync(function () {
                return headerCloseView !== null ?
                    headerCloseView.performClick() : false;
            }, 2500));
        },
        performCreateTagClick: function (name) {
            return requireMain(runOnMainSync(function () {
                if (tagNameInput === null || createTagView === null) {
                    return false;
                }
                tagNameInput.setText(String(name === null ||
                    name === undefined ? "" : name));
                tagNameInput.setSelection(tagNameInput.getText().length());
                return createTagView.performClick();
            }, 2500));
        },
        performTagToggleClick: function (tagId) {
            tagId = String(Number(tagId));
            return requireMain(runOnMainSync(function () {
                return tagViews[tagId] ?
                    tagViews[tagId].performClick() : false;
            }, 2500));
        },
        performTagDeleteClick: function (tagId) {
            tagId = String(Number(tagId));
            return requireMain(runOnMainSync(function () {
                return tagDeleteViews[tagId] ?
                    tagDeleteViews[tagId].performClick() : false;
            }, 2500));
        },
        performOpenTagSelectorClick: function () {
            return requireMain(runOnMainSync(function () {
                return metadataTypeView !== null ?
                    metadataTypeView.performClick() : false;
            }, 2500));
        },
        performTagSelectionSaveClick: function () {
            return requireMain(runOnMainSync(function () {
                return tagSelectionSaveView !== null ?
                    tagSelectionSaveView.performClick() : false;
            }, 2500));
        },
        performTagSelectionCancelClick: function () {
            return requireMain(runOnMainSync(function () {
                return tagSelectionCancelView !== null ?
                    tagSelectionCancelView.performClick() : false;
            }, 2500));
        },
        getDraftTagIds: function () { return copyTagIds(editorDraftTagIds); },
        renameTag: function (tagId, name) {
            return renameTag(Number(tagId), name);
        },
        shutdown: function () {
            ready = false;
            stopEditorImePolling();
            try { closePanel("shutdown"); } catch (ignoredClose) {}
            clearViews();
            androidContext = null;
            appContext = null;
            windowManager = null;
            inputMethodManager = null;
            mainHandler = null;
            return true;
        }
    };
}((function () { return this; }())));
